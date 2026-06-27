import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Clip Extractor — extractAndUploadClip tests
// ---------------------------------------------------------------------------
// Tests for clipExtractor.ts:
//   - Successful extraction: findByIdWithCall → presigned URL → Range request → R2 upload → READY
//   - Clip URL uses R2_PUBLIC_URL when set, falls back to bare key when null
//   - Byte offsets calculated correctly for μ-law 8000Hz audio
//   - Content-Type from response forwarded to R2
//   - Extraction timeout fires AbortController after 30s
//   - Clip not found throws error
//   - Call with no recordingUrl → FAILED status
//   - Presigned URL fails → FAILED status
//   - Fetch Range request fails → FAILED status
//   - R2 upload fails → FAILED status
//   - cleanup in finally clears timeout

const mockLogInstance = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => mockLogInstance),
}));

const mockClipRepository = {
  findByIdWithCall: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/server/repositories", () => ({
  clipRepository: mockClipRepository,
}));

const mockGetPresignedUrl = vi.fn();

vi.mock("@/server/services/audio/r2", () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

// Mock PutObjectCommand so we can inspect its input.
// vi.mock() is hoisted, so the factory must use inline vi.fn() to avoid TDZ.
vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn((input: unknown) => ({ input })),
}));

// R2 mocks
const mockR2Client = {
  send: vi.fn(),
};
let R2_PUBLIC_URL_VALUE: string | null = "https://media.example.com";

vi.mock("@/lib/r2", () => ({
  r2Client: mockR2Client,
  R2_BUCKET: "test-bucket",
  get R2_PUBLIC_URL() {
    return R2_PUBLIC_URL_VALUE;
  },
}));

// Helper to create a mock Response
function createMockResponse(
  overrides: Partial<{
    ok: boolean;
    status: number;
    statusText: string;
    body: string;
    headers: Record<string, string>;
  }> = {},
) {
  const {
    ok = true,
    status = 200,
    statusText = "OK",
    body = "mock-audio-data",
    headers = { "content-type": "audio/x-mulaw" },
  } = overrides;

  return {
    ok,
    status,
    statusText,
    headers: {
      get: vi.fn((name: string) => headers[name] ?? null),
    },
    arrayBuffer: vi.fn(async () => Buffer.from(body).buffer),
  } as any;
}

