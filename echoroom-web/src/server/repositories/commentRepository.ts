import type { $Enums, Comment, PrismaClient } from "@prisma/client";

export interface ICommentRepository {
  findById(id: string): Promise<Comment | null>;
  updateModerationStatus(
    id: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    moderatedById: string,
  ): Promise<void>;
  updateModerationStatusBulk(
    where: { id: string; moderationStatus?: string },
    data: { moderationStatus: string },
  ): Promise<number>;
  findPendingQueue(
    limit: number,
    cursor?: string,
    status?: "PENDING" | "APPROVED" | "REJECTED",
  ): Promise<Comment[]>;
}

export class PrismaCommentRepository implements ICommentRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<Comment | null> {
    return this.db.comment.findUnique({ where: { id } });
  }

  async updateModerationStatus(
    id: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    moderatedById: string,
  ): Promise<void> {
    await this.db.comment.update({
      where: { id },
      data: { moderationStatus: status, moderatedById, moderatedAt: new Date() },
    });
  }

  async updateModerationStatusBulk(
    where: { id: string; moderationStatus?: string },
    data: { moderationStatus: string },
  ): Promise<number> {
    const result = await this.db.comment.updateMany({
      where: { ...where, moderationStatus: where.moderationStatus as $Enums.ModerationStatus },
      data: { moderationStatus: data.moderationStatus as $Enums.ModerationStatus },
    });
    return result.count;
  }

  async findPendingQueue(
    limit: number,
    cursor?: string,
    status?: "PENDING" | "APPROVED" | "REJECTED",
  ): Promise<Comment[]> {
    return this.db.comment.findMany({
      where: { moderationStatus: status ?? "PENDING" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, username: true, image: true } },
        scenario: { select: { id: true, title: true } },
      },
    });
  }
}
