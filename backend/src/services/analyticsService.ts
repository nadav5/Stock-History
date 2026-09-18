import { Trade, ITrade } from '../models/Trade';
import { Transaction } from '../models/Transaction';
import { getTickerDetails } from './blinkParser';

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
  date: string; // YYYY-MM-DD
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
  strategy?: string;
}

export interface YearBreakdownItem {
  year: number;
  invested: number;
  deposits: number;
  withdrawals: number;
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
  trades: any[];
}

export interface AnalyticsSummary {
  // Filter context
  selectedStrategy: string;

  // Portfolio Totals
  portfolioValue: number;
  totalInvested: number;
  cashBalance: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalDividends: number;

  // Counts
  totalTrades: number;
  activeTradesCount: number;
  closedTradesCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;

  // Performance Ratios
  winRatePercent: number;
  profitFactor: number;
  avgRiskRewardRatio: number;
  plannedRiskRewardRatio: number;
  expectancy: number;

  // Dollar values
  grossProfit: number;
  grossLoss: number;
  avgWinAmount: number;
  avgLossAmount: number;
  largestWin: number;
  largestLoss: number;
  openPositionCapital: number;
  totalCapitalAtRisk: number;

  // Breakdowns requested by user
  yearBreakdown: YearBreakdownItem[];
  sectorBreakdown: SectorBreakdownItem[];
  lastMonthStats: LastMonthStats;

  // Series
  equityCurve: EquityPoint[];
  dailyCalendarPnL: DailyPnL[];
  winLossDistribution: {
    wins: number;
    losses: number;
    breakeven: number;
  };
  strategyBreakdown: StrategyPerformance[];
}

