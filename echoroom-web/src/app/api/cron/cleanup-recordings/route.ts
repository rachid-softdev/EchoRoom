import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cleanupOldRecordings } from "@/server/jobs/cleanupRecordings";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("cron-cleanup-recordings");

/**
 * GET /api/cron/cleanup-recordings
 *
 * Protected cron endpoint (invoked by Vercel Cron Jobs).
 * Nettoyage des enregistrements audio expirés (90 jours par défaut).
 *
 * Auth: Bearer token matching CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
  // Enforce 5-minute timeout (batch deletion + DB updates)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300_000);

  try {
    // ── Authentication ──────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const expected = process.env["CRON_SECRET"] ?? "";

    if (!authHeader || !expected) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    // Constant-time comparison — mitigates timing side-channel attacks
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);

    const isValid =
      tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf);

    if (!isValid) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // ── Execute cleanup ─────────────────────────────────────────────
    const deletedCount = await cleanupOldRecordings(90);

    clearTimeout(timeoutId);

    return NextResponse.json({
      success: true,
      deletedRecordings: deletedCount,
      retentionDays: 90,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (controller.signal.aborted) {
      return NextResponse.json({ error: "Délai d'exécution dépassé" }, { status: 504 });
    }

    log.error("Cleanup recordings failed", { error });

    return NextResponse.json({ success: false, reason: "Erreur interne" }, { status: 500 });
  }
}

export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";
