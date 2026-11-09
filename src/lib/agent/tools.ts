/**
 * agent/tools.ts — Tool definitions for the LLM shopping agent.
 */

import { z } from "zod";
import { searchProducts, getProduct, compareOffers, getPriceHistory, getOffer } from "../channel3/client";
import { evaluate } from "../policy/engine";
import { getPolicyConfig } from "../db";
import * as db from "../db";
import { requestPurchase } from "../paypal/orders";
import { formatUSD, currentMonth } from "../money";
import type { Policy } from "../policy/schema";

const DEMO_USER = "demo-user-1";

// ── Tool: search_products ──
export const searchProductsTool = {
  name: "search_products" as const,
  description: "Search for products across retailers. Returns product listings with prices and availability.",
  parameters: z.object({
    query: z.string().describe("Search query, e.g. '27 inch 4K monitor'"),
    maxPrice: z.number().optional().describe("Maximum price in dollars"),
    merchants: z.array(z.string()).optional().describe("Filter to specific merchant domains"),
  }),
  execute: async (args: { query: string; maxPrice?: number; merchants?: string[] }) => {
    const products = await searchProducts(args.query, args.maxPrice, args.merchants);

    db.createAuditLog({
      userId: DEMO_USER,
      actor: "AGENT",
      eventType: "SEARCH",
      summary: `Searched: "${args.query}" — ${products.length} results`,
      detailJson: { query: args.query, maxPrice: args.maxPrice, resultCount: products.length },
    });

    return {
      type: "search_results" as const,
      query: args.query,
      resultCount: products.length,
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        brand: p.brand,
        category: p.category,
        imageUrl: p.imageUrl,
        bestPrice: formatUSD(Math.min(...p.offers.map(o => o.priceCents))),
        offerCount: p.offers.length,
        inStock: p.offers.some(o => o.inStock),
        offers: p.offers.map(o => ({
          id: o.id,
          merchant: o.merchantName,
          domain: o.merchant,
          price: formatUSD(o.priceCents),
          inStock: o.inStock,
        })),
      })),
    };
  },
};

// ── Tool: get_product ──
export const getProductTool = {
  name: "get_product" as const,
  description: "Get detailed product information including all offers from different retailers.",
  parameters: z.object({
    productId: z.string().describe("The product ID to look up"),
  }),
  execute: async (args: { productId: string }) => {
    const product = await getProduct(args.productId);
    if (!product) return { type: "error" as const, message: "Product not found" };

    return {
      type: "product_detail" as const,
      product: {
        id: product.id,
        title: product.title,
        description: product.description.substring(0, 200), // Truncate to avoid injection
        brand: product.brand,
        category: product.category,
        imageUrl: product.imageUrl,
        offers: product.offers.map(o => ({
          id: o.id,
          merchant: o.merchantName,
          domain: o.merchant,
          price: formatUSD(o.priceCents),
          priceCents: o.priceCents,
          currency: o.currency,
          inStock: o.inStock,
        })),
      },
    };
  },
};

// ── Tool: compare_offers ──
export const compareOffersTool = {
  name: "compare_offers" as const,
  description: "Compare all offers for a product, sorted by price with best deal highlighted.",
  parameters: z.object({
    productId: z.string().describe("Product ID to compare offers for"),
  }),
  execute: async (args: { productId: string }) => {
    const product = await getProduct(args.productId);
    if (!product) return { type: "error" as const, message: "Product not found" };

    const offers = await compareOffers(args.productId);
    const bestOffer = offers.find(o => o.inStock) || offers[0];

    return {
      type: "offer_comparison" as const,
      productTitle: product.title,
      offers: offers.map(o => ({
        id: o.id,
        merchant: o.merchantName,
        domain: o.merchant,
        price: formatUSD(o.priceCents),
        priceCents: o.priceCents,
        inStock: o.inStock,
        isBestDeal: o.id === bestOffer?.id,
      })),
      bestDeal: bestOffer ? {
        merchant: bestOffer.merchantName,
        price: formatUSD(bestOffer.priceCents),
      } : null,
    };
  },
};

// ── Tool: get_price_history ──
export const getPriceHistoryTool = {
  name: "get_price_history" as const,
  description: "Get price history for a product to check if the current price is fair.",
  parameters: z.object({
    productId: z.string().describe("Product ID to get price history for"),
  }),
  execute: async (args: { productId: string }) => {
    const history = await getPriceHistory(args.productId);
    if (!history) return { type: "error" as const, message: "No price history available" };

    return {
      type: "price_history" as const,
      productId: history.productId,
      average: formatUSD(history.averageCents),
      min: formatUSD(history.minCents),
      max: formatUSD(history.maxCents),
      dataPointCount: history.dataPoints.length,
    };
  },
};

