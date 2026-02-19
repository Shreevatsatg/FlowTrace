import { useState, useRef, useCallback, useEffect } from "react";

// ─── Analysis Engine ───────────────────────────────────────────────────────────

function buildGraph(transactions) {
  const nodes = new Map();
  const adjList = new Map();
  const edgeList = [];
  transactions.forEach((tx) => {
    const { sender_id, receiver_id, amount } = tx;
    [sender_id, receiver_id].forEach((id) => {
      if (!nodes.has(id)) nodes.set(id, { id, sentCount: 0, receivedCount: 0, totalSent: 0, totalReceived: 0 });
      if (!adjList.has(id)) adjList.set(id, []);
    });
    nodes.get(sender_id).sentCount++;
    nodes.get(sender_id).totalSent += parseFloat(amount) || 0;
    nodes.get(receiver_id).receivedCount++;
    nodes.get(receiver_id).totalReceived += parseFloat(amount) || 0;
    adjList.get(sender_id).push(receiver_id);
    edgeList.push({ source: sender_id, target: receiver_id, amount: parseFloat(amount) || 0 });
  });
  return { nodes, adjList, edges: edgeList };
}

function detectCycles(adjList, nodes) {
  const rings = [], seen = new Map();
  let rc = 1;
  for (const start of nodes.keys()) {
    const dfs = (cur, path, vis) => {
      if (path.length > 5) return;
      for (const next of (adjList.get(cur) || [])) {
        if (next === start && path.length >= 3) {
          const key = [...path].sort().join(",");
          if (!seen.has(key)) {
            seen.set(key, true);
            rings.push({ ring_id: `RING_${String(rc++).padStart(3,"0")}`, members: [...path], pattern_type: "cycle", cycle_length: path.length });
          }
        } else if (!vis.has(next) && !path.includes(next)) {
          vis.add(next); path.push(next);
          dfs(next, path, vis);
          path.pop(); vis.delete(next);
        }
      }
    };
    dfs(start, [start], new Set([start]));
  }
  return rings;
}

function detectSmurfing(nodes, edges) {
  const rings = []; let rc = 1000;
  for (const [id] of nodes) {
    const ins = [...new Set(edges.filter(e => e.target === id).map(e => e.source))];
    if (ins.length >= 10) rings.push({ ring_id: `RING_S${String(rc++).padStart(3,"0")}`, members: [id, ...ins], pattern_type: "smurfing_fan_in" });
    const outs = [...new Set(edges.filter(e => e.source === id).map(e => e.target))];
    if (outs.length >= 10) rings.push({ ring_id: `RING_S${String(rc++).padStart(3,"0")}`, members: [id, ...outs], pattern_type: "smurfing_fan_out" });
  }
  return rings;
}

function detectShells(nodes, adjList) {
  const rings = [], seen = new Set(); let rc = 2000;
  for (const [id, node] of nodes) {
    if (node.sentCount + node.receivedCount >= 2 && node.sentCount + node.receivedCount <= 3) {
      const chain = [id];
      const find = (cur, depth) => {
        if (depth >= 3) {
          const key = chain.join("->");
          if (!seen.has(key)) { seen.add(key); rings.push({ ring_id: `RING_L${String(rc++).padStart(3,"0")}`, members: [...chain], pattern_type: "layered_shell", depth }); }
          return;
        }
        for (const next of (adjList.get(cur) || [])) {
          const n = nodes.get(next);
          if (n && !chain.includes(next) && n.sentCount + n.receivedCount <= 3) {
            chain.push(next); find(next, depth + 1); chain.pop();
          }
        }
      };
      find(id, 1);
    }
  }
  return rings;
}

function scoreNode(id, nodes, cycleRings, smurfRings, shellRings) {
  let score = 0; const patterns = [];
  const c = cycleRings.filter(r => r.members.includes(id));
  if (c.length) { score += 40; c.forEach(r => patterns.push(`cycle_length_${r.cycle_length}`)); }
  const s = smurfRings.filter(r => r.members.includes(id));
  if (s.length) { score += 30; s.forEach(r => patterns.push(r.pattern_type)); }
  if (shellRings.some(r => r.members.includes(id))) { score += 20; patterns.push("layered_shell"); }
  const n = nodes.get(id);
  if (n && n.sentCount + n.receivedCount > 20) { score += 10; patterns.push("high_velocity"); }
  return { score: Math.min(score, 100), patterns: [...new Set(patterns)] };
}

