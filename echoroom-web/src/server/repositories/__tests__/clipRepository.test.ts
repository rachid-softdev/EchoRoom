import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// PrismaClipRepository tests
// ---------------------------------------------------------------------------
// Tests for clipRepository.ts:
//   - findById returns clip when exists, null when not
//   - findByIdWithCall includes call.recordingUrl
//   - create defaults title to "Clip" when not provided
//   - create passes through custom title
//   - update sets partial fields
//   - delete removes by ID
//   - findByCallId returns clips ordered by createdAt desc
//   - findByCallId returns empty array for no clips
//   - Error propagation on Prisma failures

describe("PrismaClipRepository — findById", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { clip: { findUnique: mockFindUnique } as any };
    const { PrismaClipRepository } = await import("../clipRepository");
    repo = new PrismaClipRepository(mockDb as PrismaClient);
  });

  it("should return clip when found by id", async () => {
    const mockClip = {
      id: "clip-1",
      callId: "call-1",
      userId: "user-1",
      title: "My Clip",
      startTime: 10,
      endTime: 20,
      clipUrl: null,
      status: "PROCESSING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindUnique.mockResolvedValue(mockClip);

    const result = await repo.findById("clip-1");

    expect(result).toEqual(mockClip);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "clip-1" } });
  });

  it("should return null when clip not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findById("nonexistent");

    expect(result).toBeNull();
  });

  it("should propagate Prisma errors", async () => {
    mockFindUnique.mockRejectedValue(new Error("Database connection lost"));

    await expect(repo.findById("clip-1")).rejects.toThrow("Database connection lost");
  });
});

describe("PrismaClipRepository — findByIdWithCall", () => {
  let mockFindUnique: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFindUnique = vi.fn();
    mockDb = { clip: { findUnique: mockFindUnique } as any };
    const { PrismaClipRepository } = await import("../clipRepository");
    repo = new PrismaClipRepository(mockDb as PrismaClient);
  });

  it("should include call.recordingUrl in result", async () => {
    const mockClipWithCall = {
      id: "clip-1",
      callId: "call-1",
      userId: "user-1",
      title: "Clip",
      startTime: 0,
      endTime: 10,
      clipUrl: null,
      status: "READY",
      createdAt: new Date(),
      updatedAt: new Date(),
      call: { recordingUrl: "https://api.twilio.com/recordings/RE123" },
    };
    mockFindUnique.mockResolvedValue(mockClipWithCall);

    const result = await repo.findByIdWithCall("clip-1");

    expect(result).toEqual(mockClipWithCall);
    expect(result?.call.recordingUrl).toBe("https://api.twilio.com/recordings/RE123");
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "clip-1" },
      include: { call: { select: { recordingUrl: true } } },
    });
  });

  it("should return null when clip not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await repo.findByIdWithCall("nonexistent");

    expect(result).toBeNull();
  });

  it("should handle call with null recordingUrl", async () => {
    const mockClipWithCall = {
      id: "clip-2",
      callId: "call-1",
      userId: "user-1",
      title: "Clip",
      startTime: 0,
      endTime: 10,
      clipUrl: null,
      status: "PROCESSING",
      createdAt: new Date(),
      updatedAt: new Date(),
      call: { recordingUrl: null },
    };
    mockFindUnique.mockResolvedValue(mockClipWithCall);

    const result = await repo.findByIdWithCall("clip-2");

    expect(result?.call.recordingUrl).toBeNull();
  });
});

describe("PrismaClipRepository — create", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    mockDb = { clip: { create: mockCreate } as any };
    const { PrismaClipRepository } = await import("../clipRepository");
    repo = new PrismaClipRepository(mockDb as PrismaClient);
  });

  it("should create clip with default title 'Clip' when not provided", async () => {
    const createdClip = {
      id: "clip-1",
      callId: "call-1",
      userId: "user-1",
      title: "Clip",
      startTime: 5,
      endTime: 15,
      clipUrl: null,
      status: "PROCESSING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCreate.mockResolvedValue(createdClip);

    const result = await repo.create({
      callId: "call-1",
      userId: "user-1",
      startTime: 5,
      endTime: 15,
    });

    expect(result).toEqual(createdClip);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        callId: "call-1",
        userId: "user-1",
        startTime: 5,
        endTime: 15,
        title: "Clip",
      },
    });
  });

  it("should pass through custom title when provided", async () => {
    const createdClip = {
      id: "clip-2",
      callId: "call-2",
      userId: "user-2",
      title: "Mon super clip",
      startTime: 0,
      endTime: 30,
      clipUrl: null,
      status: "PROCESSING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCreate.mockResolvedValue(createdClip);

    const result = await repo.create({
      callId: "call-2",
      userId: "user-2",
      title: "Mon super clip",
      startTime: 0,
      endTime: 30,
    });

    expect(result).toEqual(createdClip);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        callId: "call-2",
        userId: "user-2",
        title: "Mon super clip",
        startTime: 0,
        endTime: 30,
      },
    });
  });

  it("should propagate Prisma errors", async () => {
    mockCreate.mockRejectedValue(new Error("Unique constraint violation"));

    await expect(
      repo.create({
        callId: "call-1",
        userId: "user-1",
        startTime: 0,
        endTime: 5,
      }),
    ).rejects.toThrow("Unique constraint violation");
  });
});

