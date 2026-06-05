import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// createLogger tests
// ---------------------------------------------------------------------------
// Tests for the structured JSON logger that writes to stdout/stderr.
// Mocks process.stdout.write and process.stderr.write to capture output.
// Mocks process.env['NODE_ENV'] to test environment-dependent behavior.

describe("createLogger", () => {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalEnv = process.env['NODE_ENV'];

  let stdoutMock: ReturnType<typeof vi.fn>;
  let stderrMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stdoutMock = vi.fn();
    stderrMock = vi.fn();
    process.stdout.write = stdoutMock;
    process.stderr.write = stderrMock;
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    // @ts-expect-error — vitest allows env mutation in test scope
    process.env['NODE_ENV'] = originalEnv;
    vi.restoreAllMocks();
  });

  // ---- Basic API ----

  it("should return an object with debug/info/warn/error methods", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("test-module");

    expect(log).toHaveProperty("debug");
    expect(typeof log.debug).toBe("function");
    expect(log).toHaveProperty("info");
    expect(typeof log.info).toBe("function");
    expect(log).toHaveProperty("warn");
    expect(typeof log.warn).toBe("function");
    expect(log).toHaveProperty("error");
    expect(typeof log.error).toBe("function");
  });

  // ---- stdout/stderr routing ----

  it("should write info-level entries to stdout as JSON", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("my-module");

    log.info("Hello world");

    expect(stdoutMock).toHaveBeenCalledTimes(1);
    const written = stdoutMock.mock.calls[0]![0];
    const parsed = JSON.parse(written);
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("level", "info");
    expect(parsed).toHaveProperty("module", "my-module");
    expect(parsed).toHaveProperty("message", "Hello world");
  });

  it("should write error-level entries to stderr as JSON", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("err-module");

    log.error("Something failed");

    expect(stderrMock).toHaveBeenCalledTimes(1);
    const written = stderrMock.mock.calls[0]![0];
    const parsed = JSON.parse(written);
    expect(parsed).toHaveProperty("level", "error");
    expect(parsed).toHaveProperty("module", "err-module");
    expect(parsed).toHaveProperty("message", "Something failed");
  });

  it("should write warn-level entries to stdout (not stderr)", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("warn-module");

    log.warn("Caution");

    expect(stdoutMock).toHaveBeenCalledTimes(1);
    expect(stderrMock).not.toHaveBeenCalled();
  });

  it("should write debug-level entries to stdout in development", async () => {
    // @ts-expect-error — vitest allows env mutation in test scope
    process.env['NODE_ENV'] = "development";
    // Clear mocks after env change — the module caches nothing, it reads env each time
    stdoutMock.mockClear();

    const { createLogger } = await import("../logger");
    const log = createLogger("debug-module");

    log.debug("Debug message");

    expect(stdoutMock).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).toHaveProperty("level", "debug");
  });

  // ---- Debug suppression in non-development ----

  it("should suppress debug output when NODE_ENV is not development", async () => {
    // @ts-expect-error — vitest allows env mutation in test scope
    process.env['NODE_ENV'] = "production";
    stdoutMock.mockClear();

    const { createLogger } = await import("../logger");
    const log = createLogger("prod-module");

    log.debug("Should not appear");
    expect(stdoutMock).not.toHaveBeenCalled();
  });

  it("should suppress debug output when NODE_ENV is undefined", async () => {
    // @ts-expect-error — vitest allows env mutation in test scope
    delete process.env['NODE_ENV'];
    stdoutMock.mockClear();

    const { createLogger } = await import("../logger");
    const log = createLogger("no-env");

    log.debug("Should not appear");
    expect(stdoutMock).not.toHaveBeenCalled();
  });

  it("should still output info in production", async () => {
    // @ts-expect-error — vitest allows env mutation in test scope
    process.env['NODE_ENV'] = "production";
    stdoutMock.mockClear();

    const { createLogger } = await import("../logger");
    const log = createLogger("prod-module");

    log.info("Info should appear");
    expect(stdoutMock).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).toHaveProperty("level", "info");
  });

  it("should still output error in production", async () => {
    // @ts-expect-error — vitest allows env mutation in test scope
    process.env['NODE_ENV'] = "production";
    stderrMock.mockClear();

    const { createLogger } = await import("../logger");
    const log = createLogger("prod-module");

    log.error("Error should appear");
    expect(stderrMock).toHaveBeenCalledTimes(1);
  });

  // ---- Module names ----

  it("should include the module name in the log output", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("my-custom-module");

    log.info("Test");
    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).toHaveProperty("module", "my-custom-module");
  });

  it("should use empty string module name if passed empty string", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("");

    log.info("Test");
    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).toHaveProperty("module", "");
  });

  // ---- Meta serialization ----

  it("should serialize meta object in the log entry", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("meta-module");

    log.info("With meta", { userId: "abc123", count: 42 });

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).toHaveProperty("meta");
    expect(parsed.meta).toEqual({ userId: "abc123", count: 42 });
  });

  it("should omit meta key when no meta is passed", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("no-meta");

    log.info("Plain message");

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).not.toHaveProperty("meta");
  });

  it("should serialize undefined meta as undefined (omit from output)", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("undef-meta");

    log.info("No meta", undefined);

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).not.toHaveProperty("meta");
  });

  // ---- Error serialization ----

  it("should serialize Error objects with name and message", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("err-serial");

    const error = new Error("Something broke");
    log.error("Failed", { error });

    const parsed = JSON.parse(stderrMock.mock.calls[0]![0]);
    expect(parsed.meta.error).toHaveProperty("name", "Error");
    expect(parsed.meta.error).toHaveProperty("message", "Something broke");
  });

  it("should include stack trace in development mode", async () => {
    // @ts-expect-error — vitest allows env mutation in test scope
    process.env['NODE_ENV'] = "development";
    stderrMock.mockClear();

    const { createLogger } = await import("../logger");
    const log = createLogger("stack-dev");

    const error = new Error("Dev error");
    log.error("Failed", { error });

    const parsed = JSON.parse(stderrMock.mock.calls[0]![0]);
    expect(parsed.meta.error).toHaveProperty("stack");
    expect(typeof parsed.meta.error.stack).toBe("string");
  });

  it("should omit stack trace in production mode", async () => {
    // @ts-expect-error — vitest allows env mutation in test scope
    process.env['NODE_ENV'] = "production";
    stderrMock.mockClear();

    const { createLogger } = await import("../logger");
    const log = createLogger("stack-prod");

    const error = new Error("Prod error");
    log.error("Failed", { error });

    const parsed = JSON.parse(stderrMock.mock.calls[0]![0]);
    expect(parsed.meta.error).not.toHaveProperty("stack");
  });

  it("should serialize custom properties on Error objects", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("custom-err");

    // AppError-like custom error with code property
    const customError = new Error("Custom failure");
    (customError as unknown as Record<string, unknown>)["code"] = "SCENARIO_NOT_FOUND";
    (customError as unknown as Record<string, unknown>)["statusCode"] = 404;

    log.error("Request failed", { error: customError });

    const parsed = JSON.parse(stderrMock.mock.calls[0]![0]);
    expect(parsed.meta.error).toHaveProperty("name", "Error");
    expect(parsed.meta.error).toHaveProperty("message", "Custom failure");
    expect(parsed.meta.error).toHaveProperty("code", "SCENARIO_NOT_FOUND");
    expect(parsed.meta.error).toHaveProperty("statusCode", 404);
  });

  it("should serialize nested Error objects", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("nested-err");

    const inner = new Error("Inner error");
    const outer = new Error("Outer error");
    (outer as unknown as Record<string, unknown>)["cause"] = inner;

    log.error("Nested", { error: outer });

    const parsed = JSON.parse(stderrMock.mock.calls[0]![0]);
    expect(parsed.meta.error).toHaveProperty("name", "Error");
    expect(parsed.meta.error).toHaveProperty("message", "Outer error");
    // 'cause' is an Error — it should be serialized too (as a plain object or Error)
    // The logger's serializeValue only handles top-level Error specially,
    // but nested objects are passed through JSON.stringify which calls toString on Errors
    expect(parsed.meta.error).toHaveProperty("cause");
  });

  // ---- Request/Response serialization ----

  it("should serialize Request objects as [Request]", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("req-serial");

    // Create a minimal Request-like object
    const req = new Request("https://example.com");
    log.info("Request received", { req });

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed.meta.req).toBe("[Request]");
  });

  it("should serialize Response objects as [Response]", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("res-serial");

    const res = new Response("ok");
    log.info("Response sent", { res });

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed.meta.res).toBe("[Response]");
  });

  // ---- Timestamp ----

  it("should include a valid ISO 8601 timestamp", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("ts-module");

    log.info("Time check");

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed).toHaveProperty("timestamp");
    const ts = parsed.timestamp;
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  // ---- Multiple messages ----

  it("should handle multiple sequential log entries", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("multi");

    log.info("First");
    log.warn("Second");
    log.error("Third");

    expect(stdoutMock).toHaveBeenCalledTimes(2); // info + warn
    expect(stderrMock).toHaveBeenCalledTimes(1); // error

    const first = JSON.parse(stdoutMock.mock.calls[0]![0]);
    const second = JSON.parse(stdoutMock.mock.calls[1]![0]);
    const third = JSON.parse(stderrMock.mock.calls[0]![0]);

    expect(first.message).toBe("First");
    expect(second.message).toBe("Second");
    expect(third.message).toBe("Third");
  });

  // ---- Null/undefined meta values ----

  it("should handle null meta values", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("null-meta");

    log.info("Null meta", { key: null, num: 0, flag: false });

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed.meta).toEqual({ key: null, num: 0, flag: false });
  });

  it("should handle empty meta object", async () => {
    const { createLogger } = await import("../logger");
    const log = createLogger("empty-meta");

    log.info("Empty meta", {});

    const parsed = JSON.parse(stdoutMock.mock.calls[0]![0]);
    expect(parsed.meta).toEqual({});
  });
});
