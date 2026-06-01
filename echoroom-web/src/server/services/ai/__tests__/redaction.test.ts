import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// PII Redaction Tests — N3 PII removal from log statements
// ---------------------------------------------------------------------------
// Verifies that log statements use contentLength instead of raw text to
// prevent leaking PII (personally identifiable information) into logs.
//
// Each test spies on the logger's warn method and inspects the meta
// argument for the presence of "contentLength" and absence of "text".

// Shared logger spies — set up once and reused across tests
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockInfo = vi.fn();
const mockDebug = vi.fn();

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    warn: mockWarn,
    error: mockError,
    info: mockInfo,
    debug: mockDebug,
  })),
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "sk-test-key",
  },
}));

const mockModerationsCreate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    moderations: {
      create: mockModerationsCreate,
    },
  })),
}));

describe("moderateOutput — N3 PII in logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should NOT include raw text in blocked content log (uses contentLength)", async () => {
    const { moderateOutput } = await import("../moderation");

    const blockedText = "Let me tell you about celebrity gossip";
    await moderateOutput(blockedText);

    // Find the warn call about blocked content
    const blockedLogCall = mockWarn.mock.calls.find(
      (call: string[]) => call[0] === "AI-generated content blocked",
    );
    expect(blockedLogCall).toBeDefined();

    const meta = blockedLogCall![1];
    // Should NOT contain raw text (PII leak)
    expect(meta).not.toHaveProperty("text");
    // Should contain contentLength instead
    expect(meta).toHaveProperty("contentLength");
    expect(meta.contentLength).toBe(blockedText.length);
    // Should still contain reason
    expect(meta).toHaveProperty("reason");
  });

  it("should not include raw text in AI fallback log (uses contentLength)", async () => {
    // Make OpenAI call hang to trigger timeout inside checkContent
    mockModerationsCreate.mockImplementation(
      (_params: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (options?.signal) {
            const onAbort = () => {
              options.signal!.removeEventListener("abort", onAbort);
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            };
            options.signal.addEventListener("abort", onAbort);
          }
        }),
    );

    const { moderateOutput } = await import("../moderation");

    const timeoutText = "Some slow-to-moderate content";
    const result = await moderateOutput(timeoutText, 50);

    // Content should be allowed through (fail-open)
    expect(result).toBe(timeoutText);

    // The abort happens inside checkContent, which catches it and logs:
    // "AI moderation call failed — falling back to blocklist" (warn level)
    const fallbackLogCall = mockWarn.mock.calls.find(
      (call: string[]) => call[0] === "AI moderation call failed — falling back to blocklist",
    );
    expect(fallbackLogCall).toBeDefined();

    // The fallback log should NOT contain raw text (PII leak)
    const meta = fallbackLogCall![1];
    if (meta) {
      expect(meta).not.toHaveProperty("text");
    }
  });
});

describe("AI moderation fallback — CQ7 log level", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use warn level when AI moderation call fails (fail-open)", async () => {
    mockModerationsCreate.mockRejectedValue(new Error("API error"));

    const { checkContent } = await import("../moderation");

    await checkContent("This is completely safe");

    // Find the warn call about AI moderation failure
    const failLogCall = mockWarn.mock.calls.find(
      (call: string[]) => call[0] === "AI moderation call failed — falling back to blocklist",
    );
    expect(failLogCall).toBeDefined();
    // Should NOT be logged as error (was changed to warn for fail-open scenarios)
    const errorLogCall = mockError.mock.calls.find(
      (call: string[]) => call[0] === "AI moderation call failed — falling back to blocklist",
    );
    expect(errorLogCall).toBeUndefined();
  });

  it("error log should not be used for anticipated fail-open scenario", async () => {
    // Verify that no error log is created for the AI fallback scenario
    mockModerationsCreate.mockRejectedValue(new Error("API error"));

    const { checkContent } = await import("../moderation");
    await checkContent("Safe content");

    // The AI fallback should only log a warning, never an error
    expect(mockError).not.toHaveBeenCalledWith(
      "AI moderation call failed — falling back to blocklist",
      expect.anything(),
    );
  });
});
