import { twilioClient, TWILIO_PHONE } from "./twilio";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { AppError } from "@/server/lib/errors";
import { checkAndAwardBadges } from "@/server/services/social/badges";

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError!;
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

  const user = await db.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new AppError("USER_NOT_FOUND", "User not found");
  }

  if (user.credits < 1) {
    throw new AppError("INSUFFICIENT_CREDITS", "Insufficient credits");
  }

  // Create the call record
  const call = await db.call.create({
    data: {
      userId: params.userId,
      scenarioId: params.scenarioId,
      phoneNumber: params.phoneNumber,
      status: "PENDING",
      costCredits: 1,
    },
  });

  try {
    // Initiate Twilio call
    // The voice webhook route (api/webhooks/twilio/voice) will be
    // implemented in Phase 3 — it returns TwiML that drives the
    // AI conversation (TTS, STT, conversation state machine).
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const twilioCall = await twilioClient.calls.create({
      to: params.phoneNumber,
      from: TWILIO_PHONE,
      url: `${appUrl}/api/webhooks/twilio/voice?callId=${call.id}&scenarioId=${encodeURIComponent(scenario.id)}&characterId=${encodeURIComponent(scenario.character.id)}`,
      statusCallback: `${appUrl}/api/webhooks/twilio`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      timeout: params.maxDurationSeconds,
    });

    // Store the Twilio CallSid and update status atomically
    await db.$transaction([
      db.call.update({
        where: { id: call.id },
        data: { status: "RINGING", twilioCallSid: twilioCall.sid },
      }),
      db.user.update({
        where: { id: params.userId },
        data: { credits: { decrement: 1 } },
      }),
    ]);

    return { callId: call.id, estimatedCredits: 1 };
  } catch (_error) {
    // Refund on failure
    await db.$transaction([
      db.user.update({
        where: { id: params.userId },
        data: { credits: { increment: call.costCredits } },
      }),
      db.call.update({
        where: { id: call.id },
        data: { status: "FAILED" },
      }),
    ]);

    throw new AppError("TWILIO_ERROR", "Failed to initiate call");
  }
}

export async function completeCall(callId: string, durationSeconds: number) {
  const call = await db.call.findUnique({
    where: { id: callId },
    select: { userId: true },
  });

  if (!call) return;

  await db.$transaction([
    db.call.update({
      where: { id: callId },
      data: {
        status: "COMPLETED",
        durationSeconds,
        endedAt: new Date(),
      },
    }),
    db.user.update({
      where: { id: call.userId },
      data: { totalCallsMade: { increment: 1 } },
    }),
  ]);

  // Fire-and-forget badge check — do not block the response
  checkAndAwardBadges(call.userId, "FIRST_CALL").catch(() => {
    // Silently ignore badge check failures
  });
}

export async function failCall(
  callId: string,
  durationSeconds: number = 0,
) {
  const call = await db.call.findUnique({
    where: { id: callId },
  });

  if (!call) return;

  // Refund credits and update status atomically
  await db.$transaction([
    db.user.update({
      where: { id: call.userId },
      data: { credits: { increment: call.costCredits } },
    }),
    db.call.update({
      where: { id: callId },
      data: {
        status: "FAILED",
        durationSeconds,
        endedAt: new Date(),
      },
    }),
  ]);
}
