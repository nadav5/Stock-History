import express, { Request, Response } from 'express';
import { fetchStockQuote, overrideQuotePrice } from '../services/marketData';

const router = express.Router();

/**
 * GET /api/market/quote/:ticker
 * Returns real-time market quote using yahoo-finance2
 */
router.get('/quote/:ticker', async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker symbol required' });
    }

    const quote = await fetchStockQuote(ticker);
    return res.json(quote);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch quote', details: error.message });
  }
});

/**
 * POST /api/market/override
 * Overrides a ticker's price for simulation/testing (e.g. testing stop loss execution)
 */
router.post('/override', (req: Request, res: Response) => {
  try {
    const { ticker, price } = req.body;
    if (!ticker || price == null) {
      return res.status(400).json({ error: 'ticker and price are required' });
    }

    const quote = overrideQuotePrice(ticker, Number(price));
    return res.json({ message: `Price override set for ${ticker} -> $${price}`, quote });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to override price', details: error.message });
  }
});

/**
 * POST /api/market/refresh-all
 * Triggers live price refresh for all active trades in portfolio
 */
router.post('/refresh-all', async (_req: Request, res: Response) => {
  try {
    const { refreshActiveTradesPrices } = require('../services/marketData');
    const result = await refreshActiveTradesPrices();
    return res.json({
      success: true,
      message: `עודכנו מחירי שוק חיים עבור ${result.updatedCount} החזקות פעילות`,
      updatedCount: result.updatedCount,
      trades: result.trades,
    });
  } catch (error: any) {
    console.error('Error refreshing prices:', error);
    return res.status(500).json({ error: 'Failed to refresh prices', details: error.message });
  }
});

export default router;

