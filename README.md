# FlowTrace — Money Muling Detection Engine

**RIFT 2026 Hackathon Project**

A graph-based financial crime detection system that identifies money muling patterns, smurfing operations, and shell account networks through advanced transaction analysis.

---

## 🌐 Live Demo

**Frontend:** [https://flowtrace-navy.vercel.app/](https://flowtrace-navy.vercel.app/)  
**Backend API:** [https://flowtrace.onrender.com](https://flowtrace.onrender.com)

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js (Express.js)
- **CSV Parsing:** csv-parse
- **File Upload:** Multer
- **CORS:** cors middleware

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 4
- **Visualization:** HTML5 Canvas (custom force-directed graph)

### Deployment
- **Platform:** Render
- **Architecture:** Microservices (separate frontend/backend)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Upload Screen│  │  Dashboard   │  │ Graph Canvas │      │
│  │   (CSV)      │→ │  (Metrics)   │→ │ (Force-Dir.) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ POST /analyze (FormData)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Node.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Analysis Pipeline                       │   │
│  │  1. CSV Parser → Validate & Parse Transactions      │   │
│  │  2. Graph Builder → Adjacency List + Node Map       │   │
│  │  3. Detection Algorithms (Parallel)                 │   │
│  │     ├─ Cycle Detector (DFS)                         │   │
│  │     ├─ Smurfing Detector (Fan-in/Fan-out)           │   │
│  │     ├─ Shell Chain Detector (Low-activity relays)   │   │
│  │     └─ Large Transaction Detector                   │   │
│  │  4. Scoring Service → Risk Scores + Ranking         │   │
│  │  5. JSON Response → Fraud Rings + Suspicious Accts  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓ JSON Response
┌─────────────────────────────────────────────────────────────┐
│                    Visualization Layer                       │
│  • Interactive force-directed graph with physics simulation │
│  • Real-time filtering (score, ring, pattern)               │
│  • Fraud rings table with risk scores                       │
│  • Suspicious accounts table with pattern breakdown         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧮 Algorithm Approach

### 1. Cycle Detection (DFS-based)
**Pattern:** Circular transaction flows (A→B→C→A)

**Algorithm:**
- Depth-First Search with path tracking
- Detects cycles of length 3-5 hops
- Canonical key generation (sorted members) prevents duplicate detection

**Complexity:**
- **Time:** O(V × E) where V = vertices, E = edges
- **Space:** O(V) for recursion stack + path storage
- **Optimization:** Early termination at depth 5, visited set per path

**Code Location:** `backend/src/services/cycleDetector.js`

### 2. Smurfing Detection (Time-Window Analysis)
**Pattern:** Fan-in (many→one) or Fan-out (one→many) within 24h window

**Algorithm:**
- Group transactions by 24-hour time windows
- Count unique senders/receivers per aggregator
- Threshold: ≥3 connections (lowered from 10 for realistic detection)
- Captures downstream beneficiaries for fan-in patterns

**Complexity:**
- **Time:** O(E log E) for sorting + O(E) for window grouping = O(E log E)
- **Space:** O(E) for edge storage + O(W) for window groups

**Code Location:** `backend/src/services/smurfingDetector.js`

### 3. Shell Chain Detection (Low-Activity Relay)
**Pattern:** Accounts with 2-3 total transactions acting as relays

**Algorithm:**
- Filter nodes with transaction count ∈ [2,3]
- Recursive chain building (depth ≥ 3)
- Canonical key prevents permutation duplicates

**Complexity:**
- **Time:** O(V × D³) where D = max chain depth (3)
- **Space:** O(V) for chain storage

**Code Location:** `backend/src/services/shellDetector.js`

### 4. Large Transaction Detection
**Pattern:** Single transactions exceeding threshold ($50,000)

**Complexity:**
- **Time:** O(E)
- **Space:** O(1)

**Code Location:** `backend/src/services/largeTransactionDetector.js`

---

## 📊 Suspicion Score Methodology

### Node Scoring Formula

| Signal                  | Points | Condition                          |
|-------------------------|--------|------------------------------------|
| **Cycle Membership**    | +40    | Node appears in any cycle ring     |
| **Smurfing Activity**   | +30    | Node in fan-in/fan-out pattern     |
| **Shell Account**       | +20    | Low-activity relay behavior        |
| **Large Transaction**   | +10    | Involved in $50K+ transfer         |
| **High Velocity**       | +10    | Total transactions > 20            |
| **Maximum Score**       | **100**| Capped at 100                      |

### Ring Risk Scoring

**Base Score:** 80

**Adjustments:**
- **Cycle:** +5 base + (15 - cycle_length × 2) — shorter cycles = higher risk
- **Smurfing:** +min(15, member_count) — more participants = higher risk
- **Shell Chain:** +10 fixed
- **Large Transaction:** +min(10, amount/1000)

**Priority Ranking (Tiebreaker):**
1. Cycle (priority 3)
2. Smurfing (priority 2)
3. Shell Chain (priority 1)
4. Large Transaction (priority 0)

**Code Location:** `backend/src/services/scoringService.js`

---

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Git

### Backend Setup

```bash
cd backend
npm install
npm start
# ✅ Server running at http://localhost:3000
```

**Environment Variables** (optional):
```bash
# backend/.env
PORT=3000
NODE_ENV=development
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# ✅ Frontend at http://localhost:5173
```

**Environment Variables:**
```bash
# frontend/.env
VITE_API_BASE=http://localhost:3000
```

### Production Build

```bash
# Frontend
cd frontend
npm run build
npm run preview

# Backend (already production-ready)
cd backend
npm start
```

---

## 🚀 Usage Instructions

### 1. Upload CSV File
- Navigate to the upload screen
- Drag & drop or click to select a CSV file
- Required columns: `transaction_id`, `sender_id`, `receiver_id`, `amount`, `timestamp`

**Example CSV Format:**
```csv
transaction_id,sender_id,receiver_id,amount,timestamp
TX001,A1,A2,5000,2024-01-15T10:30:00Z
TX002,A2,A3,4800,2024-01-15T11:00:00Z
TX003,A3,A1,4600,2024-01-15T11:30:00Z
```

### 2. Analyze Transactions
- Click "Analyze Transactions" button
- Backend processes CSV and runs detection algorithms
- Results appear in ~1-3 seconds depending on dataset size

### 3. Explore Results

**Dashboard View:**
- **Metrics:** Total accounts, high-risk accounts, fraud rings, max risk score
- **Interactive Graph:** Force-directed visualization with drag, zoom, pan
- **Fraud Rings Table:** All detected patterns with risk scores
- **Suspicious Accounts Table:** Flagged accounts with suspicion scores

**Filters:**
- Toggle "Only Suspicious" to hide clean accounts
- Adjust minimum score threshold (0-100)
- Filter by specific ring ID
- Filter by pattern type (cycle, smurfing, shell)

### 4. Download Report
- Click "Download JSON" to export full analysis results
- Includes all rings, accounts, graph data, and metadata

---

## 🔬 API Reference

### POST /analyze

**Description:** Upload CSV and receive fraud analysis

**Request:**
```bash
curl -X POST http://localhost:3000/analyze \
  -F "file=@transactions.csv"
```

**Response:**
```json
{
  "suspicious_accounts": [
    {
      "account_id": "A1",
      "suspicion_score": 70.0,
      "detected_patterns": ["cycle_length_3", "high_velocity"],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["A1", "A2", "A3"],
      "pattern_type": "cycle",
      "risk_score": 94.0
    }
  ],
  "summary": {
    "total_accounts_analyzed": 10,
    "suspicious_accounts_flagged": 3,
    "fraud_rings_detected": 2,
    "processing_time_seconds": 0.142
  },
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

### GET /

**Description:** Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "message": "Money Muling Detection API"
}
```

---

## ⚠️ Known Limitations

### Detection Accuracy
- **False Positives:** Legitimate business transactions with circular flows may be flagged
- **Threshold Sensitivity:** Fan-in/fan-out threshold of 3 may flag small business operations
- **Time Window:** 24-hour window may miss coordinated attacks spanning multiple days

### Performance
- **Large Datasets:** CSV files >10,000 transactions may experience slower processing (>5s)
- **Memory Usage:** Graph construction requires O(V+E) memory; very large graphs (>50K nodes) may cause issues
- **Browser Rendering:** Canvas visualization slows down with >500 nodes; consider filtering

### Data Requirements
- **CSV Format:** Strict column naming required; no auto-detection of column variations
- **Timestamp Format:** Expects ISO 8601 format; other formats may cause parsing errors
- **Missing Data:** Transactions with null/empty fields are silently skipped

### Feature Gaps
- No machine learning-based anomaly detection
- No temporal pattern analysis (e.g., unusual transaction times)
- No amount-based anomaly detection (except large transactions)
- No geographic/IP-based analysis
- No account metadata integration (KYC, device fingerprints)

---

## 👥 Team Members

**Team FlowTrace**

- shreevatsa — Full Stack Developer & Algorithm Design
- bhuvan sharma — Frontend Development & UI/UX
- anuttama bhat — Backend Architecture & API Design

*RIFT 2026 Hackathon Submission*



---

## 🙏 Acknowledgments

- RIFT 2026 Hackathon organizers
- Open-source libraries: React, Express, Vite, Tailwind CSS
- Financial crime detection research papers and methodologies

---

**Built with ❤️ for RIFT 2026**
