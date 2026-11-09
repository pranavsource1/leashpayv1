/**
 * db/index.ts — SQLite database initialization, seeding, and query helpers.
 */

import Database from "better-sqlite3";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { CREATE_TABLES_SQL } from "./schema";
import type {
  PolicyRow, PurchaseRequestRow, AuditLogRow,
  SpendLedgerRow, MandateRow, AgentProfileRow, RedteamRunRow, SavingsEventRow,
} from "./schema";
import { DEFAULT_POLICY } from "../policy/schema";
import { currentMonth } from "../money";
import { chainRow, canonical, sha256 } from "../mandate/sign";

// ── Singleton DB ──
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), "leashpay.db");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initTables(_db);
    seedIfEmpty(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(CREATE_TABLES_SQL);
}

function seedIfEmpty(db: Database.Database) {
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get("demo-user-1");
  if (!user) {
    db.prepare("INSERT INTO users (id, name, email) VALUES (?, ?, ?)").run(
      "demo-user-1", "Demo User", "demo@leashpay.dev"
    );
    db.prepare("INSERT INTO policies (id, user_id, config, version) VALUES (?, ?, ?, ?)").run(
      randomUUID(), "demo-user-1", JSON.stringify(DEFAULT_POLICY), 1
    );
    db.prepare("INSERT INTO spend_ledger (id, user_id, month, captured_cents, reserved_cents) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(), "demo-user-1", currentMonth(), 0, 0
    );
  }
}

// ── User queries ──
export function getUser(id: string) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as any | undefined;
}

// ── Policy queries ──
export function getPolicy(userId: string): PolicyRow | undefined {
  return getDb().prepare(
    "SELECT * FROM policies WHERE user_id = ? ORDER BY version DESC LIMIT 1"
  ).get(userId) as PolicyRow | undefined;
}

export function getPolicyConfig(userId: string) {
  const row = getPolicy(userId);
  if (!row) return DEFAULT_POLICY;
  try {
    return JSON.parse(row.config);
  } catch {
    return DEFAULT_POLICY;
  }
}

export function getPolicyVersion(userId: string): number {
  const row = getPolicy(userId);
  return row?.version ?? 0;
}

