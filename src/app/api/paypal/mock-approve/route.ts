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
<html lang="en">
<head><title>Mock PayPal Approval</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 48px 20px; }
  .card { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; box-shadow: 0 1px 2px rgba(15,23,42,.06); }
  .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #64748b; margin-bottom: 20px; }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: #4f46e5; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 8px 0 0; }
  code { background: #f1f5f9; border-radius: 6px; padding: 2px 6px; font-size: 12px; color: #0f172a; }
  .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
  .btn { display: block; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .approve { background: #10b981; color: #fff; }
  .cancel { background: #fff; color: #64748b; border: 1px solid #e2e8f0; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="dot"></span> Mock PayPal</div>
    <h1>Approve payment</h1>
    <p>Order <code>${token}</code></p>
    <p>This is a simulated PayPal approval page for local development.</p>
    <div class="actions">
      <a class="btn approve" href="${appBase}/api/paypal/return?token=${token}&source=mock">Approve payment</a>
      <a class="btn cancel" href="${appBase}/api/paypal/cancel?token=${token}">Cancel</a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
