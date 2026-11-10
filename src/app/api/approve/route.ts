/**
 * /api/approve/route.ts — Guardian approval endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getPurchaseByApprovalToken, getPurchaseRequest, updatePurchaseRequest, createAuditLog } from "@/lib/db";

// GET — get purchase details for guardian approval page
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const pr = getPurchaseByApprovalToken(tokenHash);

    if (!pr) {
      return NextResponse.json({ error: "Invalid or expired approval token" }, { status: 404 });
    }

    // Check expiry
    if (pr.approval_expires_at && new Date(pr.approval_expires_at) < new Date()) {
      return NextResponse.json({ error: "Approval link has expired" }, { status: 410 });
    }

    return NextResponse.json({
      id: pr.id,
      title: pr.title,
      amount_cents: pr.amount_cents,
      currency: pr.currency,
      merchant: pr.offer_domain,
      category: pr.category,
      status: pr.status,
      policy_decision: pr.policy_decision,
      policy_trace: pr.policy_trace_json ? JSON.parse(pr.policy_trace_json) : [],
      risk_score: pr.risk_score,
      paypal_order_id: pr.paypal_order_id,
      created_at: pr.created_at,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — approve or decline
export async function POST(req: NextRequest) {
  try {
    const { token, action } = await req.json();

    if (!token || !action) {
      return NextResponse.json({ error: "Token and action required" }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const pr = getPurchaseByApprovalToken(tokenHash);

    if (!pr) {
      return NextResponse.json({ error: "Invalid or expired approval token" }, { status: 404 });
    }

    if (action === "decline") {
      updatePurchaseRequest(pr.id, { status: "CANCELLED" });
      const { releaseBudget } = await import("@/lib/db");
      releaseBudget("demo-user-1", pr.amount_cents);

      createAuditLog({
        userId: "demo-user-1",
        actor: "USER",
        eventType: "DECLINED",
        purchaseRequestId: pr.id,
        summary: `Guardian declined: ${pr.title}`,
      });

      return NextResponse.json({ success: true, action: "declined" });
    }

    if (action === "approve") {
      createAuditLog({
        userId: "demo-user-1",
        actor: "USER",
        eventType: "APPROVAL_REQUESTED",
        purchaseRequestId: pr.id,
        summary: `Guardian approved: ${pr.title} — redirecting to PayPal`,
      });

      // Get the PayPal approval URL from the order
      const { getOrder } = await import("@/lib/paypal/client");
      const order = await getOrder(pr.paypal_order_id!);
      
      // Find the approve link from PayPal
      const approveLink = order.links.find((l: any) => l.rel === "approve" || l.rel === "payer-action");
      const approvalUrl = approveLink?.href || order.approvalUrl;

      if (!approvalUrl) {
        return NextResponse.json({ error: "PayPal approval URL not found" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "approved", approvalUrl });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
