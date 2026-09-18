import { BlinkHolding, BlinkParsedStatement, BlinkTransactionItem, getTickerDetails } from './blinkParser';

export interface ConsolidatedPosition {
  ticker: string;
  assetName: string;
  sector: string;
  quantity: number;
  totalCost: number;
  weightedBuyPrice: number;
  firstBuyDate: string;
  lastBuyDate: string;
  reportPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  totalDividends: number;
}

export interface ConsolidatedClosedTrade {
  ticker: string;
  assetName: string;
  sector: string;
  quantity: number;
  buyPrice: number;
  buyDate: string;
  sellPrice: number;
  sellDate: string;
  realizedPnL: number;
  realizedPnLPercent: number;
  year: number;
  exitReason?: string;
  notes?: string;
}

export interface ConsolidatedPortfolioResult {
  clientName: string;
  statementDates: string[];
  latestStatementDate: string;
  earliestStatementDate: string;
  totalDeposited: number;
  totalWithdrawn: number;
  netInvestedCapital: number;
  totalDividends: number;
  totalTaxesPaid: number;
  cashBalance: number;
  totalHoldingsValue: number;
  totalPortfolioValue: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  totalPnL: number;
  activeHoldings: BlinkHolding[];
  closedTrades: ConsolidatedClosedTrade[];
  allTransactions: BlinkTransactionItem[];
  realizedPnLByYear: Record<number, { pnl: number; count: number; volume: number }>;
  statementsCount: number;
  warnings: string[];
}

/**
 * Consolidates multiple periodic statements into a single, continuous chronological portfolio.
 * Correctly reconstructs cost bases and realized profits across years.
 */
