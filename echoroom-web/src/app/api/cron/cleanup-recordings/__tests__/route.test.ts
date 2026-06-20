import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Cleanup Recordings Cron Route tests
// ---------------------------------------------------------------------------
// GET /api/cron/cleanup-recordings
//   Protected cron endpoint that cleans up expired audio recordings.
//   Auth: Bearer token matching CRON_SECRET env var.
//   - Valid token → 200 with deletedRecordings count
//   - No auth header → 401
//   - Wrong token → 401
//   - CRON_SECRET empty → 401
//   - cleanupOldRecordings throws → 500
//   - Timeout (AbortController) → 504

const CRON_SECRET = "test-cron-secret-value-42";

vi.mock("@/server/jobs/cleanupRecordings", () => ({
  cleanupOldRecordings: vi.fn(),
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
    url: "https://api.echoroom.app/api/cron/cleanup-recordings",
  } as unknown as NextRequest;
}

describe("GET /api/cron/cleanup-recordings", () => {
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

  it("should return 200 with deletedRecordings when valid Bearer token is provided", async () => {
    const { cleanupOldRecordings } = await import("@/server/jobs/cleanupRecordings");
    (cleanupOldRecordings as any).mockResolvedValue(42);

    const { GET } = await import("../route");
    const req = createRequest(`Bearer ${CRON_SECRET}`);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      deletedRecordings: 42,
      retentionDays: 90,
    });
    expect(cleanupOldRecordings).toHaveBeenCalledWith(90);
  });

  it("should return 401 when no authorization header is present", async () => {
    const { cleanupOldRecordings } = await import("@/server/jobs/cleanupRecordings");

    const { GET } = await import("../route");
    const req = createRequest(null);
    const response = await GET(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Non autorisé" });
    expect(cleanupOldRecordings).not.toHaveBeenCalled();
  });

  it("should return 401 when Bearer token does not match CRON_SECRET", async () => {
    const { cleanupOldRecordings } = await import("@/server/jobs/cleanupRecordings");

    const { GET } = await import("../route");
    const req = createRequest("Bearer wrong-token");
    const response = await GET(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Non autorisé" });
    expect(cleanupOldRecordings).not.toHaveBeenCalled();
  });

  it("should return 401 when CRON_SECRET env var is empty", async () => {
    delete process.env["CRON_SECRET"];
    const { cleanupOldRecordings } = await import("@/server/jobs/cleanupRecordings");

    // Need to re-import after env change to pick up the new value
    const { GET } = await import("../route");
    const req = createRequest("Bearer anything");
    const response = await GET(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Non autorisé" });
    expect(cleanupOldRecordings).not.toHaveBeenCalled();
  });

  it("should accept token without 'Bearer ' prefix", async () => {
    const { cleanupOldRecordings } = await import("@/server/jobs/cleanupRecordings");
    (cleanupOldRecordings as any).mockResolvedValue(10);

    const { GET } = await import("../route");
    // Token without Bearer prefix uses the raw authHeader as the token
    const req = createRequest(CRON_SECRET);
    const response = await GET(req);

    expect(response.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("should return 500 when cleanupOldRecordings throws", async () => {
    const { cleanupOldRecordings } = await import("@/server/jobs/cleanupRecordings");
    (cleanupOldRecordings as any).mockRejectedValue(new Error("DB connection failed"));

    // AbortController mock to simulate non-aborted state in catch
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

  it("should return 504 when operation exceeds timeout (AbortController aborted)", async () => {
    const { cleanupOldRecordings } = await import("@/server/jobs/cleanupRecordings");
    (cleanupOldRecordings as any).mockImplementation(
      () =>
        new Promise((_, reject) => {
          // Simulate an operation that gets aborted
          reject(new Error("Aborted"));
        }),
    );

    // Mock AbortController to produce an already-aborted signal
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
