export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#080810",
      fontFamily: "'DM Sans', ui-sans-serif, sans-serif",
      paddingTop: 80, paddingBottom: 40,
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
        
        <h1 style={{ fontSize: 42, fontWeight: 700, color: "#f9fafb", marginBottom: 16 }}>
          Privacy Policy
        </h1>
        
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 40, fontFamily: "'DM Mono', monospace" }}>
          Last updated: January 2026
        </div>

        <div style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.8 }}>
          
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              1. Data Collection
            </h2>
            <p style={{ marginBottom: 12 }}>
              FlowTrace processes transaction data uploaded by users for the purpose of fraud detection analysis. 
              We collect only the data you explicitly provide through CSV file uploads.
            </p>
            <p>
              Data collected includes: transaction IDs, sender IDs, receiver IDs, amounts, and timestamps.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              2. Data Usage
            </h2>
            <p style={{ marginBottom: 12 }}>
              Your uploaded transaction data is used exclusively for:
            </p>
            <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
              <li>Building transaction graphs</li>
              <li>Detecting fraud patterns (cycles, smurfing, shell chains)</li>
              <li>Generating risk scores and analysis reports</li>
            </ul>
            <p>
              We do not use your data for any other purpose, including marketing or third-party sharing.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              3. Data Storage
            </h2>
            <p style={{ marginBottom: 12 }}>
              Uploaded files are processed in-memory and are not permanently stored on our servers. 
              Once your analysis session ends, all data is automatically deleted.
            </p>
            <p>
              We do not maintain databases of user transaction data.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              4. Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your data during transmission and processing. 
              All connections use HTTPS encryption, and data is processed in isolated sessions.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              5. Third-Party Services
            </h2>
            <p>
              FlowTrace does not share your data with third-party services. All analysis is performed locally 
              within our application infrastructure.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              6. User Rights
            </h2>
            <p style={{ marginBottom: 12 }}>
              You have the right to:
            </p>
            <ul style={{ paddingLeft: 24 }}>
              <li>Access your data during your session</li>
              <li>Download analysis results in JSON format</li>
              <li>Request deletion of data (automatic upon session end)</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              7. Cookies and Tracking
            </h2>
            <p>
              FlowTrace does not use cookies or tracking technologies. We do not collect analytics or 
              behavioral data about your usage.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 12 }}>
              8. Contact
            </h2>
            <p>
              For privacy-related questions or concerns, contact us at:{" "}
              <a href="mailto:contact@flowtrace.dev" style={{ color: "#ef4444", textDecoration: "none" }}>
                contact@flowtrace.dev
              </a>
            </p>
          </section>

          <div style={{
            marginTop: 40, padding: 20, borderRadius: 10,
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)",
          }}>
            <p style={{ fontSize: 13, color: "#f9fafb", fontWeight: 600, marginBottom: 8 }}>
              Note on Sensitive Data
            </p>
            <p style={{ fontSize: 12, color: "#9ca3af" }}>
              FlowTrace is designed for financial crime detection. Ensure you have proper authorization 
              before uploading transaction data. Do not upload personally identifiable information (PII) 
              beyond what is necessary for fraud analysis.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
