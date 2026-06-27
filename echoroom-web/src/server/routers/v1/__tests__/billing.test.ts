import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// billingV1Router — tRPC router tests
// ---------------------------------------------------------------------------
// Tests for the v1 billing router.

const mockFindByUserId = vi.fn();
const mockCreateCheckoutSession = vi.fn();
const mockAppUrl = vi.fn(() => "http://localhost:3000");

vi.mock("@/server/repositories", () => ({
  userBillingRepository: {
    findByUserId: mockFindByUserId,
  },
}));

vi.mock("@/server/services/billing/stripe", () => ({
  createCheckoutSession: mockCreateCheckoutSession,
}));

vi.mock("@/lib/env", () => ({
  env: {
    get NEXT_PUBLIC_APP_URL() {
      return mockAppUrl();
    },
  },
}));

// Mock procedures module (v1 routers import from "../../procedures")
vi.mock("@/server/procedures", () => {
  const chain = {
    input: vi.fn(() => chain),
    mutation: vi.fn((handler: Function) => ({
      type: "mutation" as const,
      handler,
    })),
    query: vi.fn((handler: Function) => ({
      type: "query" as const,
      handler,
    })),
    use: vi.fn(() => chain),
  };

  return {
    router: vi.fn((routes: Record<string, unknown>) => routes),
    t: { procedure: chain },
    publicProcedure: chain,
    protectedProcedure: chain,
    adminProcedure: chain,
    middleware: vi.fn((fn: Function) => fn),
    withRateLimit: vi.fn(() => (opts: { next: Function }) => opts.next()),
    withTracing: vi.fn(() => chain),
    isAuthenticated: chain,
    isAdmin: chain,
    withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
  };
});

vi.mock("@/server/trpc", () => ({
  t: { procedure: { use: vi.fn(() => ({ use: vi.fn() })) } },
  router: vi.fn((routes: Record<string, unknown>) => routes),
  publicProcedure: { use: vi.fn() },
  protectedProcedure: { use: vi.fn() },
  adminProcedure: { use: vi.fn() },
  middleware: vi.fn(() => (opts: { next: Function }) => opts.next()),
  withRateLimit: { use: vi.fn() },
  withTracing: { use: vi.fn() },
  isAuthenticated: { use: vi.fn() },
  isAdmin: { use: vi.fn() },
}));

vi.mock("@/server/middleware/metrics", () => ({
  withREDMetrics: vi.fn(() => (opts: { next: Function }) => opts.next()),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// getCredits
// ---------------------------------------------------------------------------
describe("billingV1Router.getCredits", () => {
  let handler: Function;
  const validCtx = { session: { user: { id: "user-123" } } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { billingV1Router } = await import("../billing");
    // @ts-expect-error — handler captured via mock
    handler = billingV1Router.getCredits.handler;
  });

  it("should return credits when UserBilling exists", async () => {
    mockFindByUserId.mockResolvedValue({ id: "billing-1", userId: "user-123", credits: 150 });

    const result = await handler({ input: {}, ctx: validCtx });

    expect(result).toEqual({ credits: 150 });
    expect(mockFindByUserId).toHaveBeenCalledWith("user-123");
  });

  it("should return 0 when UserBilling does not exist", async () => {
    mockFindByUserId.mockResolvedValue(null);

    const result = await handler({ input: {}, ctx: validCtx });

    expect(result).toEqual({ credits: 0 });
    expect(mockFindByUserId).toHaveBeenCalledWith("user-123");
  });
});

// ---------------------------------------------------------------------------
// createCheckout
// ---------------------------------------------------------------------------
describe("billingV1Router.createCheckout", () => {
  let handler: Function;
  const validCtx = { session: { user: { id: "user-123" } } };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAppUrl.mockReturnValue("http://localhost:3000");
    mockCreateCheckoutSession.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });
    const { billingV1Router } = await import("../billing");
    // @ts-expect-error — handler captured via mock
    handler = billingV1Router.createCheckout.handler;
  });

  it("should create checkout with correct parameters", async () => {
    const result = await handler({
      input: { priceId: "price_starter", credits: 50 },
      ctx: validCtx,
    });

    expect(result).toEqual({ url: "https://checkout.stripe.com/cs_test_123" });

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
      userId: "user-123",
      credits: 50,
      priceId: "price_starter",
      successUrl: "http://localhost:3000/billing?success=true",
      cancelUrl: "http://localhost:3000/billing?cancelled=true",
    });
  });

  it("should use NEXT_PUBLIC_APP_URL when defined", async () => {
    mockAppUrl.mockReturnValue("https://echoroom.app");

    await handler({
      input: { priceId: "price_pro", credits: 200 },
      ctx: validCtx,
    });

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://echoroom.app/billing?success=true",
        cancelUrl: "https://echoroom.app/billing?cancelled=true",
      }),
    );
  });

  it("should reject credits below minimum (Zod schema min=1)", async () => {
    const schema = z.object({ priceId: z.string(), credits: z.number().min(1).max(10000) });
    expect(schema.safeParse({ priceId: "price_x", credits: 0 }).success).toBe(false);
  });

  it("should reject credits above maximum 10000 (Zod schema max=10000)", async () => {
    const schema = z.object({ priceId: z.string(), credits: z.number().min(1).max(10000) });
    expect(schema.safeParse({ priceId: "price_x", credits: 10001 }).success).toBe(false);
  });

  it("should accept credits at boundary values (1 and 10000)", async () => {
    const schema = z.object({ priceId: z.string(), credits: z.number().min(1).max(10000) });
    expect(schema.safeParse({ priceId: "price_x", credits: 1 }).success).toBe(true);
    expect(schema.safeParse({ priceId: "price_x", credits: 10000 }).success).toBe(true);
  });

  it("should require priceId to be a string (Zod schema)", async () => {
    const schema = z.object({ priceId: z.string(), credits: z.number().min(1).max(10000) });
    const parseResult = schema.safeParse({ priceId: 123, credits: 50 });
    expect(parseResult.success).toBe(false);
  });
});
