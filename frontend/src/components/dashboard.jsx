import { useState,  } from "react";
import MetricCard from "./matrixcard";
import GraphCanvas from "./GraphCanvas";

const NAV_ITEMS = [
  { label:"Dashboard", icon:"⊞" },
  { label:"Graph View", icon:"⬡", active:true },
];

function patternColor(pat) {
  if (pat.includes("cycle"))   return "#ef4444";
  if (pat.includes("smurf"))   return "#f97316";
  if (pat.includes("shell"))   return "#a855f7";
  if (pat.includes("layer"))   return "#a855f7";
  return "#6b7280";
}

// Unique pattern types across all rings
function uniquePatternTypes(rings) {
  const s = new Set();
  rings.forEach(r => { if (r.pattern) r.pattern.split("_").slice(0,2).forEach(p=>s.add(p)); });
  return [...s].filter(p=>p.length>2);
}

export default function Dashboard({ data, rawJson, onReset }) {
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