export function savePolicy(userId: string, config: object): PolicyRow {
  const db = getDb();
  const currentVersion = getPolicyVersion(userId);
  const newVersion = currentVersion + 1;
  const id = randomUUID();
  db.prepare(
    "INSERT INTO policies (id, user_id, config, version, updated_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(id, userId, JSON.stringify(config), newVersion);
  return getPolicy(userId)!;
}

// ── Purchase request queries ──
export function createPurchaseRequest(params: {
  userId: string;
  productId: string;
  offerId: string;
  offerDomain: string;
  title: string;
  amountCents: number;
  currency: string;
  category: string;
  status: string;
  policyDecision: string;
  policyTraceJson: string;
  cartHash: string | null;
  riskScore: number;
  paypalOrderId: string | null;
  agentProfileId: string | null;
  idempotencyKey: string | null;
  approvalTokenHash?: string | null;
  approvalExpiresAt?: string | null;
}): PurchaseRequestRow {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO purchase_requests
    (id, user_id, product_id, offer_id, offer_domain, title, amount_cents, currency, category,
     status, policy_decision, policy_trace_json, cart_hash, risk_score,
     paypal_order_id, agent_profile_id, idempotency_key, approval_token_hash, approval_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.userId, params.productId, params.offerId, params.offerDomain,
    params.title, params.amountCents, params.currency, params.category,
    params.status, params.policyDecision, params.policyTraceJson,
    params.cartHash, params.riskScore, params.paypalOrderId,
    params.agentProfileId, params.idempotencyKey,
    params.approvalTokenHash ?? null, params.approvalExpiresAt ?? null
  );
  return getPurchaseRequest(id)!;
}

export function updatePurchaseRequest(id: string, updates: Partial<{
  status: string;
  paypalOrderId: string;
  paypalCaptureId: string;
  refundedCents: number;
  approvalTokenHash: string;
  approvalExpiresAt: string;
}>) {
  const db = getDb();
  const sets: string[] = [];
  const values: any[] = [];
  if (updates.status !== undefined) { sets.push("status = ?"); values.push(updates.status); }
  if (updates.paypalOrderId !== undefined) { sets.push("paypal_order_id = ?"); values.push(updates.paypalOrderId); }
  if (updates.paypalCaptureId !== undefined) { sets.push("paypal_capture_id = ?"); values.push(updates.paypalCaptureId); }
  if (updates.refundedCents !== undefined) { sets.push("refunded_cents = ?"); values.push(updates.refundedCents); }
  if (updates.approvalTokenHash !== undefined) { sets.push("approval_token_hash = ?"); values.push(updates.approvalTokenHash); }
  if (updates.approvalExpiresAt !== undefined) { sets.push("approval_expires_at = ?"); values.push(updates.approvalExpiresAt); }
  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE purchase_requests SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function getPurchaseRequest(id: string): PurchaseRequestRow | undefined {
  return getDb().prepare("SELECT * FROM purchase_requests WHERE id = ?").get(id) as PurchaseRequestRow | undefined;
}

export function getPurchaseRequestByPaypalOrder(orderId: string): PurchaseRequestRow | undefined {
  return getDb().prepare("SELECT * FROM purchase_requests WHERE paypal_order_id = ?").get(orderId) as PurchaseRequestRow | undefined;
}

export function getPurchaseRequestsByUser(userId: string, limit = 50): PurchaseRequestRow[] {
  return getDb().prepare(
    "SELECT * FROM purchase_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(userId, limit) as PurchaseRequestRow[];
}

export function getPendingPurchases(userId: string): PurchaseRequestRow[] {
  return getDb().prepare(
    "SELECT * FROM purchase_requests WHERE user_id = ? AND status = 'PENDING_APPROVAL'"
  ).all(userId) as PurchaseRequestRow[];
}

export function findDuplicatePurchase(userId: string, productId: string, offerDomain: string, idempotencyKey: string): PurchaseRequestRow | undefined {
  return getDb().prepare(
    "SELECT * FROM purchase_requests WHERE user_id = ? AND product_id = ? AND offer_domain = ? AND idempotency_key = ?"
  ).get(userId, productId, offerDomain, idempotencyKey) as PurchaseRequestRow | undefined;
}

// ── Spend ledger queries ──
export function getLedger(userId: string, month?: string): SpendLedgerRow {
  const m = month || currentMonth();
  const db = getDb();
  let row = db.prepare("SELECT * FROM spend_ledger WHERE user_id = ? AND month = ?").get(userId, m) as SpendLedgerRow | undefined;
  if (!row) {
    const id = randomUUID();
    db.prepare("INSERT INTO spend_ledger (id, user_id, month, captured_cents, reserved_cents) VALUES (?, ?, ?, 0, 0)").run(id, userId, m);
    row = db.prepare("SELECT * FROM spend_ledger WHERE id = ?").get(id) as SpendLedgerRow;
  }
  return row;
}

export function reserveBudget(userId: string, amountCents: number) {
  const db = getDb();
  const m = currentMonth();
  getLedger(userId, m); // ensure exists
  db.prepare("UPDATE spend_ledger SET reserved_cents = reserved_cents + ? WHERE user_id = ? AND month = ?").run(amountCents, userId, m);
}

export function releaseBudget(userId: string, amountCents: number) {
  const db = getDb();
  const m = currentMonth();
  db.prepare("UPDATE spend_ledger SET reserved_cents = MAX(0, reserved_cents - ?) WHERE user_id = ? AND month = ?").run(amountCents, userId, m);
}

export function captureBudget(userId: string, amountCents: number) {
  const db = getDb();
  const m = currentMonth();
  db.prepare("UPDATE spend_ledger SET captured_cents = captured_cents + ?, reserved_cents = MAX(0, reserved_cents - ?) WHERE user_id = ? AND month = ?").run(amountCents, amountCents, userId, m);
}

export function refundBudget(userId: string, amountCents: number) {
  const db = getDb();
  const m = currentMonth();
  db.prepare("UPDATE spend_ledger SET captured_cents = MAX(0, captured_cents - ?) WHERE user_id = ? AND month = ?").run(amountCents, userId, m);
}

// ── Audit log queries ──
export function getLatestAuditHash(userId: string): string {
  const row = getDb().prepare(
    "SELECT row_hash FROM audit_log WHERE user_id = ? ORDER BY ts DESC LIMIT 1"
  ).get(userId) as { row_hash: string } | undefined;
  return row?.row_hash || "genesis";
}

export function createAuditLog(params: {
  userId: string;
  actor: string;
  eventType: string;
  purchaseRequestId?: string | null;
  summary: string;
  detailJson?: object | null;
  agentProfileId?: string | null;
  redteam?: boolean;
}): AuditLogRow {
  const db = getDb();
  const id = randomUUID();
  const ts = new Date().toISOString();

  const payload = {
    id, user_id: params.userId, ts, actor: params.actor,
    event_type: params.eventType,
    purchase_request_id: params.purchaseRequestId ?? null,
    summary: params.summary,
    detail_json: params.detailJson ? JSON.stringify(params.detailJson) : null,
    agent_profile_id: params.agentProfileId ?? null,
    redteam: params.redteam ? 1 : 0,
  };

  const prevHash = getLatestAuditHash(params.userId);
  const { rowHash } = chainRow(prevHash, payload);

  db.prepare(`
    INSERT INTO audit_log (id, user_id, ts, actor, event_type, purchase_request_id,
      summary, detail_json, prev_hash, row_hash, agent_profile_id, redteam)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.userId, ts, params.actor, params.eventType,
    params.purchaseRequestId ?? null, params.summary,
    params.detailJson ? JSON.stringify(params.detailJson) : null,
    prevHash, rowHash, params.agentProfileId ?? null,
    params.redteam ? 1 : 0
  );

  return db.prepare("SELECT * FROM audit_log WHERE id = ?").get(id) as AuditLogRow;
}

export function getAuditLogs(userId: string, filters?: {
  eventType?: string;
  actor?: string;
  redteam?: boolean;
  limit?: number;
}): AuditLogRow[] {
  const conditions = ["user_id = ?"];
  const values: any[] = [userId];

  if (filters?.eventType) { conditions.push("event_type = ?"); values.push(filters.eventType); }
  if (filters?.actor) { conditions.push("actor = ?"); values.push(filters.actor); }
  if (filters?.redteam !== undefined) { conditions.push("redteam = ?"); values.push(filters.redteam ? 1 : 0); }

  const limit = filters?.limit || 200;
  values.push(limit);

  return getDb().prepare(
    `SELECT * FROM audit_log WHERE ${conditions.join(" AND ")} ORDER BY ts DESC LIMIT ?`
  ).all(...values) as AuditLogRow[];
}

export function getAllAuditLogs(userId: string): AuditLogRow[] {
  return getDb().prepare(
    "SELECT * FROM audit_log WHERE user_id = ? ORDER BY ts ASC"
  ).all(userId) as AuditLogRow[];
}

export function tamperAuditRow(rowId: string, newAmount: number) {
  // For Red Team demo: deliberately break the chain
  getDb().prepare("UPDATE audit_log SET summary = ? WHERE id = ?").run(
    `[TAMPERED] Amount changed to ${newAmount}`, rowId
  );
}

// ── Mandate queries ──
export function createMandate(params: {
  userId: string;
  kind: string;
  bodyJson: string;
  signature: string;
  bodyHash: string;
  policyVersion?: number;
  purchaseRequestId?: string;
  expiresAt?: string;
}): MandateRow {
  const db = getDb();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO mandates (id, user_id, kind, body_json, signature, body_hash, policy_version,
      purchase_request_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.userId, params.kind, params.bodyJson, params.signature,
    params.bodyHash, params.policyVersion ?? null,
    params.purchaseRequestId ?? null, params.expiresAt ?? null
  );
  return db.prepare("SELECT * FROM mandates WHERE id = ?").get(id) as MandateRow;
}

export function getMandate(id: string): MandateRow | undefined {
  return getDb().prepare("SELECT * FROM mandates WHERE id = ?").get(id) as MandateRow | undefined;
}

export function getMandateByPurchase(purchaseRequestId: string): MandateRow | undefined {
  return getDb().prepare(
    "SELECT * FROM mandates WHERE purchase_request_id = ? AND kind = 'CART' ORDER BY created_at DESC LIMIT 1"
  ).get(purchaseRequestId) as MandateRow | undefined;
}

export function getLeashMandate(userId: string): MandateRow | undefined {
  return getDb().prepare(
    "SELECT * FROM mandates WHERE user_id = ? AND kind = 'LEASH' ORDER BY created_at DESC LIMIT 1"
  ).get(userId) as MandateRow | undefined;
}

// ── Agent profile queries ──
export function getAgentProfiles(userId: string): AgentProfileRow[] {
  return getDb().prepare("SELECT * FROM agent_profiles WHERE user_id = ?").all(userId) as AgentProfileRow[];
}

export function createAgentProfile(params: {
  userId: string;
  name: string;
  apiKeyHash: string;
  subPolicyJson?: string;
}): AgentProfileRow {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO agent_profiles (id, user_id, name, api_key_hash, sub_policy_json) VALUES (?, ?, ?, ?, ?)"
  ).run(id, params.userId, params.name, params.apiKeyHash, params.subPolicyJson ?? null);
  return db.prepare("SELECT * FROM agent_profiles WHERE id = ?").get(id) as AgentProfileRow;
}

export function getAgentProfileByKey(keyHash: string): AgentProfileRow | undefined {
  return getDb().prepare(
    "SELECT * FROM agent_profiles WHERE api_key_hash = ?"
  ).get(keyHash) as AgentProfileRow | undefined;
}

// ── Red Team queries ──
export function createRedteamRun(total: number, passed: number, results: object): RedteamRunRow {
  const db = getDb();
  const id = randomUUID();
  db.prepare("INSERT INTO redteam_runs (id, total, passed, results_json) VALUES (?, ?, ?, ?)").run(
    id, total, passed, JSON.stringify(results)
  );
  return db.prepare("SELECT * FROM redteam_runs WHERE id = ?").get(id) as RedteamRunRow;
}

export function getRedteamRuns(): RedteamRunRow[] {
  return getDb().prepare("SELECT * FROM redteam_runs ORDER BY ts DESC LIMIT 20").all() as RedteamRunRow[];
}

// ── Savings queries ──
export function createSavingsEvent(params: {
  purchaseRequestId?: string;
  kind: string;
  amountCents: number;
}) {
  const db = getDb();
  const id = randomUUID();
  db.prepare("INSERT INTO savings_events (id, purchase_request_id, kind, amount_cents) VALUES (?, ?, ?, ?)").run(
    id, params.purchaseRequestId ?? null, params.kind, params.amountCents
  );
}

export function getSavingsSummary(userId: string) {
  const db = getDb();
  // Get total blocked and total lowest-offer savings
  const blocked = db.prepare(
    "SELECT COALESCE(SUM(se.amount_cents), 0) as total, COUNT(*) as count FROM savings_events se JOIN purchase_requests pr ON se.purchase_request_id = pr.id WHERE pr.user_id = ? AND se.kind = 'BLOCKED'"
  ).get(userId) as { total: number; count: number };
  const savings = db.prepare(
    "SELECT COALESCE(SUM(se.amount_cents), 0) as total, COUNT(*) as count FROM savings_events se JOIN purchase_requests pr ON se.purchase_request_id = pr.id WHERE pr.user_id = ? AND se.kind = 'LOWEST_OFFER'"
  ).get(userId) as { total: number; count: number };
  return {
    blockedTotal: blocked.total,
    blockedCount: blocked.count,
    savingsTotal: savings.total,
    savingsCount: savings.count,
  };
}

// ── Spend summary ──
export function getSpendSummary(userId: string) {
  const db = getDb();
  const ledger = getLedger(userId);
  const byMerchant = db.prepare(
    "SELECT offer_domain as merchant, SUM(amount_cents) as total, COUNT(*) as count FROM purchase_requests WHERE user_id = ? AND status = 'PAID' GROUP BY offer_domain"
  ).all(userId) as Array<{ merchant: string; total: number; count: number }>;
  const byCategory = db.prepare(
    "SELECT category, SUM(amount_cents) as total, COUNT(*) as count FROM purchase_requests WHERE user_id = ? AND status = 'PAID' GROUP BY category"
  ).all(userId) as Array<{ category: string; total: number; count: number }>;
  const byDecision = db.prepare(
    "SELECT policy_decision as decision, COUNT(*) as count FROM purchase_requests WHERE user_id = ? GROUP BY policy_decision"
  ).all(userId) as Array<{ decision: string; count: number }>;

  return {
    captured: ledger.captured_cents,
    reserved: ledger.reserved_cents,
    monthlyBudget: 0, // caller fills from policy
    byMerchant,
    byCategory,
    byDecision,
  };
}

// ── Expire pending orders (>30 min) ──
export function expirePendingOrders(userId: string): number {
  const db = getDb();
  const threshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const rows = db.prepare(
    "SELECT * FROM purchase_requests WHERE user_id = ? AND status = 'PENDING_APPROVAL' AND created_at < ?"
  ).all(userId, threshold) as PurchaseRequestRow[];

  for (const row of rows) {
    db.prepare("UPDATE purchase_requests SET status = 'EXPIRED', updated_at = datetime('now') WHERE id = ?").run(row.id);
    releaseBudget(userId, row.amount_cents);
    createAuditLog({
      userId, actor: "SYSTEM", eventType: "ERROR",
      purchaseRequestId: row.id,
      summary: `Order expired after 30 minutes: ${row.title}`,
    });
  }
  return rows.length;
}

// ── Get ledger state for policy engine ──
export function getLedgerState(userId: string): import("../policy/schema").LedgerState {
  const ledger = getLedger(userId);
  const recent = getDb().prepare(
    "SELECT amount_cents, created_at, policy_decision FROM purchase_requests WHERE user_id = ? AND status IN ('PENDING_APPROVAL', 'PAID') AND created_at > datetime('now', '-30 days') ORDER BY created_at DESC"
  ).all(userId) as Array<{ amount_cents: number; created_at: string; policy_decision: string }>;

  return {
    capturedCents: ledger.captured_cents,
    reservedCents: ledger.reserved_cents,
    recentPurchases: recent.map(r => ({
      amountCents: r.amount_cents,
      createdAt: new Date(r.created_at),
      autoApproved: r.policy_decision === "ALLOW",
    })),
  };
}

// ── Purchase request by approval token ──
export function getPurchaseByApprovalToken(tokenHash: string): PurchaseRequestRow | undefined {
  return getDb().prepare(
    "SELECT * FROM purchase_requests WHERE approval_token_hash = ? AND status = 'PENDING_APPROVAL'"
  ).get(tokenHash) as PurchaseRequestRow | undefined;
}
