import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { redis } from "@/lib/redis";

/**
 * GET /api/health
 *
 * Healthcheck endpoint for monitoring and orchestration.
 * Returns the status of the application and its dependencies.
 */
export async function GET() {
  const start = performance.now();
  const checks: Record<string, "healthy" | "unhealthy"> = {};
  let allHealthy = true;

  // ── Database check ──────────────────────────────────────────────
  try {
    await db.$queryRaw`SELECT 1`;
    checks["database"] = "healthy";
  } catch {
    checks["database"] = "unhealthy";
    allHealthy = false;
  }

  // ── Redis check ─────────────────────────────────────────────────
  if (redis) {
    try {
      await redis.ping();
      checks["redis"] = "healthy";
    } catch {
      checks["redis"] = "unhealthy";
      allHealthy = false;
    }
  } else {
    checks["redis"] = "unhealthy";
    allHealthy = false;
  }

  const duration = Math.round(performance.now() - start);

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      durationMs: duration,
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
