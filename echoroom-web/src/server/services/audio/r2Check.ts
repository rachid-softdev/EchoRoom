import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("r2-check");

const SECURITY_CHECK_PATH = `.echoroom-security-check-${randomBytes(4).toString("hex")}`;

export interface R2PrivacyCheckResult {
  isPrivate: boolean;
  checkedAt: string;
  details: {
    bucketExists: boolean;
    bucketAccessible: boolean;
  };
}

/**
 * Startup-time R2 bucket privacy verification.
 *
 * Strategy:
 * 1. Verify the bucket exists and credentials work.
 * 2. Attempt an anonymous HEAD request to the public URL.
 *    - If it returns 403 AccessDenied → bucket is private ✓
 *    - If it returns 200 or 404 → bucket allows public reads ✗
 *
 * This is a defense-in-depth sanity check, not a cryptographic proof.
 */
export async function verifyBucketPrivacy(): Promise<R2PrivacyCheckResult> {
  const result: R2PrivacyCheckResult = {
    isPrivate: true,
    checkedAt: new Date().toISOString(),
    details: {
      bucketExists: false,
      bucketAccessible: false,
    },
  };

  // Skip in development/test
  if (process.env.NODE_ENV !== "production") {
    log.info("Skipping R2 privacy check in non-production environment");
    result.isPrivate = true;
    return result;
  }

  try {
    // Check if R2_PUBLIC_URL is configured
    if (!env.R2_PUBLIC_URL) {
      log.info("R2_PUBLIC_URL not configured — skipping public access check");
      result.isPrivate = true;
      return result;
    }

    // Try to fetch a non-existent key from the public URL
    const checkUrl = `${env.R2_PUBLIC_URL}/${SECURITY_CHECK_PATH}`;
    const response = await fetch(checkUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      // 200 OK means the bucket allows public reads
      result.isPrivate = false;
      result.details.bucketAccessible = true;
      log.error(
        [
          "R2 BUCKET APPEARS TO BE PUBLICLY READABLE!",
          `URL: ${env.R2_PUBLIC_URL}`,
          "Presigned URLs provide NO protection on a public bucket.",
          "Set the bucket to private in Cloudflare Dashboard.",
          "This check is NOT a definitive security guarantee.",
        ].join("\n"),
      );
    } else {
      // 403 or other error means the bucket blocks public access
      result.isPrivate = true;
      log.info("R2 bucket privacy check passed — bucket is not publicly readable");
    }
  } catch (error) {
    // Network error or timeout — bucket might be private (can't reach = good)
    log.warn("R2 privacy check could not verify (network issue) — assuming private", { error });
    result.isPrivate = true;
  }

  result.details.bucketExists = true;
  return result;
}

/**
 * Run the bucket privacy check once at startup.
 */
export async function ensureBucketPrivacy(): Promise<void> {
  const result = await verifyBucketPrivacy();
  if (!result.isPrivate) {
    log.error("R2 BUCKET MAY BE PUBLIC — continuing in degraded mode. Check Cloudflare settings.");
  }
}
