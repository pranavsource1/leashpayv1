/**
 * paypal/client.ts — PayPal REST client with mock fallback for local dev.
 */

import { centsToPayPalAmount } from "../money";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

function getBaseUrl(): string {
  return process.env.PAYPAL_ENV === "live" ? LIVE_BASE : SANDBOX_BASE;
}

function isMockMode(): boolean {
  return process.env.PAYPAL_MOCK_MODE === "true" || !process.env.PAYPAL_CLIENT_ID;
}

// ── Access Token (cached) ──
let _accessToken: string | null = null;
let _tokenExpiresAt = 0;

export async function getAccessToken(): Promise<string> {
  if (isMockMode()) return "MOCK_ACCESS_TOKEN";

  if (_accessToken && Date.now() < _tokenExpiresAt) return _accessToken;

  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken!;
}

// ── Interfaces ──
export interface CreateOrderParams {
  amountCents: number;
  currency: string;
  itemName: string;
  customId: string;
  idempotencyKey: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayPalOrder {
  id: string;
  status: string;
  approvalUrl: string | undefined;
  links: Array<{ href: string; rel: string; method?: string }>;
}

export interface PayPalCapture {
  id: string;
  status: string;
  captureId: string | null;
}

export interface PayPalRefund {
  id: string;
  status: string;
}

// ── Mock counter ──
let mockCounter = 1000;

// ── Create Order ──
export async function createOrder(params: CreateOrderParams): Promise<PayPalOrder> {
  if (isMockMode()) {
    const mockId = `MOCK-ORDER-${++mockCounter}`;
    const appBase = process.env.APP_BASE_URL || "http://localhost:3000";
    return {
      id: mockId,
      status: "CREATED",
      approvalUrl: `${appBase}/api/paypal/mock-approve?token=${mockId}`,
      links: [
        { href: `${appBase}/api/paypal/mock-approve?token=${mockId}`, rel: "approve" },
        { href: `${getBaseUrl()}/v2/checkout/orders/${mockId}`, rel: "self" },
      ],
    };
  }

  const token = await getAccessToken();
  const amount = centsToPayPalAmount(params.amountCents);

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: params.currency,
          value: amount,
          breakdown: {
            item_total: { currency_code: params.currency, value: amount },
          },
        },
        items: [
          {
            name: params.itemName.substring(0, 127),
            quantity: "1",
            unit_amount: { currency_code: params.currency, value: amount },
          },
        ],
        custom_id: params.customId.substring(0, 127),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          user_action: "PAY_NOW",
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      },
    },
  };

  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": params.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const approvalLink = data.links?.find(
    (l: any) => l.rel === "approve" || l.rel === "payer-action"
  );

  return {
    id: data.id,
    status: data.status,
    approvalUrl: approvalLink?.href || undefined,
    links: data.links || [],
  };
}

// ── Get Order ──
export async function getOrder(orderId: string): Promise<PayPalOrder> {
  if (isMockMode()) {
    return {
      id: orderId,
      status: "APPROVED",
      approvalUrl: undefined,
      links: [],
    };
  }

  const token = await getAccessToken();
  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`PayPal get order failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    status: data.status,
    approvalUrl: undefined,
    links: data.links || [],
  };
}

// ── Capture Order ──
export async function captureOrder(orderId: string): Promise<PayPalCapture> {
  if (isMockMode()) {
    return {
      id: orderId,
      status: "COMPLETED",
      captureId: `MOCK-CAPTURE-${++mockCounter}`,
    };
  }

  const token = await getAccessToken();
  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `capture-${orderId}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    id: data.id,
    status: data.status,
    captureId: capture?.id || null,
  };
}

// ── Refund Capture ──
export async function refundCapture(
  captureId: string,
  amountCents?: number,
  currency = "USD",
): Promise<PayPalRefund> {
  if (isMockMode()) {
    return { id: `MOCK-REFUND-${++mockCounter}`, status: "COMPLETED" };
  }

  const token = await getAccessToken();
  const body: any = {};
  if (amountCents) {
    body.amount = {
      value: centsToPayPalAmount(amountCents),
      currency_code: currency,
    };
  }

  const res = await fetch(`${getBaseUrl()}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `refund-${captureId}-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`PayPal refund failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { id: data.id, status: data.status };
}

// ── Verify Webhook Signature ──
export async function verifyWebhookSignature(
  headers: Record<string, string>,
  body: string,
  webhookId?: string,
): Promise<boolean> {
  if (isMockMode()) return true;

  const wid = webhookId || process.env.PAYPAL_WEBHOOK_ID;
  if (!wid) return false;

  const token = await getAccessToken();
  const res = await fetch(`${getBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: wid,
      webhook_event: JSON.parse(body),
    }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}
