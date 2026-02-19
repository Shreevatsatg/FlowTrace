
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


export default function MetricCard({ label, value, sub, trend, trendUp, chart, gauge, gaugeColor }) {
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