import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// tRPC API Route tests
// ---------------------------------------------------------------------------
// The handler (exported as GET and POST) for /api/trpc/[trpc]:
//   - Routes unversioned requests to appRouter
//   - x-api-version: v2 routes to appRouterV2
//   - createTRPCContext called with req and apiVersion
//   - onError logs in development
//   - onError does NOT log in production
//   - Both GET and POST are exported as same handler

const mockFetchRequestHandler = vi.fn();
const mockResolveApiVersion = vi.fn();
const mockCreateTRPCContext = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@trpc/server/adapters/fetch", () => ({
  fetchRequestHandler: mockFetchRequestHandler,
}));

vi.mock("@/server/middleware/apiVersion", () => ({
  resolveApiVersion: mockResolveApiVersion,
}));

vi.mock("@/server/trpc", () => ({
  createTRPCContext: mockCreateTRPCContext,
}));

vi.mock("@/server/rootRouter", () => ({
  appRouter: { _mock: "appRouterV1" },
}));

vi.mock("@/server/rootRouterV2", () => ({
  appRouterV2: { _mock: "appRouterV2" },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: mockLoggerError,
    warn: vi.fn(),
  })),
}));

function createMockRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    nextUrl: {
      pathname: "/api/trpc/test.procedure",
    },
    method: "POST",
  } as unknown as NextRequest;
}

describe("tRPC handler (GET/POST /api/trpc/[trpc])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRequestHandler.mockReturnValue(new Response("ok", { status: 200 }));
  });

  // -----------------------------------------------------------------------
  // Router selection
  // -----------------------------------------------------------------------

  it("should route unversioned requests to appRouter", async () => {
    mockResolveApiVersion.mockReturnValue("latest");

    const { GET } = await import("../route");
    const req = createMockRequest({});
    await GET(req);

    expect(mockFetchRequestHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/trpc",
        router: { _mock: "appRouterV1" },
      }),
    );
  });

  it("should route x-api-version: v2 requests to appRouterV2", async () => {
    mockResolveApiVersion.mockReturnValue("v2");

    const { GET } = await import("../route");
    const req = createMockRequest({ "x-api-version": "v2" });
    await GET(req);

    expect(mockFetchRequestHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/trpc",
        router: { _mock: "appRouterV2" },
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Context creation
  // -----------------------------------------------------------------------

  it("should call createTRPCContext with req and apiVersion", async () => {
    mockResolveApiVersion.mockReturnValue("v2");
    mockCreateTRPCContext.mockReturnValue({ user: null });

    const { GET } = await import("../route");
    const req = createMockRequest({ "x-api-version": "v2" });
    await GET(req);

    // The createContext factory should invoke createTRPCContext
    const callArgs = mockFetchRequestHandler.mock.calls[0]![0]!;
    const createContextFn = callArgs.createContext as () => any;

    const context = await createContextFn();
    expect(mockCreateTRPCContext).toHaveBeenCalledWith({
      req,
      apiVersion: "v2",
    });
    expect(context).toEqual({ user: null });
  });

  it("should pass latest apiVersion to createTRPCContext for unversioned requests", async () => {
    mockResolveApiVersion.mockReturnValue("latest");
    mockCreateTRPCContext.mockReturnValue({ user: { id: "user-1" } });

    const { GET } = await import("../route");
    const req = createMockRequest({});
    await GET(req);

    const callArgs = mockFetchRequestHandler.mock.calls[0]![0]!;
    const createContextFn = callArgs.createContext as () => any;
    await createContextFn();

    expect(mockCreateTRPCContext).toHaveBeenCalledWith({
      req,
      apiVersion: "latest",
    });
  });

  // -----------------------------------------------------------------------
  // onError behavior
  // -----------------------------------------------------------------------

  it("should log error in development environment", async () => {
    const originalNodeEnv = (process.env as any).NODE_ENV;
    (process.env as any).NODE_ENV = "development";
    mockResolveApiVersion.mockReturnValue("latest");

    const { GET } = await import("../route");
    const req = createMockRequest({});
    await GET(req);

    // Extract the onError callback and invoke it
    const callArgs = mockFetchRequestHandler.mock.calls[0]![0]!;
    const onError = callArgs.onError as (opts: any) => void;

    onError({
      path: "test.procedure",
      error: { message: "Something failed" },
    });

    expect(mockLoggerError).toHaveBeenCalledWith("tRPC failed", {
      path: "test.procedure",
      version: "latest",
      message: "Something failed",
    });

    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("should NOT log error in production environment", async () => {
    const originalNodeEnv = (process.env as any).NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    mockResolveApiVersion.mockReturnValue("latest");

    const { GET } = await import("../route");
    const req = createMockRequest({});
    await GET(req);

    const callArgs = mockFetchRequestHandler.mock.calls[0]![0]!;
    const onError = callArgs.onError as (opts: any) => void;

    onError({
      path: "test.procedure",
      error: { message: "Something failed" },
    });

    expect(mockLoggerError).not.toHaveBeenCalled();

    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("should handle onError with null path gracefully", async () => {
    const originalNodeEnv = (process.env as any).NODE_ENV;
    (process.env as any).NODE_ENV = "development";
    mockResolveApiVersion.mockReturnValue("latest");

    const { GET } = await import("../route");
    const req = createMockRequest({});
    await GET(req);

    const callArgs = mockFetchRequestHandler.mock.calls[0]![0]!;
    const onError = callArgs.onError as (opts: any) => void;

    onError({
      path: null,
      error: { message: "No path error" },
    });

    expect(mockLoggerError).toHaveBeenCalledWith("tRPC failed", {
      path: "<no-path>",
      version: "latest",
      message: "No path error",
    });

    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  // -----------------------------------------------------------------------
  // GET and POST exports
  // -----------------------------------------------------------------------

  it("should export both GET and POST as the same handler (same response)", async () => {
    mockResolveApiVersion.mockReturnValue("latest");

    const route = await import("../route");
    const req = createMockRequest({});

    // Both should resolve to the same function reference
    expect(route.GET).toBe(route.POST);

    // Both should produce the same response
    const getResponse = await route.GET(req);
    const postResponse = await route.POST(req);

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Endpoint configuration
  // -----------------------------------------------------------------------

  it("should use /api/trpc as the endpoint", async () => {
    mockResolveApiVersion.mockReturnValue("latest");

    const { GET } = await import("../route");
    const req = createMockRequest({});
    await GET(req);

    expect(mockFetchRequestHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/trpc",
      }),
    );
  });

  it("should return the response from fetchRequestHandler", async () => {
    mockResolveApiVersion.mockReturnValue("latest");
    const expectedResponse = new Response("custom response", { status: 201 });
    mockFetchRequestHandler.mockReturnValue(expectedResponse);

    const { GET } = await import("../route");
    const req = createMockRequest({});
    const response = await GET(req);

    expect(response.status).toBe(201);
    const text = await response.text();
    expect(text).toBe("custom response");
  });
});
