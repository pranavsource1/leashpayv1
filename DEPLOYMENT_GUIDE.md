# LeashPay v2 - Deployment & Production Guide

Complete guide for deploying LeashPay v2 to production and connecting real APIs.

---

## Part 1: Deploy to Vercel (Live Server - Recommended)

### Step 1: Prepare Your Project

```bash
# Make sure everything is committed
git add .
git commit -m "feat: Production ready build"
git push origin main
```

### Step 2: Sign Up for Vercel

1. Go to: https://vercel.com
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub account

### Step 3: Import Your Project

1. Click "Add New..." → "Project"
2. Select your GitHub repository: `leashpayv1`
3. Click "Import"

### Step 4: Configure Environment Variables

In the Vercel deployment screen, add these environment variables:

```
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_secret
PAYPAL_ENV=sandbox
APP_BASE_URL=https://your-app.vercel.app
DATABASE_URL=./leashpay.db
```

**Note:** Vercel will give you the APP_BASE_URL after deployment (e.g., `https://leashpayv1-abc123.vercel.app`)

### Step 5: Deploy

1. Click "Deploy"
2. Wait 2-3 minutes for build to complete
3. You'll get a live URL: `https://leashpayv1-abc123.vercel.app`

### Step 6: Update Environment Variable

1. Go to Project Settings → Environment Variables
2. Update `APP_BASE_URL` with your actual Vercel URL
3. Redeploy (Deployments → Three dots → Redeploy)

### Step 7: Configure PayPal Webhooks (Optional)

1. Go to: https://developer.paypal.com/dashboard/
2. Your App → Webhooks → Add Webhook
3. Webhook URL: `https://your-app.vercel.app/api/paypal/webhook`
4. Copy Webhook ID
5. Add to Vercel env: `PAYPAL_WEBHOOK_ID=WH-xxx`
6. Redeploy

---

## Alternative: Deploy to Railway.app

### Why Railway?
- PostgreSQL database included
- Easy SQLite → PostgreSQL migration
- Automatic HTTPS

### Steps:

1. Go to: https://railway.app
2. Sign up with GitHub
3. New Project → Deploy from GitHub repo
4. Select `leashpayv1`
5. Add environment variables (same as Vercel)
6. Add PostgreSQL database:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway provides `DATABASE_URL` automatically
7. Deploy!

---

## Part 2: Connect Real Product APIs

### Option A: Google Shopping API (Recommended)

**Free Tier:** 100 requests/day  
**Paid:** $5 per 1,000 requests

#### Step 1: Get API Key

1. Go to: https://console.cloud.google.com/
2. Create new project or select existing
3. Enable "Content API for Shopping"
4. Create credentials → API key
5. Restrict key to Content API for Shopping

#### Step 2: Implement in Code

Edit `src/lib/channel3/client.ts`:

```typescript
async function searchGoogleShopping(
  query: string,
  maxPrice?: number
): Promise<Product[]> {
  const apiKey = process.env.GOOGLE_SHOPPING_API_KEY!;
  const merchantId = process.env.GOOGLE_MERCHANT_ID!;
  
  const url = `https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/products?key=${apiKey}&q=${encodeURIComponent(query)}`;
  
  if (maxPrice) {
    url += `&maxPrice=${maxPrice}`;
  }
  
  const res = await fetch(url);
  const data = await res.json();
  
  return data.resources.map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    brand: item.brand,
    category: item.productTypes?.[0] || "general",
    imageUrl: item.imageLink,
    offers: [{
      id: `offer-${item.id}`,
      merchant: item.link,
      merchantName: item.source || "Online Store",
      price: parseFloat(item.price.value),
      priceCents: Math.round(parseFloat(item.price.value) * 100),
      currency: item.price.currency,
      inStock: item.availability === "in stock",
      url: item.link,
      updatedAt: new Date().toISOString()
    }]
  }));
}
```

#### Step 3: Update searchProducts Function

