/**
 * policy/engine.ts — Pure-function policy engine.
 * evaluate(request, policy, ledger) → PolicyDecision
 * No network calls, no LLM — easy to unit test.
 */

import { formatUSD } from "../money";
import type {
  Policy,
  PurchaseRequest,
  LedgerState,
  PolicyDecision,
  PolicyTrace,
} from "./schema";

export function evaluate(
  request: PurchaseRequest,
  policy: Policy,
  ledger: LedgerState,
): PolicyDecision {
  const trace: PolicyTrace[] = [];
  const reasons: string[] = [];
  let decision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY" = "ALLOW";
  let softApproval = false;

  const amt = request.amountCents;
  const totalSpend = ledger.capturedCents + ledger.reservedCents;
  const remainingAfter = policy.monthlyBudget - totalSpend - amt;

  // Helper to record a DENY
  function deny(rule: string, detail: string) {
    trace.push({ rule, passed: false, detail });
    reasons.push(detail);
    decision = "DENY";
  }

  // Helper to record soft REQUIRE_APPROVAL
  function requireApproval(rule: string, detail: string) {
    trace.push({ rule, passed: false, detail });
    reasons.push(detail);
    softApproval = true;
  }

  // Helper to record a pass
  function pass(rule: string, detail: string) {
    trace.push({ rule, passed: true, detail });
  }

  // ── Rule 1: Kill switch (frozen) ──
  const now = new Date();
  if (policy.frozen) {
    deny("kill_switch", "Leash is frozen — all spending is disabled");
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  if (policy.frozenUntil && new Date(policy.frozenUntil) > now) {
    deny("kill_switch", `Leash is frozen until ${policy.frozenUntil}`);
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("kill_switch", "Leash is not frozen");

  // ── Rule 2: Mandate expiry ──
  if (policy.leashExpiresAt && new Date(policy.leashExpiresAt) < now) {
    deny("mandate_expiry", `Leash mandate expired at ${policy.leashExpiresAt}`);
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("mandate_expiry", policy.leashExpiresAt ? `Mandate valid until ${policy.leashExpiresAt}` : "No expiry set");

  // ── Rule 3: Currency mismatch ──
  if (request.currency.toUpperCase() !== policy.currency.toUpperCase()) {
    deny("currency", `Offer currency ${request.currency} does not match policy currency ${policy.currency}`);
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("currency", `Currency ${request.currency} matches policy`);

  // ── Rule 4: Merchant check ──
  const merchant = request.merchant.toLowerCase();
  if (policy.blockedMerchants.map(m => m.toLowerCase()).includes(merchant)) {
    deny("merchant_blocklist", `${request.merchant} is blocked`);
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  if (policy.allowedMerchants.length > 0 && !policy.allowedMerchants.map(m => m.toLowerCase()).includes(merchant)) {
    deny("merchant_allowlist", `${request.merchant} is not on the allowed list`);
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("merchant_check", policy.allowedMerchants.length > 0
    ? `${request.merchant} is on the allowed list`
    : `No merchant restrictions`);

  // ── Rule 5: Category blocklist ──
  const category = request.category.toLowerCase();
  const blocked = policy.blockedCategories.map(c => c.toLowerCase());
  if (blocked.includes(category)) {
    deny("category_blocklist", `Category "${request.category}" is blocked`);
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("category_blocklist", `Category "${request.category}" is allowed`);

  // ── Rule 6: In-stock check ──
  if (!request.inStock && policy.requireInStock) {
    deny("in_stock", "Offer is out of stock and policy requires in-stock items");
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("in_stock", request.inStock ? "Item is in stock" : "Out-of-stock allowed by policy");

  // ── Rule 7: Per-purchase cap ──
  if (amt > policy.perPurchaseCap) {
    deny("per_purchase_cap", `${formatUSD(amt)} exceeds per-purchase cap of ${formatUSD(policy.perPurchaseCap)}`);
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("per_purchase_cap", `${formatUSD(amt)} <= ${formatUSD(policy.perPurchaseCap)} cap`);

  // ── Rule 8: Monthly budget ──
  if (totalSpend + amt > policy.monthlyBudget) {
    deny(
      "monthly_budget",
      `${formatUSD(amt)} + current spend ${formatUSD(totalSpend)} = ${formatUSD(totalSpend + amt)} exceeds monthly budget ${formatUSD(policy.monthlyBudget)}`
    );
    return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
  }
  pass("monthly_budget", `${formatUSD(amt)} + ${formatUSD(totalSpend)} = ${formatUSD(totalSpend + amt)} <= ${formatUSD(policy.monthlyBudget)} budget`);

  // ── Rule 9: Velocity check ──
  const windowMs = policy.velocityWindowHours * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs);
  const recentTotal = ledger.recentPurchases
    .filter(p => p.createdAt >= windowStart)
    .reduce((sum, p) => sum + p.amountCents, 0);
  if (recentTotal + amt > policy.velocityLimitCents) {
    requireApproval(
      "velocity",
      `${formatUSD(recentTotal + amt)} in purchases within ${policy.velocityWindowHours}h exceeds velocity limit ${formatUSD(policy.velocityLimitCents)}`
    );
  } else {
    pass("velocity", `${formatUSD(recentTotal + amt)} within ${policy.velocityWindowHours}h <= ${formatUSD(policy.velocityLimitCents)} velocity limit`);
  }

  // ── Rule 10: Price vs history ──
  if (request.priceHistoryAvgCents && request.priceHistoryAvgCents > 0) {
    const pctAbove = ((amt - request.priceHistoryAvgCents) / request.priceHistoryAvgCents) * 100;
    if (pctAbove > policy.maxPriceVsHistoryPct) {
      requireApproval(
        "price_vs_history",
        `Price is ${pctAbove.toFixed(1)}% above historical average ${formatUSD(request.priceHistoryAvgCents)} (threshold: ${policy.maxPriceVsHistoryPct}%)`
      );
    } else {
      pass("price_vs_history", `Price is ${pctAbove.toFixed(1)}% vs average (threshold: ${policy.maxPriceVsHistoryPct}%)`);
    }
  } else {
    pass("price_vs_history", "No price history available — skipped");
  }

  // ── Rule 11: Require approval over threshold ──
  if (amt > policy.requireApprovalOver) {
    requireApproval(
      "approval_threshold",
      `${formatUSD(amt)} exceeds approval threshold ${formatUSD(policy.requireApprovalOver)}`
    );
  } else {
    pass("approval_threshold", `${formatUSD(amt)} <= ${formatUSD(policy.requireApprovalOver)} threshold`);
  }

  if (softApproval) {
    decision = "REQUIRE_APPROVAL";
  }

  return finalize(decision, reasons, trace, remainingAfter, request, policy, ledger);
}

function finalize(
  decision: "ALLOW" | "REQUIRE_APPROVAL" | "DENY",
  reasons: string[],
  trace: PolicyTrace[],
  remainingBudgetAfter: number,
  request: PurchaseRequest,
  policy: Policy,
  ledger: LedgerState,
): PolicyDecision {
  const riskScore = computeRiskScore(request, policy, ledger);

  // Risk score >= 70 forces REQUIRE_APPROVAL (never overrides DENY)
  if (decision === "ALLOW" && riskScore >= 70) {
    decision = "REQUIRE_APPROVAL";
    reasons.push(`Risk score ${riskScore} >= 70 — requires approval`);
    trace.push({ rule: "risk_score", passed: false, detail: `Risk score ${riskScore} forces approval` });
  } else {
    trace.push({ rule: "risk_score", passed: true, detail: `Risk score: ${riskScore}` });
  }

  return {
    decision,
    reasons: reasons.length > 0 ? reasons : ["All rules passed"],
    trace,
    remainingBudgetAfter: Math.max(0, remainingBudgetAfter),
    riskScore,
  };
}

function computeRiskScore(
  request: PurchaseRequest,
  policy: Policy,
  ledger: LedgerState,
): number {
  let score = 0;

  // First purchase from this merchant: +20
  const hasMerchantHistory = ledger.recentPurchases.length > 0; // simplified
  if (!hasMerchantHistory) score += 20;

  // Price above recorded average: +25
  if (request.priceHistoryAvgCents && request.amountCents > request.priceHistoryAvgCents) {
    score += 25;
  }

  // Amount > 80% of cap: +15
  if (request.amountCents > policy.perPurchaseCap * 0.8) {
    score += 15;
  }

  // Velocity near limit (>80%): +20
  const now = new Date();
  const windowMs = policy.velocityWindowHours * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs);
  const recentTotal = ledger.recentPurchases
    .filter(p => p.createdAt >= windowStart)
    .reduce((sum, p) => sum + p.amountCents, 0);
  if (recentTotal + request.amountCents > policy.velocityLimitCents * 0.8) {
    score += 20;
  }

  // First purchase in category: +10
  // Simplified: add 10 for first purchase overall
  if (ledger.recentPurchases.length === 0) score += 10;

  return Math.min(100, score);
}
