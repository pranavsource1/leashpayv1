/**
 * /api/receipt/route.ts — Public receipt data for verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPurchaseRequest, getMandateByPurchase, getAuditLogs } from "@/lib/db";
import { formatUSD } from "@/lib/money";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const pr = getPurchaseRequest(id);
    if (!pr) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    const mandate = getMandateByPurchase(id);
    const auditLogs = getAuditLogs(pr.user_id, { limit: 50 }).filter(
      l => l.purchase_request_id === id
    );

    return NextResponse.json({
      receipt: {
        id: pr.id,
        title: pr.title,
        amount: formatUSD(pr.amount_cents),
        amountCents: pr.amount_cents,
        currency: pr.currency,
        merchant: pr.offer_domain,
        category: pr.category,
        status: pr.status,
        decision: pr.policy_decision,
        riskScore: pr.risk_score,
        cartHash: pr.cart_hash,
        paypalOrderId: pr.paypal_order_id,
        paypalCaptureId: pr.paypal_capture_id,
        createdAt: pr.created_at,
        policyTrace: pr.policy_trace_json ? JSON.parse(pr.policy_trace_json) : [],
      },
      mandate: mandate ? {
        id: mandate.id,
        kind: mandate.kind,
        bodyHash: mandate.body_hash,
        policyVersion: mandate.policy_version,
        createdAt: mandate.created_at,
        signature: mandate.signature.substring(0, 32) + "...",
      } : null,
      auditTrail: auditLogs.map(l => ({
        ts: l.ts,
        actor: l.actor,
        event: l.event_type,
        summary: l.summary,
        rowHash: l.row_hash?.substring(0, 16),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