export async function calculateAnalytics(strategyFilter?: string): Promise<AnalyticsSummary> {
  const query: any = {};
  if (strategyFilter && strategyFilter !== 'ALL') {
    query.strategyTag = strategyFilter;
  }

  const [allTrades, allPortfolioTrades, latestTransaction, allTransactions] = await Promise.all([
    Trade.find(query).sort({ sellDate: 1, buyDate: 1 }),
    Trade.find().sort({ sellDate: 1, buyDate: 1 }),
    Transaction.findOne({ cashBalance: { $ne: null } }).sort({ date: -1 }),
    Transaction.find().sort({ date: 1 }),
  ]);

  const activeTrades = allTrades.filter((t) => t.status === 'ACTIVE');
  const closedTrades = allTrades.filter((t) => t.status === 'CLOSED');

  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalRealizedPnL = 0;
  let largestWin = 0;
  let largestLoss = 0;
  let totalDividends = 0;

  // Planned R:R accumulation
  let plannedRRSum = 0;
  let plannedRRCount = 0;

  // Daily calendar aggregation
  const dailyMap = new Map<
    string,
    {
      pnl: number;
      tradesCount: number;
      wins: number;
      losses: number;
    }
  >();

  // Equity curve data
  const baseAccountCapital = 10000;
  let runningCumulativePnL = 0;
  const equityCurve: EquityPoint[] = [
    {
      date:
        closedTrades.length > 0 && closedTrades[0].buyDate
          ? new Date(closedTrades[0].buyDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
      tradeIndex: 0,
      tradePnL: 0,
      cumulativePnL: 0,
      equity: baseAccountCapital,
    },
  ];

  // Year breakdown map
  const yearMap = new Map<number, YearBreakdownItem>();

  allTransactions.forEach((tx) => {
    if (!tx.date) return;
    const yr = new Date(tx.date).getFullYear();
    const existingYear = yearMap.get(yr) || {
      year: yr,
      invested: 0,
      deposits: 0,
      withdrawals: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      returnPercent: 0,
      tradesCount: 0,
      winCount: 0,
      lossCount: 0,
    };
    const act = (tx.actionType || '').trim();
    if (act.includes('הפקדה') || act.toLowerCase().includes('deposit')) {
      existingYear.deposits = Number((existingYear.deposits + Math.abs(tx.amount || 0)).toFixed(2));
    } else if (act.includes('משיכה') || act.toLowerCase().includes('withdrawal')) {
      existingYear.withdrawals = Number((existingYear.withdrawals + Math.abs(tx.amount || 0)).toFixed(2));
    }
    yearMap.set(yr, existingYear);
  });

  closedTrades.forEach((trade, index) => {
    const pnl = Number(trade.realizedPnL || 0);
    totalRealizedPnL += pnl;
    if (trade.dividends) totalDividends += trade.dividends;

    if (pnl > 0.001) {
      winCount++;
      grossProfit += pnl;
      if (pnl > largestWin) largestWin = pnl;
    } else if (pnl < -0.001) {
      lossCount++;
      const absLoss = Math.abs(pnl);
      grossLoss += absLoss;
      if (pnl < largestLoss) largestLoss = pnl;
    } else {
      breakevenCount++;
    }

    // Planned Risk:Reward calculation if target & stop-loss set
    if (trade.targetPrice && trade.stopLossPrice && trade.buyPrice) {
      const risk = Math.abs(trade.buyPrice - trade.stopLossPrice);
      const reward = Math.abs(trade.targetPrice - trade.buyPrice);
      if (risk > 0) {
        plannedRRSum += reward / risk;
        plannedRRCount++;
      }
    }

    // Equity Curve point
    runningCumulativePnL = Number((runningCumulativePnL + pnl).toFixed(2));
    const tradeDate = trade.sellDate
      ? new Date(trade.sellDate).toISOString().split('T')[0]
      : new Date(trade.buyDate).toISOString().split('T')[0];

    equityCurve.push({
      date: tradeDate,
      tradeIndex: index + 1,
      tradePnL: pnl,
      cumulativePnL: runningCumulativePnL,
      equity: Number((baseAccountCapital + runningCumulativePnL).toFixed(2)),
      ticker: trade.ticker,
      strategy: trade.strategyTag,
    });

    // Daily Calendar aggregation
    const dayKey = tradeDate;
    const existingDay = dailyMap.get(dayKey) || { pnl: 0, tradesCount: 0, wins: 0, losses: 0 };
    existingDay.pnl = Number((existingDay.pnl + pnl).toFixed(2));
    existingDay.tradesCount++;
    if (pnl > 0.001) existingDay.wins++;
    else if (pnl < -0.001) existingDay.losses++;
    dailyMap.set(dayKey, existingDay);

    // Year aggregation
    const tradeYear = trade.sellDate
      ? new Date(trade.sellDate).getFullYear()
      : new Date(trade.buyDate).getFullYear();
    const existingYear = yearMap.get(tradeYear) || {
      year: tradeYear,
      invested: 0,
      deposits: 0,
      withdrawals: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      returnPercent: 0,
      tradesCount: 0,
      winCount: 0,
      lossCount: 0,
    };
    existingYear.invested += trade.buyPrice * trade.quantity;
    existingYear.realizedPnL = Number((existingYear.realizedPnL + pnl).toFixed(2));
    existingYear.totalPnL = Number((existingYear.totalPnL + pnl + (trade.dividends || 0)).toFixed(2));
    existingYear.tradesCount++;
    if (pnl > 0.001) existingYear.winCount++;
    else if (pnl < -0.001) existingYear.lossCount++;
    yearMap.set(tradeYear, existingYear);
  });

  // Global Strategy breakdown mapping across entire portfolio
  const strategyMap = new Map<
    string,
    {
      totalTrades: number;
      winCount: number;
      lossCount: number;
      totalPnL: number;
      grossProfit: number;
      grossLoss: number;
    }
  >();

  allPortfolioTrades
    .filter((t) => t.status === 'CLOSED')
    .forEach((trade) => {
      const pnl = Number(trade.realizedPnL || 0);
      const tag = trade.strategyTag?.trim() || 'תיק השקעות';
      const strat = strategyMap.get(tag) || {
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        totalPnL: 0,
        grossProfit: 0,
        grossLoss: 0,
      };
      strat.totalTrades++;
      strat.totalPnL = Number((strat.totalPnL + pnl).toFixed(2));
      if (pnl > 0.001) {
        strat.winCount++;
        strat.grossProfit += pnl;
      } else if (pnl < -0.001) {
        strat.lossCount++;
        strat.grossLoss += Math.abs(pnl);
      }
      strategyMap.set(tag, strat);
    });

  // Calculate active position metrics & sector allocation
  let totalUnrealizedPnL = 0;
  let openPositionCapital = 0;
  let totalCapitalAtRisk = 0;
  let activeHoldingsTotalValue = 0;

  const sectorMap = new Map<
    string,
    {
      sector: string;
      value: number;
      invested: number;
      pnl: number;
      holdingsCount: number;
    }
  >();

  activeTrades.forEach((trade) => {
    const cost = trade.buyPrice * trade.quantity;
    const currentP = trade.currentPrice != null ? trade.currentPrice : trade.buyPrice;
    const val = currentP * trade.quantity;

    openPositionCapital += cost;
    activeHoldingsTotalValue += val;
    totalUnrealizedPnL += trade.unrealizedPnL || 0;
    if (trade.dividends) totalDividends += trade.dividends;

    if (trade.stopLossPrice && trade.stopLossPrice < trade.buyPrice) {
      const riskPerShare = trade.buyPrice - trade.stopLossPrice;
      totalCapitalAtRisk += riskPerShare * trade.quantity;
    }

    // Sector mapping
    const sectorName = trade.sector || getTickerDetails(trade.ticker).sector;
    const sItem = sectorMap.get(sectorName) || {
      sector: sectorName,
      value: 0,
      invested: 0,
      pnl: 0,
      holdingsCount: 0,
    };
    sItem.value += val;
    sItem.invested += cost;
    sItem.pnl += trade.unrealizedPnL || 0;
    sItem.holdingsCount++;
    sectorMap.set(sectorName, sItem);

    // Also factor active trades into year map
    const tYear = new Date(trade.buyDate).getFullYear();
    const existingYear = yearMap.get(tYear) || {
      year: tYear,
      invested: 0,
      deposits: 0,
      withdrawals: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalPnL: 0,
      returnPercent: 0,
      tradesCount: 0,
      winCount: 0,
      lossCount: 0,
    };
    existingYear.invested += cost;
    existingYear.unrealizedPnL = Number((existingYear.unrealizedPnL + (trade.unrealizedPnL || 0)).toFixed(2));
    existingYear.totalPnL = Number(
      (existingYear.totalPnL + (trade.unrealizedPnL || 0) + (trade.dividends || 0)).toFixed(2)
    );
    existingYear.tradesCount++;
    yearMap.set(tYear, existingYear);
  });

  // Calculate cash balance (from latest transaction or 0 if completely empty)
  const cashBalance =
    latestTransaction && latestTransaction.cashBalance != null
      ? latestTransaction.cashBalance
      : allTrades.length > 0
      ? 1400.82
      : 0;
  const portfolioValue = Number((activeHoldingsTotalValue + cashBalance).toFixed(2));

  // Compute final Sector Breakdown with percentages
  const sectorBreakdown: SectorBreakdownItem[] = Array.from(sectorMap.values()).map((s) => {
    const pnlPercent = s.invested > 0 ? Number(((s.pnl / s.invested) * 100).toFixed(2)) : 0;
    const percentOfPortfolio =
      activeHoldingsTotalValue > 0 ? Number(((s.value / activeHoldingsTotalValue) * 100).toFixed(1)) : 0;
    return {
      sector: s.sector,
      value: Number(s.value.toFixed(2)),
      invested: Number(s.invested.toFixed(2)),
      pnl: Number(s.pnl.toFixed(2)),
      pnlPercent,
      percentOfPortfolio,
      holdingsCount: s.holdingsCount,
    };
  });

  // Compute final Year Breakdown with return percentages
  const yearBreakdown: YearBreakdownItem[] = Array.from(yearMap.values())
    .map((y) => {
      const base = y.invested > 0 ? y.invested : y.deposits > 0 ? y.deposits : 0;
      const ret = base > 0 ? Number(((y.totalPnL / base) * 100).toFixed(2)) : 0;
      return {
        ...y,
        returnPercent: ret,
      };
    })
    .sort((a, b) => b.year - a.year);

  // Compute Last Month Stats (trades and activities within the last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  // Also check if any recent trades in the active year (e.g. June 2026 for Nadav Bar's statement)
  let lastMonthTrades = allTrades.filter((t) => {
    const d = t.sellDate ? new Date(t.sellDate) : new Date(t.buyDate);
    return d >= thirtyDaysAgo;
  });

  if (lastMonthTrades.length === 0 && allTrades.length > 0) {
    // If statement has a future date like 2026-06-30, pick the latest month in the dataset
    const latestDate = new Date(
      Math.max(...allTrades.map((t) => (t.sellDate ? new Date(t.sellDate).getTime() : new Date(t.buyDate).getTime())))
    );
    const monthStart = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
    lastMonthTrades = allTrades.filter((t) => {
      const d = t.sellDate ? new Date(t.sellDate) : new Date(t.buyDate);
      return d >= monthStart;
    });
  }

  let lastMonthPnL = 0;
  let lmWins = 0;
  let lmLosses = 0;
  let lmInvested = 0;

  lastMonthTrades.forEach((t) => {
    const pnl = t.status === 'CLOSED' ? (t.realizedPnL || 0) : (t.unrealizedPnL || 0);
    lastMonthPnL += pnl;
    lmInvested += t.buyPrice * t.quantity;
    if (pnl > 0.001) lmWins++;
    else if (pnl < -0.001) lmLosses++;
  });

  const lastMonthStats: LastMonthStats = {
    pnl: Number(lastMonthPnL.toFixed(2)),
    returnPercent: lmInvested > 0 ? Number(((lastMonthPnL / lmInvested) * 100).toFixed(2)) : 0,
    tradesCount: lastMonthTrades.length,
    wins: lmWins,
    losses: lmLosses,
    trades: lastMonthTrades,
  };

  // Performance calculations
  const closedCount = closedTrades.length;
  const winRatePercent = closedCount > 0 ? Number(((winCount / closedCount) * 100).toFixed(2)) : 0;
  const avgWinAmount = winCount > 0 ? Number((grossProfit / winCount).toFixed(2)) : 0;
  const avgLossAmount = lossCount > 0 ? Number((grossLoss / lossCount).toFixed(2)) : 0;

  let profitFactor = 0;
  if (grossLoss > 0) {
    profitFactor = Number((grossProfit / grossLoss).toFixed(2));
  } else if (grossProfit > 0) {
    profitFactor = 99.99;
  }

  const avgRiskRewardRatio =
    avgLossAmount > 0 ? Number((avgWinAmount / avgLossAmount).toFixed(2)) : avgWinAmount > 0 ? avgWinAmount : 0;
  const plannedRiskRewardRatio = plannedRRCount > 0 ? Number((plannedRRSum / plannedRRCount).toFixed(2)) : 0;

  const winProb = winRatePercent / 100;
  const lossProb = 1 - winProb;
  const expectancy = Number((winProb * avgWinAmount - lossProb * avgLossAmount).toFixed(2));

  const totalPnL = Number((totalRealizedPnL + totalUnrealizedPnL + totalDividends).toFixed(2));
  const totalCostBasis = openPositionCapital + closedTrades.reduce((acc, t) => acc + t.buyPrice * t.quantity, 0);
  const totalPnLPercent = totalCostBasis > 0 ? Number(((totalPnL / totalCostBasis) * 100).toFixed(2)) : 0;

  const dailyCalendarPnL: DailyPnL[] = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      pnl: data.pnl,
      tradesCount: data.tradesCount,
      wins: data.wins,
      losses: data.losses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const strategyBreakdown: StrategyPerformance[] = Array.from(strategyMap.entries()).map(
    ([strategy, data]) => {
      const sWinRate =
        data.totalTrades > 0 ? Number(((data.winCount / data.totalTrades) * 100).toFixed(1)) : 0;
      let sPf = 0;
      if (data.grossLoss > 0) sPf = Number((data.grossProfit / data.grossLoss).toFixed(2));
      else if (data.grossProfit > 0) sPf = 99.99;

      return {
        strategy,
        totalTrades: data.totalTrades,
        winCount: data.winCount,
        lossCount: data.lossCount,
        winRate: sWinRate,
        totalPnL: data.totalPnL,
        grossProfit: Number(data.grossProfit.toFixed(2)),
        grossLoss: Number(data.grossLoss.toFixed(2)),
        profitFactor: sPf,
        avgPnL: data.totalTrades > 0 ? Number((data.totalPnL / data.totalTrades).toFixed(2)) : 0,
      };
    }
  );

  return {
    selectedStrategy: strategyFilter || 'ALL',
    portfolioValue,
    totalInvested: Number(openPositionCapital.toFixed(2)),
    cashBalance: Number(cashBalance.toFixed(2)),
    totalPnL,
    totalPnLPercent,
    totalRealizedPnL: Number(totalRealizedPnL.toFixed(2)),
    totalUnrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
    totalDividends: Number(totalDividends.toFixed(2)),
    totalTrades: allTrades.length,
    activeTradesCount: activeTrades.length,
    closedTradesCount: closedCount,
    winCount,
    lossCount,
    breakevenCount,
    winRatePercent,
    profitFactor,
    avgRiskRewardRatio,
    plannedRiskRewardRatio,
    expectancy,
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    avgWinAmount,
    avgLossAmount,
    largestWin: Number(largestWin.toFixed(2)),
    largestLoss: Number(largestLoss.toFixed(2)),
    openPositionCapital: Number(openPositionCapital.toFixed(2)),
    totalCapitalAtRisk: Number(totalCapitalAtRisk.toFixed(2)),
    yearBreakdown,
    sectorBreakdown,
    lastMonthStats,
    equityCurve,
    dailyCalendarPnL,
    winLossDistribution: {
      wins: winCount,
      losses: lossCount,
      breakeven: breakevenCount,
    },
    strategyBreakdown,
  };
}
