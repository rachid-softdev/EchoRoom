import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Stripe Webhook Route tests
// ---------------------------------------------------------------------------
// The webhook handler (POST /api/webhooks/stripe):
//   1. Verifies Stripe signature
//   2. Idempotency: skips duplicate checkout.session.completed events
//   3. Processes new events atomically (add credits + create purchase record)
//
// Use vi.hoisted for all mock variables referenced in vi.mock factories.

const { mockConstructEvent, mockFindUnique, mockUpdate, mockCreate, mockTransaction } =
  vi.hoisted(() => ({
    mockConstructEvent: vi.fn(),
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
    mockCreate: vi.fn(),
    mockTransaction: vi.fn(),
  }));

vi.mock("@/lib/env", () => ({
  env: {
    STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
}));

vi.mock("@/server/db", () => ({
  db: {
    purchase: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
    user: {
      update: mockUpdate,
    },
    $transaction: mockTransaction,
  },
}));

function createNextRequest(body: string, signature: string | null): NextRequest {
  return {
    text: () => Promise.resolve(body),
    headers: {
      get: (name: string) => {
        if (name === "stripe-signature") return signature;
        return null;
      },
    },
  } as unknown as NextRequest;
}

describe("Stripe webhook POST handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Signature verification
  // -----------------------------------------------------------------------

  it("should return 400 when stripe-signature header is missing", async () => {
    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), null);
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Missing stripe-signature header" });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("should return 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({ type: "checkout.session.completed" }), "bad_sig");
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("should verify signature with correct parameters", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: { object: { id: "cs_test_123" } },
    });

    const { POST } = await import("../route");

    const body = JSON.stringify({ type: "checkout.session.expired" });
    const req = createNextRequest(body, "valid_sig");
    await POST(req);

    expect(mockConstructEvent).toHaveBeenCalledWith(
      body,
      "valid_sig",
      "whsec_test_secret",
    );
  });

  // -----------------------------------------------------------------------
  // checkout.session.completed — idempotency
  // -----------------------------------------------------------------------

  it("should process new checkout.session.completed event and add credits", async () => {
    const session = {
      id: "cs_test_new",
      metadata: {
        userId: "user-123",
        credits: "50",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    // No existing purchase found
    mockFindUnique.mockResolvedValue(null);

    // Make user.update and purchase.create return sensible values
    // so the $transaction array is well-formed
    mockUpdate.mockReturnValue({ id: "user-123", credits: { increment: 50 } });
    mockCreate.mockReturnValue({ id: "purchase-new", stripePaymentId: "cs_test_new" });
    mockTransaction.mockResolvedValue([{}, {}]);

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // Verify idempotency check
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { stripePaymentId: "cs_test_new" },
    });

    // Verify individual operations were called correctly
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { credits: { increment: 50 } },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        stripePaymentId: "cs_test_new",
        creditsPurchased: 50,
      },
    });

    // Verify $transaction was called with the operations array
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("should add correct credits amount from metadata", async () => {
    const session = {
      id: "cs_test_credits",
      metadata: {
        userId: "user-123",
        credits: "100",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    mockFindUnique.mockResolvedValue(null);
    mockUpdate.mockReturnValue({});
    mockCreate.mockReturnValue({});
    mockTransaction.mockResolvedValue([{}, {}]);

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    await POST(req);

    // Verify correct increment
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { credits: { increment: 100 } },
    });

    // Verify purchase record
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        stripePaymentId: "cs_test_credits",
        creditsPurchased: 100,
      },
    });
  });

  it("should skip duplicate checkout.session.completed events (idempotency)", async () => {
    const session = {
      id: "cs_test_dup",
      metadata: {
        userId: "user-123",
        credits: "50",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    // Existing purchase found — this is a duplicate
    mockFindUnique.mockResolvedValue({
      id: "purchase-1",
      stripePaymentId: "cs_test_dup",
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // Should NOT process duplicate
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("should return 400 when metadata.userId is missing", async () => {
    const session = {
      id: "cs_test_no_user",
      metadata: {
        credits: "50",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Missing metadata" });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("should return 400 when metadata.credits is missing", async () => {
    const session = {
      id: "cs_test_no_credits",
      metadata: {
        userId: "user-123",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Missing metadata" });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("should return 400 when credits value is not a valid number", async () => {
    const session = {
      id: "cs_test_bad_credits",
      metadata: {
        userId: "user-123",
        credits: "not-a-number",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid credits" });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("should return 400 when credits value is zero or negative", async () => {
    const { POST } = await import("../route");

    // Test zero
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_zero",
          metadata: { userId: "user-123", credits: "0" },
        },
      },
    });

    let req = createNextRequest(JSON.stringify({}), "valid_sig");
    let response = await POST(req);
    expect(response.status).toBe(400);
    let body = await response.json();
    expect(body).toEqual({ error: "Invalid credits" });

    // Test negative
    vi.clearAllMocks();
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_neg",
          metadata: { userId: "user-123", credits: "-50" },
        },
      },
    });

    req = createNextRequest(JSON.stringify({}), "valid_sig");
    response = await POST(req);
    expect(response.status).toBe(400);
    body = await response.json();
    expect(body).toEqual({ error: "Invalid credits" });
  });

  // -----------------------------------------------------------------------
  // Other event types
  // -----------------------------------------------------------------------

  it("should handle checkout.session.expired gracefully", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: { object: { id: "cs_test_expired" } },
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("should handle unhandled event types gracefully", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_test" } },
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it("should handle empty request body gracefully", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No body to parse");
    });

    const { POST } = await import("../route");

    const req = createNextRequest("", "some_sig");
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it("should handle missing metadata fields in checkout.session.completed", async () => {
    const session = {
      id: "cs_test_no_meta",
      metadata: {},
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Missing metadata" });
  });
});
