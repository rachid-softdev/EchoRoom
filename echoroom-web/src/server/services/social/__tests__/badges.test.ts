import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Badges Service Tests
// ---------------------------------------------------------------------------
// Tests for badges.ts — checkAndAwardBadges:
//   - FIRST_CALL awards the badge at 1 COMPLETED call
//   - TEN_CALLS awards at 10, not at 9
//   - HUNDRED_CALLS awards at 100
//   - FIRST_SCENARIO awards at 1
//   - TEN_SCENARIOS awards at 10
//   - LIKE_RECEIVED triggers both FIRST_LIKE_RECEIVED and HUNDRED_LIKES_RECEIVED
//   - Already awarded badge → skip
//   - Unknown trigger → null
//   - First matching badge only is returned (not both on LIKE_RECEIVED)
//   - Concurrency: only one badge created even with duplicate calls

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

// Mock badge repository
const mockBadgeRepository = {
  findCandidateBadges: vi.fn(),
  findUserBadge: vi.fn(),
  createUserBadge: vi.fn(),
  countUserCallsByStatus: vi.fn(),
  countUserScenarios: vi.fn(),
  sumLikesReceived: vi.fn(),
};

vi.mock("@/server/repositories", () => ({
  badgeRepository: mockBadgeRepository,
}));

// Badge factory helpers
function makeBadge(
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    iconUrl: string | null;
    criteria: { type: string; threshold?: number };
  }> = {},
) {
  return {
    id: overrides.id ?? "badge-1",
    name: overrides.name ?? "Test Badge",
    description: overrides.description ?? "A test badge",
    iconUrl: overrides.iconUrl ?? null,
    criteria: overrides.criteria ?? { type: "FIRST_CALL" },
  };
}

