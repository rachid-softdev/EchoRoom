import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// RequestContext — AsyncLocalStorage context tests
// ---------------------------------------------------------------------------
// Tests for requestContext.ts:
//   - runWithContext stores and retrieves context via getRequestContext
//   - getRequestId returns stored requestId inside context
//   - getRequestId returns "no-request-id" outside context
//   - getRequestContext returns undefined outside context
//   - Context is isolated per async operation (no cross-contamination)
//   - Nested runWithContext — inner overrides outer

describe("runWithContext and getRequestContext", () => {
  it("should store and retrieve context via getRequestContext", async () => {
    const { runWithContext, getRequestContext } = await import("../requestContext");

    const result = await runWithContext(
      { requestId: "req-123", userId: "user-1", source: "tRPC" },
      async () => {
        return getRequestContext();
      },
    );

    expect(result).toEqual({
      requestId: "req-123",
      userId: "user-1",
      source: "tRPC",
    });
  });

  it("should return undefined outside of any context", async () => {
    const { getRequestContext } = await import("../requestContext");

    const ctx = getRequestContext();
    expect(ctx).toBeUndefined();
  });
});

describe("getRequestId", () => {
  it("should return stored requestId inside context", async () => {
    const { runWithContext, getRequestId } = await import("../requestContext");

    const result = await runWithContext(
      { requestId: "abc-456" },
      async () => getRequestId(),
    );

    expect(result).toBe("abc-456");
  });

  it('should return "no-request-id" outside context', async () => {
    const { getRequestId } = await import("../requestContext");

    const id = getRequestId();
    expect(id).toBe("no-request-id");
  });

  it("should return 'no-request-id' when context exists but has no requestId", async () => {
    const { runWithContext, getRequestId } = await import("../requestContext");

    const result = await runWithContext(
      {} as any,
      async () => getRequestId(),
    );

    expect(result).toBe("no-request-id");
  });
});

describe("context isolation", () => {
  it("should isolate context per async operation (no cross-contamination)", async () => {
    const { runWithContext, getRequestContext, getRequestId } = await import("../requestContext");

    // Start two concurrent operations with different contexts
    const [result1, result2] = await Promise.all([
      runWithContext({ requestId: "req-a" }, async () => {
        // Simulate some async work
        await new Promise((r) => setTimeout(r, 10));
        return { id: getRequestId(), ctx: getRequestContext() };
      }),
      runWithContext({ requestId: "req-b" }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { id: getRequestId(), ctx: getRequestContext() };
      }),
    ]);

    expect(result1.id).toBe("req-a");
    expect(result2.id).toBe("req-b");
    expect(result1.ctx?.requestId).toBe("req-a");
    expect(result2.ctx?.requestId).toBe("req-b");
  });

  it("should restore outer context after inner context completes", async () => {
    const { runWithContext, getRequestContext } = await import("../requestContext");

    const result = await runWithContext(
      { requestId: "outer" },
      async () => {
        const outerCtx = getRequestContext();

        // Create inner context
        const innerResult = await runWithContext(
          { requestId: "inner" },
          async () => {
            return getRequestContext()?.requestId;
          },
        );

        // After inner completes, verify outer is restored
        const afterInner = getRequestContext()?.requestId;

        return { outerCtx: outerCtx?.requestId, innerResult, afterInner };
      },
    );

    expect(result.outerCtx).toBe("outer");
    expect(result.innerResult).toBe("inner");
    expect(result.afterInner).toBe("outer");
  });

  it("should allow nested context to access outer fields via closure", async () => {
    const { runWithContext, getRequestContext } = await import("../requestContext");

    const result = await runWithContext(
      { requestId: "parent", userId: "user-1" },
      async () => {
        return runWithContext(
          { requestId: "child" },
          async () => {
            // Inner context overrides requestId but userId is lost (not inherited)
            return getRequestContext();
          },
        );
      },
    );

    // The inner context is a new object — it does not inherit outer properties
    expect(result?.requestId).toBe("child");
    expect((result as any)?.userId).toBeUndefined();
  });
});

describe("runWithContext type safety", () => {
  it("should return the promise result type T", async () => {
    const { runWithContext } = await import("../requestContext");

    const strResult = await runWithContext(
      { requestId: "test" },
      async () => "hello" as const,
    );
    expect(strResult).toBe("hello");

    const numResult = await runWithContext(
      { requestId: "test" },
      async () => 42,
    );
    expect(numResult).toBe(42);
  });
});
