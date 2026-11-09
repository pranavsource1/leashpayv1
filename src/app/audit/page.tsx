"use client";
import { useState, useEffect } from "react";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState({ eventType: "", actor: "", redteam: "" });
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, [filter]);

  async function loadLogs() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.eventType) params.set("eventType", filter.eventType);
    if (filter.actor) params.set("actor", filter.actor);
    if (filter.redteam) params.set("redteam", filter.redteam);
    const res = await fetch(`/api/audit?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setLoading(false);
  }

  async function verifyChain() {
    const res = await fetch("/api/audit?action=verify");
    const data = await res.json();
    setVerifyResult(data);
  }

  async function simulateTamper() {
    if (logs.length === 0) return;
    const rowId = logs[Math.floor(logs.length / 2)]?.id;
    if (!rowId) return;
    await fetch(`/api/audit?action=tamper&rowId=${rowId}`);
    loadLogs();
    setVerifyResult(null);
  }

  function downloadCSV() {
    const headers = ["Time", "Actor", "Event", "Summary", "Row Hash"];
    const rows = logs.map(l => [l.ts, l.actor, l.event_type, `"${l.summary.replace(/"/g, '""')}"`, l.row_hash?.substring(0, 16)]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leashpay-audit.csv"; a.click();
  }

  const decisionColor = (evt: string) => {
    if (evt === "DENIED" || evt === "MANDATE_MISMATCH" || evt === "KILL_SWITCH") return "#fee";
    if (evt === "CAPTURED" || evt === "APPROVED") return "#dfd";
    if (evt === "POLICY_DECISION" || evt === "APPROVAL_REQUESTED") return "#ffd";
    return "white";
  };

  const actorBadge = (actor: string) => {
    const colors: Record<string, string> = {
      AGENT: "#2196f3", POLICY: "#ff9800", USER: "#4caf50", PAYPAL: "#003087", SYSTEM: "#666"
    };
    return { background: colors[actor] || "#999", color: "white", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold" as const };
  };

  return (
    <div>
      <h1>📋 Audit Log</h1>

      {/* Chain Verification */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <button onClick={verifyChain} style={{ padding: "8px 20px", borderRadius: "6px", background: "#003087", color: "white", border: "none", cursor: "pointer", fontWeight: "bold" }}>
          🔗 Verify Chain
        </button>
        <button onClick={simulateTamper} style={{ padding: "8px 20px", borderRadius: "6px", background: "#c00", color: "white", border: "none", cursor: "pointer" }}>
          🐛 Simulate Tamper
        </button>
        <button onClick={downloadCSV} style={{ padding: "8px 20px", borderRadius: "6px", background: "#28a745", color: "white", border: "none", cursor: "pointer" }}>
          📥 Export CSV
        </button>
        <button onClick={loadLogs} style={{ padding: "8px 20px", borderRadius: "6px", background: "#eee", border: "1px solid #ccc", cursor: "pointer" }}>
          🔄 Refresh
        </button>
      </div>

      {verifyResult && (
        <div style={{
          padding: "12px", borderRadius: "8px", marginBottom: "16px",
          background: verifyResult.valid ? "#d4edda" : "#f8d7da",
          border: `1px solid ${verifyResult.valid ? "#c3e6cb" : "#f5c6cb"}`
        }}>
          {verifyResult.valid
            ? `✅ Chain valid! ${verifyResult.totalRows} rows verified.`
            : `❌ Chain broken at row ${verifyResult.brokenAt}! ${verifyResult.brokenRow?.summary || ""}`}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <select value={filter.eventType} onChange={e => setFilter({ ...filter, eventType: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ccc" }}>
          <option value="">All Events</option>
          {["SEARCH","POLICY_DECISION","ORDER_CREATED","APPROVED","CAPTURED","DENIED","PRICE_CHANGED","KILL_SWITCH","WEBHOOK","ERROR","MANDATE_SIGNED","MANDATE_MISMATCH","POLICY_CHANGED","APPROVAL_REQUESTED","DECLINED","REFUNDED","REDTEAM_RUN"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={filter.actor} onChange={e => setFilter({ ...filter, actor: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ccc" }}>
          <option value="">All Actors</option>
          {["AGENT","POLICY","USER","PAYPAL","SYSTEM"].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={filter.redteam} onChange={e => setFilter({ ...filter, redteam: e.target.value })}
          style={{ padding: "6px 10px", borderRadius: "4px", border: "1px solid #ccc" }}>
          <option value="">All</option>
          <option value="false">Production Only</option>
          <option value="true">Red Team Only</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #ddd", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Time</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Actor</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Event</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Summary</th>
              <th style={{ padding: "10px", borderBottom: "2px solid #ddd" }}>Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center" }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#999" }}>No audit entries yet. Use the chat to generate some!</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} style={{ background: decisionColor(log.event_type), borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: "12px" }}>
                  {new Date(log.ts).toLocaleString()}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={actorBadge(log.actor)}>{log.actor}</span>
                </td>
                <td style={{ padding: "8px 10px", fontWeight: "bold" }}>{log.event_type}</td>
                <td style={{ padding: "8px 10px", maxWidth: "400px" }}>{log.summary}</td>
                <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: "11px", color: "#666" }}>
                  {log.row_hash?.substring(0, 12)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
