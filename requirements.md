# TradeTracker - System Requirements & Specification Document

## 1. Executive Summary & Critical Enforcement Checklist
**TradeTracker** is an autonomous, full-stack investment journal and automated risk execution platform built strictly in English for professional stock traders. It integrates real-time market data, background stop-loss automation, extensive trader metrics, high-standard Shadcn UI components, and an AI-powered "Magic Import" engine via Google Gemini API.

### Critical Upgrades & Advanced Features Enforcement (Mandatory)
- [x] **1. Automated Stop-Loss Background Engine**:
  - Continuous scheduled background worker via `node-cron` polling real-time quotes (`yahoo-finance2`).
  - Autonomously executes sell logic when market price $\le$ stop-loss threshold.
  - Automatically calculates final PnL and transitions trades from `ACTIVE` to `CLOSED` (History collection) with zero client triggers required.
- [x] **2. Professional Trader Analytics & Strategy Tagging**:
  - **Win Rate %** and **Profit Factor** (Gross Profit / Gross Loss).
  - **Equity Curve Line Chart** tracking portfolio value and cumulative growth over time via Recharts.
  - **PnL Calendar Heatmap** displaying daily profit/loss sessions with green/red intensity.
  - **Strategy Tagging & Filtering**: Tag trades with strategies ("Moving Average Cross", "VIX Reversal", "Breakout", "Moving Average Bounce", "VIX Hedge") and filter performance analytics dynamically by tag to identify edge and profitability.
- [x] **3. Uncompromising UI/UX Standards (Shadcn UI & Tailwind CSS)**:
  - Premium SaaS terminal aesthetics in sleek dark mode.
  - **Shadcn UI Cards**: Modern metric summary tiles with KPIs and spark indicators.
  - **Shadcn UI Data Table**: Trade history table equipped with multi-column sorting (Ticker, Date, Entry, Exit, PnL), multi-faceted filtering, and search.
  - **Shadcn UI Modals / Dialogs**: Trade Entry and Trade Exit modal workflows with real-time risk/reward previews.
- [x] **4. Robust Historical File Parser (CSV & Excel `xlsx`)**:
  - Integration of `papaparse` and `xlsx` parser.
  - Support for bulk-uploading large files of past trades (.csv, .xlsx, .xls).
  - Automatic column header mapping to MongoDB schema, instant PnL recalculation, and immediate dashboard analytics re-computation upon upload.
- [x] **5. AI-Powered "Magic Import" via Gemini API (Hybrid Schema Mapping)**:
  - **Never Send Whole File to LLM**: Extracts only column headers and top 5 rows to preserve token limits and guarantee 100% financial calculation accuracy.
  - **Gemini API Schema Resolver**: Prompt instructs Gemini LLM to analyze the sample rows and return a strict JSON mapping connecting any arbitrary/foreign header names (in English, Hebrew, etc.) to canonical database fields (`ticker`, `buyPrice`, `quantity`, `buyDate`, `stopLossPrice`, `targetPrice`, `sellPrice`, `sellDate`, `strategyTag`, `notes`).
  - **Local High-Performance Parsing**: Backend parses all thousands of rows locally using SheetJS / PapaParse based strictly on the AI-generated schema mapping.
  - **Fallback & Manual Resolution Flow**: If critical fields (e.g. `ticker` or `buyPrice`) cannot be confidently mapped, the system returns a manual mapping request modal on the frontend so the user can select the missing columns with 1 click.

---

## 2. Hybrid AI Architecture for Magic Import

```
   [User Uploads Arbitrary Excel/CSV File] (Any structure / language: English, Hebrew, IBKR, etc.)
                          |
                          v
   +-----------------------------------------------------------+
   | Backend: Extract Column Headers & Top 5 Sample Rows Only  |
   +------------------------------+----------------------------+
                                  |
                                  | (Small JSON Payload ~200 tokens)
                                  v
   +-----------------------------------------------------------+
   |   Google Gemini API (gemini-1.5-flash) / AI Mapper        |
   |   Prompt: Analyze headers & sample data values            |
   |   Output: Strict JSON column mapping                      |
   +------------------------------+----------------------------+
                                  |
                                  v
       [Confidently mapped?] ---- NO ----> [Return Manual Column Picker to Frontend]
                |
               YES
                |
                v
   +-----------------------------------------------------------+
   | Local Execution Engine (xlsx / papaparse on Node.js)      |
   | Parse 10,000+ rows locally using verified AI mapping      |
   | Calculate realized PnL for closed trades                  |
   | Insert directly into MongoDB (Trade Collection)           |
   +------------------------------+----------------------------+
                                  |
                                  v
   [Update Analytics Dashboard & Trade History Instantly]
```

---

## 3. Database Schema (`Trade` Collection)

```typescript
interface ITrade {
  _id: string;
  ticker: string;              // e.g. "AAPL", uppercase
  status: 'ACTIVE' | 'CLOSED';  // Active open position or closed
  type: 'BUY' | 'SELL';        // Long position
  
  // Entry details
  buyPrice: number;            // Execution price
  quantity: number;            // Number of shares
  buyDate: Date;               // Trade entry timestamp
  
  // Risk management
  stopLossPrice: number;       // Stop loss trigger level
  targetPrice?: number;        // Profit target level
  
  // Exit details (when CLOSED)
  sellPrice?: number;          // Exit execution price
  sellDate?: Date;             // Exit timestamp
  exitReason?: 'STOP_LOSS' | 'TARGET_REACHED' | 'MANUAL_EXIT' | 'IMPORTED';
  
  // Financial metrics
  realizedPnL?: number;        // (sellPrice - buyPrice) * quantity
  realizedPnLPercent?: number; // ((sellPrice - buyPrice) / buyPrice) * 100
  
  // Live tracking (for ACTIVE)
  currentPrice?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  lastPriceUpdate?: Date;
  
  // Categorization & Notes
  strategyTag: string;         // e.g. "Moving Average Cross", "VIX Reversal", "Breakout"
  notes?: string;              // Journal rationale
  
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 4. REST API Endpoints Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health check and MongoDB connection status |
| `GET` | `/api/trades` | List trades (filters: `status=ACTIVE\|CLOSED`, `strategy`, `search`) |
| `GET` | `/api/trades/analytics` | Returns Win Rate %, Profit Factor, R:R, Equity Curve, Calendar Heatmap, Strategy Stats (supports `?strategy=` filter) |
| `POST` | `/api/trades` | Create new active trade position |
| `PUT` | `/api/trades/:id` | Update trade parameters |
| `POST` | `/api/trades/:id/close` | Manually close active trade |
| `DELETE` | `/api/trades/:id` | Delete trade record |
| `POST` | `/api/trades/seed-demo` | Seed realistic demo portfolio |
| `GET` | `/api/market/quote/:ticker` | Real-time quote lookup |
| `POST` | `/api/market/override` | Set manual price override (for testing) |
| `POST` | `/api/stoploss/trigger` | Immediate manual trigger of stop-loss monitor |
| `GET` | `/api/stoploss/status` | Engine status and execution logs |
| `POST` | `/api/import/magic` | **AI-Powered Hybrid Import**: extracts top 5 rows, calls Gemini API for schema mapping, parses full file locally, saves to MongoDB |
| `POST` | `/api/import/json` | Bulk import parsed trade rows directly |
| `POST` | `/api/import/file` | Multipart file upload supporting `.csv`, `.xlsx`, `.xls` |
| `GET` | `/api/import/sample-csv` | Download formatted sample trade template |
