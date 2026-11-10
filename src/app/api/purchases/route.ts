/**
 * /api/purchases/route.ts — Purchase request management.
 */

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { handleRefund } from "@/lib/paypal/orders";

const DEMO_USER = "demo-user-1";

// GET — list purchase requests
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const purchases = db.getPurchaseRequestsByUser(DEMO_USER, limit);

    // Expire old pending orders
    db.expirePendingOrders(DEMO_USER);

    return NextResponse.json({ purchases });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — refund a purchase
export async function POST(req: NextRequest) {
  try {
    const { purchaseRequestId, amountCents } = await req.json();
    if (!purchaseRequestId) {
      return NextResponse.json({ error: "purchaseRequestId is required" }, { status: 400 });
    }

    const result = await handleRefund(purchaseRequestId, amountCents);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, refundId: result.refundId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
