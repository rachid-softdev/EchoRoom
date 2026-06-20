import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// SSRF Protection — Twilio URL validation tests
// ---------------------------------------------------------------------------
// Tests for ssrf.ts:
//   - isAllowedTwilioOrigin: validates hostname, protocol, formatting
//   - validateRecordingUrl: validates full Twilio recording URL structure

describe("isAllowedTwilioOrigin", () => {
  it("should accept valid Twilio subdomains with https", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("https://api.twilio.com")).toBe(true);
    expect(isAllowedTwilioOrigin("https://monitor.twilio.com")).toBe(true);
    expect(isAllowedTwilioOrigin("https://recordings.twilio.com")).toBe(true);
    expect(isAllowedTwilioOrigin("https://voice.twilio.com")).toBe(true);
    expect(isAllowedTwilioOrigin("https://comms.twilio.com")).toBe(true);
  });

  it("should accept subdomains with hyphens and numbers", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("https://api-123.twilio.com")).toBe(true);
    expect(isAllowedTwilioOrigin("https://my-service-2.twilio.com")).toBe(true);
    // Nested subdomains (e.g. v1.api.twilio.com) do not match the
    // /^[a-z0-9-]+\.twilio\.com$/i pattern because the subdomain part
    // ("v1.api") contains a '.' character that is not in the character class.
    expect(isAllowedTwilioOrigin("https://v1.api.twilio.com")).toBe(false);
  });

  it("should reject non-HTTPS URLs", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("http://api.twilio.com")).toBe(false);
    expect(isAllowedTwilioOrigin("ftp://api.twilio.com")).toBe(false);
    expect(isAllowedTwilioOrigin("ws://api.twilio.com")).toBe(false);
  });

  it("should reject non-Twilio hosts", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("https://api.google.com")).toBe(false);
    expect(isAllowedTwilioOrigin("https://evil.com")).toBe(false);
    expect(isAllowedTwilioOrigin("https://twilio.com.evil.com")).toBe(false);
    expect(isAllowedTwilioOrigin("https://twilio-malicious.com")).toBe(false);
  });

  it("should reject malformed URLs", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("not-a-url")).toBe(false);
    expect(isAllowedTwilioOrigin("")).toBe(false);
    expect(isAllowedTwilioOrigin("   ")).toBe(false);
  });

  it("should handle case-insensitive hostname matching", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("https://API.TWILIO.COM")).toBe(true);
    expect(isAllowedTwilioOrigin("https://Api.Twilio.Com")).toBe(true);
    expect(isAllowedTwilioOrigin("https://RECORDINGS.TWILIO.COM")).toBe(true);
  });

  it("should reject bare twilio.com (no subdomain) and accept www.twilio.com", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("https://twilio.com")).toBe(false);
    // www.twilio.com matches /^[a-z0-9-]+\.twilio\.com$/i since "www" is all [a-z]
    expect(isAllowedTwilioOrigin("https://www.twilio.com")).toBe(true);
  });

  it("should accept URLs with user info (hostname is still validated)", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    // User-info (user:pass@) is stripped by the URL parser when extracting
    // hostname. The function only validates protocol + hostname, so
    // URLs with user info that point to a valid Twilio hostname are accepted.
    expect(isAllowedTwilioOrigin("https://user:pass@api.twilio.com")).toBe(true);

    // Fragments are also stripped by the URL parser — only hostname matters.
    expect(isAllowedTwilioOrigin("https://api.twilio.com/#fragment")).toBe(true);
  });

  it("should reject non-HTTP schemes even if pointing to twilio", async () => {
    const { isAllowedTwilioOrigin } = await import("../ssrf");

    expect(isAllowedTwilioOrigin("file://api.twilio.com/etc/passwd")).toBe(false);
    expect(isAllowedTwilioOrigin("ftp://api.twilio.com/file")).toBe(false);
    expect(isAllowedTwilioOrigin("gopher://api.twilio.com/")).toBe(false);
  });
});

describe("validateRecordingUrl", () => {
  it("should accept valid Twilio recording URL with correct path structure", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    const valid = "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456";
    expect(validateRecordingUrl(valid)).toBe(true);
  });

  it("should accept recording URL with additional path segments", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    const url = "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456/extra";
    expect(validateRecordingUrl(url)).toBe(true);
  });

  it("should reject non-Twilio hosts", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    expect(validateRecordingUrl("https://evil.com/2010-04-01/Accounts/AC123/Recordings/RE456")).toBe(false);
    expect(validateRecordingUrl("https://twilio.com.evil.com/2010-04-01/Accounts/AC123/Recordings/RE456")).toBe(false);
  });

  it("should reject wrong path structure (no /2010-04-01/Accounts/)", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    expect(validateRecordingUrl("https://api.twilio.com/wrong/Accounts/AC123/Recordings/RE456")).toBe(false);
    expect(validateRecordingUrl("https://api.twilio.com/2010-04-01/Users/AC123/Recordings/RE456")).toBe(false);
    expect(validateRecordingUrl("https://api.twilio.com/2010-04-01/Accounts/AC123/Calls/RE456")).toBe(false);
  });

  it("should reject missing /Recordings/ in path", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    expect(validateRecordingUrl("https://api.twilio.com/2010-04-01/Accounts/AC123")).toBe(false);
  });

  it("should reject empty string", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    expect(validateRecordingUrl("")).toBe(false);
  });

  it("should reject HTTP (non-HTTPS) even with correct path", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    expect(validateRecordingUrl("http://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE456")).toBe(false);
  });

  it("should accept recording URLs with hyphens in Account SID and Recording SID", async () => {
    const { validateRecordingUrl } = await import("../ssrf");

    const url = "https://api.twilio.com/2010-04-01/Accounts/ACxxx-yyy/Recordings/REaaa-bbb";
    expect(validateRecordingUrl(url)).toBe(true);
  });
});
