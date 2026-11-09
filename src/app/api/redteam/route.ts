/**
 * /api/redteam/route.ts — Red Team attack suite runner.
 */

import { NextResponse } from "next/server";
import { runAttackSuite } from "@/lib/redteam/runner";
import { getRedteamRuns } from "@/lib/db";

// POST — run the attack suite
export async function POST() {
  try {
    const result = runAttackSuite();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — get past runs
export async function GET() {
  try {
    const runs = getRedteamRuns();
    return NextResponse.json({ runs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
