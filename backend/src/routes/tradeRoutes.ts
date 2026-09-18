import express, { Request, Response } from 'express';
import { Trade } from '../models/Trade';
import { Transaction } from '../models/Transaction';
import { calculateAnalytics } from '../services/analyticsService';
import { fetchStockQuote } from '../services/marketData';
import { getTickerDetails, NADAV_BAR_BLINK_STATEMENT } from '../services/blinkParser';

const router = express.Router();

/**
 * GET /api/trades/analytics
 * Must be registered BEFORE /api/trades/:id
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { strategy } = req.query;
    const analytics = await calculateAnalytics(typeof strategy === 'string' ? strategy : undefined);
    return res.json(analytics);
  } catch (error: any) {
    console.error('Error computing analytics:', error);
    return res.status(500).json({ error: 'Failed to compute analytics', details: error.message });
  }
});

/**
 * GET /api/trades/transactions
 * Retrieve all account transactions (Blink ledger)
 */
router.get('/transactions', async (_req: Request, res: Response) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1, createdAt: -1 });
    return res.json(transactions);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
});

/**
 * DELETE /api/trades/reset
 * Clear all trades and transactions (clean slate)
 */
router.delete('/reset', async (_req: Request, res: Response) => {
  try {
    await Promise.all([Trade.deleteMany({}), Transaction.deleteMany({})]);
    return res.json({ success: true, message: 'All portfolio data and transactions cleared successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reset portfolio', details: error.message });
  }
});

/**
 * POST /api/trades/seed-blink
 * Deprecated: All data is loaded directly from user documents via /api/import/parse-document
 */
router.post('/seed-blink', async (_req: Request, res: Response) => {
  return res.status(400).json({
    error: 'טעינה אוטומטית מובנית בוטלה. אנא העלה את קובץ הדוח שלך דרך כפתור "טעינת דוח Blink / מסמך" לקליטה דינמית.',
  });
});

