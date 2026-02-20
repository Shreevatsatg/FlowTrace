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
  const [currentStage, setCurrentStage] = useState(0);
  const [error,   setError]   = useState(null);
  const [drag,    setDrag]    = useState(false);
  const [mounted, setMounted] = useState(false);
  const [typewriterText, setTypewriterText] = useState("");
  const inputRef = useRef();
  const featuresRef = useRef();
  const aboutRef = useRef();

  const stages = [
    { label: "Parsing CSV", icon: "📄" },
    { label: "Building Graph", icon: "🕸️" },
    { label: "Detecting Cycles", icon: "🔄" },
    { label: "Finding Patterns", icon: "🔍" },
    { label: "Calculating Scores", icon: "📊" },
  ];

  const fullText = "Follow the money. Catch the mule.";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Typewriter effect
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index <= fullText.length) {
        setTypewriterText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // Expose scroll function to parent via window
  useEffect(() => {
    window.scrollToSection = (section) => {
      if (section === 'features' && featuresRef.current) {
        featuresRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (section === 'about' && aboutRef.current) {
        aboutRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setCurrentStage(0);
    try {
      await new Promise(r => setTimeout(r, 700));
      setCurrentStage(1);
      
      const form = new FormData();
      form.append("file", file);
      
      await new Promise(r => setTimeout(r, 600));
      setCurrentStage(2);
      
      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
      
      setCurrentStage(3);
      await new Promise(r => setTimeout(r, 500));
      
      setCurrentStage(4);
      await new Promise(r => setTimeout(r, 500));
      
      const raw = await res.json();
      onAnalyze(normalizeResponse(raw), raw);
    } catch (err) {
      setError(err.message || "Failed to reach the analysis server.");
    } finally {
      setLoading(false);
      setCurrentStage(0);
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
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
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 20px rgba(239,68,68,0.3), 0 0 40px rgba(239,68,68,0.2); }
          50% { text-shadow: 0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.3); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes particle {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100px) scale(0); opacity: 0; }
        }
        .upload-card:hover { border-color: rgba(239,68,68,0.3) !important; background: rgba(239,68,68,0.03) !important; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(239,68,68,0.15); }
        .analyze-btn:not(:disabled):hover {
          background: #dc2626 !important;
          box-shadow: 0 0 40px rgba(239,68,68,0.45) !important;
          transform: translateY(-2px) scale(1.02);
        }
        .analyze-btn { transition: all 0.3s ease !important; }
        .upload-card { transition: all 0.3s ease !important; }
        .tag { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; transition: all 0.2s ease; }
        .tag:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239,68,68,0.2); }
      `}</style>

      {/* Loading Screen Overlay */}
      {loading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(8,8,16,0.95)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "fadeIn 0.3s ease",
        }}>
          <div style={{ maxWidth: 600, width: "90%" }}>
            <div style={{
              textAlign: "center", marginBottom: 48,
              fontSize: 28, fontWeight: 800, color: "#f9fafb",
              fontFamily: "'DM Mono', monospace",
            }}>
              Analyzing {file?.name}
            </div>

            {/* Progress Bar */}
            <div style={{
              width: "100%", height: 6, background: "rgba(255,255,255,0.05)",
              borderRadius: 8, overflow: "hidden", marginBottom: 48,
            }}>
              <div style={{
                width: `${((currentStage + 1) / stages.length) * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, #ef4444, #dc2626)",
                transition: "width 0.5s ease",
                boxShadow: "0 0 20px rgba(239,68,68,0.5)",
              }} />
            </div>

            {/* Stages */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {stages.map((stage, i) => {
                const isActive = i === currentStage;
                const isComplete = i < currentStage;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px 20px", borderRadius: 12,
                    background: isActive ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${isActive ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.05)"}`,
                    transition: "all 0.3s ease",
                    opacity: isComplete ? 0.5 : 1,
                  }}>
                    <div style={{
                      fontSize: 28,
                      filter: isActive ? "none" : "grayscale(100%)",
                      opacity: isActive ? 1 : 0.4,
                    }}>{stage.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 16, fontWeight: 600,
                        color: isActive ? "#ef4444" : "#9ca3af",
                        fontFamily: "'DM Mono', monospace",
                      }}>{stage.label}</div>
                    </div>
                    {isComplete && (
                      <div style={{ fontSize: 20, color: "#10b981" }}>✓</div>
                    )}
                    {isActive && (
                      <div style={{
                        width: 16, height: 16,
                        border: "2px solid rgba(239,68,68,0.3)",
                        borderTop: "2px solid #ef4444",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{
              marginTop: 32, textAlign: "center",
              fontSize: 13, color: "#6b7280",
              fontFamily: "'DM Mono', monospace",
            }}>
              Stage {currentStage + 1} of {stages.length}
            </div>
          </div>
        </div>
      )}

      {/* Glassmorphism blobs */}
      <div style={{
        position: "fixed", top: "20%", right: "10%", width: 300, height: 300,
        background: "radial-gradient(circle, rgba(239,68,68,0.15), transparent)",
        borderRadius: "50%", filter: "blur(80px)", zIndex: 0, pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "20%", left: "10%", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(239,68,68,0.1), transparent)",
        borderRadius: "50%", filter: "blur(100px)", zIndex: 0, pointerEvents: "none",
      }} />

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

        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{
            fontSize: 64, fontWeight: 900, letterSpacing: "-0.04em",
            lineHeight: 1, marginBottom: 20,
          }}>
            <span style={{ color: "#fff" }}>FLOW</span>
            <span style={{ color: "#ef4444" }}>TRACE</span>
          </div>

          {/* Typewriter tagline */}
          <div style={{
            fontSize: 20, fontWeight: 600, color: "#9ca3af",
            fontFamily: "'DM Mono', monospace", minHeight: 28,
          }}>
            {typewriterText}<span style={{ animation: "blink 1s infinite" }}>|</span>
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: 14, fontWeight: 500, color: "#6b7280",
            fontFamily: "'DM Mono', monospace", marginTop: 28,
            letterSpacing: "0.05em",
          }}>
            Money Muling Detection · Graph-Based Financial Crime Engine
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
            border: `2px dashed ${drag ? "#ef4444" : file ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 16, padding: "36px 32px", textAlign: "center", cursor: "pointer",
            background: drag ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)",
            transition: "all 0.3s ease",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
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
                width: 56, height: 56, borderRadius: 14, margin: "0 auto 20px",
                background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
                border: "2px solid rgba(239,68,68,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 24px rgba(239,68,68,0.2)",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, color: "#d1d5db", fontWeight: 700, marginBottom: 8 }}>
                Drop your transaction file here
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8, lineHeight: 1.8, fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                transaction_id · sender_id · receiver_id · amount · timestamp
              </div>
              <div style={{ marginTop: 20 }}>
                <span style={{
                  display: "inline-block", fontSize: 13, color: "#ef4444",
                  padding: "8px 20px", border: "2px solid rgba(239,68,68,0.3)",
                  borderRadius: 8, background: "rgba(239,68,68,0.1)",
                  fontWeight: 700, letterSpacing: "0.05em",
                  boxShadow: "0 4px 16px rgba(239,68,68,0.2)",
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
            marginTop: 16, width: "100%", padding: "18px 32px",
            borderRadius: 12, border: "none",
            background: (!file || loading) ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #ef4444, #dc2626)",
            color: (!file || loading) ? "#4b5563" : "#fff",
            fontSize: 15, fontWeight: 700, cursor: (!file || loading) ? "not-allowed" : "pointer",
            letterSpacing: "0.08em", textTransform: "uppercase",
            boxShadow: (!file || loading) ? "none" : "0 8px 32px rgba(239,68,68,0.4), 0 0 0 1px rgba(239,68,68,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
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

      {/* Features Section */}
      <div ref={featuresRef} style={{
        position: "relative", zIndex: 2, width: "100%", maxWidth: 1200,
        padding: "80px 24px", margin: "0 auto",
      }}>
        <h2 style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", textAlign: "center", marginBottom: 16, animation: "glow 2s ease-in-out infinite" }}>
          Powerful Detection Features
        </h2>
        <p style={{ fontSize: 16, color: "#9ca3af", textAlign: "center", maxWidth: 700, margin: "0 auto 60px", lineHeight: 1.7 }}>
          Advanced graph-based algorithms to identify money muling patterns, fraud rings, and suspicious financial networks.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {[
            { icon: "🔄", title: "Cycle Detection", desc: "Identifies circular money flows (3-5 hops) using DFS algorithms." },
            { icon: "🌊", title: "Smurfing Analysis", desc: "Detects fan-in/fan-out patterns across 10+ accounts in 24h windows." },
            { icon: "🐚", title: "Shell Chains", desc: "Finds low-activity relay accounts obscuring money trails." },
            { icon: "📊", title: "Risk Scoring", desc: "Assigns 0-100 suspicion scores based on multiple behavioral signals." },
            { icon: "🕸️", title: "Graph Construction", desc: "Builds directed graphs with accounts as nodes and transactions as weighted edges." },
            { icon: "🎯", title: "Pattern Recognition", desc: "Combines multiple algorithms to identify complex fraud patterns across the network." },
          ].map((f, i) => (
            <div key={f.title} style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 32, textAlign: "center",
              transition: "all 0.3s ease", animation: `scaleIn 0.5s ease ${i * 0.1}s both`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              e.currentTarget.style.transform = "translateY(-8px)";
              e.currentTarget.style.boxShadow = "0 12px 40px rgba(239,68,68,0.2)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{ fontSize: 48, marginBottom: 16, animation: "float 3s ease-in-out infinite" }}>{f.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* About Section */}
      <div ref={aboutRef} style={{
        position: "relative", zIndex: 2, width: "100%", maxWidth: 1000,
        padding: "80px 24px 120px", margin: "0 auto",
      }}>
        <h2 style={{ fontSize: 48, fontWeight: 800, color: "#f9fafb", textAlign: "center", marginBottom: 16, animation: "glow 2s ease-in-out infinite" }}>
          About FLOW<span style={{ color: "#ef4444" }}>TRACE</span>
        </h2>
        <p style={{ fontSize: 16, color: "#9ca3af", textAlign: "center", maxWidth: 700, margin: "0 auto 60px", lineHeight: 1.7 }}>
          FlowTrace is an advanced money muling detection engine built for RIFT 2026. Using graph-based analysis and pattern recognition, we identify suspicious financial networks in real-time.
        </p>

        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: 48, animation: "scaleIn 0.6s ease both",
        }}>
          <h3 style={{ fontSize: 28, fontWeight: 700, color: "#f9fafb", marginBottom: 32 }}>How It Works</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {[
              { step: "1", title: "Upload CSV", desc: "Provide transaction data with sender, receiver, amount, and timestamp." },
              { step: "2", title: "Graph Construction", desc: "Build a directed graph with accounts as nodes and transactions as edges." },
              { step: "3", title: "Pattern Detection", desc: "Run DFS for cycles, analyze degree centrality for smurfing, identify shell chains." },
              { step: "4", title: "Risk Assessment", desc: "Score each account based on detected patterns and network behavior." },
              { step: "5", title: "Visualization", desc: "Interactive graph display with fraud rings highlighted and exportable results." },
            ].map(({ step, title, desc }, i) => (
              <div key={step} style={{ display: "flex", gap: 20, alignItems: "flex-start", animation: `slideIn 0.5s ease ${i * 0.1}s both` }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                  background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 700, color: "#ef4444",
                }}>{step}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#f3f4f6", marginBottom: 8 }}>{title}</div>
                  <div style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 48, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 16 }}>Built With</div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {["React", "Vite", "Node.js", "Express", "Graph Theory", "DFS"].map(tech => (
                <span key={tech} style={{
                  padding: "10px 20px", borderRadius: 10,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444", fontSize: 13, fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(239,68,68,0.2)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}>{tech}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}