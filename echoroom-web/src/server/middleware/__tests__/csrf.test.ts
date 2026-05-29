import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// CSRF Middleware tests
// ---------------------------------------------------------------------------
// Tests for:
//   isOriginAllowed(origin, config) — pure function, no mocking needed
//   validateCSRF(req, config)        — requires a mock NextRequest
//   CSRFFailure                      — error class

describe("isOriginAllowed", () => {
  const defaultConfig = {
    appUrl: "https://echoroom.app",
    trustedOrigins: [],
  };

  it("should allow same origin with exact match", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("https://echoroom.app", defaultConfig)).toBe(true);
  });

  it("should allow same origin with path suffix", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("https://echoroom.app/dashboard", defaultConfig)).toBe(true);
  });

  it("should allow same origin with query parameters", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("https://echoroom.app?ref=test", defaultConfig)).toBe(true);
  });

  it("should allow same origin with subdomain", async () => {
    const { isOriginAllowed } = await import("../csrf");
    // Subdomain should NOT be allowed unless in trustedOrigins
    expect(isOriginAllowed("https://sub.echoroom.app", defaultConfig)).toBe(false);
  });

  it("should reject different origin", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("https://evil-site.com", defaultConfig)).toBe(false);
  });

  it("should reject origin with different scheme", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("http://echoroom.app", defaultConfig)).toBe(false);
  });

  it("should reject origin with different port", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("https://echoroom.app:8080", defaultConfig)).toBe(false);
  });

  it("should allow trusted origins", async () => {
    const { isOriginAllowed } = await import("../csrf");
    const config = {
      appUrl: "https://echoroom.app",
      trustedOrigins: [
        "https://staging.echoroom.app",
        "https://admin.echoroom.app",
      ],
    };
    expect(isOriginAllowed("https://staging.echoroom.app", config)).toBe(true);
    expect(isOriginAllowed("https://admin.echoroom.app", config)).toBe(true);
    expect(isOriginAllowed("https://evil-site.com", config)).toBe(false);
  });

  it("should skip invalid trusted origin URLs gracefully", async () => {
    const { isOriginAllowed } = await import("../csrf");
    const config = {
      appUrl: "https://echoroom.app",
      trustedOrigins: ["not-a-valid-url"],
    };
    // Invalid trusted URL should be skipped, not throw
    expect(isOriginAllowed("https://echoroom.app", config)).toBe(true);
    expect(isOriginAllowed("not-a-valid-url", config)).toBe(false);
  });

  it("should handle empty origin gracefully", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("", defaultConfig)).toBe(false);
  });

  it("should handle invalid origin URL gracefully", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("not-a-url", defaultConfig)).toBe(false);
  });

  it("should handle malformed URL characters in origin", async () => {
    const { isOriginAllowed } = await import("../csrf");
    expect(isOriginAllowed("https://evil.com/<script>alert(1)</script>", defaultConfig)).toBe(false);
  });

  it("should handle null/undefined origin gracefully", async () => {
    const { isOriginAllowed } = await import("../csrf");
    // This tests the catch block in URL constructor
    expect(isOriginAllowed("null", defaultConfig)).toBe(false);
    expect(isOriginAllowed("undefined", defaultConfig)).toBe(false);
  });

  it("should handle appUrl with path", async () => {
    const { isOriginAllowed } = await import("../csrf");
    const config = {
      appUrl: "https://echoroom.app/some/path",
      trustedOrigins: [],
    };
    expect(isOriginAllowed("https://echoroom.app", config)).toBe(true);
    expect(isOriginAllowed("https://echoroom.app/other", config)).toBe(true);
  });

  it("should handle appUrl with port", async () => {
    const { isOriginAllowed } = await import("../csrf");
    const config = {
      appUrl: "https://localhost:3000",
      trustedOrigins: [],
    };
    expect(isOriginAllowed("https://localhost:3000", config)).toBe(true);
    expect(isOriginAllowed("https://localhost:3001", config)).toBe(false);
    expect(isOriginAllowed("http://localhost:3000", config)).toBe(false);
  });

  it("should handle trusted origins with paths and ports", async () => {
    const { isOriginAllowed } = await import("../csrf");
    const config = {
      appUrl: "https://echoroom.app",
      trustedOrigins: ["https://staging.echoroom.app:4000"],
    };
    expect(isOriginAllowed("https://staging.echoroom.app:4000", config)).toBe(true);
    expect(isOriginAllowed("https://staging.echoroom.app", config)).toBe(false);
  });

  it("should handle empty trustedOrigins array", async () => {
    const { isOriginAllowed } = await import("../csrf");
    const config = {
      appUrl: "https://echoroom.app",
      trustedOrigins: [],
    };
    expect(isOriginAllowed("https://other.com", config)).toBe(false);
    expect(isOriginAllowed("https://echoroom.app", config)).toBe(true);
  });

  it("should handle trustedOrigins containing appUrl itself (no-op)", async () => {
    const { isOriginAllowed } = await import("../csrf");
    const config = {
      appUrl: "https://echoroom.app",
      trustedOrigins: ["https://echoroom.app"],
    };
    expect(isOriginAllowed("https://echoroom.app", config)).toBe(true);
  });
});

describe("CSRFFailure", () => {
  it("should create error with reason and origin", async () => {
    const { CSRFFailure } = await import("../csrf");
    const error = new CSRFFailure("Origin not allowed", "https://evil.com");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CSRFFailure");
    expect(error.reason).toBe("Origin not allowed");
    expect(error.origin).toBe("https://evil.com");
    expect(error.message).toBe("CSRF validation failed: Origin not allowed");
  });

  it("should handle null origin", async () => {
    const { CSRFFailure } = await import("../csrf");
    const error = new CSRFFailure("Missing origin header", null);

    expect(error.reason).toBe("Missing origin header");
    expect(error.origin).toBeNull();
  });

  it("should have proper stack trace", async () => {
    const { CSRFFailure } = await import("../csrf");
    const error = new CSRFFailure("Test", "https://example.com");
    expect(error.stack).toBeDefined();
  });
});

