"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import Icon from "@/components/icons";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState({ eventType: "", actor: "", redteam: "" });
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  useEffect(() => {
    loadLogs();
  }, [filter]);

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
    const rows = logs.map((l) => [
      l.ts,
      l.actor,
      l.event_type,
      `"${l.summary.replace(/"/g, '""')}"`,
      l.row_hash?.substring(0, 16),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leashpay-audit.csv";
    a.click();
  }

  // Custom cell renderers
  const ActorCellRenderer = (props: any) => {
    return (
      <span
        className="inline-flex items-center border border-hairline rounded-full px-2 py-0.5 text-[11px] font-semibold text-ink/70"
      >
        {props.value}
      </span>
    );
  };

  const EventCellRenderer = (props: any) => (
    <span className="text-[12px] font-medium text-ink">
      {(props.value ?? "").replace(/_/g, " ").toLowerCase()}
    </span>
  );

  const HashCellRenderer = (props: any) => {
    if (!props.value) return <span className="text-ink/30">—</span>;
    return (
      <code className="font-mono text-[11px] text-ink/40">
        {props.value.substring(0, 16)}…
      </code>
    );
  };

  const TimeCellRenderer = (props: any) => {
    const date = new Date(props.value);
    return <span className="whitespace-nowrap text-[12px] text-ink/60">{date.toLocaleString()}</span>;
  };

  // Column definitions
  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        field: "ts",
        headerName: "Time",
        width: 180,
        cellRenderer: TimeCellRenderer,
        sort: "desc",
        sortable: true,
        filter: "agDateColumnFilter",
      },
      {
        field: "actor",
        headerName: "Actor",
        width: 120,
        cellRenderer: ActorCellRenderer,
        filter: "agSetColumnFilter",
        sortable: true,
      },
      {
        field: "event_type",
        headerName: "Event",
        width: 200,
        cellRenderer: EventCellRenderer,
        filter: "agSetColumnFilter",
        sortable: true,
      },
      {
        field: "summary",
        headerName: "Summary",
        flex: 1,
        minWidth: 260,
        filter: "agTextColumnFilter",
        sortable: true,
        wrapText: false,
        autoHeight: false,
      },
      {
        field: "row_hash",
        headerName: "Row hash",
        width: 140,
        cellRenderer: HashCellRenderer,
      },
    ],
    []
  );

  // Row styling based on event type
  const getRowStyle = useCallback((params: any) => {
    const evt = params.data.event_type;
    if (evt === "DENIED" || evt === "MANDATE_MISMATCH" || evt === "KILL_SWITCH" || evt === "ERROR") {
      return { background: "#f0f0f0" };
    }
    if (evt === "CAPTURED" || evt === "APPROVED") {
      return { background: "#ffffff" };
    }
    return undefined;
  }, []);

  const onRowClicked = useCallback((event: any) => {
    setSelectedRow(event.data);
  }, []);

  const defaultColDef = useMemo(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
    }),
    []
  );

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
            Audit log
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Tamper-evident hash chain of every event in the system.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
          <Icon name="shieldCheck" className="h-3.5 w-3.5 text-signal-green" />
          {logs.length} entries
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={verifyChain}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-xs font-semibold text-paper transition-colors hover:bg-ink/90"
        >
          <Icon name="link" className="h-3.5 w-3.5" />
          Verify chain
        </button>
        <button
          onClick={simulateTamper}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-xs font-semibold text-ink/60 transition-colors hover:text-ink hover:border-ink/30"
        >
          <Icon name="bug" className="h-3.5 w-3.5" />
          Simulate tamper
        </button>
        <button
          onClick={downloadCSV}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-xs font-semibold text-ink/60 transition-colors hover:text-ink hover:border-ink/30"
        >
          <Icon name="download" className="h-3.5 w-3.5" />
          Export CSV
        </button>
        <button
          onClick={loadLogs}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-xs font-semibold text-ink/60 transition-colors hover:text-ink hover:border-ink/30"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {verifyResult && (
        <div
          className="mb-4 flex items-start gap-2 rounded-2xl border border-hairline p-4 text-sm text-ink"
        >
          {verifyResult.valid ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-signal-green" />
          ) : (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ink" />
          )}
          <span>
            {verifyResult.valid
              ? `Chain verified. ${verifyResult.totalRows} rows checked, no tampering detected.`
              : `Verification failed at row ${verifyResult.brokenAt}. Tampering detected: ${
                  verifyResult.brokenRow?.summary || "Unknown"
                }`}
          </span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <select
          aria-label="Filter by event type"
          value={filter.eventType}
          onChange={(e) => setFilter({ ...filter, eventType: e.target.value })}
          className={selectClass}
        >
          <option value="">All events</option>
          {[
            "SEARCH",
            "POLICY_DECISION",
            "ORDER_CREATED",
            "APPROVED",
            "CAPTURED",
            "DENIED",
            "PRICE_CHANGED",
            "KILL_SWITCH",
            "WEBHOOK",
            "ERROR",
            "MANDATE_SIGNED",
            "MANDATE_MISMATCH",
            "POLICY_CHANGED",
            "APPROVAL_REQUESTED",
            "DECLINED",
            "REFUNDED",
            "REDTEAM_RUN",
          ].map((e) => (
            <option key={e} value={e}>
              {e.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by actor"
          value={filter.actor}
          onChange={(e) => setFilter({ ...filter, actor: e.target.value })}
          className={selectClass}
        >
          <option value="">All actors</option>
          {["AGENT", "POLICY", "USER", "PAYPAL", "SYSTEM"].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by source"
          value={filter.redteam}
          onChange={(e) => setFilter({ ...filter, redteam: e.target.value })}
          className={selectClass}
        >
          <option value="">All sources</option>
          <option value="false">Production only</option>
          <option value="true">Red team only</option>
        </select>
      </div>

      <div className="ag-theme-alpine overflow-hidden rounded-2xl border border-hairline bg-paper">
        <div style={{ height: "520px", width: "100%" }}>
          <AgGridReact
            rowData={logs}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowStyle={getRowStyle}
            onRowClicked={onRowClicked}
            animateRows={true}
            pagination={true}
            paginationPageSize={50}
            domLayout="normal"
          />
        </div>
      </div>

      {selectedRow && (
        <div className="mt-4 rounded-2xl border border-hairline bg-paper p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Icon name="list" className="h-4 w-4 text-ink/40" />
              Event details
            </h3>
            <button
              onClick={() => setSelectedRow(null)}
              aria-label="Close event details"
              className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-canvas hover:text-ink"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-[140px_1fr]">
            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              ID
            </dt>
            <dd className="break-all font-mono text-xs text-ink">{selectedRow.id}</dd>

            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Timestamp
            </dt>
            <dd className="text-ink/60">{new Date(selectedRow.ts).toLocaleString()}</dd>

            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Actor
            </dt>
            <dd className="font-medium text-ink">{selectedRow.actor}</dd>

            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Event
            </dt>
            <dd className="font-medium text-ink">{selectedRow.event_type}</dd>

            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Summary
            </dt>
            <dd className="text-ink/60">{selectedRow.summary}</dd>

            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Previous hash
            </dt>
            <dd className="break-all font-mono text-[11px] text-ink/40">{selectedRow.prev_hash}</dd>

            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
              style={{ fontFamily: "var(--font-mono-ui)" }}
            >
              Row hash
            </dt>
            <dd className="break-all font-mono text-[11px] text-ink/40">{selectedRow.row_hash}</dd>

            {selectedRow.detail_json && (
              <>
                <dt
                  className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink/40"
                  style={{ fontFamily: "var(--font-mono-ui)" }}
                >
                  Details
                </dt>
                <dd>
                  <pre className="scroll-thin max-h-[200px] overflow-auto rounded-2xl border border-hairline bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink/60">
                    {JSON.stringify(JSON.parse(selectedRow.detail_json), null, 2)}
                  </pre>
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      {logs.length === 0 && !loading && (
        <div className="mt-4 rounded-2xl border border-hairline bg-paper px-6 py-16 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-canvas text-ink">
            <Icon name="receipt" className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink">No audit entries yet</p>
          <p className="mt-1 text-sm text-ink/60">Use the chat to generate some activity.</p>
        </div>
      )}
    </div>
  );
}
