import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Async Moderation Tests
// ---------------------------------------------------------------------------
// Tests for scheduleAsyncModeration:
//   - Approved content updates moderationStatus to APPROVED
//   - Rejected content updates moderationStatus to REJECTED
//   - Errors from checkContent are logged, not thrown
//   - For comment targets, uses db.comment.update
//   - For scenario targets, uses db.scenario.update

// Persistent logger instance — clearAllMocks clears call history but reference stays valid
const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

// Mock checkContent — controlled per test
const mockCheckContent = vi.fn();

vi.mock("../moderation", () => ({
  checkContent: mockCheckContent,
}));

// Mock db — track comment.update and scenario.update
const mockCommentUpdate = vi.fn().mockResolvedValue({});
const mockScenarioUpdate = vi.fn().mockResolvedValue({});

vi.mock("@/server/db", () => ({
    db: {
      comment: {
        updateMany: mockCommentUpdate,
      },
      scenario: {
        updateMany: mockScenarioUpdate,
      },
    },
}));

describe("scheduleAsyncModeration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to flush microtasks (Promise.resolve().then(...) pattern)
  async function flushMicrotasks(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // -----------------------------------------------------------------------
  // Approved content — updates DB to APPROVED
  // -----------------------------------------------------------------------

  it("should update comment to APPROVED when checkContent returns approved: true", async () => {
    mockCheckContent.mockResolvedValue({ approved: true });

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    scheduleAsyncModeration("clean comment text", { type: "comment", id: "comment-1" });

    await flushMicrotasks();

    expect(mockCheckContent).toHaveBeenCalledWith("clean comment text");
    expect(mockCommentUpdate).toHaveBeenCalledTimes(1);
    expect(mockCommentUpdate).toHaveBeenCalledWith({
      where: { id: "comment-1", moderationStatus: "PENDING" },
      data: { moderationStatus: "APPROVED" },
    });
    expect(mockScenarioUpdate).not.toHaveBeenCalled();
  });

  it("should update scenario to APPROVED when checkContent returns approved: true", async () => {
    mockCheckContent.mockResolvedValue({ approved: true });

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    scheduleAsyncModeration("clean scenario text", { type: "scenario", id: "scenario-1" });

    await flushMicrotasks();

    expect(mockScenarioUpdate).toHaveBeenCalledTimes(1);
    expect(mockScenarioUpdate).toHaveBeenCalledWith({
      where: { id: "scenario-1", moderationStatus: "PENDING" },
      data: { moderationStatus: "APPROVED" },
    });
    expect(mockCommentUpdate).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Rejected content — updates DB
  // -----------------------------------------------------------------------

  it("should update db.comment.update when comment is rejected", async () => {
    mockCheckContent.mockResolvedValue({
      approved: false,
      reason: "Contains prohibited content",
    });

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    scheduleAsyncModeration("bad comment", { type: "comment", id: "comment-42" });

    await flushMicrotasks();

    expect(mockCommentUpdate).toHaveBeenCalledTimes(1);
    expect(mockCommentUpdate).toHaveBeenCalledWith({
      where: { id: "comment-42" },
      data: { moderationStatus: "REJECTED" },
    });
    expect(mockScenarioUpdate).not.toHaveBeenCalled();

    expect(mockLogInstance.warn).toHaveBeenCalledWith("Async moderation rejected", {
      targetType: "comment",
      targetId: "comment-42",
      reason: "Contains prohibited content",
    });
  });

  it("should update db.scenario.update when scenario is rejected", async () => {
    mockCheckContent.mockResolvedValue({
      approved: false,
      reason: "Contains prohibited content",
    });

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    scheduleAsyncModeration("bad scenario", { type: "scenario", id: "scenario-99" });

    await flushMicrotasks();

    expect(mockScenarioUpdate).toHaveBeenCalledTimes(1);
    expect(mockScenarioUpdate).toHaveBeenCalledWith({
      where: { id: "scenario-99" },
      data: { moderationStatus: "REJECTED" },
    });
    expect(mockCommentUpdate).not.toHaveBeenCalled();
  });

  it("should include the rejection reason in the log", async () => {
    mockCheckContent.mockResolvedValue({
      approved: false,
      reason: "NSFW content detected",
    });

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    scheduleAsyncModeration("nsfw text", { type: "comment", id: "comment-1" });

    await flushMicrotasks();

    expect(mockLogInstance.warn).toHaveBeenCalledWith(
      "Async moderation rejected",
      expect.objectContaining({ reason: "NSFW content detected" }),
    );
  });

  // -----------------------------------------------------------------------
  // Error handling — checkContent throws
  // -----------------------------------------------------------------------

  it("should log error when checkContent throws and not crash", async () => {
    const testError = new Error("OpenAI API error");
    mockCheckContent.mockRejectedValue(testError);

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    // Should not throw
    scheduleAsyncModeration("text that causes error", { type: "comment", id: "comment-1" });

    await flushMicrotasks();

    // DB should NOT be updated (checkContent threw before reaching that code)
    expect(mockCommentUpdate).not.toHaveBeenCalled();
    expect(mockScenarioUpdate).not.toHaveBeenCalled();

    // Error should be logged
    expect(mockLogInstance.error).toHaveBeenCalledWith("Async moderation failed", {
      targetType: "comment",
      targetId: "comment-1",
      error: testError,
    });
  });

  it("should handle checkContent rejection for scenario targets without crashing", async () => {
    mockCheckContent.mockRejectedValue(new Error("Rate limited"));

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    scheduleAsyncModeration("scenario text", { type: "scenario", id: "scenario-55" });

    await flushMicrotasks();

    expect(mockScenarioUpdate).not.toHaveBeenCalled();

    expect(mockLogInstance.error).toHaveBeenCalledWith("Async moderation failed", {
      targetType: "scenario",
      targetId: "scenario-55",
      error: expect.any(Error),
    });
  });

  // -----------------------------------------------------------------------
  // Multiple calls
  // -----------------------------------------------------------------------

  it("should handle multiple rapid calls correctly", async () => {
    mockCheckContent
      .mockResolvedValueOnce({ approved: true })        // comment-1: approved
      .mockResolvedValueOnce({ approved: false, reason: "bad" }) // comment-2: rejected
      .mockRejectedValueOnce(new Error("fail"))          // comment-3: error
      .mockResolvedValueOnce({ approved: true });        // scenario-1: approved

    const { scheduleAsyncModeration } = await import("../asyncModeration");

    scheduleAsyncModeration("clean", { type: "comment", id: "comment-1" });
    scheduleAsyncModeration("bad comment", { type: "comment", id: "comment-2" });
    scheduleAsyncModeration("error text", { type: "comment", id: "comment-3" });
    scheduleAsyncModeration("clean scenario", { type: "scenario", id: "scenario-1" });

    // Wait for all microtasks to settle
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockCheckContent).toHaveBeenCalledTimes(4);

    // comment-1: approved, should update to APPROVED
    // comment-2: rejected, should update to REJECTED
    expect(mockCommentUpdate).toHaveBeenCalledTimes(2);
    expect(mockCommentUpdate).toHaveBeenCalledWith({
      where: { id: "comment-1", moderationStatus: "PENDING" },
      data: { moderationStatus: "APPROVED" },
    });
    expect(mockCommentUpdate).toHaveBeenCalledWith({
      where: { id: "comment-2" },
      data: { moderationStatus: "REJECTED" },
    });

    // comment-3: error, no update
    // scenario-1: approved, should update to APPROVED
    expect(mockScenarioUpdate).toHaveBeenCalledTimes(1);
    expect(mockScenarioUpdate).toHaveBeenCalledWith({
      where: { id: "scenario-1", moderationStatus: "PENDING" },
      data: { moderationStatus: "APPROVED" },
    });
  });
});