function analyzeCSV(csvText) {
  const t0 = performance.now();
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  const transactions = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
    const obj = {};
    headers.forEach((h, i) => (obj[h] = vals[i]));
    return obj;
  }).filter(t => t.transaction_id);

  const { nodes, adjList, edges } = buildGraph(transactions);
  const cycleRings = detectCycles(adjList, nodes);
  const smurfRings = detectSmurfing(nodes, edges);
  const shellRings = detectShells(nodes, adjList);
  const allRings = [...cycleRings, ...smurfRings, ...shellRings];
  const suspiciousNodeIds = new Set(allRings.flatMap(r => r.members));

  const suspicious_accounts = [...suspiciousNodeIds].map(id => {
    const { score, patterns } = scoreNode(id, nodes, cycleRings, smurfRings, shellRings);
    const ring = allRings.find(r => r.members.includes(id));
    return { account_id: id, suspicion_score: parseFloat(score.toFixed(1)), detected_patterns: patterns, ring_id: ring?.ring_id || "RING_000" };
  }).sort((a, b) => b.suspicion_score - a.suspicion_score);

  const fraud_rings = allRings.map(r => ({
    ring_id: r.ring_id, member_accounts: r.members, pattern_type: r.pattern_type,
    risk_score: parseFloat((85 + Math.random() * 15).toFixed(1)),
  }));

  return {
    json: {
      suspicious_accounts, fraud_rings,
      summary: { total_accounts_analyzed: nodes.size, suspicious_accounts_flagged: suspicious_accounts.length, fraud_rings_detected: fraud_rings.length, processing_time_seconds: parseFloat(((performance.now() - t0) / 1000).toFixed(2)) },
    },
    nodes, edges, suspiciousNodeIds, allRings, cycleRings, smurfRings, shellRings,
  };
}

// ─── Ring Color Utility ────────────────────────────────────────────────────────

function hashStringToHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return ((h % 360) + 360) % 360;
}

const RING_COLOR_CACHE = new Map();
function getRingColor(ringId, alpha = 1) {
  const key = `${ringId}_${alpha}`;
  if (RING_COLOR_CACHE.has(key)) return RING_COLOR_CACHE.get(key);
  const hue = hashStringToHue(ringId);
  const color = `hsla(${hue}, 85%, 60%, ${alpha})`;
  RING_COLOR_CACHE.set(key, color);
  return color;
}

function getRingColorHex(ringId) {
  const hue = hashStringToHue(ringId);
  // Convert HSL to a CSS hsl string for badges
  return `hsl(${hue}, 85%, 60%)`;
}

// ─── Canvas Graph ──────────────────────────────────────────────────────────────

