# LeashPay Setup Guide

## Prerequisites

- Node.js 20+ installed
- npm or pnpm
- Git

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
copy .env.example .env.local
```

Edit `.env.local` and add your API keys:

#### Get Google Gemini API Key (Free)
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add to `.env.local`:
   ```
   GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
   ```

#### Get Channel3 API Key (1000 free searches/month)
1. Sign up at https://trychannel3.com
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```
   CHANNEL3_API_KEY=your_key_here
   ```

#### Set Up PayPal Sandbox
1. Go to https://developer.paypal.com/dashboard
2. Log in or create a developer account
3. Click "Apps & Credentials" → "Sandbox"
4. Create a new app or use the default one
5. Copy the Client ID and Secret
6. Add to `.env.local`:
   ```
   PAYPAL_CLIENT_ID=your_sandbox_client_id
   PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
   PAYPAL_ENV=sandbox
   ```

### 3. Initialize the Database

The database will auto-initialize on first run. It uses SQLite by default (file: `leashpay.db`).

### 4. Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Test with PayPal Sandbox

To test payments:

1. Use the sandbox buyer account credentials from PayPal Developer Dashboard
2. When prompted to pay, log in with sandbox credentials
3. Approve the payment
4. You'll be redirected back to the app

## Project Structure

```
leashpay/
├── src/
│   ├── app/              # Next.js pages and API routes
│   │   ├── page.tsx      # Chat interface
│   │   ├── settings/     # Policy configuration
│   │   ├── audit/        # Audit log viewer
│   │   ├── dashboard/    # Budget and spend analytics
│   │   └── api/          # Backend endpoints
│   │       ├── agent/    # AI agent with tools
│   │       ├── policy/   # Policy management
│   │       ├── paypal/   # PayPal integration
│   │       └── ...
│   └── lib/              # Core business logic
│       ├── db/           # Database queries
│       ├── policy/       # Policy engine
│       ├── mandate/      # Signing and verification
│       ├── channel3/     # Product search
│       ├── paypal/       # PayPal client
│       └── agent/        # LLM tools
├── fixtures/             # Sample data for demos
├── leashpay.db          # SQLite database (auto-created)
└── .env.local           # Your configuration (not committed)
```

## Key Features

### 1. Policy Engine
- Monthly budget limits
- Per-purchase caps
- Merchant allowlists/blocklists
- Category restrictions
- Velocity limiting (structuring defense)
- Risk scoring

### 2. Trust Layer
- Ed25519 signed mandates
- Hash-chained audit log
- Tamper-evident receipts
- Public verification

### 3. Guardian Mode
- Second-party approval for purchases
- QR code approval on mobile
- Approval tokens with expiry

### 4. Red Team Suite
- 14 automated security tests
- Injection attack defense
- Leash Score reporting

## Development Workflow

### Running Tests
```bash
npm test                 # Run all tests
npm run test:policy      # Test policy engine
npm run test:redteam     # Run security suite
```

### Database Reset
```bash
rm leashpay.db
npm run dev              # Will re-initialize
```

### Mock Mode (No Real PayPal)
Add to `.env.local`:
```
PAYPAL_MOCK_MODE=true
```

## Troubleshooting

### "Cannot find module '@ai-sdk/google'"
Run: `npm install`

### "PAYPAL_CLIENT_ID is not set"
Check your `.env.local` file exists and contains the PayPal credentials.

### Database locked error
Close any other processes accessing `leashpay.db`.

### Channel3 API errors
The app falls back to fixture data in `fixtures/channel3-sample.json` if the API is unavailable.

## Production Deployment (Render)

### 1. Create a Render Account
Go to https://render.com and sign up (free tier available).

### 2. Create a Web Service
1. Connect your GitHub repository
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Choose free tier

### 3. Add Environment Variables
In Render dashboard, add all variables from `.env.example` with your production values.

### 4. Create a PostgreSQL Database (Optional)
For production, use Render's managed Postgres:
1. Create a new PostgreSQL database
2. Copy the internal database URL
3. Set `DATABASE_URL` in your web service environment

### 5. Set Up PayPal Webhook
1. In PayPal Dashboard, create a webhook pointing to:
   `https://your-app.onrender.com/api/paypal/webhook`
2. Subscribe to events:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
3. Copy the Webhook ID to `PAYPAL_WEBHOOK_ID`

## Security Notes

- Never commit `.env.local` to git
- Signing keys auto-generate on startup (dev only)
- For production, generate permanent keys and store securely
- Sandbox credentials are safe to use for demos
- All monetary amounts use integer cents (never floats)

## Getting Help

- Check `IMPLEMENTATION_STATUS.md` for feature completion status
- Review the implementation plans in the project root
- PayPal Developer Docs: https://developer.paypal.com/docs
- Channel3 Docs: https://docs.trychannel3.com

