/**
 * channel3/client.ts — Product search with fixture fallback.
 */

import path from "node:path";
import fs from "node:fs";

export interface Offer {
  id: string;
  merchant: string;
  merchantName: string;
  price: number;
  priceCents: number;
  currency: string;
  inStock: boolean;
  url: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  brand: string;
  category: string;
  imageUrl: string;
  offers: Offer[];
}

export interface PriceHistory {
  productId: string;
  averageCents: number;
  minCents: number;
  maxCents: number;
  dataPoints: Array<{ date: string; priceCents: number }>;
}

// ── Cache ──
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// ── Fixture data ──
let _fixtures: Product[] | null = null;

function loadFixtures(): Product[] {
  if (_fixtures) return _fixtures;
  try {
    const filePath = path.join(process.cwd(), "fixtures", "channel3-sample.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    _fixtures = JSON.parse(raw) as Product[];
  } catch {
    _fixtures = [];
  }
  return _fixtures;
}

// ── Search products ──
export async function searchProducts(
  query: string,
  maxPrice?: number,
  merchants?: string[],
): Promise<Product[]> {
  const cacheKey = `search:${query}:${maxPrice}:${merchants?.join(",")}`;
  const cached = getCached<Product[]>(cacheKey);
  if (cached) return cached;

  // Try real Channel3 API if key is set
  if (process.env.CHANNEL3_API_KEY) {
    try {
      const results = await searchChannel3(query, maxPrice, merchants);
      setCache(cacheKey, results);
      return results;
    } catch (e) {
      console.warn("Channel3 API error, falling back to fixtures:", e);
    }
  }

  // Fixture fallback
  const products = loadFixtures();
  const q = query.toLowerCase();
  let filtered = products.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q)
  );

  if (maxPrice) {
    filtered = filtered.filter(p =>
      p.offers.some(o => o.price <= maxPrice)
    );
  }

  if (merchants && merchants.length > 0) {
    const ml = merchants.map(m => m.toLowerCase());
    filtered = filtered.filter(p =>
      p.offers.some(o => ml.includes(o.merchant.toLowerCase()))
    );
  }

  // If no query match, return all (for browsing)
  if (filtered.length === 0 && q.length < 3) {
    filtered = products;
  }

  setCache(cacheKey, filtered);
  return filtered;
}

// ── Get product ──
export async function getProduct(productId: string): Promise<Product | null> {
  const cacheKey = `product:${productId}`;
  const cached = getCached<Product>(cacheKey);
  if (cached) return cached;

  const products = loadFixtures();
  const product = products.find(p => p.id === productId) || null;
  if (product) setCache(cacheKey, product);
  return product;
}

// ── Compare offers (sorted by price, in-stock first) ──
export async function compareOffers(productId: string): Promise<Offer[]> {
  const product = await getProduct(productId);
  if (!product) return [];

  const sorted = [...product.offers].sort((a, b) => {
    // In-stock first
    if (a.inStock && !b.inStock) return -1;
    if (!a.inStock && b.inStock) return 1;
    // Then by price
    return a.priceCents - b.priceCents;
  });

  return sorted;
}

// ── Get price history (simulated from fixture data) ──
export async function getPriceHistory(productId: string): Promise<PriceHistory | null> {
  const product = await getProduct(productId);
  if (!product) return null;

  const prices = product.offers.map(o => o.priceCents);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  // Generate simulated 90-day history
  const dataPoints: Array<{ date: string; priceCents: number }> = [];
  const now = new Date();
  for (let i = 90; i >= 0; i -= 7) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const variance = Math.round((Math.random() - 0.5) * avg * 0.1);
    dataPoints.push({
      date: date.toISOString().split("T")[0],
      priceCents: avg + variance,
    });
  }

  return { productId, averageCents: avg, minCents: min, maxCents: max, dataPoints };
}

// ── Get specific offer for a product ──
export async function getOffer(productId: string, offerId: string): Promise<Offer | null> {
  const product = await getProduct(productId);
  if (!product) return null;
  return product.offers.find(o => o.id === offerId) || null;
}

// ── Real Channel3 API call (when key is available) ──
async function searchChannel3(
  query: string,
  maxPrice?: number,
  merchants?: string[],
): Promise<Product[]> {
  const apiKey = process.env.CHANNEL3_API_KEY!;
  const params = new URLSearchParams({ query });
  if (maxPrice) params.set("max_price", String(maxPrice));

  const res = await fetch(`https://api.trychannel3.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Channel3 API returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  // Map Channel3 response to our Product shape
  return (data.products || data.results || []).map((p: any) => ({
    id: p.id || p.product_id,
    title: p.title || p.name,
    description: p.description || "",
    brand: p.brand || "",
    category: p.category || "",
    imageUrl: p.image_url || p.imageUrl || "",
    offers: (p.offers || []).map((o: any) => ({
      id: o.id || o.offer_id,
      merchant: o.website_domain || o.merchant,
      merchantName: o.website_name || o.merchantName || o.website_domain,
      price: o.price,
      priceCents: Math.round(o.price * 100),
      currency: o.currency || "USD",
      inStock: o.in_stock !== false,
      url: o.url || o.redirect_url || "",
      updatedAt: o.updated_at || new Date().toISOString(),
    })),
  }));
}
