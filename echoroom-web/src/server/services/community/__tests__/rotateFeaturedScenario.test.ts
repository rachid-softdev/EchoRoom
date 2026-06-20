import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Rotate Featured Scenario Tests
// ---------------------------------------------------------------------------
// Tests for rotateFeaturedScenario.ts:
//   - ADMIN_CURATED exists → skip rotation, return existing
//   - No admin curated → compute scores, select winner
//   - No scenarios in last 7 days → preserve existing entry
//   - All scenarios have score 0 → preserve existing entry
//   - Score formula: reactionCount×2 + playCount×1
//   - Tie-breaking by sort stability

const mockFeaturedScenarioRepository = {
  findByDate: vi.fn(),
  findTopScenario: vi.fn(),
  upsert: vi.fn(),
};

vi.mock("@/server/repositories", () => ({
  featuredScenarioRepository: mockFeaturedScenarioRepository,
}));

// Mock getUTCDateString to return a fixed date
const mockGetUTCDateString = vi.fn(() => "2026-06-20");

vi.mock("@/server/lib/date", () => ({
  getUTCDateString: mockGetUTCDateString,
}));

describe("rotateFeaturedScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip rotation when ADMIN_CURATED entry exists for today", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue({
      scenarioId: "admin-scenario-1",
      featureType: "ADMIN_CURATED",
    });

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    expect(result).toEqual({ scenarioId: "admin-scenario-1", date: "2026-06-20" });
    expect(mockFeaturedScenarioRepository.findTopScenario).not.toHaveBeenCalled();
    expect(mockFeaturedScenarioRepository.upsert).not.toHaveBeenCalled();
  });

  it("should skip rotation when AUTOMATED entry exists (overwrite allowed)", async () => {
    // Existing entry is AUTOMATED → should be replaced
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue({
      scenarioId: "old-auto-scenario",
      featureType: "AUTOMATED",
    });
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([
      { id: "new-scenario", playCount: 10, reactionCount: 5 },
    ]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    // Should compute scores and overwrite
    expect(result.scenarioId).toBe("new-scenario");
    expect(mockFeaturedScenarioRepository.upsert).toHaveBeenCalled();
  });

  it("should select scenario with highest engagement score (reactions×2 + plays×1)", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue(null);
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([
      { id: "scenario-low", playCount: 5, reactionCount: 1 },  // score: 1×2 + 5×1 = 7
      { id: "scenario-high", playCount: 10, reactionCount: 20 }, // score: 20×2 + 10×1 = 50
      { id: "scenario-mid", playCount: 20, reactionCount: 5 },   // score: 5×2 + 20×1 = 30
    ]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    expect(result.scenarioId).toBe("scenario-high");
    expect(mockFeaturedScenarioRepository.upsert).toHaveBeenCalledWith(
      "2026-06-20",
      "scenario-high",
      "AUTOMATED",
    );
  });

  it("should return null scenarioId when no scenarios exist in last 7 days", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue(null);
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    expect(result).toEqual({ scenarioId: null, date: "2026-06-20" });
    expect(mockFeaturedScenarioRepository.upsert).not.toHaveBeenCalled();
  });

  it("should preserve existing entry when no scenarios found", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue({
      scenarioId: "existing-scenario",
      featureType: "AUTOMATED",
    });
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    expect(result).toEqual({ scenarioId: "existing-scenario", date: "2026-06-20" });
    expect(mockFeaturedScenarioRepository.upsert).not.toHaveBeenCalled();
  });

  it("should return null scenarioId when all scenarios have zero engagement", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue(null);
    // All have score 0
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([
      { id: "s1", playCount: 0, reactionCount: 0 },
      { id: "s2", playCount: 0, reactionCount: 0 },
    ]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    expect(result).toEqual({ scenarioId: null, date: "2026-06-20" });
    expect(mockFeaturedScenarioRepository.upsert).not.toHaveBeenCalled();
  });

  it("should preserve existing entry when all scenarios have zero score", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue({
      scenarioId: "existing-scenario",
      featureType: "AUTOMATED",
    });
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([
      { id: "s1", playCount: 0, reactionCount: 0 },
    ]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    expect(result).toEqual({ scenarioId: "existing-scenario", date: "2026-06-20" });
  });

  it("should correctly compute score formula: reactions×2 + plays×1", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue(null);
    // Setup scenarios with specific scores
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([
      { id: "s1", playCount: 100, reactionCount: 0 }, // score: 0 + 100 = 100
      { id: "s2", playCount: 0, reactionCount: 50 },   // score: 100 + 0 = 100
    ]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    // Both have score 100, first one wins (stable sort)
    expect(result.scenarioId).toBe("s1");
  });

  it("should filter out zero-score scenarios before picking winner", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue(null);
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([
      { id: "s-zero", playCount: 0, reactionCount: 0 }, // score: 0
      { id: "s-positive", playCount: 3, reactionCount: 1 }, // score: 2 + 3 = 5
    ]);

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    const result = await rotateFeaturedScenario();

    expect(result.scenarioId).toBe("s-positive");
  });

  it("should query scenarios from 7 days ago", async () => {
    mockFeaturedScenarioRepository.findByDate.mockResolvedValue(null);
    mockFeaturedScenarioRepository.findTopScenario.mockResolvedValue([]);

    // Use fake timers to control "now"
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));

    const { rotateFeaturedScenario } = await import("../rotateFeaturedScenario");
    await rotateFeaturedScenario();

    // findTopScenario should receive a date 7 days ago: 2026-06-13
    const sevenDaysAgo = mockFeaturedScenarioRepository.findTopScenario.mock.calls[0][0];
    expect(sevenDaysAgo).toBeInstanceOf(Date);
    expect(sevenDaysAgo.toISOString()).toContain("2026-06-13");

    vi.useRealTimers();
  });
});
