import type { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// GDPR Purge Cron Route tests
// ---------------------------------------------------------------------------
// GET /api/cron/gdpr-purge
//   Protected cron endpoint that purges anonymized user data.
//   Auth: Bearer token matching CRON_SECRET env var.
//   - Valid token → 200 with deletedUsers count
//   - No auth header → 401
//   - Wrong token → 401
//   - purgeAnonymizedUsers throws → 500

const CRON_SECRET = "test-cron-secret-gdpr";

vi.mock("@/server/jobs/gdprPurge", () => ({
  purgeAnonymizedUsers: vi.fn(),
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
    url: "https://api.echoroom.app/api/cron/gdpr-purge",
  } as unknown as NextRequest;
}

describe("GET /api/cron/gdpr-purge", () => {
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

  it("should return 200 with deletedUsers when valid Bearer token is provided", async () => {
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");
    (purgeAnonymizedUsers as any).mockResolvedValue({ deletedUsers: 7 });

    const { GET } = await import("../route");
    const req = createRequest(`Bearer ${CRON_SECRET}`);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      deletedUsers: 7,
    });
    expect(purgeAnonymizedUsers).toHaveBeenCalledWith(37);
  });

  it("should return 200 with zero deletedUsers when none are purged", async () => {
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");
    (purgeAnonymizedUsers as any).mockResolvedValue({ deletedUsers: 0 });

    const { GET } = await import("../route");
    const req = createRequest(`Bearer ${CRON_SECRET}`);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      deletedUsers: 0,
    });
  });

  it("should return 401 when no authorization header is present", async () => {
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");

    const { GET } = await import("../route");
    const req = createRequest(null);
    const response = await GET(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Non autorisé" });
    expect(purgeAnonymizedUsers).not.toHaveBeenCalled();
  });

  it("should return 401 when Bearer token does not match CRON_SECRET", async () => {
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");

    const { GET } = await import("../route");
    const req = createRequest("Bearer wrong-token");
    const response = await GET(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Non autorisé" });
    expect(purgeAnonymizedUsers).not.toHaveBeenCalled();
  });

  it("should return 401 when CRON_SECRET env var is empty", async () => {
    delete process.env["CRON_SECRET"];
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");

    const { GET } = await import("../route");
    const req = createRequest("Bearer anything");
    const response = await GET(req);

    expect(response.status).toBe(401);
    expect(purgeAnonymizedUsers).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it("should return 500 when purgeAnonymizedUsers throws", async () => {
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");
    (purgeAnonymizedUsers as any).mockRejectedValue(new Error("DB purge failed"));

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

  it("should call purgeAnonymizedUsers with retentionDays=37", async () => {
    const { purgeAnonymizedUsers } = await import("@/server/jobs/gdprPurge");
    (purgeAnonymizedUsers as any).mockResolvedValue({ deletedUsers: 1 });

    const { GET } = await import("../route");
    const req = createRequest(`Bearer ${CRON_SECRET}`);
    await GET(req);

    expect(purgeAnonymizedUsers).toHaveBeenCalledWith(37);
  });
});
