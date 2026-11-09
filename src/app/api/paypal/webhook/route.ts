/**
 * /api/paypal/webhook/route.ts — PayPal webhook handler with signature verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paypal/client";
import { handleReturn } from "@/lib/paypal/orders";
import { createAuditLog, getPurchaseRequestByPaypalOrder, updatePurchaseRequest, captureBudget } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Verify signature
    const isValid = await verifyWebhookSignature(headers, body);
    if (!isValid) {
      createAuditLog({
        userId: "demo-user-1",
        actor: "PAYPAL",
        eventType: "WEBHOOK",
        summary: "Webhook signature verification failed",
        detailJson: { headers },
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.event_type;
    const resource = event.resource;

    createAuditLog({
      userId: "demo-user-1",
      actor: "PAYPAL",
      eventType: "WEBHOOK",
      summary: `Webhook: ${eventType}`,
      detailJson: { eventType, resourceId: resource?.id },
    });

    switch (eventType) {
      case "CHECKOUT.ORDER.APPROVED": {
        const orderId = resource?.id;
        if (orderId) {
          // Capture the order if not already captured via return handler
          const pr = getPurchaseRequestByPaypalOrder(orderId);
          if (pr && pr.status === "PENDING_APPROVAL") {
            await handleReturn(orderId);
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.COMPLETED": {
        const orderId = resource?.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          const pr = getPurchaseRequestByPaypalOrder(orderId);
          if (pr && pr.status !== "PAID") {
            updatePurchaseRequest(pr.id, {
              status: "PAID",
              paypalCaptureId: resource?.id,
            });
            captureBudget("demo-user-1", pr.amount_cents);

            createAuditLog({
              userId: "demo-user-1",
              actor: "PAYPAL",
              eventType: "CAPTURED",
              purchaseRequestId: pr.id,
              summary: `Payment confirmed via webhook: ${pr.title}`,
            });
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        createAuditLog({
          userId: "demo-user-1",
          actor: "PAYPAL",
          eventType: "REFUNDED",
          summary: `Refund confirmed via webhook`,
          detailJson: { resourceId: resource?.id },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
