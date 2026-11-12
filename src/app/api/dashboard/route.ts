/**
 * /api/dashboard/route.ts — Dashboard data: spend summary, savings, budget.
 */

import { NextResponse } from "next/server";
import { getLedger, getSpendSummary, getSavingsSummary, getPolicyConfig } from "@/lib/db";
import { formatINR } from "@/lib/money";

const DEMO_USER = "demo-user-1";

export async function GET() {
  try {
    const policy = getPolicyConfig(DEMO_USER);
    const ledger = getLedger(DEMO_USER);
    const spend = getSpendSummary(DEMO_USER);
    const savings = getSavingsSummary(DEMO_USER);

    const remaining = policy.monthlyBudget - ledger.captured_cents - ledger.reserved_cents;

    return NextResponse.json({
      budget: {
        total: policy.monthlyBudget,
        totalFormatted: formatINR(policy.monthlyBudget),
        captured: ledger.captured_cents,
        capturedFormatted: formatINR(ledger.captured_cents),
        reserved: ledger.reserved_cents,
        reservedFormatted: formatINR(ledger.reserved_cents),
        remaining,
        remainingFormatted: formatINR(remaining),
        remainingPct: Math.round((remaining / policy.monthlyBudget) * 100),
        frozen: policy.frozen,
      },
      spend: {
        byMerchant: spend.byMerchant.map(m => ({
          ...m,
          totalFormatted: formatINR(m.total),
        })),
        byCategory: spend.byCategory.map(c => ({
          ...c,
          totalFormatted: formatINR(c.total),
        })),
        byDecision: spend.byDecision,
      },
      savings: {
        blockedTotal: savings.blockedTotal,
        blockedTotalFormatted: formatINR(savings.blockedTotal),
        blockedCount: savings.blockedCount,
        savingsTotal: savings.savingsTotal,
        savingsTotalFormatted: formatINR(savings.savingsTotal),
        savingsCount: savings.savingsCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
