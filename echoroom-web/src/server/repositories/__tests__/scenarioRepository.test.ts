import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// PrismaScenarioRepository tests
// ---------------------------------------------------------------------------
// Tests for scenarioRepository.ts:
//   - findById: lookup scenario by primary key
//   - findByIdWithCharacter: scenario + character relation
//   - incrementPlayCount: atomic counter increment
//   - create: new scenario creation

describe("PrismaScenarioRepository — findById", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { scenario: { findUnique: mockFindUnique } as any };
    const { PrismaScenarioRepository } = await import("../scenarioRepository");
    repo = new PrismaScenarioRepository(mockDb as PrismaClient);
  });

  it("should return a scenario when found by id", async () => {
    const mockScenario = {
      id: "scenario-1",
      title: "Test Scenario",
      description: "A test",
      visibility: "PUBLIC",
    };
    mockFindUnique.mockResolvedValue(mockScenario);

    const result = await repo.findById("scenario-1");

    expect(result).toEqual(mockScenario);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "scenario-1" } });
  });

  it("should return null when scenario not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("PrismaScenarioRepository — findByIdWithCharacter", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { scenario: { findUnique: mockFindUnique } as any };
    const { PrismaScenarioRepository } = await import("../scenarioRepository");
    repo = new PrismaScenarioRepository(mockDb as PrismaClient);
  });

  it("should include character relation when found", async () => {
    const mockWithCharacter = {
      id: "scenario-1",
      title: "Test",
      character: { id: "char-1", name: "Alice", slug: "alice" },
    };
    mockFindUnique.mockResolvedValue(mockWithCharacter);

    const result = await repo.findByIdWithCharacter("scenario-1");

    expect(result).toEqual(mockWithCharacter);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "scenario-1" },
      include: { character: true },
    });
  });

  it("should return null when scenario not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findByIdWithCharacter("nonexistent");

    expect(result).toBeNull();
  });

  it("should handle character being null (orphaned scenario)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "scenario-1",
      title: "Orphan",
      character: null,
    });

    const result = await repo.findByIdWithCharacter("scenario-1");

    expect(result).not.toBeNull();
    expect(result!.character).toBeNull();
  });
});

describe("PrismaScenarioRepository — incrementPlayCount", () => {
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockUpdate = vi.fn();
    mockDb = { scenario: { update: mockUpdate } as any };
    const { PrismaScenarioRepository } = await import("../scenarioRepository");
    repo = new PrismaScenarioRepository(mockDb as PrismaClient);
  });

  it("should increment playCount by 1", async () => {
    mockUpdate.mockResolvedValue({ id: "scenario-1", playCount: 11 });

    await repo.incrementPlayCount("scenario-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "scenario-1" },
      data: { playCount: { increment: 1 } },
    });
  });

  it("should handle missing scenario gracefully", async () => {
    mockUpdate.mockRejectedValue(new Error("Record to update not found."));

    await expect(repo.incrementPlayCount("nonexistent")).rejects.toThrow(
      "Record to update not found.",
    );
  });
});

describe("PrismaScenarioRepository — create", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockCreate = vi.fn();
    mockDb = { scenario: { create: mockCreate } as any };
    const { PrismaScenarioRepository } = await import("../scenarioRepository");
    repo = new PrismaScenarioRepository(mockDb as PrismaClient);
  });

  it("should create a scenario with required fields", async () => {
    const input = {
      creatorId: "user-1",
      characterId: "char-1",
      title: "New Scenario",
      description: "Description",
      openingMessage: "Hello!",
      aiInstructions: "Be friendly",
    };
    mockCreate.mockResolvedValue({ id: "new-scenario", ...input });

    const result = await repo.create(input);

    expect(result).toEqual({ id: "new-scenario", ...input });
    expect(mockCreate).toHaveBeenCalledWith({ data: input });
  });

  it("should generate an id via Prisma on creation", async () => {
    const input = {
      creatorId: "user-1",
      characterId: "char-1",
      title: "Test",
      description: "Desc",
      openingMessage: "Hi",
      aiInstructions: "Be nice",
    };
    mockCreate.mockResolvedValue({ id: "cuid-generated-123", ...input });

    const result = await repo.create(input);

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("string");
  });

  it("should reject creation with missing required fields (delegated to Prisma)", async () => {
    mockCreate.mockRejectedValue(new Error("Argument `title` is missing."));

    await expect(repo.create({} as any)).rejects.toThrow("Argument `title` is missing.");
  });
});
