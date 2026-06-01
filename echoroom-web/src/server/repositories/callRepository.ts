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

      await tx.user.update({
        where: { id: call.userId },
        data: { credits: { increment: call.costCredits } },
      });
    });
  }
}
