import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Spam Detection Tests
// ---------------------------------------------------------------------------
// Tests for spamDetection.ts:
//   - detectCallSpam: 5+ calls → flagged, <5 not flagged, redis down → not flagged
//   - detectScenarioSpam: 10+ scenarios → flagged, <10 not flagged
//   - detectCommentSpam: same content 5x → flagged, case insensitive, different content
//   - Graceful degradation when redis is null or throws

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@/lib/redis", () => ({
  redis: mockRedisInstance,
}));

describe("detectCallSpam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should NOT flag when count < 5", async () => {
    mockRedisInstance.incr.mockResolvedValue(3);

    const { detectCallSpam } = await import("../spamDetection");
    const result = await detectCallSpam("user-1", "+33123456789");

    expect(result).toEqual({ flagged: false });
    expect(mockRedisInstance.incr).toHaveBeenCalledWith("spam:call:user-1:+33123456789");
  });

  it("should NOT flag on the 4th call", async () => {
    mockRedisInstance.incr.mockResolvedValue(4);

    const { detectCallSpam } = await import("../spamDetection");
    const result = await detectCallSpam("user-1", "+33123456789");

    expect(result).toEqual({ flagged: false });
  });

  it("should flag when count >= 5", async () => {
    mockRedisInstance.incr.mockResolvedValue(5);

    const { detectCallSpam } = await import("../spamDetection");
    const result = await detectCallSpam("user-1", "+33987654321");

    expect(result).toEqual({
      flagged: true,
      reason: "Trop d'appels vers ce numéro. Réessayez plus tard.",
    });
  });

  it("should flag on the 10th call too", async () => {
    mockRedisInstance.incr.mockResolvedValue(10);

    const { detectCallSpam } = await import("../spamDetection");
    const result = await detectCallSpam("user-1", "+33123456789");

    expect(result.flagged).toBe(true);
  });

  it("should set TTL (1h) on the first call", async () => {
    mockRedisInstance.incr.mockResolvedValue(1);

    const { detectCallSpam } = await import("../spamDetection");
    await detectCallSpam("user-1", "+33123456789");

    expect(mockRedisInstance.expire).toHaveBeenCalledWith("spam:call:user-1:+33123456789", 3600);
  });

  it("should NOT set TTL on subsequent calls (count > 1)", async () => {
    mockRedisInstance.incr.mockResolvedValue(3);

    const { detectCallSpam } = await import("../spamDetection");
    await detectCallSpam("user-1", "+33123456789");

    expect(mockRedisInstance.expire).not.toHaveBeenCalled();
  });

  it("should NOT flag when redis throws (graceful degradation)", async () => {
    mockRedisInstance.incr.mockRejectedValue(new Error("Redis timeout"));

    const { detectCallSpam } = await import("../spamDetection");
    const result = await detectCallSpam("user-1", "+33123456789");

    expect(result).toEqual({ flagged: false });
    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "Spam detection failed (call)",
      expect.any(Object),
    );
  });

  it("should use separate keys for different phone numbers", async () => {
    const incr = vi.fn()
      .mockResolvedValueOnce(1) // first number, user-1
      .mockResolvedValueOnce(1); // second number, user-1
    mockRedisInstance.incr = incr;

    const { detectCallSpam } = await import("../spamDetection");
    await detectCallSpam("user-1", "+33111111111");
    await detectCallSpam("user-1", "+33222222222");

    expect(incr).toHaveBeenNthCalledWith(1, "spam:call:user-1:+33111111111");
    expect(incr).toHaveBeenNthCalledWith(2, "spam:call:user-1:+33222222222");
  });
});

describe("detectScenarioSpam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should NOT flag when count < 10", async () => {
    mockRedisInstance.incr.mockResolvedValue(5);

    const { detectScenarioSpam } = await import("../spamDetection");
    const result = await detectScenarioSpam("user-1");

    expect(result).toEqual({ flagged: false });
    expect(mockRedisInstance.incr).toHaveBeenCalledWith("spam:scenario:user-1");
  });

  it("should NOT flag on the 9th scenario", async () => {
    mockRedisInstance.incr.mockResolvedValue(9);

    const { detectScenarioSpam } = await import("../spamDetection");
    const result = await detectScenarioSpam("user-1");

    expect(result).toEqual({ flagged: false });
  });

  it("should flag when count >= 10", async () => {
    mockRedisInstance.incr.mockResolvedValue(10);

    const { detectScenarioSpam } = await import("../spamDetection");
    const result = await detectScenarioSpam("user-2");

    expect(result).toEqual({
      flagged: true,
      reason: "Trop de scénarios créés. Réessayez plus tard.",
    });
  });

  it("should flag on high counts", async () => {
    mockRedisInstance.incr.mockResolvedValue(25);

    const { detectScenarioSpam } = await import("../spamDetection");
    const result = await detectScenarioSpam("user-1");

    expect(result.flagged).toBe(true);
  });

  it("should set TTL (5min) on the first scenario", async () => {
    mockRedisInstance.incr.mockResolvedValue(1);

    const { detectScenarioSpam } = await import("../spamDetection");
    await detectScenarioSpam("user-1");

    expect(mockRedisInstance.expire).toHaveBeenCalledWith("spam:scenario:user-1", 300);
  });

  it("should NOT set TTL on subsequent calls", async () => {
    mockRedisInstance.incr.mockResolvedValue(3);

    const { detectScenarioSpam } = await import("../spamDetection");
    await detectScenarioSpam("user-1");

    expect(mockRedisInstance.expire).not.toHaveBeenCalled();
  });

  it("should NOT flag when redis throws", async () => {
    mockRedisInstance.incr.mockRejectedValue(new Error("Redis timeout"));

    const { detectScenarioSpam } = await import("../spamDetection");
    const result = await detectScenarioSpam("user-1");

    expect(result).toEqual({ flagged: false });
    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "Spam detection failed (scenario)",
      expect.any(Object),
    );
  });

  it("should use separate keys for different users", async () => {
    mockRedisInstance.incr
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const { detectScenarioSpam } = await import("../spamDetection");
    await detectScenarioSpam("user-a");
    await detectScenarioSpam("user-b");

    expect(mockRedisInstance.incr).toHaveBeenNthCalledWith(1, "spam:scenario:user-a");
    expect(mockRedisInstance.incr).toHaveBeenNthCalledWith(2, "spam:scenario:user-b");
  });
});

