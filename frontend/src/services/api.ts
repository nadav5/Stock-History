import { Trade, AnalyticsSummary, EngineStatus, StockQuote, BlinkTransaction } from '../types/trade';

const API_BASE = '/api';

export const api = {
  // Trades
  async getTrades(params?: { status?: string; sector?: string; search?: string }): Promise<Trade[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.sector) query.append('sector', params.sector);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/trades?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch trades');
    return res.json();
  },

  async getAnalytics(strategy?: string): Promise<AnalyticsSummary> {
    const query = strategy && strategy !== 'ALL' ? `?strategy=${encodeURIComponent(strategy)}` : '';
    const res = await fetch(`${API_BASE}/trades/analytics${query}`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async createTrade(tradeData: Partial<Trade>): Promise<Trade> {
    const res = await fetch(`${API_BASE}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create trade');
    }
    return res.json();
  },

  async updateTrade(id: string, tradeData: Partial<Trade>): Promise<Trade> {
    const res = await fetch(`${API_BASE}/trades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData),
    });
    if (!res.ok) throw new Error('Failed to update trade');
    return res.json();
  },

  async closeTrade(id: string, closeData: { sellPrice?: number; sellDate?: string; exitReason?: string }): Promise<Trade> {
    const res = await fetch(`${API_BASE}/trades/${id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(closeData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to close trade');
    }
    return res.json();
  },

  async deleteTrade(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/trades/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete trade');
  },

  // Blink Specific Endpoints
  async seedBlinkData(force = true): Promise<{ message: string; tradesCount: number; transactionsCount: number }> {
    const res = await fetch(`${API_BASE}/trades/seed-blink?force=${force}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to load Blink statement');
    return res.json();
  },

  async getTransactions(): Promise<BlinkTransaction[]> {
    const res = await fetch(`${API_BASE}/trades/transactions`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async resetPortfolio(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/trades/reset`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to reset portfolio');
    return res.json();
  },

  async parseDocument(file?: File, text?: string, geminiApiKey?: string): Promise<any> {
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      if (geminiApiKey) formData.append('geminiApiKey', geminiApiKey);
      const res = await fetch(`${API_BASE}/import/parse-document`, {
        method: 'POST',
        headers: geminiApiKey ? { 'x-gemini-api-key': geminiApiKey } : undefined,
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || 'שגיאה בפענוח המסמך');
      }
      return res.json();
    } else if (text) {
      const res = await fetch(`${API_BASE}/import/parse-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, geminiApiKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || 'שגיאה בפענוח הטקסט');
      }
      return res.json();
    }
    throw new Error('לא נבחר קובץ או טקסט');
  },

  async parseMultipleDocuments(files: File[], geminiApiKey?: string): Promise<any> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (geminiApiKey) formData.append('geminiApiKey', geminiApiKey);
    const res = await fetch(`${API_BASE}/import/parse-multiple`, {
      method: 'POST',
      headers: geminiApiKey ? { 'x-gemini-api-key': geminiApiKey } : undefined,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'שגיאה בפענוח המסמכים');
    }
    return res.json();
  },

  async applyStatement(
    data: { statement?: any; consolidated?: any },
    wipeExisting = true
  ): Promise<{
    success: boolean;
    message: string;
    tradesCount: number;
    activeCount?: number;
    closedCount?: number;
    transactionsCount: number;
  }> {
    const res = await fetch(`${API_BASE}/import/apply-statement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statement: data.statement,
        consolidated: data.consolidated,
        wipeExisting,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'שגיאה בשמירת נתוני הדוח לתיק');
    }
    return res.json();
  },

  async seedDemoData(force = false): Promise<{ message: string; trades?: Trade[] }> {
    const res = await fetch(`${API_BASE}/trades/seed-demo?force=${force}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to seed demo data');
    return res.json();
  },

  // Market
  async getQuote(ticker: string): Promise<StockQuote> {
    const res = await fetch(`${API_BASE}/market/quote/${ticker.trim().toUpperCase()}`);
    if (!res.ok) throw new Error('Failed to fetch quote');
    return res.json();
  },

  async refreshAllPrices(): Promise<{ success: boolean; message: string; updatedCount: number }> {
    const res = await fetch(`${API_BASE}/market/refresh-all`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to refresh prices');
    return res.json();
  },

  async overridePrice(ticker: string, price: number): Promise<any> {
    const res = await fetch(`${API_BASE}/market/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, price }),
    });
    if (!res.ok) throw new Error('Failed to override price');
    return res.json();
  },

  // Stop Loss Engine Status
  async triggerStopLoss(): Promise<{ message: string; result: any }> {
    const res = await fetch(`${API_BASE}/stoploss/trigger`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to trigger stop loss engine');
    return res.json();
  },

  async getStopLossStatus(): Promise<EngineStatus> {
    const res = await fetch(`${API_BASE}/stoploss/status`);
    if (!res.ok) throw new Error('Failed to get stop loss status');
    return res.json();
  },

  async magicImport(file: File, geminiApiKey?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (geminiApiKey) {
      formData.append('geminiApiKey', geminiApiKey);
    }
    const headers: Record<string, string> = {};
    if (geminiApiKey) {
      headers['x-gemini-api-key'] = geminiApiKey;
    }

    const res = await fetch(`${API_BASE}/import/magic`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Magic import failed');
    }
    return res.json();
  },

  async magicConfirm(file: File, mapping: any): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    const res = await fetch(`${API_BASE}/import/magic-confirm`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Confirm failed');
    }
    return res.json();
  },

  async bulkImportTrades(trades: any[], wipeExisting = false): Promise<any> {
    const res = await fetch(`${API_BASE}/import/bulk-trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trades, wipeExisting }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to import trades');
    }
    return res.json();
  },
};
