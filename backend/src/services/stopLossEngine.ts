import cron from 'node-cron';
import { Trade, ITrade } from '../models/Trade';
import { fetchMultipleQuotes, StockQuote } from './marketData';

export interface EngineRunLog {
  timestamp: Date;
  status: 'SUCCESS' | 'ERROR';
  activeTradesChecked: number;
  stopLossTriggered: number;
  targetTriggered: number;
  messages: string[];
}

// Keep history of last 20 engine runs
const executionLogs: EngineRunLog[] = [];
let cronTask: cron.ScheduledTask | null = null;
let isRunning = false;

/**
 * Core Stop-Loss execution logic
 */
export async function runStopLossCheck(): Promise<EngineRunLog> {
  if (isRunning) {
    return {
      timestamp: new Date(),
      status: 'SUCCESS',
      activeTradesChecked: 0,
      stopLossTriggered: 0,
      targetTriggered: 0,
      messages: ['Check skipped: previous check still in progress.'],
    };
  }

  isRunning = true;
  const messages: string[] = [];
  let stopLossCount = 0;
  let targetCount = 0;

  try {
    const activeTrades = await Trade.find({ status: 'ACTIVE' });

    if (activeTrades.length === 0) {
      const log: EngineRunLog = {
        timestamp: new Date(),
        status: 'SUCCESS',
        activeTradesChecked: 0,
        stopLossTriggered: 0,
        targetTriggered: 0,
        messages: ['No active trades to monitor.'],
      };
      recordLog(log);
      return log;
    }

    const tickers = activeTrades.map((t) => t.ticker);
    const quotes = await fetchMultipleQuotes(tickers);

    for (const trade of activeTrades) {
      const quote = quotes.get(trade.ticker.toUpperCase());
      if (!quote) continue;

      const currentPrice = quote.price;
      trade.currentPrice = currentPrice;
      trade.lastPriceUpdate = new Date();

      // Calculate unrealized PnL
      const diff = currentPrice - trade.buyPrice;
      trade.unrealizedPnL = Number((diff * trade.quantity).toFixed(2));
      trade.unrealizedPnLPercent = Number(((diff / trade.buyPrice) * 100).toFixed(2));

      // 1. Check Stop-Loss Trigger (Price drops to or below Stop-Loss)
      if (trade.stopLossPrice && trade.stopLossPrice > 0 && currentPrice <= trade.stopLossPrice) {
        trade.status = 'CLOSED';
        trade.sellPrice = currentPrice;
        trade.sellDate = new Date();
        trade.exitReason = 'STOP_LOSS';
        trade.realizedPnL = Number(((currentPrice - trade.buyPrice) * trade.quantity).toFixed(2));
        trade.realizedPnLPercent = Number((((currentPrice - trade.buyPrice) / trade.buyPrice) * 100).toFixed(2));

        stopLossCount++;
        const msg = `[STOP-LOSS HIT] Closed ${trade.ticker} x ${trade.quantity} @ $${currentPrice.toFixed(2)} (SL was $${trade.stopLossPrice}). Realized PnL: $${trade.realizedPnL.toFixed(2)} (${trade.realizedPnLPercent}%)`;
        messages.push(msg);
        console.warn(`[StopLossEngine] ${msg}`);
      }
      // 2. Check Take-Profit Target Trigger (Optional convenience if target is defined)
      else if (trade.targetPrice && currentPrice >= trade.targetPrice) {
        trade.status = 'CLOSED';
        trade.sellPrice = currentPrice;
        trade.sellDate = new Date();
        trade.exitReason = 'TARGET_REACHED';
        trade.realizedPnL = Number(((currentPrice - trade.buyPrice) * trade.quantity).toFixed(2));
        trade.realizedPnLPercent = Number((((currentPrice - trade.buyPrice) / trade.buyPrice) * 100).toFixed(2));

        targetCount++;
        const msg = `[TARGET HIT] Closed ${trade.ticker} x ${trade.quantity} @ $${currentPrice.toFixed(2)} (Target was $${trade.targetPrice}). Realized PnL: +$${trade.realizedPnL.toFixed(2)} (+${trade.realizedPnLPercent}%)`;
        messages.push(msg);
        console.info(`[StopLossEngine] ${msg}`);
      }

      await trade.save();
    }

    if (stopLossCount === 0 && targetCount === 0) {
      messages.push(`Checked ${activeTrades.length} active positions. All safety thresholds hold.`);
    }

    const log: EngineRunLog = {
      timestamp: new Date(),
      status: 'SUCCESS',
      activeTradesChecked: activeTrades.length,
      stopLossTriggered: stopLossCount,
      targetTriggered: targetCount,
      messages,
    };
    recordLog(log);
    return log;
  } catch (error: any) {
    const errorMsg = `Engine error: ${error?.message || error}`;
    console.error('[StopLossEngine]', errorMsg);
    const log: EngineRunLog = {
      timestamp: new Date(),
      status: 'ERROR',
      activeTradesChecked: 0,
      stopLossTriggered: 0,
      targetTriggered: 0,
      messages: [errorMsg],
    };
    recordLog(log);
    return log;
  } finally {
    isRunning = false;
  }
}

function recordLog(log: EngineRunLog) {
  executionLogs.unshift(log);
  if (executionLogs.length > 20) {
    executionLogs.pop();
  }
}

export function getEngineStatus() {
  return {
    isRunning,
    isScheduled: cronTask !== null,
    lastRun: executionLogs[0] || null,
    recentLogs: executionLogs.slice(0, 5),
  };
}

/**
 * Start the background Cron task (default every 30s)
 */
export function initStopLossCron(interval = '*/30 * * * * *') {
  if (cronTask) {
    cronTask.stop();
  }

  cronTask = cron.schedule(interval, async () => {
    try {
      await runStopLossCheck();
    } catch (err) {
      console.warn('[StopLossEngine] Cron interval error handled safely:', err);
    }
  });

  console.log(`[StopLossEngine] Background monitor initialized with schedule: ${interval}`);
}
