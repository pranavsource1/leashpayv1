/**
 * db/schema.ts — SQLite table definitions and types for LeashPay.
 */

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  config TEXT NOT NULL, -- JSON
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL,
  offer_id TEXT,
  offer_domain TEXT,
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  policy_decision TEXT,
  policy_trace_json TEXT,
  cart_hash TEXT,
  risk_score INTEGER DEFAULT 0,
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  approval_token_hash TEXT,
  approval_expires_at TEXT,
  agent_profile_id TEXT,
  refunded_cents INTEGER DEFAULT 0,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_idempotency
  ON purchase_requests(user_id, product_id, offer_domain, idempotency_key);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  event_type TEXT NOT NULL,
  purchase_request_id TEXT,
  summary TEXT NOT NULL,
  detail_json TEXT,
  prev_hash TEXT DEFAULT '',
  row_hash TEXT DEFAULT '',
  agent_profile_id TEXT,
  redteam INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS spend_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  captured_cents INTEGER NOT NULL DEFAULT 0,
  reserved_cents INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, month)
);

CREATE TABLE IF NOT EXISTS mandates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- LEASH or CART
  body_json TEXT NOT NULL,
  signature TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  policy_version INTEGER,
  purchase_request_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  sub_policy_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS redteam_runs (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  total INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  results_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_events (
  id TEXT PRIMARY KEY,
  purchase_request_id TEXT,
  kind TEXT NOT NULL, -- BLOCKED or LOWEST_OFFER
  amount_cents INTEGER NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// ── TypeScript interfaces matching the DB rows ──

export interface UserRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface PolicyRow {
  id: string;
  user_id: string;
  config: string; // JSON string
  version: number;
  updated_at: string;
}

export interface PurchaseRequestRow {
  id: string;
  user_id: string;
  product_id: string;
  offer_id: string | null;
  offer_domain: string | null;
  title: string;
  amount_cents: number;
  currency: string;
  category: string;
  status: string;
  policy_decision: string | null;
  policy_trace_json: string | null;
  cart_hash: string | null;
  risk_score: number;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  approval_token_hash: string | null;
  approval_expires_at: string | null;
  agent_profile_id: string | null;
  refunded_cents: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  ts: string;
  actor: string;
  event_type: string;
  purchase_request_id: string | null;
  summary: string;
  detail_json: string | null;
  prev_hash: string;
  row_hash: string;
  agent_profile_id: string | null;
  redteam: number;
}

export interface SpendLedgerRow {
  id: string;
  user_id: string;
  month: string;
  captured_cents: number;
  reserved_cents: number;
}

export interface MandateRow {
  id: string;
  user_id: string;
  kind: string;
  body_json: string;
  signature: string;
  body_hash: string;
  policy_version: number | null;
  purchase_request_id: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AgentProfileRow {
  id: string;
  user_id: string;
  name: string;
  api_key_hash: string;
  sub_policy_json: string | null;
  created_at: string;
}

export interface RedteamRunRow {
  id: string;
  ts: string;
  total: number;
  passed: number;
  results_json: string;
}

export interface SavingsEventRow {
  id: string;
  purchase_request_id: string | null;
  kind: string;
  amount_cents: number;
  ts: string;
}
