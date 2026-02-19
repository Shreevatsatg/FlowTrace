import { useEffect, useState } from "react";

function FeatureCard({ icon, title, description }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: 24, textAlign: "center",
      transition: "all 0.3s",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = "rgba(239,68,68,0.05)";
      e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = "rgba(255,255,255,0.02)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

export default function AboutPage() {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#080810",
      fontFamily: "'DM Sans', ui-sans-serif, sans-serif",
      paddingTop: 80, paddingBottom: 40,
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px" }}>
        
        {/* Hero Section */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: "0 auto 24px",
            background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
            border: "1px solid rgba(239,68,68,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          }}>⬡</div>
          
          <h1 style={{ fontSize: 48, fontWeight: 700, color: "#f9fafb", marginBottom: 16 }}>
            About FLOW<span style={{ color: "#ef4444" }}>TRACE</span>
          </h1>
          
          <p style={{ fontSize: 16, color: "#9ca3af", maxWidth: 600, margin: "0 auto", lineHeight: 1.7 }}>
            FlowTrace is an advanced money muling detection engine built for RIFT 2026. 
            Using graph-based analysis and pattern recognition, we identify suspicious financial networks in real-time.
          </p>
        </div>

        {/* Features Section */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{
            fontSize: 28, fontWeight: 700, color: "#f9fafb", textAlign: "center", marginBottom: 40,
          }}>
            Powerful Detection Features
          </h2>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}>
            <FeatureCard
              icon="🔄"
              title="Cycle Detection"
              description="Identifies circular money flows (3-5 hops) that indicate coordinated fraud rings using DFS algorithms."
            />
            <FeatureCard
              icon="🌊"
              title="Smurfing Analysis"
              description="Detects fan-in/fan-out patterns where funds are split or aggregated across 10+ accounts."
            />
            <FeatureCard
              icon="🐚"
              title="Shell Chains"
              description="Finds low-activity relay accounts used to obscure money trails through layered transactions."
            />
            <FeatureCard
              icon="📊"
              title="Risk Scoring"
              description="Assigns 0-100 suspicion scores based on multiple signals: cycles, velocity, and network position."
            />
          </div>
        </div>

        {/* How It Works */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: 40, marginBottom: 64,
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f9fafb", marginBottom: 24 }}>
            How It Works
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { step: "1", title: "Upload CSV", desc: "Provide transaction data with sender, receiver, amount, and timestamp." },
              { step: "2", title: "Graph Construction", desc: "Build a directed graph with accounts as nodes and transactions as edges." },
              { step: "3", title: "Pattern Detection", desc: "Run DFS for cycles, analyze degree centrality for smurfing, identify shell chains." },
              { step: "4", title: "Risk Assessment", desc: "Score each account based on detected patterns and network behavior." },
              { step: "5", title: "Visualization", desc: "Interactive graph display with fraud rings highlighted and exportable results." },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#ef4444",
                }}>{step}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#f3f4f6", marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f9fafb", marginBottom: 24 }}>
            Built With
          </h2>
          
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {["React", "Vite", "Node.js", "Express", "Graph Theory", "DFS", "Tailwind"].map(tech => (
              <span key={tech} style={{
                padding: "8px 16px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                color: "#9ca3af", fontSize: 12, fontWeight: 600,
              }}>{tech}</span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