/**
 * GET /api/trades
 * Filter by status ('ACTIVE' | 'CLOSED'), sector, or search term
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, sector, search } = req.query;
    const filter: any = {};

    if (status && (status === 'ACTIVE' || status === 'CLOSED')) {
      filter.status = status;
    }

    if (sector && typeof sector === 'string' && sector !== 'ALL') {
      filter.sector = sector;
    }

    if (search && typeof search === 'string') {
      filter.$or = [
        { ticker: { $regex: search.trim().toUpperCase(), $options: 'i' } },
        { assetName: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const trades = await Trade.find(filter).sort({ buyDate: -1, createdAt: -1 });
    return res.json(trades);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch trades', details: error.message });
  }
});

/**
 * GET /api/trades/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    return res.json(trade);
  } catch (error: any) {
    return res.status(500).json({ error: 'Error fetching trade', details: error.message });
  }
});

/**
 * POST /api/trades
 * Create a new trade position (simple 4-field friendly)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      ticker,
      buyPrice,
      quantity,
      buyDate,
      stopLossPrice,
      targetPrice,
      strategyTag,
      notes,
      assetName,
      sector,
      dividends,
      type = 'BUY',
    } = req.body;

    if (!ticker || buyPrice == null || quantity == null) {
      return res.status(400).json({
        error: 'Missing required trade parameters: ticker, buyPrice, quantity',
      });
    }

    const cleanTicker = ticker.trim().toUpperCase();
    const numBuyPrice = Number(buyPrice);
    const numQuantity = Number(quantity);
    const numStopLoss = stopLossPrice != null && stopLossPrice !== '' ? Number(stopLossPrice) : 0;
    const numTarget = targetPrice != null && targetPrice !== '' ? Number(targetPrice) : undefined;
    const numDividends = dividends != null ? Number(dividends) : 0;

    // Auto-resolve details
    const tickerMeta = getTickerDetails(cleanTicker);
    const resolvedName = assetName && assetName.trim() ? assetName.trim() : tickerMeta.name;
    const resolvedSector = sector && sector.trim() ? sector.trim() : tickerMeta.sector;

    // Fetch initial market quote if possible
    let currentPrice = numBuyPrice;
    try {
      const quote = await fetchStockQuote(cleanTicker);
      if (quote && quote.price) {
        currentPrice = quote.price;
      }
    } catch {
      // Keep buyPrice as initial
    }

    const unrealizedDiff = currentPrice - numBuyPrice;
    const unrealizedPnL = Number((unrealizedDiff * numQuantity).toFixed(2));
    const unrealizedPnLPercent = Number(((unrealizedDiff / numBuyPrice) * 100).toFixed(2));

    const trade = new Trade({
      ticker: cleanTicker,
      assetName: resolvedName,
      sector: resolvedSector,
      status: 'ACTIVE',
      type,
      buyPrice: numBuyPrice,
      quantity: numQuantity,
      buyDate: buyDate ? new Date(buyDate) : new Date(),
      stopLossPrice: numStopLoss,
      targetPrice: numTarget,
      currentPrice,
      unrealizedPnL,
      unrealizedPnLPercent,
      dividends: numDividends,
      source: 'MANUAL',
      lastPriceUpdate: new Date(),
      strategyTag: strategyTag?.trim() || resolvedSector,
      notes: notes || '',
    });

    const savedTrade = await trade.save();
    return res.status(201).json(savedTrade);
  } catch (error: any) {
    console.error('Error creating trade:', error);
    return res.status(500).json({ error: 'Failed to create trade', details: error.message });
  }
});

/**
 * PUT /api/trades/:id
 * Update an existing trade
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const {
      buyPrice,
      quantity,
      stopLossPrice,
      targetPrice,
      strategyTag,
      notes,
      buyDate,
      assetName,
      sector,
      currentPrice,
      dividends,
    } = req.body;

    if (buyPrice != null) trade.buyPrice = Number(buyPrice);
    if (quantity != null) trade.quantity = Number(quantity);
    if (stopLossPrice !== undefined) trade.stopLossPrice = Number(stopLossPrice);
    if (targetPrice !== undefined) trade.targetPrice = targetPrice ? Number(targetPrice) : undefined;
    if (strategyTag) trade.strategyTag = strategyTag.trim();
    if (notes !== undefined) trade.notes = notes;
    if (buyDate) trade.buyDate = new Date(buyDate);
    if (assetName) trade.assetName = assetName.trim();
    if (sector) trade.sector = sector.trim();
    if (dividends != null) trade.dividends = Number(dividends);
    if (currentPrice != null) trade.currentPrice = Number(currentPrice);

    // Recalculate unrealized if active
    if (trade.status === 'ACTIVE' && trade.currentPrice != null) {
      const diff = trade.currentPrice - trade.buyPrice;
      trade.unrealizedPnL = Number((diff * trade.quantity).toFixed(2));
      trade.unrealizedPnLPercent = Number(((diff / trade.buyPrice) * 100).toFixed(2));
    }

    const updatedTrade = await trade.save();
    return res.json(updatedTrade);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update trade', details: error.message });
  }
});

/**
 * POST /api/trades/:id/close
 * Manually sell / exit an active position
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const trade = await Trade.findById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.status === 'CLOSED') {
      return res.status(400).json({ error: 'Trade is already closed' });
    }

    const { sellPrice, sellDate, exitReason } = req.body;

    let finalSellPrice = sellPrice != null ? Number(sellPrice) : trade.currentPrice;
    if (!finalSellPrice) {
      const quote = await fetchStockQuote(trade.ticker);
      finalSellPrice = quote.price;
    }

    trade.status = 'CLOSED';
    trade.sellPrice = Number(finalSellPrice);
    trade.sellDate = sellDate ? new Date(sellDate) : new Date();
    trade.exitReason = exitReason || 'MANUAL_EXIT';

    const pnl = (trade.sellPrice - trade.buyPrice) * trade.quantity;
    trade.realizedPnL = Number(pnl.toFixed(2));
    trade.realizedPnLPercent = Number((((trade.sellPrice - trade.buyPrice) / trade.buyPrice) * 100).toFixed(2));
    trade.unrealizedPnL = 0;
    trade.unrealizedPnLPercent = 0;

    const closedTrade = await trade.save();
    return res.json(closedTrade);
  } catch (error: any) {
    console.error('Error closing trade:', error);
    return res.status(500).json({ error: 'Failed to close trade', details: error.message });
  }
});

/**
 * DELETE /api/trades/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await Trade.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    return res.json({ message: 'Trade deleted successfully', id: req.params.id });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete trade', details: error.message });
  }
});

export default router;
