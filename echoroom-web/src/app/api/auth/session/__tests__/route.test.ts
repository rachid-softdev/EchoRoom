import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Session API Route tests
// ---------------------------------------------------------------------------
// GET /api/auth/session:
//   Returns the current session from next-auth.
//   - Valid session → 200 JSON with session data
//   - No session → 200 JSON with null
//   - auth() throws → 500 JSON with error message

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return session JSON when auth() returns valid session (status 200)", async () => {
    const { auth } = await import("@/lib/auth");
    const mockSession = {
      user: { id: "user-1", name: "Test User", email: "test@example.com" },
      expires: "2026-01-01T00:00:00.000Z",
    };
    (auth as any).mockResolvedValue(mockSession);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockSession);
  });

  it("should return null JSON when auth() returns null (unauthenticated)", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue(null);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeNull();
  });

  it("should return 500 JSON when auth() throws an error", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockRejectedValue(new Error("Database connection failed"));

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Erreur interne du serveur" });
  });

  it("should have Content-Type: application/json", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({ user: { id: "user-1" } });

    const { GET } = await import("../route");
    const response = await GET();

    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("application/json");
  });
});
