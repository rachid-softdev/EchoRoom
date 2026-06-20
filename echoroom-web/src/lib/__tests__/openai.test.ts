import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// OpenAI client singleton tests
// ---------------------------------------------------------------------------
// Tests for src/lib/openai.ts which creates and caches an OpenAI client.
// The module uses env.OPENAI_API_KEY and a dynamic defaultHeaders getter
// that calls getRequestId() on every access.

// Mock getRequestId to return a predictable value
const mockGetRequestId = vi.fn(() => "test-request-id");

vi.mock("@/server/lib/requestContext", () => ({
  getRequestId: mockGetRequestId,
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Track OpenAI constructor calls
const openaiConstructorCalls: unknown[] = [];
let mockOpenAIInstance: { defaultHeaders: Record<string, unknown> } | null = null;
let shouldConstructorThrow = false;

vi.mock("openai", () => ({
  default: vi.fn(function OpenAI(this: { defaultHeaders: Record<string, unknown> }, ...args: unknown[]) {
    openaiConstructorCalls.push(args[0]);
    if (shouldConstructorThrow) throw new Error("Constructor failed");
    return mockOpenAIInstance;
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "sk-test-key",
  },
}));

describe("getOpenAIClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    openaiConstructorCalls.length = 0;
    mockOpenAIInstance = { defaultHeaders: {} };
    shouldConstructorThrow = false;
  });

  it("should return a singleton client on consecutive calls", async () => {
    mockOpenAIInstance = { defaultHeaders: {} };

    const mod = await import("../openai");

    const client1 = mod.getOpenAIClient();
    const client2 = mod.getOpenAIClient();

    // Singleton: same instance on both calls
    expect(client1).toBe(client2);
  });

  it("should configure client with OPENAI_API_KEY, timeout=30000, maxRetries=2", async () => {
    mockOpenAIInstance = { defaultHeaders: {} };

    const mod = await import("../openai");
    mod.getOpenAIClient();

    // Verify OpenAI was constructed with correct params
    expect(openaiConstructorCalls).toHaveLength(1);
    expect(openaiConstructorCalls[0]).toEqual(
      expect.objectContaining({
        apiKey: "sk-test-key",
        timeout: 30000,
        maxRetries: 2,
      }),
    );
  });

  it("should include X-Request-Id from getRequestId() in defaultHeaders", async () => {
    mockGetRequestId.mockReturnValue("req-456");
    mockOpenAIInstance = { defaultHeaders: {} };

    const mod = await import("../openai");
    const client = mod.getOpenAIClient();

    // The getter should return the current request ID
    const headers = client!.defaultHeaders as { "X-Request-Id": string };
    expect(headers["X-Request-Id"]).toBe("req-456");
  });

  it("should return null when OpenAI constructor throws", async () => {
    shouldConstructorThrow = true;

    const mod = await import("../openai");
    const client = mod.getOpenAIClient();

    expect(client).toBeNull();
  });

  it("should use 'no-request-id' in X-Request-Id when no request context", async () => {
    mockGetRequestId.mockReturnValue("no-request-id");

    const mod = await import("../openai");
    const client = mod.getOpenAIClient();

    const headers = client!.defaultHeaders as { "X-Request-Id": string };
    expect(headers["X-Request-Id"]).toBe("no-request-id");
  });
});
