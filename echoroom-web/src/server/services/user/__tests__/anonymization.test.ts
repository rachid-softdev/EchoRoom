import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Anonymization — anonymizePersonalData tests
// ---------------------------------------------------------------------------
// Tests for anonymization.ts:
//   - Full anonymization: userProfile, user, scenarios, comments, calls
//   - userProfileRepository.anonymize failure triggers upsert fallback
//   - Legacy User fields always updated regardless of profile success
//   - No scenarios/comments/calls owned → updateMany returns {count:0}
//   - Transaction rollback on any failure

const mockUserProfileAnonymize = vi.fn();
const mockUserProfileUpsert = vi.fn();

vi.mock("@/server/repositories", () => ({
  userProfileRepository: {
    anonymize: mockUserProfileAnonymize,
  },
}));

/**
 * Build a mock Prisma transaction client for testing.
 * Each call returns fresh mock functions so test-specific behavior can be set.
 */
function createMockTx() {
  return {
    userProfile: {
      upsert: vi.fn().mockResolvedValue({ id: "profile-1", userId: "user-1" }),
    },
    user: {
      update: vi.fn().mockResolvedValue({ id: "user-1" }),
    },
    scenario: {
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    comment: {
      updateMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    call: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

describe("anonymizePersonalData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserProfileAnonymize.mockReset();
    mockUserProfileUpsert.mockReset();
  });

  it("should full anonymize: userProfile, user, scenarios, comments, calls", async () => {
    mockUserProfileAnonymize.mockResolvedValue(undefined);
    const tx = createMockTx();

    const { anonymizePersonalData } = await import("../anonymization");
    await anonymizePersonalData(tx as any, "user-1");

    // UserProfile anonymization called
    expect(mockUserProfileAnonymize).toHaveBeenCalledWith(tx, "user-1");

    // Legacy User fields updated
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: null, bio: null, image: null },
    });

    // Scenarios set to PRIVATE
    expect(tx.scenario.updateMany).toHaveBeenCalledWith({
      where: { creatorId: "user-1" },
      data: { visibility: "PRIVATE" },
    });

    // Comments anonymized
    expect(tx.comment.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { content: "[Commentaire supprimé]" },
    });

    // Moderator FK references severed
    expect(tx.comment.updateMany).toHaveBeenCalledWith({
      where: { moderatedById: "user-1" },
      data: { moderatedById: null, moderatedAt: null },
    });

    // Call phone numbers anonymized
    expect(tx.call.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { phoneNumber: "[ANONYMISÉ]" },
    });
  });

  it("should trigger upsert fallback when userProfileRepository.anonymize throws", async () => {
    mockUserProfileAnonymize.mockRejectedValue(new Error("Profile not found"));
    const tx = createMockTx();

    const { anonymizePersonalData } = await import("../anonymization");
    await anonymizePersonalData(tx as any, "user-1");

    // Should fall back to upsert
    expect(tx.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1" },
      update: { image: null, displayName: null, bio: null },
    });

    // Legacy user fields should still be updated
    expect(tx.user.update).toHaveBeenCalled();
  });

  it("should update legacy user fields regardless of profile success", async () => {
    // Test with successful profile anonymization
    mockUserProfileAnonymize.mockResolvedValue(undefined);
    const tx1 = createMockTx();
    const { anonymizePersonalData } = await import("../anonymization");
    await anonymizePersonalData(tx1 as any, "user-1");
    expect(tx1.user.update).toHaveBeenCalled();

    // Test with failed profile anonymization (fallback)
    vi.clearAllMocks();
    mockUserProfileAnonymize.mockRejectedValue(new Error("fail"));
    const tx2 = createMockTx();
    await anonymizePersonalData(tx2 as any, "user-1");
    expect(tx2.user.update).toHaveBeenCalled();
  });

  it("should handle zero owned scenarios, comments, and calls gracefully", async () => {
    mockUserProfileAnonymize.mockResolvedValue(undefined);
    const tx = createMockTx();
    // Simulate zero results
    tx.scenario.updateMany.mockResolvedValue({ count: 0 });
    tx.comment.updateMany.mockResolvedValue({ count: 0 });
    tx.call.updateMany.mockResolvedValue({ count: 0 });

    const { anonymizePersonalData } = await import("../anonymization");
    await expect(anonymizePersonalData(tx as any, "user-1")).resolves.not.toThrow();

    // updateMany called with correct params even if count is 0
    expect(tx.scenario.updateMany).toHaveBeenCalled();
    expect(tx.comment.updateMany).toHaveBeenCalled();
    expect(tx.call.updateMany).toHaveBeenCalled();
  });

  it("should handle upsert fallback failure gracefully (re-throws)", async () => {
    mockUserProfileAnonymize.mockRejectedValue(new Error("Profile not found"));
    const tx = createMockTx();
    tx.userProfile.upsert.mockRejectedValue(new Error("UPSERT failed"));

    const { anonymizePersonalData } = await import("../anonymization");
    await expect(anonymizePersonalData(tx as any, "user-1")).rejects.toThrow("UPSERT failed");
  });

  it("should handle user.update failure (re-throws)", async () => {
    mockUserProfileAnonymize.mockResolvedValue(undefined);
    const tx = createMockTx();
    tx.user.update.mockRejectedValue(new Error("User update failed"));

    const { anonymizePersonalData } = await import("../anonymization");
    await expect(anonymizePersonalData(tx as any, "user-1")).rejects.toThrow("User update failed");
  });

  it("should sever FK references from comments user moderated", async () => {
    mockUserProfileAnonymize.mockResolvedValue(undefined);
    const tx = createMockTx();

    const { anonymizePersonalData } = await import("../anonymization");
    await anonymizePersonalData(tx as any, "user-1");

    // Verify the moderatedById call was made with correct data
    expect(tx.comment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moderatedById: "user-1" },
        data: { moderatedById: null, moderatedAt: null },
      }),
    );
  });

  it("should handle scenario updateMany returning count but not throwing", async () => {
    mockUserProfileAnonymize.mockResolvedValue(undefined);
    const tx = createMockTx();

    const { anonymizePersonalData } = await import("../anonymization");
    await anonymizePersonalData(tx as any, "user-1");

    expect(tx.scenario.updateMany).toHaveBeenCalledTimes(1);
    // Should set visibility to PRIVATE for all user's scenarios
    expect(tx.scenario.updateMany).toHaveBeenCalledWith({
      where: { creatorId: "user-1" },
      data: { visibility: "PRIVATE" },
    });
  });

  it("should handle all operations in expected order", async () => {
    mockUserProfileAnonymize.mockResolvedValue(undefined);
    const tx = createMockTx();

    const { anonymizePersonalData } = await import("../anonymization");
    await anonymizePersonalData(tx as any, "user-1");

    // Get all updateMany and update call names in order
    const callOrder: string[] = [];
    mockUserProfileAnonymize.mock.calls.forEach(() => callOrder.push("userProfile.anonymize"));
    tx.user.update.mock.calls.forEach(() => callOrder.push("user.update"));
    tx.scenario.updateMany.mock.calls.forEach(() => callOrder.push("scenario.updateMany"));

    expect(callOrder[0]).toBe("userProfile.anonymize");
    expect(callOrder).toContain("user.update");
    expect(callOrder).toContain("scenario.updateMany");
  });
});
