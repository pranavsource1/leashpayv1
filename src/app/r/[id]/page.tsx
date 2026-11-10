"use client";
import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";

function ReceiptContent() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      fetch(`/api/receipt?id=${id}`)
        .then(r => r.json())
        .then(d => { if (d.error) setError(d.error); else setData(d); })
        .catch(e => setError(e.message));
    }
  }, [id]);

  if (error) return <div style={{ padding: "40px", textAlign: "center" }}><h2>❌ {error}</h2></div>;
  if (!data) return <p>Loading receipt...</p>;

  const r = data.receipt;
  const m = data.mandate;

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <h1>🧾 Purchase Receipt</h1>

      <div style={{ background: "white", padding: "24px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{r.title}</h2>
          <span style={{
            background: r.status === "PAID" ? "#28a745" : r.status === "DENIED" ? "#dc3545" : "#ff9800",
            color: "white", padding: "4px 12px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold"
          }}>{r.status}</span>
        </div>

        <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px" }}>
          <div><strong>Amount:</strong> {r.amount}</div>
          <div><strong>Currency:</strong> {r.currency}</div>
          <div><strong>Merchant:</strong> {r.merchant}</div>
          <div><strong>Category:</strong> {r.category}</div>
          <div><strong>Decision:</strong> {r.decision}</div>
          <div><strong>Risk Score:</strong> {r.riskScore}/100</div>
          <div><strong>PayPal Order:</strong> <code style={{ fontSize: "12px" }}>{r.paypalOrderId || "N/A"}</code></div>
          <div><strong>PayPal Capture:</strong> <code style={{ fontSize: "12px" }}>{r.paypalCaptureId || "N/A"}</code></div>
          <div><strong>Created:</strong> {new Date(r.createdAt).toLocaleString()}</div>
          <div><strong>Cart Hash:</strong> <code style={{ fontSize: "11px" }}>{r.cartHash?.substring(0, 24)}…</code></div>
        </div>
      </div>

      {/* Mandate */}
      {m && (
        <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0 }}>🔏 Cart Mandate</h3>
          <div style={{ fontSize: "13px" }}>
            <div><strong>Mandate ID:</strong> {m.id}</div>
            <div><strong>Kind:</strong> {m.kind}</div>
            <div><strong>Body Hash:</strong> <code>{m.bodyHash}</code></div>
            <div><strong>Policy Version:</strong> {m.policyVersion}</div>
            <div><strong>Signature:</strong> <code style={{ fontSize: "11px" }}>{m.signature}</code></div>
            <div><strong>Signed At:</strong> {new Date(m.createdAt).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Policy Trace */}
      {r.policyTrace?.length > 0 && (
        <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "20px" }}>
          <h3 style={{ marginTop: 0 }}>🔍 Decision Trace</h3>
          {r.policyTrace.map((t: any, i: number) => (
            <div key={i} style={{ padding: "4px 0", fontSize: "13px", color: t.passed ? "#28a745" : "#dc3545" }}>
              {t.passed ? "✓" : "✗"} <strong>{t.rule}</strong>: {t.detail}
            </div>
          ))}
        </div>
      )}

      {/* Audit Trail */}
      <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #ddd" }}>
        <h3 style={{ marginTop: 0 }}>📋 Audit Trail</h3>
        {data.auditTrail?.map((a: any, i: number) => (
          <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: "13px" }}>
            <span style={{ color: "#999", marginRight: "8px" }}>{new Date(a.ts).toLocaleTimeString()}</span>
            <span style={{ fontWeight: "bold", marginRight: "8px" }}>[{a.actor}]</span>
            <span style={{ marginRight: "8px" }}>{a.event}</span>
            <span style={{ color: "#666" }}>{a.summary}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function ReceiptPage() {
  return (
    <Suspense fallback={<p style={{ textAlign: "center", marginTop: "60px" }}>Loading receipt...</p>}>
      <ReceiptContent />
    </Suspense>
  );
}
