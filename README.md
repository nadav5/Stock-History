# TradeTracker — Professional Full-Stack Investment Journal & Stop-Loss Engine

**TradeTracker** is a high-performance, full-stack trading journal and risk management platform designed for active stock traders. Built with a modern TypeScript stack (React, Tailwind CSS, Recharts, Node.js, Express, and MongoDB), it provides real-time position tracking, automated stop-loss liquidation via background workers, historical CSV data ingestion, and advanced trader analytics.

---

## 🌟 Key Features

### 1. Real-Time Active Trade Management
- Track open stock positions with entry price, share count, position value, and trade date.
- Real-time market quotes via `yahoo-finance2`.
- Real-time Unrealized PnL ($ and %) updates.
- **Safety Stop-Loss Distance Indicator**: Dynamic visual progress showing distance to stop-loss with buffer percentage and color-coded alert levels (safe, warning, critical).

### 2. Automated Stop-Loss Engine
- **Background Cron Scheduler** (`node-cron`) automatically monitors all active positions every 30 seconds.
- Automatically fetches up-to-date market quotes for active tickers.
- When market price $\le$ Stop-Loss price:
  - Automatically executes liquidation ("Sell").
  - Calculates realized PnL: `(Sell Price - Buy Price) * Quantity`.
  - Transitions position from `ACTIVE` to `CLOSED`.
  - Records exit reason as `STOP_LOSS`.
  - Emits liquidation audit logs and real-time frontend toast notifications.
- **On-Demand Trigger**: Instant "Check Stop-Loss Now" button and simulation trigger ("Simulate SL Drop") to immediately test automated liquidation on any position.

### 3. Historical Data Import (CSV / Excel)
- Client-side CSV parsing with **PapaParse** and server-side validation.
- Drag-and-drop file upload with column mapping and instant table preview.
- One-click template download (`tradetracker_template.csv`).
- Bulk ingestion of past historical trades directly into MongoDB.

### 4. Advanced Analytics & Visualizations
- **Trader KPIs**:
  - **Win Rate %**: Percentage of profitable trades vs. losing trades.
  - **Profit Factor**: Gross Profit divided by Gross Loss with performance badges.
  - **Average Risk/Reward Ratio**: Realized R:R (Average Win / Average Loss) and Planned R:R.
  - **Net Realized & Unrealized PnL**: Cumulative dollar gains and floating PnL.
  - **Capital at Risk**: Real-time aggregate risk across all open stop-losses.
- **Charts (Recharts)**:
  - **Portfolio Equity Curve**: Interactive area/line chart tracking cumulative portfolio growth over time or starting capital ($10k base).
  - **PnL Calendar Heatmap**: Daily profit & loss intensity matrix (green for winning sessions, red for losing sessions) with hover inspection.
  - **Win / Loss Doughnut Chart**: Interactive distribution of wins, losses, and breakeven trades.
  - **Strategy Tag Breakdown**: Bar chart and tabular comparison of Win Rate, Profit Factor, and Total PnL grouped by trading strategy ("Breakout", "Moving Average Bounce", "VIX Hedge").

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide Icons, PapaParse |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | MongoDB with Mongoose ODM |
| **Market Data API** | `yahoo-finance2` with quote caching & graceful fallback |
| **Scheduler** | `node-cron` background worker |

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js v18+ (tested on v26)
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or remote URI via `.env`)

### 1. Installation
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration
Create or inspect `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/tradetracker
STOP_LOSS_CRON_INTERVAL=*/30 * * * * *
```

### 3. Run the Application

#### Option A: Unified Full-Stack Mode (Recommended)
Build both and run the single Express server that serves both API and the frontend UI:
```bash
# From workspace root:
npm run build
npm run start:backend
```
Open your browser at: **`http://localhost:5000`**

#### Option B: Concurrent Development Mode
Run backend and Vite dev server separately:
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend (Vite)
npm run dev:frontend
```
Vite Dev Server will be live at: **`http://localhost:5173`**

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check and MongoDB connection status |
| `GET` | `/api/trades` | List all trades (filters: `status=ACTIVE\|CLOSED`, `strategy`, `search`) |
| `POST` | `/api/trades` | Log a new trade position |
| `GET` | `/api/trades/analytics` | Compute Win Rate, Profit Factor, Equity Curve, Heatmap, Strategies |
| `GET` | `/api/trades/:id` | Get trade by ID |
| `PUT` | `/api/trades/:id` | Update trade details |
| `POST` | `/api/trades/:id/close` | Manually sell/close position |
| `DELETE` | `/api/trades/:id` | Delete trade record |
| `POST` | `/api/trades/seed-demo` | Seed realistic trading portfolio |
| `GET` | `/api/market/quote/:ticker` | Fetch real-time stock quote via Yahoo Finance |
| `POST` | `/api/market/override` | Set manual price override (for testing) |
| `POST` | `/api/stoploss/trigger` | Trigger stop-loss monitor immediately |
| `GET` | `/api/stoploss/status` | Check stop-loss scheduler status and execution logs |
| `POST` | `/api/import/json` | Ingest parsed trade array |
| `POST` | `/api/import/csv` | Upload multipart CSV file |
| `GET` | `/api/import/sample-csv` | Download sample CSV template |
