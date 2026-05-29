import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TwilioTokenPayload {
  callId: string;
  scenarioId: string;
  iat: number;
}

/**
 * Verify and decode an HMAC-SHA256 signed token.
 * Format: base64url(payload).base64url(signature)
 *
 * Used by the voice webhook GET handler for authenticated health checks.
 * NOTE: createTwilioToken was removed as dead code — the voice POST handler
 * relies on Twilio signature validation (validate.ts) for authentication
 * and passes callId/scenarioId directly in query params. The HMAC token
 * layer added complexity without security benefit over Twilio's own
 * request validation.
 *
 * Returns null if the token is invalid, expired, or tampered with.
 */
export function verifyTwilioToken(
  token: string,
  maxAgeMs: number = DEFAULT_TTL_MS,
): TwilioTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

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
