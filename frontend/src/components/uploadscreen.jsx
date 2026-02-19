
import { useState,useRef } from "react";

const API_BASE= import.meta.env.VITE_API_BASE;

export default function UploadScreen({ onAnalyze }) {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [drag, setDrag]       = useState(false);
  const inputRef = useRef();

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
