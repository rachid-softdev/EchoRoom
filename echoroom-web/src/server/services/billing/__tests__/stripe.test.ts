import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Set price IDs that match the pricing config tiers (resolved via env).
const STARTER_PRICE_ID = "price_tier_starter";
const PRO_PRICE_ID = "price_tier_pro";

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_PRICE_STARTER"] = STARTER_PRICE_ID;
    process.env["STRIPE_PRICE_PRO"] = PRO_PRICE_ID;
  });

  it("should create a subscription-mode checkout session with correct parameters", async () => {
    mockSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    const { createCheckoutSession } = await import("../stripe");

    const result = await createCheckoutSession({
      userId: "user-abc",
      tier: "starter",
      successUrl: "https://echoroom.app/billing/success",
      cancelUrl: "https://echoroom.app/billing/cancel",
    });

    expect(result).toEqual({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: STARTER_PRICE_ID, quantity: 1 }],
      client_reference_id: "user-abc",
      subscription_data: { metadata: { userId: "user-abc" } },
      success_url: "https://echoroom.app/billing/success",
      cancel_url: "https://echoroom.app/billing/cancel",
    });
  });

  it("should propagate userId via client_reference_id and subscription metadata", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_test_456" });

    const { createCheckoutSession } = await import("../stripe");

    await createCheckoutSession({
      userId: "user-xyz",
      tier: "pro",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        client_reference_id: "user-xyz",
        subscription_data: { metadata: { userId: "user-xyz" } },
      }),
    );
  });

  it("should reject a tier without a purchasable price (free)", async () => {
    const { createCheckoutSession } = await import("../stripe");

    await expect(
      createCheckoutSession({
        userId: "user-zero",
        tier: "free",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("Aucun prix Stripe configuré pour le palier free");

    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });
});
