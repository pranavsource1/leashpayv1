"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [policy, setPolicy] = useState<any>(null);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [nlInput, setNlInput] = useState("");
  const [nlResult, setNlResult] = useState<any>(null);
  const [compiling, setCompiling] = useState(false);

  useEffect(() => { loadPolicy(); }, []);

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
      setMsg(`❌ ${data.error}`);
    } else {
      setMsg(`✅ Saved! Version ${data.version}, Mandate: ${data.mandateHash}`);
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
      setMsg("Changes applied — click Save to confirm");
    }
  }

  if (!policy) return <p>Loading...</p>;

  const fieldStyle = { width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontWeight: "bold" as const, marginBottom: "4px", fontSize: "13px" };
  const groupStyle = { marginBottom: "16px" };

  return (
    <div>
      <h1>⚙️ Leash Settings</h1>
      <p style={{ color: "#666" }}>Policy version: {version} | Configure the spending rules for your AI agent.</p>

      {msg && <div style={{ padding: "10px", borderRadius: "6px", background: msg.startsWith("✅") ? "#d4edda" : "#f8d7da", marginBottom: "16px" }}>{msg}</div>}

      {/* Natural Language Input */}
      <div style={{ background: "#e8f0fe", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
        <h3 style={{ marginTop: 0 }}>📝 Set rules in plain English</h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={nlInput} onChange={e => setNlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && compileNL()}
            placeholder='e.g. "Spend up to $500 this month, ask me above $50, no gift cards"'
            style={{ ...fieldStyle, flex: 1 }} />
          <button onClick={compileNL} disabled={compiling}
            style={{ padding: "8px 20px", borderRadius: "6px", background: "#003087", color: "white", border: "none", cursor: "pointer" }}>
            {compiling ? "..." : "Apply"}
          </button>
        </div>
        {nlResult && (
          <div style={{ marginTop: "12px", background: "white", padding: "12px", borderRadius: "6px" }}>
            <p style={{ fontWeight: "bold" }}>Proposed changes:</p>
            {nlResult.changes?.map((c: any, i: number) => (
              <div key={i} style={{ fontSize: "13px", padding: "4px 0", color: c.isLoosening ? "#c00" : "#080" }}>
                {c.isLoosening ? "⚠️" : "✓"} <strong>{c.field}</strong>: {JSON.stringify(c.from)} → {JSON.stringify(c.to)}
                {c.isLoosening && " (loosening)"}
              </div>
            ))}
            <p style={{ fontSize: "13px", marginTop: "8px", color: "#666" }}>{nlResult.summary}</p>
            <button onClick={applyNLChanges} style={{ marginTop: "8px", padding: "6px 16px", borderRadius: "4px", background: "#28a745", color: "white", border: "none", cursor: "pointer" }}>
              Accept Changes
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd" }}>
          <h3 style={{ marginTop: 0 }}>💰 Budget & Limits</h3>
          <div style={groupStyle}>
            <label style={labelStyle}>Monthly Budget (cents)</label>
            <input type="number" value={policy.monthlyBudget} onChange={e => setPolicy({ ...policy, monthlyBudget: parseInt(e.target.value) || 0 })} style={fieldStyle} />
            <small style={{ color: "#666" }}>${(policy.monthlyBudget / 100).toFixed(2)}</small>
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Per-Purchase Cap (cents)</label>
            <input type="number" value={policy.perPurchaseCap} onChange={e => setPolicy({ ...policy, perPurchaseCap: parseInt(e.target.value) || 0 })} style={fieldStyle} />
            <small style={{ color: "#666" }}>${(policy.perPurchaseCap / 100).toFixed(2)}</small>
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Require Approval Over (cents)</label>
            <input type="number" value={policy.requireApprovalOver} onChange={e => setPolicy({ ...policy, requireApprovalOver: parseInt(e.target.value) || 0 })} style={fieldStyle} />
            <small style={{ color: "#666" }}>${(policy.requireApprovalOver / 100).toFixed(2)}</small>
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Auto-Approve Under (cents)</label>
            <input type="number" value={policy.autoApproveUnder} onChange={e => setPolicy({ ...policy, autoApproveUnder: parseInt(e.target.value) || 0 })} style={fieldStyle} />
          </div>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd" }}>
          <h3 style={{ marginTop: 0 }}>🏪 Merchants & Categories</h3>
          <div style={groupStyle}>
            <label style={labelStyle}>Allowed Merchants (comma-separated)</label>
            <input value={policy.allowedMerchants?.join(", ") || ""} onChange={e => setPolicy({ ...policy, allowedMerchants: e.target.value ? e.target.value.split(",").map((s: string) => s.trim()) : [] })} style={fieldStyle}
              placeholder="e.g. bestbuy.com, walmart.com, target.com" />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Blocked Merchants (comma-separated)</label>
            <input value={policy.blockedMerchants?.join(", ") || ""} onChange={e => setPolicy({ ...policy, blockedMerchants: e.target.value ? e.target.value.split(",").map((s: string) => s.trim()) : [] })} style={fieldStyle} />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Blocked Categories (comma-separated)</label>
            <input value={policy.blockedCategories?.join(", ") || ""} onChange={e => setPolicy({ ...policy, blockedCategories: e.target.value ? e.target.value.split(",").map((s: string) => s.trim()) : [] })} style={fieldStyle} />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Guardian Label</label>
            <input value={policy.guardianLabel || ""} onChange={e => setPolicy({ ...policy, guardianLabel: e.target.value || null })} style={fieldStyle} placeholder="e.g. Mom, Manager" />
          </div>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd" }}>
          <h3 style={{ marginTop: 0 }}>🔒 Safety Controls</h3>
          <div style={groupStyle}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={policy.frozen} onChange={e => setPolicy({ ...policy, frozen: e.target.checked })} />
              <strong style={{ color: policy.frozen ? "#c00" : "#333" }}>🛑 Kill Switch (Freeze All Spending)</strong>
            </label>
          </div>
          <div style={groupStyle}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={policy.requireInStock} onChange={e => setPolicy({ ...policy, requireInStock: e.target.checked })} />
              Require items in stock
            </label>
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Max Price vs History (%)</label>
            <input type="number" value={policy.maxPriceVsHistoryPct} onChange={e => setPolicy({ ...policy, maxPriceVsHistoryPct: parseInt(e.target.value) || 0 })} style={fieldStyle} />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Velocity Window (hours)</label>
            <input type="number" value={policy.velocityWindowHours} onChange={e => setPolicy({ ...policy, velocityWindowHours: parseInt(e.target.value) || 24 })} style={fieldStyle} />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Velocity Limit (cents)</label>
            <input type="number" value={policy.velocityLimitCents} onChange={e => setPolicy({ ...policy, velocityLimitCents: parseInt(e.target.value) || 0 })} style={fieldStyle} />
          </div>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd" }}>
          <h3 style={{ marginTop: 0 }}>📋 Policy Preview (JSON)</h3>
          <pre style={{ background: "#f5f5f5", padding: "12px", borderRadius: "4px", fontSize: "11px", overflow: "auto", maxHeight: "300px" }}>
            {JSON.stringify(policy, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
        <button onClick={savePolicy} disabled={saving}
          style={{ padding: "12px 32px", borderRadius: "8px", background: "#003087", color: "white", border: "none", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}>
          {saving ? "Saving..." : "💾 Save Policy"}
        </button>
        <button onClick={loadPolicy}
          style={{ padding: "12px 24px", borderRadius: "8px", background: "#eee", border: "1px solid #ccc", cursor: "pointer" }}>
          ↩ Reset
        </button>
      </div>

      {/* Policy Summary */}
      <div style={{ marginTop: "20px", padding: "16px", background: "#f8f9fa", borderRadius: "8px", border: "1px solid #ddd" }}>
        <p style={{ margin: 0, fontSize: "14px" }}>
          <strong>Summary:</strong> The agent may spend up to ${(policy.monthlyBudget / 100).toFixed(0)} this month,
          at most ${(policy.perPurchaseCap / 100).toFixed(0)} per purchase,
          and must ask you above ${(policy.requireApprovalOver / 100).toFixed(0)}.
          {policy.allowedMerchants?.length > 0 && ` Only from ${policy.allowedMerchants.join(", ")}.`}
          {policy.blockedCategories?.length > 0 && ` ${policy.blockedCategories.join(" and ")} blocked.`}
          {policy.frozen && " ⚠️ CURRENTLY FROZEN."}
        </p>
      </div>
    </div>
  );
}
