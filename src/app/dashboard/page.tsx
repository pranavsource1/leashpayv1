"use client";
import { useState, useEffect } from "react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(setData);
    fetch("/api/purchases").then(r => r.json()).then(d => setPurchases(d.purchases || []));
  }, []);

  async function refund(id: string) {
    if (!confirm("Refund this purchase?")) return;
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseRequestId: id }),
    });
    const result = await res.json();
    if (result.success) {
      alert("Refund processed!");
      location.reload();
    } else {
      alert(`Refund failed: ${result.error}`);
    }
  }

  if (!data) return <p>Loading dashboard...</p>;

  const b = data.budget;
  const budgetPct = b.remainingPct;
  const barColor = budgetPct > 50 ? "#28a745" : budgetPct > 20 ? "#ffc107" : "#dc3545";

  return (
    <div>
      <h1>📊 Spend Dashboard</h1>

      {/* Budget Meter */}
      <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
        <h3 style={{ marginTop: 0 }}>💰 Monthly Budget {b.frozen && "🔒 FROZEN"}</h3>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span>Remaining: <strong>{b.remainingFormatted}</strong> ({budgetPct}%)</span>
          <span>Total: {b.totalFormatted}</span>
        </div>
        <div style={{ background: "#eee", borderRadius: "8px", height: "24px", overflow: "hidden" }}>
          <div style={{
            background: barColor, height: "100%", borderRadius: "8px",
            width: `${Math.max(0, Math.min(100, budgetPct))}%`,
            transition: "width 0.5s"
          }} />
        </div>
        <div style={{ display: "flex", gap: "24px", marginTop: "12px", fontSize: "14px" }}>
          <span>Captured: <strong>{b.capturedFormatted}</strong></span>
          <span>Reserved: <strong>{b.reservedFormatted}</strong></span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <StatCard title="Blocked Spending" value={data.savings.blockedTotalFormatted} subtitle={`${data.savings.blockedCount} attempts blocked`} color="#dc3545" />
        <StatCard title="Savings from Best Deals" value={data.savings.savingsTotalFormatted} subtitle={`${data.savings.savingsCount} times`} color="#28a745" />
        <StatCard title="Total Captured" value={b.capturedFormatted} subtitle="This month" color="#003087" />
        <StatCard title="Pending" value={b.reservedFormatted} subtitle="Awaiting approval" color="#ff9800" />
      </div>

      {/* Spend by Merchant & Category */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #ddd" }}>
          <h3 style={{ marginTop: 0 }}>🏪 By Merchant</h3>
          {data.spend.byMerchant.length === 0 ? (
            <p style={{ color: "#999" }}>No purchases yet</p>
          ) : data.spend.byMerchant.map((m: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
              <span>{m.merchant}</span>
              <span><strong>{m.totalFormatted}</strong> ({m.count})</span>
            </div>
          ))}
        </div>
        <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #ddd" }}>
          <h3 style={{ marginTop: 0 }}>📁 By Category</h3>
          {data.spend.byCategory.length === 0 ? (
            <p style={{ color: "#999" }}>No purchases yet</p>
          ) : data.spend.byCategory.map((c: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee" }}>
              <span>{c.category}</span>
              <span><strong>{c.totalFormatted}</strong> ({c.count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Distribution */}
      <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
        <h3 style={{ marginTop: 0 }}>📊 Decisions</h3>
        <div style={{ display: "flex", gap: "24px" }}>
          {data.spend.byDecision.map((d: any, i: number) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: d.decision === "DENY" ? "#dc3545" : d.decision === "ALLOW" ? "#28a745" : "#ff9800" }}>
                {d.count}
              </div>
              <div style={{ fontSize: "13px", color: "#666" }}>{d.decision}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase History */}
      <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #ddd" }}>
        <h3 style={{ marginTop: 0 }}>🛒 Purchase History</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "8px" }}>Item</th>
              <th style={{ padding: "8px" }}>Amount</th>
              <th style={{ padding: "8px" }}>Merchant</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}>Decision</th>
              <th style={{ padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#999" }}>No purchases yet</td></tr>
            ) : purchases.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px" }}>{p.title}</td>
                <td style={{ padding: "8px" }}>${(p.amount_cents / 100).toFixed(2)}</td>
                <td style={{ padding: "8px" }}>{p.offer_domain}</td>
                <td style={{ padding: "8px" }}>
                  <StatusBadge status={p.status} />
                </td>
                <td style={{ padding: "8px" }}>
                  <DecisionBadge decision={p.policy_decision} />
                </td>
                <td style={{ padding: "8px" }}>
                  {p.status === "PAID" && (
                    <button onClick={() => refund(p.id)} style={{ padding: "4px 12px", borderRadius: "4px", background: "#dc3545", color: "white", border: "none", cursor: "pointer", fontSize: "12px" }}>
                      Refund
                    </button>
                  )}
                  <a href={`/r/${p.id}`} style={{ marginLeft: "8px", fontSize: "12px" }}>Receipt</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: string }) {
  return (
    <div style={{ background: "white", padding: "16px", borderRadius: "8px", border: "1px solid #ddd", borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>{title}</div>
      <div style={{ fontSize: "24px", fontWeight: "bold", color }}>{value}</div>
      <div style={{ fontSize: "12px", color: "#999" }}>{subtitle}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PAID: "#28a745", PENDING_APPROVAL: "#ff9800", DENIED: "#dc3545",
    CANCELLED: "#6c757d", EXPIRED: "#6c757d", REFUNDED: "#17a2b8", FAILED: "#dc3545"
  };
  return <span style={{ background: colors[status] || "#999", color: "white", padding: "2px 8px", borderRadius: "10px", fontSize: "11px" }}>{status}</span>;
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors: Record<string, string> = {
    ALLOW: "#28a745", REQUIRE_APPROVAL: "#ff9800", DENY: "#dc3545"
  };
  return <span style={{ background: colors[decision] || "#999", color: "white", padding: "2px 8px", borderRadius: "10px", fontSize: "11px" }}>{decision}</span>;
}
