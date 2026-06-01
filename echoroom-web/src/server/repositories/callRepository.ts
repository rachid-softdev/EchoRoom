import type { PrismaClient, Call, $Enums } from "@prisma/client";

export interface ICallRepository {
  findById(id: string): Promise<Call | null>;
  findWithDetails(id: string): Promise<Pick<Call, "id" | "userId" | "costCredits" | "status"> | null>;
  updateStatusWithGuard(
    id: string,
    currentStatus: $Enums.CallStatus,
    newStatus: $Enums.CallStatus,
    additionalData?: Partial<Pick<Call, "twilioCallSid" | "durationSeconds" | "endedAt">>,
  ): Promise<number>;
  markAsFailedWithRefund(callId: string, durationSeconds: number): Promise<void>;
  createCall(data: {
    userId: string;
    scenarioId: string;
    phoneNumber: string;
    status: string;
    costCredits: number;
  }): Promise<Call>;
  countByUserStatus(userId: string, status: string): Promise<number>;
}

export class PrismaCallRepository implements ICallRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<Call | null> {
    return this.db.call.findUnique({ where: { id } });
  }

  async findWithDetails(id: string): Promise<Pick<Call, "id" | "userId" | "costCredits" | "status"> | null> {
    return this.db.call.findUnique({
      where: { id },
      select: { id: true, userId: true, costCredits: true, status: true },
    });
  }

  async updateStatusWithGuard(
    id: string,
    currentStatus: $Enums.CallStatus,
    newStatus: $Enums.CallStatus,
    additionalData?: Partial<Pick<Call, "twilioCallSid" | "durationSeconds" | "endedAt">>,
  ): Promise<number> {
    const result = await this.db.call.updateMany({
      where: { id, status: currentStatus },
      data: { status: newStatus, ...additionalData },
    });
    return result.count;
  }

  async createCall(data: {
    userId: string;
    scenarioId: string;
    phoneNumber: string;
    status: string;
    costCredits: number;
  }): Promise<Call> {
    return this.db.call.create({
      data: {
        user: { connect: { id: data.userId } },
        scenario: data.scenarioId ? { connect: { id: data.scenarioId } } : undefined,
        phoneNumber: data.phoneNumber,
        status: data.status as $Enums.CallStatus,
        costCredits: data.costCredits,
      },
    });
  }

  async countByUserStatus(userId: string, status: string): Promise<number> {
    return this.db.call.count({ where: { userId, status: status as $Enums.CallStatus } });
  }

  async markAsFailedWithRefund(callId: string, durationSeconds: number): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const updateResult = await tx.call.updateMany({
        where: {
          id: callId,
          status: { notIn: ["FAILED", "COMPLETED"] },
        },
        data: {
          status: "FAILED",
          durationSeconds,
          endedAt: new Date(),
        },
      });

      if (updateResult.count === 0) return;

      const call = await tx.call.findUnique({
        where: { id: callId },
        select: { userId: true, costCredits: true },
      });

      if (!call) return;

      // Refund via UserBilling only (legacy User.credits is deprecated)
      await tx.userBilling.upsert({
        where: { userId: call.userId },
        create: { userId: call.userId, credits: call.costCredits },
        update: { credits: { increment: call.costCredits } },
      });
    });
  }
}
