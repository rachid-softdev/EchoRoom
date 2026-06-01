import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// UserBillingRepository — Contract Tests (future partitioned repository)
// ---------------------------------------------------------------------------
// Sprint 4 partition plan: Extract billing fields from User model into
// a UserBilling model/repository:
//   - credits field
//   - Purchase history
//   - Daily call limits
//   - Atomic debit/refund operations

interface UserBillingData {
  id: string;
  userId: string;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PurchaseData {
  id: string;
  userId: string;
  stripePaymentId: string;
  creditsPurchased: number;
  refundedAt: Date | null;
  disputedAt: Date | null;
  createdAt: Date;
}

interface DailyLimitData {
  id: string;
  userId: string;
  date: Date;
  callCount: number;
}

interface AtomicDebitResult {
  debited: boolean;
  reason?: "INSUFFICIENT_CREDITS" | "USER_NOT_FOUND";
}

interface IUserBillingRepository {
  findByUserId(userId: string): Promise<UserBillingData | null>;
  getCredits(userId: string): Promise<number>;
  atomicDebit(tx: any, userId: string, cost: number): Promise<AtomicDebitResult>;
  atomicRefund(tx: any, userId: string, amount: number): Promise<void>;
  addCredits(userId: string, amount: number, stripePaymentId: string): Promise<PurchaseData>;
  getPurchaseHistory(userId: string): Promise<PurchaseData[]>;
  getDailyCallLimit(userId: string, date: Date): Promise<DailyLimitData | null>;
  incrementDailyCallCount(tx: any, userId: string, date: Date): Promise<number>;
  hasReachedDailyLimit(userId: string, date: Date, maxCalls: number): Promise<boolean>;
}

describe("IUserBillingRepository — interface contract", () => {
  let mockRepo: IUserBillingRepository;

  beforeEach(() => {
    mockRepo = {
      findByUserId: vi.fn(),
      getCredits: vi.fn(),
      atomicDebit: vi.fn(),
      atomicRefund: vi.fn(),
      addCredits: vi.fn(),
      getPurchaseHistory: vi.fn(),
      getDailyCallLimit: vi.fn(),
      incrementDailyCallCount: vi.fn(),
      hasReachedDailyLimit: vi.fn(),
    };
  });

  describe("findByUserId", () => {
    it("should return billing record when found", async () => {
      const billing: UserBillingData = {
        id: "billing-1",
        userId: "user-1",
        credits: 50,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-06-01"),
      };
      (mockRepo.findByUserId as any).mockResolvedValue(billing);

      const result = await mockRepo.findByUserId("user-1");

      expect(result).toEqual(billing);
      expect(result?.credits).toBe(50);
    });

    it("should return null when billing record not found", async () => {
      (mockRepo.findByUserId as any).mockResolvedValue(null);

      const result = await mockRepo.findByUserId("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getCredits", () => {
    it("should return current credit balance", async () => {
      (mockRepo.getCredits as any).mockResolvedValue(25);

      const result = await mockRepo.getCredits("user-1");

      expect(result).toBe(25);
    });

    it("should return 0 for new users with no billing record", async () => {
      (mockRepo.getCredits as any).mockResolvedValue(0);

      const result = await mockRepo.getCredits("new-user");

      expect(result).toBe(0);
    });

    it("should handle large credit balances", async () => {
      (mockRepo.getCredits as any).mockResolvedValue(999999);

      const result = await mockRepo.getCredits("whale-user");

      expect(result).toBe(999999);
    });
  });

  describe("atomicDebit", () => {
    it("should debit credits when balance is sufficient", async () => {
      (mockRepo.atomicDebit as any).mockResolvedValue({ debited: true });

      const result = await mockRepo.atomicDebit({} as any, "user-1", 5);

      expect(result.debited).toBe(true);
    });

    it("should return insufficient when balance < cost", async () => {
      (mockRepo.atomicDebit as any).mockResolvedValue({
        debited: false,
        reason: "INSUFFICIENT_CREDITS",
      });

      const result = await mockRepo.atomicDebit({} as any, "user-1", 100);

      expect(result.debited).toBe(false);
      expect(result.reason).toBe("INSUFFICIENT_CREDITS");
    });

    it("should return USER_NOT_FOUND when billing record missing", async () => {
      (mockRepo.atomicDebit as any).mockResolvedValue({
        debited: false,
        reason: "USER_NOT_FOUND",
      });

      const result = await mockRepo.atomicDebit({} as any, "nonexistent", 5);

      expect(result.debited).toBe(false);
      expect(result.reason).toBe("USER_NOT_FOUND");
    });
  });

  describe("atomicRefund", () => {
    it("should refund credits to user", async () => {
      (mockRepo.atomicRefund as any).mockResolvedValue(undefined);

      await expect(
        mockRepo.atomicRefund({} as any, "user-1", 10),
      ).resolves.not.toThrow();
    });

    it("should reject zero or negative refund amounts", async () => {
      (mockRepo.atomicRefund as any).mockRejectedValue(
        new Error("Le montant du remboursement doit être positif"),
      );

      await expect(
        mockRepo.atomicRefund({} as any, "user-1", 0),
      ).rejects.toThrow("positif");
    });
  });

  describe("addCredits", () => {
    it("should create a purchase and add credits", async () => {
      const purchase: PurchaseData = {
        id: "purchase-1",
        userId: "user-1",
        stripePaymentId: "pi_123",
        creditsPurchased: 100,
        refundedAt: null,
        disputedAt: null,
        createdAt: new Date(),
      };
      (mockRepo.addCredits as any).mockResolvedValue(purchase);

      const result = await mockRepo.addCredits("user-1", 100, "pi_123");

      expect(result.creditsPurchased).toBe(100);
      expect(result.stripePaymentId).toBe("pi_123");
    });

    it("should handle zero credit purchases for testing", async () => {
      const purchase: PurchaseData = {
        id: "purchase-test",
        userId: "user-1",
        stripePaymentId: "pi_test",
        creditsPurchased: 0,
        refundedAt: null,
        disputedAt: null,
        createdAt: new Date(),
      };
      (mockRepo.addCredits as any).mockResolvedValue(purchase);

      const result = await mockRepo.addCredits("user-1", 0, "pi_test");

      expect(result.creditsPurchased).toBe(0);
    });

    it("should enforce unique stripePaymentId", async () => {
      (mockRepo.addCredits as any).mockRejectedValue(
        new Error("Unique constraint failed"),
      );

      await expect(
        mockRepo.addCredits("user-1", 50, "pi_duplicate"),
      ).rejects.toThrow("Unique constraint");
    });
  });

  describe("getPurchaseHistory", () => {
    it("should return all purchases for a user", async () => {
      const purchases: PurchaseData[] = [
        {
          id: "p1", userId: "user-1", stripePaymentId: "pi_1",
          creditsPurchased: 50, refundedAt: null, disputedAt: null, createdAt: new Date("2026-01-01"),
        },
        {
          id: "p2", userId: "user-1", stripePaymentId: "pi_2",
          creditsPurchased: 100, refundedAt: null, disputedAt: null, createdAt: new Date("2026-02-01"),
        },
      ];
      (mockRepo.getPurchaseHistory as any).mockResolvedValue(purchases);

      const result = await mockRepo.getPurchaseHistory("user-1");

      expect(result).toHaveLength(2);
      expect(result[0].creditsPurchased).toBe(50);
      expect(result[1].creditsPurchased).toBe(100);
    });

    it("should return empty array for user with no purchases", async () => {
      (mockRepo.getPurchaseHistory as any).mockResolvedValue([]);

      const result = await mockRepo.getPurchaseHistory("new-user");

      expect(result).toEqual([]);
    });

    it("should include refunded purchases", async () => {
      const refunded: PurchaseData[] = [
        {
          id: "p1", userId: "user-1", stripePaymentId: "pi_refunded",
          creditsPurchased: 50, refundedAt: new Date("2026-03-01"), disputedAt: null, createdAt: new Date("2026-01-01"),
        },
      ];
      (mockRepo.getPurchaseHistory as any).mockResolvedValue(refunded);

      const result = await mockRepo.getPurchaseHistory("user-1");

      expect(result[0].refundedAt).toBeInstanceOf(Date);
    });
  });

  describe("getDailyCallLimit", () => {
    it("should return daily limit record when found", async () => {
      const limit: DailyLimitData = {
        id: "dl-1", userId: "user-1", date: new Date("2026-06-01"), callCount: 3,
      };
      (mockRepo.getDailyCallLimit as any).mockResolvedValue(limit);

      const result = await mockRepo.getDailyCallLimit("user-1", new Date("2026-06-01"));

      expect(result?.callCount).toBe(3);
    });

    it("should return null for dates with no calls", async () => {
      (mockRepo.getDailyCallLimit as any).mockResolvedValue(null);

      const result = await mockRepo.getDailyCallLimit("user-1", new Date("2026-06-02"));

      expect(result).toBeNull();
    });
  });

  describe("incrementDailyCallCount", () => {
    it("should increment the daily call count", async () => {
      (mockRepo.incrementDailyCallCount as any).mockResolvedValue(1);

      const result = await mockRepo.incrementDailyCallCount({} as any, "user-1", new Date());

      expect(result).toBe(1);
    });

    it("should handle first call of the day (upsert from 0)", async () => {
      (mockRepo.incrementDailyCallCount as any).mockResolvedValue(1);

      const result = await mockRepo.incrementDailyCallCount({} as any, "user-1", new Date("2026-06-01"));

      expect(result).toBe(1);
    });
  });

  describe("hasReachedDailyLimit", () => {
    it("should return false when under limit", async () => {
      (mockRepo.hasReachedDailyLimit as any).mockResolvedValue(false);

      const result = await mockRepo.hasReachedDailyLimit("user-1", new Date(), 10);

      expect(result).toBe(false);
    });

    it("should return true when at limit", async () => {
      (mockRepo.hasReachedDailyLimit as any).mockResolvedValue(true);

      const result = await mockRepo.hasReachedDailyLimit("user-1", new Date(), 5);

      expect(result).toBe(true);
    });

    it("should handle zero maxCalls (feature disabled)", async () => {
      (mockRepo.hasReachedDailyLimit as any).mockResolvedValue(false);

      const result = await mockRepo.hasReachedDailyLimit("user-1", new Date(), 0);

      expect(result).toBe(false);
    });
  });
});
