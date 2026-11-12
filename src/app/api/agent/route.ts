/**
 * /api/agent/route.ts — Intelligent AI agent with Google Gemini.
 * Uses real LLM for natural conversations, not pattern matching.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
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

const DEMO_USER = "demo-user-1";
const DEFAULT_LLM_MODEL = "gemini-3.1-flash-lite";
const AGENT_TIMEOUT_MS = 30_000;

export async function POST(req: NextRequest) {
  try {
    const { message, history = [], toolContext = [] } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Check if Google AI API key is configured
    console.log("API Key present:", !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    console.log("API Key length:", process.env.GOOGLE_GENERATIVE_AI_API_KEY?.length);
    
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ 
        error: "Google AI API key not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file." 
      }, { status: 500 });
    }

    // Build conversation history for the LLM (without system message - Gemini uses system parameter)
    const messages = [
      ...history.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      })),
      { role: "user" as const, content: message },
    ];

    const directBuy = message.match(/^buy\s+(\S+)\s+(\S+)$/i);
    const contextualBuy = resolveContextualBuy(message, toolContext);
    if (directBuy || contextualBuy) {
      const [, productId, offerId] = directBuy ?? [
        "",
        contextualBuy!.productId,
        contextualBuy!.offerId,
      ];
      const policyResult = await checkPolicyTool.execute({ productId, offerId });
      const toolResults = [{ tool: "check_policy", result: policyResult }];

      if (policyResult.type === "policy_check" && policyResult.decision !== "DENY") {
        toolResults.push({
          tool: "request_purchase",
          result: await requestPurchaseTool.execute({ productId, offerId }),
        });
      }

      return NextResponse.json({
        reply: buildToolReply(toolResults),
        toolResults,
      });
    }

    // Use Google Gemini with tool calling
    const result = await generateText({
      model: google(process.env.LLM_MODEL || DEFAULT_LLM_MODEL),
      system: SYSTEM_PROMPT,
      messages,
      tools: {
        search_products: searchProductsTool as any,
        get_product: getProductTool as any,
        compare_offers: compareOffersTool as any,
        check_policy: checkPolicyTool as any,
        request_purchase: requestPurchaseTool as any,
        get_budget_status: getBudgetStatusTool as any,
        get_price_history: getPriceHistoryTool as any,
      },
      stopWhen: stepCountIs(5),
      maxRetries: 0,
      timeout: AGENT_TIMEOUT_MS,
      temperature: 0.7,
    });

    // Log the interaction
    createAuditLog({
      userId: DEMO_USER,
      actor: "AGENT",
      eventType: "SEARCH",
      summary: `AI agent: "${message.substring(0, 100)}"`,
      detailJson: { 
        message, 
        toolCalls: result.toolCalls?.length || 0,
        response: result.text.substring(0, 200)
      },
    });

    // Extract tool results
    const toolResults = result.toolResults?.map((toolResult: any) => ({
      tool: toolResult.toolName,
      result: toolResult.result ?? toolResult.output,
    })) || [];

    const reply = result.text || buildToolReply(toolResults);

    return NextResponse.json({
      reply,
      toolResults
    });

  } catch (err: any) {
    console.error("Agent error:", err);
    
    // Better error messages
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (errorMessage.includes("API key")) {
      return NextResponse.json(
        { error: "Google AI API key is invalid or missing. Please check your .env.local file." },
        { status: 500 }
      );
    }

    if (
      errorMessage.includes("timed out") ||
      errorMessage.includes("aborted") ||
      errorMessage.includes("high demand") ||
      errorMessage.includes("503")
    ) {
      return NextResponse.json(
        { error: "Google AI is temporarily busy. Please try again in a few seconds." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: errorMessage || "Agent processing failed" },
      { status: 500 }
    );
  }
}

function resolveContextualBuy(
  message: string,
  toolContext: Array<{ tool?: string; result?: any }>,
): { productId: string; offerId: string } | null {
  const normalized = message.trim().toLowerCase();
  const isPurchaseIntent =
    /\b(buy|purchase|order|get|checkout|go ahead)\b/.test(normalized) ||
    /^(yes|yeah|yep|sure|okay|ok)\b/.test(normalized);
  if (!isPurchaseIntent) return null;

  const searchResults = toolContext
    .map((entry) => entry.result)
    .filter((result) => result?.type === "search_results")
    .at(-1);
  if (!searchResults?.products?.length) return null;

  const product = searchResults.products[0];
  const requestedMerchant = product.offers?.find((offer: any) =>
    normalized.includes(String(offer.merchant).toLowerCase()),
  );
  const offer =
    requestedMerchant ??
    product.offers
      ?.filter((candidate: any) => candidate.inStock)
      .sort((a: any, b: any) => {
        const priceA = Number(String(a.price).replace(/[^0-9.]/g, ""));
        const priceB = Number(String(b.price).replace(/[^0-9.]/g, ""));
        return priceA - priceB;
      })[0] ??
    product.offers?.[0];

  return product.id && offer?.id ? { productId: product.id, offerId: offer.id } : null;
}

function buildToolReply(toolResults: Array<{ tool: string; result: any }>): string {
  const latest = toolResults[toolResults.length - 1]?.result;
  if (!latest) return "I couldn't complete that request. Please try again.";

  if (latest.type === "purchase_requested") {
    const decision =
      latest.decision === "REQUIRE_APPROVAL"
        ? "The purchase request is ready and requires approval."
        : "The purchase request is ready for PayPal confirmation.";
    return `${decision} Use the PayPal approval button below to continue.`;
  }

  if (latest.type === "purchase_denied") {
    return `I couldn't place that purchase because the policy denied it: ${(latest.reasons ?? []).join("; ")}`;
  }

  if (latest.type === "purchase_error") {
    return `I couldn't create the PayPal order: ${(latest.reasons ?? []).join("; ")} Check your PayPal sandbox credentials and try again.`;
  }

  if (latest.type === "policy_check") {
    return `Policy decision: ${latest.decision}. ${(latest.reasons ?? []).join("; ")}`;
  }

  if (latest.type === "search_results") {
    return latest.resultCount
      ? `I found ${latest.resultCount} product options below.`
      : "I couldn't find matching products.";
  }

  if (latest.type === "budget_status") {
    return `You have ${latest.remaining} remaining from your monthly budget.`;
  }

  return "I completed that request. See the details below.";
}