describe("extractAndUploadClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    R2_PUBLIC_URL_VALUE = "https://media.example.com";
    mockClipRepository.findByIdWithCall.mockReset();
    mockClipRepository.update.mockReset();
    mockGetPresignedUrl.mockReset();
    mockR2Client.send.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----- HAPPY PATH -----

  it("should successfully extract, upload, and mark clip as READY", async () => {
    const mockClip = {
      id: "clip-1",
      callId: "call-1",
      userId: "user-1",
      startTime: 10,
      endTime: 20,
      title: "My Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const mockResponse = createMockResponse();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-1");

      // Verify PROCESSING status set before work begins
      expect(mockClipRepository.update).toHaveBeenCalledWith("clip-1", { status: "PROCESSING" });

      // Verify presigned URL request
      expect(mockGetPresignedUrl).toHaveBeenCalledWith(
        "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456",
      );

      // Verify Range request with correct byte offsets (μ-law 8000Hz)
      // startTime: 10 → startByte = 10 * 8000 = 80000
      // endTime: 20 → endByte = 20 * 8000 = 160000
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://signed.url/recording",
        expect.objectContaining({
          headers: { Range: "bytes=80000-160000" },
          signal: expect.any(Object),
        }),
      );

      // Verify R2 upload
      expect(mockR2Client.send).toHaveBeenCalledTimes(1);
      const putCommand = mockR2Client.send.mock.calls[0]![0];
      expect(putCommand.input).toMatchObject({
        Bucket: "test-bucket",
        ContentType: "audio/x-mulaw",
      });
      expect(putCommand.input.Key).toMatch(/^clips\/clip-1_\d+$/);
      // Body is a Buffer with content (exact content depends on vitest transform)
      expect(putCommand.input.Body).toBeInstanceOf(Buffer);

      // Verify clip URL uses public URL
      const updateCall = mockClipRepository.update.mock.calls.find(
        (c: any[]) => c[0] === "clip-1" && c[1]?.status === "READY",
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1].clipUrl).toMatch(/^https:\/\/media\.example\.com\/clips\/clip-1_\d+$/);

      expect(mockLogInstance.info).toHaveBeenCalledWith(
        "Clip extrait et téléversé avec succès",
        expect.objectContaining({ clipId: "clip-1" }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should fall back to bare key when R2_PUBLIC_URL is falsy", async () => {
    R2_PUBLIC_URL_VALUE = null;

    const mockClip = {
      id: "clip-2",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 5,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const mockResponse = createMockResponse();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-2");

      const updateCall = mockClipRepository.update.mock.calls.find(
        (c: any[]) => c[0] === "clip-2" && c[1]?.status === "READY",
      );
      expect(updateCall).toBeDefined();
      // Without public URL, the clipUrl should be just the key
      expect(updateCall![1].clipUrl).toMatch(/^clips\/clip-2_\d+$/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should forward Content-Type from response to R2 upload", async () => {
    const mockClip = {
      id: "clip-3",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 1,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const mockResponse = createMockResponse({
      headers: { "content-type": "audio/basic" },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-3");

      const putCommand = mockR2Client.send.mock.calls[0]![0];
      expect(putCommand.input).toMatchObject({ ContentType: "audio/basic" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should fallback Content-Type to audio/mulaw when response has no content-type", async () => {
    const mockClip = {
      id: "clip-4",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 1,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const mockResponse = createMockResponse({
      headers: {}, // no content-type header
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-4");

      const putCommand = mockR2Client.send.mock.calls[0]![0];
      expect(putCommand.input).toMatchObject({ ContentType: "audio/mulaw" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ----- ERROR / EDGE CASES -----

  it("should throw an error when clip is not found", async () => {
    mockClipRepository.findByIdWithCall.mockResolvedValue(null);
    mockClipRepository.update.mockResolvedValue(undefined);

    const { extractAndUploadClip } = await import("../clipExtractor");
    await expect(extractAndUploadClip("nonexistent")).rejects.toThrow(
      "Clip introuvable : nonexistent",
    );

    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "Clip introuvable pour l'extraction",
      expect.objectContaining({ clipId: "nonexistent" }),
    );
    // No update should be called — no clip to update
    expect(mockClipRepository.update).not.toHaveBeenCalled();
  });

  it("should set FAILED status when call has no recordingUrl", async () => {
    const mockClip = {
      id: "clip-5",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 10,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: null },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);

    const { extractAndUploadClip } = await import("../clipExtractor");
    await extractAndUploadClip("clip-5");

    expect(mockClipRepository.update).toHaveBeenCalledWith("clip-5", { status: "FAILED" });
    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "L'appel n'a pas d'enregistrement",
      expect.objectContaining({ clipId: "clip-5", callId: "call-1" }),
    );
  });

  it("should set FAILED status when presigned URL generation fails (returns null)", async () => {
    const mockClip = {
      id: "clip-6",
      callId: "call-1",
      userId: "user-1",
      startTime: 5,
      endTime: 15,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue(null);

    const { extractAndUploadClip } = await import("../clipExtractor");
    await extractAndUploadClip("clip-6");

    expect(mockClipRepository.update).toHaveBeenCalledWith("clip-6", { status: "FAILED" });
    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "L'extraction du clip a échoué",
      expect.objectContaining({ clipId: "clip-6" }),
    );
  });

  it("should set FAILED status when presigned URL generation throws", async () => {
    const mockClip = {
      id: "clip-7",
      callId: "call-1",
      userId: "user-1",
      startTime: 5,
      endTime: 15,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockRejectedValue(new Error("Network error"));

    const { extractAndUploadClip } = await import("../clipExtractor");
    await extractAndUploadClip("clip-7");

    expect(mockClipRepository.update).toHaveBeenCalledWith("clip-7", { status: "FAILED" });
    expect(mockLogInstance.error).toHaveBeenCalled();
  });

  it("should set FAILED status when fetch Range request fails (not ok)", async () => {
    const mockClip = {
      id: "clip-8",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 5,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const mockResponse = createMockResponse({
      ok: false,
      status: 416,
      statusText: "Range Not Satisfiable",
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-8");

      expect(mockClipRepository.update).toHaveBeenCalledWith("clip-8", { status: "FAILED" });
      expect(mockLogInstance.error).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should set FAILED status when R2 upload fails", async () => {
    const mockClip = {
      id: "clip-9",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 5,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockRejectedValue(new Error("S3 upload timeout"));

    const mockResponse = createMockResponse();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-9");

      expect(mockClipRepository.update).toHaveBeenCalledWith("clip-9", { status: "FAILED" });
      expect(mockLogInstance.error).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should set FAILED status and not throw when fetch throws (network error)", async () => {
    const mockClip = {
      id: "clip-10",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 5,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      // Should NOT throw — errors are caught and logged
      await expect(extractAndUploadClip("clip-10")).resolves.not.toThrow();

      expect(mockClipRepository.update).toHaveBeenCalledWith("clip-10", { status: "FAILED" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // ----- TIMEOUT BEHAVIOR -----

  it("should clear timeout in finally block even on success", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const mockClip = {
      id: "clip-11",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 1,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const mockResponse = createMockResponse();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-11");

      // clearTimeout should have been called at least once (from finally block)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      clearTimeoutSpy.mockRestore();
    }
  });

  it("should clear timeout in finally block even on error", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const mockClip = {
      id: "clip-12",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 1,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockRejectedValue(new Error("Upload failed"));

    const mockResponse = createMockResponse();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-12");

      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      clearTimeoutSpy.mockRestore();
    }
  });

  it("should set AbortController timeout at 30 seconds", async () => {
    const mockClip = {
      id: "clip-13",
      callId: "call-1",
      userId: "user-1",
      startTime: 0,
      endTime: 1,
      title: "Clip",
      status: "PROCESSING",
      call: { recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456" },
    };
    mockClipRepository.findByIdWithCall.mockResolvedValue(mockClip);
    mockClipRepository.update.mockResolvedValue(undefined);
    mockGetPresignedUrl.mockResolvedValue("https://signed.url/recording");
    mockR2Client.send.mockResolvedValue({});

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const mockResponse = createMockResponse();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const { extractAndUploadClip } = await import("../clipExtractor");
      await extractAndUploadClip("clip-13");

      // setTimeout should have been called with a delay of 30000ms
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    } finally {
      globalThis.fetch = originalFetch;
      setTimeoutSpy.mockRestore();
    }
  });
});
