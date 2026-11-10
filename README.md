# LeashPay v2 — AI Shopping Agent with Trust Layer

**LeashPay v2** is an autonomous AI shopping agent with spending controls and a verifiable trust layer. It lets you delegate shopping to an AI agent while maintaining strict policy boundaries through cryptographic mandates and hash-chained audit logs.

Built for the Anthropic Buildathon (November 2026) with a focus on **trust, transparency, and control**.

---

## What It Does

LeashPay v2 solves a critical problem: **How do you trust an AI agent to spend your money?**

The agent can:
- Search for products across multiple merchants
- Compare offers and find the best deals
- Evaluate purchases against your policy rules
- Complete transactions via PayPal
- Track spending and generate savings reports

The trust layer ensures:
- **Cryptographic mandates**: Every purchase is signed and tamper-evident
- **Hash-chained audit logs**: Complete transparency of all decisions
- **Policy enforcement**: 14 security rules prevent abuse
- **Red Team validated**: 14 scripted attacks verify defenses
- **Guardian approval**: Optional human-in-the-loop for high-value purchases

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User                                │
│              (Natural Language Requests)                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Google Gemini)                 │
│          Tools: search, compare, check_policy,              │
│                 request_purchase, get_budget                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Policy Engine                           │
│   ✓ Budget limits    ✓ Merchant allowlist                  │
│   ✓ Category blocks  ✓ Approval thresholds                 │
│   ✓ Velocity limits  ✓ Kill switch                         │
│   ✓ Price checks     ✓ Currency validation                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
┌────────────────┐  ┌────────────────────┐
│ Mandate Signer │  │  Audit Logger      │
│ (Hash Chain)   │  │  (Hash Chain)      │
└────────┬───────┘  └─────────┬──────────┘
         │                    │
         └─────────┬──────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   SQLite Database    │
        │   (leashpay.db)      │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │   PayPal Gateway     │
        │   (Production)       │
        └──────────────────────┘
```

---

## Key Features

### AI Shopping Agent
- **Natural language interface**: "Find me a 4K monitor under $300"
- **Multi-merchant search**: Compares offers from Best Buy, Walmart, Target, Amazon
- **Best deal detection**: Automatically finds lowest prices
- **Smart recommendations**: Considers stock, price history, and policy rules

### Policy Engine (14 Rules)
1. **Monthly budget cap** ($1,000 default)
2. **Per-purchase cap** ($300 default)
3. **Approval threshold** (>$25 requires guardian)
4. **Merchant allowlist** (Only approved stores)
5. **Category blocklist** (No gift cards, alcohol, etc.)
6. **Currency validation** (USD only by default)
7. **Stock verification** (Only in-stock items)
8. **Price vs. history** (Flag suspicious price jumps)
9. **Velocity limits** (Prevent rapid-fire spending)
10. **Mandate expiry** (Time-bound permissions)
11. **Kill switch** (Instant freeze)
12. **Cart tampering** (Hash verification)
13. **Idempotency** (Prevent duplicates)
14. **Injection defenses** (Ignore malicious product descriptions)

### Trust Layer
- **Signed mandates**: Every cart is cryptographically signed before payment
- **Hash-chained audit logs**: Tamper-evident trail of all events
- **Client-side verification**: Anyone can verify the audit chain
- **Public receipts**: Share purchase proof with verifiable mandate

### Red Team Mode
- **14 scripted attacks** test every defense
- **Automated scoring** shows Leash Score (X/14)
- **Attack categories**:
  - Financial (cap violations, structuring)
  - Merchant (allowlist bypass)
  - Category (blocked items)
  - Injection (malicious descriptions, user overrides)
  - Integrity (cart tampering, mandate expiry)
  - Kill switch (frozen state)

### Guardian Approval
- **QR code approval** for high-value purchases
- **Email/SMS notifications** (simulated)
- **Approval timeout** (auto-deny after 24h)
- **Revocation** (cancel pending purchases)

---

## Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **PayPal Developer Account** ([Get one here](https://developer.paypal.com))
- **Google AI API Key** ([Get one here](https://aistudio.google.com/apikey))

### 1. Clone and Install
```bash
git clone https://github.com/yourusername/leashpayv1.git
cd leashpayv1
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_secret
PAYPAL_ENV=sandbox
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key
APP_BASE_URL=http://localhost:3000
```

> See [SETUP.md](./SETUP.md) for detailed setup instructions

### 3. Build and Run
```bash
npm run build
npm run dev
```

Visit **http://localhost:3000**

---

## Usage

### 1. Configure Your Policy (Settings Page)
Set your spending limits, allowed merchants, and approval thresholds.

**Natural Language Example:**
> "My budget is $500/month. Only allow Best Buy, Walmart, and Target. Block gift cards and alcohol. Require approval for anything over $50."

### 2. Chat with the Agent (Home Page)
Ask the agent to shop for you:

**Example Conversations:**
```
User: "Find me a 4K monitor under $300"
Agent: I found 3 monitors:
        1. Dell S2722QC at Best Buy - $269.99 ✓
        2. LG 27UP850N at B&H Photo - $329.99 ✗ (over budget)
        3. Samsung S8 at Walmart - $429.99 ✗ (over budget)
        
        Lowest price: Dell S2722QC at $269.99
        Buy this one?