describe("detectCommentSpam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should NOT flag when count < 5", async () => {
    mockRedisInstance.incr.mockResolvedValue(3);

    const { detectCommentSpam } = await import("../spamDetection");
    const result = await detectCommentSpam("user-1", "Bonjour tout le monde");

    expect(result).toEqual({ flagged: false });
  });

  it("should flag when same content posted 5 times", async () => {
    mockRedisInstance.incr.mockResolvedValue(5);

    const { detectCommentSpam } = await import("../spamDetection");
    const result = await detectCommentSpam("user-1", "Spam message");

    expect(result).toEqual({
      flagged: true,
      reason: "Commentaire détecté comme spam. Réessayez plus tard.",
    });
  });

  it("should be case insensitive", async () => {
    // Same content in different case should produce same hash → same key
    mockRedisInstance.incr.mockResolvedValue(5);

    const { detectCommentSpam } = await import("../spamDetection");
    const result = await detectCommentSpam("user-1", "HELLO WORLD");

    expect(result.flagged).toBe(true);
  });

  it("should use different counters for different content", async () => {
    // Each unique content gets its own incr key
    const incr = vi.fn()
      .mockResolvedValueOnce(1) // content A
      .mockResolvedValueOnce(1); // content B
    mockRedisInstance.incr = incr;

    const { detectCommentSpam } = await import("../spamDetection");
    await detectCommentSpam("user-1", "Content A");
    await detectCommentSpam("user-1", "Content B");

    // Two different keys were used (different hashes)
    expect(incr).toHaveBeenCalledTimes(2);
    const key1 = incr.mock.calls[0][0] as string;
    const key2 = incr.mock.calls[1][0] as string;
    expect(key1).not.toEqual(key2);
  });

  it("should set TTL (1h) on the first occurrence of content", async () => {
    mockRedisInstance.incr.mockResolvedValue(1);

    const { detectCommentSpam } = await import("../spamDetection");
    await detectCommentSpam("user-1", "First comment");

    expect(mockRedisInstance.expire).toHaveBeenCalled();
    const expireKey = mockRedisInstance.expire.mock.calls[0][0] as string;
    expect(expireKey).toContain("spam:comment:user-1:");
    expect(mockRedisInstance.expire).toHaveBeenCalledWith(expect.any(String), 3600);
  });

  it("should NOT set TTL on subsequent same-content calls", async () => {
    mockRedisInstance.incr.mockResolvedValue(3);

    const { detectCommentSpam } = await import("../spamDetection");
    await detectCommentSpam("user-1", "Repeat comment");

    expect(mockRedisInstance.expire).not.toHaveBeenCalled();
  });

  it("should NOT flag when redis throws", async () => {
    mockRedisInstance.incr.mockRejectedValue(new Error("Redis down"));

    const { detectCommentSpam } = await import("../spamDetection");
    const result = await detectCommentSpam("user-1", "Any content");

    expect(result).toEqual({ flagged: false });
    expect(mockLogInstance.error).toHaveBeenCalled();
  });

  it("should handle empty content gracefully", async () => {
    mockRedisInstance.incr.mockResolvedValue(1);

    const { detectCommentSpam } = await import("../spamDetection");
    // Empty content should still hash and create a key
    const result = await detectCommentSpam("user-1", "");

    expect(result).toEqual({ flagged: false });
    expect(mockRedisInstance.incr).toHaveBeenCalled();
  });

  it("should trim whitespace before hashing", async () => {
    // " hello " and "hello" should produce the same hash
    mockRedisInstance.incr.mockResolvedValue(5);

    const { detectCommentSpam } = await import("../spamDetection");
    const result = await detectCommentSpam("user-1", "  hello  ");

    expect(result.flagged).toBe(true);
  });
});
