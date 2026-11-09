/**
 * /api/agent-profiles/route.ts — Manage agent profiles for MCP gateway.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { getAgentProfiles, createAgentProfile } from "@/lib/db";

const DEMO_USER = "demo-user-1";

export async function GET() {
  try {
    const profiles = getAgentProfiles(DEMO_USER);
    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, subPolicy } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate API key
    const apiKey = `lp_${randomUUID().replace(/-/g, "")}`;
    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    const profile = createAgentProfile({
      userId: DEMO_USER,
      name,
      apiKeyHash: keyHash,
      subPolicyJson: subPolicy ? JSON.stringify(subPolicy) : undefined,
    });

    return NextResponse.json({
      profile,
      apiKey, // Only shown once
      warning: "Save this API key — it cannot be retrieved later",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
