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
  // Check for search intent first (before buy intent)
  if (
    msg.includes("search") || 
    msg.includes("find") || 
    msg.includes("looking for") || 
    msg.includes("show me") ||
    (msg.includes("want") && !msg.match(/prod-[\w-]+/)) || // "want" without product ID = search
    (msg.includes("buy") && !msg.match(/prod-[\w-]+/)) ||  // "buy" without product ID = search
    (msg.includes("need") && !msg.match(/prod-[\w-]+/))    // "need" without product ID = search
  ) {
    // Extract search query - be more careful with extraction
    let query = message;
    
    // Remove common command prefixes more aggressively
    query = query.replace(/^(can you |could you |please |would you |i want to |i need to |i'd like to |help me |i wanna |let me )/i, "");
    query = query.replace(/^(search for|search|find me|find|looking for|show me|show|i want|i need|get me|buy me|buy|get|purchase)\s+/i, "");
    
    // Extract price if mentioned (support USD, INR, RS, ₹)
    const maxPriceMatch = message.match(/under\s*(?:rs\.?|₹|\$|rupees?|dollars?)?\s*(\d+)/i);
    let maxPrice = maxPriceMatch ? parseInt(maxPriceMatch[1]) : undefined;
    
    // Convert INR to USD if needed (1 USD ≈ 83 INR)
    if (message.match(/\brs\b|₹|rupees?/i) && maxPrice) {
      maxPrice = Math.round(maxPrice / 83); // Convert INR to USD for search
    }
    
    // Remove price from query
    query = query.replace(/under\s*(?:rs\.?|₹|\$|rupees?|dollars?)?\s*\d+/i, "").trim();
    
    // Remove "to " prefix that might remain
    query = query.replace(/^(to|a|an|some)\s+/i, "");
    
    // Clean up extra spaces
    query = query.replace(/\s+/g, " ").trim();
    
    // If query is too short or empty, extract product type
    if (!query || query.length < 2) {
      const productMatch = message.match(/\b(monitor|laptop|headphone|keyboard|mouse|webcam|cable|speaker|phone|tablet|watch|tv|television)\w*/i);
      query = productMatch ? productMatch[0] : message.replace(/^(search for|search|find|find me|looking for|show me|show|buy|get|purchase)\s*/i, "").trim();
    }

    const result = await searchProductsTool.execute({ query, maxPrice });
    toolResults.push({ tool: "search_products", result });

    if (result.type === "search_results") {
      if (result.products.length === 0) {
        reply = `I couldn't find any products matching "${query}". Try a different search term or be more specific (e.g., "headphones", "monitor", "laptop").`;
      } else {
        const offerCount = result.products.reduce((n: number, p: any) => n + (p.offers?.length ?? 0), 0);
        reply = `I found **${result.products.length} product${result.products.length === 1 ? "" : "s"}** matching "${query}" across ${offerCount} offers.`;
        reply += "\n\nFilter by price, merchant or availability below, then check the policy or compare offers.";
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
        reply = `Here are all offers for **${result.productTitle}**.`;
        if (result.bestDeal) {
          reply += ` The best deal is **${result.bestDeal.merchant} at ${result.bestDeal.price}**.`;
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
        reply = `**Policy: ${result.decision}** — ${result.reasons.join("; ")}`;
        reply += `\n\nYou'd have **${result.remainingBudgetAfter}** left this month afterwards.`;
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
        reply = `**Purchase blocked.**`;
        if (result.reasons) {
          reply += `\n\n${result.reasons.join("; ")}.`;
        }
        reply += `\n\nTry a more affordable alternative or an approved merchant.`;
      } else if (result.type === "purchase_requested") {
        reply = result.decision === "ALLOW"
          ? `**Purchase allowed.** Open the payment link below to finish checkout.`
          : `**Needs approval.** This is over your auto-approve threshold — a guardian needs to sign off below.`;
      }
    } else {
      reply = "Please specify a product ID and offer ID to purchase. Example: `buy prod-mon-001 off-001a`\nUse `search` first to find products.";
    }
  } else if (msg.includes("budget") || msg.includes("status") || msg.includes("remaining")) {
    const result = await getBudgetStatusTool.execute();
    toolResults.push({ tool: "get_budget_status", result });
    
    if (result.type === "budget_status") {
      reply = `You have **${result.remaining}** left this month (${result.remainingPct}% of ${result.monthlyBudget}).`;
      if (result.frozen) {
        reply += `\n\nYour wallet is frozen, so purchases are blocked until you unfreeze it in Policy.`;
      }
    }
  } else if (msg.includes("price history") || msg.includes("price trend")) {
    const prodIdMatch = message.match(/prod-[\w-]+/);
    if (prodIdMatch) {
      const result = await getPriceHistoryTool.execute({ productId: prodIdMatch[0] });
      toolResults.push({ tool: "get_price_history", result });
      
      if (result.type === "price_history") {
        reply = `Over the last **${result.dataPointCount}** price points this item averaged **${result.average}**, ranging ${result.min}–${result.max}.`;
      } else if (result.type === "error") {
        reply = `Error: ${result.message}`;
      }
    } else {
      reply = "Please specify a product ID to get price history. Example: `price history for prod-mon-001`";
    }
  } else {
    reply = `I'm your shopping assistant! Try these:\n\n`;
    reply += `• "Find headphones"\n`;
    reply += `• "I want to buy a monitor under 25000 rs"\n`;
    reply += `• "Search laptops under 50000"\n`;
    reply += `• "Show keyboards"\n`;
    reply += `• "Show my budget"\n`;
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
