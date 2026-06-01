import type { PrismaClient, Scenario, Character } from "@prisma/client";

export interface IScenarioRepository {
  findById(id: string): Promise<Scenario | null>;
  findByIdWithCharacter(id: string): Promise<(Scenario & { character: Character }) | null>;
  incrementPlayCount(id: string): Promise<void>;
  create(data: Pick<Scenario, "creatorId" | "characterId" | "title" | "description" | "openingMessage" | "aiInstructions">): Promise<Scenario>;
}

export class PrismaScenarioRepository implements IScenarioRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<Scenario | null> {
    return this.db.scenario.findUnique({ where: { id } });
  }

  async findByIdWithCharacter(id: string): Promise<(Scenario & { character: Character }) | null> {
    return this.db.scenario.findUnique({
      where: { id },
      include: { character: true },
    }) as Promise<(Scenario & { character: Character }) | null>;
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.db.scenario.update({
      where: { id },
      data: { playCount: { increment: 1 } },
    });
  }

  async create(data: Pick<Scenario, "creatorId" | "characterId" | "title" | "description" | "openingMessage" | "aiInstructions">): Promise<Scenario> {
    return this.db.scenario.create({ data });
  }
}