describe("PrismaClipRepository — update", () => {
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUpdate = vi.fn();
    mockDb = { clip: { update: mockUpdate } as any };
    const { PrismaClipRepository } = await import("../clipRepository");
    repo = new PrismaClipRepository(mockDb as PrismaClient);
  });

  it("should update clipUrl field", async () => {
    mockUpdate.mockResolvedValue({ id: "clip-1", clipUrl: "https://cdn.example.com/clip.mp3" });

    await repo.update("clip-1", { clipUrl: "https://cdn.example.com/clip.mp3" });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "clip-1" },
      data: { clipUrl: "https://cdn.example.com/clip.mp3" },
    });
  });

  it("should update status field", async () => {
    mockUpdate.mockResolvedValue({ id: "clip-1", status: "READY" });

    await repo.update("clip-1", { status: "READY" });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "clip-1" },
      data: { status: "READY" },
    });
  });

  it("should update multiple fields at once", async () => {
    mockUpdate.mockResolvedValue({ id: "clip-1", clipUrl: "url", status: "READY" });

    await repo.update("clip-1", { clipUrl: "https://cdn.example.com/clip.mp3", status: "READY" });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "clip-1" },
      data: { clipUrl: "https://cdn.example.com/clip.mp3", status: "READY" },
    });
  });

  it("should propagate Prisma errors on update", async () => {
    mockUpdate.mockRejectedValue(new Error("Record not found"));

    await expect(repo.update("nonexistent", { status: "FAILED" })).rejects.toThrow(
      "Record not found",
    );
  });
});

describe("PrismaClipRepository — delete", () => {
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDelete = vi.fn();
    mockDb = { clip: { delete: mockDelete } as any };
    const { PrismaClipRepository } = await import("../clipRepository");
    repo = new PrismaClipRepository(mockDb as PrismaClient);
  });

  it("should delete clip by id", async () => {
    mockDelete.mockResolvedValue({ id: "clip-1" });

    await repo.delete("clip-1");

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "clip-1" } });
  });

  it("should propagate Prisma errors on delete", async () => {
    mockDelete.mockRejectedValue(new Error("Record not found"));

    await expect(repo.delete("nonexistent")).rejects.toThrow("Record not found");
  });
});

describe("PrismaClipRepository — findByCallId", () => {
  let mockFindMany: ReturnType<typeof vi.fn>;
  let mockDb: Partial<PrismaClient>;
  let repo: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFindMany = vi.fn();
    mockDb = { clip: { findMany: mockFindMany } as any };
    const { PrismaClipRepository } = await import("../clipRepository");
    repo = new PrismaClipRepository(mockDb as PrismaClient);
  });

  it("should return clips ordered by createdAt desc", async () => {
    const clips = [
      { id: "clip-2", callId: "call-1", createdAt: new Date("2026-06-02") },
      { id: "clip-1", callId: "call-1", createdAt: new Date("2026-06-01") },
    ];
    mockFindMany.mockResolvedValue(clips);

    const result = await repo.findByCallId("call-1");

    expect(result).toHaveLength(2);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { callId: "call-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should return empty array when no clips for call", async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await repo.findByCallId("call-without-clips");

    expect(result).toEqual([]);
  });

  it("should return clips with all Prisma Clip fields", async () => {
    const now = new Date();
    const clips = [
      {
        id: "clip-1",
        callId: "call-1",
        userId: "user-1",
        title: "Clip",
        startTime: 0,
        endTime: 10,
        clipUrl: "https://cdn.example.com/clip.mp3",
        status: "READY",
        createdAt: now,
        updatedAt: now,
      },
    ];
    mockFindMany.mockResolvedValue(clips);

    const result = await repo.findByCallId("call-1");

    expect(result[0].id).toBe("clip-1");
    expect(result[0].callId).toBe("call-1");
    expect(result[0].title).toBe("Clip");
    expect(result[0].status).toBe("READY");
  });

  it("should propagate Prisma errors", async () => {
    mockFindMany.mockRejectedValue(new Error("Database timeout"));

    await expect(repo.findByCallId("call-1")).rejects.toThrow("Database timeout");
  });
});
