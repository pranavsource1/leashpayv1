"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import Icon from "@/components/icons";
import { formatINR } from "@/lib/money";

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
        .then((r) => r.json())
        .then((d) => {
          if (d.error) {
            setError(d.error);
          } else {
            setData(d);
            QRCode.toDataURL(approvalUrl, { width: 200 }).then(setQrCode);
          }
        })
        .catch((e) => setError(e.message));
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
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-red-200 bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600">
          <Icon name="alert" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-foreground">{error}</h1>
        <p className="mt-1 text-sm text-muted">
          This approval link may have expired or already been used.
        </p>
      </div>
    );
  }

  if (result?.action === "declined") {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-muted-600">
          <Icon name="close" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-foreground">Purchase declined</h1>
        <p className="mt-1 text-sm text-muted">You have declined this purchase request.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 pt-16 text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
        Loading approval…
      </div>
    );
  }

  const trace = data.policy_trace || [];

  return (
    <div className="mx-auto max-w-lg py-4">
      <div className="mb-5 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/10">
          <Icon name="shieldCheck" className="h-5 w-5" />
        </span>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-foreground">Approval required</h1>
        <p className="mt-1 text-sm text-muted">An AI agent is requesting to make this purchase.</p>

        {qrCode && (
          <div className="mt-4 inline-flex flex-col items-center rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-medium text-muted">Scan to approve on your phone</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Approval QR code" className="h-[150px] w-[150px]" />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-foreground">{data.title}</h2>

        <p className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground">
          {formatINR(data.amount_cents)}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="font-semibold uppercase tracking-wider text-muted-400">Merchant</dt>
            <dd className="mt-0.5 font-medium text-foreground">{data.merchant}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wider text-muted-400">Category</dt>
            <dd className="mt-0.5 font-medium text-foreground">{data.category}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wider text-muted-400">Risk score</dt>
            <dd className="mt-0.5 font-medium text-foreground">{data.risk_score}/100</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <Icon name="alert" className="h-3.5 w-3.5" />
            Why approval is needed
          </p>
          <ul className="mt-1.5 space-y-1 pl-5 text-xs text-amber-900">
            {trace
              .filter((t: any) => !t.passed)
              .map((t: any, i: number) => (
                <li key={i} className="list-disc">
                  {t.detail}
                </li>
              ))}
          </ul>
        </div>

        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold text-muted transition-colors hover:text-foreground">
            View full decision trace ({trace.length} rules)
          </summary>
          <ul className="mt-2 space-y-1">
            {trace.map((t: any, i: number) => (
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
        </details>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => handleAction("approve")}
          disabled={processing}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cta px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
          {processing ? "Processing…" : "Approve with PayPal"}
        </button>
        <button
          onClick={() => handleAction("decline")}
          disabled={processing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3.5 text-sm font-semibold text-muted-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed"
        >
          <Icon name="close" className="h-4 w-4" />
          Decline
        </button>
      </div>
    </div>
  );
}

export default function GuardianApprovePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 pt-16 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" />
          Loading approval…
        </div>
      }
    >
      <GuardianApproveContent />
    </Suspense>
  );
}
