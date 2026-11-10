"use client";
import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

function GuardianApproveContent() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string>("");

  useEffect(() => {
    if (token) {
      const approvalUrl = `${window.location.origin}/approve/${token}`;
      fetch(`/api/approve?token=${token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) {
            setError(d.error);
          } else {
            setData(d);
            // Generate QR code
            QRCode.toDataURL(approvalUrl, { width: 200 }).then(setQrCode);
          }
        })
        .catch(e => setError(e.message));
    }
  }, [token]);

  async function handleAction(action: string) {
    setProcessing(true);
    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action }),
    });
    const r = await res.json();
    setResult(r);
    setProcessing(false);

    if (r.approvalUrl) {
      window.location.href = r.approvalUrl;
    }
  }

  if (error) {
    return (
      <div style={{ maxWidth: "500px", margin: "60px auto", textAlign: "center", padding: "40px", background: "white", borderRadius: "12px", border: "1px solid #ddd" }}>
        <h2>❌ {error}</h2>
        <p style={{ color: "#666" }}>This approval link may have expired or already been used.</p>
      </div>
    );
  }

  if (result?.action === "declined") {
    return (
      <div style={{ maxWidth: "500px", margin: "60px auto", textAlign: "center", padding: "40px", background: "white", borderRadius: "12px", border: "1px solid #ddd" }}>
        <h2>✋ Purchase Declined</h2>
        <p style={{ color: "#666" }}>You have declined this purchase request.</p>
      </div>
    );
  }

  if (!data) return <p style={{ textAlign: "center", marginTop: "60px" }}>Loading...</p>;

  const trace = data.policy_trace || [];
  const approvalUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/approve/${token}`;

  return (
    <div style={{ maxWidth: "500px", margin: "40px auto" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px" }}>🔒 Approval Required</h1>
        <p style={{ color: "#666" }}>An AI agent is requesting to make this purchase</p>
        
        {/* QR Code for mobile scanning */}
        {qrCode && (
          <div style={{ marginTop: "16px", padding: "16px", background: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>Scan to approve on your phone:</p>
            <img src={qrCode} alt="QR Code" style={{ width: "150px", height: "150px" }} />
          </div>
        )}
      </div>

      <div style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid #ddd", marginBottom: "20px" }}>
        <h2 style={{ marginTop: 0, fontSize: "20px" }}>{data.title}</h2>

        <div style={{ fontSize: "36px", fontWeight: "bold", color: "#003087", margin: "16px 0" }}>
          ${(data.amount_cents / 100).toFixed(2)}
        </div>

        <div style={{ fontSize: "15px", lineHeight: "2" }}>
          <div><strong>Merchant:</strong> {data.merchant}</div>
          <div><strong>Category:</strong> {data.category}</div>
          <div><strong>Risk Score:</strong> {data.risk_score}/100</div>
        </div>

        {/* Why approval is needed */}
        <div style={{ marginTop: "16px", padding: "12px", background: "#fff3cd", borderRadius: "6px", fontSize: "14px" }}>
          <strong>⚠️ Why approval is needed:</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
            {trace.filter((t: any) => !t.passed).map((t: any, i: number) => (
              <li key={i}>{t.detail}</li>
            ))}
          </ul>
        </div>

        {/* Decision Trace */}
        <details style={{ marginTop: "12px", fontSize: "13px" }}>
          <summary style={{ cursor: "pointer", color: "#666" }}>View full decision trace ({trace.length} rules)</summary>
          <ul style={{ margin: "8px 0", paddingLeft: "16px" }}>
            {trace.map((t: any, i: number) => (
              <li key={i} style={{ color: t.passed ? "#28a745" : "#dc3545", padding: "2px 0" }}>
                {t.passed ? "✓" : "✗"} {t.rule}: {t.detail}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button onClick={() => handleAction("approve")} disabled={processing}
          style={{
            flex: 1, padding: "16px", borderRadius: "8px", border: "none",
            background: "#0070ba", color: "white", fontSize: "18px", fontWeight: "bold",
            cursor: processing ? "not-allowed" : "pointer"
          }}>
          {processing ? "Processing..." : "✅ Approve with PayPal"}
        </button>
        <button onClick={() => handleAction("decline")} disabled={processing}
          style={{
            padding: "16px 24px", borderRadius: "8px", border: "1px solid #dc3545",
            background: "white", color: "#dc3545", fontSize: "16px", fontWeight: "bold",
            cursor: processing ? "not-allowed" : "pointer"
          }}>
          ✋ Decline
        </button>
      </div>
    </div>
  );
}


export default function GuardianApprovePage() {
  return (
    <Suspense fallback={<p style={{ textAlign: "center", marginTop: "60px" }}>Loading approval page...</p>}>
      <GuardianApproveContent />
    </Suspense>
  );
}