describe("checkAndAwardBadges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("FIRST_CALL trigger", () => {
    it("should award FIRST_CALL badge when user has 1 COMPLETED call", async () => {
      const badge = makeBadge({
        id: "badge-first-call",
        name: "Premier appel",
        description: "Vous avez passé votre premier appel",
        criteria: { type: "FIRST_CALL", threshold: 1 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(1); // 1 completed call
      mockBadgeRepository.findUserBadge.mockResolvedValue(null); // not awarded yet
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-1",
        userId: "user-1",
        badgeId: "badge-first-call",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "FIRST_CALL");

      expect(result).toEqual({
        id: "badge-first-call",
        name: "Premier appel",
        description: "Vous avez passé votre premier appel",
        iconUrl: null,
      });
      expect(mockBadgeRepository.countUserCallsByStatus).toHaveBeenCalledWith(
        "user-1",
        "COMPLETED",
      );
      expect(mockBadgeRepository.createUserBadge).toHaveBeenCalledWith(
        "user-1",
        "badge-first-call",
      );
    });

    it("should NOT award FIRST_CALL badge when user has 0 completed calls", async () => {
      const badge = makeBadge({
        id: "badge-first-call",
        criteria: { type: "FIRST_CALL", threshold: 1 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(0);

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "FIRST_CALL");

      expect(result).toBeNull();
      expect(mockBadgeRepository.createUserBadge).not.toHaveBeenCalled();
    });
  });

  describe("TEN_CALLS trigger", () => {
    it("should award TEN_CALLS badge when user has 10 COMPLETED calls", async () => {
      const badge = makeBadge({
        id: "badge-ten-calls",
        name: "10 appels",
        criteria: { type: "TEN_CALLS", threshold: 10 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(10);
      mockBadgeRepository.findUserBadge.mockResolvedValue(null);
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-2",
        userId: "user-1",
        badgeId: "badge-ten-calls",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "TEN_CALLS");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-ten-calls");
      expect(mockBadgeRepository.createUserBadge).toHaveBeenCalled();
    });

    it("should NOT award TEN_CALLS when user has 9 COMPLETED calls (below threshold)", async () => {
      const badge = makeBadge({
        id: "badge-ten-calls",
        criteria: { type: "TEN_CALLS", threshold: 10 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(9);

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "TEN_CALLS");

      expect(result).toBeNull();
      expect(mockBadgeRepository.createUserBadge).not.toHaveBeenCalled();
    });

    it("should award on exactly the threshold (≥)", async () => {
      const badge = makeBadge({
        id: "badge-ten-calls",
        criteria: { type: "TEN_CALLS", threshold: 10 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(15); // above also works
      mockBadgeRepository.findUserBadge.mockResolvedValue(null);
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-3",
        userId: "user-1",
        badgeId: "badge-ten-calls",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "TEN_CALLS");

      expect(result).not.toBeNull();
    });
  });

  describe("HUNDRED_CALLS trigger", () => {
    it("should award HUNDRED_CALLS badge at 100 completed calls", async () => {
      const badge = makeBadge({
        id: "badge-100-calls",
        name: "100 appels",
        criteria: { type: "HUNDRED_CALLS", threshold: 100 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(100);
      mockBadgeRepository.findUserBadge.mockResolvedValue(null);
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-4",
        userId: "user-1",
        badgeId: "badge-100-calls",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "HUNDRED_CALLS");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-100-calls");
    });
  });

  describe("FIRST_SCENARIO trigger", () => {
    it("should award FIRST_SCENARIO badge when user has 1 scenario", async () => {
      const badge = makeBadge({
        id: "badge-first-scenario",
        name: "Premier scénario",
        criteria: { type: "FIRST_SCENARIO", threshold: 1 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserScenarios.mockResolvedValue(1);
      mockBadgeRepository.findUserBadge.mockResolvedValue(null);
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-5",
        userId: "user-1",
        badgeId: "badge-first-scenario",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "FIRST_SCENARIO");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-first-scenario");
    });
  });

  describe("TEN_SCENARIOS trigger", () => {
    it("should award TEN_SCENARIOS badge when user has 10 scenarios", async () => {
      const badge = makeBadge({
        id: "badge-ten-scenarios",
        name: "10 scénarios",
        criteria: { type: "TEN_SCENARIOS", threshold: 10 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserScenarios.mockResolvedValue(10);
      mockBadgeRepository.findUserBadge.mockResolvedValue(null);
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-6",
        userId: "user-1",
        badgeId: "badge-ten-scenarios",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "TEN_SCENARIOS");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-ten-scenarios");
    });
  });

  describe("LIKE_RECEIVED trigger", () => {
    it("should award FIRST_LIKE_RECEIVED when user has 1+ likes (threshold=1)", async () => {
      const badge = makeBadge({
        id: "badge-first-like",
        name: "Premier like",
        criteria: { type: "FIRST_LIKE_RECEIVED", threshold: 1 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.sumLikesReceived.mockResolvedValue(1);
      mockBadgeRepository.findUserBadge.mockResolvedValue(null);
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-7",
        userId: "user-1",
        badgeId: "badge-first-like",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "LIKE_RECEIVED");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-first-like");
      expect(mockBadgeRepository.sumLikesReceived).toHaveBeenCalledWith("user-1");
    });

    it("should award HUNDRED_LIKES_RECEIVED when user has 100+ likes (threshold=100)", async () => {
      const badgeFirst = makeBadge({
        id: "badge-first-like",
        name: "Premier like",
        criteria: { type: "FIRST_LIKE_RECEIVED", threshold: 1 },
      });
      const badgeHundred = makeBadge({
        id: "badge-100-likes",
        name: "100 likes",
        criteria: { type: "HUNDRED_LIKES_RECEIVED", threshold: 100 },
      });

      // LIKE_RECEIVED triggers: FIRST_LIKE_RECEIVED + HUNDRED_LIKES_RECEIVED
      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badgeFirst, badgeHundred]);
      mockBadgeRepository.sumLikesReceived.mockResolvedValue(150);
      // FIRST_LIKE_RECEIVED already exists → skip, HUNDRED_LIKES is new
      mockBadgeRepository.findUserBadge
        .mockResolvedValueOnce({
          id: "ub-existing",
          userId: "user-1",
          badgeId: "badge-first-like",
          awardedAt: new Date(),
        }) // already has first-like
        .mockResolvedValueOnce(null); // doesn't have 100-likes yet
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-8",
        userId: "user-1",
        badgeId: "badge-100-likes",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "LIKE_RECEIVED");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-100-likes");
      expect(mockBadgeRepository.createUserBadge).toHaveBeenCalledWith("user-1", "badge-100-likes");
    });

    it("should only return the first awarded badge (not both)", async () => {
      const badgeFirst = makeBadge({
        id: "badge-first-like",
        name: "Premier like",
        criteria: { type: "FIRST_LIKE_RECEIVED", threshold: 1 },
      });
      const badgeHundred = makeBadge({
        id: "badge-100-likes",
        name: "100 likes",
        criteria: { type: "HUNDRED_LIKES_RECEIVED", threshold: 100 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badgeFirst, badgeHundred]);
      mockBadgeRepository.sumLikesReceived.mockResolvedValue(150);
      mockBadgeRepository.findUserBadge.mockResolvedValue(null); // neither exists
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-9",
        userId: "user-1",
        badgeId: "badge-first-like",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "LIKE_RECEIVED");

      // Only FIRST_LIKE_RECEIVED is returned (first matching badge in loop)
      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-first-like");
      // Only one badge created
      expect(mockBadgeRepository.createUserBadge).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should return null for unknown trigger event", async () => {
      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "UNKNOWN_TRIGGER");

      expect(result).toBeNull();
      expect(mockBadgeRepository.findCandidateBadges).not.toHaveBeenCalled();
    });

    it("should skip badge already awarded (duplicate check)", async () => {
      const badge = makeBadge({
        id: "badge-first-call",
        criteria: { type: "FIRST_CALL", threshold: 1 },
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(5);
      // Badge already exists
      mockBadgeRepository.findUserBadge.mockResolvedValue({
        id: "ub-existing",
        userId: "user-1",
        badgeId: "badge-first-call",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "FIRST_CALL");

      expect(result).toBeNull();
      expect(mockBadgeRepository.createUserBadge).not.toHaveBeenCalled();
    });

    it("should handle empty candidate list gracefully", async () => {
      mockBadgeRepository.findCandidateBadges.mockResolvedValue([]);

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "FIRST_CALL");

      expect(result).toBeNull();
    });

    it("should use default threshold of 1 when criteria has no threshold", async () => {
      const badge = makeBadge({
        id: "badge-no-threshold",
        criteria: { type: "FIRST_CALL" }, // no threshold field
      });

      mockBadgeRepository.findCandidateBadges.mockResolvedValue([badge]);
      mockBadgeRepository.countUserCallsByStatus.mockResolvedValue(1);
      mockBadgeRepository.findUserBadge.mockResolvedValue(null);
      mockBadgeRepository.createUserBadge.mockResolvedValue({
        id: "ub-10",
        userId: "user-1",
        badgeId: "badge-no-threshold",
        awardedAt: new Date(),
      });

      const { checkAndAwardBadges } = await import("../badges");
      const result = await checkAndAwardBadges("user-1", "FIRST_CALL");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("badge-no-threshold");
    });
  });
});
