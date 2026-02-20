export default function Footer({ onNavigate }) {
  return (
    <footer style={{
      background: "#080810",
      borderTop: "2px solid transparent",
      borderImage: "linear-gradient(90deg, transparent, rgba(239,68,68,0.3), transparent) 1",
      padding: "24px 24px 24px", marginTop: "auto",
      position: "relative",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Top Section */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 32, marginBottom: 32 }}>
          
          {/* Brand */}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              <span style={{ color: "#fff" }}>FLOW</span>
              <span style={{ color: "#ef4444" }}>TRACE</span>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>
              Money Muling Detection Engine
            </div>
          </div>
          
          {/* Links */}
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>Contact</div>
              <a href="mailto:contact@flowtrace.dev" style={{ 
                fontSize: 11, color: "#6b7280", textDecoration: "none", display: "block",
                transition: "all 0.2s ease",
              }}
                onMouseEnter={e => {
                  e.target.style.color = "#ef4444";
                  e.target.style.transform = "translateX(4px)";
                }}
                onMouseLeave={e => {
                  e.target.style.color = "#6b7280";
                  e.target.style.transform = "translateX(0)";
                }}>
                contact@flowtrace.dev
              </a>
            </div>
            
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>Connect</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="https://github.com/Shreevatsatg/FlowTrace" target="_blank" rel="noopener noreferrer"
                  style={{ 
                    fontSize: 11, color: "#6b7280", textDecoration: "none",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    e.target.style.color = "#ef4444";
                    e.target.style.transform = "translateX(4px)";
                  }}
                  onMouseLeave={e => {
                    e.target.style.color = "#6b7280";
                    e.target.style.transform = "translateX(0)";
                  }}>
                  GitHub →
                </a>
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 12 }}>Legal</div>
              <a onClick={() => onNavigate("privacy")} style={{ 
                fontSize: 11, color: "#6b7280", textDecoration: "none", display: "block", cursor: "pointer",
                transition: "all 0.2s ease",
              }}
                onMouseEnter={e => {
                  e.target.style.color = "#ef4444";
                  e.target.style.transform = "translateX(4px)";
                }}
                onMouseLeave={e => {
                  e.target.style.color = "#6b7280";
                  e.target.style.transform = "translateX(0)";
                }}>
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
          <div style={{ fontSize: 10, color: "#9ca3af" }}>
            Built by <span style={{ color: "#ef4444", fontWeight: 600 }}>Team anonymous</span>
          </div>
        </div>
        
      </div>
    </footer>
  );
}
