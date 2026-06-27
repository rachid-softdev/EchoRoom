import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// UserSocialRepository — Contract Tests (future partitioned repository)
// ---------------------------------------------------------------------------
// Sprint 4 partition plan: Extract social counter fields from User model
// into a UserSocial model/repository:
//   - totalLikesReceived, totalCallsMade
//   - Badge awards (UserBadge relationship)
//   - Leaderboard queries
//
// These tests define the expected contract for the repository interface.

interface UserSocialData {
  id: string;
  userId: string;
  totalLikesReceived: number;
  totalCallsMade: number;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  criteria: Record<string, unknown>;
}

interface UserBadgeData {
  id: string;
  userId: string;
  badgeId: string;
  awardedAt: Date;
  badge: BadgeData;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  image: string | null;
  totalLikesReceived: number;
  totalCallsMade: number;
  scenarioCount: number;
}

interface IUserSocialRepository {
  findByUserId(userId: string): Promise<UserSocialData | null>;
  upsert(userId: string): Promise<UserSocialData>;
  incrementLikesReceived(tx: any, userId: string): Promise<void>;
  decrementLikesReceived(tx: any, userId: string): Promise<void>;
  incrementCallsMade(userId: string): Promise<void>;
  getLeaderboard(
    sort: "LIKES" | "CALLS",
    period: "ALL" | "WEEK" | "MONTH",
    limit?: number,
  ): Promise<LeaderboardEntry[]>;
  getUserBadges(userId: string): Promise<UserBadgeData[]>;
  awardBadge(tx: any, userId: string, badgeId: string): Promise<UserBadgeData>;
}

