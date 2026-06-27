import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// NextAuth Route Handler tests
// ---------------------------------------------------------------------------
// [...nextauth]/route.ts re-exports GET and POST from the auth handlers.
// Since next-auth internals are complex to test in isolation, we verify:
//   - The handlers object is imported from @/lib/auth
//   - GET and POST are destructured from handlers
//   - They are functions

const mockHandlers = {
  GET: vi.fn(),
  POST: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  handlers: mockHandlers,
}));

describe("NextAuth Route Handler ([...nextauth]/route.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports GET from handlers.GET", async () => {
    const route = await import("../route");

    expect(route.GET).toBeDefined();
    expect(typeof route.GET).toBe("function");
  });

  it("exports POST from handlers.POST", async () => {
    const route = await import("../route");

    expect(route.POST).toBeDefined();
    expect(typeof route.POST).toBe("function");
  });

  it("GET and POST are different functions (from handlers.GET and handlers.POST)", async () => {
    const route = await import("../route");

    expect(route.GET).not.toBe(route.POST);
  });

  it("calling GET delegates to handlers.GET", async () => {
    mockHandlers.GET.mockResolvedValue(new Response("ok", { status: 200 }));

    const { GET } = await import("../route");
    const req = new Request("http://localhost:3000/api/auth/session") as unknown as NextRequest;
    const response = await GET(req);

    expect(mockHandlers.GET).toHaveBeenCalledWith(req);
    expect(response.status).toBe(200);
  });

  it("calling POST delegates to handlers.POST", async () => {
    mockHandlers.POST.mockResolvedValue(new Response("created", { status: 201 }));

    const { POST } = await import("../route");
    const req = new Request("http://localhost:3000/api/auth/session", { method: "POST" }) as unknown as NextRequest;
    const response = await POST(req);

    expect(mockHandlers.POST).toHaveBeenCalledWith(req);
    expect(response.status).toBe(201);
  });

  it("passes through errors from handlers.GET", async () => {
    mockHandlers.GET.mockRejectedValue(new Error("Auth error"));

    const { GET } = await import("../route");
    const req = new Request("http://localhost:3000/api/auth/session");

    await expect(GET(req as unknown as NextRequest)).rejects.toThrow("Auth error");
  });
});
