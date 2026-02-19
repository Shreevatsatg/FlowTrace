import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
// Change this to your deployed backend URL, e.g. "https://your-api.railway.app"
const API_BASE = "http://localhost:3000";

// ─── Data Normalizer ─────────────────────────────────────────────────────────
// Converts the raw backend response into the internal shape the UI consumes
function normalizeResponse(raw) {
  // --- build ring color palette (cyclic across 8 distinct accent colors) ---
  const PALETTE = [
    "#ef4444","#f97316","#a855f7","#3b82f6",
    "#10b981","#eab308","#ec4899","#06b6d4",
  ];
  const ringColorMap = {};
  (raw.fraud_rings || []).forEach((r, i) => {
    ringColorMap[r.ring_id] = PALETTE[i % PALETTE.length];
  });

  // --- suspicious account lookup by id ---
  const suspMap = {};
  (raw.suspicious_accounts || []).forEach(a => {
    suspMap[a.account_id] = a;
  });

  // --- nodes: come from graph.nodes; enrich with suspicious info ---
  const nodes = (raw.graph?.nodes || []).map(n => {
    const s = suspMap[n.id];
    return {
      id: n.id,
      suspicion_score: s ? s.suspicion_score / 100 : 0,   // normalise 0-100 → 0-1
      patterns: s ? s.detected_patterns : [],
      ring_id: s ? s.ring_id : null,
      sentCount: n.sentCount,
      receivedCount: n.receivedCount,
      totalSent: n.totalSent,
      totalReceived: n.totalReceived,
    };
  });

  // --- edges: backend returns [] for edges in the demo JSON;
  //     we reconstruct plausible edges from fraud_rings membership
  //     so the graph is not empty. When the backend sends real edges
  //     (array of {sender_id, receiver_id, amount}) we use those directly. ---
  let edges = [];
  if (raw.graph?.edges && raw.graph.edges.length > 0) {
    edges = raw.graph.edges.map(e => ({
      from: e.sender_id || e.from,
      to:   e.receiver_id || e.to,
      amount: e.amount || 0,
    }));
  } else {
    // Reconstruct ring-internal edges so graph is visualisable
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
        // Many → first member (hub)
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
        // layered_shell: chain
        for (let i = 0; i < members.length - 1; i++) {
          const key = `${members[i]}→${members[i+1]}`;
          if (!seen.has(key)) { seen.add(key); edges.push({ from: members[i], to: members[i+1], amount: 0 }); }
        }
      }
    });
  }

  // --- rings ---
  const rings = (raw.fraud_rings || []).map(r => ({
    ring_id: r.ring_id,
    pattern: r.pattern_type,
    members: r.member_accounts,
    risk_score: r.risk_score / 100,   // 0-100 → 0-1
  }));

  return {
    nodes,
    edges,
    rings,
    ringColorMap,
    summary: raw.summary || {},
    rawJson: raw,
  };
}

