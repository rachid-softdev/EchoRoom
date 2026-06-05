import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createLogger } from "@/server/lib/logger";
import { purgeAnonymizedUsers } from "@/server/jobs/gdprPurge";

const log = createLogger("cron-gdpr-purge");

/**
 * GET /api/cron/gdpr-purge
 *
 * Protected cron endpoint (invoked by Vercel Cron Jobs).
 * Purges anonymized user data after the GDPR retention period.
 *
 * Auth: Bearer token matching CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Authentication ──────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const expected = process.env['CRON_SECRET'] ?? '';

    if (!authHeader || !expected) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 },
      );
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    // Constant-time comparison — mitigates timing side-channel attacks
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);

    const isValid =
      tokenBuf.length === expectedBuf.length &&
      timingSafeEqual(tokenBuf, expectedBuf);

    if (!isValid) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 },
      );
    }

    // ── Execute GDPR purge ──────────────────────────────────────────
    const result = await purgeAnonymizedUsers(37);

    return NextResponse.json({
      success: true,
      deletedUsers: result.deletedUsers,
    });
  } catch (error) {
    log.error("GDPR purge failed", { error });

    return NextResponse.json(
      { success: false, reason: "Erreur interne" },
      { status: 500 },
    );
  }
}
