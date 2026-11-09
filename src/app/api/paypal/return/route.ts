/**
 * /api/paypal/return/route.ts — Handle PayPal approval return.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleReturn } from "@/lib/paypal/orders";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const source = url.searchParams.get("source");
    const appBase = process.env.APP_BASE_URL || "http://localhost:3000";

    if (!token) {
      return NextResponse.redirect(`${appBase}/?error=missing_token`);
    }

    const result = await handleReturn(token);

    if (result.success) {
      return NextResponse.redirect(
        `${appBase}/?success=true&purchaseId=${result.purchaseRequestId}&captureId=${result.captureId}`
      );
    } else {
      return NextResponse.redirect(
        `${appBase}/?error=${encodeURIComponent(result.error || "capture_failed")}`
      );
    }
  } catch (err: any) {
    const appBase = process.env.APP_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appBase}/?error=${encodeURIComponent(err.message)}`);
  }
}
