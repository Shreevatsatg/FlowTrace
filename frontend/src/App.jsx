import Dashboard from  "./components/dashboard"
import { useState } from "react";
import UploadScreen from "./components/uploadscreen"
import Navbar from "./components/Navbar"
import AboutPage from "./components/AboutPage"
import FeaturesPage from "./components/FeaturesPage"
import Footer from "./components/Footer"

export default function App() {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState("upload");

  const handleAnalyze = (data, rawJson) => setResult({ data, rawJson });
  const handleReset = () => setResult(null);
  const handleNavigate = (newPage) => {
    setPage(newPage);
    setResult(null);
  };

  if (result) return <Dashboard data={result.data} rawJson={result.rawJson} onReset={handleReset} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar currentPage={page} onNavigate={handleNavigate} />
      {page === "upload" ? <UploadScreen onAnalyze={handleAnalyze} /> : 
       page === "features" ? <FeaturesPage /> : <AboutPage />}
      <Footer />
    </div>
  );
}