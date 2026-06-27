import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// TTS Service Tests — synthesizeSpeech
// ---------------------------------------------------------------------------

// Persistent mock logger instance
const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

vi.mock("@/server/lib/requestContext", () => ({
  getRequestId: vi.fn(() => "test-request-id"),
}));

// Circuit breaker mock — module-level reference
const mockCBCall = vi.fn();
vi.mock("@/server/lib/circuitBreaker", () => ({
  createElevenLabsCircuitBreaker: vi.fn(() => ({
    call: mockCBCall,
  })),
  CircuitBreakerOpenError: class extends Error {
    override name = "CircuitBreakerOpenError";
  },
}));

// ElevenLabs client mock
const mockConvert = vi.fn();
const mockElevenLabsClient = {
  textToSpeech: { convert: mockConvert },
};

// Mutable env for "client not initialized" test without leaking vi.doMock
const mockEnv = { ELEVENLABS_API_KEY: "sk-test-key" };
vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

// Make ElevenLabsClient check the API key so it throws when empty
vi.mock("elevenlabs", () => ({
  ElevenLabsClient: vi.fn((config?: { apiKey?: string }) => {
    if (!config?.apiKey) throw new Error("API key missing");
    return mockElevenLabsClient;
  }),
}));

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCBCall.mockImplementation(async (fn: Function) => await fn());
    mockEnv.ELEVENLABS_API_KEY = "sk-test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("should return ArrayBuffer for valid text and voiceId", async () => {
    const audioData = new Uint8Array([0x80, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04]);
    mockConvert.mockResolvedValue({
      [Symbol.asyncIterator]() {
        let returned = false;
        return {
          next() {
            if (!returned) {
              returned = true;
              return Promise.resolve({ value: audioData, done: false });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    });

    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech("Bonjour le monde", "voice-123");

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(result!)).toEqual(audioData);
    expect(mockConvert).toHaveBeenCalledWith(
      "voice-123",
      expect.objectContaining({
        text: "Bonjour le monde",
        model_id: "eleven_flash_v2_5",
        output_format: "ulaw_8000",
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("should combine multiple audio chunks into a single ArrayBuffer", async () => {
    mockConvert.mockResolvedValue({
      [Symbol.asyncIterator]() {
        let count = 0;
        return {
          next() {
            if (count < 3) {
              count++;
              return Promise.resolve({
                value: new Uint8Array([count]),
                done: false,
              });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    });

    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech("Multi-chunk test", "voice-456");

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result!.byteLength).toBe(3);
    const bytes = new Uint8Array(result!);
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("should handle empty stream (no chunks)", async () => {
    mockConvert.mockResolvedValue({
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    });

    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech("Empty stream", "voice-789");

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result!.byteLength).toBe(0);
  });

  it("should log request info with text length and voiceId", async () => {
    mockConvert.mockResolvedValue({
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    });

    const { synthesizeSpeech } = await import("../tts");
    await synthesizeSpeech("Short", "voice-log");

    expect(mockLogInstance.info).toHaveBeenCalledWith(
      "TTS request",
      expect.objectContaining({
        requestId: "test-request-id",
        textLength: 5,
        voiceId: "voice-log",
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Client not initialized (null)
  // -----------------------------------------------------------------------

  it("should return null if ttsClient is not initialized (ELEVENLABS_API_KEY missing)", async () => {
    mockEnv.ELEVENLABS_API_KEY = "";

    const mod = await import("../tts");
    const result = await mod.synthesizeSpeech("test", "voice-1");

    expect(result).toBeNull();
    expect(mockLogInstance.warn).toHaveBeenCalledWith("ElevenLabs unavailable");
  });

  // -----------------------------------------------------------------------
  // Circuit breaker open
  // -----------------------------------------------------------------------

  it("should propagate CircuitBreakerOpenError when circuit is open", async () => {
    mockCBCall.mockRejectedValue(new Error("Service temporairement indisponible"));

    const { synthesizeSpeech } = await import("../tts");
    await expect(synthesizeSpeech("test", "voice-1")).rejects.toThrow(
      "Service temporairement indisponible",
    );
  });

  // -----------------------------------------------------------------------
  // Timeout via AbortController
  // -----------------------------------------------------------------------

  it("should timeout after 15s via AbortController", async () => {
    vi.useFakeTimers();

    // Simulate SDK that hangs until abort signal fires
    mockConvert.mockImplementation(
      (_voiceId: string, _text: any, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener("abort", () => {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            });
          }
        }),
    );

    const { synthesizeSpeech } = await import("../tts");
    const promise = synthesizeSpeech("Timeout test", "voice-timeout");

    // Advance time past the 15s timeout
    vi.advanceTimersByTime(15000);

    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // ElevenLabs API errors
  // -----------------------------------------------------------------------

  it("should propagate error when ElevenLabs returns 404 for invalid voiceId", async () => {
    mockConvert.mockRejectedValue(new Error("voice_id not found"));

    const { synthesizeSpeech } = await import("../tts");
    await expect(synthesizeSpeech("test", "nonexistent-voice")).rejects.toThrow(
      "voice_id not found",
    );
  });

  it("should propagate error when ElevenLabs returns 400 for empty text", async () => {
    mockConvert.mockRejectedValue(new Error("text too short or empty"));

    const { synthesizeSpeech } = await import("../tts");
    await expect(synthesizeSpeech("", "voice-empty")).rejects.toThrow("text too short or empty");
  });

  // -----------------------------------------------------------------------
  // Long text
  // -----------------------------------------------------------------------

  it("should handle very long text (5000+ characters)", async () => {
    const longText = "A".repeat(5500);
    const audioData = new Uint8Array([0xff, 0xee]);

    mockConvert.mockImplementation((_voiceId: string, params: { text: string }, _options?: any) => {
      expect(params.text.length).toBe(5500);
      return Promise.resolve({
        [Symbol.asyncIterator]() {
          let returned = false;
          return {
            next() {
              if (!returned) {
                returned = true;
                return Promise.resolve({ value: audioData, done: false });
              }
              return Promise.resolve({ value: undefined, done: true });
            },
          };
        },
      });
    });

    const { synthesizeSpeech } = await import("../tts");
    const result = await synthesizeSpeech(longText, "voice-long");

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result!.byteLength).toBe(2);

    expect(mockLogInstance.info).toHaveBeenCalledWith(
      "TTS request",
      expect.objectContaining({ textLength: 5500 }),
    );
  });

  // -----------------------------------------------------------------------
  // ttsClient export
  // -----------------------------------------------------------------------

  it("should export ttsClient reference", async () => {
    const mod = await import("../tts");
    expect(mod).toHaveProperty("ttsClient");
  });
});
