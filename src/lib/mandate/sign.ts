/**
 * mandate/sign.ts — Ed25519 signing, deterministic hashing, and hash-chain
 * verification for LeashPay mandates.
 */

import {
  createHash,
  sign,
  verify,
  generateKeyPairSync,
  KeyObject,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Deterministic JSON serialisation (sorted keys, no extra whitespace)
// ---------------------------------------------------------------------------

export function canonical(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(sortKeys);
  if (typeof val === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((val as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return val;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Hash-chain helpers
// ---------------------------------------------------------------------------

export interface ChainRow {
  prevHash: string;
  rowHash: string;
  [key: string]: unknown;
}

/**
 * Compute the prev + row hashes for a new chain entry.
 * `row` should be the payload (without prevHash/rowHash).
 */
export function chainRow(
  prevHash: string,
  row: Record<string, unknown>,
): { prevHash: string; rowHash: string } {
  const rowHash = sha256(prevHash + canonical(row));
  return { prevHash, rowHash };
}

// ---------------------------------------------------------------------------
// Ed25519 key management
// ---------------------------------------------------------------------------

export interface SigningKeyPair {
  publicKey: KeyObject;
  privateKey: KeyObject;
}

/**
 * Generate a fresh Ed25519 key pair.
 */
export function generateSigningKeys(): SigningKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicKey, privateKey };
}

/**
 * Load signing keys from environment variables (base64-encoded PEM) or
 * generate + return a new pair if neither var is set.
 */
export function loadOrGenerateKeys(): SigningKeyPair {
  const privEnv = process.env.SIGNING_PRIVATE_KEY;
  const pubEnv = process.env.SIGNING_PUBLIC_KEY;

  if (privEnv && pubEnv) {
    const privateKey = importPrivateKey(privEnv);
    const publicKey = importPublicKey(pubEnv);
    return { publicKey, privateKey };
  }

  // Fallback: generate ephemeral keys (dev-only)
  return generateSigningKeys();
}

function importPrivateKey(base64Pem: string): KeyObject {
  const pem = Buffer.from(base64Pem, "base64").toString("utf8");
  const { createPrivateKey } = require("node:crypto") as typeof import("node:crypto");
  return createPrivateKey(pem);
}

function importPublicKey(base64Pem: string): KeyObject {
  const pem = Buffer.from(base64Pem, "base64").toString("utf8");
  const { createPublicKey } = require("node:crypto") as typeof import("node:crypto");
  return createPublicKey(pem);
}

// Singleton – lazily initialised
let _keys: SigningKeyPair | null = null;
export function getKeys(): SigningKeyPair {
  if (!_keys) _keys = loadOrGenerateKeys();
  return _keys;
}

// ---------------------------------------------------------------------------
// Sign / verify mandates
// ---------------------------------------------------------------------------

export interface SignedMandate {
  body: string;
  sig: string;
  hash: string;
}

/**
 * Sign a mandate payload.
 * Returns the canonical JSON body, an Ed25519 signature (hex), and a
 * SHA-256 hash of the body.
 */
export function signMandate(
  payload: object,
  privateKey?: KeyObject,
): SignedMandate {
  const pk = privateKey ?? getKeys().privateKey;
  const body = canonical(payload);
  const signature = sign(null, Buffer.from(body, "utf8"), pk);
  return {
    body,
    sig: signature.toString("hex"),
    hash: sha256(body),
  };
}

/**
 * Verify a signed mandate against a public key.
 */
export function verifyMandate(
  mandate: { body: string; sig: string },
  publicKey?: KeyObject,
): boolean {
  const pub = publicKey ?? getKeys().publicKey;
  return verify(
    null,
    Buffer.from(mandate.body, "utf8"),
    pub,
    Buffer.from(mandate.sig, "hex"),
  );
}

// ---------------------------------------------------------------------------
// Chain verification
// ---------------------------------------------------------------------------

/**
 * Walk an ordered array of chain rows and confirm each row's hash links to
 * the previous.  Returns `{ valid: true }` on success, or `{ valid: false,
 * brokenAt: <index> }` on the first mismatch.
 */
export function verifyChain(
  rows: ChainRow[],
): { valid: boolean; brokenAt?: number } {
  for (let i = 0; i < rows.length; i++) {
    const { prevHash, rowHash, ...payload } = rows[i];
    const expected = sha256(prevHash + canonical(payload));
    if (expected !== rowHash) {
      return { valid: false, brokenAt: i };
    }
    // Check linkage: row[i].prevHash must equal row[i-1].rowHash
    if (i > 0 && prevHash !== rows[i - 1].rowHash) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true };
}
