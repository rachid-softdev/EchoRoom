import { twilioClient, TWILIO_PHONE } from "./twilio";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { AppError } from "@/server/lib/errors";
import { atomicDebit, atomicRefund } from "@/server/services/billing/creditOps";
import { checkAndAwardBadges } from "@/server/services/social/badges";
import { createLogger } from "@/server/lib/logger";
import { encryptPhoneNumber } from "@/server/lib/encryption";
import { createTwilioToken } from "@/server/lib/twilioToken";

const log = createLogger("call-lifecycle");

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 10000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelayMs * 2 ** (attempt - 1) + Math.random() * 1000,
          maxDelayMs,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error("Unexpected error in withRetry");
}

interface StartCallParams {
  scenarioId: string;
  userId: string;
  phoneNumber: string;
  maxDurationSeconds: number;
}

export async function initiateCall(params: StartCallParams) {
  const scenario = await db.scenario.findUnique({
    where: { id: params.scenarioId },
    include: { character: true },
  });

  if (!scenario) {
    throw new AppError("SCENARIO_NOT_FOUND", "Scenario not found");
  }

  // Step 1: Atomic debit + create call record in a single transaction
  const { call } = await db.$transaction(async (tx) => {
    // Atomically debit the user
    const debitResult = await atomicDebit(tx, {
      userId: params.userId,
      cost: 1,
    });

    if (!debitResult.debited) {
      if (debitResult.reason === "USER_NOT_FOUND") {
        throw new AppError("USER_NOT_FOUND", "User not found");
      }
      throw new AppError("INSUFFICIENT_CREDITS", "Insufficient credits");
    }

    // Create the call record within the same transaction
    const newCall = await tx.call.create({
      data: {
        userId: params.userId,
        scenarioId: params.scenarioId,
        phoneNumber: encryptPhoneNumber(params.phoneNumber),
        status: "PENDING",
        costCredits: 1,
      },
    });

    return { call: newCall };
  });

  // Step 2: Initiate Twilio call (outside transaction — network call)
  try {
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const token = createTwilioToken(call.id, scenario.id);
    const twilioCall = await twilioClient.calls.create({
      to: params.phoneNumber,
      from: TWILIO_PHONE,
      url: `${appUrl}/api/webhooks/twilio/voice?token=${token}`,
      statusCallback: `${appUrl}/api/webhooks/twilio`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      timeout: params.maxDurationSeconds,
    });

    // Update call with Twilio SID and status
    await db.call.update({
      where: { id: call.id },
      data: { status: "RINGING", twilioCallSid: twilioCall.sid },
    });

    return { callId: call.id, estimatedCredits: 1 };
  } catch (error) {
    // Step 3: Atomic refund on failure
    await db.$transaction(async (tx) => {
      await atomicRefund(tx, { userId: params.userId, amount: 1 });
      await tx.call.update({
        where: { id: call.id },
        data: { status: "FAILED" },
      });
    });

    // Log and throw with original error context
    log.error("Twilio call initiation failed", { error });
    throw new AppError(
      "TWILIO_ERROR",
      `Failed to initiate call: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function completeCall(callId: string, durationSeconds: number) {
  const call = await db.call.findUnique({
    where: { id: callId },
    select: { userId: true },
  });

  if (!call) return;

  await db.$transaction(async (tx) => {
    await tx.call.update({
      where: { id: callId },
      data: {
        status: "COMPLETED",
        durationSeconds,
        endedAt: new Date(),
      },
    });
    await tx.user.update({
      where: { id: call.userId },
      data: { totalCallsMade: { increment: 1 } },
    });
  });

  // Fire-and-forget badge check — do not block the response
  checkAndAwardBadges(call.userId, "FIRST_CALL").catch((err) => {
    log.error("Badge check failed", { error: err, userId: call.userId });
  });
}

export async function failCall(
  callId: string,
  durationSeconds: number = 0,
) {
  // Idempotent refund inside an atomic transaction
  await db.$transaction(async (tx) => {
    const call = await tx.call.findUnique({
      where: { id: callId },
      select: { userId: true, costCredits: true, status: true },
    });

    // Guard: not found or already failed/completed
    if (!call || call.status === "FAILED" || call.status === "COMPLETED") {
      return;
    }

    // Refund credits
    await tx.user.update({
      where: { id: call.userId },
      data: { credits: { increment: call.costCredits } },
    });

    // Update call status
    await tx.call.update({
      where: { id: callId },
      data: {
        status: "FAILED",
        durationSeconds,
        endedAt: new Date(),
      },
    });
  });
}
