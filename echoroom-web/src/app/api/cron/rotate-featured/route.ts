import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createLogger } from "@/server/lib/logger";
import { rotateFeaturedScenario } from "@/server/services/community/rotateFeaturedScenario";

const log = createLogger("cron-rotate-featured");

/**
 * GET /api/cron/rotate-featured
 *
 * Protected cron endpoint (invoked by Vercel Cron Jobs).
 * Triggers the daily featured scenario auto-rotation.
 *
 * Auth: Bearer token matching CRON_SECRET environment variable.
 */
export async function GET(request: NextRequest) {
  // Enforce 30-second timeout (rotation queries + DB write)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    // ── Authentication ──────────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const expected = process.env.CRON_SECRET ?? '';

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

    // ── Execute rotation ────────────────────────────────────────────
    const result = await rotateFeaturedScenario();

    clearTimeout(timeoutId);

    return NextResponse.json({
      success: true,
      scenarioId: result.scenarioId,
      date: result.date,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (controller.signal.aborted) {
      return NextResponse.json(
        { error: "Délai d'exécution dépassé" },
        { status: 504 },
      );
    }

    // Log full error server-side, return generic message
    log.error("Rotation failed", { error });

    return NextResponse.json(
      { success: false, reason: "Erreur interne" },
      { status: 500 },
    );
  }
}
