/**
 * policy/schema.ts — Zod schemas, inferred types, and defaults for the
 * LeashPay policy engine.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Policy schema
// ---------------------------------------------------------------------------

export const PolicySchema = z.object({
  currency: z.string().default("USD"),
  monthlyBudget: z.number().int().default(50_000),          // cents
  perPurchaseCap: z.number().int().default(30_000),          // cents
  autoApproveUnder: z.number().int().default(2_500),         // cents
  requireApprovalOver: z.number().int().default(2_500),      // cents
  allowedMerchants: z.array(z.string()).default([]),
  blockedMerchants: z.array(z.string()).default([]),
  blockedCategories: z
    .array(z.string())
    .default(["gift cards", "alcohol"]),
  requireInStock: z.boolean().default(true),
  maxPriceVsHistoryPct: z.number().default(25),              // percent
  frozen: z.boolean().default(false),
  frozenUntil: z.string().nullable().default(null),          // ISO date
  leashExpiresAt: z.string().nullable().default(null),       // ISO date
  guardianLabel: z.string().nullable().default(null),
  velocityWindowHours: z.number().default(24),
  velocityLimitCents: z.number().int().default(20_000),      // cents
});

export type Policy = z.infer<typeof PolicySchema>;

export const DEFAULT_POLICY: Policy = PolicySchema.parse({});

// ---------------------------------------------------------------------------
// Purchase request schema
// ---------------------------------------------------------------------------

export const PurchaseRequestSchema = z.object({
  productId: z.string(),
  offerId: z.string(),
  title: z.string(),
  merchant: z.string(),                                      // domain
  category: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  inStock: z.boolean(),
  priceHistoryAvgCents: z.number().int().nullable(),
  agentProfileId: z.string().nullable(),
});

export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;

// ---------------------------------------------------------------------------
// Policy decision type
// ---------------------------------------------------------------------------

export interface PolicyTrace {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface PolicyDecision {
  decision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY";
  reasons: string[];
  trace: PolicyTrace[];
  remainingBudgetAfter: number; // cents
  riskScore: number;            // 0-100
}

// ---------------------------------------------------------------------------
// Ledger state for policy evaluation
// ---------------------------------------------------------------------------

export interface LedgerState {
  capturedCents: number;
  reservedCents: number;
  recentPurchases: Array<{
    amountCents: number;
    createdAt: Date;
    autoApproved: boolean;
  }>;
}
