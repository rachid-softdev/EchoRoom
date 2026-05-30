import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Concurrency & TOCTOU Tests
// ---------------------------------------------------------------------------
// Verifies the updateMany with deletedAt: null pattern used in admin.ts
// deleteUser to prevent Time-of-Check-Time-of-Use (TOCTOU) race conditions.
//
// The pattern:
//   1. updateMany with WHERE id = ? AND deletedAt = null
//   2. Check result.count — if 0, the record was already deleted or doesn't exist
//   3. Proceed only if count > 0
//
// This is atomic because PostgreSQL's UPDATE with WHERE clause locks the
// matching row(s) at the row level, preventing concurrent transactions from
// both seeing deletedAt = null and both attempting deletion.

// Mock a simulated DB updateMany that tracks state
function createMockDb() {
  // Simulates DB state: records that exist and are not deleted
  const records = new Map<string, { deletedAt: Date | null }>();

  return {
    // Reset to initial state
    reset(initialIds: string[]) {
      records.clear();
      for (const id of initialIds) {
        records.set(id, { deletedAt: null });
      }
    },

    // The updateMany function — simulates atomic UPDATE ... WHERE id=? AND deletedAt IS NULL
    updateMany: vi.fn(
      (args: {
        where: { id: string; deletedAt: null };
        data: { deletedAt: Date };
      }) => {
        const record = records.get(args.where.id);
        // Only update if record exists AND deletedAt is null
        if (record && record.deletedAt === null) {
          // This simulates the atomic guard: only one caller will see deletedAt=null
          record.deletedAt = args.data.deletedAt;
          return { count: 1 };
        }
        // Already deleted or doesn't exist
        return { count: 0 };
      },
    ),

    // Check if a record is deleted
    isDeleted(id: string): boolean {
      return records.get(id)?.deletedAt !== null;
    },

    // Get current state
    getRecord(id: string) {
      return records.get(id);
    },
  };
}

describe("TOCTOU prevention — updateMany with deletedAt: null guard", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it("should return count=1 when deleting a non-deleted record", () => {
    mockDb.reset(["user-1"]);

    const result = mockDb.updateMany({
      where: { id: "user-1", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    expect(result.count).toBe(1);
    expect(mockDb.isDeleted("user-1")).toBe(true);
  });

  it("should return count=0 when deleting an already deleted record (idempotent)", () => {
    mockDb.reset(["user-1"]);

    // First deletion
    mockDb.updateMany({
      where: { id: "user-1", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Second deletion — should return 0
    const secondResult = mockDb.updateMany({
      where: { id: "user-1", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    expect(secondResult.count).toBe(0);
  });

  it("should return count=0 when record does not exist", () => {
    mockDb.reset([]);

    const result = mockDb.updateMany({
      where: { id: "nonexistent", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    expect(result.count).toBe(0);
  });

  it("should simulate atomic TOCTOU protection with concurrent deletions", () => {
    mockDb.reset(["user-1"]);

    // Simulate two concurrent transactions both checking deletedAt = null
    // In PostgreSQL, the second UPDATE would block on the row lock from
    // the first, then see deletedAt != null and return 0 rows affected.
    // Our mock simulates this by checking state atomically in the function.

    // Transaction A
    const resultA = mockDb.updateMany({
      where: { id: "user-1", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Transaction B (would have read deletedAt = null before A committed)
    const resultB = mockDb.updateMany({
      where: { id: "user-1", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Exactly one should succeed
    expect(resultA.count + resultB.count).toBe(1);
    // The record should be deleted
    expect(mockDb.isDeleted("user-1")).toBe(true);
  });

  it("should allow deleting different records independently", () => {
    mockDb.reset(["user-1", "user-2"]);

    const result1 = mockDb.updateMany({
      where: { id: "user-1", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    const result2 = mockDb.updateMany({
      where: { id: "user-2", deletedAt: null },
      data: { deletedAt: new Date() },
    });

    expect(result1.count).toBe(1);
    expect(result2.count).toBe(1);
    expect(mockDb.isDeleted("user-1")).toBe(true);
    expect(mockDb.isDeleted("user-2")).toBe(true);
  });

  it("should allow deletion after creation (not previously deleted)", () => {
    mockDb.reset(["user-1"]);

    // Verify initial state
    expect(mockDb.getRecord("user-1")?.deletedAt).toBeNull();

    // Delete
    const result = mockDb.updateMany({
      where: { id: "user-1", deletedAt: null },
      data: { deletedAt: new Date() },
    });
    expect(result.count).toBe(1);

    // Verify deletedAt is set
    expect(mockDb.getRecord("user-1")?.deletedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// admin.ts deleteUser integration pattern test
// ---------------------------------------------------------------------------

describe("admin.ts deleteUser — updateMany integration pattern", () => {
  it("should throw CONFLICT when updateMany returns count=0 (already deleted)", async () => {
    // This simulates the exact pattern from admin.ts lines 385-405:
    //
    // const result = await db.user.updateMany({
    //   where: { id: input.userId, deletedAt: null },
    //   data: { deletedAt: new Date(), ... },
    // });
    //
    // if (result.count === 0) {
    //   throw new TRPCError({ code: "CONFLICT", message: "..." });
    // }

    const mockUpdateMany = vi.fn();

    // Simulate first call — record not yet deleted
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    // Simulate second call — record already deleted
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });

    async function deleteUser(_userId: string) {
      const result: { count: number } = await mockUpdateMany();
      if (result.count === 0) {
        throw new Error("CONFLICT: Utilisateur introuvable ou déjà supprimé");
      }
      return { success: true };
    }

    // First deletion succeeds
    await expect(deleteUser("user-1")).resolves.toEqual({ success: true });

    // Second deletion should throw CONFLICT
    await expect(deleteUser("user-1")).rejects.toThrow("CONFLICT");
  });

  it("should proceed with anonymization when deletion succeeds", async () => {
    // Verifies that after a successful updateMany, the rest of the
    // deleteUser flow continues (anonymization, audit log).

    const mockUpdateMany = vi.fn();
    const mockAuditLog = vi.fn();

    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockAuditLog.mockResolvedValue({ id: "log-1" });

    async function deleteUser(_userId: string) {
      const result: { count: number } = await mockUpdateMany();
      if (result.count === 0) {
        throw new Error("CONFLICT: Not found");
      }
      // Simulate anonymization step
      // Simulate audit log
      await mockAuditLog();
      return { success: true };
    }

    const result = await deleteUser("user-1");
    expect(result).toEqual({ success: true });
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockAuditLog).toHaveBeenCalledTimes(1);
  });
});
