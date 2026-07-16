import { env } from "@/lib/env";
import { db } from "@/server/db";
import { getUTCDayRange } from "@/server/lib/date";
import { encryptPhoneNumber } from "@/server/lib/encryption";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { createTwilioToken } from "@/server/lib/twilioToken";
import { callRepository, scenarioRepository } from "@/server/repositories";
import { atomicDebit } from "@/server/services/billing/creditOps";
import { atomicIncrementDailyLimit } from "@/server/services/billing/dailyLimitOps";
import { TWILIO_PHONE, twilioCircuitBreaker, twilioClient } from "./twilio";
import { prismaPlanToTier } from "@/config/pricing";
import { isFeatureEnabled } from "@/config/featureFlags";

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
        const delay = Math.min(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 1000, maxDelayMs);
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
  const scenario = await scenarioRepository.findByIdWithCharacter(params.scenarioId);

  if (!scenario) {
    throw new AppError("SCENARIO_NOT_FOUND", "Scénario introuvable");
  }

  const { todayStart } = getUTCDayRange();

  // Resolve the caller's plan tier from UserBilling (source of truth).
  const billingPlan = await db.userBilling.findUnique({
    where: { userId: params.userId },
    select: { plan: true },
  });
  const tier = prismaPlanToTier(billingPlan?.plan ?? "FREE");
  const isUltra = tier === "ultra";

  // Enforce server-side call-duration cap (never trust the client value).
  // Ultra with experimentalLongCalls may run up to 600s; everyone else is capped at 300s.
  const durationCap = isFeatureEnabled("experimentalLongCalls", { tier }) ? 600 : 300;
  const effectiveDuration = Math.min(
    Math.max(params.maxDurationSeconds, 60),
    durationCap,
  );

  // Step 1: Single transaction — atomic daily limit + atomic debit + create call
  const { call } = await db.$transaction(async (tx) => {
    // Atomically increment daily limit (throws DAILY_LIMIT_EXCEEDED if at max).
    // Ultra has no daily limit, so we bypass the count/duration cap.
    await atomicIncrementDailyLimit(tx, {
      userId: params.userId,
      date: todayStart,
      maxLimit: 10,
      bypassLimit: isUltra,
      currentCallDurationSeconds: effectiveDuration,
    });

    // Atomically debit the user
    const debitResult = await atomicDebit(tx, {
      userId: params.userId,
      cost: 1,
    });

    if (!debitResult.debited) {
      if (debitResult.reason === "USER_NOT_FOUND") {
        throw new AppError("USER_NOT_FOUND", "Utilisateur introuvable");
      }
      throw new AppError("INSUFFICIENT_CREDITS", "Crédits insuffisants");
    }

    // Create the call record with CALLING status within the same transaction
    const newCall = await tx.call.create({
      data: {
        userId: params.userId,
        scenarioId: params.scenarioId,
        phoneNumber: encryptPhoneNumber(params.phoneNumber),
        status: "CALLING",
        costCredits: 1,
      },
    });

    return { call: newCall };
  });

  // Step 2: Initiate Twilio call (outside transaction — network call)
  try {
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Use an opaque HMAC-signed token instead of raw database IDs
    // to prevent internal ID leakage in Twilio console logs.
    const token = createTwilioToken(call.id, scenario.id, scenario.characterId);

    const twilioCall = await twilioCircuitBreaker.call(() =>
      withRetry(
        () =>
          twilioClient.calls.create({
            to: params.phoneNumber,
            from: TWILIO_PHONE,
            url: `${appUrl}/api/webhooks/twilio/voice?token=${encodeURIComponent(token)}`,
            statusCallback: `${appUrl}/api/webhooks/twilio`,
            statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
            statusCallbackMethod: "POST",
            timeout: effectiveDuration,
          }),
        2,
        1000,
        5000,
      ),
    );

    // Update call with Twilio SID and status — only if still CALLING
    await callRepository.updateStatusWithGuard(call.id, "CALLING", "RINGING", {
      twilioCallSid: twilioCall.sid,
    });

    return { callId: call.id, estimatedCredits: 1 };
  } catch (error) {
    // Step 3: Atomic refund on failure — delegates to repository for consistency
    await callRepository.markAsFailedWithRefund(call.id, 0);

    // Log server-side with full error context
    log.error("Twilio call initiation failed", { error });
    // Sanitize error message — don't leak Twilio internals to the client
    throw new AppError("TWILIO_ERROR", "Échec de l'appel");
  }
}

export async function failCall(callId: string, durationSeconds: number = 0) {
  // Delegates to CallRepository for consistency
  await callRepository.markAsFailedWithRefund(callId, durationSeconds);
}
