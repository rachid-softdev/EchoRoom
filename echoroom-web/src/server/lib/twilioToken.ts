import { createHmac, timingSafeEqual } from "node:crypto";

const ENV_VAR = "TWILIO_TOKEN_SECRET";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env[ENV_VAR];
  if (!secret) {
    throw new Error(`${ENV_VAR} environment variable is required`);
  }
  return secret;
}

interface TwilioTokenPayload {
  callId: string;
  scenarioId: string;
  iat: number;
}

/**
 * Create an HMAC-SHA256 signed token for Twilio webhook URLs.
 * Format: base64url(payload).base64url(signature)
 * Payload is JSON: { callId, scenarioId, iat }
 */
export function createTwilioToken(callId: string, scenarioId: string): string {
  const secret = getSecret();
  const payload: TwilioTokenPayload = { callId, scenarioId, iat: Date.now() };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode an HMAC-signed token.
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
    const secret = getSecret();
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const expectedSignature = createHmac("sha256", secret)
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
