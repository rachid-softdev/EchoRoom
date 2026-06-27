import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// PrismaFeaturedScenarioRepository tests
// ---------------------------------------------------------------------------
// Tests for featuredScenarioRepository.ts:
//   - findByDate returns scenarioId/featureType when date exists
//   - findByDate returns null when no entry for date
//   - upsert creates new record for new date
//   - upsert updates existing record for existing date
//   - findTopScenario returns mapped objects with playCount+reactionCount
//   - findTopScenario empty when no matching scenarios
//   - Error propagation on Prisma failures

describe("PrismaFeaturedScenarioRepository — findByDate", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { featuredScenario: { findUnique: mockFindUnique } as any };
    const { PrismaFeaturedScenarioRepository } = await import("../featuredScenarioRepository");
    repo = new PrismaFeaturedScenarioRepository(mockDb as PrismaClient);
  });

  it("should return scenarioId and featureType when date exists", async () => {
    mockFindUnique.mockResolvedValue({
      scenarioId: "scenario-1",
      featureType: "SCENARIO_OF_THE_DAY",
    });

    const result = await repo.findByDate("2026-06-20");

    expect(result).toEqual({
      scenarioId: "scenario-1",
      featureType: "SCENARIO_OF_THE_DAY",
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { featuredDate: "2026-06-20" },
      select: { scenarioId: true, featureType: true },
    });
  });

  it("should return null when no entry for date", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findByDate("2026-01-01");

    expect(result).toBeNull();
  });

  it("should propagate Prisma errors", async () => {
    mockFindUnique.mockRejectedValue(new Error("Connection error"));

    await expect(repo.findByDate("2026-06-20")).rejects.toThrow("Connection error");
  });
});

describe("PrismaFeaturedScenarioRepository — upsert", () => {
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUpsert = vi.fn();
    mockDb = { featuredScenario: { upsert: mockUpsert } as any };
    const { PrismaFeaturedScenarioRepository } = await import("../featuredScenarioRepository");
    repo = new PrismaFeaturedScenarioRepository(mockDb as PrismaClient);
  });

  it("should create new record for new date", async () => {
    mockUpsert.mockResolvedValue({
      featuredDate: "2026-06-20",
      scenarioId: "scenario-1",
      featureType: "SCENARIO_OF_THE_DAY",
    });

    await repo.upsert("2026-06-20", "scenario-1", "SCENARIO_OF_THE_DAY");

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { featuredDate: "2026-06-20" },
      update: {
        scenarioId: "scenario-1",
        featuredAt: expect.any(Date),
        featureType: "SCENARIO_OF_THE_DAY",
      },
      create: {
        scenarioId: "scenario-1",
        featuredDate: "2026-06-20",
        featuredAt: expect.any(Date),
        featureType: "SCENARIO_OF_THE_DAY",
      },
    });
  });

  it("should update existing record for existing date", async () => {
    mockUpsert.mockResolvedValue({
      featuredDate: "2026-06-20",
      scenarioId: "scenario-2",
      featureType: "TRENDING",
    });

    // First create
    await repo.upsert("2026-06-20", "scenario-1", "SCENARIO_OF_THE_DAY");

    // Then update (same date, different scenario)
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({
      featuredDate: "2026-06-20",
      scenarioId: "scenario-2",
      featureType: "TRENDING",
    });

    await repo.upsert("2026-06-20", "scenario-2", "TRENDING");

    // Upsert with same date should use update path (Prisma handles it)
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { featuredDate: "2026-06-20" },
      update: {
        scenarioId: "scenario-2",
        featuredAt: expect.any(Date),
        featureType: "TRENDING",
      },
      create: {
        scenarioId: "scenario-2",
        featuredDate: "2026-06-20",
        featuredAt: expect.any(Date),
        featureType: "TRENDING",
      },
    });
  });

  it("should propagate Prisma errors", async () => {
    mockUpsert.mockRejectedValue(new Error("Unique constraint violation"));

    await expect(repo.upsert("2026-06-20", "scenario-1", "SCENARIO_OF_THE_DAY")).rejects.toThrow(
      "Unique constraint violation",
    );
  });
});

describe("PrismaFeaturedScenarioRepository — findTopScenario", () => {
  let mockFindMany: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFindMany = vi.fn();
    mockDb = { scenario: { findMany: mockFindMany } as any };
    const { PrismaFeaturedScenarioRepository } = await import("../featuredScenarioRepository");
    repo = new PrismaFeaturedScenarioRepository(mockDb as PrismaClient);
  });

  it("should return mapped objects with playCount and reactionCount", async () => {
    const scenarios = [
      {
        id: "scenario-1",
        playCount: 150,
        _count: { reactions: 25 },
      },
      {
        id: "scenario-2",
        playCount: 80,
        _count: { reactions: 10 },
      },
    ];
    mockFindMany.mockResolvedValue(scenarios);

    const sinceDate = new Date("2026-06-01");
    const result = await repo.findTopScenario(sinceDate);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "scenario-1", playCount: 150, reactionCount: 25 });
    expect(result[1]).toEqual({ id: "scenario-2", playCount: 80, reactionCount: 10 });
    expect(mockFindMany).toHaveBeenCalledWith({
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
  });

  it("should return empty array when no matching scenarios", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await repo.findTopScenario(new Date("2026-07-01"));

    expect(result).toEqual([]);
  });

  it("should query with correct date filter", async () => {
    mockFindMany.mockResolvedValue([]);

    const sinceDate = new Date("2026-06-15T00:00:00Z");
    await repo.findTopScenario(sinceDate);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: sinceDate },
        }),
      }),
    );
  });

  it("should filter by PUBLIC visibility only", async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findTopScenario(new Date());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          visibility: "PUBLIC",
        }),
      }),
    );
  });

  it("should filter by APPROVED moderation status only", async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findTopScenario(new Date());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          moderationStatus: "APPROVED",
        }),
      }),
    );
  });

  it("should propagate Prisma errors", async () => {
    mockFindMany.mockRejectedValue(new Error("Query timeout"));

    await expect(repo.findTopScenario(new Date())).rejects.toThrow("Query timeout");
  });
});
