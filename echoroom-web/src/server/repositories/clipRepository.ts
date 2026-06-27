import type { Clip, PrismaClient } from "@prisma/client";

export interface IClipRepository {
  findById(id: string): Promise<Clip | null>;
  findByIdWithCall(id: string): Promise<(Clip & { call: { recordingUrl: string | null } }) | null>;
  create(data: {
    callId: string;
    userId: string;
    title?: string;
    startTime: number;
    endTime: number;
  }): Promise<Clip>;
  update(id: string, data: Partial<Pick<Clip, "clipUrl" | "status">>): Promise<void>;
  delete(id: string): Promise<void>;
  findByCallId(callId: string): Promise<Clip[]>;
}

export class PrismaClipRepository implements IClipRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<Clip | null> {
    return this.db.clip.findUnique({ where: { id } });
  }

  async findByIdWithCall(
    id: string,
  ): Promise<(Clip & { call: { recordingUrl: string | null } }) | null> {
    return this.db.clip.findUnique({
      where: { id },
      include: { call: { select: { recordingUrl: true } } },
    }) as Promise<(Clip & { call: { recordingUrl: string | null } }) | null>;
  }

  async create(data: {
    callId: string;
    userId: string;
    title?: string;
    startTime: number;
    endTime: number;
  }): Promise<Clip> {
    return this.db.clip.create({ data: { ...data, title: data.title ?? "Clip" } });
  }

  async update(id: string, data: Partial<Pick<Clip, "clipUrl" | "status">>): Promise<void> {
    await this.db.clip.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.clip.delete({ where: { id } });
  }

  async findByCallId(callId: string): Promise<Clip[]> {
    return this.db.clip.findMany({
      where: { callId },
      orderBy: { createdAt: "desc" },
    });
  }
}
