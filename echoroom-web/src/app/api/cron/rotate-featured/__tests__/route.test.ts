import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Rotate Featured Scenario Cron Route tests
// ---------------------------------------------------------------------------
// GET /api/cron/rotate-featured
//   Protected cron endpoint that rotates the daily featured scenario.
//   Auth: Bearer token matching CRON_SECRET env var.
//   - Valid token → 200 with scenarioId and date
//   - No eligible scenarios → 200 with null scenarioId
//   - No auth header → 401
//   - rotateFeaturedScenario throws → 500
//   - Timeout → 504

const CRON_SECRET = "test-cron-secret-featured";

vi.mock("@/server/services/community/rotateFeaturedScenario", () => ({
  rotateFeaturedScenario: vi.fn(),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

function createRequest(authorization: string | null): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name === "authorization") return authorization;
        return null;
      },
    },
    url: "https://api.echoroom.app/api/cron/rotate-featured",
  } as unknown as NextRequest;
}

describe("GET /api/cron/rotate-featured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["CRON_SECRET"] = CRON_SECRET;
  });

  afterAll(() => {
    delete process.env["CRON_SECRET"];
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  it("should return 200 with scenarioId when valid Bearer token is provided", async () => {
    const { rotateFeaturedScenario } = await import(
      "@/server/services/community/rotateFeaturedScenario"
    );
    (rotateFeaturedScenario as any).mockResolvedValue({
      scenarioId: "scenario-123",
      date: "2026-06-20T00:00:00.000Z",
    });

    const { GET } = await import("../route");
    const req = createRequest(`Bearer ${CRON_SECRET}`);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      scenarioId: "scenario-123",
      date: "2026-06-20T00:00:00.000Z",
    });
    expect(rotateFeaturedScenario).toHaveBeenCalledTimes(1);
  });

  it("should return 200 with null scenarioId when no eligible scenarios exist", async () => {
    const { rotateFeaturedScenario } = await import(
      "@/server/services/community/rotateFeaturedScenario"
    );
    (rotateFeaturedScenario as any).mockResolvedValue({
      scenarioId: null,
      date: "2026-06-20T00:00:00.000Z",
    });

    const { GET } = await import("../route");
    const req = createRequest(`Bearer ${CRON_SECRET}`);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      scenarioId: null,
      date: "2026-06-20T00:00:00.000Z",
    });
  });

  it("should return 401 when no authorization header is present", async () => {
    const { rotateFeaturedScenario } = await import(
      "@/server/services/community/rotateFeaturedScenario"
    );

    const { GET } = await import("../route");
    const req = createRequest(null);
    const response = await GET(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Non autorisé" });
    expect(rotateFeaturedScenario).not.toHaveBeenCalled();
  });

  it("should return 401 when Bearer token does not match CRON_SECRET", async () => {
    const { rotateFeaturedScenario } = await import(
      "@/server/services/community/rotateFeaturedScenario"
    );

    const { GET } = await import("../route");
    const req = createRequest("Bearer wrong-token");
    const response = await GET(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Non autorisé" });
    expect(rotateFeaturedScenario).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("should return 500 when rotateFeaturedScenario throws", async () => {
    const { rotateFeaturedScenario } = await import(
      "@/server/services/community/rotateFeaturedScenario"
    );
    (rotateFeaturedScenario as any).mockRejectedValue(
      new Error("Rotation query failed"),
    );

    const { GET } = await import("../route");
    const req = createRequest(`Bearer ${CRON_SECRET}`);
    const response = await GET(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      reason: "Erreur interne",
    });
  });

  it("should return 504 when operation exceeds 30s timeout", async () => {
    const { rotateFeaturedScenario } = await import(
      "@/server/services/community/rotateFeaturedScenario"
    );
    (rotateFeaturedScenario as any).mockImplementation(
      () =>
        new Promise((_, reject) => {
          reject(new Error("Timed out"));
        }),
    );

    // Mock AbortController to return an already-aborted signal
    const originalAbortController = globalThis.AbortController;
    const mockAbortSignal = {
      aborted: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onabort: null,
      reason: undefined,
      throwIfAborted: vi.fn(),
    };
    (globalThis as any).AbortController = vi.fn(() => ({
      signal: mockAbortSignal,
      abort: vi.fn(),
    })) as any;

    try {
      const { GET } = await import("../route");
      const req = createRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(req);

      expect(response.status).toBe(504);
      const body = await response.json();
      expect(body).toEqual({ error: "Délai d'exécution dépassé" });
    } finally {
      globalThis.AbortController = originalAbortController;
    }
  });
});
