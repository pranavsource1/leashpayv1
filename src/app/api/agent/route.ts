/**
 * /api/agent/route.ts — Agent chat endpoint.
 * Processes user messages, runs tools, and streams responses.
 */

import { NextRequest, NextResponse } from "next/server";
import { ALL_TOOLS } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { createAuditLog } from "@/lib/db";

const MAX_TOOL_STEPS = 8;

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build conversation
    const messages = [
      ...history,
      { role: "user", content: message },
    ];

    // Simple tool-calling loop without LLM (since we may not have an API key)
    // This acts as a deterministic agent that interprets commands
    const response = await processAgentMessage(message, messages);

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Agent error:", err);
    return NextResponse.json(
      { error: err.message || "Agent processing failed" },
      { status: 500 }
    );
  }
}

async function processAgentMessage(message: string, _history: any[]) {
  const msg = message.toLowerCase();
  const toolResults: any[] = [];
  let reply = "";

  // Deterministic command interpretation (works without LLM API key)
  if (msg.includes("search") || msg.includes("find") || msg.includes("looking for")) {
    // Extract search query
    const query = message
      .replace(/^(search|find|looking for|show me|i want|i need|get me)\s*/i, "")
      .replace(/under \$?\d+/i, "")
      .trim();
    const maxPriceMatch = message.match(/under \$?(\d+)/i);
    const maxPrice = maxPriceMatch ? parseInt(maxPriceMatch[1]) : undefined;

    const result = await ALL_TOOLS[0].execute({ query: query || message, maxPrice });
    toolResults.push({ tool: "search_products", result });

    if (result.products.length === 0) {
      reply = `I couldn't find any products matching "${query}". Try a different search term.`;
    } else {
      reply = `I found ${result.products.length} product(s) matching "${query}":\n\n`;
      for (const p of result.products) {
        reply += `**${p.title}** — Best price: ${p.bestPrice} (${p.offerCount} offers, ${p.inStock ? "In Stock" : "Out of Stock"})\n`;
        for (const o of p.offers) {
          reply += `  • ${o.merchant}: ${o.price} ${o.inStock ? "✓" : "✗"}\n`;
        }
        reply += "\n";
      }
      reply += "\nWould you like me to check the policy for any of these, or compare offers?";
    }
  } else if (msg.includes("compare") || msg.includes("offers for")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    if (prodIdMatch) {
      const result = await ALL_TOOLS[2].execute({ productId: prodIdMatch[0] });
      toolResults.push({ tool: "compare_offers", result });
      if ("offers" in result) {
        reply = `**Offer Comparison for ${result.productTitle}:**\n\n`;
        for (const o of result.offers) {
          reply += `${o.isBestDeal ? "🏆 " : "  "}${o.merchant}: ${o.price} ${o.inStock ? "✓ In Stock" : "✗ Out of Stock"}\n`;
        }
        if (result.bestDeal) {
          reply += `\n**Best Deal:** ${result.bestDeal.merchant} at ${result.bestDeal.price}`;
        }
      }
    } else {
      reply = "Please specify a product ID to compare offers. You can find product IDs from search results.";
    }
  } else if (msg.includes("check policy") || msg.includes("can i buy") || msg.includes("would") && msg.includes("allowed")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    const offerIdMatch = message.match(/off-[\w-]+/);
    if (prodIdMatch && offerIdMatch) {
      const result = await ALL_TOOLS[4].execute({ productId: prodIdMatch[0], offerId: offerIdMatch[0] });
      toolResults.push({ tool: "check_policy", result });
      if ("decision" in result) {
        const emoji = result.decision === "ALLOW" ? "✅" : result.decision === "REQUIRE_APPROVAL" ? "⚠️" : "❌";
        reply = `**Policy Check ${emoji} ${result.decision}**\n\n`;
        reply += `Product: ${result.product}\nMerchant: ${result.merchant}\nPrice: ${result.price}\n\n`;
        reply += `**Reasons:** ${result.reasons.join("; ")}\n`;
        reply += `**Remaining Budget After:** ${result.remainingBudgetAfter}\n`;
        reply += `**Risk Score:** ${result.riskScore}/100\n`;
      }
    } else {
      reply = "Please specify a product ID and offer ID to check the policy.";
    }
  } else if (msg.includes("buy") || msg.includes("purchase") || msg.includes("order")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    const offerIdMatch = message.match(/off-[\w-]+/);
    if (prodIdMatch && offerIdMatch) {
      const result = await ALL_TOOLS[5].execute({ productId: prodIdMatch[0], offerId: offerIdMatch[0] });
      toolResults.push({ tool: "request_purchase", result });
      if (result.type === "purchase_denied") {
        reply = `❌ **Purchase DENIED**\n\n**Reasons:** ${result.reasons.join("; ")}\n\nI'd suggest looking for a more affordable alternative or from an allowed merchant.`;
      } else if (result.type === "purchase_requested") {
        reply = `${result.decision === "ALLOW" ? "✅" : "⚠️"} **Purchase ${result.decision}**\n\n`;
        reply += `**Purchase ID:** ${result.purchaseRequestId}\n`;
        if (result.approvalUrl) {
          reply += `**Approval URL:** ${result.approvalUrl}\n`;
        }
        if (result.guardianApprovalUrl) {
          reply += `**Guardian Approval:** ${result.guardianApprovalUrl}\n`;
        }
        reply += `**Reasons:** ${result.reasons.join("; ")}\n`;
        reply += `**Risk Score:** ${result.riskScore}/100\n`;
      }
    } else {
      reply = "Please specify a product ID and offer ID to purchase. Use `search` first to find products.";
    }
  } else if (msg.includes("budget") || msg.includes("status") || msg.includes("remaining")) {
    const result = await ALL_TOOLS[6].execute({});
    toolResults.push({ tool: "get_budget_status", result });
    reply = `**Budget Status:**\n\n`;
    reply += `Monthly Budget: ${result.monthlyBudget}\n`;
    reply += `Spent (Captured): ${result.captured}\n`;
    reply += `Reserved: ${result.reserved}\n`;
    reply += `Remaining: ${result.remaining} (${result.remainingPct}%)\n`;
    reply += `Per-Purchase Cap: ${result.perPurchaseCap}\n`;
    reply += `Approval Threshold: ${result.approvalThreshold}\n`;
    reply += `Frozen: ${result.frozen ? "Yes 🔒" : "No"}\n`;
    if (result.recentPurchases.length > 0) {
      reply += `\n**Recent Purchases:**\n`;
      for (const p of result.recentPurchases) {
        reply += `• ${p.title} — ${p.amount} (${p.status}) from ${p.merchant}\n`;
      }
    }
  } else if (msg.includes("price history") || msg.includes("price trend")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    if (prodIdMatch) {
      const result = await ALL_TOOLS[3].execute({ productId: prodIdMatch[0] });
      toolResults.push({ tool: "get_price_history", result });
      if ("average" in result) {
        reply = `**Price History:**\n\nAverage: ${result.average}\nMin: ${result.min}\nMax: ${result.max}\nData Points: ${result.dataPointCount}\n`;
      }
    } else {
      reply = "Please specify a product ID to get price history.";
    }
  } else {
    reply = `I'm your shopping assistant! Here's what I can do:\n\n`;
    reply += `• **Search products:** "Find me a 27-inch 4K monitor under $350"\n`;
    reply += `• **Compare offers:** "Compare offers for prod-mon-001"\n`;
    reply += `• **Check policy:** "Check policy for prod-mon-001 off-001a"\n`;
    reply += `• **Buy:** "Buy prod-mon-001 off-001a"\n`;
    reply += `• **Budget status:** "Show my budget"\n`;
    reply += `• **Price history:** "Price history for prod-mon-001"\n`;
    reply += `\nWhat would you like to search for?`;
  }

  createAuditLog({
    userId: "demo-user-1",
    actor: "AGENT",
    eventType: "SEARCH",
    summary: `Agent processed: "${message.substring(0, 100)}"`,
    detailJson: { message, toolResults: toolResults.map(t => t.tool) },
  });

  return {
    reply,
    toolResults,
  };
}
