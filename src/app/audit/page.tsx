"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import type { ColDef } from "ag-grid-community";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState({ eventType: "", actor: "", redteam: "" });
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<any>(null);

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
    const rows = logs.map(l => [
      l.ts,
      l.actor,
      l.event_type,
      `"${l.summary.replace(/"/g, '""')}"`,
      l.row_hash?.substring(0, 16)
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leashpay-audit.csv";
    a.click();
  }

  // Custom cell renderers
  const ActorCellRenderer = (props: any) => {
    const colors: Record<string, string> = {
      AGENT: "#2196f3",
      POLICY: "#ff9800",
      USER: "#4caf50",
      PAYPAL: "#003087",
      SYSTEM: "#666"
    };
    const color = colors[props.value] || "#999";
    return (
      <span style={{
        background: color,
        color: "white",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold"
      }}>
        {props.value}
      </span>
    );
  };

  const EventCellRenderer = (props: any) => {
    const emojiMap: Record<string, string> = {
      SEARCH: "🔍",
      POLICY_DECISION: "⚖️",
      ORDER_CREATED: "📦",
      APPROVED: "✅",
      CAPTURED: "💰",
      DENIED: "❌",
      MANDATE_SIGNED: "🔏",
      WEBHOOK: "🔔",
      ERROR: "⚠️",
      REFUNDED: "💸",
      POLICY_CHANGED: "⚙️"
    };
    const emoji = emojiMap[props.value] || "•";
    
    return <span>{emoji} {props.value}</span>;
  };

  const HashCellRenderer = (props: any) => {
    if (!props.value) return <span style={{ color: "#999" }}>—</span>;
    return (
      <code style={{
        fontSize: "11px",
        color: "#666",
        fontFamily: "monospace"
      }}>
        {props.value.substring(0, 16)}…
      </code>
    );
  };

  const TimeCellRenderer = (props: any) => {
    const date = new Date(props.value);
    return (
      <span style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
        {date.toLocaleString()}
      </span>
    );
  };

  // Column definitions
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: "ts",
      headerName: "Time",
      width: 180,
      cellRenderer: TimeCellRenderer,
      sort: "desc",
      sortable: true,
      filter: "agDateColumnFilter"
    },
    {
      field: "actor",
      headerName: "Actor",
      width: 120,
      cellRenderer: ActorCellRenderer,
      filter: "agSetColumnFilter",
      sortable: true
    },
    {
      field: "event_type",
      headerName: "Event",
      width: 200,
      cellRenderer: EventCellRenderer,
      filter: "agSetColumnFilter",
      sortable: true
    },
    {
      field: "summary",
      headerName: "Summary",
      flex: 1,
      minWidth: 300,
      filter: "agTextColumnFilter",
      sortable: true,
      wrapText: false,
      autoHeight: false
    },
    {
      field: "row_hash",
      headerName: "Row Hash",
      width: 140,
      cellRenderer: HashCellRenderer
    }
  ], []);

  // Row styling based on event type
  const getRowStyle = useCallback((params: any) => {
    const evt = params.data.event_type;
    if (evt === "DENIED" || evt === "MANDATE_MISMATCH" || evt === "KILL_SWITCH" || evt === "ERROR") {
      return { background: "#fee" };
    }
    if (evt === "CAPTURED" || evt === "APPROVED") {
      return { background: "#dfd" };
    }
    if (evt === "POLICY_DECISION" || evt === "APPROVAL_REQUESTED") {
      return { background: "#ffd" };
    }
    return undefined;
  }, []);

  const onRowClicked = useCallback((event: any) => {
    setSelectedRow(event.data);
  }, []);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
  }), []);

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "8px" }}>📋 Audit Log</h1>
      <p style={{ color: "#666", marginTop: 0, marginBottom: "20px" }}>
        Tamper-evident chain of all system events
      </p>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={verifyChain}
          style={{
            padding: "10px 20px",
            borderRadius: "6px",
            background: "#003087",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "14px"
          }}>
          🔗 Verify Chain
        </button>
        <button onClick={simulateTamper}
          style={{
            padding: "10px 20px",
            borderRadius: "6px",
            background: "#c00",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "14px"
          }}>
          🐛 Simulate Tamper
        </button>
        <button onClick={downloadCSV}
          style={{
            padding: "10px 20px",
            borderRadius: "6px",
            background: "#28a745",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "14px"
          }}>
          📥 Export CSV
        </button>
        <button onClick={loadLogs}
          style={{
            padding: "10px 20px",
            borderRadius: "6px",
            background: "#eee",
            border: "1px solid #ccc",
            cursor: "pointer",
            fontSize: "14px"
          }}>
          🔄 Refresh
        </button>
      </div>

      {/* Verification Result */}
      {verifyResult && (
        <div style={{
          padding: "14px 18px",
          borderRadius: "8px",
          marginBottom: "16px",
          background: verifyResult.valid ? "#d4edda" : "#f8d7da",
          border: `2px solid ${verifyResult.valid ? "#28a745" : "#dc3545"}`,
          fontSize: "15px"
        }}>
          {verifyResult.valid
            ? `✅ Chain verification PASSED! ${verifyResult.totalRows} rows verified with no tampering detected.`
            : `❌ Chain verification FAILED at row ${verifyResult.brokenAt}! Tampering detected: ${verifyResult.brokenRow?.summary || "Unknown"}`}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <select
          value={filter.eventType}
          onChange={e => setFilter({ ...filter, eventType: e.target.value })}
          style={{
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "13px"
          }}>
          <option value="">All Events</option>
          {["SEARCH","POLICY_DECISION","ORDER_CREATED","APPROVED","CAPTURED","DENIED","PRICE_CHANGED","KILL_SWITCH","WEBHOOK","ERROR","MANDATE_SIGNED","MANDATE_MISMATCH","POLICY_CHANGED","APPROVAL_REQUESTED","DECLINED","REFUNDED","REDTEAM_RUN"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={filter.actor}
          onChange={e => setFilter({ ...filter, actor: e.target.value })}
          style={{
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "13px"
          }}>
          <option value="">All Actors</option>
          {["AGENT","POLICY","USER","PAYPAL","SYSTEM"].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filter.redteam}
          onChange={e => setFilter({ ...filter, redteam: e.target.value })}
          style={{
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "13px"
          }}>
          <option value="">All</option>
          <option value="false">Production Only</option>
          <option value="true">Red Team Only</option>
        </select>
      </div>

      {/* AG Grid */}
      <div className="ag-theme-alpine" style={{ height: "500px", width: "100%" }}>
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

      {/* Selected Row Detail */}
      {selectedRow && (
        <div style={{
          marginTop: "20px",
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #ddd"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0 }}>🔍 Event Details</h3>
            <button onClick={() => setSelectedRow(null)}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "#666"
              }}>×</button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "8px", fontSize: "14px" }}>
            <div style={{ fontWeight: "bold" }}>ID:</div>
            <div><code>{selectedRow.id}</code></div>
            
            <div style={{ fontWeight: "bold" }}>Timestamp:</div>
            <div>{new Date(selectedRow.ts).toLocaleString()}</div>
            
            <div style={{ fontWeight: "bold" }}>Actor:</div>
            <div>{selectedRow.actor}</div>
            
            <div style={{ fontWeight: "bold" }}>Event Type:</div>
            <div>{selectedRow.event_type}</div>
            
            <div style={{ fontWeight: "bold" }}>Summary:</div>
            <div>{selectedRow.summary}</div>
            
            <div style={{ fontWeight: "bold" }}>Previous Hash:</div>
            <div><code style={{ fontSize: "11px" }}>{selectedRow.prev_hash}</code></div>
            
            <div style={{ fontWeight: "bold" }}>Row Hash:</div>
            <div><code style={{ fontSize: "11px" }}>{selectedRow.row_hash}</code></div>
            
            {selectedRow.detail_json && (
              <>
                <div style={{ fontWeight: "bold" }}>Details:</div>
                <div>
                  <pre style={{
                    background: "#f5f5f5",
                    padding: "10px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    overflow: "auto",
                    maxHeight: "200px"
                  }}>
                    {JSON.stringify(JSON.parse(selectedRow.detail_json), null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {logs.length === 0 && !loading && (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#999",
          background: "white",
          borderRadius: "8px",
          border: "1px solid #ddd",
          marginTop: "20px"
        }}>
          <p style={{ fontSize: "18px", marginBottom: "8px" }}>No audit entries yet</p>
          <p style={{ fontSize: "14px" }}>Use the chat to generate some activity!</p>
        </div>
      )}
    </div>
  );
}
