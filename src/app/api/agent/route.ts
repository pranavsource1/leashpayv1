/**
 * /api/agent/route.ts — Agent chat endpoint.
 * Processes user messages, runs tools, and streams responses.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  searchProductsTool,
  getProductTool,
  compareOffersTool,
  getPriceHistoryTool,
  checkPolicyTool,
  requestPurchaseTool,
  getBudgetStatusTool,
} from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { createAuditLog } from "@/lib/db";

const MAX_TOOL_STEPS = 8;
const DEMO_USER = "demo-user-1";

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
    // Extract search query - be more careful with extraction
    let query = message;
    
    // Remove common command prefixes
    query = query.replace(/^(can you |could you |please |)?(search for|find|find me|looking for|show me|i want|i need|get me)\s+/i, "");
    
    // Extract price if mentioned
    const maxPriceMatch = message.match(/under\s*(?:rs\.?|₹|\$)?\s*(\d+)/i);
    let maxPrice = maxPriceMatch ? parseInt(maxPriceMatch[1]) : undefined;
    
    // Convert INR to USD if needed (rough conversion: 1 USD = 83 INR)
    if (message.match(/\brs\b|₹/i) && maxPrice) {
      maxPrice = Math.round(maxPrice / 83); // Convert INR to USD
    }
    
    // Remove price from query
    query = query.replace(/under\s*(?:rs\.?|₹|\$)?\s*\d+/i, "").trim();
    
    // Clean up extra spaces
    query = query.replace(/\s+/g, " ").trim();
    
    // If query is too short or empty, use original message
    if (!query || query.length < 2) {
      query = message.replace(/^(search for|find|find me|looking for|show me)\s*/i, "").trim();
    }

    const result = await searchProductsTool.execute({ query, maxPrice });
    toolResults.push({ tool: "search_products", result });

    if (result.type === "search_results") {
      if (result.products.length === 0) {
        reply = `I couldn't find any products matching "${query}". Try a different search term or be more specific (e.g., "headphones", "monitor", "laptop").`;
      } else {
        reply = `I found ${result.products.length} product(s) matching "${query}":\n\n`;
        for (const p of result.products) {
          reply += `**${p.title}** (ID: ${p.id})\n`;
          reply += `  Best price: ${p.bestPrice} • ${p.offerCount} offers • ${p.inStock ? "In Stock ✓" : "Out of Stock ✗"}\n`;
          reply += `  Offers:\n`;
          for (const o of p.offers.slice(0, 3)) {
            reply += `    • ${o.merchant}: ${o.price} ${o.inStock ? "✓" : "✗"} (ID: ${o.id})\n`;
          }
          reply += "\n";
        }
        reply += "\nWould you like me to check the policy for any of these, or compare offers?";
      }
    } else {
      reply = "Error searching for products.";
    }
  } else if (msg.includes("compare") || msg.includes("offers for")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    if (prodIdMatch) {
      const result = await compareOffersTool.execute({ productId: prodIdMatch[0] });
      toolResults.push({ tool: "compare_offers", result });
      
      if (result.type === "offer_comparison") {
        reply = `**Offer Comparison for ${result.productTitle}:**\n\n`;
        for (const o of result.offers) {
          reply += `${o.isBestDeal ? "🏆 " : "  "}${o.merchant}: ${o.price} ${o.inStock ? "✓ In Stock" : "✗ Out of Stock"} (ID: ${o.id})\n`;
        }
        if (result.bestDeal) {
          reply += `\n**Best Deal:** ${result.bestDeal.merchant} at ${result.bestDeal.price}`;
        }
      } else if (result.type === "error") {
        reply = `Error: ${result.message}`;
      }
    } else {
      reply = "Please specify a product ID to compare offers. You can find product IDs from search results.";
    }
  } else if (msg.includes("check policy") || msg.includes("can i buy") || msg.includes("would") && msg.includes("allowed")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    const offerIdMatch = message.match(/off-[\w-]+/);
    if (prodIdMatch && offerIdMatch) {
      const result = await checkPolicyTool.execute({ productId: prodIdMatch[0], offerId: offerIdMatch[0] });
      toolResults.push({ tool: "check_policy", result });
      
      if (result.type === "policy_check") {
        const emoji = result.decision === "ALLOW" ? "✅" : result.decision === "REQUIRE_APPROVAL" ? "⚠️" : "❌";
        reply = `**Policy Check ${emoji} ${result.decision}**\n\n`;
        reply += `Product: ${result.product}\nMerchant: ${result.merchant}\nPrice: ${result.price}\n\n`;
        reply += `**Reasons:** ${result.reasons.join("; ")}\n`;
        reply += `**Remaining Budget After:** ${result.remainingBudgetAfter}\n`;
        reply += `**Risk Score:** ${result.riskScore}/100\n`;
      } else if (result.type === "error") {
        reply = `Error: ${result.message}`;
      }
    } else {
      reply = "Please specify a product ID and offer ID to check the policy. Example: `check policy for prod-mon-001 off-001a`";
    }
  } else if (msg.includes("buy") || msg.includes("purchase") || msg.includes("order")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    const offerIdMatch = message.match(/off-[\w-]+/);
    if (prodIdMatch && offerIdMatch) {
      const result = await requestPurchaseTool.execute({ productId: prodIdMatch[0], offerId: offerIdMatch[0] });
      toolResults.push({ tool: "request_purchase", result });
      
      if (result.type === "purchase_denied") {
        reply = `❌ **Purchase DENIED**\n\n`;
        if (result.reasons) {
          reply += `**Reasons:** ${result.reasons.join("; ")}\n\n`;
        }
        reply += `I'd suggest looking for a more affordable alternative or from an allowed merchant.`;
      } else if (result.type === "purchase_requested") {
        reply = `${result.decision === "ALLOW" ? "✅" : "⚠️"} **Purchase ${result.decision}**\n\n`;
        if (result.purchaseRequestId) {
          reply += `**Purchase ID:** ${result.purchaseRequestId}\n`;
        }
        if (result.approvalUrl) {
          reply += `**Approval URL:** ${result.approvalUrl}\n`;
        }
        if (result.guardianApprovalUrl) {
          reply += `**Guardian Approval:** ${result.guardianApprovalUrl}\n`;
        }
        if (result.reasons) {
          reply += `**Reasons:** ${result.reasons.join("; ")}\n`;
        }
        reply += `**Risk Score:** ${result.riskScore}/100\n`;
      }
    } else {
      reply = "Please specify a product ID and offer ID to purchase. Example: `buy prod-mon-001 off-001a`\nUse `search` first to find products.";
    }
  } else if (msg.includes("budget") || msg.includes("status") || msg.includes("remaining")) {
    const result = await getBudgetStatusTool.execute();
    toolResults.push({ tool: "get_budget_status", result });
    
    if (result.type === "budget_status") {
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
    }
  } else if (msg.includes("price history") || msg.includes("price trend")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    if (prodIdMatch) {
      const result = await getPriceHistoryTool.execute({ productId: prodIdMatch[0] });
      toolResults.push({ tool: "get_price_history", result });
      
      if (result.type === "price_history") {
        reply = `**Price History:**\n\nAverage: ${result.average}\nMin: ${result.min}\nMax: ${result.max}\nData Points: ${result.dataPointCount}\n`;
      } else if (result.type === "error") {
        reply = `Error: ${result.message}`;
      }
    } else {
      reply = "Please specify a product ID to get price history. Example: `price history for prod-mon-001`";
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
    userId: DEMO_USER,
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
