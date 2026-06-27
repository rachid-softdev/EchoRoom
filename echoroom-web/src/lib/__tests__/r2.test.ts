import { describe, expect, it } from "vitest";
import { getR2Key } from "../r2";

describe("getR2Key", () => {
  // --- Full URL format ---

  it("should extract key from full public URL", () => {
    const url = "https://public-bucket.example.com/audio/callSid/1_1717000000000";
    expect(getR2Key(url)).toBe("audio/callSid/1_1717000000000");
  });

  it("should extract key from URL with subdirectory prefix", () => {
    const url = "https://cdn.example.com/recordings/audio/callSid/2_1717000000001";
    expect(getR2Key(url)).toBe("recordings/audio/callSid/2_1717000000001");
  });

  it("should extract key from URL with query parameters (strip them)", () => {
    const url = "https://bucket.r2.dev/audio/abc/3_1717000000002?foo=bar";
    expect(getR2Key(url)).toBe("audio/abc/3_1717000000002");
  });

  it("should handle URL with trailing slash in pathname", () => {
    const url = "https://bucket.r2.dev/audio/callX/4_1717000000003/";
    expect(getR2Key(url)).toBe("audio/callX/4_1717000000003/");
  });

  it("should handle URL with path prefix normalization", () => {
    const url = "https://bucket.com/prefix/../audio/sid/5_1717000000004";
    expect(getR2Key(url)).toBe("audio/sid/5_1717000000004");
  });

  // --- Bare key format ---

  it("should pass through bare R2 key as-is", () => {
    expect(getR2Key("audio/callSid/1_1717000000000")).toBe("audio/callSid/1_1717000000000");
  });

  it("should pass through bare key with nested path", () => {
    expect(getR2Key("recordings/audio/callSid/2_1717000000001")).toBe(
      "recordings/audio/callSid/2_1717000000001",
    );
  });

  it("should pass through key with trailing slash", () => {
    expect(getR2Key("audio/callSid/1_1717000000000/")).toBe("audio/callSid/1_1717000000000/");
  });

  // --- Edge cases ---

  it("should return null for null input", () => {
    expect(getR2Key(null)).toBeNull();
  });

  it("should return null for undefined input", () => {
    expect(getR2Key(undefined)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(getR2Key("")).toBeNull();
  });

  it("should return null for whitespace-only string", () => {
    expect(getR2Key("   ")).toBeNull();
  });

  it("should trim whitespace around URL", () => {
    expect(getR2Key("  https://bucket.com/audio/sid/1_1717000000000  ")).toBe(
      "audio/sid/1_1717000000000",
    );
  });

  it("should trim whitespace around bare key", () => {
    expect(getR2Key("  audio/sid/1_1717000000000  ")).toBe("audio/sid/1_1717000000000");
  });

  it("should return null for unparseable string that looks like a URL", () => {
    // new URL() throws on "http://" — URL malformée → null
    const result = getR2Key("http://");
    expect(result).toBeNull();
  });

  it("should pass through non-URL string (not http/https)", () => {
    expect(getR2Key("ftp://bucket.com/file")).toBe("ftp://bucket.com/file");
  });

  it("should handle URL where pathname is just '/'", () => {
    // URL with no path: https://bucket.com/ → pathname is "/" → empty after strip
    const url = "https://bucket.com/";
    expect(getR2Key(url)).toBeNull();
  });

  it("should handle URL with only domain and no path", () => {
    const url = "https://bucket.com";
    expect(getR2Key(url)).toBeNull();
  });
});
