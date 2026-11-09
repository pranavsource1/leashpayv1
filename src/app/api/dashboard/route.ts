/**
 * /api/dashboard/route.ts — Dashboard data: spend summary, savings, budget.
 */

import { NextResponse } from "next/server";
import { getLedger, getSpendSummary, getSavingsSummary, getPolicyConfig } from "@/lib/db";
import { formatUSD } from "@/lib/money";

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
        totalFormatted: formatUSD(policy.monthlyBudget),
        captured: ledger.captured_cents,
        capturedFormatted: formatUSD(ledger.captured_cents),
        reserved: ledger.reserved_cents,
        reservedFormatted: formatUSD(ledger.reserved_cents),
        remaining,
        remainingFormatted: formatUSD(remaining),
        remainingPct: Math.round((remaining / policy.monthlyBudget) * 100),
        frozen: policy.frozen,
      },
      spend: {
        byMerchant: spend.byMerchant.map(m => ({
          ...m,
          totalFormatted: formatUSD(m.total),
        })),
        byCategory: spend.byCategory.map(c => ({
          ...c,
          totalFormatted: formatUSD(c.total),
        })),
        byDecision: spend.byDecision,
      },
      savings: {
        blockedTotal: savings.blockedTotal,
        blockedTotalFormatted: formatUSD(savings.blockedTotal),
        blockedCount: savings.blockedCount,
        savingsTotal: savings.savingsTotal,
        savingsTotalFormatted: formatUSD(savings.savingsTotal),
        savingsCount: savings.savingsCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
