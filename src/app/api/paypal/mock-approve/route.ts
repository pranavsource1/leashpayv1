/**
 * /api/paypal/mock-approve/route.ts — Mock PayPal approval for local dev.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const appBase = process.env.APP_BASE_URL || "http://localhost:3000";

  // In mock mode, simulate PayPal approval page
  const html = `<!DOCTYPE html>
<html>
<head><title>Mock PayPal Approval</title>
<style>
  body { font-family: sans-serif; max-width: 500px; margin: 80px auto; text-align: center; }
  .btn { display: inline-block; padding: 12px 32px; margin: 10px; border-radius: 24px; text-decoration: none; font-weight: bold; cursor: pointer; }
  .approve { background: #0070ba; color: white; }
  .cancel { background: #eee; color: #333; }
  .logo { font-size: 2em; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="logo">🔒 Mock PayPal</div>
  <h2>Approve Payment</h2>
  <p>Order ID: <strong>${token}</strong></p>
  <p>This is a simulated PayPal approval page for local development.</p>
  <a class="btn approve" href="${appBase}/api/paypal/return?token=${token}&source=mock">Approve Payment</a>
  <a class="btn cancel" href="${appBase}/api/paypal/cancel?token=${token}">Cancel</a>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
