import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// R2 Server Service Tests — uploadAudioBuffer, getPresignedUrl,
//                          getAudioStream, deleteAudioFile
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

// R2 client send mock
const mockSend = vi.fn();

// Presigner mock — module-level reference shared across all tests
const mockGetSignedUrl = vi.fn();
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// getR2Key mock — provide a realistic implementation
const mockGetR2Key = vi.fn((storedUrl: string | null | undefined): string | null => {
  if (!storedUrl) return null;
  const trimmed = storedUrl.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const key = url.pathname.replace(/^\//, "");
      return key.length > 0 ? key : null;
    } catch {
      return null;
    }
  }
  return trimmed;
});

vi.mock("@/lib/r2", () => ({
  r2Client: { send: mockSend },
  R2_BUCKET: "echoroom-audio",
  R2_PUBLIC_URL: "https://cdn.echoroom.app",
  getR2Key: mockGetR2Key,
}));

const TIMESTAMP = 1781956800000; // 2026-06-20T12:00:00Z

describe("uploadAudioBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TIMESTAMP));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("should upload buffer and return public URL when R2_PUBLIC_URL is set", async () => {
    mockSend.mockResolvedValue({});

    const { uploadAudioBuffer } = await import("../r2");
    const buffer = Buffer.from("audio data");
    const result = await uploadAudioBuffer("call-abc", 1, buffer, "audio/mulaw");

    expect(result).toBe(`https://cdn.echoroom.app/audio/call-abc/1_${TIMESTAMP}`);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0]![0];
    expect(command.input).toMatchObject({
      Bucket: "echoroom-audio",
      Key: `audio/call-abc/1_${TIMESTAMP}`,
      Body: buffer,
      ContentType: "audio/mulaw",
    });
  });

  it("should use default contentType 'audio/mulaw' when not provided", async () => {
    mockSend.mockResolvedValue({});

    const { uploadAudioBuffer } = await import("../r2");
    await uploadAudioBuffer("call-xyz", 2, Buffer.from("data"));

    const command = mockSend.mock.calls[0]![0];
    expect(command.input.ContentType).toBe("audio/mulaw");
  });

  // -----------------------------------------------------------------------
  // Without R2_PUBLIC_URL
  // -----------------------------------------------------------------------

  it("should return bare key when R2_PUBLIC_URL is not set", async () => {
    vi.doMock("@/lib/r2", () => ({
      r2Client: { send: mockSend },
      R2_BUCKET: "echoroom-audio",
      R2_PUBLIC_URL: undefined,
      getR2Key: mockGetR2Key,
    }));

    mockSend.mockResolvedValue({});

    const { uploadAudioBuffer } = await import("../r2");
    const result = await uploadAudioBuffer("call-nopublic", 3, Buffer.from("data"));

    expect(result).toBe(`audio/call-nopublic/3_${TIMESTAMP}`);
    expect(result).not.toContain("http");
  });

  // -----------------------------------------------------------------------
  // Key format
  // -----------------------------------------------------------------------

  it("should format key as 'audio/{callSid}/{turnNumber}_{timestamp}'", async () => {
    mockSend.mockResolvedValue({});

    const { uploadAudioBuffer } = await import("../r2");
    await uploadAudioBuffer("custom-sid", 42, Buffer.from("test"));

    const command = mockSend.mock.calls[0]![0];
    const key = command.input.Key as string;

    expect(key).toBe(`audio/custom-sid/42_${TIMESTAMP}`);
    const parts = key.split("/");
    expect(parts[0]).toBe("audio");
    expect(parts[1]).toBe("custom-sid");
    expect(parts[2]).toBe(`42_${TIMESTAMP}`);
  });

  // -----------------------------------------------------------------------
  // Failure case
  // -----------------------------------------------------------------------

  it("should propagate error when PutObjectCommand fails", async () => {
    mockSend.mockRejectedValue(new Error("S3 upload failed: AccessDenied"));

    const { uploadAudioBuffer } = await import("../r2");
    await expect(uploadAudioBuffer("call-fail", 1, Buffer.from("data"))).rejects.toThrow(
      "S3 upload failed: AccessDenied",
    );
  });
});

// ---------------------------------------------------------------------------
// getPresignedUrl
// ---------------------------------------------------------------------------

