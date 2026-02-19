import {useEffect, useRef, useCallback} from "react"
 export default function GraphCanvas({ data, filters }) {
  const canvasRef = useRef(null);
  const sRef      = useRef({ nodes:[], edges:[], dragging:null, hover:null, pan:{x:0,y:0}, scale:1, isPanning:false, lastMouse:null });
  const ttRef     = useRef(null);
  const rafRef    = useRef(null);

  const initPos = useCallback((nodes) => {
    const canvas = canvasRef.current;
    const W = canvas?.offsetWidth || 1000;
    const H = canvas?.offsetHeight || 600;
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.3;
    return nodes.map((n, i) => ({
      ...n,
      x: cx + r * Math.cos((2*Math.PI*i)/nodes.length) + (Math.random()-.5)*20,
      y: cy + r * Math.sin((2*Math.PI*i)/nodes.length) + (Math.random()-.5)*20,
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
  const onWheel = e => { 
    e.preventDefault(); 
    const s = sRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // World coordinates before zoom
    const wx = (mx - s.pan.x) / s.scale;
    const wy = (my - s.pan.y) / s.scale;
    
    // Apply zoom
    const oldScale = s.scale;
    s.scale = Math.max(0.2, Math.min(4, s.scale * (e.deltaY < 0 ? 1.12 : 0.9)));
    
    // Adjust pan to keep world coordinates under mouse
    s.pan.x = mx - wx * s.scale;
    s.pan.y = my - wy * s.scale;
  };

  // Legend — show top unique ring colors (max 6)
  const legendRings = data
    ? Object.entries(data.ringColorMap).slice(0,6)
    : [];

  return (
    <div style={{position:"relative",width:"100%",height:"100%"}}>
      <canvas ref={canvasRef} style={{width:"100%",height:"100%",cursor:"grab",display:"block",touchAction:"none"}}
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