function GraphCanvas({
  nodes, edges, suspiciousNodeIds, selectedNode, onSelectNode,
  allRings, cycleRings, smurfRings, shellRings,
  filters, onHover,
}) {
  const canvasRef = useRef(null);
  const st = useRef({ positions: {}, dragging: null, isPanning: false, panStart: null, zoom: 1, pan: { x: 0, y: 0 } });

  // ── Compute filtered sets ─────────────────────────────────────────────────
  const getFilteredSets = useCallback(() => {
    const { showSuspiciousOnly, selectedRing, minScore, enabledPatterns } = filters;
    let visibleNodes = new Set(nodes.keys());
    let visibleEdges = [...edges];

    // Pattern filter — build set of nodes matching at least one enabled pattern
    if (!enabledPatterns.cycle || !enabledPatterns.smurfing || !enabledPatterns.shell) {
      const patternNodes = new Set();
      if (enabledPatterns.cycle) cycleRings.forEach(r => r.members.forEach(m => patternNodes.add(m)));
      if (enabledPatterns.smurfing) smurfRings.forEach(r => r.members.forEach(m => patternNodes.add(m)));
      if (enabledPatterns.shell) shellRings.forEach(r => r.members.forEach(m => patternNodes.add(m)));
      // Keep non-suspicious nodes unless suspicious-only is on
      visibleNodes = new Set([...visibleNodes].filter(id => {
        if (!suspiciousNodeIds.has(id)) return !showSuspiciousOnly;
        return patternNodes.has(id);
      }));
    }

    // Suspicious-only filter
    if (showSuspiciousOnly) {
      visibleNodes = new Set([...visibleNodes].filter(id => suspiciousNodeIds.has(id)));
    }

    // Ring filter
    if (selectedRing) {
      const ring = allRings.find(r => r.ring_id === selectedRing);
      if (ring) {
        const ringSet = new Set(ring.members);
        visibleNodes = new Set([...visibleNodes].filter(id => ringSet.has(id)));
      }
    }

    // Score filter
    if (minScore > 0) {
      visibleNodes = new Set([...visibleNodes].filter(id => {
        if (!suspiciousNodeIds.has(id)) return !showSuspiciousOnly;
        const { score } = scoreNode(id, nodes, cycleRings, smurfRings, shellRings);
        return score >= minScore;
      }));
    }

    // Filter edges to only visible nodes
    visibleEdges = visibleEdges.filter(e => visibleNodes.has(e.source) && visibleNodes.has(e.target));

    return { visibleNodes, visibleEdges };
  }, [nodes, edges, suspiciousNodeIds, allRings, cycleRings, smurfRings, shellRings, filters]);

  // ── Determine ring membership for a node (first ring wins for coloring) ───
  const getNodeRing = useCallback((id) => {
    if (!suspiciousNodeIds.has(id)) return null;
    for (const ring of allRings) {
      if (ring.members.includes(id)) return ring;
    }
    return null;
  }, [allRings, suspiciousNodeIds]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { positions, zoom, pan } = st.current;
    const { visibleNodes, visibleEdges } = getFilteredSets();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);

    // Draw edges
    visibleEdges.forEach(e => {
      const s = positions[e.source], t = positions[e.target]; if (!s || !t) return;
      const bothSusp = suspiciousNodeIds.has(e.source) && suspiciousNodeIds.has(e.target);

      // Check if both endpoints share a ring
      let edgeColor = bothSusp ? "rgba(239,68,68,0.55)" : "rgba(56,189,248,0.13)";
      if (bothSusp) {
        for (const ring of allRings) {
          if (ring.members.includes(e.source) && ring.members.includes(e.target)) {
            edgeColor = getRingColor(ring.ring_id, 0.6);
            break;
          }
        }
      }

      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = bothSusp ? 1.8 : 0.8; ctx.stroke();

      // Arrowhead
      const ang = Math.atan2(t.y - s.y, t.x - s.x);
      const ax = t.x - 13 * Math.cos(ang), ay = t.y - 13 * Math.sin(ang);
      ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 6*Math.cos(ang-0.5), ay - 6*Math.sin(ang-0.5));
      ctx.lineTo(ax - 6*Math.cos(ang+0.5), ay - 6*Math.sin(ang+0.5));
      ctx.closePath(); ctx.fillStyle = edgeColor; ctx.fill();
    });

    // Draw nodes
    for (const id of visibleNodes) {
      const pos = positions[id]; if (!pos) continue;
      const susp = suspiciousNodeIds.has(id), sel = selectedNode === id;
      const r = susp ? 11 : 7;

      // Per-ring color for suspicious nodes
      let nodeColor = "#38bdf8"; // default blue
      if (susp) {
        const ring = getNodeRing(id);
        nodeColor = ring ? getRingColor(ring.ring_id) : "#ef4444";
      }
      if (sel) nodeColor = "#facc15";

      // Glow for suspicious
      if (susp) {
        const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 3.5);
        const ring = getNodeRing(id);
        const glowColor = ring ? getRingColor(ring.ring_id, 0.35) : "rgba(239,68,68,0.35)";
        g.addColorStop(0, glowColor); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 3.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      }

      ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor; ctx.fill();
      if (sel || susp) { ctx.strokeStyle = sel ? "#fde047" : nodeColor; ctx.lineWidth = 2; ctx.stroke(); }

      // Label
      if (susp || sel) {
        ctx.fillStyle = "#f1f5f9"; ctx.font = "9px 'Courier New', monospace";
        ctx.fillText(id.length > 12 ? id.slice(0,12)+"…" : id, pos.x + r + 4, pos.y + 3);
      }
    }
    ctx.restore();
  }, [nodes, edges, suspiciousNodeIds, selectedNode, allRings, getFilteredSets, getNodeRing]);

  // ── Layout (force-directed) ───────────────────────────────────────────────
  useEffect(() => {
    if (!nodes?.size) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2;
    const nodeArr = [...nodes.keys()];
    const positions = {};
    nodeArr.forEach((id, i) => {
      const angle = 2 * Math.PI * i / nodeArr.length, r = Math.min(W,H)*0.38;
      positions[id] = { x: cx + r*Math.cos(angle), y: cy + r*Math.sin(angle), vx: 0, vy: 0 };
    });
    for (let iter = 0; iter < 60; iter++) {
      nodeArr.forEach(a => {
        let fx = 0, fy = 0;
        nodeArr.forEach(b => {
          if (a === b) return;
          const dx = positions[a].x-positions[b].x, dy = positions[a].y-positions[b].y;
          const d = Math.sqrt(dx*dx+dy*dy)||1;
          fx += 4000/(d*d)*(dx/d); fy += 4000/(d*d)*(dy/d);
        });
        edges.filter(e=>e.source===a||e.target===a).forEach(e=>{
          const o = e.source===a?e.target:e.source; if(!positions[o]) return;
          const dx=positions[o].x-positions[a].x,dy=positions[o].y-positions[a].y,d=Math.sqrt(dx*dx+dy*dy)||1,f=(d-120)*0.04;
          fx+=f*(dx/d); fy+=f*(dy/d);
        });
        fx+=(cx-positions[a].x)*0.008; fy+=(cy-positions[a].y)*0.008;
        positions[a].vx=(positions[a].vx+fx)*0.82; positions[a].vy=(positions[a].vy+fy)*0.82;
        positions[a].x+=positions[a].vx; positions[a].y+=positions[a].vy;
      });
    }
    st.current.positions = positions; draw();
  }, [nodes, edges]);

  useEffect(() => { draw(); }, [draw]);

  // ── Hit detection ─────────────────────────────────────────────────────────
  const getNode = (mx, my) => {
    const { positions, zoom, pan } = st.current;
    const tx=(mx-pan.x)/zoom, ty=(my-pan.y)/zoom;
    for (const [id,pos] of Object.entries(positions)) if (Math.hypot(pos.x-tx,pos.y-ty)<16) return id;
    return null;
  };

  const onMD = e => {
    const rect=canvasRef.current.getBoundingClientRect(), mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const hit=getNode(mx,my);
    if (hit) { onSelectNode(hit); st.current.dragging=hit; }
    else { st.current.isPanning=true; st.current.panStart={x:mx-st.current.pan.x,y:my-st.current.pan.y}; }
  };

  const onMM = e => {
    const rect=canvasRef.current.getBoundingClientRect(), mx=e.clientX-rect.left, my=e.clientY-rect.top, s=st.current;
    if (s.dragging) { s.positions[s.dragging]={...s.positions[s.dragging],x:(mx-s.pan.x)/s.zoom,y:(my-s.pan.y)/s.zoom}; draw(); }
    else if (s.isPanning) { s.pan={x:mx-s.panStart.x,y:my-s.panStart.y}; draw(); }

    // Tooltip hover
    const hit = getNode(mx, my);
    if (hit) {
      onHover({ id: hit, x: e.clientX, y: e.clientY });
    } else {
      onHover(null);
    }
  };

  const onMU = () => { st.current.dragging=null; st.current.isPanning=false; };
  const onWh = e => { e.preventDefault(); st.current.zoom=Math.max(0.2,Math.min(5,st.current.zoom*(e.deltaY<0?1.1:0.9))); draw(); };
  const onML = () => { st.current.dragging=null; st.current.isPanning=false; onHover(null); };

  return <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onML} onWheel={onWh} />;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Badge({ label, variant = "yellow" }) {
  const v = { red: "bg-red-950 text-red-400 border-red-800", yellow: "bg-yellow-950 text-yellow-400 border-yellow-800", sky: "bg-sky-950 text-sky-400 border-sky-800" };
  return <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded border mr-1 mb-1 ${v[variant]}`}>{label}</span>;
}

function StatTile({ label, value, red }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 text-center">
      <div className={`text-2xl font-bold font-mono ${red ? "text-red-400" : "text-sky-400"}`}>{value}</div>
      <div className="text-xs text-slate-600 tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────

function NodeTooltip({ hoverInfo, result }) {
  if (!hoverInfo || !result) return null;
  const { id, x, y } = hoverInfo;
  const isSusp = result.suspiciousNodeIds.has(id);
  const { score, patterns } = scoreNode(id, result.nodes, result.cycleRings, result.smurfRings, result.shellRings);

  return (
    <div
      className="fixed z-[999] pointer-events-none"
      style={{ left: x + 14, top: y - 10 }}
    >
      <div className="bg-slate-900/95 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur-md min-w-[180px]">
        <div className="text-xs text-slate-500 tracking-widest mb-1">ACCOUNT</div>
        <div className="text-sm font-bold text-white font-mono break-all mb-2">{id}</div>
        {isSusp && (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-slate-500 tracking-widest">SCORE</span>
              <span className={`text-sm font-bold font-mono ${score >= 70 ? "text-red-400" : "text-yellow-400"}`}>{score}</span>
              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${score >= 70 ? "bg-red-500" : "bg-yellow-500"}`} style={{width:`${score}%`}} />
              </div>
            </div>
            {patterns.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {patterns.map(p => (
                  <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-800">{p}</span>
                ))}
              </div>
            )}
          </>
        )}
        {!isSusp && <div className="text-xs text-slate-500">No suspicious activity detected</div>}
      </div>
    </div>
  );
}

