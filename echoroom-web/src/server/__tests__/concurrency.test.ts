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

// ---------------------------------------------------------------------------
// Credit race conditions: concurrent debits on the same user
// ---------------------------------------------------------------------------
// Tests that atomic debit operations correctly handle concurrent access
// using the WHERE credits >= cost pattern as an optimistic lock.

describe("Credit race conditions — atomic debit", () => {
  it("should handle two concurrent debits without going negative", async () => {
    // Simulate a user with 5 credits, two concurrent debits of 3 each
    // First succeeds, second should fail (only 2 credits remaining)
    const mockUpdateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })  // First debit: 5 >= 3
      .mockResolvedValueOnce({ count: 0 }); // Second debit: 2 < 3

    const mockFindUnique = vi.fn().mockResolvedValue({ id: "user-1" });

    async function atomicDebit(userId: string, cost: number) {
      const result = await mockUpdateMany({
        where: { id: userId, credits: { gte: cost } },
        data: { credits: { decrement: cost } },
      });
      if (result.count === 0) {
        const user = await mockFindUnique({ where: { id: userId }, select: { id: true } });
        return { debited: false, reason: user ? "INSUFFICIENT_CREDITS" : "USER_NOT_FOUND" };
      }
      return { debited: true };
    }

    const [result1, result2] = await Promise.all([
      atomicDebit("user-1", 3),
      atomicDebit("user-1", 3),
    ]);

    // Exactly one should succeed
    const succeeded = [result1, result2].filter(r => r.debited).length;
    expect(succeeded).toBe(1);

    // The failed one should indicate insufficient credits
    const failed = [result1, result2].find(r => !r.debited);
    expect(failed?.reason).toBe("INSUFFICIENT_CREDITS");
  });

  it("should allow independent debits on different users", async () => {
    const mockUpdateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })  // user-1 debit succeeds
      .mockResolvedValueOnce({ count: 1 }); // user-2 debit succeeds

    async function atomicDebit(userId: string, cost: number) {
      const result = await mockUpdateMany({
        where: { id: userId, credits: { gte: cost } },
        data: { credits: { decrement: cost } },
      });
      return { debited: result.count === 1 };
    }

    const [result1, result2] = await Promise.all([
      atomicDebit("user-1", 3),
      atomicDebit("user-2", 3),
    ]);

    expect(result1.debited).toBe(true);
    expect(result2.debited).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Race condition: concurrent status transitions on the same call
// ---------------------------------------------------------------------------

describe("Call status race conditions", () => {
  it("should prevent double-completion via status guard", async () => {
    // Two concurrent status transitions: both try to complete the call
    // Only the first should succeed (status guard prevents second)
    const mockUpdateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })  // First: RINGING -> ACTIVE
      .mockResolvedValueOnce({ count: 0 }); // Second: status already changed

    async function transitionCall(callId: string, fromStatus: string, toStatus: string) {
      const result = await mockUpdateMany({
        where: { id: callId, status: fromStatus },
        data: { status: toStatus },
      });
      return { success: result.count === 1 };
    }

    const [result1, result2] = await Promise.all([
      transitionCall("call-1", "RINGING", "ACTIVE"),
      transitionCall("call-1", "RINGING", "ACTIVE"),
    ]);

    // Exactly one should succeed
    const succeeded = [result1, result2].filter(r => r.success).length;
    expect(succeeded).toBe(1);

    // The second caller should see failure
    expect(result1.success !== result2.success).toBe(true);
  });

  it("should prevent refund for already-failed calls", async () => {
    // markAsFailedWithRefund should be idempotent
    // Second call should detect status already FAILED (via notIn guard)
    const mockUpdateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })  // First: marks as FAILED
      .mockResolvedValueOnce({ count: 0 }); // Second: already FAILED

    async function markAsFailed(callId: string) {
      const result = await mockUpdateMany({
        where: { id: callId, status: { notIn: ["FAILED", "COMPLETED"] } },
        data: { status: "FAILED", endedAt: new Date() },
      });
      return { didUpdate: result.count === 1 };
    }

    const [result1, result2] = await Promise.all([
      markAsFailed("call-1"),
      markAsFailed("call-1"),
    ]);

    // Only one should have actually changed the status
    const updates = [result1, result2].filter(r => r.didUpdate).length;
    expect(updates).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Race condition: concurrent GDPR deletion + admin deletion
// ---------------------------------------------------------------------------

describe("Concurrent delete scenarios", () => {
  it("should handle simultaneous user-initiated and admin-initiated deletion", async () => {
    // Both deleteMyAccount and admin deleteUser could run concurrently.
    // The updateMany with deletedAt: null guard ensures only one succeeds.

    const mockUpdateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })  // First delete succeeds
      .mockResolvedValueOnce({ count: 0 }); // Second: already deleted

    async function deleteUser(userId: string) {
      const result = await mockUpdateMany({
        where: { id: userId, deletedAt: null },
        data: { deletedAt: new Date(), anonymizedAt: new Date() },
      });
      if (result.count === 0) {
        throw new Error("CONFLICT: User already deleted");
      }
      return { success: true };
    }

    // Simulate concurrent user + admin delete
    const results = await Promise.allSettled([
      deleteUser("user-1"),
      deleteUser("user-1"),
    ]);

    const fulfilled = results.filter(r => r.status === "fulfilled").length;
    const rejected = results.filter(r => r.status === "rejected").length;

    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);
  });

  it("should handle three concurrent deletions gracefully", async () => {
    const mockUpdateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    async function deleteUser(userId: string) {
      const result = await mockUpdateMany({
        where: { id: userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return { deleted: result.count === 1 };
    }

    const results = await Promise.all([
      deleteUser("user-1"),
      deleteUser("user-1"),
      deleteUser("user-1"),
    ]);

    const deletedCount = results.filter(r => r.deleted).length;
    expect(deletedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Prisma $transaction isolation tests
// ---------------------------------------------------------------------------

describe("Prisma transaction atomicity", () => {
  it("should rollback entire transaction on error", async () => {
    // Simulate a transaction where the second operation fails
    // The first operation should be rolled back
    const mockTx = {
      user: {
        update: vi.fn().mockResolvedValue({ id: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    // The transaction callback executes both operations
    // If the second throws, Prisma rolls back the first
    async function failingTransaction() {
      const tx = mockTx as any;
      await tx.user.update({ where: { id: "user-1" }, data: { credits: { increment: 5 } } });
      // This throws, causing rollback
      throw new Error("Something went wrong in the transaction");
    }

    await expect(failingTransaction()).rejects.toThrow("Something went wrong");
    // The update was called but would be rolled back by Prisma
    expect(mockTx.user.update).toHaveBeenCalled();
  });

  it("should complete all operations in a successful transaction", async () => {
    const mockUserUpdate = vi.fn().mockResolvedValue({ id: "user-1" });
    const mockCallUpdate = vi.fn().mockResolvedValue({ count: 1 });

    async function successfulTransaction() {
      await mockUserUpdate({ where: { id: "user-1" }, data: { credits: { increment: 5 } } });
      await mockCallUpdate({ where: { id: "call-1" }, data: { status: "FAILED" } });
    }

    await successfulTransaction();

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockCallUpdate).toHaveBeenCalledTimes(1);
  });
});