// ── Tool: check_policy ──
export const checkPolicyTool = {
  name: "check_policy" as const,
  description: "Dry-run policy check: see if a purchase would be allowed, require approval, or be denied. No side effects.",
  parameters: z.object({
    productId: z.string(),
    offerId: z.string(),
  }),
  execute: async (args: { productId: string; offerId: string }) => {
    const product = await getProduct(args.productId);
    if (!product) return { type: "error" as const, message: "Product not found" };

    const offer = product.offers.find(o => o.id === args.offerId);
    if (!offer) return { type: "error" as const, message: "Offer not found" };

    const priceHistory = await getPriceHistory(args.productId);
    const policy = getPolicyConfig(DEMO_USER) as Policy;
    const ledger = db.getLedgerState(DEMO_USER);

    const result = evaluate(
      {
        productId: args.productId,
        offerId: args.offerId,
        title: product.title,
        merchant: offer.merchant,
        category: product.category,
        amountCents: offer.priceCents,
        currency: offer.currency,
        inStock: offer.inStock,
        priceHistoryAvgCents: priceHistory?.averageCents ?? null,
        agentProfileId: null,
      },
      policy,
      ledger,
    );

    return {
      type: "policy_check" as const,
      decision: result.decision,
      reasons: result.reasons,
      trace: result.trace,
      riskScore: result.riskScore,
      remainingBudgetAfter: formatUSD(result.remainingBudgetAfter),
      product: product.title,
      merchant: offer.merchantName,
      price: formatUSD(offer.priceCents),
    };
  },
};

// ── Tool: request_purchase ──
export const requestPurchaseTool = {
  name: "request_purchase" as const,
  description: "Request a purchase. The Policy Engine decides if it's allowed. If approved, creates a PayPal order for the user to confirm.",
  parameters: z.object({
    productId: z.string(),
    offerId: z.string(),
  }),
  execute: async (args: { productId: string; offerId: string }) => {
    const result = await requestPurchase({
      productId: args.productId,
      offerId: args.offerId,
    });

    if (result.decision === "DENY") {
      return {
        type: "purchase_denied" as const,
        decision: result.decision,
        reasons: result.reasons,
        trace: result.trace,
        riskScore: result.riskScore,
        purchaseRequestId: result.purchaseRequestId,
      };
    }

    return {
      type: "purchase_requested" as const,
      decision: result.decision,
      purchaseRequestId: result.purchaseRequestId,
      approvalUrl: result.approvalUrl,
      guardianApprovalUrl: result.guardianApprovalUrl,
      reasons: result.reasons,
      trace: result.trace,
      riskScore: result.riskScore,
      mandateId: result.mandateId,
    };
  },
};

// ── Tool: get_budget_status ──
export const getBudgetStatusTool = {
  name: "get_budget_status" as const,
  description: "Check the remaining budget and recent purchase activity.",
  parameters: z.object({}),
  execute: async () => {
    const policy = getPolicyConfig(DEMO_USER) as Policy;
    const ledger = db.getLedger(DEMO_USER);
    const recent = db.getPurchaseRequestsByUser(DEMO_USER, 10);

    const remaining = policy.monthlyBudget - ledger.captured_cents - ledger.reserved_cents;

    return {
      type: "budget_status" as const,
      monthlyBudget: formatUSD(policy.monthlyBudget),
      captured: formatUSD(ledger.captured_cents),
      reserved: formatUSD(ledger.reserved_cents),
      remaining: formatUSD(remaining),
      remainingPct: Math.round((remaining / policy.monthlyBudget) * 100),
      perPurchaseCap: formatUSD(policy.perPurchaseCap),
      approvalThreshold: formatUSD(policy.requireApprovalOver),
      frozen: policy.frozen,
      recentPurchases: recent.slice(0, 5).map(p => ({
        title: p.title,
        amount: formatUSD(p.amount_cents),
        status: p.status,
        merchant: p.offer_domain,
        date: p.created_at,
      })),
    };
  },
};

// ── All tools ──
export const ALL_TOOLS = [
  searchProductsTool,
  getProductTool,
  compareOffersTool,
  getPriceHistoryTool,
  checkPolicyTool,
  requestPurchaseTool,
  getBudgetStatusTool,
];
