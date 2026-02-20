import { useState, useEffect } from "react";

export default function Navbar({ currentPage, onNavigate }) {
  const [visible, setVisible] = useState(true);
  const [lastScroll, setLastScroll] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.pageYOffset;
      if (currentScroll <= 0) {
        setVisible(true);
      } else if (currentScroll > lastScroll) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      setLastScroll(currentScroll);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScroll]);

  const handleNavClick = (page) => {
    if (page === 'upload') {
      onNavigate('upload');
      if (window.scrollToSection) window.scrollToSection('upload');
    } else if (page === 'features') {
      onNavigate('upload');
      setTimeout(() => window.scrollToSection && window.scrollToSection('features'), 100);
    } else if (page === 'about') {
      onNavigate('upload');
      setTimeout(() => window.scrollToSection && window.scrollToSection('about'), 100);
    } else {
      onNavigate(page);
    }
  };
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(8,8,16,0.8)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      transform: visible ? "translateY(0)" : "translateY(-100%)",
      transition: "transform 0.3s ease, background 0.3s ease",
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
          <span style={{ fontSize: 20, fontWeight: 700 }}>
            <span style={{ color: "#fff" }}>FLOW</span>
            <span style={{ color: "#ef4444" }}>TRACE</span>
          </span>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          {["Features", "About"].map(page => {
            const isActive = currentPage === page.toLowerCase();
            return (
              <button key={page}
                onClick={() => handleNavClick(page.toLowerCase())}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(239,68,68,0.05)";
                    e.currentTarget.style.color = "#f87171";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#9ca3af";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: isActive ? "rgba(239,68,68,0.15)" : "transparent",
                  color: isActive ? "#ef4444" : "#9ca3af",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isActive ? "0 4px 12px rgba(239,68,68,0.2)" : "none",
                }}>
                {page}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
