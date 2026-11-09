/**
 * /api/audit/route.ts — Audit log and chain verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs, getAllAuditLogs, tamperAuditRow } from "@/lib/db";
import { verifyChain } from "@/lib/mandate/sign";

const DEMO_USER = "demo-user-1";

// GET — list audit logs, or verify chain
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "verify") {
      // Verify hash chain
      const rows = getAllAuditLogs(DEMO_USER);
      const chainRows = rows.map(r => {
        // Reconstruct payload for hash verification
        const { prev_hash, row_hash, ...rest } = r;
        return {
          prevHash: prev_hash,
          rowHash: row_hash,
          ...rest,
        };
      });

      const result = verifyChain(chainRows);
      return NextResponse.json({
        valid: result.valid,
        brokenAt: result.brokenAt,
        totalRows: rows.length,
        brokenRow: result.brokenAt !== undefined ? rows[result.brokenAt] : null,
      });
    }

    if (action === "tamper") {
      // Simulate tampering for Red Team demo
      const rowId = url.searchParams.get("rowId");
      if (rowId) {
        tamperAuditRow(rowId, 99999);
        return NextResponse.json({ success: true, message: "Row tampered for demo" });
      }
    }

    // Normal list
    const eventType = url.searchParams.get("eventType") || undefined;
    const actor = url.searchParams.get("actor") || undefined;
    const redteamParam = url.searchParams.get("redteam");
    const redteam = redteamParam !== null ? redteamParam === "true" : undefined;
    const limit = parseInt(url.searchParams.get("limit") || "200");

    const logs = getAuditLogs(DEMO_USER, { eventType, actor, redteam, limit });

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
