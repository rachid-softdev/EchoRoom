import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Stripe Webhook Route tests
// ---------------------------------------------------------------------------
// The webhook handler (POST /api/webhooks/stripe):
//   1. Verifies Stripe signature
//   2. Idempotency: skips duplicate checkout.session.completed events
//   3. Processes new events atomically (add credits + create purchase record)
//
// Use vi.hoisted for all mock variables referenced in vi.mock factories.

const {
  mockConstructEvent,
  mockTxCreate,
  mockTxUpdate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockTxCreate: vi.fn(),
  mockTxUpdate: vi.fn(),
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
    $transaction: mockTransaction,
    purchase: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

// Always allow rate limiting in tests — we're not testing rate limiting here.
// Note: route.ts imports from "../rateLimit" (relative to webhooks/stripe/route.ts).
// From the test file's perspective (webhooks/stripe/__tests__/route.test.ts), the
// path should use the project alias.
vi.mock("@/app/api/webhooks/rateLimit", () => ({
  checkWebhookRateLimit: async () => true,
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
    vi.resetAllMocks();
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
    expect(body).toEqual({ error: "En-tête stripe-signature manquant" });
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
    expect(body.error).toBe("Signature invalide");
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
      payment_intent: "pi_test_new",
      metadata: {
        userId: "user-123",
        credits: "50",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    // Mock successful transaction
    const mockTxUpsert = vi.fn().mockResolvedValue({ id: "billing-1", credits: 150 });
    mockTxCreate.mockResolvedValue({ id: "purchase-new", stripePaymentId: "pi_test_new" });
    const mockTx = {
      purchase: { create: mockTxCreate },
      userBilling: { upsert: mockTxUpsert },
    };
    mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // Verify $transaction was called with a callback function
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(typeof mockTransaction.mock.calls[0]![0]).toBe("function");

    // Verify purchase was created inside the transaction
    expect(mockTxCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        stripePaymentId: "pi_test_new",
        creditsPurchased: 50,
      },
    });

    // Verify UserBilling sub-aggregate upsert was called
    expect(mockTxUpsert).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      create: { userId: "user-123", credits: 50 },
      update: { credits: { increment: 50 } },
    });
  });

  it("should add correct credits amount from metadata", async () => {
    const session = {
      id: "cs_test_credits",
      payment_intent: "pi_test_credits",
      metadata: {
        userId: "user-123",
        credits: "100",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    const mockTxUpsert = vi.fn().mockResolvedValue({});
    mockTxCreate.mockResolvedValue({ id: "purchase-1" });
    const mockTx = {
      purchase: { create: mockTxCreate },
      userBilling: { upsert: mockTxUpsert },
    };
    mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    await POST(req);

    // Verify UserBilling sub-aggregate upsert was called with correct increment
    expect(mockTxUpsert).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      create: { userId: "user-123", credits: 100 },
      update: { credits: { increment: 100 } },
    });

    // Verify purchase record created inside transaction
    expect(mockTxCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        stripePaymentId: "pi_test_credits",
        creditsPurchased: 100,
      },
    });
  });

  it("should skip duplicate checkout.session.completed events (idempotency via P2002)", async () => {
    const session = {
      id: "cs_test_dup",
      payment_intent: "pi_test_dup",
      metadata: {
        userId: "user-123",
        credits: "50",
      },
    };

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session },
    });

    // Simulate Prisma P2002 unique constraint violation (duplicate stripePaymentId)
    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on stripePaymentId",
      { code: "P2002", clientVersion: "5.22.0", meta: { target: ["stripePaymentId"] } },
    );
    const mockTxUpsert = vi.fn();
    mockTxCreate.mockRejectedValue(p2002Error);
    const mockTx = {
      purchase: { create: mockTxCreate },
      userBilling: { upsert: mockTxUpsert },
    };
    mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });

    // Transaction callback was called (and threw P2002 inside)
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // user.update should NOT have been called (transaction aborted before)
    expect(mockTxUpdate).not.toHaveBeenCalled();
    // userBilling.upsert should NOT have been called (aborted before)
    expect(mockTxUpsert).not.toHaveBeenCalled();
  });

  it("should return 400 when metadata.userId is missing", async () => {
    const session = {
      id: "cs_test_no_user",
      payment_intent: "pi_test_no_user",
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
    expect(body).toEqual({ error: "Métadonnées manquantes" });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("should return 400 when metadata.credits is missing", async () => {
    const session = {
      id: "cs_test_no_credits",
      payment_intent: "pi_test_no_credits",
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
    expect(body).toEqual({ error: "Métadonnées manquantes" });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("should return 400 when credits value is not a valid number", async () => {
    const session = {
      id: "cs_test_bad_credits",
      payment_intent: "pi_test_bad_credits",
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
    expect(body).toEqual({ error: "Crédits invalides" });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
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
          payment_intent: "pi_test_zero",
          metadata: { userId: "user-123", credits: "0" },
        },
      },
    });

    let req = createNextRequest(JSON.stringify({}), "valid_sig");
    let response = await POST(req);
    expect(response.status).toBe(400);
    let body = await response.json();
    expect(body).toEqual({ error: "Crédits invalides" });

    // Test negative
    vi.clearAllMocks();
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_neg",
          payment_intent: "pi_test_neg",
          metadata: { userId: "user-123", credits: "-50" },
        },
      },
    });

    req = createNextRequest(JSON.stringify({}), "valid_sig");
    response = await POST(req);
    expect(response.status).toBe(400);
    body = await response.json();
    expect(body).toEqual({ error: "Crédits invalides" });
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
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
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
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
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
      payment_intent: "pi_test_no_meta",
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
    expect(body).toEqual({ error: "Métadonnées manquantes" });
  });

  // -----------------------------------------------------------------------
  // charge.refunded — atomic idempotency via updateMany
  // -----------------------------------------------------------------------

  describe("charge.refunded", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should process first refund and revoke credits", async () => {
      const charge = {
        id: "ch_refund_123",
        payment_intent: "pi_refund_123",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.refunded",
        data: { object: charge },
      });

      // Set up tx-level mocks — production code uses tx.* inside $transaction
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const mockTxFindUnique = vi.fn().mockResolvedValue({
        id: "purchase-1",
        userId: "user-1",
        creditsPurchased: 50,
      });
      const mockTxBillingUpsert = vi.fn().mockResolvedValue({});
      const mockTx = {
        purchase: {
          updateMany: mockTxUpdateMany,
          findUnique: mockTxFindUnique,
        },
        userBilling: {
          upsert: mockTxBillingUpsert,
        },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ received: true });

      // Atomic update: only matches where refundedAt IS NULL
      expect(mockTxUpdateMany).toHaveBeenCalledWith({
        where: {
          stripePaymentId: "pi_refund_123",
          refundedAt: null,
        },
        data: { refundedAt: expect.any(Date) },
      });

      // Fetch purchase to get user and credit amount
      expect(mockTxFindUnique).toHaveBeenCalledWith({
        where: { stripePaymentId: "pi_refund_123" },
        select: { userId: true, creditsPurchased: true },
      });

      // Revoke credits via UserBilling upsert
      expect(mockTxBillingUpsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        create: { userId: "user-1" },
        update: { credits: { decrement: 50 } },
      });
    });

    it("should be idempotent — duplicate charge.refunded events skip processing", async () => {
      const charge = {
        id: "ch_refund_dup",
        payment_intent: "pi_refund_dup",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.refunded",
        data: { object: charge },
      });

      // updateMany returns count=0 (already refunded — refundedAt IS NOT NULL)
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      const mockTxFindUnique = vi.fn();
      const mockTxBillingUpsert = vi.fn();
      const mockTx = {
        purchase: {
          updateMany: mockTxUpdateMany,
          findUnique: mockTxFindUnique,
        },
        userBilling: {
          upsert: mockTxBillingUpsert,
        },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // Should not proceed to findUnique or userBilling.upsert (returned early since count=0)
      expect(mockTxFindUnique).not.toHaveBeenCalled();
      expect(mockTxBillingUpsert).not.toHaveBeenCalled();
    });

    it("should handle refund without payment_intent gracefully", async () => {
      const charge = {
        id: "ch_no_pi",
        payment_intent: null as any,
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.refunded",
        data: { object: charge },
      });

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("should handle refund with no matching purchase gracefully", async () => {
      const charge = {
        id: "ch_no_match",
        payment_intent: "pi_no_match",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.refunded",
        data: { object: charge },
      });

      // updateMany returns count=0 (no purchase with that payment_intent)
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      const mockTxFindUnique = vi.fn();
      const mockTxBillingUpsert = vi.fn();
      const mockTx = {
        purchase: {
          updateMany: mockTxUpdateMany,
          findUnique: mockTxFindUnique,
        },
        userBilling: {
          upsert: mockTxBillingUpsert,
        },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockTxFindUnique).not.toHaveBeenCalled();
      expect(mockTxBillingUpsert).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // charge.dispute.created — atomic idempotency via updateMany
  // -----------------------------------------------------------------------

  describe("charge.dispute.created", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should set disputedAt on first dispute notification", async () => {
      const dispute = {
        id: "dp_create_123",
        payment_intent: "pi_dispute_123",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.created",
        data: { object: dispute },
      });

      // Set up tx-level mock — production code uses tx.* inside $transaction
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const mockTx = {
        purchase: { updateMany: mockTxUpdateMany },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // Atomic update: only matches where disputedAt IS NULL
      expect(mockTxUpdateMany).toHaveBeenCalledWith({
        where: {
          stripePaymentId: "pi_dispute_123",
          disputedAt: null,
        },
        data: { disputedAt: expect.any(Date) },
      });
    });

    it("should be idempotent — duplicate dispute.created does not re-set disputedAt", async () => {
      const dispute = {
        id: "dp_create_dup",
        payment_intent: "pi_dispute_dup",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.created",
        data: { object: dispute },
      });

      // Set up tx-level mock — updateMany returns count=0 (disputedAt already set)
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      const mockTx = {
        purchase: { updateMany: mockTxUpdateMany },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      // Still called — but returned 0, so no action beyond logging
      expect(mockTxUpdateMany).toHaveBeenCalled();
    });

    it("should handle dispute without payment_intent gracefully", async () => {
      const dispute = {
        id: "dp_no_pi",
        payment_intent: null as any,
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.created",
        data: { object: dispute },
      });

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // charge.dispute.closed — atomic idempotency via updateMany
  // -----------------------------------------------------------------------

  describe("charge.dispute.closed", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should revoke credits when dispute is lost (updateMany guard)", async () => {
      const dispute = {
        id: "dp_lost_123",
        payment_intent: "pi_lost_123",
        status: "lost",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      // Set up tx-level mocks — production code uses tx.* inside $transaction
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const mockTxFindUnique = vi.fn().mockResolvedValue({
        id: "purchase-lost-1",
        userId: "user-1",
        creditsPurchased: 50,
      });
      const mockTxBillingUpsert = vi.fn().mockResolvedValue({});
      const mockTx = {
        purchase: {
          updateMany: mockTxUpdateMany,
          findUnique: mockTxFindUnique,
        },
        userBilling: {
          upsert: mockTxBillingUpsert,
        },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // Atomic update: only matches where refundedAt IS NULL
      expect(mockTxUpdateMany).toHaveBeenCalledWith({
        where: {
          stripePaymentId: "pi_lost_123",
          refundedAt: null,
        },
        data: { refundedAt: expect.any(Date) },
      });

      // Fetch purchase details
      expect(mockTxFindUnique).toHaveBeenCalledWith({
        where: { stripePaymentId: "pi_lost_123" },
        select: { userId: true, creditsPurchased: true },
      });

      // Revoke credits via UserBilling upsert
      expect(mockTxBillingUpsert).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        create: { userId: "user-1" },
        update: { credits: { decrement: 50 } },
      });
    });

    it("should clear disputedAt when dispute is won (updateMany guard)", async () => {
      const dispute = {
        id: "dp_won_123",
        payment_intent: "pi_won_123",
        status: "won",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const mockTx = {
        purchase: { updateMany: mockTxUpdateMany },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // Atomic update inside $transaction: only matches where disputedAt IS NOT NULL
      expect(mockTxUpdateMany).toHaveBeenCalledWith({
        where: {
          stripePaymentId: "pi_won_123",
          disputedAt: { not: null },
        },
        data: { disputedAt: null },
      });
    });

    it("should not revoke credits when dispute is won (only clear disputedAt)", async () => {
      const dispute = {
        id: "dp_won_456",
        payment_intent: "pi_won_456",
        status: "won",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const mockTx = {
        purchase: { updateMany: mockTxUpdateMany },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      await POST(req);

      // No billing upsert — only updateMany inside $transaction for clearing disputedAt
      expect(mockTxUpdateMany).toHaveBeenCalledWith({
        where: {
          stripePaymentId: "pi_won_456",
          disputedAt: { not: null },
        },
        data: { disputedAt: null },
      });
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("should handle dispute.closed without payment_intent gracefully", async () => {
      const dispute = {
        id: "dp_no_pi_123",
        payment_intent: null as any,
        status: "lost",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ received: true });

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("should handle dispute.closed with no matching purchases gracefully", async () => {
      const dispute = {
        id: "dp_no_match",
        payment_intent: "pi_no_match",
        status: "lost",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      // updateMany returns 0 (no purchase with that payment_intent)
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      const mockTxFindUnique = vi.fn();
      const mockTxUserUpdate = vi.fn();
      const mockTx = {
        purchase: {
          updateMany: mockTxUpdateMany,
          findUnique: mockTxFindUnique,
        },
        user: {
          update: mockTxUserUpdate,
        },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockTxFindUnique).not.toHaveBeenCalled();
      expect(mockTxUserUpdate).not.toHaveBeenCalled();
    });

    it("should be idempotent — duplicate dispute.lost events don't double-revoke", async () => {
      const dispute = {
        id: "dp_dup_123",
        payment_intent: "pi_dup_123",
        status: "lost",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      // updateMany returns 0 (already refunded — refundedAt IS NOT NULL)
      const mockTxUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      const mockTxFindUnique = vi.fn();
      const mockTxBillingUpsert = vi.fn();
      const mockTx = {
        purchase: {
          updateMany: mockTxUpdateMany,
          findUnique: mockTxFindUnique,
        },
        userBilling: {
          upsert: mockTxBillingUpsert,
        },
      };
      mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // updateMany was called but returned 0 — no further action
      expect(mockTxFindUnique).not.toHaveBeenCalled();
      expect(mockTxBillingUpsert).not.toHaveBeenCalled();
    });
  });
});
