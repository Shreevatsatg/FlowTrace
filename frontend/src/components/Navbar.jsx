export default function Navbar({ currentPage, onNavigate }) {
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "transparent", backdropFilter: "transparent",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          onClick={() => onNavigate("upload")}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
            border: "1px solid rgba(239,68,68,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}><img src="/favicon.png" alt="logo" />   </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>
            FLOW<span style={{ color: "#ef4444" }}>TRACE</span>
          </span>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          {["Features", "About"].map(page => (
            <button key={page}
              onClick={() => onNavigate(page.toLowerCase())}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "none",
                background: currentPage === page.toLowerCase() ? "rgba(239,68,68,0.1)" : "transparent",
                color: currentPage === page.toLowerCase() ? "#ef4444" : "#9ca3af",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.2s",
              }}>
              {page}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
