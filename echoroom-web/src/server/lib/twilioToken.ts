import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// 1 hour is sufficient — max call duration is 10 minutes (CALL_TIMEOUT_MS)
// and each <Gather> creates a fresh token for the next action URL.
// Each turn typically lasts 5-30 seconds.
// Reducing this limits exposure of leaked tokens in Twilio console logs.
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface TwilioTokenPayload {
  callId: string;
  scenarioId: string;
  characterId: string;
  iat: number;
}

/**
 * Create an HMAC-SHA256 signed token embedding callId and scenarioId.
 * Format: base64url(payload).base64url(signature)
 *
 * Used to pass opaque references to Twilio webhook URLs instead of raw
 * database IDs, preventing internal ID leakage in Twilio console logs.
 *
 * @returns A signed token string (format: "base64payload.base64signature")
 */
export function createTwilioToken(
  callId: string,
  scenarioId: string,
  characterId: string,
): string {
  const payload: TwilioTokenPayload = { callId, scenarioId, characterId, iat: Date.now() };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64url");

  const signature = createHmac("sha256", env.TWILIO_TOKEN_SECRET)
    .update(payloadStr)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 signed token.
 * Format: base64url(payload).base64url(signature)
 *
 * Returns null if the token is invalid, expired, or tampered with.
 */
export function verifyTwilioToken(
  token: string,
  maxAgeMs: number = DEFAULT_TTL_MS,
): TwilioTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const payloadB64 = parts[0]!;
  const signature = parts[1]!;

  try {
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const expectedSignature = createHmac("sha256", env.TWILIO_TOKEN_SECRET)
      .update(payloadStr)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload: TwilioTokenPayload = JSON.parse(payloadStr);

    if (Date.now() - payload.iat > maxAgeMs) return null;

    return payload;
  } catch {
    return null;
  }
}
