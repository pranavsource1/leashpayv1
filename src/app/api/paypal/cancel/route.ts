/**
 * /api/paypal/cancel/route.ts — Handle PayPal cancellation.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleCancel } from "@/lib/paypal/orders";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const appBase = process.env.APP_BASE_URL || "http://localhost:3000";

    if (token) {
      await handleCancel(token);
    }

    return NextResponse.redirect(`${appBase}/?cancelled=true`);
  } catch (err: any) {
    const appBase = process.env.APP_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appBase}/?error=${encodeURIComponent(err.message)}`);
  }
}