describe("validateCSRF", () => {
  const defaultConfig = {
    appUrl: "https://echoroom.app",
    allowMissingOrigin: true,
  };

  function createMockRequest(headers: Record<string, string | null>): NextRequest {
    return {
      headers: {
        get: (name: string) => headers[name] ?? null,
      },
    } as unknown as NextRequest;
  }

  it("should pass with valid origin matching appUrl", async () => {
    const { validateCSRF } = await import("../csrf");
    const req = createMockRequest({ origin: "https://echoroom.app" });

    expect(() => validateCSRF(req, defaultConfig)).not.toThrow();
  });

  it("should pass with valid origin with path", async () => {
    const { validateCSRF } = await import("../csrf");
    const req = createMockRequest({ origin: "https://echoroom.app/some/path" });

    expect(() => validateCSRF(req, defaultConfig)).not.toThrow();
  });

  it("should throw CSRFFailure with invalid origin", async () => {
    const { validateCSRF, CSRFFailure } = await import("../csrf");
    const req = createMockRequest({ origin: "https://evil-site.com" });

    expect(() => validateCSRF(req, defaultConfig)).toThrow(CSRFFailure);
    expect(() => validateCSRF(req, defaultConfig)).toThrow(
      "CSRF validation failed: Origin not allowed: https://evil-site.com",
    );
  });

  it("should use referer header when origin is missing", async () => {
    const { validateCSRF } = await import("../csrf");
    const req = createMockRequest({
      origin: null,
      referer: "https://echoroom.app/some-page",
    });

    expect(() => validateCSRF(req, defaultConfig)).not.toThrow();
  });

  it("should throw when referer is from different domain and origin missing", async () => {
    const { validateCSRF, CSRFFailure } = await import("../csrf");
    const req = createMockRequest({
      origin: null,
      referer: "https://evil-site.com/some-page",
    });

    expect(() => validateCSRF(req, defaultConfig)).toThrow(CSRFFailure);
  });

  it("should throw when allowMissingOrigin is false and no origin header", async () => {
    const { validateCSRF, CSRFFailure } = await import("../csrf");
    const req = createMockRequest({ origin: null });

    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: false }),
    ).toThrow(CSRFFailure);
    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: false }),
    ).toThrow("CSRF validation failed: Missing origin header");
  });

  it("should accept missing origin when allowMissingOrigin is true", async () => {
    const { validateCSRF } = await import("../csrf");
    const req = createMockRequest({ origin: null });

    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: true }),
    ).not.toThrow();
  });

  it("should respect trusted origins", async () => {
    const { validateCSRF } = await import("../csrf");
    const req = createMockRequest({ origin: "https://staging.echoroom.app" });

    const config = {
      appUrl: "https://echoroom.app",
      trustedOrigins: ["https://staging.echoroom.app"],
    };

    expect(() => validateCSRF(req, config)).not.toThrow();
  });

  it("should reject invalid origin even with trusted origins", async () => {
    const { validateCSRF, CSRFFailure } = await import("../csrf");
    const req = createMockRequest({ origin: "https://evil.com" });

    const config = {
      appUrl: "https://echoroom.app",
      trustedOrigins: ["https://staging.echoroom.app"],
    };

    expect(() => validateCSRF(req, config)).toThrow(CSRFFailure);
  });

  it("should handle missing both origin and referer", async () => {
    const { validateCSRF } = await import("../csrf");
    const req = createMockRequest({ origin: null, referer: null });

    // When allowMissingOrigin is true, this is OK (non-browser client)
    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: true }),
    ).not.toThrow();
  });

  it("should handle malformed referer gracefully", async () => {
    const { validateCSRF } = await import("../csrf");
    const req = createMockRequest({
      origin: null,
      referer: "not-a-valid-url",
    });

    // new URL("not-a-valid-url") throws, so sourceOrigin becomes null
    // With allowMissingOrigin: true, this should pass (non-browser client)
    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: true }),
    ).not.toThrow();
  });

  it("should reject malformed referer when allowMissingOrigin is false", async () => {
    const { validateCSRF, CSRFFailure } = await import("../csrf");
    const req = createMockRequest({
      origin: null,
      referer: "not-a-valid-url",
    });

    // new URL throws → sourceOrigin becomes null
    // allowMissingOrigin is false → throws
    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: false }),
    ).toThrow(CSRFFailure);
  });
});

describe("CSRF integration — origin vs referer priority", () => {
  it("should prefer origin over referer when both are present", async () => {
    const { validateCSRF } = await import("../csrf");

    // Origin is valid but referer is evil — should pass because origin wins
    const req = {
      headers: {
        get: (name: string) => {
          if (name === "origin") return "https://echoroom.app";
          if (name === "referer") return "https://evil-site.com/page";
          return null;
        },
      },
    } as unknown as NextRequest;

    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: true }),
    ).not.toThrow();
  });

  it("should reject when origin is evil even if referer looks valid", async () => {
    const { validateCSRF, CSRFFailure } = await import("../csrf");

    const req = {
      headers: {
        get: (name: string) => {
          if (name === "origin") return "https://evil-site.com";
          if (name === "referer") return "https://echoroom.app/page";
          return null;
        },
      },
    } as unknown as NextRequest;

    expect(() =>
      validateCSRF(req, { appUrl: "https://echoroom.app", allowMissingOrigin: true }),
    ).toThrow(CSRFFailure);
  });
});
