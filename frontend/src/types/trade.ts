export interface Trade {
  _id: string;
  ticker: string;
  assetName?: string;
  sector?: string;
  status: 'ACTIVE' | 'CLOSED';
  type: 'BUY' | 'SELL';
  buyPrice: number;
  quantity: number;
  buyDate: string;
  stopLossPrice?: number;
  targetPrice?: number;
  sellPrice?: number;
  sellDate?: string;
  exitReason?: 'STOP_LOSS' | 'TARGET_REACHED' | 'MANUAL_EXIT' | 'IMPORTED';
  realizedPnL?: number;
  realizedPnLPercent?: number;
  currentPrice?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  dividends?: number;
  source?: 'BLINK' | 'MANUAL' | 'CSV_IMPORT';
  lastPriceUpdate?: string;
  strategyTag: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlinkTransaction {
  _id?: string;
  date: string;
  actionType: string;
  ticker?: string;
  assetName?: string;
  quantity?: number | null;
  price?: number | null;
  amount: number;
  fee?: number;
  cashBalance?: number | null;
  rawDescription?: string;
}

export interface YearBreakdownItem {
  year: number;
  invested: number;
  deposits?: number;
  withdrawals?: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  returnPercent: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
}

export interface SectorBreakdownItem {
  sector: string;
  value: number;
  invested: number;
  pnl: number;
  pnlPercent: number;
  percentOfPortfolio: number;
  holdingsCount: number;
}

export interface LastMonthStats {
  pnl: number;
  returnPercent: number;
  tradesCount: number;
  wins: number;
  losses: number;
  trades: Trade[];
}

export interface StrategyPerformance {
  strategy: string;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnL: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgPnL: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
}

export interface EquityPoint {
  date: string;
  tradeIndex: number;
  tradePnL: number;
  cumulativePnL: number;
  equity: number;
  ticker?: string;
}

export interface AnalyticsSummary {
  portfolioValue: number;
  totalInvested: number;
  cashBalance: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalDividends: number;

  totalTrades: number;
  activeTradesCount: number;
  closedTradesCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRatePercent: number;
  profitFactor: number;
  avgRiskRewardRatio: number;
  plannedRiskRewardRatio: number;
  expectancy: number;

  grossProfit: number;
  grossLoss: number;
  avgWinAmount: number;
  avgLossAmount: number;
  largestWin: number;
  largestLoss: number;
  openPositionCapital: number;
  totalCapitalAtRisk: number;

  yearBreakdown: YearBreakdownItem[];
  sectorBreakdown: SectorBreakdownItem[];
  lastMonthStats: LastMonthStats;

  equityCurve: EquityPoint[];
  dailyCalendarPnL: DailyPnL[];
  winLossDistribution: {
    wins: number;
    losses: number;
    breakeven: number;
  };
  strategyBreakdown: StrategyPerformance[];
}

export interface EngineRunLog {
  timestamp: string;
  status: 'SUCCESS' | 'ERROR';
  activeTradesChecked: number;
  stopLossTriggered: number;
  targetTriggered: number;
  messages: string[];
}

export interface EngineStatus {
  isRunning: boolean;
  isScheduled: boolean;
  lastRun: EngineRunLog | null;
  recentLogs: EngineRunLog[];
}

export interface StockQuote {
  ticker: string;
  price: number;
  name?: string;
  change?: number;
  changePercent?: number;
  currency?: string;
  marketState?: string;
  timestamp: string;
  isSimulated?: boolean;
}
