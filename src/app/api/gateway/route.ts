/**
 * /api/gateway/route.ts — MCP gateway endpoint for external agents.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getAgentProfileByKey } from "@/lib/db";
import { ALL_TOOLS } from "@/lib/agent/tools";
import { createAuditLog } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    // Look up agent profile (or allow demo key)
    let agentName = "Unknown Agent";
    let agentProfileId: string | null = null;

    if (apiKey === "demo-agent-key") {
      agentName = "Demo Agent";
    } else {
      const profile = getAgentProfileByKey(keyHash);
      if (!profile) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
      }
      agentName = profile.name;
      agentProfileId = profile.id;
    }

    const body = await req.json();
    const { tool, params } = body;

    if (!tool) {
      return NextResponse.json({
        error: "Missing 'tool' field",
        availableTools: ALL_TOOLS.map(t => ({ name: t.name, description: t.description })),
      }, { status: 400 });
    }

    // Find and execute the tool
    const toolDef = ALL_TOOLS.find(t => t.name === tool);
    if (!toolDef) {
      return NextResponse.json({
        error: `Unknown tool: ${tool}`,
        availableTools: ALL_TOOLS.map(t => t.name),
      }, { status: 400 });
    }

    createAuditLog({
      userId: "demo-user-1",
      actor: "AGENT",
      eventType: "SEARCH",
      summary: `[${agentName}] Called ${tool}`,
      detailJson: { agent: agentName, tool, params },
      agentProfileId,
    });

    const result = await toolDef.execute(params || {});

    return NextResponse.json({
      agent: agentName,
      tool,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
