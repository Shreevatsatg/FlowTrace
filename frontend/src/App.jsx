import Dashboard from  "./components/dashboard"
import { useState, } from "react";
import UploadScreen from "./components/uploadscreen"

export default function App() {
  const [result, setResult] = useState(null);

  const handleAnalyze = (data, rawJson) => setResult({ data, rawJson });
  const handleReset   = () => setResult(null);

  if (!result) return <UploadScreen onAnalyze={handleAnalyze} />;
  return <Dashboard data={result.data} rawJson={result.rawJson} onReset={handleReset} />;
}