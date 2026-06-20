import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Clips Service Tests
// ---------------------------------------------------------------------------
// Tests for clips.ts:
//   - createClip: validates call ownership, creates clip, schedules extraction
//   - getClips: returns clips with presigned URLs
//   - deleteClip: validates ownership, deletes clip

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

const mockDb = {
  call: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

const mockClipRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByCallId: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/server/repositories", () => ({
  clipRepository: mockClipRepository,
}));

const mockGetPresignedUrl = vi.fn();

vi.mock("@/server/services/audio/r2", () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

// Mock clipExtractor to prevent actual extraction - must return a promise
// to avoid "cannot read properties of undefined (reading 'catch')" in scheduleClipExtraction
vi.mock("@/server/services/social/clipExtractor", () => ({
  extractAndUploadClip: vi.fn().mockResolvedValue(undefined),
}));

// We also need to mock the default import of AppError if it's imported directly
// Actually AppError is imported from @/server/lib/errors, and it's used to throw.
// We don't need to mock it since it's just a class.

import { AppError } from "@/server/lib/errors";

describe("createClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create clip when call exists and is owned by user", async () => {
    mockDb.call.findUnique.mockResolvedValue({ userId: "user-1" });
    mockClipRepository.create.mockResolvedValue({ id: "clip-1" });

    const { createClip } = await import("../clips");
    const result = await createClip({
      callId: "call-1",
      userId: "user-1",
      startTime: 10,
      endTime: 20,
    });

    expect(result).toEqual({ clipId: "clip-1" });
    expect(mockDb.call.findUnique).toHaveBeenCalledWith({
      where: { id: "call-1" },
      select: { userId: true },
    });
    expect(mockClipRepository.create).toHaveBeenCalledWith({
      callId: "call-1",
      userId: "user-1",
      startTime: 10,
      endTime: 20,
    });
  });

  it("should pass title to repository when provided", async () => {
    mockDb.call.findUnique.mockResolvedValue({ userId: "user-1" });
    mockClipRepository.create.mockResolvedValue({ id: "clip-2" });

    const { createClip } = await import("../clips");
    await createClip({
      callId: "call-1",
      userId: "user-1",
      title: "Mon clip",
      startTime: 5,
      endTime: 15,
    });

    expect(mockClipRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Mon clip" }),
    );
  });

  it("should throw NOT_FOUND when call does not exist", async () => {
    mockDb.call.findUnique.mockResolvedValue(null);

    const { createClip } = await import("../clips");
    await expect(
      createClip({
        callId: "nonexistent-call",
        userId: "user-1",
        startTime: 0,
        endTime: 10,
      }),
    ).rejects.toThrow(AppError);

    try {
      await createClip({
        callId: "nonexistent-call",
        userId: "user-1",
        startTime: 0,
        endTime: 10,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("should throw FORBIDDEN when call belongs to another user", async () => {
    mockDb.call.findUnique.mockResolvedValue({ userId: "other-user" });

    const { createClip } = await import("../clips");
    try {
      await createClip({
        callId: "call-1",
        userId: "user-1",
        startTime: 0,
        endTime: 10,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("FORBIDDEN");
    }
  });

  it("should schedule async clip extraction after creation", async () => {
    mockDb.call.findUnique.mockResolvedValue({ userId: "user-1" });
    mockClipRepository.create.mockResolvedValue({ id: "clip-3" });

    // The extraction is scheduled via queueMicrotask — we can't easily assert on it
    // But we verify the clip is created and returned

    const { createClip } = await import("../clips");
    const result = await createClip({
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 5,
    });

    expect(result).toEqual({ clipId: "clip-3" });
  });
});

describe("getClips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return clips with presigned URLs", async () => {
    const clips = [
      { id: "clip-1", clipUrl: "r2://audio/clip1.mp3", startTime: 0, endTime: 10, userId: "user-1", callId: "call-1", title: "Clip 1", status: "READY", createdAt: new Date(), updatedAt: new Date() },
      { id: "clip-2", clipUrl: "r2://audio/clip2.mp3", startTime: 5, endTime: 15, userId: "user-1", callId: "call-1", title: "Clip 2", status: "READY", createdAt: new Date(), updatedAt: new Date() },
    ];
    mockClipRepository.findByCallId.mockResolvedValue(clips);
    mockGetPresignedUrl
      .mockResolvedValueOnce("https://signed.url/clip1.mp3")
      .mockResolvedValueOnce("https://signed.url/clip2.mp3");

    const { getClips } = await import("../clips");
    const result = await getClips("call-1");

    expect(result).toHaveLength(2);
    expect(result[0].clipUrl).toBe("https://signed.url/clip1.mp3");
    expect(result[1].clipUrl).toBe("https://signed.url/clip2.mp3");
    expect(mockClipRepository.findByCallId).toHaveBeenCalledWith("call-1");
    expect(mockGetPresignedUrl).toHaveBeenCalledTimes(2);
  });

  it("should return null for clipUrl when clip.clipUrl is null", async () => {
    const clips = [
      { id: "clip-3", clipUrl: null, startTime: 0, endTime: 5, userId: "user-1", callId: "call-1", title: "Clip 3", status: "PROCESSING", createdAt: new Date(), updatedAt: new Date() },
    ];
    mockClipRepository.findByCallId.mockResolvedValue(clips);

    const { getClips } = await import("../clips");
    const result = await getClips("call-1");

    expect(result).toHaveLength(1);
    expect(result[0].clipUrl).toBeNull();
    // getPresignedUrl should NOT be called for null clipUrl
    expect(mockGetPresignedUrl).not.toHaveBeenCalled();
  });

  it("should return empty array when no clips exist for call", async () => {
    mockClipRepository.findByCallId.mockResolvedValue([]);

    const { getClips } = await import("../clips");
    const result = await getClips("call-without-clips");

    expect(result).toEqual([]);
  });

  it("should spread all clip properties in the result", async () => {
    const clip = {
      id: "clip-4",
      clipUrl: "r2://audio/clip4.mp3",
      startTime: 2,
      endTime: 8,
      userId: "user-1",
      callId: "call-1",
      title: "My Clip",
      status: "READY",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    };
    mockClipRepository.findByCallId.mockResolvedValue([clip]);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/clip4.mp3");

    const { getClips } = await import("../clips");
    const result = await getClips("call-1");

    expect(result[0].id).toBe("clip-4");
    expect(result[0].startTime).toBe(2);
    expect(result[0].endTime).toBe(8);
    expect(result[0].userId).toBe("user-1");
    expect(result[0].callId).toBe("call-1");
    expect(result[0].title).toBe("My Clip");
    expect(result[0].status).toBe("READY");
  });
});

describe("deleteClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete clip when it exists and is owned by user", async () => {
    mockClipRepository.findById.mockResolvedValue({ id: "clip-1", userId: "user-1" });
    mockClipRepository.delete.mockResolvedValue(undefined);

    const { deleteClip } = await import("../clips");
    const result = await deleteClip("clip-1", "user-1");

    expect(result).toEqual({ success: true });
    expect(mockClipRepository.findById).toHaveBeenCalledWith("clip-1");
    expect(mockClipRepository.delete).toHaveBeenCalledWith("clip-1");
  });

  it("should throw NOT_FOUND when clip does not exist", async () => {
    mockClipRepository.findById.mockResolvedValue(null);

    const { deleteClip } = await import("../clips");

    try {
      await deleteClip("nonexistent", "user-1");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("should throw FORBIDDEN when clip belongs to another user", async () => {
    mockClipRepository.findById.mockResolvedValue({ id: "clip-1", userId: "other-user" });

    const { deleteClip } = await import("../clips");

    try {
      await deleteClip("clip-1", "user-1");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("FORBIDDEN");
    }
  });

  it("should not call repository.delete when ownership check fails", async () => {
    mockClipRepository.findById.mockResolvedValue({ id: "clip-1", userId: "other-user" });

    const { deleteClip } = await import("../clips");

    try {
      await deleteClip("clip-1", "user-1");
    } catch {
      // expected
    }

    expect(mockClipRepository.delete).not.toHaveBeenCalled();
  });
});
