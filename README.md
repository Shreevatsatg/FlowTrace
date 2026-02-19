# RIFT 2026 — Money Muling Detection Engine

## Project Structure

```
/
├── frontend/       ← React + Vite + Tailwind
│   └── App.jsx
├── backend/        ← Node.js + Express
│   ├── server.js
│   └── package.json
└── test_transactions.csv
```

---

## Backend Setup (Node.js)

```bash
cd backend
npm install
npm start
# ✅ API running at http://localhost:3000
```

### API Endpoints

| Method | Route     | Description                        |
|--------|-----------|------------------------------------|
| GET    | `/`       | Health check                       |
| POST   | `/analyze`| Upload CSV → returns analysis JSON |

### POST /analyze — Example with curl

```bash
curl -X POST http://localhost:3000/analyze \
  -F "file=@test_transactions.csv"
```

---

## Frontend Setup (React + Vite)

```bash
cd frontend

# 1. Create a Vite React project
npm create vite@latest . -- --template react

# 2. Install Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 3. Install deps
npm install

# 4. Copy App.jsx into src/App.jsx

# 5. Set backend URL (optional, defaults to localhost:3000)
echo "VITE_API_URL=http://localhost:3000" > .env

# 6. Run
npm run dev
# ✅ Frontend at http://localhost:5173
```

### tailwind.config.js
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

### src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## How It Works

```
User uploads CSV
      ↓
Frontend sends FormData to POST /analyze
      ↓
Backend:
  1. Parses CSV (csv-parse)
  2. Builds directed graph (Map + adjacency list)
  3. Detects cycles — DFS, length 3–5
  4. Detects smurfing — fan-in/fan-out ≥ 10 nodes
  5. Detects shell chains — low-activity relay accounts
  6. Scores each suspicious node (0–100)
  7. Formats JSON response
      ↓
Frontend receives JSON:
  - Renders interactive Canvas graph
  - Renders Fraud Rings table
  - Renders Flagged Accounts table
  - Allows JSON download
```

---

## Detection Algorithms

| Algorithm      | Pattern           | Ring ID Prefix |
|----------------|-------------------|----------------|
| Cycle (DFS)    | A→B→C→A (3–5 hop) | `RING_001`     |
| Smurfing fan-in | 10+ senders → 1  | `RING_S001`    |
| Smurfing fan-out | 1 → 10+ receivers | `RING_S002`   |
| Shell chains   | 3+ low-tx relays  | `RING_L001`    |

## Suspicion Score Methodology

| Signal         | Points |
|----------------|--------|
| In a cycle     | +40    |
| Smurfing node  | +30    |
| Shell account  | +20    |
| High velocity  | +10    |
| **Max score**  | **100** |