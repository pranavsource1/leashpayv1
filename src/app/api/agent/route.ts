/**
 * /api/agent/route.ts — Intelligent AI agent with Google Gemini.
 * Uses real LLM for natural conversations, not pattern matching.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
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

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

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

    // Use Google Gemini with tool calling
    const result = await generateText({
      model: google("gemini-pro"),
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
      maxSteps: 5,
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
      result: toolResult.result
    })) || [];

    return NextResponse.json({
      reply: result.text,
      toolResults
    });

  } catch (err: any) {
    console.error("Agent error:", err);
    
    // Better error messages
    if (err.message?.includes("API key")) {
      return NextResponse.json(
        { error: "Google AI API key is invalid or missing. Please check your .env.local file." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: err.message || "Agent processing failed" },
      { status: 500 }
    );
  }
}
