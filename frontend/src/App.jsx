import Dashboard from  "./components/dashboard"
import { useState } from "react";
import UploadScreen from "./components/uploadscreen"
import Navbar from "./components/Navbar"
import PrivacyPage from "./components/PrivacyPage"
import GraphView from "./components/GraphView"
import Footer from "./components/Footer"

export default function App() {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState("upload");
  const [view, setView] = useState("dashboard");

  const handleAnalyze = (data, rawJson) => setResult({ data, rawJson });
  const handleReset = () => { setResult(null); setView("dashboard"); };
  const handleNavigate = (newPage) => {
    setPage(newPage);
    setResult(null);
    setView("dashboard");
  };
  const handleViewChange = (newView) => setView(newView);

  if (result) {
    if (view === "graph") {
      return <GraphView data={result.data} rawJson={result.rawJson} onReset={handleReset} onNavigate={handleViewChange} />;
    }
    return <Dashboard data={result.data} rawJson={result.rawJson} onReset={handleReset} onNavigate={handleViewChange} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar currentPage={page} onNavigate={handleNavigate} />
      {page === "upload" ? <UploadScreen onAnalyze={handleAnalyze} /> : 
       page === "privacy" ? <PrivacyPage /> : <UploadScreen onAnalyze={handleAnalyze} />}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}