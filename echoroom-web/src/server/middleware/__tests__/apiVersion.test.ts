import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// API Version Middleware Tests
// ---------------------------------------------------------------------------
// Tests for:
//   resolveApiVersion(req)  — version resolution from request headers
//   validateApiVersionOrThrow(req) — validation wrapper that throws on invalid

function createMockRequest(headers: Record<string, string | null>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

describe("resolveApiVersion", () => {
  it("should return 'latest' when no version header is present", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({});
    expect(resolveApiVersion(req)).toBe("latest");
  });

  it("should return version from x-api-version header", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "v1" });
    expect(resolveApiVersion(req)).toBe("v1");
  });

  it("should return version from x-api-version header (v2)", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "v2" });
    expect(resolveApiVersion(req)).toBe("v2");
  });

  it("should accept 'latest' explicitly via x-api-version", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "latest" });
    expect(resolveApiVersion(req)).toBe("latest");
  });

  it("should fall back to accept-version (legacy) when x-api-version is absent", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "accept-version": "v1" });
    expect(resolveApiVersion(req)).toBe("v1");
  });

  it("should prefer x-api-version over accept-version when both are present", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({
      "x-api-version": "v2",
      "accept-version": "v1",
    });
    // x-api-version is checked first, so v2 wins
    expect(resolveApiVersion(req)).toBe("v2");
  });

  it("should return 'latest' for an unknown version string", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "v3" });
    // v3 is not in ALLOWED_VERSIONS → falls back to "latest"
    expect(resolveApiVersion(req)).toBe("latest");
  });

  it("should be case-insensitive (uppercase V1)", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "V1" });
    expect(resolveApiVersion(req)).toBe("v1");
  });

  it("should trim whitespace from version header", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "  v2  " });
    expect(resolveApiVersion(req)).toBe("v2");
  });

  it("should handle accept-version with different casing", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "accept-version": "V2" });
    expect(resolveApiVersion(req)).toBe("v2");
  });

  it("should return 'latest' when accept-version has unknown value", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "accept-version": "v99" });
    expect(resolveApiVersion(req)).toBe("latest");
  });

  it("should handle empty x-api-version header (empty string)", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "" });
    // Empty string → falsy → falls back to accept-version or latest
    // But empty string after toLowerCase().trim() is "" which is falsy
    expect(resolveApiVersion(req)).toBe("latest");
  });

  it("should handle empty accept-version header (empty string)", async () => {
    const { resolveApiVersion } = await import("../apiVersion");
    const req = createMockRequest({ "accept-version": "" });
    expect(resolveApiVersion(req)).toBe("latest");
  });
});

describe("validateApiVersionOrThrow", () => {
  it("should return version for a valid x-api-version", async () => {
    const { validateApiVersionOrThrow } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "v1" });
    expect(validateApiVersionOrThrow(req)).toBe("v1");
  });

  it("should return 'latest' when no header is present", async () => {
    const { validateApiVersionOrThrow } = await import("../apiVersion");
    const req = createMockRequest({});
    expect(validateApiVersionOrThrow(req)).toBe("latest");
  });

  it("should return 'latest' for unknown version (falls back to latest)", async () => {
    const { validateApiVersionOrThrow } = await import("../apiVersion");
    const req = createMockRequest({ "x-api-version": "v3" });
    // resolveApiVersion already returns "latest" for unknown versions,
    // so validateApiVersionOrThrow does not throw — it returns "latest"
    expect(validateApiVersionOrThrow(req)).toBe("latest");
  });
});
