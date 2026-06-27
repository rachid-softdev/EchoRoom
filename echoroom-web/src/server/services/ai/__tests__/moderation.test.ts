import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Moderation Tests
// ---------------------------------------------------------------------------
// Tests for moderation.ts:
//   - checkContent(text) - blocklist + AI moderation
//   - moderateOutput(text, timeoutMs) - output moderation with timeout
//
// NFKC normalization, ReDoS-resistant patterns, and homoglyph detection
// are tested via the blocklist.

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "sk-test-key",
  },
}));

// Mock OpenAI moderation to avoid actual API calls
const mockModerationsCreate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    moderations: {
      create: mockModerationsCreate,
    },
  })),
}));

describe("checkContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Blocklist tests
  // -----------------------------------------------------------------------

  it("should block content containing prohibited words", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("This contains a celebrity reference");

    expect(result.approved).toBe(false);
    expect(result.reason).toBe("Contenu interdit détecté (mot-clé bloqué)");
  });

  it("should allow safe content", async () => {
    // Ensure mock returns safe via AI check
    mockModerationsCreate.mockResolvedValue({
      results: [{ flagged: false, categories: {} }],
    });

    const { checkContent } = await import("../moderation");

    const result = await checkContent("Bonjour, comment allez-vous aujourd'hui?");

    expect(result.approved).toBe(true);
  });

  it("should block content with NFKC-normalized prohibited words", async () => {
    const { checkContent } = await import("../moderation");

    // "celebrity" with fullwidth characters (NFKC-normalized to "celebrity")
    const fullwidthText = "This is about ｃｅｌｅｂｒｉｔｙ gossip";
    const result = await checkContent(fullwidthText);

    expect(result.approved).toBe(false);
    expect(result.reason).toBe("Contenu interdit détecté (mot-clé bloqué)");
  });

  it("should block content with accented variants", async () => {
    const { checkContent } = await import("../moderation");

    // French accented versions
    const result = await checkContent("Cette célébrité est incroyable");

    expect(result.approved).toBe(false);
  });

  it("should block political content (president)", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("The president made a speech");

    expect(result.approved).toBe(false);
  });

  it("should block NSFW content", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("This is nsfw content");

    expect(result.approved).toBe(false);
  });

  it("should block scam-related content", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("Click here to win, not a scam");

    expect(result.approved).toBe(false);
  });

  it("should block harassment content", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("Do not harass other users");

    expect(result.approved).toBe(false);
  });

  it("should block content mentioning nazi", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("nazi ideology is wrong");

    expect(result.approved).toBe(false);
  });

  it("should block phone numbers (French format)", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("Call me at 0612345678 for more info");

    expect(result.approved).toBe(false);
  });

  it("should block international phone numbers", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("Contact +33123456789 for details");

    expect(result.approved).toBe(false);
  });

  it("should not block numbers that are not phone numbers", async () => {
    mockModerationsCreate.mockResolvedValue({
      results: [{ flagged: false, categories: {} }],
    });

    const { checkContent } = await import("../moderation");

    // 10-digit number but doesn't match French phone regex pattern
    // (the regex is /\b0[1-9]\d{8}\b/ which requires 0 followed by 1-9)
    const result = await checkContent("Reference number: 1234567890");

    expect(result.approved).toBe(true);
  });

  it("should block content with vulgar French terms", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("va te faire, c'est nique");

    expect(result.approved).toBe(false);
  });

  it("should not block words containing 'nu' like 'number'", async () => {
    mockModerationsCreate.mockResolvedValue({
      results: [{ flagged: false, categories: {} }],
    });

    const { checkContent } = await import("../moderation");

    const result = await checkContent("Reference number: 1234567890");

    // Should be allowed: "number" contains "nu" but /\bnue?\b/ doesn't match
    expect(result.approved).toBe(true);
  });

  it("should block 'nue' (naked in French) when it's a whole word", async () => {
    const { checkContent } = await import("../moderation");

    const result = await checkContent("photo de femme nue");

    expect(result.approved).toBe(false);
  });

  // -----------------------------------------------------------------------
  // AI moderation fallback
  // -----------------------------------------------------------------------

  it("should use AI moderation when OpenAI is available", async () => {
    mockModerationsCreate.mockResolvedValue({
      results: [{ flagged: false, categories: {} }],
    });

    const { checkContent } = await import("../moderation");

    await checkContent("This is normal clean content");

    // OpenAI moderation should have been called with model+input and options (signal may be undefined when called directly)
    expect(mockModerationsCreate).toHaveBeenCalledWith(
      {
        model: "omni-moderation-latest",
        input: expect.stringContaining("normal clean content"),
      },
      expect.any(Object),
    );
  });

  it("should fail open when AI moderation call fails", async () => {
    mockModerationsCreate.mockRejectedValue(new Error("API error"));

    const { checkContent } = await import("../moderation");

    // Should fall back to blocklist-only (approved since content is clean)
    const result = await checkContent("This is completely safe");

    expect(result.approved).toBe(true);
  });

  it("should reject content flagged by AI moderation", async () => {
    mockModerationsCreate.mockResolvedValue({
      results: [
        {
          flagged: true,
          categories: {
            harassment: true,
            "harassment/threatening": false,
          },
        },
      ],
    });

    const { checkContent } = await import("../moderation");

    const result = await checkContent("Some flagged content");

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("refusé par modération IA");
    expect(result.reason).toContain("harassment");
  });
});

describe("moderateOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass through safe content unchanged", async () => {
    mockModerationsCreate.mockResolvedValue({
      results: [{ flagged: false, categories: {} }],
    });

    const { moderateOutput } = await import("../moderation");

    const safeText = "Bonjour, comment puis-je vous aider?";
    const result = await moderateOutput(safeText);

    expect(result).toBe(safeText);
  });

  it("should replace blocked content with fallback message", async () => {
    const { moderateOutput } = await import("../moderation");

    const blockedText = "Let me tell you about celebrity gossip";
    const result = await moderateOutput(blockedText);

    expect(result).toBe(
      "Je suis désolé, je n'ai pas pu générer une réponse appropriée. Puis-je vous aider avec autre chose ?",
    );
  });

  it("should handle timeout by allowing content through (fail-open)", async () => {
    // Make the OpenAI moderation call hang until the abort signal fires
    mockModerationsCreate.mockImplementation(
      (_params: any, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          // Listen for the abort signal from the timeout (passed in options argument)
          if (options?.signal) {
            const onAbort = () => {
              options!.signal!.removeEventListener("abort", onAbort);
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            };
            options.signal.addEventListener("abort", onAbort);
          }
          // Never resolve — timeout or nothing
        }),
    );

    const { moderateOutput } = await import("../moderation");

    // Use a short timeout (50ms) so the test completes quickly
    const result = await moderateOutput("Some slow-to-moderate content", 50);

    // Should allow content through on timeout
    expect(result).toBe("Some slow-to-moderate content");
  }, 10000);

  it("should apply NFKC normalization to text", async () => {
    mockModerationsCreate.mockResolvedValue({
      results: [{ flagged: false, categories: {} }],
    });

    const { moderateOutput } = await import("../moderation");

    // Fullwidth text that normalizes to clean content
    const text = "ｈｅｌｌｏ";
    const result = await moderateOutput(text);

    // Should pass through (the normalized version is clean)
    expect(result).toBe(text);
  });
});
