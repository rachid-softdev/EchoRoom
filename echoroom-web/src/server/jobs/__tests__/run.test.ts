import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// run.ts — Main job orchestrator tests
// ---------------------------------------------------------------------------
// main():
//   1. Calls cleanupOldRecordings(90)
//   2. Calls cleanupOldAuditLogs(365)
//   3. Calls purgeAnonymizedUsers(30)
//   4. If any job fails, error is caught and logged, remaining jobs not executed

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

const mockCleanupOldRecordings = vi.fn();
const mockCleanupOldAuditLogs = vi.fn();
const mockPurgeAnonymizedUsers = vi.fn();

vi.mock("../cleanupRecordings", () => ({
  cleanupOldRecordings: mockCleanupOldRecordings,
}));

vi.mock("../cleanupAuditLogs", () => ({
  cleanupOldAuditLogs: mockCleanupOldAuditLogs,
}));

vi.mock("../gdprPurge", () => ({
  purgeAnonymizedUsers: mockPurgeAnonymizedUsers,
}));

describe("main job orchestrator (run.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCleanupOldRecordings.mockResolvedValue(10);
    mockCleanupOldAuditLogs.mockResolvedValue(5);
    mockPurgeAnonymizedUsers.mockResolvedValue({ deletedUsers: 3 });
  });

  it("should call all three cleanup jobs with correct default parameters when imported", async () => {
    // main() is called at import time
    // Reset modules to re-trigger the import side-effects
    // We need to use dynamic import and check the side effect
    // Since main() is called immediately at module import, we can't easily intercept it
    // after the fact. But we can verify the mocks were called.

    // Actually, vitest's mocking happens before module load. When we import run.ts,
    // main() executes and calls the mocked functions. We just need to wait for them.

    // Import triggers main() execution
    await import("../run");

    // Give the promise chain time to settle
    await vi.waitFor(() => {
      expect(mockCleanupOldRecordings).toHaveBeenCalledWith(90);
      expect(mockCleanupOldAuditLogs).toHaveBeenCalledWith(365);
      expect(mockPurgeAnonymizedUsers).toHaveBeenCalledWith(30);
    });

    // Verify info logs on success
    expect(mockLogInstance.info).toHaveBeenCalledWith(
      "Starting cleanup jobs...",
    );
    expect(mockLogInstance.info).toHaveBeenCalledWith(
      "Cleanup jobs completed",
      expect.objectContaining({
        deletedRecordings: 10,
        deletedAuditLogs: 5,
        deletedUsers: 3,
      }),
    );
  });

  it("should not execute remaining jobs when cleanupOldRecordings throws", async () => {
    mockCleanupOldRecordings.mockRejectedValue(new Error("R2 connection failed"));

    // Import triggers main() which should fail immediately
    await import("../run");

    // Give the promise chain time to settle
    await vi.waitFor(() => {
      expect(mockCleanupOldRecordings).toHaveBeenCalledWith(90);
    });

    // Remaining jobs should NOT be called
    expect(mockCleanupOldAuditLogs).not.toHaveBeenCalled();
    expect(mockPurgeAnonymizedUsers).not.toHaveBeenCalled();

    // Error should be logged
    await vi.waitFor(() => {
      expect(mockLogInstance.error).toHaveBeenCalledWith(
        "Cleanup jobs failed",
        expect.any(Object),
      );
    });
  });

  it("should not execute remaining jobs when cleanupOldAuditLogs throws", async () => {
    mockCleanupOldRecordings.mockResolvedValue(10);
    mockCleanupOldAuditLogs.mockRejectedValue(new Error("DB error"));

    await import("../run");

    await vi.waitFor(() => {
      expect(mockCleanupOldRecordings).toHaveBeenCalledWith(90);
      expect(mockCleanupOldAuditLogs).toHaveBeenCalledWith(365);
    });

    // purgeAnonymizedUsers should NOT be called
    expect(mockPurgeAnonymizedUsers).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(mockLogInstance.error).toHaveBeenCalledWith(
        "Cleanup jobs failed",
        expect.any(Object),
      );
    });
  });
});