// ─── Pattern color (fallback palette for unknown pattern strings) ──────────────
function patternColor(pat) {
  if (pat.includes("cycle"))   return "#ef4444";
  if (pat.includes("smurf"))   return "#f97316";
  if (pat.includes("shell"))   return "#a855f7";
  if (pat.includes("layer"))   return "#a855f7";
  return "#6b7280";
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ color = "#ef4444", values }) {
  const w = 64, h = 28;
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────
function Gauge({ value, color = "#22c55e", size = 44 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1f2937" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${circ * Math.min(value, 1)} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ─── Graph Canvas ─────────────────────────────────────────────────────────────
function GraphCanvas({ data, filters }) {
  const canvasRef = useRef(null);
  const sRef      = useRef({ nodes:[], edges:[], dragging:null, hover:null, pan:{x:0,y:0}, scale:1, isPanning:false, lastMouse:null });
  const ttRef     = useRef(null);
  const rafRef    = useRef(null);

  const initPos = useCallback((nodes) => {
    const cx = 500, cy = 280, r = 210;
    return nodes.map((n, i) => ({
      ...n,
      x: cx + r * Math.cos((2*Math.PI*i)/nodes.length) + (Math.random()-.5)*35,
      y: cy + r * Math.sin((2*Math.PI*i)/nodes.length) + (Math.random()-.5)*35,
      vx: 0, vy: 0,
    }));
  }, []);

  useEffect(() => {
    if (!data) return;
    const s = sRef.current;
    const fn = data.nodes.filter(n => {
      if (filters.onlySuspicious && n.suspicion_score < 0.1) return false;
      if (filters.ring && n.ring_id !== filters.ring) return false;
      if (n.suspicion_score < filters.minScore) return false;
      if (filters.patterns.length && !filters.patterns.some(p => n.patterns.some(np => np.includes(p)))) return false;
      return true;
    });
    const ids = new Set(fn.map(n => n.id));
    s.nodes = initPos(fn);
    s.edges = data.edges.filter(e => ids.has(e.from) && ids.has(e.to));
    s.pan = {x:0,y:0}; s.scale = 1;
  }, [data, filters, initPos]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = sRef.current;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const sim = () => {
      const ns = s.nodes; if (!ns.length) return;
      for (let i = 0; i < ns.length; i++) for (let j = i+1; j < ns.length; j++) {
        const dx=ns[j].x-ns[i].x, dy=ns[j].y-ns[i].y, d=Math.sqrt(dx*dx+dy*dy)||1;
        const f = Math.min(3200/(d*d), 80);
        ns[i].vx-=(dx/d)*f; ns[i].vy-=(dy/d)*f; ns[j].vx+=(dx/d)*f; ns[j].vy+=(dy/d)*f;
      }
      s.edges.forEach(e => {
        const a=ns.find(n=>n.id===e.from), b=ns.find(n=>n.id===e.to); if(!a||!b) return;
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-100)*0.022;
        a.vx+=(dx/d)*f; a.vy+=(dy/d)*f; b.vx-=(dx/d)*f; b.vy-=(dy/d)*f;
      });
      const W=canvas.width, H=canvas.height;
      ns.forEach(n => {
        n.vx+=(W/2-n.x)*0.0012; n.vy+=(H/2-n.y)*0.0012;
        n.vx*=0.83; n.vy*=0.83;
        if (!s.dragging||s.dragging.id!==n.id) { n.x+=n.vx; n.y+=n.vy; }
      });
    };

    const draw = () => {
      const W=canvas.width, H=canvas.height;
      ctx.clearRect(0,0,W,H);
      ctx.save();
      ctx.translate(s.pan.x, s.pan.y);
      ctx.scale(s.scale, s.scale);

      // edges
      s.edges.forEach(e => {
        const a=s.nodes.find(n=>n.id===e.from), b=s.nodes.find(n=>n.id===e.to); if(!a||!b) return;
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy)||1,nr=16,nx=dx/d,ny=dy/d;
        const sx=a.x+nx*nr,sy=a.y+ny*nr,ex=b.x-nx*nr,ey=b.y-ny*nr;
        const isSusp=a.suspicion_score>0.2&&b.suspicion_score>0.2;
        const lineCol = isSusp
          ? (data.ringColorMap[a.ring_id]||"#ef4444")+"45"
          : "rgba(255,255,255,0.06)";
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey);
        ctx.strokeStyle=lineCol; ctx.lineWidth=isSusp?1.5:1; ctx.stroke();
        const ang=Math.atan2(ey-sy,ex-sx);
        ctx.beginPath();
        ctx.moveTo(ex,ey);
        ctx.lineTo(ex-7*Math.cos(ang-0.4),ey-7*Math.sin(ang-0.4));
        ctx.lineTo(ex-7*Math.cos(ang+0.4),ey-7*Math.sin(ang+0.4));
        ctx.closePath();
        ctx.fillStyle=isSusp?(data.ringColorMap[a.ring_id]||"#ef4444")+"66":"rgba(255,255,255,0.09)";
        ctx.fill();
      });

      // nodes
      s.nodes.forEach(n => {
        const hov=s.hover?.id===n.id;
        const color = n.ring_id
          ? (data.ringColorMap[n.ring_id]||"#6b7280")
          : (n.suspicion_score>0.15 ? "#fbbf24" : "#374151");
        const nr=hov?21:16;
        if (n.suspicion_score>0.1||n.ring_id) {
          const g=ctx.createRadialGradient(n.x,n.y,nr*.4,n.x,n.y,nr*3.2);
          g.addColorStop(0,color+"28"); g.addColorStop(1,"transparent");
          ctx.beginPath(); ctx.arc(n.x,n.y,nr*3.2,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(n.x,n.y,nr,0,Math.PI*2);
        ctx.fillStyle=color+"14"; ctx.fill();
        ctx.strokeStyle=color; ctx.lineWidth=hov?2.5:1.5; ctx.stroke();
        if (n.suspicion_score>0) {
          ctx.beginPath();
          ctx.arc(n.x,n.y,nr+4,-Math.PI/2,-Math.PI/2+n.suspicion_score*Math.PI*2);
          ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke();
        }
        // label — only show if not too many nodes
        if (s.nodes.length <= 60 || hov) {
          ctx.fillStyle=hov?"#fff":"#6b7280";
          ctx.font=`${hov?"600 ":""}9px ui-sans-serif,system-ui`;
          ctx.textAlign="center";
          ctx.fillText(n.id, n.x, n.y+nr+12);
        }
      });

      ctx.restore(); sim();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize",resize); };
  }, [data, filters]);

  const getNode = (mx,my) => {
    const s=sRef.current,wx=(mx-s.pan.x)/s.scale,wy=(my-s.pan.y)/s.scale;
    return s.nodes.find(n=>Math.hypot(n.x-wx,n.y-wy)<24);
  };

  const onMove = e => {
    const rect=canvasRef.current.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const s=sRef.current;
    if (s.dragging) { s.dragging.x=(mx-s.pan.x)/s.scale; s.dragging.y=(my-s.pan.y)/s.scale; return; }
    if (s.isPanning&&s.lastMouse) { s.pan.x+=mx-s.lastMouse.x; s.pan.y+=my-s.lastMouse.y; s.lastMouse={x:mx,y:my}; return; }
    const node=getNode(mx,my); s.hover=node||null;
    canvasRef.current.style.cursor=node?"pointer":"grab";
    const tt=ttRef.current; if (!tt) return;
    if (node) {
      const sc=(node.suspicion_score*100).toFixed(0);
      const col=node.suspicion_score>0.6?"#f87171":node.suspicion_score>0.3?"#fbbf24":"#4ade80";
      const ringCol=node.ring_id?(data.ringColorMap[node.ring_id]||"#6b7280"):"#6b7280";
      tt.style.cssText=`display:block;position:absolute;pointer-events:none;z-index:20;left:${mx+14}px;top:${my-8}px;background:rgba(8,8,11,0.97);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 14px;font-family:ui-sans-serif,system-ui;font-size:11px;line-height:1.8;box-shadow:0 8px 32px rgba(0,0,0,0.6);min-width:180px`;
      tt.innerHTML=`
        <div style="font-weight:700;color:#fff;margin-bottom:5px;font-size:12px">${node.id}</div>
        <div style="color:#4b5563">Score: <span style="color:${col};font-weight:700">${sc}/100</span></div>
        ${node.ring_id?`<div style="color:#4b5563">Ring: <span style="color:${ringCol};font-weight:600">${node.ring_id}</span></div>`:""}
        ${node.patterns.length?`<div style="color:#4b5563">Patterns: <span style="color:#9ca3af">${node.patterns.join(", ")}</span></div>`:""}
        <div style="color:#4b5563;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.05)">
          <span>Sent: <b style="color:#6b7280">$${(node.totalSent||0).toLocaleString()}</b></span>&nbsp;&nbsp;
          <span>Rcvd: <b style="color:#6b7280">$${(node.totalReceived||0).toLocaleString()}</b></span>
        </div>
      `;
    } else { tt.style.display="none"; }
  };
  const onDown = e => {
    const rect=canvasRef.current.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const s=sRef.current,node=getNode(mx,my);
    if (node) s.dragging=node; else { s.isPanning=true; s.lastMouse={x:mx,y:my}; }
  };
  const onUp  = () => { const s=sRef.current; s.dragging=null; s.isPanning=false; s.lastMouse=null; };
  const onWheel = e => { e.preventDefault(); const s=sRef.current; s.scale=Math.max(0.2,Math.min(4,s.scale*(e.deltaY<0?1.12:0.9))); };

  // Legend — show top unique ring colors (max 6)
  const legendRings = data
    ? Object.entries(data.ringColorMap).slice(0,6)
    : [];

  return (
    <div style={{position:"relative",width:"100%",height:"100%"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:"100%",cursor:"grab",display:"block"}}
        onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel} />
      <div ref={ttRef} style={{display:"none"}} />

      {/* Legend */}
      <div style={{position:"absolute",bottom:12,right:12,display:"flex",flexWrap:"wrap",gap:10,justifyContent:"flex-end",maxWidth:320}}>
        {legendRings.map(([rid,col])=>(
          <span key={rid} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#4b5563",fontFamily:"ui-sans-serif"}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:col+"35",border:`1.5px solid ${col}`,display:"block",flexShrink:0}} />
            <span style={{color:col}}>{rid}</span>
          </span>
        ))}
        {legendRings.length < Object.keys(data?.ringColorMap||{}).length && (
          <span style={{fontSize:10,color:"#374151",fontFamily:"ui-sans-serif"}}>+{Object.keys(data.ringColorMap).length-6} more</span>
        )}
      </div>
      <div style={{position:"absolute",top:12,left:12,fontSize:10,color:"#2d2d31",fontFamily:"ui-sans-serif"}}>Drag · Scroll to zoom · Pan</div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, trend, trendUp, chart, gauge, gaugeColor }) {
  return (
    <div style={{flex:1,background:"#111113",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"14px 16px",minWidth:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:10,color:"#4b5563",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</div>
          <div style={{fontSize:26,fontWeight:700,color:"#fff",lineHeight:1}}>{value}</div>
          <div style={{fontSize:11,color:"#374151",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,marginLeft:8,flexShrink:0}}>
          {trend && (
            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:4,color:trendUp?"#f87171":"#4ade80",background:trendUp?"rgba(239,68,68,0.1)":"rgba(74,222,128,0.1)",whiteSpace:"nowrap"}}>
              {trendUp?"↑":"↓"} {trend}
            </span>
          )}
          {chart && <Sparkline color="#ef4444" values={chart} />}
          {gauge!==undefined && <Gauge value={gauge} color={gaugeColor||"#22c55e"} />}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Screen ────────────────────────────────────────────────────────────
function UploadScreen({ onAnalyze }) {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [drag, setDrag]       = useState(false);
  const inputRef = useRef();

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/analyze`, { method:"POST", body:form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error ${res.status}: ${txt}`);
      }
      const raw = await res.json();
      onAnalyze(normalizeResponse(raw), raw);
    } catch (err) {
      setError(err.message || "Failed to reach the analysis server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:"100vh",background:"#0a0a0d",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      fontFamily:"ui-sans-serif,system-ui,sans-serif",padding:24,
      backgroundImage:"radial-gradient(ellipse 70% 45% at 50% 0%,rgba(239,68,68,0.10) 0%,transparent 65%)"
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{textAlign:"center",marginBottom:52}}>
        <div style={{fontSize:52,fontWeight:800,color:"#fff",letterSpacing:"-0.03em",lineHeight:1}}>
          FLOW<span style={{color:"#ef4444"}}>TRACE</span>
        </div>
        <div style={{fontSize:13,color:"#374151",marginTop:12,letterSpacing:"0.04em"}}>
          Money Muling Detection · Graph-Based Financial Crime Engine
        </div>
      </div>

      <div style={{width:"100%",maxWidth:460}}>
        {/* Drop zone */}
        <div
          onDragOver={e=>{e.preventDefault();setDrag(true);}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f&&f.name.endsWith(".csv"))setFile(f);else setError("Please upload a .csv file");}}
          onClick={()=>inputRef.current?.click()}
          style={{
            border:`1.5px dashed ${drag?"#ef4444":file?"rgba(239,68,68,0.35)":"rgba(255,255,255,0.08)"}`,
            borderRadius:12,padding:"36px 28px",textAlign:"center",cursor:"pointer",
            background:drag?"rgba(239,68,68,0.04)":"rgba(255,255,255,0.02)",transition:"border-color 0.15s"
          }}>
          <input ref={inputRef} type="file" accept=".csv" style={{display:"none"}}
            onChange={e=>{setFile(e.target.files[0]);setError(null);}} />

          <div style={{width:48,height:48,borderRadius:10,margin:"0 auto 16px",fontSize:22,
            background:file?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.03)",
            border:`1px solid ${file?"rgba(239,68,68,0.25)":"rgba(255,255,255,0.07)"}`,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {file ? "📄" : "📂"}
          </div>

          {file ? (
            <>
              <div style={{fontWeight:600,fontSize:13,color:"#ef4444"}}>{file.name}</div>
              <div style={{fontSize:11,color:"#374151",marginTop:4}}>{(file.size/1024).toFixed(1)} KB · CSV ready</div>
            </>
          ) : (
            <>
              <div style={{fontSize:13,color:"#6b7280",fontWeight:500}}>Drop transaction CSV here</div>
              <div style={{fontSize:11,color:"#374151",marginTop:4}}>
                Columns: transaction_id, sender_id, receiver_id, amount, timestamp
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{marginTop:10,padding:"10px 14px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,fontSize:11,color:"#f87171",lineHeight:1.6}}>
            ⚠ {error}
          </div>
        )}

        {/* Button */}
        <button onClick={handleAnalyze} disabled={!file||loading} style={{
          marginTop:12,width:"100%",padding:"13px 24px",borderRadius:8,border:"none",
          background:(!file||loading)?"#111113":"#ef4444",
          color:(!file||loading)?"#2d2d31":"#fff",
          fontSize:13,fontWeight:600,cursor:(!file||loading)?"not-allowed":"pointer",
          letterSpacing:"0.05em",transition:"all 0.15s",
          boxShadow:(!file||loading)?"none":"0 0 28px rgba(239,68,68,0.28)",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8
        }}>
          {loading ? (
            <>
              <span style={{width:13,height:13,border:"2px solid rgba(255,255,255,0.2)",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.8s linear infinite"}} />
              Analyzing Transactions...
            </>
          ) : "Analyze Transactions"}
        </button>

        {!file && <p style={{textAlign:"center",color:"#2d2d31",fontSize:11,marginTop:10}}>Upload a CSV file to begin</p>}

        {/* API endpoint hint */}
        <p style={{textAlign:"center",color:"#1f2937",fontSize:10,marginTop:16,fontFamily:"monospace"}}>
          POST {API_BASE}/analyze
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label:"Dashboard", icon:"⊞" },
  { label:"Graph View", icon:"⬡", active:true },
  { label:"Rings",      icon:"◎" },
  { label:"Accounts",   icon:"☰" },
  { label:"Settings",   icon:"◷" },
];

// Unique pattern types across all rings
function uniquePatternTypes(rings) {
  const s = new Set();
  rings.forEach(r => { if (r.pattern) r.pattern.split("_").slice(0,2).forEach(p=>s.add(p)); });
  return [...s].filter(p=>p.length>2);
}

function Dashboard({ data, rawJson, onReset }) {
  const [filters, setFilters] = useState({ onlySuspicious:false, ring:null, minScore:0, patterns:[] });
  const [tab, setTab]         = useState("rings");
  const [ringSearch, setRingSearch] = useState("");

  const upd    = (k,v) => setFilters(f=>({...f,[k]:v}));
  const togPat = p => setFilters(f=>({...f,patterns:f.patterns.includes(p)?f.patterns.filter(x=>x!==p):[...f.patterns,p]}));

  const download = () => {
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(rawJson,null,2)],{type:"application/json"}));
    a.download="fraud_report.json"; a.click();
  };

  const sorted   = [...data.nodes].sort((a,b)=>b.suspicion_score-a.suspicion_score);
  const suspicious = data.nodes.filter(n=>n.suspicion_score>0);
  const highRisk   = data.nodes.filter(n=>n.suspicion_score>=0.6).length;
  const avgSc      = suspicious.length
    ? (suspicious.reduce((s,n)=>s+n.suspicion_score,0)/suspicious.length*100).toFixed(0)
    : 0;
  const maxRisk    = Math.max(...data.rings.map(r=>r.risk_score), 0);

  const allPatterns = [...new Set(data.nodes.flatMap(n=>n.patterns.map(p=>{
    if(p.includes("cycle")) return "cycle";
    if(p.includes("smurf")) return "smurfing";
    if(p.includes("shell")||p.includes("layer")) return "shell";
    return p;
  })))];

  const filteredRings = data.rings.filter(r =>
    !ringSearch || r.ring_id.toLowerCase().includes(ringSearch.toLowerCase()) || r.pattern.toLowerCase().includes(ringSearch.toLowerCase())
  );

  const summary = data.summary;

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#0a0a0d",fontFamily:"ui-sans-serif,system-ui,sans-serif",color:"#e5e7eb",overflow:"hidden"}}>
      <style>{`
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:#374151}
      `}</style>

      {/* Topbar */}
      <header style={{height:46,flexShrink:0,background:"#0a0a0d",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#374151"}}>
          <span style={{color:"#4b5563"}}>⊞</span>
          <span style={{color:"#1f2937"}}>›</span>
          <span style={{color:"#6b7280"}}>Graph View</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {summary.processing_time_seconds !== undefined && (
            <span style={{fontSize:10,color:"#374151",fontFamily:"monospace",marginRight:4}}>
              ⚡ {summary.processing_time_seconds}s
            </span>
          )}
          <button onClick={download} style={{padding:"5px 14px",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,background:"transparent",color:"#6b7280",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            ↓ Download JSON
          </button>
        </div>
      </header>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <aside style={{width:216,flexShrink:0,background:"#080809",borderRight:"1px solid rgba(255,255,255,0.05)",display:"flex",flexDirection:"column",padding:"18px 0"}}>
          <div style={{padding:"0 18px 20px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#fff",letterSpacing:"-0.01em"}}>
              FLOW<span style={{color:"#ef4444"}}>TRACE</span>
            </div>
            <div style={{fontSize:9,color:"#374151",marginTop:2,letterSpacing:"0.1em",textTransform:"uppercase"}}>Money Muling Detection</div>
          </div>

          <div style={{padding:"14px 14px 6px"}}>
            <button onClick={onReset} style={{width:"100%",background:"#ef4444",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,padding:"8px 12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 0 16px rgba(239,68,68,0.18)"}}>
              <span>New Analysis</span><span style={{fontSize:18,lineHeight:1}}>+</span>
            </button>
          </div>

          <nav style={{padding:"6px 0",flex:1}}>
            {NAV_ITEMS.map(n=>(
              <div key={n.label} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 18px",cursor:"pointer",borderLeft:n.active?"2px solid #ef4444":"2px solid transparent",background:n.active?"rgba(239,68,68,0.07)":"transparent",color:n.active?"#fff":"#4b5563",fontSize:12,fontWeight:n.active?500:400}}>
                <span style={{fontSize:13,opacity:n.active?1:0.7}}>{n.icon}</span>{n.label}
              </div>
            ))}
          </nav>

          {/* Quick stats in sidebar */}
          <div style={{padding:"14px 18px",borderTop:"1px solid rgba(255,255,255,0.05)",gap:8,display:"flex",flexDirection:"column"}}>
            {[
              ["Total Analyzed", summary.total_accounts_analyzed ?? data.nodes.length],
              ["Flagged", summary.suspicious_accounts_flagged ?? suspicious.length],
              ["Rings Found", summary.fraud_rings_detected ?? data.rings.length],
            ].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:10,color:"#374151"}}>{l}</span>
                <span style={{fontSize:12,fontWeight:700,color:"#d1d5db"}}>{v}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

          {/* Metric strip */}
          <div style={{display:"flex",gap:10,padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
            <MetricCard
              label="Accounts Analyzed"
              value={summary.total_accounts_analyzed ?? data.nodes.length}
              sub={`${data.edges.length} transactions mapped`}
              trend={`${((suspicious.length/(data.nodes.length||1))*100).toFixed(0)}% flagged`}
              trendUp={true}
              chart={[3,5,4,7,6,8,5,9,7,10,8,12]}
            />
            <MetricCard
              label="High Risk Accounts"
              value={highRisk}
              sub={`score ≥ 60 / 100`}
              trend={`${((highRisk/(data.nodes.length||1))*100).toFixed(0)}% of total`}
              trendUp={true}
              chart={[1,2,1,3,2,4,3,5,4,6,5,7]}
            />
            <MetricCard
              label="Fraud Rings Detected"
              value={summary.fraud_rings_detected ?? data.rings.length}
              sub={`across ${allPatterns.join(", ")||"multiple"} patterns`}
              gauge={Math.min((data.rings.length)/40,1)}
              gaugeColor="#ef4444"
            />
            <MetricCard
              label="Max Ring Risk"
              value={`${(maxRisk*100).toFixed(0)}%`}
              sub={`avg suspicion ${avgSc}/100`}
              gauge={maxRisk}
              gaugeColor={maxRisk>0.9?"#ef4444":maxRisk>0.7?"#f97316":"#22c55e"}
            />
          </div>

          <div style={{display:"flex",flex:1,overflow:"hidden"}}>
            {/* Filter sidebar */}
            <aside style={{width:192,flexShrink:0,background:"#0c0c0f",borderRight:"1px solid rgba(255,255,255,0.04)",padding:16,display:"flex",flexDirection:"column",gap:18,overflowY:"auto"}}>
              <div style={{fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:"0.15em"}}>Filters</div>

              <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
                <div onClick={()=>upd("onlySuspicious",!filters.onlySuspicious)} style={{width:30,height:16,borderRadius:8,position:"relative",cursor:"pointer",flexShrink:0,transition:"background 0.2s",background:filters.onlySuspicious?"#ef4444":"#1a1a1e",border:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{position:"absolute",top:2,left:filters.onlySuspicious?12:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}} />
                </div>
                <span style={{fontSize:11,color:filters.onlySuspicious?"#d1d5db":"#4b5563"}}>Only suspicious</span>
              </label>

              <div>
                <div style={{fontSize:10,color:"#4b5563",marginBottom:7}}>Min score <span style={{color:"#ef4444",fontWeight:600}}>{(filters.minScore*100).toFixed(0)}/100</span></div>
                <input type="range" min="0" max="1" step="0.05" value={filters.minScore}
                  onChange={e=>upd("minScore",parseFloat(e.target.value))}
                  style={{width:"100%",accentColor:"#ef4444"}} />
              </div>

              {/* Ring filter — show first 12 rings */}
              <div>
                <div style={{fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:10}}>Ring</div>
                <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}} onClick={()=>upd("ring",null)}>
                  <div style={{width:13,height:13,borderRadius:"50%",flexShrink:0,border:`1.5px solid ${!filters.ring?"#ef4444":"#1f2937"}`,background:!filters.ring?"rgba(239,68,68,0.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {!filters.ring && <div style={{width:5,height:5,borderRadius:"50%",background:"#ef4444"}} />}
                  </div>
                  <span style={{fontSize:11,color:"#6b7280"}}>All rings</span>
                </label>
                {data.rings.slice(0,10).map(r=>{
                  const col=data.ringColorMap[r.ring_id]||"#6b7280";
                  return (
                    <label key={r.ring_id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,cursor:"pointer"}} onClick={()=>upd("ring",r.ring_id)}>
                      <div style={{width:13,height:13,borderRadius:"50%",flexShrink:0,border:`1.5px solid ${filters.ring===r.ring_id?col:"#1f2937"}`,background:filters.ring===r.ring_id?col+"22":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {filters.ring===r.ring_id&&<div style={{width:5,height:5,borderRadius:"50%",background:col}} />}
                      </div>
                      <span style={{fontSize:10,color:filters.ring===r.ring_id?col:"#4b5563",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.ring_id}</span>
                    </label>
                  );
                })}
                {data.rings.length>10&&<div style={{fontSize:10,color:"#2d2d31",marginTop:4}}>+{data.rings.length-10} more in table</div>}
              </div>

              {/* Pattern filter */}
              <div>
                <div style={{fontSize:9,color:"#374151",textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:10}}>Patterns</div>
                {["cycle","smurfing","shell"].map(p=>(
                  <label key={p} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}} onClick={()=>togPat(p)}>
                    <div style={{width:13,height:13,borderRadius:3,flexShrink:0,border:`1.5px solid ${filters.patterns.includes(p)?patternColor(p):"#1f2937"}`,background:filters.patterns.includes(p)?patternColor(p)+"18":"transparent"}} />
                    <span style={{fontSize:11,color:filters.patterns.includes(p)?patternColor(p):"#4b5563"}}>{p}</span>
                  </label>
                ))}
              </div>

              <button onClick={()=>setFilters({onlySuspicious:false,ring:null,minScore:0,patterns:[]})} style={{padding:"6px 10px",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"transparent",color:"#374151",fontSize:10,cursor:"pointer",marginTop:"auto"}}>
                Reset filters
              </button>
            </aside>

            {/* Graph + tables */}
            <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
              <div style={{flex:1,position:"relative",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <GraphCanvas data={data} filters={filters} />
              </div>

              {/* Tables */}
              <div style={{height:272,display:"flex",flexDirection:"column",background:"#0a0a0d"}}>
                <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0,gap:0}}>
                  {[["rings",`Fraud Rings (${data.rings.length})`],["accounts",`Suspicious Accounts (${suspicious.length})`]].map(([k,l])=>(
                    <button key={k} onClick={()=>setTab(k)} style={{padding:"9px 20px",border:"none",background:"transparent",cursor:"pointer",fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em",color:tab===k?"#e5e7eb":"#374151",borderBottom:tab===k?"1.5px solid #ef4444":"1.5px solid transparent",fontWeight:tab===k?600:400}}>
                      {l}
                    </button>
                  ))}
                  {tab==="rings"&&(
                    <div style={{marginLeft:"auto",marginRight:12}}>
                      <input
                        value={ringSearch}
                        onChange={e=>setRingSearch(e.target.value)}
                        placeholder="Search rings…"
                        style={{background:"#111113",border:"1px solid rgba(255,255,255,0.06)",borderRadius:5,padding:"4px 10px",fontSize:10,color:"#9ca3af",outline:"none",width:130}}
                      />
                    </div>
                  )}
                </div>

                <div style={{flex:1,overflowY:"auto"}}>
                  {tab==="rings"&&(
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead style={{position:"sticky",top:0,background:"#0a0a0d"}}>
                        <tr>
                          {["Ring ID","Pattern","Members","Risk Score","Accounts"].map(h=>(
                            <th key={h} style={{padding:"7px 16px",textAlign:"left",fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",color:"#374151",fontWeight:500,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRings.map(ring=>{
                          const col=data.ringColorMap[ring.ring_id]||"#6b7280";
                          return (
                            <tr key={ring.ring_id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                              <td style={{padding:"8px 16px"}}>
                                <span style={{display:"flex",alignItems:"center",gap:7,color:col,fontWeight:600,fontSize:11}}>
                                  <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"block",flexShrink:0}} />
                                  {ring.ring_id}
                                </span>
                              </td>
                              <td style={{padding:"8px 16px"}}>
                                <span style={{padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:500,color:patternColor(ring.pattern),background:patternColor(ring.pattern)+"12",border:`1px solid ${patternColor(ring.pattern)}28`}}>
                                  {ring.pattern}
                                </span>
                              </td>
                              <td style={{padding:"8px 16px",color:"#6b7280",fontSize:12}}>{ring.members.length}</td>
                              <td style={{padding:"8px 16px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:7}}>
                                  <div style={{width:60,height:3,borderRadius:2,background:"#1a1a1e",overflow:"hidden"}}>
                                    <div style={{height:"100%",borderRadius:2,width:`${ring.risk_score*100}%`,background:col}} />
                                  </div>
                                  <span style={{color:col,fontWeight:600,fontSize:11}}>{(ring.risk_score*100).toFixed(1)}%</span>
                                </div>
                              </td>
                              <td style={{padding:"8px 16px",maxWidth:260}}>
                                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                  {ring.members.slice(0,6).map(m=>(
                                    <span key={m} style={{padding:"1px 5px",borderRadius:3,fontSize:9,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",color:"#4b5563"}}>{m}</span>
                                  ))}
                                  {ring.members.length>6&&<span style={{fontSize:9,color:"#2d2d31",padding:"1px 5px"}}>+{ring.members.length-6}</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {tab==="accounts"&&(
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead style={{position:"sticky",top:0,background:"#0a0a0d"}}>
                        <tr>
                          {["Account ID","Score","Patterns","Ring","Sent","Received"].map(h=>(
                            <th key={h} style={{padding:"7px 16px",textAlign:"left",fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",color:"#374151",fontWeight:500,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.filter(n=>n.suspicion_score>0).map(n=>{
                          const sc=n.suspicion_score;
                          const col=sc>=0.6?"#ef4444":sc>=0.3?"#f97316":"#6b7280";
                          const ringCol=n.ring_id?(data.ringColorMap[n.ring_id]||"#6b7280"):null;
                          return (
                            <tr key={n.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                              <td style={{padding:"8px 16px",color:"#d1d5db",fontWeight:500,fontSize:11}}>{n.id}</td>
                              <td style={{padding:"8px 16px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:7}}>
                                  <div style={{width:48,height:3,borderRadius:2,background:"#1a1a1e",overflow:"hidden"}}>
                                    <div style={{height:"100%",borderRadius:2,width:`${sc*100}%`,background:col}} />
                                  </div>
                                  <span style={{color:col,fontWeight:700,fontSize:11}}>{(sc*100).toFixed(0)}</span>
                                </div>
                              </td>
                              <td style={{padding:"8px 16px"}}>
                                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                  {n.patterns.slice(0,2).map(p=>(
                                    <span key={p} style={{padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:500,color:patternColor(p),background:patternColor(p)+"12",border:`1px solid ${patternColor(p)}28`}}>{p}</span>
                                  ))}
                                  {n.patterns.length>2&&<span style={{fontSize:9,color:"#374151"}}>+{n.patterns.length-2}</span>}
                                </div>
                              </td>
                              <td style={{padding:"8px 16px"}}>
                                {n.ring_id?<span style={{padding:"1px 7px",borderRadius:3,fontSize:9,fontWeight:600,color:ringCol,background:ringCol+"12",border:`1px solid ${ringCol}28`}}>{n.ring_id}</span>:<span style={{color:"#2d2d31"}}>—</span>}
                              </td>
                              <td style={{padding:"8px 16px",color:"#4b5563",fontSize:11}}>${(n.totalSent||0).toLocaleString()}</td>
                              <td style={{padding:"8px 16px",color:"#4b5563",fontSize:11}}>${(n.totalReceived||0).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [result, setResult] = useState(null);   // { data, rawJson }

  const handleAnalyze = (data, rawJson) => setResult({ data, rawJson });
  const handleReset   = () => setResult(null);

  if (!result) return <UploadScreen onAnalyze={handleAnalyze} />;
  return <Dashboard data={result.data} rawJson={result.rawJson} onReset={handleReset} />;
}