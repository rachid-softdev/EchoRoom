import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// tRPC client API object tests
// ---------------------------------------------------------------------------
// Tests for src/lib/trpc.ts which creates the tRPC React client with
// createTRPCReact<AppRouter>(). The exported `api` object should have the
// expected tRPC React Query methods (accessible via Proxy `get` trap).

describe("api — tRPC React client", () => {
  it("should export an api object with Provider method", async () => {
    const { api } = await import("../trpc");
    // tRPC v11 creates a Proxy for the root api object.
    // Root-level hooks like useQuery/useMutation are NOT on the root api;
    // they live on router paths (e.g. api.scenario.useQuery).
    // Only Provider, useUtils, and createClient are on the root object.
    expect(typeof api.Provider).toBe("function");
  });

  it("should export api with useUtils method (useContext renamed in v11)", async () => {
    const { api } = await import("../trpc");
    // tRPC v11 renamed useContext to useUtils
    expect(typeof api.useUtils).toBe("function");
  });

  it("should export api with createClient method", async () => {
    const { api } = await import("../trpc");
    expect(typeof api.createClient).toBe("function");
  });

  it("should support router-proxied hooks via api.<router>.useQuery", async () => {
    const { api } = await import("../trpc");
    // In tRPC v11, hooks are accessed through router proxies.
    // The api object is a Proxy — accessing any property returns a
    // nested proxy that has useQuery, useMutation etc.
    expect(api).toBeDefined();
    expect(typeof api.scenario?.useQuery).toBe("function");
  });

  it("should support router-proxied useMutation", async () => {
    const { api } = await import("../trpc");
    expect(typeof api.scenario?.useMutation).toBe("function");
  });
});