export function consolidateStatements(statements: BlinkParsedStatement[]): ConsolidatedPortfolioResult {
  if (!statements || statements.length === 0) {
    return {
      clientName: '',
      statementDates: [],
      latestStatementDate: '',
      earliestStatementDate: '',
      totalDeposited: 0,
      totalWithdrawn: 0,
      netInvestedCapital: 0,
      totalDividends: 0,
      totalTaxesPaid: 0,
      cashBalance: 0,
      totalHoldingsValue: 0,
      totalPortfolioValue: 0,
      totalRealizedPnL: 0,
      totalUnrealizedPnL: 0,
      totalPnL: 0,
      activeHoldings: [],
      closedTrades: [],
      allTransactions: [],
      realizedPnLByYear: {},
      statementsCount: 0,
      warnings: [],
    };
  }

  // 1. Sort statements chronologically
  const sortedStatements = [...statements].sort((a, b) =>
    (a.statementDate || '').localeCompare(b.statementDate || '')
  );

  const statementDates = sortedStatements.map((s) => s.statementDate).filter(Boolean);
  const earliestStatementDate = statementDates[0] || '';
  const latestStatementDate = statementDates[statementDates.length - 1] || '';
  const clientName = sortedStatements.find((s) => s.clientName)?.clientName || 'משקיע';

  // 2. Gather and deduplicate all transactions across statements
  const rawTxList: BlinkTransactionItem[] = [];
  const seenTxKeys = new Set<string>();

  for (const stmt of sortedStatements) {
    for (const tx of stmt.transactions || []) {
      // Key on date + action + ticker + abs(amount) + quantity
      const key = `${tx.date}_${tx.actionType}_${tx.ticker || ''}_${Math.abs(tx.amount || 0).toFixed(2)}_${(tx.quantity || 0).toFixed(4)}`;
      if (!seenTxKeys.has(key)) {
        seenTxKeys.add(key);
        rawTxList.push(tx);
      }
    }
  }

  // Sort transactions chronologically ascending
  rawTxList.sort((a, b) => {
    const dDiff = a.date.localeCompare(b.date);
    if (dDiff !== 0) return dDiff;
    // Put deposits/buys before sells on same date
    const order = (act: string) => {
      if (act.includes('הפקדה')) return 1;
      if (act.includes('קניה') || act.includes('קנייה')) return 2;
      if (act.includes('דיבידנד')) return 3;
      if (act.includes('מכירה')) return 4;
      return 5;
    };
    return order(a.actionType) - order(b.actionType);
  });

  // Track positions over time (ticker -> inventory)
  interface PositionInventory {
    ticker: string;
    assetName: string;
    sector: string;
    shares: number;
    totalCost: number;
    firstBuyDate: string;
    lastBuyDate: string;
    dividends: number;
  }

  const positions = new Map<string, PositionInventory>();
  const closedTrades: ConsolidatedClosedTrade[] = [];
  let totalDeposited = 0;
  let totalWithdrawn = 0;
  let totalTaxesPaid = 0;
  let totalDividends = 0;

  // Process transactions chronologically
  for (const tx of rawTxList) {
    const act = (tx.actionType || '').trim();
    const ticker = tx.ticker ? tx.ticker.trim().toUpperCase() : '';

    if (act.includes('הפקדה') || act.toLowerCase().includes('deposit')) {
      totalDeposited += Math.abs(tx.amount || 0);
    } else if (act.includes('משיכה') || act.toLowerCase().includes('withdrawal')) {
      totalWithdrawn += Math.abs(tx.amount || 0);
    } else if (act.includes('מס') || act.toLowerCase().includes('tax')) {
      totalTaxesPaid += Math.abs(tx.amount || 0);
    } else if (act.includes('דיבידנד') || act.toLowerCase().includes('dividend')) {
      const divAmt = Math.abs(tx.amount || 0);
      totalDividends += divAmt;
      if (ticker) {
        const p = positions.get(ticker);
        if (p) p.dividends += divAmt;
      }
    } else if (act.includes('קניה') || act.includes('קנייה') || act.toLowerCase().includes('buy')) {
      const qty = Math.abs(Number(tx.quantity || 0));
      const price = Math.abs(Number(tx.price || 0));
      const cost = Math.abs(Number(tx.amount || qty * price));

      if (ticker && qty > 0) {
        const meta = getTickerDetails(ticker);
        const p = positions.get(ticker) || {
          ticker,
          assetName: tx.assetName || meta.name,
          sector: meta.sector,
          shares: 0,
          totalCost: 0,
          firstBuyDate: tx.date,
          lastBuyDate: tx.date,
          dividends: 0,
        };

        p.shares = Number((p.shares + qty).toFixed(4));
        p.totalCost = Number((p.totalCost + (cost > 0 ? cost : qty * price)).toFixed(2));
        p.lastBuyDate = tx.date;
        positions.set(ticker, p);
      }
    } else if (act.includes('מכירה') || act.toLowerCase().includes('sell')) {
      const qty = Math.abs(Number(tx.quantity || 0));
      const sellPrice = Math.abs(Number(tx.price || 0));
      const proceeds = Math.abs(Number(tx.amount || qty * sellPrice));

      if (ticker && qty > 0) {
        const meta = getTickerDetails(ticker);
        const p = positions.get(ticker);

        // If we have purchase history for this stock
        let weightedBuyPrice = sellPrice;
        let buyDate = tx.date;

        if (p && p.shares > 0) {
          weightedBuyPrice = Number((p.totalCost / p.shares).toFixed(4));
          buyDate = p.firstBuyDate;

          const costOfSold = Number((qty * weightedBuyPrice).toFixed(2));
          p.shares = Number(Math.max(0, p.shares - qty).toFixed(4));
          p.totalCost = Number(Math.max(0, p.totalCost - costOfSold).toFixed(2));
        } else {
          // If sold without preceding buy in the uploaded files (e.g. bought before earliest statement)
          const earliestStmt = sortedStatements[0];
          const initialHolding = (earliestStmt?.holdings || []).find((h) => h.ticker === ticker);
          if (initialHolding && initialHolding.reportPrice) {
            weightedBuyPrice = initialHolding.reportPrice;
          }
        }

        const costBasis = Number((qty * weightedBuyPrice).toFixed(2));
        const realizedGain = Number((proceeds - costBasis).toFixed(2));
        const realizedGainPct = weightedBuyPrice > 0 ? Number((((sellPrice - weightedBuyPrice) / weightedBuyPrice) * 100).toFixed(2)) : 0;
        const sellYear = tx.date ? parseInt(tx.date.substring(0, 4), 10) : new Date().getFullYear();

        closedTrades.push({
          ticker,
          assetName: tx.assetName || meta.name,
          sector: meta.sector,
          quantity: qty,
          buyPrice: weightedBuyPrice,
          buyDate,
          sellPrice,
          sellDate: tx.date,
          realizedPnL: realizedGain,
          realizedPnLPercent: realizedGainPct,
          year: sellYear,
          exitReason: 'MANUAL_EXIT',
          notes: `נמכר בתאריך ${tx.date} במחיר $${sellPrice.toFixed(2)} (מחיר קניה משוקלל: $${weightedBuyPrice.toFixed(2)})`,
        });
      }
    }
  }

  // 3. Connect ending snapshot from the latest statement
  const latestStmt = sortedStatements[sortedStatements.length - 1];
  const cashBalance = latestStmt.cashBalance != null ? latestStmt.cashBalance : 0;

  // Reconcile open holdings
  const activeHoldings: BlinkHolding[] = [];
  const processedTickers = new Set<string>();

  for (const h of latestStmt.holdings || []) {
    const ticker = h.ticker.trim().toUpperCase();
    processedTickers.add(ticker);
    const meta = getTickerDetails(ticker);
    const p = positions.get(ticker);

    let finalQty = h.quantity;
    let trueBuyPrice = h.reportPrice;
    let dividendsForHolding = 0;

    if (p && p.shares > 0.0001) {
      finalQty = p.shares;
      trueBuyPrice = Number((p.totalCost / p.shares).toFixed(4));
      dividendsForHolding = p.dividends;
    } else if (h.buyPrice && h.buyPrice > 0) {
      trueBuyPrice = h.buyPrice;
    }

    const reportPrice = h.reportPrice || trueBuyPrice;
    const value = Number((finalQty * reportPrice).toFixed(2));
    const totalCost = Number((finalQty * trueBuyPrice).toFixed(2));
    const unrealizedPnL = Number((value - totalCost).toFixed(2));
    const unrealizedPnLPercent = trueBuyPrice > 0 ? Number((((reportPrice - trueBuyPrice) / trueBuyPrice) * 100).toFixed(2)) : 0;

    activeHoldings.push({
      ticker,
      assetName: h.assetName || meta.name,
      sector: h.sector || meta.sector,
      quantity: finalQty,
      reportPrice,
      buyPrice: trueBuyPrice,
      value,
      portfolioPercent: 0,
      unrealizedPnL,
      unrealizedPnLPercent,
      dividends: dividendsForHolding,
    });
  }

  // Check if any position in our ledger still has shares > 0 that was omitted from latest holdings
  for (const [ticker, p] of positions.entries()) {
    if (!processedTickers.has(ticker) && p.shares > 0.001) {
      const meta = getTickerDetails(ticker);
      const trueBuyPrice = Number((p.totalCost / p.shares).toFixed(4));
      const value = Number((p.shares * trueBuyPrice).toFixed(2));

      activeHoldings.push({
        ticker,
        assetName: p.assetName || meta.name,
        sector: p.sector || meta.sector,
        quantity: p.shares,
        reportPrice: trueBuyPrice,
        buyPrice: trueBuyPrice,
        value,
        portfolioPercent: 0,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        dividends: p.dividends,
      });
    }
  }

  // Calculate total holdings value and portfolio value
  const totalHoldingsValue = Number(activeHoldings.reduce((sum, h) => sum + h.value, 0).toFixed(2));
  const totalPortfolioValue = Number((totalHoldingsValue + cashBalance).toFixed(2));

  // Update portfolio percentages
  if (totalPortfolioValue > 0) {
    for (const h of activeHoldings) {
      h.portfolioPercent = Number(((h.value / totalPortfolioValue) * 100).toFixed(2));
    }
  }

  // Realized PnL breakdown by year
  const realizedPnLByYear: Record<number, { pnl: number; count: number; volume: number }> = {};
  let totalRealizedPnL = 0;

  for (const ct of closedTrades) {
    totalRealizedPnL = Number((totalRealizedPnL + ct.realizedPnL).toFixed(2));
    const yr = ct.year || new Date(ct.sellDate).getFullYear();
    if (!realizedPnLByYear[yr]) {
      realizedPnLByYear[yr] = { pnl: 0, count: 0, volume: 0 };
    }
    realizedPnLByYear[yr].pnl = Number((realizedPnLByYear[yr].pnl + ct.realizedPnL).toFixed(2));
    realizedPnLByYear[yr].count += 1;
    realizedPnLByYear[yr].volume = Number((realizedPnLByYear[yr].volume + (ct.sellPrice * ct.quantity)).toFixed(2));
  }

  const totalUnrealizedPnL = Number(activeHoldings.reduce((sum, h) => sum + (h.unrealizedPnL || 0), 0).toFixed(2));
  const totalPnL = Number((totalRealizedPnL + totalUnrealizedPnL + totalDividends).toFixed(2));
  const netInvestedCapital = Number((totalDeposited - totalWithdrawn).toFixed(2));

  return {
    clientName,
    statementDates,
    latestStatementDate,
    earliestStatementDate,
    totalDeposited: Number(totalDeposited.toFixed(2)),
    totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
    netInvestedCapital,
    totalDividends: Number(totalDividends.toFixed(2)),
    totalTaxesPaid: Number(totalTaxesPaid.toFixed(2)),
    cashBalance: Number(cashBalance.toFixed(2)),
    totalHoldingsValue,
    totalPortfolioValue,
    totalRealizedPnL,
    totalUnrealizedPnL,
    totalPnL,
    activeHoldings,
    closedTrades,
    allTransactions: rawTxList,
    realizedPnLByYear,
    statementsCount: sortedStatements.length,
    warnings: [],
  };
}
