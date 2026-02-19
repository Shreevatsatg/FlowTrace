import { useEffect, useState } from "react";

function FeatureCard({ icon, title, description, details }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: 28,
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
      <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7, marginBottom: 16 }}>{description}</p>
      <ul style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.8, paddingLeft: 20 }}>
        {details.map((detail, i) => <li key={i}>{detail}</li>)}
      </ul>
    </div>
  );
}

export default function FeaturesPage() {
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
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h1 style={{ fontSize: 48, fontWeight: 700, color: "#f9fafb", marginBottom: 16 }}>
            Detection Features
          </h1>
          <p style={{ fontSize: 16, color: "#9ca3af", maxWidth: 700, margin: "0 auto", lineHeight: 1.7 }}>
            Advanced graph-based algorithms to identify money muling patterns, fraud rings, and suspicious financial networks.
          </p>
        </div>

        {/* Features Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
          marginBottom: 64,
        }}>
          <FeatureCard
            icon="🔄"
            title="Cycle Detection (DFS)"
            description="Identifies circular money flows that indicate coordinated fraud rings using depth-first search algorithms."
            details={[
              "Detects cycles of length 3-5 hops",
              "Ring ID prefix: RING_001, RING_002...",
              "Suspicion score: +40 points",
              "Traces A→B→C→A patterns"
            ]}
          />
          
          <FeatureCard
            icon="🌊"
            title="Smurfing Fan-In"
            description="Detects patterns where multiple accounts send funds to a single aggregation point."
            details={[
              "Identifies 10+ senders → 1 receiver",
              "Ring ID prefix: RING_S001",
              "Suspicion score: +30 points",
              "Common in money laundering schemes"
            ]}
          />
          
          <FeatureCard
            icon="💨"
            title="Smurfing Fan-Out"
            description="Identifies single accounts distributing funds across many receivers to avoid detection thresholds."
            details={[
              "Detects 1 sender → 10+ receivers",
              "Ring ID prefix: RING_S002",
              "Suspicion score: +30 points",
              "Breaks large amounts into small transfers"
            ]}
          />
          
          <FeatureCard
            icon="🐚"
            title="Shell Chain Detection"
            description="Finds low-activity relay accounts used to obscure money trails through layered transactions."
            details={[
              "Identifies 3+ consecutive relay nodes",
              "Ring ID prefix: RING_L001",
              "Suspicion score: +20 points",
              "Detects accounts with minimal activity"
            ]}
          />
          
          <FeatureCard
            icon="⚡"
            title="High Velocity Analysis"
            description="Monitors transaction frequency and speed to identify rapid fund movement patterns."
            details={[
              "Tracks transaction frequency",
              "Identifies rapid fund transfers",
              "Suspicion score: +10 points",
              "Flags unusual activity spikes"
            ]}
          />
          
          <FeatureCard
            icon="📊"
            title="Risk Scoring Engine"
            description="Assigns comprehensive 0-100 suspicion scores based on multiple behavioral signals."
            details={[
              "Multi-factor scoring system",
              "Combines all detection patterns",
              "Maximum score: 100 points",
              "Prioritizes high-risk accounts"
            ]}
          />
          
          <FeatureCard
            icon="🕸️"
            title="Graph Construction"
            description="Builds directed graphs with accounts as nodes and transactions as weighted edges."
            details={[
              "Adjacency list representation",
              "Tracks sent/received counts",
              "Calculates total amounts",
              "Enables network analysis"
            ]}
          />
          
          <FeatureCard
            icon="🎯"
            title="Pattern Recognition"
            description="Combines multiple algorithms to identify complex fraud patterns across the transaction network."
            details={[
              "4 core detection algorithms",
              "Real-time pattern matching",
              "Automated ring identification",
              "Exportable JSON results"
            ]}
          />
        </div>

        {/* Scoring Methodology */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: 40,
        }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#f9fafb", marginBottom: 24, textAlign: "center" }}>
            Suspicion Score Methodology
          </h2>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            {[
              { signal: "In a cycle", points: "+40" },
              { signal: "Smurfing node", points: "+30" },
              { signal: "Shell account", points: "+20" },
              { signal: "High velocity", points: "+10" },
            ].map(({ signal, points }) => (
              <div key={signal} style={{
                background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: 10, padding: 20, textAlign: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>{points}</div>
                <div style={{ fontSize: 13, color: "#9ca3af" }}>{signal}</div>
              </div>
            ))}
          </div>
          
          <div style={{
            marginTop: 24, textAlign: "center", padding: 16,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>Maximum Score: </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#ef4444" }}>100</span>
          </div>
        </div>

      </div>
    </div>
  );
}