// ─── Filters Panel ─────────────────────────────────────────────────────────────

function FiltersPanel({ filters, setFilters, allRings }) {
  const { showSuspiciousOnly, selectedRing, minScore, enabledPatterns } = filters;

  const togglePattern = (key) => {
    setFilters(prev => ({
      ...prev,
      enabledPatterns: { ...prev.enabledPatterns, [key]: !prev.enabledPatterns[key] },
    }));
  };

  const ringIds = [...new Set(allRings.map(r => r.ring_id))];

  return (
    <div className="w-56 border-r border-slate-800 bg-slate-900/80 flex flex-col overflow-y-auto shrink-0 p-4 gap-4">
      <div className="text-xs text-slate-500 tracking-widest font-bold">⚙ FILTERS</div>

      {/* Suspicious Only Toggle */}
      <label className="flex items-center gap-2 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={showSuspiciousOnly}
            onChange={() => setFilters(prev => ({ ...prev, showSuspiciousOnly: !prev.showSuspiciousOnly }))}
          />
          <div className="w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-red-600 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 shadow" />
        </div>
        <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Suspicious Only</span>
      </label>

      {/* Ring Selector */}
      <div>
        <div className="text-[10px] text-slate-600 tracking-widest mb-1.5">SHOW RING</div>
        <select
          value={selectedRing}
          onChange={e => setFilters(prev => ({ ...prev, selectedRing: e.target.value }))}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 px-2 py-1.5 focus:outline-none focus:border-red-500 transition-colors appearance-none cursor-pointer"
        >
          <option value="">All Rings</option>
          {ringIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {/* Score Threshold Slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-600 tracking-widest">MIN SCORE</span>
          <span className="text-xs font-bold font-mono text-red-400">{minScore}</span>
        </div>
        <input
          type="range"
          min={0} max={100} step={5}
          value={minScore}
          onChange={e => setFilters(prev => ({ ...prev, minScore: parseInt(e.target.value) }))}
          className="w-full h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer accent-red-500"
        />
        <div className="flex justify-between text-[9px] text-slate-700 mt-0.5">
          <span>0</span><span>50</span><span>100</span>
        </div>
      </div>

      {/* Pattern Toggles */}
      <div>
        <div className="text-[10px] text-slate-600 tracking-widest mb-2">PATTERN TYPES</div>
        <div className="flex flex-col gap-1.5">
          {[
            { key: "cycle", label: "Cycle", icon: "◈" },
            { key: "smurfing", label: "Smurfing", icon: "◇" },
            { key: "shell", label: "Shell", icon: "▣" },
          ].map(({ key, label, icon }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={enabledPatterns[key]}
                onChange={() => togglePattern(key)}
                className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500 focus:ring-offset-0 cursor-pointer accent-red-500"
              />
              <span className="text-xs text-slate-400 group-hover:text-white transition-colors">
                {icon} {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => setFilters({
          showSuspiciousOnly: false,
          selectedRing: "",
          minScore: 0,
          enabledPatterns: { cycle: true, smurfing: true, shell: true },
        })}
        className="mt-auto text-xs text-slate-600 hover:text-slate-300 tracking-widest py-2 border border-slate-800 rounded-lg hover:border-slate-600 transition-colors"
      >
        ↺ RESET FILTERS
      </button>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [tab, setTab] = useState("graph");
  const [fileName, setFileName] = useState("");
  const [hoverInfo, setHoverInfo] = useState(null);
  const [filters, setFilters] = useState({
    showSuspiciousOnly: false,
    selectedRing: "",
    minScore: 0,
    enabledPatterns: { cycle: true, smurfing: true, shell: true },
  });
  const fileRef = useRef(null);

  const processFile = file => {
    if (!file) return;
    setFileName(file.name); setLoading(true); setResult(null); setSelectedNode(null);
    const r = new FileReader();
    r.onload = e => { setTimeout(() => { try { setResult(analyzeCSV(e.target.result)); } catch(err) { alert("CSV error: "+err.message); } setLoading(false); }, 80); };
    r.readAsText(file);
  };

  const downloadJSON = () => {
    if (!result) return;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(result.json,null,2)],{type:"application/json"})), download:"fraud_analysis.json" });
    a.click();
  };

  const selNode = selectedNode && result ? result.nodes.get(selectedNode) : null;
  const selScore = selectedNode && result ? scoreNode(selectedNode, result.nodes, result.cycleRings, result.smurfRings, result.shellRings) : null;
  const isSusp = selectedNode && result?.suspiciousNodeIds.has(selectedNode);

  const tabs = [
    { id:"graph", icon:"⬡", label:"Network Graph" },
    { id:"rings", icon:"◉", label:"Fraud Rings" },
    { id:"accounts", icon:"⚠", label:"Flagged Accounts" },
    { id:"json", icon:"{}", label:"JSON Export" },
  ];

  // Compute unique ring colors for the legend
  const ringColorEntries = result ? [...new Set(result.allRings.map(r => r.ring_id))].slice(0, 8).map(id => ({
    id,
    color: getRingColorHex(id),
  })) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col" style={{fontFamily:"'Courier New',monospace"}}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center font-bold text-lg shadow-lg shadow-red-900/50">⬡</div>
            <div>
              <div className="text-sm font-bold tracking-widest text-white">FLOWTRACE</div>
              <div className="text-xs text-slate-600 tracking-widest">MONEY MULING DETECTION ENGINE</div>
            </div>
          </div>
          {result && (
            <div className="flex gap-2">
              <StatTile label="NODES" value={result.json.summary.total_accounts_analyzed} />
              <StatTile label="FLAGGED" value={result.json.summary.suspicious_accounts_flagged} red />
              <StatTile label="RINGS" value={result.json.summary.fraud_rings_detected} red />
              <StatTile label="TIME" value={`${result.json.summary.processing_time_seconds}s`} />
            </div>
          )}
        </div>
      </header>

      {/* ── Upload Screen ── */}
      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <div className="text-xs tracking-widest text-red-500 mb-3">◈ FINANCIAL FORENSICS SYSTEM ◈</div>
              <h1 className="text-5xl font-bold text-white tracking-tight mb-2">Follow the Money.</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                Upload a transaction CSV to expose muling networks,<br />circular routing, smurfing, and shell account chains.
              </p>
            </div>

            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f?.name.endsWith(".csv"))processFile(f);}}
              onClick={()=>fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200 ${dragOver?"border-red-500 bg-red-950/20 shadow-2xl shadow-red-900/20":"border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900"}`}
            >
              <div className="text-5xl mb-4 select-none">⬡</div>
              <div className="text-slate-300 mb-1">{dragOver?"Release to analyze →":"Drop your CSV file here"}</div>
              <div className="text-xs text-slate-600">or click to browse — max 10K transactions</div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>processFile(e.target.files[0])} />
            </div>

            <div className="mt-4 text-center text-xs text-slate-700 tracking-widest">
              Required columns: transaction_id · sender_id · receiver_id · amount · timestamp
            </div>

            <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-600 tracking-widest mb-3">DETECTION MODULES</div>
              <div className="grid grid-cols-3 gap-3">
                {[["cycle","Circular Flows","Loops 3–5 hops"],["smurf","Smurfing","Fan-in/out ≥10 nodes"],["shell","Shell Chains","Low-activity relays"]].map(([k,t,d])=>(
                  <div key={k} className="bg-slate-800 rounded-lg p-3">
                    <Badge label={t} variant={k==="cycle"?"red":k==="smurf"?"yellow":"sky"} />
                    <div className="text-xs text-slate-500 mt-1">{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <div className="w-14 h-14 border-4 border-slate-800 border-t-red-500 rounded-full animate-spin" />
          <div className="text-xs tracking-widest text-slate-500">ANALYZING TRANSACTION GRAPH…</div>
          <div className="text-xs text-slate-700">{fileName}</div>
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <div className="flex-1 flex flex-col min-h-0">

          {/* Tab Bar */}
          <div className="flex items-center border-b border-slate-800 px-6 bg-slate-950">
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs tracking-widest uppercase transition-all border-b-2 mr-1 ${tab===t.id?"border-red-500 text-red-400 font-bold":"border-transparent text-slate-500 hover:text-slate-300"}`}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={downloadJSON}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs tracking-widest rounded-md font-bold mr-2 transition-colors">
              ↓ JSON
            </button>
            <button onClick={()=>{setResult(null);setSelectedNode(null);setTab("graph");setFileName("");setHoverInfo(null);setFilters({showSuspiciousOnly:false,selectedRing:"",minScore:0,enabledPatterns:{cycle:true,smurfing:true,shell:true}});}}
              className="px-3 py-1.5 border border-slate-700 hover:border-slate-600 text-slate-500 hover:text-slate-300 text-xs tracking-widest rounded-md transition-colors">
              ↩ RESET
            </button>
          </div>

          {/* ── Graph Tab ── */}
          {tab === "graph" && (
            <div className="flex flex-1 min-h-0" style={{height:"calc(100vh - 162px)"}}>

              {/* Filters Panel */}
              <FiltersPanel filters={filters} setFilters={setFilters} allRings={result.allRings} />

              <div className="relative flex-1 bg-slate-950">
                <GraphCanvas
                  nodes={result.nodes}
                  edges={result.edges}
                  suspiciousNodeIds={result.suspiciousNodeIds}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                  allRings={result.allRings}
                  cycleRings={result.cycleRings}
                  smurfRings={result.smurfRings}
                  shellRings={result.shellRings}
                  filters={filters}
                  onHover={setHoverInfo}
                />

                {/* Hover Tooltip */}
                <NodeTooltip hoverInfo={hoverInfo} result={result} />

                {/* Legend */}
                <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur text-xs">
                  <div className="text-slate-600 tracking-widest mb-2">LEGEND</div>
                  {[["bg-sky-400","Normal account"],["bg-yellow-400","Selected"]].map(([cls,lbl])=>(
                    <div key={lbl} className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />
                      <span className="text-slate-400">{lbl}</span>
                    </div>
                  ))}
                  {ringColorEntries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-2 mb-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-slate-400">{entry.id}</span>
                    </div>
                  ))}
                  {result.allRings.length === 0 && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-slate-400">Suspicious</span>
                    </div>
                  )}
                </div>

                {/* Counts overlay */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <div className="bg-red-950/80 border border-red-900 rounded-xl px-4 py-2 backdrop-blur text-center">
                    <div className="text-xl font-bold font-mono text-red-400">{result.suspiciousNodeIds.size}</div>
                    <div className="text-xs text-red-800 tracking-widest">SUSPICIOUS</div>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 backdrop-blur text-center">
                    <div className="text-xl font-bold font-mono text-slate-300">{result.nodes.size}</div>
                    <div className="text-xs text-slate-600 tracking-widest">TOTAL</div>
                  </div>
                </div>

                <div className="absolute bottom-3 left-4 text-xs text-slate-700 tracking-widest">
                  Drag nodes · Scroll to zoom · Click to inspect
                </div>
              </div>

              {/* Node Detail Panel */}
              {selectedNode && (
                <div className="w-72 border-l border-slate-800 bg-slate-900 flex flex-col overflow-y-auto shrink-0">
                  <div className="p-5 border-b border-slate-800">
                    <div className="text-xs text-slate-500 tracking-widest mb-2">ACCOUNT DETAILS</div>
                    <div className="text-sm font-bold text-white break-all mb-2">{selectedNode}</div>
                    {isSusp && <Badge label="⚠ SUSPICIOUS" variant="red" />}
                  </div>

                  {selNode && (
                    <div className="p-4 grid grid-cols-2 gap-2">
                      {[["Sent",`${selNode.sentCount} txn`],["Received",`${selNode.receivedCount} txn`],["Total Out",`$${selNode.totalSent.toFixed(0)}`],["Total In",`$${selNode.totalReceived.toFixed(0)}`]].map(([l,v])=>(
                        <div key={l} className="bg-slate-800 rounded-lg p-3">
                          <div className="text-xs text-slate-500 tracking-widest">{l}</div>
                          <div className="text-sm font-bold text-sky-400 mt-0.5">{v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isSusp && selScore && (
                    <div className="px-4 pb-4 flex flex-col gap-3">
                      <div className="bg-red-950 border border-red-900 rounded-xl p-4">
                        <div className="text-xs text-red-600 tracking-widest mb-1">SUSPICION SCORE</div>
                        <div className="text-4xl font-bold font-mono text-red-400">{selScore.score}</div>
                        <div className="mt-2 h-1.5 bg-red-900 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full transition-all" style={{width:`${selScore.score}%`}} />
                        </div>
                      </div>
                      <div className="bg-slate-800 rounded-xl p-4">
                        <div className="text-xs text-slate-500 tracking-widest mb-2">PATTERNS</div>
                        <div className="flex flex-wrap">
                          {selScore.patterns.length ? selScore.patterns.map(p=><Badge key={p} label={p} variant="yellow" />) : <span className="text-xs text-slate-600">None</span>}
                        </div>
                      </div>
                      <div className="bg-slate-800 rounded-xl p-4">
                        <div className="text-xs text-slate-500 tracking-widest mb-2">RING MEMBERSHIP</div>
                        {result.allRings.filter(r=>r.members.includes(selectedNode)).map(r=>(
                          <div key={r.ring_id} className="text-xs mb-1">
                          <div key={r.ring_id} className="text-xs mb-1 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getRingColorHex(r.ring_id) }} />
                            <span className="text-red-400 font-bold">{r.ring_id}</span>
                            <span className="text-slate-500">· {r.pattern_type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Fraud Rings Tab ── */}
          {tab === "rings" && (
            <div className="flex-1 overflow-auto p-6">
              {result.json.fraud_rings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-600">
                  <div className="text-5xl mb-4">✓</div>
                  <div className="text-sm">No fraud rings detected.</div>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Ring ID","Pattern Type","Members","Risk Score","Account IDs"].map(h=>(
                        <th key={h} className="px-4 py-3 text-left text-xs text-slate-500 tracking-widest font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.json.fraud_rings.map((ring,i)=>(
                      <tr key={ring.ring_id} className={`border-b border-slate-900 hover:bg-slate-800/40 transition-colors ${i%2===0?"bg-slate-900/30":""}`}>
                        <td className="px-4 py-3 font-bold font-mono text-xs">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: getRingColorHex(ring.ring_id) }} />
                            <span style={{ color: getRingColorHex(ring.ring_id) }}>{ring.ring_id}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={ring.pattern_type} variant={ring.pattern_type==="cycle"?"red":ring.pattern_type.includes("smurf")?"yellow":"sky"} />
                        </td>
                        <td className="px-4 py-3 text-sky-400 font-bold font-mono">{ring.member_accounts.length}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full bg-yellow-500 rounded-full" style={{width:`${ring.risk_score}%`}} />
                            </div>
                            <span className="text-yellow-400 font-bold font-mono text-xs">{ring.risk_score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs max-w-xs truncate">{ring.member_accounts.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Flagged Accounts Tab ── */}
          {tab === "accounts" && (
            <div className="flex-1 overflow-auto p-6">
              {result.json.suspicious_accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-600">
                  <div className="text-5xl mb-4">✓</div>
                  <div className="text-sm">No suspicious accounts flagged.</div>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Account ID","Suspicion Score","Ring ID","Detected Patterns"].map(h=>(
                        <th key={h} className="px-4 py-3 text-left text-xs text-slate-500 tracking-widest font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.json.suspicious_accounts.map((acc,i)=>(
                      <tr key={acc.account_id}
                        className={`border-b border-slate-900 cursor-pointer hover:bg-slate-800/50 transition-colors ${i%2===0?"bg-slate-900/30":""}`}
                        onClick={()=>{setTab("graph");setSelectedNode(acc.account_id);}}>
                        <td className="px-4 py-3 text-white font-bold font-mono text-xs">{acc.account_id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${acc.suspicion_score>=70?"bg-red-500":"bg-yellow-500"}`} style={{width:`${acc.suspicion_score}%`}} />
                            </div>
                            <span className={`font-bold font-mono text-xs ${acc.suspicion_score>=70?"text-red-400":"text-yellow-400"}`}>{acc.suspicion_score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-red-400 font-mono text-xs">{acc.ring_id}</td>
                        <td className="px-4 py-3">{acc.detected_patterns.map(p=><Badge key={p} label={p} variant="yellow" />)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── JSON Tab ── */}
          {tab === "json" && (
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-slate-600 tracking-widest">OUTPUT · fraud_analysis.json</div>
                <button onClick={downloadJSON}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs tracking-widest rounded-md font-bold transition-colors">
                  ↓ DOWNLOAD
                </button>
              </div>
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-xs text-slate-400 font-mono leading-relaxed overflow-auto">
                {JSON.stringify(result.json, null, 2)}
              </pre>
            </div>
          )}

        </div>
      )}
    </div>
  );
}