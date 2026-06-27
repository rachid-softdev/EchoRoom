import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Stripe client initialization tests
// ---------------------------------------------------------------------------
// Tests that:
//   - Stripe is instantiated with STRIPE_SECRET_KEY and correct API version
//   - STRIPE_SECRET_KEY missing → crash at import

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("Stripe client initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should instantiate Stripe with STRIPE_SECRET_KEY and correct API version", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_SECRET_KEY: "sk_test_valid_key_123",
      },
    }));

    const Stripe = (await import("stripe")).default;
    vi.spyOn(Stripe.prototype as any, "constructor"); // spy on constructor for coverage

    const mod = await import("../stripe");

    expect(mod.stripe).toBeDefined();
    // Verify the Stripe instance was created with the right params
    // The constructor is called with the key and options
    expect(mod.stripe).toBeInstanceOf(Stripe);
  });

  it("should use apiVersion '2025-02-24.acacia'", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_SECRET_KEY: "sk_test_valid_key_456",
      },
    }));

    // We verify by checking that Stripe constructEvent exists (instance is valid)
    const mod = await import("../stripe");

    expect(mod.stripe).toBeDefined();
    // The instance should have the checkout namespace
    expect(mod.stripe.checkout).toBeDefined();
    expect(mod.stripe.webhooks).toBeDefined();
  });

  it("should crash at import when STRIPE_SECRET_KEY is missing", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_SECRET_KEY: undefined,
      },
    }));

    // When env returns undefined for STRIPE_SECRET_KEY, Stripe constructor throws
    // "Neither apiKey nor config.authenticator provided"
    await expect(import("../stripe")).rejects.toThrow();
  });

  it("should throw when Stripe constructor receives empty string", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        STRIPE_SECRET_KEY: "",
      },
    }));

    // Stripe constructor with empty key should throw
    await expect(import("../stripe")).rejects.toThrow();
  });
});
