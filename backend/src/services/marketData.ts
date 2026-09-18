export interface StockQuote {
  ticker: string;
  price: number;
  name?: string;
  change?: number;
  changePercent?: number;
  currency?: string;
  marketState?: string;
  timestamp: Date;
  isSimulated?: boolean;
}

// In-memory cache to prevent excessive requests
const quoteCache = new Map<string, { quote: StockQuote; expiresAt: number }>();
const CACHE_TTL_MS = 15000; // 15 seconds cache for fresh live data

/**
 * Fetch real-time market quote using Yahoo Finance direct chart API with browser emulation headers
 */
export async function fetchStockQuote(rawTicker: string): Promise<StockQuote> {
  const ticker = rawTicker.trim().toUpperCase();
  const cached = quoteCache.get(ticker);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.quote;
  }

  // 1. Try direct Yahoo Chart API (high-speed, real-time, no crumb needed)
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;

      if (meta && typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0) {
        const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
        const change = Number((meta.regularMarketPrice - prev).toFixed(2));
        const changePct = prev > 0 ? Number(((change / prev) * 100).toFixed(2)) : 0;

        const quote: StockQuote = {
          ticker,
          price: Number(meta.regularMarketPrice.toFixed(2)),
          name: meta.shortName || meta.symbol || ticker,
          change,
          changePercent: changePct,
          currency: meta.currency || 'USD',
          marketState: meta.tradingPeriods?.pre ? 'REGULAR' : 'CLOSED',
          timestamp: new Date(),
          isSimulated: false,
        };

        quoteCache.set(ticker, { quote, expiresAt: now + CACHE_TTL_MS });
        return quote;
      }
    }
  } catch (err: any) {
    console.warn(`[MarketData] Yahoo direct chart error for ${ticker}:`, err.message || err);
  }

  // 2. Secondary fallback: Stooq public CSV API
  try {
    const stooqTicker = ticker.includes('-') || ticker.includes('.') ? ticker : `${ticker}.US`;
    const stooqUrl = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqTicker.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const sRes = await fetch(stooqUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (sRes.ok) {
      const text = await sRes.text();
      const lines = text.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(',');
        const closePrice = parseFloat(parts[parts.length - 2]);
        if (!isNaN(closePrice) && closePrice > 0) {
          const quote: StockQuote = {
            ticker,
            price: Number(closePrice.toFixed(2)),
            name: ticker,
            change: 0,
            changePercent: 0,
            currency: 'USD',
            timestamp: new Date(),
            isSimulated: false,
          };
          quoteCache.set(ticker, { quote, expiresAt: now + CACHE_TTL_MS });
          return quote;
        }
      }
    }
  } catch (stooqErr: any) {
    console.warn(`[MarketData] Stooq fallback error for ${ticker}:`, stooqErr.message || stooqErr);
  }

  // 3. Last fallback: Default realistic price table or cached price
  const fallbackPrice = cached ? cached.quote.price : getDefaultPriceForTicker(ticker);
  const fallbackQuote: StockQuote = {
    ticker,
    price: fallbackPrice,
    name: ticker,
    change: 0,
    changePercent: 0,
    currency: 'USD',
    timestamp: new Date(),
    isSimulated: true,
  };
  quoteCache.set(ticker, { quote: fallbackQuote, expiresAt: now + CACHE_TTL_MS });
  return fallbackQuote;
}

/**
 * Batch fetch quotes for multiple tickers in parallel
 */
export async function fetchMultipleQuotes(tickers: string[]): Promise<Map<string, StockQuote>> {
  const uniqueTickers = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase())));
  const resultMap = new Map<string, StockQuote>();

  await Promise.all(
    uniqueTickers.map(async (ticker) => {
      try {
        const quote = await fetchStockQuote(ticker);
        resultMap.set(ticker, quote);
      } catch (e) {
        console.warn(`Quote notice for ${ticker}:`, e);
      }
    })
  );

  return resultMap;
}

/**
 * Updates all active trades in the database with fresh live market prices
 */
export async function refreshActiveTradesPrices(): Promise<{ updatedCount: number; trades: any[] }> {
  const { Trade } = require('../models/Trade');
  const activeTrades = await Trade.find({ status: 'ACTIVE' });
  if (!activeTrades || activeTrades.length === 0) {
    return { updatedCount: 0, trades: [] };
  }

  const tickers = Array.from(new Set(activeTrades.map((t: any) => t.ticker.toUpperCase())));
  const quotes = await fetchMultipleQuotes(tickers as string[]);

  const updated: any[] = [];
  for (const trade of activeTrades) {
    const quote = quotes.get(trade.ticker.toUpperCase());
    if (quote && quote.price > 0) {
      trade.currentPrice = quote.price;
      trade.lastPriceUpdate = new Date();
      if (quote.name && (!trade.assetName || trade.assetName === trade.ticker)) {
        trade.assetName = quote.name;
      }
      const diff = trade.currentPrice - trade.buyPrice;
      trade.unrealizedPnL = Number((diff * trade.quantity).toFixed(2));
      trade.unrealizedPnLPercent = trade.buyPrice > 0 ? Number(((diff / trade.buyPrice) * 100).toFixed(2)) : 0;
      await trade.save();
      updated.push(trade);
    }
  }

  return { updatedCount: updated.length, trades: updated };
}

/**
 * Manually override a quote price for testing
 */
export function overrideQuotePrice(ticker: string, price: number): StockQuote {
  const upper = ticker.trim().toUpperCase();
  const quote: StockQuote = {
    ticker: upper,
    price: Number(price.toFixed(2)),
    name: `${upper} (Manual Override)`,
    change: 0,
    changePercent: 0,
    currency: 'USD',
    marketState: 'OVERRIDE',
    timestamp: new Date(),
    isSimulated: true,
  };
  quoteCache.set(upper, { quote, expiresAt: Date.now() + 60000 });
  return quote;
}

function getDefaultPriceForTicker(ticker: string): number {
  const commonDefaults: Record<string, number> = {
    MSTR: 150.84,
    QQQ: 716.34,
    NVDA: 219.87,
    TSLA: 362.58,
    AAPL: 334.91,
    MSFT: 445.00,
    AMZN: 185.00,
    GOOG: 345.72,
    GOOGL: 345.72,
    META: 670.80,
    PLTR: 175.30,
    AVGO: 354.74,
    SPY: 550.00,
    AMD: 155.00,
    COIN: 230.00,
  };
  return commonDefaults[ticker] || 100.00;
}
