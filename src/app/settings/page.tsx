"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/icons";
import { formatINR, inrToUsd } from "@/lib/money";

export default function SettingsPage() {
  const [policy, setPolicy] = useState<any>(null);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [nlResult, setNlResult] = useState<any>(null);
  const [compiling, setCompiling] = useState(false);

  useEffect(() => {
    loadPolicy();
  }, []);

  async function loadPolicy() {
    const res = await fetch("/api/policy");
    const data = await res.json();
    setPolicy(data.policy);
    setVersion(data.version);
  }

  async function savePolicy() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy }),
    });
    const data = await res.json();
    if (data.error) {
      setMsgError(true);
      setMsg(data.error);
    } else {
      setMsgError(false);
      setMsg(`Policy saved. Version ${data.version} · Mandate ${data.mandateHash}`);
      setVersion(data.version);
      setPolicy(data.policy);
    }
    setSaving(false);
  }

  async function compileNL() {
    if (!nlInput.trim()) return;
    setCompiling(true);
    const res = await fetch("/api/policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: nlInput }),
    });
    const data = await res.json();
    setNlResult(data);
    setCompiling(false);
  }

  function applyNLChanges() {
    if (nlResult?.proposed) {
      setPolicy(nlResult.proposed);
      setNlResult(null);
      setNlInput("");
      setMsgError(false);
      setMsg("Changes applied — save to confirm.");
    }
  }

  if (!policy) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-ink" />
        Loading policy…
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/40 hover:border-ink/30 focus:border-ink";
  const labelClass =
    "mb-1.5 block text-[12px] uppercase tracking-[0.06em] text-ink";
  const hintClass = "mt-1 block text-[11px] text-ink/40";
  const cardClass = "rounded-2xl border border-hairline bg-paper p-5";
  const headingClass = "mb-4 flex items-center gap-2 text-base font-semibold text-ink";

  return (
    <div className="pb-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Spending policy
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            Version {version} · the rules your agent must satisfy before it can spend.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs text-ink/60">
          <Icon name="shield" className="h-3.5 w-3.5 text-ink/40" />
          Enforced server-side
        </span>
      </div>

      {msg && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            msgError
              ? "border-hairline bg-paper text-ink"
              : "border-hairline bg-paper text-ink"
          }`}
        >
          {msgError ? (
            <Icon
              name="alert"
              className="mt-0.5 h-4 w-4 shrink-0 text-ink"
              strokeWidth={2.2}
            />
          ) : (
            <span className="mt-1 flex shrink-0">
              <span className="h-2 w-2 rounded-full bg-signal-green" />
            </span>
          )}
          <span className="break-words">{msg}</span>
        </div>
      )}

      {/* Natural language rules */}
      <section className="mb-4 rounded-2xl border border-hairline bg-paper p-5">
        <h2
          className="flex items-center gap-2 text-base font-semibold text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <Icon name="leashDog" className="h-4 w-4 text-ink" />
          Set rules in plain English
        </h2>
        <p className="mt-1 text-xs text-ink/40">
          Describe the limit and the policy compiler turns it into structured rules for review.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && compileNL()}
            placeholder='e.g. "Spend up to ₹50,000 this month, ask me above ₹5,000, no gift cards"'
            className={`${inputClass} sm:flex-1`}
          />
          <button
            onClick={compileNL}
            disabled={compiling}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {compiling ? "Compiling…" : "Apply"}
          </button>
        </div>

        {nlResult && (
          <div className="mt-3 rounded-2xl border border-hairline bg-paper p-4">
            <p
              className="text-[12px] uppercase tracking-[0.06em] text-ink/50"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Proposed changes
            </p>
            <ul className="mt-2 space-y-1.5">
              {nlResult.changes?.map((c: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {c.isLoosening ? (
                    <Icon
                      name="alert"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember"
                      strokeWidth={2.2}
                    />
                  ) : (
                    <span className="mt-1 flex shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal-green" />
                    </span>
                  )}
                  <span className="text-ink/60">
                    <strong className="font-semibold text-ink">{c.field}</strong>:{" "}
                    {JSON.stringify(c.from)} → {JSON.stringify(c.to)}
                    {c.isLoosening && <span className="text-ember"> (loosening)</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ink/50">{nlResult.summary}</p>
            <button
              onClick={applyNLChanges}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:border-ink/30 hover:text-ink"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-signal-green" />
              Accept changes
            </button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className={headingClass} style={{ fontFamily: "var(--font-display)" }}>
            <Icon name="wallet" className="h-4 w-4 text-ink/40" />
            Budget &amp; limits
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Monthly budget (₹)</label>
              <input
                type="number"
                value={Math.round((policy.monthlyBudget / 100) * 83)}
                onChange={(e) => setPolicy({ ...policy, monthlyBudget: inrToUsd(parseInt(e.target.value) || 0) })}
                className={inputClass}
              />
              <span className={hintClass}>{formatINR(policy.monthlyBudget)}</span>
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Per-purchase cap (₹)</label>
              <input
                type="number"
                value={Math.round((policy.perPurchaseCap / 100) * 83)}
                onChange={(e) =>
                  setPolicy({ ...policy, perPurchaseCap: inrToUsd(parseInt(e.target.value) || 0) })
                }
                className={inputClass}
              />
              <span className={hintClass}>{formatINR(policy.perPurchaseCap)}</span>
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Require approval over (₹)</label>
              <input
                type="number"
                value={Math.round((policy.requireApprovalOver / 100) * 83)}
                onChange={(e) =>
                  setPolicy({ ...policy, requireApprovalOver: inrToUsd(parseInt(e.target.value) || 0) })
                }
                className={inputClass}
              />
              <span className={hintClass}>{formatINR(policy.requireApprovalOver)}</span>
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Auto-approve under (₹)</label>
              <input
                type="number"
                value={Math.round((policy.autoApproveUnder / 100) * 83)}
                onChange={(e) =>
                  setPolicy({ ...policy, autoApproveUnder: inrToUsd(parseInt(e.target.value) || 0) })
                }
                className={inputClass}
              />
              <span className={hintClass}>{formatINR(policy.autoApproveUnder)}</span>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className={headingClass} style={{ fontFamily: "var(--font-display)" }}>
            <Icon name="store" className="h-4 w-4 text-ink/40" />
            Merchants &amp; categories
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Allowed merchants (comma-separated)</label>
              <input
                value={policy.allowedMerchants?.join(", ") || ""}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    allowedMerchants: e.target.value
                      ? e.target.value.split(",").map((s: string) => s.trim())
                      : [],
                  })
                }
                placeholder="e.g. bestbuy.com, walmart.com, target.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Blocked merchants (comma-separated)</label>
              <input
                value={policy.blockedMerchants?.join(", ") || ""}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    blockedMerchants: e.target.value
                      ? e.target.value.split(",").map((s: string) => s.trim())
                      : [],
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Blocked categories (comma-separated)</label>
              <input
                value={policy.blockedCategories?.join(", ") || ""}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    blockedCategories: e.target.value
                      ? e.target.value.split(",").map((s: string) => s.trim())
                      : [],
                  })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Guardian label</label>
              <input
                value={policy.guardianLabel || ""}
                onChange={(e) => setPolicy({ ...policy, guardianLabel: e.target.value || null })}
                placeholder="e.g. Mom, Manager"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className={headingClass} style={{ fontFamily: "var(--font-display)" }}>
            <Icon name="shieldCheck" className="h-4 w-4 text-ink/40" />
            Safety controls
          </h2>
          <div className="space-y-4">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                policy.frozen ? "border-ink/30 bg-canvas" : "border-hairline bg-canvas hover:border-ink/30"
              }`}
            >
              <input
                type="checkbox"
                checked={policy.frozen}
                onChange={(e) => setPolicy({ ...policy, frozen: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-ink"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Icon
                    name="lock"
                    className={`h-3.5 w-3.5 ${policy.frozen ? "text-ink" : "text-ink/40"}`}
                  />
                  Kill switch
                </span>
                <span className="mt-0.5 block text-xs text-ink/50">
                  Freeze all spending until you turn this back off.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-hairline bg-canvas p-3 transition-colors hover:border-ink/30">
              <input
                type="checkbox"
                checked={policy.requireInStock}
                onChange={(e) => setPolicy({ ...policy, requireInStock: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-ink"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Require items in stock
                </span>
                <span className="mt-0.5 block text-xs text-ink/50">
                  Block purchases from offers that are unavailable.
                </span>
              </span>
            </label>

            <div>
              <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Max price vs history (%)</label>
              <input
                type="number"
                value={policy.maxPriceVsHistoryPct}
                onChange={(e) =>
                  setPolicy({ ...policy, maxPriceVsHistoryPct: parseInt(e.target.value) || 0 })
                }
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Velocity window (h)</label>
                <input
                  type="number"
                  value={policy.velocityWindowHours}
                  onChange={(e) =>
                    setPolicy({ ...policy, velocityWindowHours: parseInt(e.target.value) || 24 })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} style={{ fontFamily: "var(--font-mono-ui)" }}>Velocity limit (cents)</label>
                <input
                  type="number"
                  value={policy.velocityLimitCents}
                  onChange={(e) =>
                    setPolicy({ ...policy, velocityLimitCents: parseInt(e.target.value) || 0 })
                  }
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className={headingClass} style={{ fontFamily: "var(--font-display)" }}>
            <Icon name="list" className="h-4 w-4 text-ink/40" />
            Policy preview
          </h2>
          <pre className="scroll-thin max-h-[300px] overflow-auto rounded-2xl border border-hairline bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink/60">
            {JSON.stringify(policy, null, 2)}
          </pre>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={savePolicy}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
          {saving ? "Saving…" : "Save policy"}
        </button>
        <button
          onClick={loadPolicy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2.5 text-sm font-medium text-ink/60 transition-colors hover:border-ink/30 hover:text-ink"
        >
          <Icon name="refresh" className="h-4 w-4" />
          Reset
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline bg-paper p-4">
        <p className="text-sm leading-relaxed text-ink/60">
          <span className="font-semibold text-ink">Summary: </span>
          The agent may spend up to {formatINR(policy.monthlyBudget)} this month, at most{" "}
          {formatINR(policy.perPurchaseCap)} per purchase, and must ask you above{" "}
          {formatINR(policy.requireApprovalOver)}.
          {policy.allowedMerchants?.length > 0 &&
            ` Only from ${policy.allowedMerchants.join(", ")}.`}
          {policy.blockedCategories?.length > 0 &&
            ` ${policy.blockedCategories.join(" and ")} blocked.`}
          {policy.frozen && (
            <span className="ml-1 font-medium text-ink">Currently frozen.</span>
          )}
        </p>
      </div>
    </div>
  );
}
