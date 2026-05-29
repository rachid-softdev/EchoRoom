import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// createCheckoutSession tests
// ---------------------------------------------------------------------------

const mockSessionsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockSessionsCreate,
      },
    },
  },
}));

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a checkout session with correct parameters", async () => {
    mockSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    const { createCheckoutSession } = await import("../stripe");

    const result = await createCheckoutSession({
      userId: "user-abc",
      credits: 50,
      priceId: "price_abc123",
      successUrl: "https://echoroom.app/billing/success",
      cancelUrl: "https://echoroom.app/billing/cancel",
    });

    expect(result).toEqual({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith({
      mode: "payment",
      line_items: [{ price: "price_abc123", quantity: 1 }],
      metadata: {
        userId: "user-abc",
        credits: "50",
      },
      success_url: "https://echoroom.app/billing/success",
      cancel_url: "https://echoroom.app/billing/cancel",
    });
  });

  it("should convert credits to string in metadata", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_test_456" });

    const { createCheckoutSession } = await import("../stripe");

    await createCheckoutSession({
      userId: "user-xyz",
      credits: 100,
      priceId: "price_xyz",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          userId: "user-xyz",
          credits: "100", // Must be string
        },
      }),
    );
  });

  it("should handle zero credits gracefully", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_test_zero" });

    const { createCheckoutSession } = await import("../stripe");

    await createCheckoutSession({
      userId: "user-zero",
      credits: 0,
      priceId: "price_zero",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          userId: "user-zero",
          credits: "0",
        },
      }),
    );
  });
});