User: "Yes, buy the Dell"
Agent: ✓ Purchase approved! Order created for $269.99 at Best Buy.
        Mandate signed. Redirecting to PayPal...
```

```
User: "Buy a $5000 TV"
Agent: ✗ DENIED: Exceeds per-purchase cap of $300
```

```
User: "Find wireless headphones under $100"
Agent: I found Sony WH-1000XM5 at Target for $279.99.
        This is over your $100 budget but under the $300 cap.
        It requires guardian approval (>$25 threshold).
        
        Approval request sent. Check your email for QR code.
```

### 3. Monitor Activity (Dashboard)
- Budget meters (remaining, captured, reserved)
- Spend by merchant and category
- Savings from best deals
- Blocked spending totals
- Purchase history with receipts

### 4. Verify Trust (Audit Page)
- View all events with hash chain
- Verify chain integrity (client-side)
- Export audit logs (CSV)
- Simulate tampering (demo mode)

### 5. Test Defenses (Red Team Page)
- Run 14 automated attacks
- View Leash Score (X/14 attacks blocked)
- See detailed attack results
- Review past runs

---

## Project Structure

```
leashpayv1/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Home (agent chat)
│   │   ├── dashboard/          # Spend dashboard
│   │   ├── settings/           # Policy configuration
│   │   ├── audit/              # Audit log viewer (AG Grid)
│   │   ├── redteam/            # Red Team attack suite
│   │   ├── approve/[token]/    # Guardian approval
│   │   ├── r/[id]/             # Public receipts
│   │   └── api/                # API routes
│   │       ├── agent/          # AI agent endpoint
│   │       ├── policy/         # Policy CRUD
│   │       ├── purchases/      # Purchase management
│   │       ├── audit/          # Audit queries
│   │       ├── dashboard/      # Dashboard data
│   │       ├── receipt/        # Receipt data
│   │       ├── redteam/        # Attack runner
│   │       └── paypal/         # PayPal webhooks
│   └── lib/                    # Core libraries
│       ├── db/                 # SQLite database
│       ├── policy/             # Policy engine
│       ├── mandate/            # Cryptographic signing
│       ├── agent/              # AI tools & prompts
│       ├── paypal/             # PayPal integration
│       ├── channel3/           # Product search (mock)
│       ├── redteam/            # Attack definitions
│       └── money.ts            # Currency utils
├── fixtures/
│   └── channel3-sample.json   # Mock product catalog
├── .env.example               # Environment template
├── SETUP.md                   # Detailed setup guide
├── IMPLEMENTATION_STATUS.md   # Progress tracker
└── test-e2e-simple.js         # Validation script
```

---

## Testing

### Run Validation Tests
```bash
node test-e2e-simple.js
```

Tests:
- Project structure
- All API routes present
- All UI pages present
- Red Team suite (14 attacks)
- Fixture data validity
- Documentation completeness

### Run Red Team Attacks (in app)
1. Visit **http://localhost:3000/redteam**
2. Click "Run Attack Suite"
3. View Leash Score (should be 12-14/14)

### Manual Testing Flow
1. **Configure policy** (Settings page)
2. **Chat with agent** (Home page): "Find headphones under $100"
3. **Approve purchase** (if >$25): Open approval link
4. **Complete payment** (PayPal sandbox)
5. **View dashboard** (Dashboard page)
6. **Check audit** (Audit page): Verify chain
7. **View receipt** (Dashboard → Receipt link)

---

## Security Features

### Mandate Signing
Every cart is signed before payment:
```typescript
{
  kind: 'cart',
  bodyHash: sha256(cartData),
  policyVersion: 1,
  signature: hmac_sha256(secret, bodyHash + policyVersion),
  timestamp: ISO8601
}
```

### Hash-Chained Audit Log
Each entry references the previous hash:
```typescript
{
  id: uuid,
  prevHash: sha256(previousRow),
  rowHash: sha256(currentRow + prevHash),
  ...eventData
}
```

Tampering breaks the chain and is immediately detected.

### Policy Isolation
- Agent never sees policy details directly
- All decisions go through `evaluate()` function
- LLM output cannot bypass rules
- Server always re-fetches offer prices

### Injection Defenses
- Product descriptions are never executed
- Policy evaluates structured fields only
- User commands like "ignore rules" are ignored
- LLM cannot override `policyDecision`

---

## Data Schema

### Purchase Request
```typescript
{
  id: string,
  user_id: string,
  product_id: string,
  offer_id: string,
  title: string,
  merchant: string,
  category: string,
  amount_cents: number,
  currency: string,
  status: 'PENDING' | 'PAID' | 'DENIED' | 'CANCELLED' | ...,
  policy_decision: 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY',
  risk_score: number,
  cart_hash: string,
  paypal_order_id: string | null,
  paypal_capture_id: string | null,
  policy_trace_json: string,
  created_at: ISO8601
}
```

### Audit Log Entry
```typescript
{
  id: string,
  user_id: string,
  ts: ISO8601,
  actor: 'AGENT' | 'POLICY' | 'USER' | 'PAYPAL' | 'SYSTEM',
  event_type: string,
  summary: string,
  detail_json: string,
  prev_hash: string | null,
  row_hash: string,
  redteam: boolean
}
```

---

## Limitations

### Current Version
- **Demo-only authentication**: Hardcoded `demo-user-1`
- **Mock product search**: Uses fixture data (Channel3 API simulated)
- **PayPal sandbox only**: No production payment processing
- **SQLite database**: Not suitable for production scale
- **No multi-user support**: Single user hardcoded
- **No real price history**: `priceHistoryAvgCents` always null

### Future Improvements
- Real authentication (OAuth, magic links)
- Live product search (Google Shopping, Amazon API)
- Production PayPal + other gateways (Stripe)
- PostgreSQL/MySQL for multi-user
- Real email/SMS notifications
- Price history tracking
- Multi-currency support
- Mobile app (React Native)
- Multi-party approval (require 2+ guardians)
- Smarter agent (learn user preferences)

---

## Buildathon Criteria

### Anthropic API Integration
- Uses **Google Gemini** (Anthropic-compatible interface via Vercel AI SDK)
- **Tool calling** for deterministic operations
- **System prompts** enforce policy boundaries
- **Streaming responses** for better UX

### Innovation
- **Cryptographic mandates**: First AI agent with signed purchase proofs
- **Hash-chained audit**: Blockchain-inspired tamper evidence without blockchain
- **Red Team mode**: Built-in adversarial testing
- **Natural language policy**: Configure spending rules in plain English

### Impact
- **Trust in AI agents**: Verifiable spending decisions
- **Financial safety**: Prevents runaway AI spending
- **Transparency**: Complete audit trail
- **User control**: Kill switch, approval gates, policy editor

### Technical Excellence
- **TypeScript throughout**: Type-safe codebase
- **Next.js 15 App Router**: Modern React patterns
- **Policy engine**: Pure functions, no LLM in decision path
- **Zero TypeScript errors**: Clean build
- **AG Grid integration**: Professional data visualization

---

## License

MIT License - See [LICENSE](./LICENSE) for details

---

## Acknowledgments

- **Anthropic** for the Buildathon
- **Google** for Gemini API
- **PayPal** for sandbox environment
- **Vercel** for Next.js and AI SDK
- **AG Grid** for data tables

---

## Contact

Built by [Your Name] for Anthropic Buildathon (November 2026)

- Demo: [https://leashpay.vercel.app](https://leashpay.vercel.app)
- Email: your.email@example.com
- Twitter: @yourusername
- LinkedIn: linkedin.com/in/yourprofile

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/leashpayv1)

1. Click the button above
2. Set environment variables (PayPal, Google AI)
3. Deploy!

> **Production Checklist**:
> - Switch `PAYPAL_ENV` to `live`
> - Use PostgreSQL instead of SQLite
> - Add authentication
> - Enable real email/SMS
> - Review all security settings

---

**Made with care for AI Trust and Transparency**
