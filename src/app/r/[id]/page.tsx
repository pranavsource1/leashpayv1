"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import Icon from "@/components/icons";

function ReceiptContent() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      fetch(`/api/receipt?id=${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) setError(d.error);
          else setData(d);
        })
        .catch((e) => setError(e.message));
    }
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-red-200 bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600">
          <Icon name="alert" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-foreground">{error}</h1>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 pt-16 text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
        Loading receipt…
      </div>
    );
  }

  const r = data.receipt;
  const m = data.mandate;
  const statusClass =
    r.status === "PAID"
      ? "bg-cta-soft text-emerald-700 border-cta-border"
      : r.status === "DENIED"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="mx-auto max-w-2xl pb-4">
      <div className="mb-5 flex items-center gap-2">
        <Icon name="receipt" className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Purchase receipt</h1>
      </div>

      <section className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{r.title}</h2>
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusClass}`}
          >
            {r.status}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Amount" value={r.amount} />
          <Field label="Currency" value={r.currency} />
          <Field label="Merchant" value={r.merchant} />
          <Field label="Category" value={r.category} />
          <Field label="Decision" value={r.decision} />
          <Field label="Risk score" value={`${r.riskScore}/100`} />
          <Field label="PayPal order" value={r.paypalOrderId || "N/A"} mono />
          <Field label="PayPal capture" value={r.paypalCaptureId || "N/A"} mono />
          <Field label="Created" value={new Date(r.createdAt).toLocaleString()} />
          <Field label="Cart hash" value={`${r.cartHash?.substring(0, 24) ?? ""}…`} mono />
        </dl>
      </section>

      {m && (
        <section className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon name="lock" className="h-4 w-4 text-muted-400" />
            Cart mandate
          </h3>
          <dl className="space-y-2 text-xs">
            <Field label="Mandate ID" value={m.id} mono />
            <Field label="Kind" value={m.kind} />
            <Field label="Body hash" value={m.bodyHash} mono />
            <Field label="Policy version" value={String(m.policyVersion)} />
            <Field label="Signature" value={m.signature} mono />
            <Field label="Signed at" value={new Date(m.createdAt).toLocaleString()} />
          </dl>
        </section>
      )}

      {r.policyTrace?.length > 0 && (
        <section className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon name="shield" className="h-4 w-4 text-muted-400" />
            Decision trace
          </h3>
          <ul className="space-y-1.5 text-xs">
            {r.policyTrace.map((t: any, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <Icon
                  name={t.passed ? "check" : "close"}
                  strokeWidth={2.4}
                  className={`mt-0.5 h-3 w-3 shrink-0 ${t.passed ? "text-cta" : "text-red-500"}`}
                />
                <span className={t.passed ? "text-muted-600" : "text-red-600"}>
                  <span className="font-semibold">{t.rule}</span>: {t.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon name="list" className="h-4 w-4 text-muted-400" />
          Audit trail
        </h3>
        <ul className="divide-y divide-line text-xs">
          {data.auditTrail?.map((a: any, i: number) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2">
              <span className="tabular-nums text-muted-400">
                {new Date(a.ts).toLocaleTimeString()}
              </span>
              <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted-600">
                {a.actor}
              </span>
              <span className="font-medium text-foreground">{a.event}</span>
              <span className="text-muted">{a.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-400">{label}</dt>
      <dd className={`mt-0.5 break-all text-foreground ${mono ? "font-mono text-[11px]" : "text-sm"}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 pt-16 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
          Loading receipt…
        </div>
      }
    >
      <ReceiptContent />
    </Suspense>
  );
}
