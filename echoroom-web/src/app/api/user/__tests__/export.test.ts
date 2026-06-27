import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// GDPR Export Tests — N4 atomic rate limiting
// ---------------------------------------------------------------------------
// Tests for POST /api/user/export (export/route.ts):
//   - Uses db.user.updateMany with WHERE conditions as an optimistic lock
//   - Returns 429 when rate-limited
//   - Returns 404 when user not found
//   - Returns 200 with JSON data on success

// Mock auth to return a valid session
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const mockDb = vi.hoisted(() => ({
  user: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  scenario: { findMany: vi.fn() },
  call: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
  purchase: { findMany: vi.fn() },
  clip: { findMany: vi.fn() },
  abuseReport: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

vi.mock("@/server/lib/encryption", () => ({
  decryptPhoneNumber: vi.fn((phone: string) => phone),
  maskPhoneNumber: vi.fn((phone: string) => {
    if (phone.length >= 4) return `xxxx${phone.slice(-4)}`;
    return "****";
  }),
}));

// Mock logger to suppress output
vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

function createMockRequest(headers?: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        const headerMap: Record<string, string> = {
          "x-requested-with": "XMLHttpRequest",
          ...(headers ?? {}),
        };
        return headerMap[name] ?? null;
      },
    },
  } as unknown as NextRequest;
}

const mockUserData = {
  id: "user-123",
  email: "test@example.com",
  username: "testuser",
  displayName: "Test User",
  bio: null,
  image: null,
  role: "USER",
  credits: 100,
  totalLikesReceived: 5,
  totalCallsMade: 3,
  consentAcceptedAt: new Date("2025-01-01"),
  gdprDataExportedAt: null,
  deletedAt: null,
  anonymizedAt: null,
  createdAt: new Date("2025-01-01"),
};

describe("POST /api/user/export — N4 atomic rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
  });

  it("should use updateMany with gdprDataExportedAt conditions (optimistic lock)", async () => {
    // First export — updateMany succeeds (count = 1)
    mockDb.user.updateMany.mockResolvedValue({ count: 1 });
    mockDb.user.findUnique.mockResolvedValue(mockUserData);
    mockDb.scenario.findMany.mockResolvedValue([]);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.comment.findMany.mockResolvedValue([]);
    mockDb.purchase.findMany.mockResolvedValue([]);
    mockDb.clip.findMany.mockResolvedValue([]);
    mockDb.abuseReport.findMany.mockResolvedValue([]);
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { POST } = await import("../export/route");

    const response = await POST(createMockRequest());
    expect(response.status).toBe(200);

    // Verify updateMany was called with the WHERE clause containing gdprDataExportedAt
    expect(mockDb.user.updateMany).toHaveBeenCalledTimes(1);
    const updateManyCall = mockDb.user.updateMany.mock.calls[0]![0];
    expect(updateManyCall.where.id).toBe("user-123");
    expect(updateManyCall.where.OR).toBeDefined();
    expect(updateManyCall.where.OR).toEqual(
      expect.arrayContaining([
        { gdprDataExportedAt: null },
        { gdprDataExportedAt: expect.objectContaining({ lte: expect.any(Date) }) },
      ]),
    );
    expect(updateManyCall.data).toEqual({ gdprDataExportedAt: expect.any(Date) });
  });

  it("should return 429 when updateMany returns count 0 and user has recent export", async () => {
    // Rate-limited: updateMany returns 0 because the OR condition failed
    mockDb.user.updateMany.mockResolvedValue({ count: 0 });
    mockDb.user.findUnique.mockResolvedValue({
      gdprDataExportedAt: new Date(Date.now() - 1800 * 1000), // 30 min ago
    });

    const { POST } = await import("../export/route");

    const response = await POST(createMockRequest());
    expect(response.status).toBe(429);

    const body = await response.json();
    expect(body.error).toContain("Trop de requêtes");
    expect(body).toHaveProperty("retryAfterSeconds");
    expect(typeof body.retryAfterSeconds).toBe("number");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should return 404 when updateMany returns count 0 and user is not found", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 0 });
    mockDb.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("../export/route");

    const response = await POST(createMockRequest());
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toContain("Utilisateur introuvable");
  });

  it("should succeed on first export and return JSON data", async () => {
    // First export — updateMany succeeds
    mockDb.user.updateMany.mockResolvedValue({ count: 1 });
    mockDb.user.findUnique.mockResolvedValue(mockUserData);
    mockDb.scenario.findMany.mockResolvedValue([
      {
        id: "scenario-1",
        title: "Test Scenario",
        description: "A test",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        playCount: 10,
        likeCount: 3,
        createdAt: new Date(),
        character: { name: "Test Character" },
      },
    ]);
    mockDb.call.findMany.mockResolvedValue([
      {
        id: "call-1",
        phoneNumber: "+33612345678",
        status: "COMPLETED",
        durationSeconds: 120,
        costCredits: 2,
        createdAt: new Date(),
        endedAt: new Date(),
      },
    ]);
    mockDb.comment.findMany.mockResolvedValue([]);
    mockDb.purchase.findMany.mockResolvedValue([]);
    mockDb.clip.findMany.mockResolvedValue([]);
    mockDb.abuseReport.findMany.mockResolvedValue([]);
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { POST } = await import("../export/route");

    const response = await POST(createMockRequest());
    expect(response.status).toBe(200);

    // Should return JSON content type with downloadable filename
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("application/json");

    const contentDisposition = response.headers.get("content-disposition");
    expect(contentDisposition).toContain("attachment; filename=");
    expect(contentDisposition).toContain(".json");

    // Verify phone numbers are masked
    const body = await response.json();
    expect(body).toHaveProperty("exportedAt");
    expect(body).toHaveProperty("user");
    expect(body).toHaveProperty("scenarios");
    expect(body).toHaveProperty("calls");
    expect(body).toHaveProperty("comments");
    expect(body).toHaveProperty("purchases");
    expect(body).toHaveProperty("clips");
    expect(body).toHaveProperty("abuseReports");
    expect(body.user.id).toBe("user-123");
    // Phone number should be masked
    expect(body.calls[0].phoneNumber).toBe("xxxx5678");
  });

  it("should return 403 when origin header does not match app URL (CSRF)", async () => {
    const { POST } = await import("../export/route");

    // Request with a non-matching origin should be rejected
    const req = {
      headers: {
        get: (name: string) => {
          if (name === "origin") return "https://evil-site.com";
          return null;
        },
      },
    } as unknown as NextRequest;

    const response = await POST(req);
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("Origine non autorisée");
  });

  it("should return 401 when user is not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import("../export/route");

    const response = await POST(createMockRequest());
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Non authentifié");
  });

  it("should create audit log on successful export", async () => {
    mockDb.user.updateMany.mockResolvedValue({ count: 1 });
    mockDb.user.findUnique.mockResolvedValue(mockUserData);
    mockDb.scenario.findMany.mockResolvedValue([]);
    mockDb.call.findMany.mockResolvedValue([]);
    mockDb.comment.findMany.mockResolvedValue([]);
    mockDb.purchase.findMany.mockResolvedValue([]);
    mockDb.clip.findMany.mockResolvedValue([]);
    mockDb.abuseReport.findMany.mockResolvedValue([]);
    mockDb.auditLog.create.mockResolvedValue({ id: "log-1" });

    const { POST } = await import("../export/route");

    await POST(createMockRequest());

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "GDPR_EXPORT",
        entityType: "User",
        entityId: "user-123",
        adminId: "user-123",
      },
    });
  });
});
