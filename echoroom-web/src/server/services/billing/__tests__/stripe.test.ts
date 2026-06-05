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

// Set price IDs that match the pricing config tiers
const STARTER_PRICE_ID = "price_tier_starter";
const PRO_PRICE_ID = "price_tier_pro";

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['STRIPE_PRICE_STARTER'] = STARTER_PRICE_ID;
    process.env['STRIPE_PRICE_PRO'] = PRO_PRICE_ID;
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
      priceId: STARTER_PRICE_ID,
      successUrl: "https://echoroom.app/billing/success",
      cancelUrl: "https://echoroom.app/billing/cancel",
    });

    expect(result).toEqual({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith({
      mode: "payment",
      line_items: [{ price: STARTER_PRICE_ID, quantity: 1 }],
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
      credits: 200,
      priceId: PRO_PRICE_ID,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          userId: "user-xyz",
          credits: "200", // Must be string
        },
      }),
    );
  });

  it("should reject an unknown priceId", async () => {
    const { createCheckoutSession } = await import("../stripe");

    await expect(
      createCheckoutSession({
        userId: "user-zero",
        credits: 10,
        priceId: "price_unknown",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("Identifiant de tarif inconnu : price_unknown");

    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });
});
