"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Icon, { type IconName } from "@/components/icons";

type ToolResult = { tool: string; result: any };

type Message = {
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
};

type Notice = { tone: "success" | "error" | "info"; text: string };

const SUGGESTIONS: { label: string; text: string; icon: IconName }[] = [
  { label: "Find headphones", text: "find headphones", icon: "bag" },
  { label: "I want to buy a laptop", text: "i want to buy a laptop", icon: "search" },
  { label: "Show keyboards under 10000 rs", text: "show keyboards under 10000 rs", icon: "trend" },
  { label: "Show my budget", text: "show my budget", icon: "wallet" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      setNotice({
        tone: "success",
        text: `Payment captured. Purchase ID: ${params.get("purchaseId") ?? "confirmed"}`,
      });
    } else if (params.get("error")) {
      setNotice({ tone: "error", text: params.get("error") as string });
    } else if (params.get("cancelled")) {
      setNotice({ tone: "info", text: "Payment was cancelled." });
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || loading) return;

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || data.error || "No response",
            toolResults: data.toolResults,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${(err as Error).message}` },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, loading, messages]
  );

  function draft(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-3xl flex-col gap-4 sm:h-[calc(100dvh-8rem)]">
      <header className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Shopping agent</h1>
          <p className="mt-1 text-sm text-muted">The AI proposes, the policy decides, you confirm.</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="shrink-0 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-line-strong hover:text-foreground"
          >
            Clear chat
          </button>
        )}
      </header>

      {notice && (
        <div
          className={`flex shrink-0 items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-cta-border bg-cta-soft text-emerald-800"
              : notice.tone === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span className="flex items-start gap-2">
            <Icon
              name={notice.tone === "success" ? "check" : notice.tone === "error" ? "alert" : "clock"}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            {notice.text}
          </span>
          <button
            aria-label="Dismiss notification"
            onClick={() => {
              setNotice(null);
              window.history.replaceState({}, "", "/");
            }}
            className="rounded-md p-0.5 text-muted transition-colors hover:text-foreground"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="scroll-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6">
        {messages.length === 0 && !loading && (
          <div className="m-auto w-full max-w-md text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary ring-1 ring-primary/10">
              <Icon name="sparkles" className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-foreground">How can I help you shop?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Tell me what you need. I&apos;ll search, compare offers and check your policy before
              anything is charged.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.text)}
                  className="group flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-xs font-medium text-muted-600 transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary-soft/60 hover:text-foreground hover:shadow-sm"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-canvas text-muted-500 transition-colors group-hover:bg-surface group-hover:text-primary">
                    <Icon name={s.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-up flex flex-col gap-2.5 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="flex w-full items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary ring-1 ring-primary/10">
                  <Icon name="sparkles" className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 max-w-[92%] rounded-2xl rounded-tl-md bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-foreground">
                  <RichText text={msg.content} />
                </div>
              </div>
            )}

            {msg.toolResults?.map((tr, j) => (
              <div
                key={j}
                className={`w-full min-w-0 ${msg.role === "assistant" ? "max-w-[calc(100%-2.375rem)] sm:ml-[2.375rem]" : ""}`}
              >
                <ToolCard data={tr.result} onAction={draft} />
              </div>
            ))}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary ring-1 ring-primary/10">
              <Icon name="sparkles" className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 text-sm text-muted">
              <span className="flex gap-1">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
              Thinking
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </section>

      <div className="shrink-0 rounded-2xl border border-line bg-surface p-2 shadow-sm transition-shadow focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Ask me to find, compare, or buy products…"
          className="max-h-40 w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-400"
          disabled={loading}
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1">
          <p className="hidden text-xs text-muted-400 sm:block">
            <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted-500">
              Enter
            </kbd>{" "}
            to send ·{" "}
            <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted-500">
              Shift + Enter
            </kbd>{" "}
            for a new line
          </p>
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            Send
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-400"
      style={{ animationDelay: delay }}
    />
  );
}

