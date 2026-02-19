import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

// ─── Network Canvas Background ───────────────────────────────────────────────
function NetworkCanvas() {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const nodesRef  = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    let W, H;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn nodes
    const COUNT = 68;
    nodesRef.current = Array.from({ length: COUNT }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      r:  Math.random() * 1.6 + 0.6,
      // some nodes are "suspicious" — slightly red
      hot: Math.random() < 0.18,
    }));

    const LINK_DIST  = 145;
    const LINK_DIST2 = LINK_DIST * LINK_DIST;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const nodes = nodesRef.current;

      // Update positions
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST2) {
            const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.18;
            const hot   = nodes[i].hot || nodes[j].hot;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = hot
              ? `rgba(239,68,68,${alpha * 1.8})`
              : `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.hot
          ? `rgba(239,68,68,0.75)`
          : `rgba(255,255,255,0.35)`;
        ctx.fill();

        // glow for hot nodes
        if (n.hot) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(239,68,68,0.08)";
          ctx.fill();
        }
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
}

// ─── Stat Badge ───────────────────────────────────────────────────────────────
function StatBadge({ label, value }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 2, padding: "10px 18px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 11, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#ef4444", fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

// ─── normalizeResponse (unchanged logic) ──────────────────────────────────────
function normalizeResponse(raw) {
  const PALETTE = [
    "#ef4444","#f97316","#a855f7","#3b82f6",
    "#10b981","#eab308","#ec4899","#06b6d4",
  ];
  const ringColorMap = {};
  (raw.fraud_rings || []).forEach((r, i) => {
    ringColorMap[r.ring_id] = PALETTE[i % PALETTE.length];
  });

  const suspMap = {};
  (raw.suspicious_accounts || []).forEach(a => { suspMap[a.account_id] = a; });

  const nodes = (raw.graph?.nodes || []).map(n => {
    const s = suspMap[n.id];
    return {
      id: n.id,
      suspicion_score: s ? s.suspicion_score / 100 : 0,
      patterns: s ? s.detected_patterns : [],
      ring_id: s ? s.ring_id : null,
      sentCount: n.sentCount, receivedCount: n.receivedCount,
      totalSent: n.totalSent, totalReceived: n.totalReceived,
    };
  });

  let edges = [];
  if (raw.graph?.edges && raw.graph.edges.length > 0) {
    edges = raw.graph.edges.map(e => ({
      from: e.sender_id || e.source || e.from,
      to:   e.receiver_id || e.target || e.to,
      amount: e.amount || 0,
    }));
  } else {
    const seen = new Set();
    (raw.fraud_rings || []).forEach(ring => {
      const members = ring.member_accounts;
      if (ring.pattern_type === "cycle" || ring.pattern_type.startsWith("cycle")) {
        for (let i = 0; i < members.length; i++) {
          const from = members[i], to = members[(i + 1) % members.length];
          const key = `${from}→${to}`;
          if (!seen.has(key)) { seen.add(key); edges.push({ from, to, amount: 0 }); }
        }
      } else if (ring.pattern_type === "smurfing_fan_in") {
        const hub = members[0];
        members.slice(1).forEach(m => {
          const key = `${m}→${hub}`;
          if (!seen.has(key)) { seen.add(key); edges.push({ from: m, to: hub, amount: 0 }); }
        });
      } else if (ring.pattern_type === "smurfing_fan_out") {
        const hub = members[0];
        members.slice(1).forEach(m => {
          const key = `${hub}→${m}`;
          if (!seen.has(key)) { seen.add(key); edges.push({ from: hub, to: m, amount: 0 }); }
        });
      } else {
        for (let i = 0; i < members.length - 1; i++) {
          const key = `${members[i]}→${members[i+1]}`;
          if (!seen.has(key)) { seen.add(key); edges.push({ from: members[i], to: members[i+1], amount: 0 }); }
        }
      }
    });
  }

  const rings = (raw.fraud_rings || []).map(r => ({
    ring_id: r.ring_id, pattern: r.pattern_type,
    members: r.member_accounts, risk_score: r.risk_score / 100,
  }));

  return { nodes, edges, rings, ringColorMap, summary: raw.summary || {}, rawJson: raw };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UploadScreen({ onAnalyze }) {
  const [file,    setFile]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [drag,    setDrag]    = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    // staggered mount animation
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
      const raw = await res.json();
      onAnalyze(normalizeResponse(raw), raw);
    } catch (err) {
      setError(err.message || "Failed to reach the analysis server.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) { setFile(f); setError(null); }
    else setError("Only .csv files are supported.");
  }, []);

  const fmt = bytes => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div style={{
      minHeight: "100vh", background: "#080810",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', ui-sans-serif, sans-serif",
      padding: "80px 16px 24px", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.35); }
          70%  { box-shadow: 0 0 0 10px rgba(239,68,68,0);   }
          100% { box-shadow: 0 0 0 0   rgba(239,68,68,0);    }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .upload-card:hover { border-color: rgba(239,68,68,0.3) !important; background: rgba(239,68,68,0.03) !important; }
        .analyze-btn:not(:disabled):hover {
          background: #dc2626 !important;
          box-shadow: 0 0 40px rgba(239,68,68,0.45) !important;
          transform: translateY(-1px);
        }
        .analyze-btn { transition: all 0.18s ease !important; }
        .tag { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; }
      `}</style>

      {/* Network animation */}
      <NetworkCanvas />

      {/* Radial vignette */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, #080810 100%)",
      }} />

      {/* Top-left corner accent */}
      <div style={{
        position: "fixed", top: 0, left: 0, width: 220, height: 220, zIndex: 1, pointerEvents: "none",
        background: "radial-gradient(circle at 0% 0%, rgba(239,68,68,0.07) 0%, transparent 70%)",
      }} />

      {/* Content wrapper */}
      <div style={{
        position: "relative", zIndex: 2, width: "100%", maxWidth: 480,
        opacity: mounted ? 1 : 0,
        animation: mounted ? "fadeUp 0.55s ease both" : "none",
      }}>

        {/* ── Logo ── */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          

          <div style={{
            fontSize: 42, fontWeight: 700, letterSpacing: "-0.04em",
            lineHeight: 1, color: "#f9fafb",
          }}>
            FLOW<span style={{ color: "#ef4444" }}>TRACE</span>
          </div>

          <div style={{
            marginTop: 10, fontSize: 12, color: "#374151",
            letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace",
          }}>
            Financial Crime Detection Engine
          </div>

          {/* Feature tags */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
            {["Graph Analysis","Cycle Detection","Smurfing","Shell Rings"].map(t => (
              <span key={t} className="tag" style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#4b5563",
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* ── Upload Card ── */}
        <div
          className="upload-card"
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1.5px dashed ${drag ? "#ef4444" : file ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 14, padding: "32px 28px", textAlign: "center", cursor: "pointer",
            background: drag ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.015)",
            transition: "border-color 0.15s, background 0.15s",
            backdropFilter: "blur(6px)",
          }}>
          <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }}
            onChange={e => { setFile(e.target.files[0]); setError(null); }} />

          {file ? (
            /* File selected state */
            <div style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 13, color: "#f3f4f6",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{file.name}</div>
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                  {fmt(file.size)} · CSV · Ready for analysis
                </div>
              </div>
              <span className="tag" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", flexShrink: 0 }}>
                ✓ LOADED
              </span>
            </div>
          ) : (
            /* Empty state */
            <>
              <div style={{
                width: 52, height: 52, borderRadius: 12, margin: "0 auto 16px",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
                Drop your transaction file here
              </div>
              <div style={{ fontSize: 11, color: "#374151", marginTop: 6, lineHeight: 1.7, fontFamily: "'DM Mono', monospace" }}>
                transaction_id · sender_id · receiver_id · amount · timestamp
              </div>
              <div style={{ marginTop: 14 }}>
                <span style={{
                  display: "inline-block", fontSize: 11, color: "#374151",
                  padding: "5px 12px", border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 6, background: "rgba(255,255,255,0.02)",
                }}>
                  Browse files →
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            marginTop: 10, padding: "10px 14px",
            background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 8, fontSize: 11, color: "#f87171", lineHeight: 1.6,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Analyze Button ── */}
        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={!file || loading}
          style={{
            marginTop: 12, width: "100%", padding: "14px 24px",
            borderRadius: 10, border: "none",
            background: (!file || loading) ? "rgba(255,255,255,0.04)" : "#ef4444",
            color: (!file || loading) ? "#2d2d31" : "#fff",
            fontSize: 13, fontWeight: 600, cursor: (!file || loading) ? "not-allowed" : "pointer",
            letterSpacing: "0.06em", textTransform: "uppercase",
            boxShadow: (!file || loading) ? "none" : "0 0 32px rgba(239,68,68,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: "'DM Mono', monospace",
          }}>
          {loading ? (
            <>
              <span style={{
                width: 13, height: 13,
                border: "2px solid rgba(255,255,255,0.15)",
                borderTop: "2px solid #fff",
                borderRadius: "50%", display: "inline-block",
                animation: "spin 0.75s linear infinite",
              }} />
              Analyzing Transactions...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: file ? 1 : 0.3 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Run Analysis
            </>
          )}
        </button>

        {/* ── Stats row ── */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
          <StatBadge label="Patterns" value="4" />
          <StatBadge label="Max Depth" value="5" />
          <StatBadge label="Engine" value="v1.0" />
        </div>

        {/* ── Footer hint ── */}
        <div style={{
          marginTop: 20, textAlign: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 10,
          color: "#1f2937", letterSpacing: "0.04em",
        }}>
          POST {API_BASE}/analyze
        </div>
      </div>
    </div>
  );
}