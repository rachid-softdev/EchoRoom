import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// cleanupOldAuditLogs tests
// ---------------------------------------------------------------------------
// The function:
//   1. Computes cutoff date from maxAgeDays
//   2. Deletes audit logs older than cutoff via db.auditLog.deleteMany
//   3. Returns the count of deleted records
//   4. Default maxAgeDays = 365

const mockDeleteMany = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    auditLog: {
      deleteMany: mockDeleteMany,
    },
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("cleanupOldAuditLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete audit logs older than maxAgeDays", async () => {
    mockDeleteMany.mockResolvedValue({ count: 42 });

    const { cleanupOldAuditLogs } = await import("../cleanupAuditLogs");
    const result = await cleanupOldAuditLogs(90);

    expect(result).toBe(42);

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    const callArgs = mockDeleteMany.mock.calls[0][0];
    expect(callArgs.where.createdAt.lte).toBeInstanceOf(Date);
    // Verify cutoff is approximately 90 days ago (accounting for DST)
    const cutoffMs = callArgs.where.createdAt.lte.getTime();
    const nowMs = Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const expectedCutoff = nowMs - ninetyDaysMs;
    // Allow ±1 hour for DST transitions
    expect(Math.abs(cutoffMs - expectedCutoff)).toBeLessThan(3600000);
  });

  it("should return 0 when no old audit logs exist", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const { cleanupOldAuditLogs } = await import("../cleanupAuditLogs");
    const result = await cleanupOldAuditLogs(365);

    expect(result).toBe(0);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("should use default maxAgeDays of 365 when not provided", async () => {
    mockDeleteMany.mockResolvedValue({ count: 5 });

    const { cleanupOldAuditLogs } = await import("../cleanupAuditLogs");
    const result = await cleanupOldAuditLogs();

    expect(result).toBe(5);

    const callArgs = mockDeleteMany.mock.calls[0][0];
    const cutoffMs = callArgs.where.createdAt.lte.getTime();
    const nowMs = Date.now();
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    const expectedCutoff = nowMs - yearMs;
    // Allow ±1 hour for DST transitions
    expect(Math.abs(cutoffMs - expectedCutoff)).toBeLessThan(3600000);
  });

  it("should propagate database errors", async () => {
    const dbError = new Error("Database connection failed");
    mockDeleteMany.mockRejectedValue(dbError);

    const { cleanupOldAuditLogs } = await import("../cleanupAuditLogs");

    await expect(cleanupOldAuditLogs(30)).rejects.toThrow("Database connection failed");
  });

  it("should compute cutoff date correctly for different maxAgeDays", async () => {
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const { cleanupOldAuditLogs } = await import("../cleanupAuditLogs");
    await cleanupOldAuditLogs(7);

    const callArgs = mockDeleteMany.mock.calls[0][0];
    const cutoffMs = callArgs.where.createdAt.lte.getTime();
    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const expectedCutoff = nowMs - sevenDaysMs;
    expect(Math.abs(cutoffMs - expectedCutoff)).toBeLessThan(3600000);
  });
});
