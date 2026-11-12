"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/icons";

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
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
        Loading policy…
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-400 hover:border-line-strong focus:border-primary focus:ring-2 focus:ring-primary/20";
  const labelClass = "mb-1.5 block text-xs font-semibold text-foreground";
  const hintClass = "mt-1 block text-[11px] text-muted-400";
  const cardClass = "rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6";
  const headingClass = "mb-4 flex items-center gap-2 text-base font-semibold text-foreground";

  return (
    <div className="pb-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Spending policy</h1>
          <p className="mt-1 text-sm text-muted">
            Version {version} · the rules your agent must satisfy before it can spend.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted">
          <Icon name="shield" className="h-3.5 w-3.5 text-primary" />
          Enforced server-side
        </span>
      </div>

      {msg && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            msgError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-cta-border bg-cta-soft text-emerald-800"
          }`}
        >
          <Icon
            name={msgError ? "alert" : "check"}
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={2.2}
          />
          <span className="break-words">{msg}</span>
        </div>
      )}

      {/* Natural language rules */}
      <section className="mb-4 rounded-2xl border border-primary/15 bg-primary-soft/60 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Icon name="sparkles" className="h-4 w-4 text-primary" />
          Set rules in plain English
        </h2>
        <p className="mt-1 text-xs text-muted">
          Describe the limit and the policy compiler turns it into structured rules for review.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && compileNL()}
            placeholder='e.g. "Spend up to $500 this month, ask me above $50, no gift cards"'
            className={`${inputClass} sm:flex-1`}
          />
          <button
            onClick={compileNL}
            disabled={compiling}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {compiling ? "Compiling…" : "Apply"}
          </button>
        </div>

        {nlResult && (
          <div className="mt-3 rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Proposed changes
            </p>
            <ul className="mt-2 space-y-1.5">
              {nlResult.changes?.map((c: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Icon
                    name={c.isLoosening ? "alert" : "check"}
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.isLoosening ? "text-amber-500" : "text-cta"}`}
                    strokeWidth={2.2}
                  />
                  <span className="text-muted-600">
                    <strong className="font-semibold text-foreground">{c.field}</strong>:{" "}
                    {JSON.stringify(c.from)} → {JSON.stringify(c.to)}
                    {c.isLoosening && <span className="text-amber-600"> (loosening)</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted">{nlResult.summary}</p>
            <button
              onClick={applyNLChanges}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-cta-border bg-cta-soft px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
              Accept changes
            </button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className={headingClass}>
            <Icon name="wallet" className="h-4 w-4 text-muted-400" />
            Budget &amp; limits
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Monthly budget (cents)</label>
              <input
                type="number"
                value={policy.monthlyBudget}
                onChange={(e) => setPolicy({ ...policy, monthlyBudget: parseInt(e.target.value) || 0 })}
                className={inputClass}
              />
              <span className={hintClass}>${(policy.monthlyBudget / 100).toFixed(2)}</span>
            </div>
            <div>
              <label className={labelClass}>Per-purchase cap (cents)</label>
              <input
                type="number"
                value={policy.perPurchaseCap}
                onChange={(e) =>
                  setPolicy({ ...policy, perPurchaseCap: parseInt(e.target.value) || 0 })
                }
                className={inputClass}
              />
              <span className={hintClass}>${(policy.perPurchaseCap / 100).toFixed(2)}</span>
            </div>
            <div>
              <label className={labelClass}>Require approval over (cents)</label>
              <input
                type="number"
                value={policy.requireApprovalOver}
                onChange={(e) =>
                  setPolicy({ ...policy, requireApprovalOver: parseInt(e.target.value) || 0 })
                }
                className={inputClass}
              />
              <span className={hintClass}>${(policy.requireApprovalOver / 100).toFixed(2)}</span>
            </div>
            <div>
              <label className={labelClass}>Auto-approve under (cents)</label>
              <input
                type="number"
                value={policy.autoApproveUnder}
                onChange={(e) =>
                  setPolicy({ ...policy, autoApproveUnder: parseInt(e.target.value) || 0 })
                }
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className={headingClass}>
            <Icon name="store" className="h-4 w-4 text-muted-400" />
            Merchants &amp; categories
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Allowed merchants (comma-separated)</label>
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
              <label className={labelClass}>Blocked merchants (comma-separated)</label>
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
              <label className={labelClass}>Blocked categories (comma-separated)</label>
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
              <label className={labelClass}>Guardian label</label>
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
          <h2 className={headingClass}>
            <Icon name="shieldCheck" className="h-4 w-4 text-muted-400" />
            Safety controls
          </h2>
          <div className="space-y-4">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                policy.frozen ? "border-red-200 bg-red-50" : "border-line bg-canvas hover:border-line-strong"
              }`}
            >
              <input
                type="checkbox"
                checked={policy.frozen}
                onChange={(e) => setPolicy({ ...policy, frozen: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Icon
                    name="lock"
                    className={`h-3.5 w-3.5 ${policy.frozen ? "text-red-600" : "text-muted-400"}`}
                  />
                  Kill switch
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Freeze all spending until you turn this back off.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas p-3 transition-colors hover:border-line-strong">
              <input
                type="checkbox"
                checked={policy.requireInStock}
                onChange={(e) => setPolicy({ ...policy, requireInStock: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  Require items in stock
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  Block purchases from offers that are unavailable.
                </span>
              </span>
            </label>

            <div>
              <label className={labelClass}>Max price vs history (%)</label>
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
                <label className={labelClass}>Velocity window (h)</label>
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
                <label className={labelClass}>Velocity limit (cents)</label>
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
          <h2 className={headingClass}>
            <Icon name="list" className="h-4 w-4 text-muted-400" />
            Policy preview
          </h2>
          <pre className="scroll-thin max-h-[300px] overflow-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed text-muted-600">
            {JSON.stringify(policy, null, 2)}
          </pre>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={savePolicy}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
          {saving ? "Saving…" : "Save policy"}
        </button>
        <button
          onClick={loadPolicy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-muted-600 transition-colors hover:border-line-strong hover:text-foreground"
        >
          <Icon name="refresh" className="h-4 w-4" />
          Reset
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm leading-relaxed text-muted-600">
          <span className="font-semibold text-foreground">Summary: </span>
          The agent may spend up to ${(policy.monthlyBudget / 100).toFixed(0)} this month, at most $
          {(policy.perPurchaseCap / 100).toFixed(0)} per purchase, and must ask you above $
          {(policy.requireApprovalOver / 100).toFixed(0)}.
          {policy.allowedMerchants?.length > 0 &&
            ` Only from ${policy.allowedMerchants.join(", ")}.`}
          {policy.blockedCategories?.length > 0 &&
            ` ${policy.blockedCategories.join(" and ")} blocked.`}
          {policy.frozen && (
            <span className="ml-1 font-semibold text-red-600">Currently frozen.</span>
          )}
        </p>
      </div>
    </div>
  );
}