describe("getPresignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should sign URL with default TTL of 3600 seconds", async () => {
    mockGetSignedUrl.mockResolvedValue("https://presigned.example.com/audio/key");

    const { getPresignedUrl } = await import("../r2");
    const result = await getPresignedUrl("audio/call-sid/1_1717000000000");

    expect(result).toBe("https://presigned.example.com/audio/key");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "echoroom-audio",
          Key: "audio/call-sid/1_1717000000000",
        }),
      }),
      { expiresIn: 3600 },
    );
  });

  it("should use custom TTL when provided", async () => {
    mockGetSignedUrl.mockResolvedValue("https://presigned.example.com/audio/key?ttl=300");

    const { getPresignedUrl } = await import("../r2");
    const result = await getPresignedUrl("audio/call-sid/2_1717000000001", {
      ttlSeconds: 300,
    });

    expect(result).toBe("https://presigned.example.com/audio/key?ttl=300");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      expiresIn: 300,
    });
  });

  it("should return null when storedUrl is null", async () => {
    const { getPresignedUrl } = await import("../r2");
    const result = await getPresignedUrl(null);

    expect(result).toBeNull();
  });

  it("should return null when storedUrl is undefined", async () => {
    const { getPresignedUrl } = await import("../r2");
    const result = await getPresignedUrl(undefined);

    expect(result).toBeNull();
  });

  it("should return null when storedUrl is empty string", async () => {
    const { getPresignedUrl } = await import("../r2");
    const result = await getPresignedUrl("");

    expect(result).toBeNull();
  });

  it("should extract key from full URL format", async () => {
    mockGetSignedUrl.mockResolvedValue("https://presigned.example.com/path");

    const { getPresignedUrl } = await import("../r2");
    const result = await getPresignedUrl("https://cdn.echoroom.app/audio/sid/1_ts");

    expect(result).toBe("https://presigned.example.com/path");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({ Key: "audio/sid/1_ts" }),
      }),
      expect.anything(),
    );
  });

  it("should return null and log error when signing fails", async () => {
    mockGetSignedUrl.mockImplementation(() => Promise.reject(new Error("Signing failed")));

    const { getPresignedUrl } = await import("../r2");
    const result = await getPresignedUrl("audio/key");

    expect(result).toBeNull();
    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "R2 getPresignedUrl error",
      expect.objectContaining({ key: "audio/key" }),
    );
  });
});

// ---------------------------------------------------------------------------
// getAudioStream
// ---------------------------------------------------------------------------

describe("getAudioStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should return ReadableStream from R2 when key is valid", async () => {
    const mockStream = new ReadableStream();
    mockSend.mockResolvedValue({ Body: mockStream });

    const { getAudioStream } = await import("../r2");
    const result = await getAudioStream("audio/call-sid/1_1717000000000");

    expect(result).toBe(mockStream);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "echoroom-audio",
          Key: "audio/call-sid/1_1717000000000",
        }),
      }),
    );
  });

  it("should handle full URL format for storedUrl", async () => {
    const mockStream = new ReadableStream();
    mockSend.mockResolvedValue({ Body: mockStream });

    const { getAudioStream } = await import("../r2");
    const result = await getAudioStream("https://cdn.echoroom.app/audio/sid/2_ts");

    expect(result).toBe(mockStream);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Key: "audio/sid/2_ts" }),
      }),
    );
  });

  it("should return null when key extraction fails (invalid URL)", async () => {
    const { getAudioStream } = await import("../r2");
    const result = await getAudioStream("http://");

    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should return null and log error when R2 request fails", async () => {
    mockSend.mockRejectedValue(new Error("R2 error: NoSuchKey"));

    const { getAudioStream } = await import("../r2");
    const result = await getAudioStream("audio/missing-key");

    expect(result).toBeNull();
    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "R2 getAudioStream error",
      expect.any(Object),
    );
  });

  it("should return null when Body is undefined/null", async () => {
    mockSend.mockResolvedValue({ Body: null });

    const { getAudioStream } = await import("../r2");
    const result = await getAudioStream("audio/sid/3_ts");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteAudioFile
// ---------------------------------------------------------------------------

describe("deleteAudioFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should delete audio file from R2 using extracted key", async () => {
    mockSend.mockResolvedValue({});

    const { deleteAudioFile } = await import("../r2");
    await deleteAudioFile("audio/call-sid/1_1717000000000");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "echoroom-audio",
          Key: "audio/call-sid/1_1717000000000",
        }),
      }),
    );
  });

  it("should extract key from full URL and delete", async () => {
    mockSend.mockResolvedValue({});

    const { deleteAudioFile } = await import("../r2");
    await deleteAudioFile("https://cdn.echoroom.app/audio/sid/2_ts");

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Key: "audio/sid/2_ts" }),
      }),
    );
  });

  it("should log warning and return early when key cannot be extracted", async () => {
    const { deleteAudioFile } = await import("../r2");
    await deleteAudioFile("http://");

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockLogInstance.warn).toHaveBeenCalledWith(
      "deleteAudioFile: could not extract key from stored URL",
      expect.objectContaining({ storedUrl: "http://" }),
    );
  });

  it("should log error when R2 delete fails (without throwing)", async () => {
    mockSend.mockRejectedValue(new Error("R2 delete error"));

    const { deleteAudioFile } = await import("../r2");
    await deleteAudioFile("audio/call-del/3_ts");

    expect(mockLogInstance.error).toHaveBeenCalledWith(
      "R2 deleteAudioFile error",
      expect.any(Object),
    );
  });
});
