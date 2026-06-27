import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// GDPR Export Route — CSRF Origin Validation Tests
// ---------------------------------------------------------------------------
// POST /api/user/export — The route performs CSRF defense by validating
// the Origin header against the application's configured origin
// (NEXT_PUBLIC_APP_URL). If provided, the Origin must match.
// If no Origin header is present (e.g., curl, mobile apps), the request
// is allowed through. (SameSite=Lax on the session cookie is the primary
// CSRF defense; Origin header is defense-in-depth.)
//
// Tests: M-4 fix — Replaced X-Requested-With CSRF with Origin validation.

const VALID_ORIGIN = "https://echoroom.app";
const FORBIDDEN_ORIGIN = "https://evil.com";
const INVALID_ORIGIN_STRING = "not-a-url";

// We'll set NEXT_PUBLIC_APP_URL before tests
const originalEnv = process.env["NEXT_PUBLIC_APP_URL"];

// Mock the auth, db, and logger modules
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    scenario: { findMany: vi.fn().mockResolvedValue([]) },
    call: { findMany: vi.fn().mockResolvedValue([]) },
    comment: { findMany: vi.fn().mockResolvedValue([]) },
    purchase: { findMany: vi.fn().mockResolvedValue([]) },
    clip: { findMany: vi.fn().mockResolvedValue([]) },
    abuseReport: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// CSRF Origin Validation Tests
// ---------------------------------------------------------------------------

function createMockRequest(origin: string | null): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (origin !== null) {
    headers["origin"] = origin;
  }
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    method: "POST",
  } as unknown as Request;
}

describe("POST /api/user/export — CSRF Origin Validation (M-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set the app URL to our test expected origin
    process.env["NEXT_PUBLIC_APP_URL"] = VALID_ORIGIN;
  });

  afterAll(() => {
    process.env["NEXT_PUBLIC_APP_URL"] = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Origin validation
  // -----------------------------------------------------------------------

  it("should pass when Origin matches the application URL", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const { db } = await import("@/server/db");
    const mockDb = db as any;
    mockDb.user.findUnique.mockResolvedValue({ gdprDataExportedAt: null });

    const { POST } = await import("../route");
    const req = createMockRequest(VALID_ORIGIN);

    // The request should proceed past the CSRF check (will fail at later auth steps
    // if auth is mocked correctly, but we just want to verify it doesn't 403)
    const response = await POST(req as any);
    // If it passes CSRF, it won't get 403. It might 404 or other errors from
    // subsequent steps, but shouldn't be 403.
    expect(response.status).not.toBe(403);
  });

  it("should reject with 403 when Origin does not match the application URL", async () => {
    const { POST } = await import("../route");
    const req = createMockRequest(FORBIDDEN_ORIGIN);

    const response = await POST(req as any);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body).toHaveProperty("error", "Origine non autorisée");
  });

  it("should pass when no Origin header is present (curl/mobile fallback)", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const { db } = await import("@/server/db");
    const mockDb = db as any;
    mockDb.user.findUnique.mockResolvedValue({ gdprDataExportedAt: null });

    const { POST } = await import("../route");
    const req = createMockRequest(null);

    const response = await POST(req as any);
    expect(response.status).not.toBe(403);
  });

  it("should reject with 400 when Origin is an invalid URL", async () => {
    const { POST } = await import("../route");
    const req = createMockRequest(INVALID_ORIGIN_STRING);

    const response = await POST(req as any);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty("error", "Origine invalide");
  });

  it("should reject when Origin matches app host but different scheme (http vs https)", async () => {
    // The route constructs URL objects from both origin and appUrl,
    // then compares .origin properties which include the protocol.
    // http://echoroom.app !== https://echoroom.app
    const { POST } = await import("../route");
    const req = createMockRequest("http://echoroom.app");

    const response = await POST(req as any);
    expect(response.status).toBe(403);
  });

  it("should reject when Origin matches app host but different port", async () => {
    const { POST } = await import("../route");
    const req = createMockRequest("https://echoroom.app:8080");

    const response = await POST(req as any);
    expect(response.status).toBe(403);
  });

  it("should allow request with matching Origin and proceed to auth check", async () => {
    // Full integration test: CSRF passes, then auth is checked
    const { auth } = await import("@/lib/auth");
    // Simulate unauthenticated user
    (auth as any).mockResolvedValue(null);

    const { POST } = await import("../route");
    const req = createMockRequest(VALID_ORIGIN);

    const response = await POST(req as any);
    expect(response.status).toBe(401); // Auth should fail, not CSRF

    const body = await response.json();
    expect(body).toHaveProperty("error", "Non authentifié");
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("should treat empty string Origin as absent (falsy) and skip CSRF check", async () => {
    // An empty string is falsy in JS, so `if (origin)` evaluates to false
    // and the CSRF check is skipped — the request proceeds to auth.
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue(null);

    const { POST } = await import("../route");
    const req = createMockRequest("");

    const response = await POST(req as any);
    // CSRF is skipped (empty string is falsy), then fails at auth
    expect(response.status).toBe(401);
  });

  it("should handle app URL with default localhost when NEXT_PUBLIC_APP_URL is unset", async () => {
    delete process.env["NEXT_PUBLIC_APP_URL"];

    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue(null);

    // Use localhost origin which should match the default
    const { POST } = await import("../route");
    const req = createMockRequest("http://localhost:3000");

    const response = await POST(req as any);
    // CSRF passes (localhost matches default), then fails at auth
    expect(response.status).toBe(401);
  });
});
