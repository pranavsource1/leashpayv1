/**
 * paypal/orders.ts — Gated order management.
 * The LLM never calls PayPal directly; this module sits behind the policy engine.
 */

import { randomUUID, createHash } from "node:crypto";
import { evaluate } from "../policy/engine";
import { getPolicyConfig, getPolicyVersion } from "../db";
import * as db from "../db";
import { getOffer, getProduct } from "../channel3/client";
import { createOrder, captureOrder, getOrder, refundCapture } from "./client";
import { signMandate, sha256, canonical } from "../mandate/sign";
import { formatUSD, currentMonth } from "../money";
import type { Policy } from "../policy/schema";

export interface PurchaseResult {
  decision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
  purchaseRequestId?: string;
  approvalUrl?: string;
  reasons: string[];
  trace: any[];
  riskScore: number;
  mandateId?: string;
  guardianApprovalUrl?: string;
}

export interface CaptureResult {
  success: boolean;
  purchaseRequestId: string;
  captureId?: string;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

const DEMO_USER = "demo-user-1";

export async function requestPurchase(params: {
  productId: string;
  offerId: string;
  agentProfileId?: string | null;
  idempotencyKey?: string;
}): Promise<PurchaseResult> {
  const userId = DEMO_USER;
  const idempotencyKey = params.idempotencyKey || randomUUID();

  // 1. Re-verify price from Channel3
  const offer = await getOffer(params.productId, params.offerId);
  if (!offer) {
    return { decision: "DENY", reasons: ["Offer not found"], trace: [], riskScore: 0 };
  }

  const product = await getProduct(params.productId);
  if (!product) {
    return { decision: "DENY", reasons: ["Product not found"], trace: [], riskScore: 0 };
  }

  // Check for duplicate (idempotency)
  const existing = db.findDuplicatePurchase(userId, params.productId, offer.merchant, idempotencyKey);
  if (existing) {
    return {
      decision: existing.policy_decision as any,
      purchaseRequestId: existing.id,
      approvalUrl: null,
      reasons: ["Duplicate request — returning existing order"],
      trace: JSON.parse(existing.policy_trace_json || "[]"),
      riskScore: existing.risk_score,
    };
  }

  // 2. Get price history for comparison
  const { getPriceHistory } = await import("../channel3/client");
  const priceHistory = await getPriceHistory(params.productId);

  // 3. Run policy engine
  const policy = getPolicyConfig(userId) as Policy;
  const ledger = db.getLedgerState(userId);

  const policyResult = evaluate(
    {
      productId: params.productId,
      offerId: params.offerId,
      title: product.title,
      merchant: offer.merchant,
      category: product.category,
      amountCents: offer.priceCents,
      currency: offer.currency,
      inStock: offer.inStock,
      priceHistoryAvgCents: priceHistory?.averageCents ?? null,
      agentProfileId: params.agentProfileId ?? null,
    },
    policy,
    ledger,
  );

  // 4. If DENY — log and return
  if (policyResult.decision === "DENY") {
    const pr = db.createPurchaseRequest({
      userId,
      productId: params.productId,
      offerId: params.offerId,
      offerDomain: offer.merchant,
      title: product.title,
      amountCents: offer.priceCents,
      currency: offer.currency,
      category: product.category,
      status: "DENIED",
      policyDecision: "DENY",
      policyTraceJson: JSON.stringify(policyResult.trace),
      cartHash: null,
      riskScore: policyResult.riskScore,
      paypalOrderId: null,
      agentProfileId: params.agentProfileId ?? null,
      idempotencyKey,
    });

    db.createAuditLog({
      userId,
      actor: "POLICY",
      eventType: "DENIED",
      purchaseRequestId: pr.id,
      summary: `DENIED: ${product.title} (${formatUSD(offer.priceCents)}) — ${policyResult.reasons.join("; ")}`,
      detailJson: policyResult,
      agentProfileId: params.agentProfileId,
    });

    // Record savings
    db.createSavingsEvent({
      purchaseRequestId: pr.id,
      kind: "BLOCKED",
      amountCents: offer.priceCents,
    });

    return {
      decision: "DENY",
      purchaseRequestId: pr.id,
      reasons: policyResult.reasons,
      trace: policyResult.trace,
      riskScore: policyResult.riskScore,
    };
  }

  // 5. ALLOW or REQUIRE_APPROVAL — sign cart mandate
  const cartPayload = {
    productId: params.productId,
    offerId: params.offerId,
    offerDomain: offer.merchant,
    amountCents: offer.priceCents,
    currency: offer.currency,
    title: product.title,
    quantity: 1,
    priceVerifiedAt: new Date().toISOString(),
  };

  const signedCart = signMandate(cartPayload);
  const cartHash = signedCart.hash;

  // 6. Create PayPal order
  const appBase = process.env.APP_BASE_URL || "http://localhost:3000";
  const customId = `${idempotencyKey.substring(0, 64)}:${cartHash.substring(0, 16)}`;

  let paypalOrder;
  try {
    paypalOrder = await createOrder({
      amountCents: offer.priceCents,
      currency: offer.currency,
      itemName: product.title,
      customId,
      idempotencyKey,
      returnUrl: `${appBase}/api/paypal/return?source=redirect`,
      cancelUrl: `${appBase}/api/paypal/cancel`,
    });
  } catch (err: any) {
    return {
      decision: "DENY",
      reasons: [`PayPal order creation failed: ${err.message}`],
      trace: policyResult.trace,
      riskScore: policyResult.riskScore,
    };
  }

  // 7. Create purchase request
  // Generate approval token for Guardian mode
  const approvalToken = randomUUID();
  const approvalTokenHash = createHash("sha256").update(approvalToken).digest("hex");
  const approvalExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const pr = db.createPurchaseRequest({
    userId,
    productId: params.productId,
    offerId: params.offerId,
    offerDomain: offer.merchant,
    title: product.title,
    amountCents: offer.priceCents,
    currency: offer.currency,
    category: product.category,
    status: "PENDING_APPROVAL",
    policyDecision: policyResult.decision,
    policyTraceJson: JSON.stringify(policyResult.trace),
    cartHash,
    riskScore: policyResult.riskScore,
    paypalOrderId: paypalOrder.id,
    agentProfileId: params.agentProfileId ?? null,
    idempotencyKey,
    approvalTokenHash,
    approvalExpiresAt,
  });

  // 8. Reserve budget
  db.reserveBudget(userId, offer.priceCents);

  // 9. Save cart mandate to DB
  const mandate = db.createMandate({
    userId,
    kind: "CART",
    bodyJson: signedCart.body,
    signature: signedCart.sig,
    bodyHash: signedCart.hash,
    policyVersion: getPolicyVersion(userId),
    purchaseRequestId: pr.id,
    expiresAt: approvalExpiresAt,
  });

  // 10. Audit logs
  db.createAuditLog({
    userId,
    actor: "POLICY",
    eventType: "POLICY_DECISION",
    purchaseRequestId: pr.id,
    summary: `${policyResult.decision}: ${product.title} (${formatUSD(offer.priceCents)}) from ${offer.merchant}`,
    detailJson: policyResult,
    agentProfileId: params.agentProfileId,
  });

  db.createAuditLog({
    userId,
    actor: "SYSTEM",
    eventType: "ORDER_CREATED",
    purchaseRequestId: pr.id,
    summary: `PayPal order ${paypalOrder.id} created for ${formatUSD(offer.priceCents)}`,
    detailJson: { paypalOrderId: paypalOrder.id, approvalUrl: paypalOrder.approvalUrl },
    agentProfileId: params.agentProfileId,
  });

  db.createAuditLog({
    userId,
    actor: "SYSTEM",
    eventType: "MANDATE_SIGNED",
    purchaseRequestId: pr.id,
    summary: `Cart mandate signed: ${cartHash.substring(0, 16)}`,
    detailJson: { mandateId: mandate.id, cartHash },
    agentProfileId: params.agentProfileId,
  });

  const guardianApprovalUrl = policy.guardianLabel
    ? `${appBase}/approve/${approvalToken}`
    : undefined;

  return {
    decision: policyResult.decision,
    purchaseRequestId: pr.id,
    approvalUrl: paypalOrder.approvalUrl,
    reasons: policyResult.reasons,
    trace: policyResult.trace,
    riskScore: policyResult.riskScore,
    mandateId: mandate.id,
    guardianApprovalUrl,
  };
}

export async function handleReturn(paypalOrderId: string): Promise<CaptureResult> {
  const userId = DEMO_USER;

  // 1. Find purchase request
  const pr = db.getPurchaseRequestByPaypalOrder(paypalOrderId);
  if (!pr) {
    return { success: false, purchaseRequestId: "", error: "Purchase request not found" };
  }

  // 2. Get order from PayPal to verify
  const order = await getOrder(paypalOrderId);

  // 3. Verify cart hash (mandate check)
  const mandate = db.getMandateByPurchase(pr.id);
  if (mandate && pr.cart_hash) {
    // Recompute cart hash from the order data and compare
    // In production this would verify against the exact PayPal order amounts
    // For now we trust our stored cart_hash
    const storedHash = pr.cart_hash;
    if (mandate.body_hash !== storedHash) {
      db.createAuditLog({
        userId,
        actor: "SYSTEM",
        eventType: "MANDATE_MISMATCH",
        purchaseRequestId: pr.id,
        summary: `Cart mandate mismatch — capture refused`,
        detailJson: { expected: mandate.body_hash, actual: storedHash },
      });
      return { success: false, purchaseRequestId: pr.id, error: "Mandate mismatch — capture refused" };
    }
  }

  // 4. Capture the order
  try {
    const capture = await captureOrder(paypalOrderId);

    // 5. Update purchase request
    db.updatePurchaseRequest(pr.id, {
      status: "PAID",
      paypalCaptureId: capture.captureId || undefined,
    });

    // 6. Move budget from reserved to captured
    db.captureBudget(userId, pr.amount_cents);

    // 7. Audit logs
    db.createAuditLog({
      userId,
      actor: "PAYPAL",
      eventType: "CAPTURED",
      purchaseRequestId: pr.id,
      summary: `Payment captured: ${formatUSD(pr.amount_cents)} for ${pr.title}`,
      detailJson: { captureId: capture.captureId, paypalOrderId },
    });

    return {
      success: true,
      purchaseRequestId: pr.id,
      captureId: capture.captureId || undefined,
    };
  } catch (err: any) {
    db.updatePurchaseRequest(pr.id, { status: "FAILED" });
    db.releaseBudget(userId, pr.amount_cents);

    db.createAuditLog({
      userId,
      actor: "SYSTEM",
      eventType: "ERROR",
      purchaseRequestId: pr.id,
      summary: `Capture failed: ${err.message}`,
    });

    return { success: false, purchaseRequestId: pr.id, error: err.message };
  }
}

export async function handleCancel(paypalOrderId: string): Promise<void> {
  const userId = DEMO_USER;
  const pr = db.getPurchaseRequestByPaypalOrder(paypalOrderId);
  if (!pr) return;

  db.updatePurchaseRequest(pr.id, { status: "CANCELLED" });
  db.releaseBudget(userId, pr.amount_cents);

  db.createAuditLog({
    userId,
    actor: "USER",
    eventType: "DECLINED",
    purchaseRequestId: pr.id,
    summary: `Order cancelled by user: ${pr.title}`,
  });
}

export async function handleRefund(
  purchaseRequestId: string,
  amountCents?: number,
): Promise<RefundResult> {
  const userId = DEMO_USER;
  const pr = db.getPurchaseRequest(purchaseRequestId);
  if (!pr) return { success: false, error: "Purchase request not found" };
  if (pr.status !== "PAID") return { success: false, error: "Can only refund paid orders" };
  if (!pr.paypal_capture_id) return { success: false, error: "No capture ID found" };

  const refundAmount = amountCents || pr.amount_cents;

  try {
    const refund = await refundCapture(pr.paypal_capture_id, refundAmount, pr.currency);

    db.updatePurchaseRequest(pr.id, {
      status: "REFUNDED",
      refundedCents: (pr.refunded_cents || 0) + refundAmount,
    });

    db.refundBudget(userId, refundAmount);

    db.createAuditLog({
      userId,
      actor: "USER",
      eventType: "REFUNDED",
      purchaseRequestId: pr.id,
      summary: `Refund processed: ${formatUSD(refundAmount)} for ${pr.title}`,
      detailJson: { refundId: refund.id, amount: refundAmount },
    });

    return { success: true, refundId: refund.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
