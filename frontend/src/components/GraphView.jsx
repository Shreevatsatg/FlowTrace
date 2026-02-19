import { useState } from "react";
import GraphCanvas from "./GraphCanvas";

export default function GraphView({ data, rawJson, onReset, onNavigate }) {
  const [filters, setFilters] = useState({ onlySuspicious: false, ring: null, minScore: 0, patterns: [] });

  const upd = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const togPat = p => setFilters(f => ({ ...f, patterns: f.patterns.includes(p) ? f.patterns.filter(x => x !== p) : [...f.patterns, p] }));

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(rawJson, null, 2)], { type: "application/json" }));
    a.download = "fraud_report.json";
    a.click();
  };

  function patternColor(pat) {
    if (pat.includes("cycle")) return "#ef4444";
    if (pat.includes("smurf")) return "#f97316";
    if (pat.includes("shell")) return "#a855f7";
    if (pat.includes("layer")) return "#a855f7";
    return "#6b7280";
  }

  const NAV_ITEMS = [
    { label: "Dashboard", icon: "⊞" },
    { label: "Graph View", icon: "⬡" },
  ];

  const suspicious = data.nodes.filter(n => n.suspicion_score > 0);
  const summary = data.summary || {};

  return (
    <div style={{ height: "100vh", display: "flex", background: "#0a0a0d", fontFamily: "ui-sans-serif,system-ui,sans-serif", color: "#e5e7eb", overflow: "hidden" }}>
      <style>{`
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:#374151}
      `}</style>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{ width: 216, flexShrink: 0, background: "#080809", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", padding: "18px 0" }}>
          <div style={{ padding: "0 18px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
              FLOW<span style={{ color: "#ef4444" }}>TRACE</span>
            </div>
            <div style={{ fontSize: 9, color: "#374151", marginTop: 2, letterSpacing: "0.1em", textTransform: "uppercase" }}>Money Muling Detection</div>
          </div>

          <div style={{ padding: "14px 14px 6px" }}>
            <button onClick={onReset} style={{ width: "100%", background: "transparent", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", }}>
              <span>New Analysis</span><span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            </button>
          </div>

          <nav style={{ padding: "6px 0", flex: 1 }}>
            {NAV_ITEMS.map(n => (
              <div key={n.label} onClick={() => n.label === "Dashboard" && onNavigate("dashboard")} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 18px", cursor: "pointer", borderLeft: n.label === "Graph View" ? "2px solid #ef4444" : "2px solid transparent", background: n.label === "Graph View" ? "rgba(239,68,68,0.07)" : "transparent", color: n.label === "Graph View" ? "#fff" : "#4b5563", fontSize: 12, fontWeight: n.label === "Graph View" ? 500 : 400 }}>
                <span style={{ fontSize: 13, opacity: n.label === "Graph View" ? 1 : 0.7 }}>{n.icon}</span>{n.label}
              </div>
            ))}
          </nav>

          {/* Download button */}
          <div style={{ padding: "14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <button onClick={download} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "#ef4444", color: "#ffff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 500 }}>
              <span>↓</span> Download JSON
            </button>
          </div>

          {/* Quick stats in sidebar */}
          <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", gap: 8, display: "flex", flexDirection: "column" }}>
            {[
              ["Total Analyzed", summary.total_accounts_analyzed ?? data.nodes.length],
              ["Flagged", summary.suspicious_accounts_flagged ?? suspicious.length],
              ["Rings Found", summary.fraud_rings_detected ?? data.rings.length],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#374151" }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db" }}>{v}</span>
              </div>
            ))}
          </div>
        </aside>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Filter sidebar */}
          <aside style={{ width: 192, flexShrink: 0, background: "#0c0c0f", borderRight: "1px solid rgba(255,255,255,0.04)", padding: 16, display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>
            <div style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.15em" }}>Filters</div>

            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
              <div onClick={() => upd("onlySuspicious", !filters.onlySuspicious)} style={{ width: 30, height: 16, borderRadius: 8, position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s", background: filters.onlySuspicious ? "#ef4444" : "#1a1a1e", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ position: "absolute", top: 2, left: filters.onlySuspicious ? 12 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: 11, color: filters.onlySuspicious ? "#d1d5db" : "#4b5563" }}>Only suspicious</span>
            </label>

            <div>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 7 }}>Min score <span style={{ color: "#ef4444", fontWeight: 600 }}>{(filters.minScore * 100).toFixed(0)}/100</span></div>
              <input type="range" min="0" max="1" step="0.05" value={filters.minScore}
                onChange={e => upd("minScore", parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#ef4444" }} />
            </div>

            {/* Ring filter */}
            <div>
              <div style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>Ring</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }} onClick={() => upd("ring", null)}>
                <div style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${!filters.ring ? "#ef4444" : "#1f2937"}`, background: !filters.ring ? "rgba(239,68,68,0.2)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {!filters.ring && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} />}
                </div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>All rings</span>
              </label>
              {data.rings.slice(0, 10).map(r => {
                const col = data.ringColorMap[r.ring_id] || "#6b7280";
                return (
                  <label key={r.ring_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, cursor: "pointer" }} onClick={() => upd("ring", r.ring_id)}>
                    <div style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${filters.ring === r.ring_id ? col : "#1f2937"}`, background: filters.ring === r.ring_id ? col + "22" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {filters.ring === r.ring_id && <div style={{ width: 5, height: 5, borderRadius: "50%", background: col }} />}
                    </div>
                    <span style={{ fontSize: 10, color: filters.ring === r.ring_id ? col : "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ring_id}</span>
                  </label>
                );
              })}
              {data.rings.length > 10 && <div style={{ fontSize: 10, color: "#2d2d31", marginTop: 4 }}>+{data.rings.length - 10} more</div>}
            </div>

            {/* Pattern filter */}
            <div>
              <div style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10 }}>Patterns</div>
              {["cycle", "smurfing", "shell"].map(p => (
                <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }} onClick={() => togPat(p)}>
                  <div style={{ width: 13, height: 13, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${filters.patterns.includes(p) ? patternColor(p) : "#1f2937"}`, background: filters.patterns.includes(p) ? patternColor(p) + "18" : "transparent" }} />
                  <span style={{ fontSize: 11, color: filters.patterns.includes(p) ? patternColor(p) : "#4b5563" }}>{p}</span>
                </label>
              ))}
            </div>

            <button onClick={() => setFilters({ onlySuspicious: false, ring: null, minScore: 0, patterns: [] })} style={{ padding: "6px 10px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, background: "transparent", color: "#374151", fontSize: 10, cursor: "pointer", marginTop: "auto" }}>
              Reset filters
            </button>
          </aside>

          {/* Graph */}
          <div style={{ flex: 1, position: "relative" }}>
            <GraphCanvas data={data} filters={filters} />
          </div>
        </div>
      </div>
    </div>
  );
}
