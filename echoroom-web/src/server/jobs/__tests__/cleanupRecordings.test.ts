import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// cleanupOldRecordings tests — cursor-based pagination + delete
// ---------------------------------------------------------------------------
// The function:
//   1. Finds calls older than maxAgeDays where recordingUrl IS NOT NULL
//   2. Processes them in batches of BATCH_SIZE (using cursor-based pagination)
//   3. Deletes the audio file from R2 for each call
//   4. Sets recordingUrl = null on the DB record
//   5. Uses orderBy: { createdAt: 'asc' } and cursor: { id } for stable paging
//
// Uses mockImplementation with closures to avoid state leaking between tests.

vi.mock("@/server/db", () => ({
  db: {
    call: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/audio/r2", () => ({
  deleteAudioFile: vi.fn(),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

const BATCH_SIZE = 50;

describe("cleanupOldRecordings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete recordings for calls older than maxAgeDays", async () => {
    const { db } = await import("@/server/db");
    const { deleteAudioFile } = await import("@/server/services/audio/r2");

    const oldCalls = [
      { id: "call-1", recordingUrl: "https://r2.example.com/audio/call-1.wav", createdAt: new Date("2025-01-01") },
      { id: "call-2", recordingUrl: "https://r2.example.com/audio/call-2.wav", createdAt: new Date("2025-02-01") },
    ];

    (db.call.findMany as any).mockResolvedValue(oldCalls);
    (db.call.update as any).mockResolvedValue({});
    (deleteAudioFile as any).mockResolvedValue(undefined);

    const { cleanupOldRecordings } = await import("../cleanupRecordings");
    const result = await cleanupOldRecordings(90);

    expect(result).toBe(2);

    expect(db.call.findMany).toHaveBeenCalledWith({
      where: {
        endedAt: { lte: expect.any(Date) },
        recordingUrl: { not: null },
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
      select: { id: true, recordingUrl: true, createdAt: true },
    });

    expect(deleteAudioFile).toHaveBeenCalledTimes(2);
    expect(deleteAudioFile).toHaveBeenCalledWith(oldCalls[0].recordingUrl);
    expect(deleteAudioFile).toHaveBeenCalledWith(oldCalls[1].recordingUrl);

    expect(db.call.update).toHaveBeenCalledTimes(2);
    expect(db.call.update).toHaveBeenCalledWith({ where: { id: "call-1" }, data: { recordingUrl: null } });
    expect(db.call.update).toHaveBeenCalledWith({ where: { id: "call-2" }, data: { recordingUrl: null } });
  });

  it("should use cursor-based pagination for more than BATCH_SIZE records", async () => {
    const { db } = await import("@/server/db");
    const { deleteAudioFile } = await import("@/server/services/audio/r2");

    const firstPage = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `call-page1-${i}`, recordingUrl: `https://r2.example.com/audio/page1-${i}.wav`,
      createdAt: new Date(`2025-01-${String(i + 1).padStart(2, "0")}`),
    }));
    const secondPage = [
      { id: "call-page2-0", recordingUrl: "https://r2.example.com/audio/page2-0.wav", createdAt: new Date("2025-02-01") },
      { id: "call-page2-1", recordingUrl: "https://r2.example.com/audio/page2-1.wav", createdAt: new Date("2025-02-02") },
    ];

    // Use a closure-based approach to avoid cross-test queue pollution
    let callCount = 0;
    (db.call.findMany as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(firstPage);
      if (callCount === 2) return Promise.resolve(secondPage);
      return Promise.resolve([]);
    });

    (db.call.update as any).mockResolvedValue({});
    (deleteAudioFile as any).mockResolvedValue(undefined);

    const { cleanupOldRecordings } = await import("../cleanupRecordings");
    const result = await cleanupOldRecordings(90);

    expect(result).toBe(BATCH_SIZE + 2);

    expect(db.call.findMany).toHaveBeenNthCalledWith(1, {
      where: { endedAt: { lte: expect.any(Date) }, recordingUrl: { not: null } },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
      select: { id: true, recordingUrl: true, createdAt: true },
    });

    const lastFirstPage = firstPage[firstPage.length - 1];
    expect(db.call.findMany).toHaveBeenNthCalledWith(2, {
      where: { endedAt: { lte: expect.any(Date) }, recordingUrl: { not: null } },
      take: BATCH_SIZE, skip: 1, cursor: { id: lastFirstPage.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, recordingUrl: true, createdAt: true },
    });

    expect(db.call.update).toHaveBeenCalledTimes(BATCH_SIZE + 2);
  });

  it("should not skip records between batches (stable cursor ordering)", async () => {
    const { db } = await import("@/server/db");
    const { deleteAudioFile } = await import("@/server/services/audio/r2");

    const firstPage = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `call-${i}`, recordingUrl: `https://r2.example.com/audio/${i}.wav`,
      createdAt: new Date(`2025-01-${String(i + 1).padStart(2, "0")}`),
    }));
    const secondPage = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      id: `call-${BATCH_SIZE + i}`, recordingUrl: `https://r2.example.com/audio/${BATCH_SIZE + i}.wav`,
      createdAt: new Date(`2025-02-${String(i + 1).padStart(2, "0")}`),
    }));

    let callCount = 0;
    (db.call.findMany as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(firstPage);
      if (callCount === 2) return Promise.resolve(secondPage);
      return Promise.resolve([]);
    });

    (db.call.update as any).mockResolvedValue({});
    (deleteAudioFile as any).mockResolvedValue(undefined);

    const { cleanupOldRecordings } = await import("../cleanupRecordings");
    const result = await cleanupOldRecordings(90);

    expect(result).toBe(BATCH_SIZE * 2);

    const expectedCursor = firstPage[firstPage.length - 1].id;
    expect(db.call.findMany).toHaveBeenNthCalledWith(2, {
      where: { endedAt: { lte: expect.any(Date) }, recordingUrl: { not: null } },
      take: BATCH_SIZE, skip: 1, cursor: { id: expectedCursor },
      orderBy: { createdAt: "asc" },
      select: { id: true, recordingUrl: true, createdAt: true },
    });
  });

  it("should ignore calls with recordingUrl=null", async () => {
    const { db } = await import("@/server/db");
    const { deleteAudioFile } = await import("@/server/services/audio/r2");

    (db.call.findMany as any).mockResolvedValue([
      { id: "call-with-recording", recordingUrl: "https://r2.example.com/audio/recording.wav", createdAt: new Date("2025-01-01") },
    ]);
    (db.call.update as any).mockResolvedValue({});
    (deleteAudioFile as any).mockResolvedValue(undefined);

    const { cleanupOldRecordings } = await import("../cleanupRecordings");
    const result = await cleanupOldRecordings(90);

    expect(result).toBe(1);

    expect(db.call.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endedAt: { lte: expect.any(Date) }, recordingUrl: { not: null } },
      }),
    );
  });

  it("should continue processing other recordings when one delete fails", async () => {
    const { db } = await import("@/server/db");
    const { deleteAudioFile } = await import("@/server/services/audio/r2");

    const calls = [
      { id: "call-fail", recordingUrl: "https://r2.example.com/audio/fail.wav", createdAt: new Date("2025-01-01") },
      { id: "call-ok", recordingUrl: "https://r2.example.com/audio/ok.wav", createdAt: new Date("2025-01-02") },
    ];

    (db.call.findMany as any).mockResolvedValue(calls);
    (db.call.update as any).mockResolvedValue({});

    let deleteCount = 0;
    (deleteAudioFile as any).mockImplementation(() => {
      deleteCount++;
      if (deleteCount === 1) return Promise.reject(new Error("R2 error"));
      return Promise.resolve(undefined);
    });

    const { cleanupOldRecordings } = await import("../cleanupRecordings");
    const result = await cleanupOldRecordings(90);

    expect(result).toBe(1);
    expect(db.call.update).toHaveBeenCalledTimes(1);
    expect(db.call.update).toHaveBeenCalledWith({ where: { id: "call-ok" }, data: { recordingUrl: null } });
  });

  it("should return 0 when no old recordings exist", async () => {
    const { db } = await import("@/server/db");
    (db.call.findMany as any).mockResolvedValue([]);

    const { cleanupOldRecordings } = await import("../cleanupRecordings");
    const result = await cleanupOldRecordings(90);

    expect(result).toBe(0);
    expect(db.call.findMany).toHaveBeenCalledTimes(1);
  });

  it("should compute cutoff date from maxAgeDays parameter", async () => {
    const { db } = await import("@/server/db");
    (db.call.findMany as any).mockResolvedValue([]);

    const { cleanupOldRecordings } = await import("../cleanupRecordings");
    await cleanupOldRecordings(30);

    const findManyCall = (db.call.findMany as any).mock.calls[0][0];
    expect(findManyCall.where.endedAt.lte).toBeInstanceOf(Date);

    const cutoffMs = findManyCall.where.endedAt.lte.getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    expect(nowMs - cutoffMs).toBeGreaterThan(thirtyDaysMs - 5000);
    expect(nowMs - cutoffMs).toBeLessThan(thirtyDaysMs + 5000);
  });
});