/** Minimal markdown: **bold**, `code`, • bullets, and line breaks. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const bullet = /^\s*(?:•|-|\*)\s+/.test(line);
        const clean = bullet ? line.replace(/^\s*(?:•|-|\*)\s+/, "") : line;
        return (
          <p key={i} className={bullet ? "flex gap-2" : undefined}>
            {bullet && (
              <span className="mt-1.5 h-1 w-1 shrink-0 select-none rounded-full bg-muted-400" />
            )}
            <span className="whitespace-pre-wrap">{inline(clean)}</span>
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-600"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function decisionStyles(decision: string): { chip: string; border: string; label: string; icon: IconName } {
  if (decision === "ALLOW")
    return {
      chip: "bg-cta-soft text-emerald-700 border border-cta-border",
      border: "border-line",
      label: "Allowed",
      icon: "check",
    };
  if (decision === "REQUIRE_APPROVAL")
    return {
      chip: "bg-amber-50 text-amber-700 border border-amber-200",
      border: "border-line",
      label: "Needs approval",
      icon: "clock",
    };
  return {
    chip: "bg-red-50 text-red-700 border border-red-200",
    border: "border-line",
    label: "Denied",
    icon: "close",
  };
}

function CardLabel({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
      <Icon name={icon} className="h-3.5 w-3.5 text-muted-400" />
      {children}
    </p>
  );
}

function DecisionChip({ decision }: { decision: string }) {
  const s = decisionStyles(decision);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.chip}`}
    >
      <Icon name={s.icon} className="h-3 w-3" strokeWidth={2.2} />
      {s.label}
    </span>
  );
}

function ToolCard({ data, onAction }: { data: any; onAction: (text: string) => void }) {
  if (!data) return null;

  if (data.type === "search_results") {
    return <SearchResultsCard data={data} onAction={onAction} />;
  }

  if (data.type === "offer_comparison") {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <CardLabel icon="trend">Offer comparison</CardLabel>
          <p className="mt-1 text-sm font-semibold text-foreground">{data.productTitle}</p>
        </div>
        <ul className="divide-y divide-line">
          {(data.offers ?? []).map((o: any) => (
            <li
              key={o.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-xs ${
                o.isBestDeal ? "bg-cta-soft/60" : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                {o.merchant}
                {o.isBestDeal && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-cta px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-white">
                    Best deal
                  </span>
                )}
              </span>
              <span className="tabular-nums font-semibold text-foreground">{o.price}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  o.inStock ? "bg-cta-soft text-emerald-700" : "bg-slate-100 text-muted"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${o.inStock ? "bg-cta" : "bg-muted-300"}`}
                />
                {o.inStock ? "In stock" : "Out of stock"}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => onAction(`check policy for ${data.productId ?? ""} ${o.id}`.trim())}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 font-semibold text-muted-600 transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                >
                  Policy
                </button>
                <button
                  onClick={() => onAction(`buy ${data.productId ?? ""} ${o.id}`.trim())}
                  disabled={!o.inStock}
                  className="rounded-lg bg-cta px-2.5 py-1 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted-400"
                >
                  Buy now
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (data.type === "policy_check") {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <CardLabel icon="shield">Policy check</CardLabel>
          <DecisionChip decision={data.decision} />
        </div>
        <div className="px-4 py-3">
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <Stat label="Product" value={data.product} />
            <Stat label="Merchant" value={data.merchant} />
            <Stat label="Price" value={data.price} />
          </dl>
          {typeof data.riskScore === "number" && <RiskBar score={data.riskScore} />}
          {data.reasons?.length > 0 && (
            <div className="mt-3 flex gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted-600">
              <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>{data.reasons.join("; ")}</span>
            </div>
          )}
          {data.trace?.length > 0 && (
            <details className="group mt-3 text-xs">
              <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-muted-600 transition-colors hover:text-foreground">
                Decision trace
                <span className="font-normal text-muted-400">({data.trace.length} rules)</span>
              </summary>
              <ul className="mt-2 space-y-1">
                {data.trace.map((t: any, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Icon
                      name={t.passed ? "check" : "close"}
                      strokeWidth={2.4}
                      className={`mt-0.5 h-3 w-3 shrink-0 ${t.passed ? "text-cta" : "text-red-500"}`}
                    />
                    <span className={t.passed ? "text-muted-600" : "text-red-600"}>
                      {t.rule}
                      {t.detail ? <span className="text-muted-400"> — {t.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    );
  }

  if (data.type === "purchase_requested") {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <CardLabel icon="bag">Purchase request</CardLabel>
          <DecisionChip decision={data.decision} />
        </div>
        <div className="px-4 py-3">
          {data.purchaseRequestId && (
            <p className="font-mono text-[11px] text-muted-400">{data.purchaseRequestId}</p>
          )}
          {typeof data.riskScore === "number" && <RiskBar score={data.riskScore} />}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.approvalUrl && (
              <a
                href={data.approvalUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-xl bg-cta px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
              >
                <Icon name="lock" className="h-3.5 w-3.5" />
                Pay with PayPal
              </a>
            )}
            {data.guardianApprovalUrl && (
              <a
                href={data.guardianApprovalUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted-600 transition-colors hover:border-line-strong hover:text-foreground"
              >
                Guardian approval
                <Icon name="arrowRight" className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (data.type === "purchase_denied") {
    return (
      <div className="overflow-hidden rounded-2xl border border-red-200 bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50/60 px-4 py-3">
          <CardLabel icon="shield">Purchase denied</CardLabel>
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-surface px-2.5 py-1 text-[11px] font-semibold text-red-700">
            <Icon name="close" className="h-3 w-3" strokeWidth={2.4} />
            Blocked
          </span>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-600">{data.reasons?.join("; ")}</p>
          {typeof data.riskScore === "number" && <RiskBar score={data.riskScore} />}
          <button
            onClick={() => onAction("show my budget")}
            className="mt-3 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted-600 transition-colors hover:border-line-strong hover:text-foreground"
          >
            Review budget
          </button>
        </div>
      </div>
    );
  }

  if (data.type === "budget_status") {
    const pct = Math.max(0, Math.min(100, data.remainingPct ?? 0));
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <CardLabel icon="wallet">Budget status</CardLabel>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Stat label="Monthly" value={data.monthlyBudget} />
            <Stat label="Captured" value={data.captured} />
            <Stat label="Reserved" value={data.reserved} />
            <Stat label="Remaining" value={data.remaining} />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${pct > 50 ? "bg-primary" : pct > 20 ? "bg-amber-400" : "bg-red-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-400">
            <span>{pct}% left</span>
            <span>Per-purchase cap: {data.perPurchaseCap}</span>
            <span>Approval over: {data.approvalThreshold}</span>
            <span className="inline-flex items-center gap-1">
              <Icon
                name={data.frozen ? "lock" : "shieldCheck"}
                className={`h-3 w-3 ${data.frozen ? "text-red-500" : "text-cta"}`}
              />
              {data.frozen ? "Wallet frozen" : "Wallet active"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (data.type === "price_history") {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <CardLabel icon="chart">Price history</CardLabel>
        </div>
        <div className="grid grid-cols-3 gap-3 px-4 py-3 text-xs">
          <Stat label="Average" value={data.average} />
          <Stat label="Lowest" value={data.min} />
          <Stat label="Highest" value={data.max} />
        </div>
      </div>
    );
  }

  if (data.type === "error") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {data.message}
      </div>
    );
  }

  return null;
}

function parsePrice(value: unknown) {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function money(amount: number) {
  // Convert USD cents to INR (1 USD = 83 INR)
  const inr = Math.round((amount / 100) * 83);
  return `₹${inr.toLocaleString("en-IN")}`;
}

function initials(title: string) {
  return title
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function ProductThumb({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-xl border border-line bg-canvas">
        <span className="font-display text-lg font-bold text-muted-400">{initials(title)}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[72px] w-[72px] shrink-0 rounded-xl border border-line bg-white object-cover"
    />
  );
}

/** Search results with client-side narrowing by price, merchant and availability. */
function SearchResultsCard({
  data,
  onAction,
}: {
  data: any;
  onAction: (text: string) => void;
}) {
  const products: any[] = data.products ?? [];
  const allOffers: any[] = products.flatMap((p) => p.offers ?? []);

  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const merchants: string[] = Array.from(
    new Set(allOffers.map((o) => o.merchant).filter(Boolean) as string[])
  ).sort();

  const filtersActive =
    minPrice.trim() !== "" || maxPrice.trim() !== "" || selectedMerchants.length > 0 || inStockOnly;

  function resetFilters() {
    setMinPrice("");
    setMaxPrice("");
    setSelectedMerchants([]);
    setInStockOnly(false);
  }

  function toggleMerchant(name: string) {
    setSelectedMerchants((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  }

  const min = minPrice.trim() === "" ? null : Number(minPrice);
  const max = maxPrice.trim() === "" ? null : Number(maxPrice);

  const visible = products
    .map((product) => ({
      ...product,
      totalOffers: ((product.offers ?? []) as any[]).length,
      offers: ((product.offers ?? []) as any[]).filter((offer) => {
        const price = parsePrice(offer.price);
        if (Number.isFinite(price)) {
          if (min !== null && Number.isFinite(min) && price < min) return false;
          if (max !== null && Number.isFinite(max) && price > max) return false;
        }
        if (selectedMerchants.length > 0 && !selectedMerchants.includes(offer.merchant)) return false;
        if (inStockOnly && !offer.inStock) return false;
        return true;
      }),
    }))
    .filter((product) => product.offers.length > 0);

  const visibleOffers = visible.reduce((n, p) => n + p.offers.length, 0);

  // Nothing to narrow down: the text reply already explains the empty search.
  if (products.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="border-b border-line bg-canvas/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Icon name="filter" className="h-3.5 w-3.5 text-muted-400" />
            {visible.length} of {products.length} product{products.length === 1 ? "" : "s"} ·{" "}
            {visibleOffers} offer{visibleOffers === 1 ? "" : "s"}
          </p>
          {filtersActive && (
            <button
              onClick={resetFilters}
              className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-600">
            <span className="uppercase tracking-wide">Min $</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="0"
              className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-600">
            <span className="uppercase tracking-wide">Max $</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Any"
              className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <button
            onClick={() => setInStockOnly((v) => !v)}
            aria-pressed={inStockOnly}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors ${
              inStockOnly
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-line bg-surface text-muted-600 hover:border-line-strong hover:text-foreground"
            }`}
          >
            <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
            In stock only
          </button>
        </div>

        {merchants.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11px] uppercase tracking-wide text-muted-400">Merchant</span>
            {merchants.map((merchant) => {
              const active = selectedMerchants.includes(merchant);
              return (
                <button
                  key={merchant}
                  onClick={() => toggleMerchant(merchant)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-line bg-surface text-muted-600 hover:border-line-strong hover:text-foreground"
                  }`}
                >
                  {merchant}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm text-muted">No products match these filters.</p>
            <button
              onClick={resetFilters}
              className="mt-2 text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}

        {visible.map((product) => {
          const prices = product.offers
            .map((o: any) => parsePrice(o.price))
            .filter(Number.isFinite);
          const best = prices.length > 0 ? Math.min(...prices) : NaN;
          const worst = prices.length > 0 ? Math.max(...prices) : NaN;
          const saving = Number.isFinite(best) && Number.isFinite(worst) ? worst - best : 0;
          const stockCount = product.offers.filter((o: any) => o.inStock).length;
          const bestOfferId = product.offers.find(
            (o: any) => o.inStock && parsePrice(o.price) === best
          )?.id;
          const hiddenOffers = product.totalOffers - product.offers.length;

          return (
            <article
              key={product.id}
              className="rounded-xl border border-line bg-surface p-3 transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start gap-3">
                <ProductThumb src={product.imageUrl} title={product.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-400">
                        {product.brand ?? product.category ?? "Product"}
                      </p>
                      <h4 className="mt-0.5 text-sm font-bold leading-snug text-foreground">
                        {product.title}
                      </h4>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-300">{product.id}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold tracking-tight text-foreground">
                        {Number.isFinite(best) ? money(best) : product.bestPrice}
                      </p>
                      <p className="text-[10px] font-medium text-muted-400">best price</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {saving >= 0.5 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-cta-soft px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-cta-border">
                        <Icon name="tag" className="h-2.5 w-2.5" strokeWidth={2.2} />
                        Save {money(saving)}
                      </span>
                    )}
                    <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {product.offers.length} offer{product.offers.length === 1 ? "" : "s"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        stockCount > 0
                          ? "bg-cta-soft text-emerald-700"
                          : "bg-slate-100 text-muted"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          stockCount > 0 ? "bg-cta" : "bg-muted-300"
                        }`}
                      />
                      {stockCount > 0 ? `${stockCount} in stock` : "Out of stock"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {product.offers.map((offer: any) => {
                  const isBest = offer.id === bestOfferId;
                  return (
                    <div
                      key={offer.id}
                      className={`grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5 rounded-lg border px-2.5 py-2 text-xs sm:grid-cols-[1fr_auto_auto_auto] ${
                        isBest
                          ? "border-cta-border bg-cta-soft/50"
                          : "border-transparent bg-canvas"
                      }`}
                    >
                      <span className="min-w-0 truncate font-semibold text-foreground">
                        {offer.merchant}
                        {isBest && (
                          <span className="ml-1.5 rounded bg-cta px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Best
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right font-semibold tabular-nums text-foreground">
                        {offer.price}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-muted sm:justify-self-center">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            offer.inStock ? "bg-cta" : "bg-muted-300"
                          }`}
                        />
                        {offer.inStock ? "In stock" : "Out of stock"}
                      </span>
                      <div className="flex items-center gap-1.5 justify-self-end">
                        <button
                          onClick={() => onAction(`check policy for ${product.id} ${offer.id}`)}
                          className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-muted-600 transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                        >
                          Policy
                        </button>
                        <button
                          onClick={() => onAction(`buy ${product.id} ${offer.id}`)}
                          disabled={!offer.inStock}
                          className="rounded-md bg-cta px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted-400"
                        >
                          Buy now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onAction(`compare offers for ${product.id}`)}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-muted-600 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Compare offers
                  <Icon name="arrowRight" className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onAction(`price history for ${product.id}`)}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-muted-600 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Icon name="chart" className="h-3 w-3" />
                  Price history
                </button>
                {hiddenOffers > 0 && (
                  <span className="text-[10px] text-muted-400">
                    {hiddenOffers} offer{hiddenOffers === 1 ? "" : "s"} hidden by filters
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-400">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function RiskBar({ score }: { score: number }) {
  const tone = score >= 60 ? "bg-red-500" : score >= 30 ? "bg-amber-400" : "bg-cta";
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-muted-400">
        <span className="font-medium">Risk score</span>
        <span className="font-semibold text-muted-600">{score}/100</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}
