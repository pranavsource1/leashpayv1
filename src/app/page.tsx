"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolResults?: any[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Check URL params for success/error notifications
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      setNotification(`✅ Payment captured! Purchase ID: ${params.get("purchaseId")}`);
    } else if (params.get("error")) {
      setNotification(`❌ Error: ${params.get("error")}`);
    } else if (params.get("cancelled")) {
      setNotification("⚠️ Payment was cancelled");
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history: messages }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply || data.error || "No response",
        toolResults: data.toolResults,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 style={{ marginBottom: "8px" }}>🛒 Shopping Agent Chat</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        The AI proposes, the policy decides, you confirm.
      </p>

      {notification && (
        <div style={{
          padding: "12px 16px", borderRadius: "8px", marginBottom: "16px",
          background: notification.startsWith("✅") ? "#d4edda" : notification.startsWith("❌") ? "#f8d7da" : "#fff3cd",
          border: `1px solid ${notification.startsWith("✅") ? "#c3e6cb" : notification.startsWith("❌") ? "#f5c6cb" : "#ffc107"}`,
        }}>
          {notification}
          <button onClick={() => { setNotification(null); window.history.replaceState({}, "", "/"); }}
            style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      <div style={{
        background: "white", borderRadius: "12px", border: "1px solid #ddd",
        height: "500px", overflowY: "auto", padding: "16px", marginBottom: "16px"
      }}>
        {messages.length === 0 && (
          <div style={{ color: "#999", textAlign: "center", marginTop: "100px" }}>
            <p style={{ fontSize: "20px" }}>👋 Hi! I&apos;m your shopping assistant.</p>
            <p>Try: &quot;Find me a 27-inch 4K monitor under $350&quot;</p>
            <p style={{ fontSize: "13px" }}>
              Or: &quot;search headphones&quot; · &quot;compare offers for prod-mon-001&quot; · &quot;check policy for prod-mon-001 off-001a&quot; · &quot;buy prod-mon-001 off-001a&quot; · &quot;show my budget&quot;
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: "16px",
            textAlign: msg.role === "user" ? "right" : "left"
          }}>
            <div style={{
              display: "inline-block", maxWidth: "80%", padding: "10px 16px",
              borderRadius: "12px", textAlign: "left",
              background: msg.role === "user" ? "#003087" : "#f0f2f5",
              color: msg.role === "user" ? "white" : "#333",
              whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: "1.5"
            }}>
              {msg.content}
            </div>

            {/* Render tool result cards */}
            {msg.toolResults?.map((tr, j) => (
              <div key={j} style={{ marginTop: "8px" }}>
                {renderToolCard(tr)}
              </div>
            ))}
          </div>
        ))}
        {loading && (
          <div style={{ color: "#999", padding: "8px" }}>⏳ Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="Ask me to find, compare, or buy products..."
          style={{
            flex: 1, padding: "12px 16px", borderRadius: "8px",
            border: "1px solid #ddd", fontSize: "14px", outline: "none"
          }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: "12px 24px", borderRadius: "8px", border: "none",
            background: "#003087", color: "white", fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function renderToolCard(tr: { tool: string; result: any }) {
  const r = tr.result;
  if (!r) return null;

  // Purchase result cards
  if (r.type === "purchase_denied") {
    return (
      <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: "8px", padding: "12px", maxWidth: "500px" }}>
        <strong>❌ Purchase Denied</strong>
        <p style={{ margin: "4px 0", fontSize: "13px" }}>{r.reasons?.join("; ")}</p>
        <p style={{ margin: "4px 0", fontSize: "12px", color: "#666" }}>Risk Score: {r.riskScore}/100</p>
      </div>
    );
  }

  if (r.type === "purchase_requested" && r.approvalUrl) {
    return (
      <div style={{
        background: r.decision === "ALLOW" ? "#dfd" : "#ffd",
        border: `1px solid ${r.decision === "ALLOW" ? "#beb" : "#eec"}`,
        borderRadius: "8px", padding: "12px", maxWidth: "500px"
      }}>
        <strong>{r.decision === "ALLOW" ? "✅" : "⚠️"} Purchase {r.decision}</strong>
        <p style={{ margin: "4px 0", fontSize: "13px" }}>{r.reasons?.join("; ")}</p>
        <a href={r.approvalUrl} target="_blank" rel="noopener"
          style={{
            display: "inline-block", marginTop: "8px", padding: "8px 20px",
            background: "#0070ba", color: "white", borderRadius: "20px",
            textDecoration: "none", fontSize: "13px", fontWeight: "bold"
          }}>
          Pay with PayPal
        </a>
        {r.guardianApprovalUrl && (
          <p style={{ margin: "8px 0 0", fontSize: "12px" }}>
            Guardian: <a href={r.guardianApprovalUrl} target="_blank" rel="noopener">{r.guardianApprovalUrl}</a>
          </p>
        )}
      </div>
    );
  }

  if (r.type === "policy_check") {
    const color = r.decision === "ALLOW" ? "#dfd" : r.decision === "DENY" ? "#fee" : "#ffd";
    return (
      <div style={{ background: color, borderRadius: "8px", padding: "12px", maxWidth: "500px", border: "1px solid #ddd" }}>
        <strong>{r.decision === "ALLOW" ? "✅" : r.decision === "DENY" ? "❌" : "⚠️"} Policy: {r.decision}</strong>
        <p style={{ margin: "4px 0", fontSize: "13px" }}>{r.product} — {r.price} from {r.merchant}</p>
        <details style={{ fontSize: "12px", marginTop: "8px" }}>
          <summary style={{ cursor: "pointer" }}>Decision Trace ({r.trace?.length} rules)</summary>
          <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
            {r.trace?.map((t: any, i: number) => (
              <li key={i} style={{ color: t.passed ? "#080" : "#c00" }}>
                {t.passed ? "✓" : "✗"} {t.rule}: {t.detail}
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }

  return null;
}
