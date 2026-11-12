/**
 * /api/policy/route.ts — Policy CRUD and natural-language compilation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPolicyConfig, savePolicy, createAuditLog, getPolicyVersion } from "@/lib/db";
import { PolicySchema, DEFAULT_POLICY } from "@/lib/policy/schema";
import { signMandate } from "@/lib/mandate/sign";
import { createMandate } from "@/lib/db";
import { formatINR, inrToUsd } from "@/lib/money";

const DEMO_USER = "demo-user-1";

// GET — fetch current policy
export async function GET() {
  try {
    const config = getPolicyConfig(DEMO_USER);
    const version = getPolicyVersion(DEMO_USER);
    return NextResponse.json({ policy: config, version });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — update policy
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PolicySchema.safeParse(body.policy || body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid policy", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Hard ceilings for demo safety
    const clamped = { ...parsed.data };
    clamped.monthlyBudget = Math.min(clamped.monthlyBudget, 200000); // $2000 max
    clamped.perPurchaseCap = Math.min(clamped.perPurchaseCap, 100000); // $1000 max

    const row = savePolicy(DEMO_USER, clamped);

    // Sign leash mandate
    const leashPayload = {
      userId: DEMO_USER,
      policyVersion: row.version,
      policyHash: JSON.stringify(clamped),
      updatedAt: new Date().toISOString(),
    };
    const signed = signMandate(leashPayload);

    createMandate({
      userId: DEMO_USER,
      kind: "LEASH",
      bodyJson: signed.body,
      signature: signed.sig,
      bodyHash: signed.hash,
      policyVersion: row.version,
    });

    createAuditLog({
      userId: DEMO_USER,
      actor: "USER",
      eventType: "POLICY_CHANGED",
      summary: `Policy updated to version ${row.version}`,
      detailJson: { policy: clamped, version: row.version },
    });

    return NextResponse.json({
      policy: clamped,
      version: row.version,
      mandateHash: signed.hash.substring(0, 16),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — compile natural language rule to policy diff
export async function POST(req: NextRequest) {
  try {
    const { sentence } = await req.json();
    if (!sentence) {
      return NextResponse.json({ error: "Sentence is required" }, { status: 400 });
    }

    const currentPolicy = getPolicyConfig(DEMO_USER);
    const proposed = compileNaturalLanguage(sentence, currentPolicy);

    // Detect changes
    const changes: Array<{ field: string; from: any; to: any; isLoosening: boolean }> = [];
    const propKeys = Object.keys(proposed);
    for (const key of propKeys) {
      const old = (currentPolicy as any)[key];
      const newVal = (proposed as any)[key];
      if (JSON.stringify(old) !== JSON.stringify(newVal)) {
        const isLoosening = detectLoosening(key, old, newVal);
        changes.push({ field: key, from: old, to: newVal, isLoosening });
      }
    }

    const hasLoosening = changes.some(c => c.isLoosening);
    const summary = generatePolicySummary(proposed);

    return NextResponse.json({
      proposed,
      changes,
      hasLoosening,
      summary,
      requiresExtraConfirmation: hasLoosening,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Natural language → policy compiler (deterministic, no LLM) ──
function compileNaturalLanguage(sentence: string, current: any): any {
  const proposed = { ...current };
  const s = sentence.toLowerCase();

  // Budget patterns
  const budgetMatch = s.match(/budget.*?(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*)/);
  if (budgetMatch) proposed.monthlyBudget = Math.min(inrToUsd(parseInt(budgetMatch[1].replace(/,/g, ""))), 200000);

  // Per-purchase cap
  const capMatch = s.match(/(?:cap|limit|max|more than|most).*?(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*)/);
  if (capMatch && !s.includes("budget")) proposed.perPurchaseCap = Math.min(inrToUsd(parseInt(capMatch[1].replace(/,/g, ""))), 100000);

  // Approval threshold
  const approvalMatch = s.match(/(?:ask|approve|approval|confirm).*?(?:above|over|more than).*?(?:₹|rs\.?|inr|\$)?\s*(\d[\d,]*)/i);
  if (approvalMatch) proposed.requireApprovalOver = inrToUsd(parseInt(approvalMatch[1].replace(/,/g, "")));

  // Freeze
  if (s.includes("freeze") || s.includes("pause") || s.includes("stop all") || s.includes("block all")) {
    proposed.frozen = true;
  }
  if (s.includes("unfreeze") || s.includes("resume") || s.includes("unblock")) {
    proposed.frozen = false;
  }

  // Merchants
  const noMerchant = s.match(/(?:no|block|don't allow|ban)\s+(?:purchases?\s+(?:from|on)\s+)?(\w+\.(?:com|org|net))/i);
  if (noMerchant) {
    proposed.blockedMerchants = [...(proposed.blockedMerchants || []), noMerchant[1]];
  }

  const onlyFrom = s.match(/only\s+(?:from|at|on)\s+([\w.]+(?:,\s*[\w.]+)*)/i);
  if (onlyFrom) {
    proposed.allowedMerchants = onlyFrom[1].split(",").map((m: string) => m.trim());
  }

  // Categories
  if (s.includes("no gift card")) {
    if (!proposed.blockedCategories.includes("gift cards")) {
      proposed.blockedCategories = [...proposed.blockedCategories, "gift cards"];
    }
  }
  if (s.includes("no alcohol")) {
    if (!proposed.blockedCategories.includes("alcohol")) {
      proposed.blockedCategories = [...proposed.blockedCategories, "alcohol"];
    }
  }

  // In-stock requirement
  if (s.includes("only in stock") || s.includes("must be in stock")) {
    proposed.requireInStock = true;
  }

  return proposed;
}

function detectLoosening(field: string, oldVal: any, newVal: any): boolean {
  // Higher limits, fewer blocks = loosening
  if (["monthlyBudget", "perPurchaseCap", "velocityLimitCents"].includes(field)) {
    return newVal > oldVal;
  }
  if (["requireApprovalOver", "autoApproveUnder"].includes(field)) {
    return newVal > oldVal;
  }
  if (field === "frozen" && oldVal === true && newVal === false) return true;
  if (field === "blockedMerchants" || field === "blockedCategories") {
    return Array.isArray(newVal) && Array.isArray(oldVal) && newVal.length < oldVal.length;
  }
  if (field === "requireInStock" && oldVal === true && newVal === false) return true;
  return false;
}

function generatePolicySummary(policy: any): string {
  const parts: string[] = [];
  parts.push(`The agent may spend up to ${formatINR(policy.monthlyBudget)} this month`);
  parts.push(`at most ${formatINR(policy.perPurchaseCap)} per purchase`);
  parts.push(`and must ask you above ${formatINR(policy.requireApprovalOver)}`);

  if (policy.allowedMerchants?.length > 0) {
    parts.push(`only from ${policy.allowedMerchants.join(", ")}`);
  }
  if (policy.blockedCategories?.length > 0) {
    parts.push(`with ${policy.blockedCategories.join(" and ")} blocked`);
  }
  if (policy.frozen) {
    parts.push("(CURRENTLY FROZEN)");
  }

  return parts.join(", ") + ".";
}
