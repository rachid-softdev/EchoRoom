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
    mockTxCreate.mockResolvedValue({ id: "purchase-new", stripePaymentId: "pi_test_new" });
    mockTxUpdate.mockResolvedValue({ id: "user-123", credits: 150 });
    const mockTx = {
      purchase: { create: mockTxCreate },
      user: { update: mockTxUpdate },
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
    expect(typeof mockTransaction.mock.calls[0][0]).toBe("function");

    // Verify purchase was created inside the transaction
    expect(mockTxCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-123",
        stripePaymentId: "pi_test_new",
        creditsPurchased: 50,
      },
    });

    // Verify credits were added inside the transaction
    expect(mockTxUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { credits: { increment: 50 } },
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

    mockTxCreate.mockResolvedValue({ id: "purchase-1" });
    mockTxUpdate.mockResolvedValue({});
    const mockTx = {
      purchase: { create: mockTxCreate },
      user: { update: mockTxUpdate },
    };
    mockTransaction.mockImplementation(async (cb: any) => cb(mockTx));

    const { POST } = await import("../route");

    const req = createNextRequest(JSON.stringify({}), "valid_sig");
    await POST(req);

    // Verify correct increment inside transaction
    expect(mockTxUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { credits: { increment: 100 } },
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
    mockTxCreate.mockRejectedValue(p2002Error);
    const mockTx = {
      purchase: { create: mockTxCreate },
      user: { update: mockTxUpdate },
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
    expect(body).toEqual({ error: "Missing metadata" });
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
    expect(body).toEqual({ error: "Missing metadata" });
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
    expect(body).toEqual({ error: "Invalid credits" });
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
    expect(body).toEqual({ error: "Invalid credits" });

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
    expect(body).toEqual({ error: "Missing metadata" });
  });

  // -----------------------------------------------------------------------
  // charge.dispute.closed handler
  // -----------------------------------------------------------------------

  describe("charge.dispute.closed", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should revoke credits when dispute is lost", async () => {
      const dispute = {
        id: "dp_lost_123",
        payment_intent: "pi_lost_123",
        status: "lost",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      // The route code calls db.purchase.findMany directly (not in a transaction)
      // for the initial lookup. Set up the direct mock.
      const { db } = await import("@/server/db");
      (db.purchase.findMany as any).mockResolvedValue([
        { id: "purchase-dp-1", userId: "user-1", creditsPurchased: 50 },
      ]);

      // For the lost branch, it calls db.$transaction with a callback.
      // Inside the transaction, tx.purchase.findUnique, tx.user.update, tx.purchase.update
      const txFindUnique = vi.fn().mockResolvedValue({ refundedAt: null });
      const txUserUpdate = vi.fn();
      const txPurchaseUpdate = vi.fn();

      mockTransaction.mockImplementation(async (cb: any) => cb({
        purchase: {
          findUnique: txFindUnique,
          update: txPurchaseUpdate,
        },
        user: {
          update: txUserUpdate,
        },
      }));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ received: true });

      // Verify purchase.findMany was called to find disputed purchases
      expect(db.purchase.findMany).toHaveBeenCalledWith({
        where: { stripePaymentId: "pi_lost_123" },
      });

      // Verify idempotency check inside transaction
      expect(txFindUnique).toHaveBeenCalledWith({
        where: { id: "purchase-dp-1" },
        select: { refundedAt: true },
      });

      // Verify credits were decremented inside transaction
      expect(txUserUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { credits: { decrement: 50 } },
      });

      // Verify purchase was marked as refunded inside transaction
      expect(txPurchaseUpdate).toHaveBeenCalledWith({
        where: { id: "purchase-dp-1" },
        data: { refundedAt: expect.any(Date) },
      });
    });

    it("should clear disputedAt when dispute is won", async () => {
      const dispute = {
        id: "dp_won_123",
        payment_intent: "pi_won_123",
        status: "won",
      };

      mockConstructEvent.mockReturnValue({
        type: "charge.dispute.closed",
        data: { object: dispute },
      });

      const { db } = await import("@/server/db");
      (db.purchase.findMany as any).mockResolvedValue([
        { id: "purchase-won-1", userId: "user-1", creditsPurchased: 50 },
      ]);

      // For "won" branch, db.purchase.update is called directly (not in a transaction)
      (db.purchase.update as any).mockResolvedValue({ id: "purchase-won-1" });

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // Verify disputedAt was set to null
      expect(db.purchase.update).toHaveBeenCalledWith({
        where: { id: "purchase-won-1" },
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

      const { db } = await import("@/server/db");
      (db.purchase.findMany as any).mockResolvedValue([
        { id: "purchase-won-2", userId: "user-2", creditsPurchased: 100 },
      ]);
      (db.purchase.update as any).mockResolvedValue({ id: "purchase-won-2" });

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      await POST(req);

      // For "won" status, the $transaction is NOT called (no credit revocation)
      expect(mockTransaction).not.toHaveBeenCalled();
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

      // Should still return 200 (event acknowledged, but no action taken)
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ received: true });

      // No transaction should be called since there's no payment_intent
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

      const { db } = await import("@/server/db");
      (db.purchase.findMany as any).mockResolvedValue([]);

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // findMany was called but returned empty — no further action
      expect(db.purchase.findMany).toHaveBeenCalledWith({
        where: { stripePaymentId: "pi_no_match" },
      });
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

      const { db } = await import("@/server/db");
      (db.purchase.findMany as any).mockResolvedValue([
        { id: "purchase-dup-1", userId: "user-dup", creditsPurchased: 75 },
      ]);

      // Inside transaction: simulate that the purchase was ALREADY refunded
      const txFindUnique = vi.fn().mockResolvedValue({ refundedAt: new Date("2026-01-01") });
      const txUserUpdate = vi.fn();
      const txPurchaseUpdate = vi.fn();

      mockTransaction.mockImplementation(async (cb: any) => cb({
        purchase: {
          findUnique: txFindUnique,
          update: txPurchaseUpdate,
        },
        user: {
          update: txUserUpdate,
        },
      }));

      const { POST } = await import("../route");

      const req = createNextRequest(JSON.stringify({}), "valid_sig");
      const response = await POST(req);

      expect(response.status).toBe(200);

      // Idempotency check: refundedAt is set, so skip revocation
      expect(txFindUnique).toHaveBeenCalledWith({
        where: { id: "purchase-dup-1" },
        select: { refundedAt: true },
      });

      // No credit revocation or update since already refunded
      expect(txUserUpdate).not.toHaveBeenCalled();
      expect(txPurchaseUpdate).not.toHaveBeenCalled();
    });
  });
});
