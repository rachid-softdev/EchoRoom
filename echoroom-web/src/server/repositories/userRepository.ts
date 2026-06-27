import type { PrismaClient, User } from "@prisma/client";
import type { AtomicDebitResult, PrismaTx } from "./types";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByIdWithCredits(id: string): Promise<Pick<User, "id" | "credits"> | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  updateMany(where: { id?: string; deletedAt?: Date | null }, data: Partial<User>): Promise<number>;
  atomicDebit(tx: PrismaTx, userId: string, cost: number): Promise<AtomicDebitResult>;
  atomicRefund(tx: PrismaTx, userId: string, amount: number): Promise<void>;
  anonymize(tx: PrismaTx, userId: string): Promise<void>;
}

export class PrismaUserRepository implements IUserRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByIdWithCredits(id: string): Promise<Pick<User, "id" | "credits"> | null> {
    return this.db.user.findUnique({
      where: { id },
      select: { id: true, credits: true },
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  async updateMany(
    where: { id?: string; deletedAt?: Date | null },
    data: Partial<User>,
  ): Promise<number> {
    const result = await this.db.user.updateMany({ where, data });
    return result.count;
  }

  async atomicDebit(tx: PrismaTx, userId: string, cost: number): Promise<AtomicDebitResult> {
    // Prefer UserBilling sub-aggregate, fall back to legacy User.credits
    const billing = await tx.userBilling.findUnique({
      where: { userId },
      select: { credits: true },
    });

    if (billing) {
      if (billing.credits < cost) {
        return { debited: false, reason: "INSUFFICIENT_CREDITS" };
      }
      await tx.userBilling.update({
        where: { userId },
        data: { credits: { decrement: cost } },
      });
      return { debited: true };
    }

    // Legacy fallback: User.credits
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true },
    });

    if (!user) {
      return { debited: false, reason: "USER_NOT_FOUND" };
    }

    if (user.credits < cost) {
      return { debited: false, reason: "INSUFFICIENT_CREDITS" };
    }

    await tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: cost } },
    });

    return { debited: true };
  }

  async atomicRefund(tx: PrismaTx, userId: string, amount: number): Promise<void> {
    // Prefer UserBilling sub-aggregate, fall back to legacy User.credits
    const billing = await tx.userBilling.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (billing) {
      await tx.userBilling.update({
        where: { userId },
        data: { credits: { increment: amount } },
      });
      return;
    }

    await tx.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });
  }

  async anonymize(tx: PrismaTx, userId: string): Promise<void> {
    // Anonymize sub-aggregates
    await tx.userProfile.upsert({
      where: { userId },
      create: { userId },
      update: {
        image: null,
        displayName: null,
        bio: null,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        image: null,
        displayName: null,
        bio: null,
      },
    });

    await tx.scenario.updateMany({
      where: { creatorId: userId },
      data: { visibility: "PRIVATE" },
    });

    await tx.comment.updateMany({
      where: { userId },
      data: { content: "[Commentaire supprimé]" },
    });

    await tx.call.updateMany({
      where: { userId },
      data: { phoneNumber: "[ANONYMISÉ]" },
    });
  }
}