```typescript
export async function searchProducts(
  query: string,
  maxPrice?: number,
  merchants?: string[]
): Promise<Product[]> {
  // Try Google Shopping API first
  if (process.env.GOOGLE_SHOPPING_API_KEY) {
    try {
      return await searchGoogleShopping(query, maxPrice);
    } catch (e) {
      console.warn("Google Shopping API error:", e);
    }
  }
  
  // Fallback to fixtures
  return searchFixtures(query, maxPrice, merchants);
}
```

#### Step 4: Add Environment Variable

```
GOOGLE_SHOPPING_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXX
GOOGLE_MERCHANT_ID=123456789
```

---

### Option B: Amazon Product Advertising API

**Requirements:** Amazon Associates account  
**Free:** 1 request/second (up to 8,640/day)

#### Step 1: Sign Up

1. Go to: https://affiliate-program.amazon.com/
2. Sign up for Amazon Associates
3. Go to: https://webservices.amazon.com/paapi5/documentation/
4. Get Access Key and Secret Key

#### Step 2: Install SDK

```bash
npm install amazon-paapi
```

#### Step 3: Implement

```typescript
import { ProductAdvertisingAPIClient } from 'amazon-paapi';

const client = new ProductAdvertisingAPIClient({
  accessKey: process.env.AMAZON_ACCESS_KEY!,
  secretKey: process.env.AMAZON_SECRET_KEY!,
  partnerTag: process.env.AMAZON_PARTNER_TAG!,
  region: 'US'
});

async function searchAmazon(
  query: string,
  maxPrice?: number
): Promise<Product[]> {
  const response = await client.searchItems({
    Keywords: query,
    Resources: [
      'Images.Primary.Large',
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ],
    MaxPrice: maxPrice ? maxPrice * 100 : undefined // In cents
  });
  
  return response.SearchResult.Items.map(item => ({
    id: item.ASIN,
    title: item.ItemInfo.Title.DisplayValue,
    description: item.ItemInfo.Features?.DisplayValues?.join('. ') || '',
    brand: item.ItemInfo.ByLineInfo?.Brand?.DisplayValue || 'Amazon',
    category: item.ItemInfo.Classifications?.ProductGroup?.DisplayValue || 'general',
    imageUrl: item.Images.Primary.Large.URL,
    offers: [{
      id: `amz-${item.ASIN}`,
      merchant: 'amazon.com',
      merchantName: 'Amazon',
      price: item.Offers.Listings[0].Price.Amount,
      priceCents: Math.round(item.Offers.Listings[0].Price.Amount * 100),
      currency: item.Offers.Listings[0].Price.Currency,
      inStock: item.Offers.Listings[0].Availability.Type === 'Now',
      url: item.DetailPageURL,
      updatedAt: new Date().toISOString()
    }]
  }));
}
```

---

### Option C: SerpApi (Google Shopping Scraper)

**Free Tier:** 100 searches/month  
**Paid:** $50/month for 5,000 searches

#### Step 1: Get API Key

1. Go to: https://serpapi.com/
2. Sign up for free account
3. Get API key from dashboard

#### Step 2: Install

```bash
npm install serpapi
```

#### Step 3: Implement

```typescript
import { getJson } from 'serpapi';

async function searchSerpApi(
  query: string,
  maxPrice?: number
): Promise<Product[]> {
  const response = await getJson({
    engine: "google_shopping",
    q: query,
    api_key: process.env.SERPAPI_KEY!,
    location: "United States",
    hl: "en",
    gl: "us",
    max_price: maxPrice
  });
  
  return response.shopping_results.map((item: any) => ({
    id: item.product_id,
    title: item.title,
    description: item.snippet || '',
    brand: item.brand || '',
    category: item.category || 'general',
    imageUrl: item.thumbnail,
    offers: [{
      id: `serp-${item.product_id}`,
      merchant: item.source,
      merchantName: item.source,
      price: parseFloat(item.extracted_price || item.price),
      priceCents: Math.round(parseFloat(item.extracted_price || item.price) * 100),
      currency: 'USD',
      inStock: true,
      url: item.link,
      updatedAt: new Date().toISOString()
    }]
  }));
}
```

---

## Part 3: Database Migration (SQLite → PostgreSQL)

For production with multiple users, migrate from SQLite to PostgreSQL.

### Option 1: Railway (Automatic)

