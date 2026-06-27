import type { PrismaClient, Purchase, UserBilling } from "@prisma/client";
import type { AtomicDebitResult, PrismaTx } from "./types";

export type PurchaseHistoryItem = Pick<
  Purchase,
  "id" | "creditsPurchased" | "createdAt" | "refundedAt" | "disputedAt"
>;

export interface IUserBillingRepository {
  findByUserId(userId: string): Promise<Pick<UserBilling, "id" | "userId" | "credits"> | null>;
  upsert(userId: string, data?: Partial<Pick<UserBilling, "credits">>): Promise<UserBilling>;
  atomicDebit(tx: PrismaTx, userId: string, cost: number): Promise<AtomicDebitResult>;
  atomicRefund(tx: PrismaTx, userId: string, amount: number): Promise<void>;
  getPurchaseHistory(userId: string): Promise<PurchaseHistoryItem[]>;
}

export class PrismaUserBillingRepository implements IUserBillingRepository {
  constructor(private db: PrismaClient) {}

  async findByUserId(
    userId: string,
  ): Promise<Pick<UserBilling, "id" | "userId" | "credits"> | null> {
    return this.db.userBilling.findUnique({
      where: { userId },
      select: { id: true, userId: true, credits: true },
    });
  }

  async upsert(userId: string, data?: Partial<Pick<UserBilling, "credits">>): Promise<UserBilling> {
    return this.db.userBilling.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data ?? {},
    });
  }

  async atomicDebit(tx: PrismaTx, userId: string, cost: number): Promise<AtomicDebitResult> {
    const billing = await tx.userBilling.findUnique({
      where: { userId },
      select: { id: true, credits: true },
    });

    if (!billing) {
      return { debited: false, reason: "USER_NOT_FOUND" };
    }

    if (billing.credits < cost) {
      return { debited: false, reason: "INSUFFICIENT_CREDITS" };
    }

    await tx.userBilling.update({
      where: { userId },
      data: { credits: { decrement: cost } },
    });

    return { debited: true };
  }

  async atomicRefund(tx: PrismaTx, userId: string, amount: number): Promise<void> {
    await tx.userBilling.upsert({
      where: { userId },
      create: { userId, credits: amount },
      update: { credits: { increment: amount } },
    });
  }

  async getPurchaseHistory(userId: string): Promise<PurchaseHistoryItem[]> {
    return this.db.purchase.findMany({
      where: { userId },
      select: {
        id: true,
        creditsPurchased: true,
        createdAt: true,
        refundedAt: true,
        disputedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
