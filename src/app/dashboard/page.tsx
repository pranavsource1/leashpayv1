"use client";

import { useState, useEffect } from "react";
import Icon, { type IconName } from "@/components/icons";
import { formatINR } from "@/lib/money";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterMerchant, setFilterMerchant] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
    fetch("/api/purchases")
      .then((r) => r.json())
      .then((d) => setPurchases(d.purchases || []));
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

  const merchants = Array.from(
    new Set(purchases.map((p) => p.offer_domain).filter(Boolean))
  ).sort() as string[];
  const categories = Array.from(
    new Set(purchases.map((p) => p.category).filter(Boolean))
  ).sort() as string[];

  const filteredPurchases = purchases.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesStatus = filterStatus === "All" || p.status === filterStatus;
    const matchesMerchant = filterMerchant === "All" || p.offer_domain === filterMerchant;
    const matchesCategory = filterCategory === "All" || p.category === filterCategory;
    const matchesSearch =
      !q ||
      (p.title ?? "").toLowerCase().includes(q) ||
      (p.offer_domain ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesMerchant && matchesCategory && matchesSearch;
  });

  const filtersActive =
    filterStatus !== "All" || filterMerchant !== "All" || filterCategory !== "All" || !!searchQuery;

  function clearFilters() {
    setFilterStatus("All");
    setFilterMerchant("All");
    setFilterCategory("All");
    setSearchQuery("");
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-ink" />
        Loading dashboard…
      </div>
    );
  }

  const b = data.budget;
  const budgetPct = Math.max(0, Math.min(100, b.remainingPct));

  const selectClass =
    "h-9 rounded-lg border border-hairline bg-paper px-2.5 text-xs font-medium text-ink/60 outline-none transition hover:border-ink/30 focus:border-ink";

  return (
    <div className="pb-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            Spending, policy decisions and purchase history for the demo wallet.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-ink"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              b.frozen ? "bg-ink" : "bg-signal-green"
            }`}
          />
          <Icon name={b.frozen ? "lock" : "shieldCheck"} className="h-3.5 w-3.5" />
          {b.frozen ? "Wallet frozen" : "Wallet active"}
        </span>
      </div>

      {/* Budget */}
      <section className="mb-4 rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider text-ink/50"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Monthly budget
            </p>
            <p
              className="mt-2 text-3xl font-bold tracking-tight text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {b.remainingFormatted}
            </p>
            <p className="mt-1 text-sm text-ink/50">left of {b.totalFormatted}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-canvas px-2.5 py-1.5 text-xs font-bold text-ink">
            {budgetPct}% left
          </span>
        </div>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink/40">
            <span>Spent {b.capturedFormatted}</span>
            <span>{Math.max(0, 100 - budgetPct)}% used</span>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Blocked spending"
          value={data.savings.blockedTotalFormatted}
          icon="shield"
        />
        <StatCard
          label="Saved on best deals"
          value={data.savings.savingsTotalFormatted}
          icon="tag"
        />
        <StatCard label="Captured" value={b.capturedFormatted} icon="receipt" />
        <StatCard label="Pending" value={b.reservedFormatted} icon="clock" />
      </section>

      {/* Spend breakdown */}
      <section className="mb-4 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="Spend by merchant"
          icon="store"
          rows={data.spend.byMerchant.map((m: any) => ({
            label: m.merchant,
            total: m.totalFormatted,
            count: m.count,
          }))}
        />
        <BreakdownCard
          title="Spend by category"
          icon="folder"
          rows={data.spend.byCategory.map((c: any) => ({
            label: c.category,
            total: c.totalFormatted,
            count: c.count,
          }))}
        />
      </section>

      {/* Decisions */}
      <section className="mb-4 rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
          <Icon name="shield" className="h-4 w-4 text-ink/40" />
          Policy decisions
        </h3>
        {data.spend.byDecision.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/40">No decisions recorded yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.spend.byDecision.map((d: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${decisionDotColor(d.decision)}`} />
                <span className="text-xs font-semibold text-ink">
                  {decisionLabel(d.decision)} · {d.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Purchase history */}
      <section className="rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Icon name="receipt" className="h-4 w-4 text-ink/40" />
              Purchase history
            </h3>
            <p className="mt-1 text-xs text-ink/50">
              Showing {filteredPurchases.length} of {purchases.length} purchases
              {filtersActive && (
                <button
                  onClick={clearFilters}
                  className="ml-2 font-semibold text-ink underline-offset-2 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[170px] flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40"
              />
              <input
                type="text"
                placeholder="Search item or merchant"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-hairline bg-paper pl-8 pr-3 text-xs text-ink outline-none transition placeholder:text-ink/40 hover:border-ink/30 focus:border-ink"
              />
            </div>

            <select
              aria-label="Filter by status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={selectClass}
            >
              <option value="All">All statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING_APPROVAL">Pending approval</option>
              <option value="DENIED">Denied</option>
            </select>

            <select
              aria-label="Filter by merchant"
              value={filterMerchant}
              onChange={(e) => setFilterMerchant(e.target.value)}
              className={selectClass}
            >
              <option value="All">All merchants</option>
              {merchants.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={selectClass}
            >
              <option value="All">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="border-b border-hairline text-[10px] font-semibold uppercase tracking-wider text-ink/40"
                style={{ fontFamily: "var(--font-mono-ui)" }}
              >
                <th className="py-2.5 pr-4 text-left font-semibold">Item</th>
                <th className="py-2.5 pr-4 text-left font-semibold">Amount</th>
                <th className="py-2.5 pr-4 text-left font-semibold">Merchant</th>
                <th className="py-2.5 pr-4 text-left font-semibold">Status</th>
                <th className="py-2.5 pr-4 text-left font-semibold">Decision</th>
                <th className="py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-ink/40">
                    {purchases.length === 0
                      ? "No purchases yet. Ask the agent to find something."
                      : "No purchases match these filters."}
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-hairline/70 transition-colors last:border-0 hover:bg-canvas"
                  >
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-ink">{p.title}</p>
                      {p.category && <p className="text-[11px] text-ink/40">{p.category}</p>}
                    </td>
                    <td className="py-3.5 pr-4 font-semibold tabular-nums text-ink">
                      {formatAmount(p.amount_cents, p.currency)}
                    </td>
                    <td className="py-3.5 pr-4 text-ink/60">{p.offer_domain ?? "—"}</td>
                    <td className="py-3.5 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(p.status)}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotColor(p.status)}`} />
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-0.5 text-[11px] font-semibold ${decisionTone(p.policy_decision)}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${decisionDotColor(p.policy_decision)}`} />
                        {decisionLabel(p.policy_decision)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3.5 text-right">
                      {p.status === "PAID" && (
                        <button
                          className="mr-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-ink/60 transition-colors hover:bg-canvas hover:text-ink"
                          onClick={() => refund(p.id)}
                        >
                          Refund
                        </button>
                      )}
                      <a
                        href={`/r/${p.id}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-ink/60 transition-colors hover:bg-canvas hover:text-ink"
                      >
                        Receipt
                        <Icon name="arrowRight" className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink/50">{label}</p>
          <p
            className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {value}
          </p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink/60">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: IconName;
  rows: { label: string; total: string; count: number }[];
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-5 sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
        <Icon name={icon} className="h-4 w-4 text-ink/40" />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink/40">No purchases yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm font-medium text-ink">
                {row.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink/60">
                {row.total}
                <span className="ml-1 text-xs font-normal text-ink/40">({row.count})</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAmount(cents: number, currency: string) {
  return formatINR(cents ?? 0);
}

function statusLabel(status: string) {
  if (status === "PAID") return "Paid";
  if (status === "PENDING_APPROVAL") return "Pending approval";
  if (status === "DENIED") return "Denied";
  if (status === "EXPIRED") return "Expired";
  return status ?? "—";
}

function statusTone(status: string) {
  if (status === "PAID") return "text-ink";
  if (status === "PENDING_APPROVAL") return "text-ink/70";
  if (status === "DENIED") return "text-ink/70";
  return "text-ink/50";
}

function statusDotColor(status: string) {
  if (status === "PAID") return "bg-signal-green";
  if (status === "PENDING_APPROVAL") return "bg-highlight-yellow";
  if (status === "DENIED") return "bg-ink";
  return "bg-ink/30";
}

function decisionLabel(decision: string) {
  if (decision === "ALLOW") return "Allowed";
  if (decision === "REQUIRE_APPROVAL") return "Needs approval";
  if (decision === "DENY") return "Denied";
  return decision ?? "—";
}

function decisionTone(decision: string) {
  if (decision === "ALLOW") return "text-ink";
  if (decision === "REQUIRE_APPROVAL") return "text-ink/70";
  if (decision === "DENY") return "text-ink/70";
  return "text-ink/50";
}

function decisionDotColor(decision: string) {
  if (decision === "ALLOW") return "bg-signal-green";
  if (decision === "REQUIRE_APPROVAL") return "bg-highlight-yellow";
  if (decision === "DENY") return "bg-ink";
  return "bg-ink/30";
}
