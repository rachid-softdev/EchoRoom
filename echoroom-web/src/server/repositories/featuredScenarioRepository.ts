import type { PrismaClient } from "@prisma/client";

export interface IFeaturedScenarioRepository {
  findByDate(date: string): Promise<{ scenarioId: string; featureType: string } | null>;
  upsert(date: string, scenarioId: string, featureType: string): Promise<void>;
  findTopScenario(
    sinceDate: Date,
  ): Promise<{ id: string; playCount: number; reactionCount: number }[]>;
}

export class PrismaFeaturedScenarioRepository implements IFeaturedScenarioRepository {
  constructor(private db: PrismaClient) {}

  async findByDate(date: string): Promise<{ scenarioId: string; featureType: string } | null> {
    return this.db.featuredScenario.findUnique({
      where: { featuredDate: date },
      select: { scenarioId: true, featureType: true },
    });
  }

  async upsert(date: string, scenarioId: string, featureType: string): Promise<void> {
    await this.db.featuredScenario.upsert({
      where: { featuredDate: date },
      update: { scenarioId, featuredAt: new Date(), featureType },
      create: { scenarioId, featuredDate: date, featuredAt: new Date(), featureType },
    });
  }

  async findTopScenario(
    sinceDate: Date,
  ): Promise<{ id: string; playCount: number; reactionCount: number }[]> {
    const scenarios = await this.db.scenario.findMany({
      where: {
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        createdAt: { gte: sinceDate },
      },
      select: {
        id: true,
        playCount: true,
        _count: { select: { reactions: true } },
      },
    });
    return scenarios.map((s) => ({
      id: s.id,
      playCount: s.playCount,
      reactionCount: s._count.reactions,
    }));
  }
}