Railway provides PostgreSQL automatically. Just update `DATABASE_URL`:

```typescript
// src/lib/db/index.ts
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

// Replace all Database.prepare() calls with SQL queries
```

### Option 2: Vercel + Neon

1. Go to: https://neon.tech/
2. Create free PostgreSQL database
3. Copy connection string
4. Add to Vercel: `DATABASE_URL=postgresql://user:pass@host/db`

### Option 3: Manual Migration

```bash
# Export SQLite data
sqlite3 leashpay.db .dump > dump.sql

# Import to PostgreSQL
psql postgresql://user:pass@host/db < dump.sql
```

---

## Part 4: Production Checklist

### Security

- [ ] Change PayPal from sandbox to live mode
- [ ] Add authentication (NextAuth.js recommended)
- [ ] Enable HTTPS (automatic on Vercel/Railway)
- [ ] Add rate limiting
- [ ] Rotate API keys regularly
- [ ] Enable CORS properly

### Performance

- [ ] Enable caching (Vercel Edge Cache)
- [ ] Optimize images (next/image)
- [ ] Add CDN for static assets
- [ ] Enable compression
- [ ] Monitor with Vercel Analytics

### Monitoring

- [ ] Add Sentry for error tracking
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Enable logging (Logtail, Papertrail)
- [ ] Add performance monitoring

### Legal

- [ ] Add Terms of Service
- [ ] Add Privacy Policy
- [ ] GDPR compliance (if EU users)
- [ ] Cookie consent banner

---

## Part 5: Quick Start Commands

### Deploy to Vercel (CLI)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables
vercel env add GOOGLE_GENERATIVE_AI_API_KEY
vercel env add PAYPAL_CLIENT_ID
vercel env add PAYPAL_CLIENT_SECRET

# Deploy to production
vercel --prod
```

### Update Environment Variables

```bash
# List all env vars
vercel env ls

# Remove old env var
vercel env rm VARIABLE_NAME

# Add new env var
vercel env add VARIABLE_NAME
```

---

## Part 6: Submission Links

After deployment, you'll have:

### Primary Links:
- **Live App:** `https://your-app.vercel.app`
- **GitHub Repo:** `https://github.com/yourusername/leashpayv1`
- **Documentation:** `https://your-app.vercel.app` (README visible)

### Demo Accounts:
- **User:** demo-user-1 (hardcoded, no login required)
- **PayPal Sandbox:** Your sandbox buyer account

### Test Credentials:
Include in submission:
```
Demo URL: https://your-app.vercel.app
GitHub: https://github.com/yourusername/leashpayv1
PayPal Sandbox: Available for testing
Google AI: Limited to demo fixtures (or real API if configured)
```

---

## Part 7: Cost Breakdown

### Free Tier (Hackathon):
- **Vercel:** Free (hobby plan)
- **Google Gemini:** Free tier (generous limits)
- **PayPal Sandbox:** Free forever
- **Fixture Data:** Free (no API needed)
- **Total:** $0/month ✅

### Production Ready:
- **Vercel Pro:** $20/month (optional)
- **Google Shopping API:** $5/1000 requests
- **PostgreSQL (Neon):** Free tier or $10/month
- **PayPal Live:** Transaction fees only
- **Total:** ~$0-50/month depending on usage

---

## Part 8: Troubleshooting

### Build Fails on Vercel

**Error:** "Module not found"
```bash
# Solution: Clear cache and rebuild
vercel --prod --force
```

**Error:** "Environment variable not set"
```bash
# Solution: Add all required env vars
vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
```

### Database Issues

**Error:** "SQLITE_CANTOPEN"
```
# Solution: Use PostgreSQL for production
# SQLite doesn't work well on Vercel (ephemeral filesystem)
```

### PayPal Webhook Not Working

```
# Solution: Use ngrok for local testing
ngrok http 3000

# Update webhook URL in PayPal dashboard to ngrok URL
```

---

## Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Railway Docs:** https://docs.railway.app
- **Google Shopping API:** https://developers.google.com/shopping-content
- **Amazon PA API:** https://webservices.amazon.com/paapi5/documentation/

---

**Good luck with your submission!** 🚀
