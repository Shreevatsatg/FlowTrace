export default function Footer() {
  return (
    <footer style={{
      background: "rgba(8,8,16,0.85)", borderTop: "1px solid rgba(255,255,255,0.06)",
      padding: "40px 24px 24px", marginTop: "auto",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Top Section */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 32, marginBottom: 32 }}>
          
          {/* Brand */}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>
              FLOW<span style={{ color: "#ef4444" }}>TRACE</span>
            </div>
            <div style={{ fontSize: 11, color: "#4b5563", fontFamily: "'DM Mono', monospace" }}>
              RIFT 2026 — Money Muling Detection Engine
            </div>
          </div>
          
          {/* Links */}
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>Contact</div>
              <a href="mailto:contact@flowtrace.dev" style={{ fontSize: 11, color: "#6b7280", textDecoration: "none", display: "block" }}
                onMouseEnter={e => e.target.style.color = "#ef4444"}
                onMouseLeave={e => e.target.style.color = "#6b7280"}>
                contact@flowtrace.dev
              </a>
            </div>
            
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>Connect</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="https://github.com/yourusername/flowtrace" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#6b7280", textDecoration: "none" }}
                  onMouseEnter={e => e.target.style.color = "#ef4444"}
                  onMouseLeave={e => e.target.style.color = "#6b7280"}>
                  GitHub →
                </a>
                <a href="https://linkedin.com/in/yourprofile" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#6b7280", textDecoration: "none" }}
                  onMouseEnter={e => e.target.style.color = "#ef4444"}
                  onMouseLeave={e => e.target.style.color = "#6b7280"}>
                  LinkedIn →
                </a>
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>Legal</div>
              <a href="#privacy" style={{ fontSize: 11, color: "#6b7280", textDecoration: "none", display: "block" }}
                onMouseEnter={e => e.target.style.color = "#ef4444"}
                onMouseLeave={e => e.target.style.color = "#6b7280"}>
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
        
        {/* Bottom Section */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 10, color: "#374151" }}>
            © 2026 FlowTrace. Graph-based financial crime detection.
          </div>
          <div style={{ fontSize: 10, color: "#4b5563" }}>
            Built by <span style={{ color: "#ef4444", fontWeight: 600 }}>Your Name</span>
          </div>
        </div>
        
      </div>
    </footer>
  );
}