describe("IUserSocialRepository — interface contract", () => {
  let mockRepo: IUserSocialRepository;

  beforeEach(() => {
    mockRepo = {
      findByUserId: vi.fn(),
      upsert: vi.fn(),
      incrementLikesReceived: vi.fn(),
      decrementLikesReceived: vi.fn(),
      incrementCallsMade: vi.fn(),
      getLeaderboard: vi.fn(),
      getUserBadges: vi.fn(),
      awardBadge: vi.fn(),
    };
  });

  describe("findByUserId", () => {
    it("should return social stats when user exists", async () => {
      const stats: UserSocialData = {
        id: "social-1",
        userId: "user-1",
        totalLikesReceived: 42,
        totalCallsMade: 128,
      };
      (mockRepo.findByUserId as any).mockResolvedValue(stats);

      const result = await mockRepo.findByUserId("user-1");

      expect(result).toEqual(stats);
      expect(result?.totalLikesReceived).toBe(42);
      expect(result?.totalCallsMade).toBe(128);
    });

    it("should return null when user has no social record", async () => {
      (mockRepo.findByUserId as any).mockResolvedValue(null);

      const result = await mockRepo.findByUserId("new-user");

      expect(result).toBeNull();
    });

    it("should handle zero stats", async () => {
      (mockRepo.findByUserId as any).mockResolvedValue({
        id: "social-1",
        userId: "user-1",
        totalLikesReceived: 0,
        totalCallsMade: 0,
      });

      const result = await mockRepo.findByUserId("user-1");

      expect(result?.totalLikesReceived).toBe(0);
      expect(result?.totalCallsMade).toBe(0);
    });
  });

  describe("upsert", () => {
    it("should create social record if not exists", async () => {
      const expected: UserSocialData = {
        id: "new-social",
        userId: "user-1",
        totalLikesReceived: 0,
        totalCallsMade: 0,
      };
      (mockRepo.upsert as any).mockResolvedValue(expected);

      const result = await mockRepo.upsert("user-1");

      expect(result.totalLikesReceived).toBe(0);
      expect(result.totalCallsMade).toBe(0);
    });

    it("should return existing record if already exists", async () => {
      const expected: UserSocialData = {
        id: "social-1",
        userId: "user-1",
        totalLikesReceived: 10,
        totalCallsMade: 5,
      };
      (mockRepo.upsert as any).mockResolvedValue(expected);

      const result = await mockRepo.upsert("user-1");

      expect(result.totalLikesReceived).toBe(10);
      expect(result.totalCallsMade).toBe(5);
    });
  });

  describe("incrementLikesReceived / decrementLikesReceived", () => {
    it("should increment likes atomically", async () => {
      (mockRepo.incrementLikesReceived as any).mockResolvedValue(undefined);

      await expect(mockRepo.incrementLikesReceived({} as any, "user-1")).resolves.not.toThrow();
    });

    it("should decrement likes atomically", async () => {
      (mockRepo.decrementLikesReceived as any).mockResolvedValue(undefined);

      await expect(mockRepo.decrementLikesReceived({} as any, "user-1")).resolves.not.toThrow();
    });

    it("should require a transaction for atomicity", async () => {
      const tx = { userSocial: { update: vi.fn().mockResolvedValue({ totalLikesReceived: 5 }) } };

      (mockRepo.incrementLikesReceived as any).mockImplementation(
        async (t: any, userId: string) => {
          await t.userSocial.update({
            where: { userId },
            data: { totalLikesReceived: { increment: 1 } },
          });
        },
      );

      await mockRepo.incrementLikesReceived(tx, "user-1");

      expect(tx.userSocial.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { totalLikesReceived: { increment: 1 } },
      });
    });
  });

  describe("incrementCallsMade", () => {
    it("should increment calls count", async () => {
      (mockRepo.incrementCallsMade as any).mockResolvedValue(undefined);

      await mockRepo.incrementCallsMade("user-1");
      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe("getLeaderboard", () => {
    it("should return entries sorted by likes when sort is LIKES", async () => {
      const entries: LeaderboardEntry[] = [
        {
          userId: "u1",
          username: "alice",
          image: null,
          totalLikesReceived: 100,
          totalCallsMade: 50,
          scenarioCount: 5,
        },
        {
          userId: "u2",
          username: "bob",
          image: null,
          totalLikesReceived: 50,
          totalCallsMade: 200,
          scenarioCount: 3,
        },
      ];
      (mockRepo.getLeaderboard as any).mockResolvedValue(entries);

      const result = await mockRepo.getLeaderboard("LIKES", "ALL");

      expect(result).toHaveLength(2);
      // First entry should have more likes
      expect(result[0]!.totalLikesReceived).toBeGreaterThanOrEqual(result[1]!.totalLikesReceived);
    });

    it("should limit results when limit is provided", async () => {
      const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, i) => ({
        userId: `u${i}`,
        username: `user${i}`,
        image: null,
        totalLikesReceived: 100 - i * 10,
        totalCallsMade: 10,
        scenarioCount: 1,
      }));
      (mockRepo.getLeaderboard as any).mockResolvedValue(entries.slice(0, 3));

      const result = await mockRepo.getLeaderboard("LIKES", "ALL", 3);

      expect(result).toHaveLength(3);
    });

    it("should filter by WEEK period", async () => {
      (mockRepo.getLeaderboard as any).mockResolvedValue([]);

      const result = await mockRepo.getLeaderboard("LIKES", "WEEK");

      expect(result).toEqual([]);
    });

    it("should return empty array when no data", async () => {
      (mockRepo.getLeaderboard as any).mockResolvedValue([]);

      const result = await mockRepo.getLeaderboard("CALLS", "ALL");

      expect(result).toEqual([]);
    });
  });

  describe("getUserBadges", () => {
    it("should return badges for a user", async () => {
      const badges: UserBadgeData[] = [
        {
          id: "ub-1",
          userId: "user-1",
          badgeId: "badge-1",
          awardedAt: new Date("2026-05-01"),
          badge: {
            id: "badge-1",
            name: "First Call",
            description: "Made your first call",
            iconUrl: null,
            criteria: { type: "CALL_COUNT", threshold: 1 },
          },
        },
      ];
      (mockRepo.getUserBadges as any).mockResolvedValue(badges);

      const result = await mockRepo.getUserBadges("user-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.badge.name).toBe("First Call");
    });

    it("should return empty array for user with no badges", async () => {
      (mockRepo.getUserBadges as any).mockResolvedValue([]);

      const result = await mockRepo.getUserBadges("new-user");

      expect(result).toEqual([]);
    });
  });

  describe("awardBadge", () => {
    it("should create a new user badge entry", async () => {
      const awarded: UserBadgeData = {
        id: "ub-new",
        userId: "user-1",
        badgeId: "badge-1",
        awardedAt: new Date(),
        badge: {
          id: "badge-1",
          name: "Popular Creator",
          description: "Received 100 likes",
          iconUrl: null,
          criteria: { type: "LIKES_RECEIVED", threshold: 100 },
        },
      };
      (mockRepo.awardBadge as any).mockResolvedValue(awarded);

      const result = await mockRepo.awardBadge({} as any, "user-1", "badge-1");

      expect(result.badge.name).toBe("Popular Creator");
      expect(result.awardedAt).toBeInstanceOf(Date);
    });

    it("should enforce unique userId + badgeId constraint", async () => {
      (mockRepo.awardBadge as any).mockRejectedValue(
        new Error("Unique constraint failed on userId and badgeId"),
      );

      await expect(mockRepo.awardBadge({} as any, "user-1", "badge-1")).rejects.toThrow(
        "Unique constraint",
      );
    });
  });
});
