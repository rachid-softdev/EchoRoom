import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET = env.R2_BUCKET_NAME;
export const R2_PUBLIC_URL = env.R2_PUBLIC_URL;

/**
 * Extract the bare R2 key from a stored recording/clip URL.
 *
 * Handles two storage formats:
 *   1. Full URL:    "https://public-bucket.example.com/audio/callSid/turn_timestamp"
 *   2. Bare key:    "audio/callSid/turn_timestamp"
 *
 * When the stored value is a valid URL, the pathname (minus leading '/') is
 * the R2 key.  When it's already a bare key (no http/https prefix), it is
 * returned as-is.
 *
 * Returns null for null, undefined, empty, or truly unparseable input.
 */
export function getR2Key(storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;

  const trimmed = storedUrl.trim();
  if (trimmed.length === 0) return null;

  // Looks like a full URL → parse and extract pathname as bare key
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const key = url.pathname.replace(/^\//, '');
      return key.length > 0 ? key : null;
    } catch {
      // URL malformée — impossible d'extraire une clé R2
      return null;
    }
  }

  // Already a bare key (or something else) — return as-is
  return trimmed;
}
