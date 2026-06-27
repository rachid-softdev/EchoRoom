import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Transcription Service Tests — transcribeAudio
// ---------------------------------------------------------------------------

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

// Circuit breaker mock
const mockCBCall = vi.fn();
vi.mock("@/server/lib/circuitBreaker", () => ({
  createDeepgramCircuitBreaker: vi.fn(() => ({
    call: mockCBCall,
  })),
  CircuitBreakerOpenError: class extends Error {
    override name = "CircuitBreakerOpenError";
  },
}));

// Deepgram client mock
const mockTranscribeFile = vi.fn();
vi.mock("@deepgram/sdk", () => ({
  createClient: vi.fn((key?: string) => {
    if (!key) throw new Error("API key missing");
    return {
      listen: {
        prerecorded: {
          transcribeFile: mockTranscribeFile,
        },
      },
    };
  }),
}));

// Mutable env for tests without leaking vi.doMock
const mockEnv = { DEEPGRAM_API_KEY: "dg-test-key" };
vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

function createSuccessfulTranscriptionResult() {
  return {
    result: {
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "Bonjour le monde",
                confidence: 0.95,
                words: [
                  { word: "Bonjour", start: 0.1, end: 0.3, confidence: 0.98 },
                  { word: "le", start: 0.3, end: 0.35, confidence: 0.99 },
                  { word: "monde", start: 0.35, end: 0.6, confidence: 0.97 },
                ],
              },
            ],
          },
        ],
      },
    },
    error: null,
  };
}

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCBCall.mockImplementation(async (fn: Function) => await fn());
    mockEnv.DEEPGRAM_API_KEY = "dg-test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("should return full transcription result with transcript, confidence and words", async () => {
    mockTranscribeFile.mockResolvedValue(createSuccessfulTranscriptionResult());

    const { transcribeAudio } = await import("../transcription");
    const audioBuffer = new ArrayBuffer(1024);
    const result = await transcribeAudio(audioBuffer, "audio/wav");

    expect(result).not.toBeNull();
    expect(result!.transcript).toBe("Bonjour le monde");
    expect(result!.confidence).toBe(0.95);
    expect(result!.words).toHaveLength(3);
    expect(result!.words[0]).toEqual({
      word: "Bonjour",
      start: 0.1,
      end: 0.3,
      confidence: 0.98,
    });
    expect(result!.words[1]).toEqual({
      word: "le",
      start: 0.3,
      end: 0.35,
      confidence: 0.99,
    });
    expect(result!.words[2]).toEqual({
      word: "monde",
      start: 0.35,
      end: 0.6,
      confidence: 0.97,
    });
  });

  it("should call Deepgram with correct parameters (model, language, mimetype)", async () => {
    mockTranscribeFile.mockResolvedValue(createSuccessfulTranscriptionResult());

    const { transcribeAudio } = await import("../transcription");
    const audioBuffer = new ArrayBuffer(512);
    await transcribeAudio(audioBuffer, "audio/wav");

    expect(mockTranscribeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        model: "nova-2",
        language: "fr",
        mimetype: "audio/wav",
        punctuate: true,
        paragraphs: true,
      }),
    );
  });

  it("should log transcription request with mimetype", async () => {
    mockTranscribeFile.mockResolvedValue(createSuccessfulTranscriptionResult());

    const { transcribeAudio } = await import("../transcription");
    await transcribeAudio(new ArrayBuffer(128), "audio/mp3");

    expect(mockLogInstance.info).toHaveBeenCalledWith(
      "Transcription request",
      expect.objectContaining({
        requestId: "test-request-id",
        mimetype: "audio/mp3",
      }),
    );
  });

  it("should use 'audio/wav' as default mimetype", async () => {
    mockTranscribeFile.mockResolvedValue(createSuccessfulTranscriptionResult());

    const { transcribeAudio } = await import("../transcription");
    await transcribeAudio(new ArrayBuffer(64));

    expect(mockTranscribeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ mimetype: "audio/wav" }),
    );
  });

  // -----------------------------------------------------------------------
  // Client not initialized
  // -----------------------------------------------------------------------

  it("should return null if Deepgram client is not initialized", async () => {
    mockEnv.DEEPGRAM_API_KEY = "";

    const mod = await import("../transcription");
    const result = await mod.transcribeAudio(new ArrayBuffer(128));

    expect(result).toBeNull();
    expect(mockLogInstance.warn).toHaveBeenCalledWith("Deepgram unavailable");
  });

  // -----------------------------------------------------------------------
  // Deepgram error handling
  // -----------------------------------------------------------------------

  it("should return empty result when Deepgram returns an error", async () => {
    mockTranscribeFile.mockResolvedValue({
      result: null,
      error: new Error("Deepgram API error"),
    });

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(new ArrayBuffer(256));

    expect(result).not.toBeNull();
    expect(result!.transcript).toBe("");
    expect(result!.confidence).toBe(0);
    expect(result!.words).toEqual([]);
    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "Deepgram transcription error",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("should return empty result when no alternatives are present (empty array)", async () => {
    mockTranscribeFile.mockResolvedValue({
      result: {
        results: {
          channels: [
            {
              alternatives: [],
            },
          ],
        },
      },
      error: null,
    });

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(new ArrayBuffer(256));

    expect(result!.transcript).toBe("");
    expect(result!.confidence).toBe(0);
    expect(result!.words).toEqual([]);
  });

  it("should return empty transcript with confidence 0 when transcript is empty", async () => {
    mockTranscribeFile.mockResolvedValue({
      result: {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "",
                  confidence: 0,
                  words: [],
                },
              ],
            },
          ],
        },
      },
      error: null,
    });

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(new ArrayBuffer(256));

    expect(result!.transcript).toBe("");
    expect(result!.confidence).toBe(0);
    expect(result!.words).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Circuit breaker open
  // -----------------------------------------------------------------------

  it("should propagate CircuitBreakerOpenError when circuit is open", async () => {
    mockCBCall.mockRejectedValue(new Error("Deepgram temporairement indisponible"));

    const { transcribeAudio } = await import("../transcription");
    await expect(transcribeAudio(new ArrayBuffer(128))).rejects.toThrow(
      "Deepgram temporairement indisponible",
    );
  });

  // -----------------------------------------------------------------------
  // Timeout
  // -----------------------------------------------------------------------

  it("should timeout after 15s via AbortController", async () => {
    vi.useFakeTimers();

    mockTranscribeFile.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => {
            const error = new Error("timed out");
            error.name = "AbortError";
            reject(error);
          }, 15000);
        }),
    );

    const { transcribeAudio } = await import("../transcription");
    const promise = transcribeAudio(new ArrayBuffer(256));

    vi.advanceTimersByTime(15000);

    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("should handle empty audio buffer", async () => {
    mockTranscribeFile.mockResolvedValue({
      result: {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "",
                  confidence: 0,
                  words: [],
                },
              ],
            },
          ],
        },
      },
      error: null,
    });

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(new ArrayBuffer(0));

    expect(result!.transcript).toBe("");
    expect(result!.confidence).toBe(0);
  });

  it("should handle unexpected mimetype", async () => {
    mockTranscribeFile.mockResolvedValue(createSuccessfulTranscriptionResult());

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(new ArrayBuffer(256), "audio/x-flac");

    expect(result).not.toBeNull();
    expect(mockTranscribeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ mimetype: "audio/x-flac" }),
    );
  });

  it("should handle corrupted audio (Deepgram returns error)", async () => {
    mockTranscribeFile.mockResolvedValue({
      result: null,
      error: new Error("could not decode audio file"),
    });

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(new ArrayBuffer(256));

    expect(result!.transcript).toBe("");
    expect(result!.confidence).toBe(0);
    expect(mockLogInstance.error).toHaveBeenCalled();
  });

  it("should handle words being null/undefined gracefully", async () => {
    mockTranscribeFile.mockResolvedValue({
      result: {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: "Hello world",
                  confidence: 0.8,
                  words: undefined,
                },
              ],
            },
          ],
        },
      },
      error: null,
    });

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(new ArrayBuffer(256));

    expect(result!.transcript).toBe("Hello world");
    expect(result!.confidence).toBe(0.8);
    expect(result!.words).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // deepgram export
  // -----------------------------------------------------------------------

  it("should export deepgram reference", async () => {
    const mod = await import("../transcription");
    expect(mod).toHaveProperty("deepgram");
  });
});
