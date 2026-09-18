import React, { useState, useEffect } from 'react';
import { X, PlusCircle, DollarSign, Check, Building2, Tag, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import { Trade } from '../types/trade';
import { api } from '../services/api';

interface SimpleAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  tradeToEdit?: Trade | null;
}

const COMMON_TICKERS: Record<string, { name: string; sector: string }> = {
  MSTR: { name: 'MicroStrategy Inc.', sector: 'ביטקוין ואחזקות' },
  QQQ: { name: 'Invesco QQQ Trust (Nasdaq 100)', sector: 'מדדי מניות' },
  NVDA: { name: 'NVIDIA Corporation', sector: 'מוליכים למחצה' },
  AVGO: { name: 'Broadcom Inc.', sector: 'מוליכים למחצה' },
  META: { name: 'Meta Platforms Inc.', sector: 'טכנולוגיה ותוכנה' },
  PLTR: { name: 'Palantir Technologies', sector: 'תוכנה ו-AI' },
  AAPL: { name: 'Apple Inc.', sector: 'טכנולוגיה וחומרה' },
  MSFT: { name: 'Microsoft Corporation', sector: 'טכנולוגיה וענן' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'מסחר וענן' },
  TSLA: { name: 'Tesla Inc.', sector: 'רכב חשמלי ואנרגיה' },
  GOOG: { name: 'Alphabet Inc. (Google)', sector: 'טכנולוגיה ותוכנה' },
  SPY: { name: 'SPDR S&P 500 ETF Trust', sector: 'מדדי מניות' },
  VOO: { name: 'Vanguard S&P 500 ETF', sector: 'מדדי מניות' },
  AMD: { name: 'Advanced Micro Devices', sector: 'מוליכים למחצה' },
  COIN: { name: 'Coinbase Global Inc.', sector: 'ביטקוין ואחזקות' },
};

export const SimpleAddModal: React.FC<SimpleAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tradeToEdit,
}) => {
  const [ticker, setTicker] = useState('');
  const [assetName, setAssetName] = useState('');
  const [sector, setSector] = useState('טכנולוגיה ותוכנה');
  const [buyPrice, setBuyPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Market Price lookup
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  useEffect(() => {
    if (tradeToEdit) {
      setTicker(tradeToEdit.ticker);
      setAssetName(tradeToEdit.assetName || '');
      setSector(tradeToEdit.sector || 'טכנולוגיה ותוכנה');
      setBuyPrice(String(tradeToEdit.buyPrice));
      setQuantity(String(tradeToEdit.quantity));
      setBuyDate(tradeToEdit.buyDate ? new Date(tradeToEdit.buyDate).toISOString().split('T')[0] : '');
      setLivePrice(tradeToEdit.currentPrice || null);
    } else {
      setTicker('');
      setAssetName('');
      setSector('טכנולוגיה ותוכנה');
      setBuyPrice('');
      setQuantity('');
      setBuyDate(new Date().toISOString().split('T')[0]);
      setLivePrice(null);
    }
    setError(null);
  }, [tradeToEdit, isOpen]);

  // Live Quote Fetch on ticker change (debounced)
  useEffect(() => {
    const clean = ticker.trim().toUpperCase();
    if (!clean || clean.length < 1 || clean.length > 6) {
      setLivePrice(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsFetchingPrice(true);
        const quote = await api.getQuote(clean);
        if (quote && quote.price > 0) {
          setLivePrice(quote.price);
          if (!assetName && quote.name) {
            setAssetName(quote.name);
          }
        }
      } catch (err) {
        // Silent fallback
      } finally {
        setIsFetchingPrice(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [ticker]);

  if (!isOpen) return null;

  const selectSuggestedTicker = (sym: string) => {
    setTicker(sym);
    if (COMMON_TICKERS[sym]) {
      setAssetName(COMMON_TICKERS[sym].name);
      setSector(COMMON_TICKERS[sym].sector);
    }
  };

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setTicker(val);
    if (COMMON_TICKERS[val]) {
      setAssetName(COMMON_TICKERS[val].name);
      setSector(COMMON_TICKERS[val].sector);
    }
  };

  const handleUseLivePrice = () => {
    if (livePrice != null) {
      setBuyPrice(String(livePrice));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTicker = ticker.trim().toUpperCase();
    const numPrice = parseFloat(buyPrice);
    const numQty = parseFloat(quantity);

    if (!cleanTicker) {
      setError('אנא הזן סימול מניה (טיקר)');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('אנא הזן מחיר קנייה תקין');
      return;
    }
    if (isNaN(numQty) || numQty <= 0) {
      setError('אנא הזן כמות מניות תקינה');
      return;
    }

    try {
      setIsSubmitting(true);
      if (tradeToEdit) {
        await api.updateTrade(tradeToEdit._id, {
          ticker: cleanTicker,
          assetName: assetName.trim() || cleanTicker,
          sector: sector.trim(),
          buyPrice: numPrice,
          quantity: numQty,
          buyDate,
        });
        onSuccess(`ההשקעה ב-${cleanTicker} עודכנה בהצלחה`);
      } else {
        await api.createTrade({
          ticker: cleanTicker,
          assetName: assetName.trim() || cleanTicker,
          sector: sector.trim(),
          buyPrice: numPrice,
          quantity: numQty,
          buyDate,
          strategyTag: sector.trim(),
        });
        onSuccess(`ההשקעה ב-${cleanTicker} נוספה בהצלחה לתיק`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת ההשקעה');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {tradeToEdit ? 'עריכת השקעה' : 'הוספת השקעה חדשה'}
              </h3>
              <p className="text-xs text-slate-400">ניתן להקליד כל מניה/ETF מהבורסה או לבחור מהרשימה</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Quick Select Popular Tickers */}
          {!tradeToEdit && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                בחירה מהירה ממניות פופולריות (או הקלד כל מניה למטה):
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-slate-900/60 rounded-xl border border-slate-800/80">
                {Object.keys(COMMON_TICKERS).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => selectSuggestedTicker(sym)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                      ticker === sym
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ticker & Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">טיקר / מניה *</label>
                {isFetchingPrice && <Loader2 className="h-3 w-3 text-emerald-400 animate-spin" />}
              </div>
              <input
                type="text"
                placeholder="הקלד כל טיקר (למשל TSLA, AAPL, COIN)"
                value={ticker}
                onChange={handleTickerChange}
                required
                autoFocus
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">שם החברה / נכס</label>
              <input
                type="text"
                placeholder="מתמלא אוטומטית או הקלד ידנית"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Live Market Price Banner */}
          {livePrice != null && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>מחיר שוק חי בבורסה: <strong>${livePrice.toFixed(2)}</strong></span>
              </div>
              <button
                type="button"
                onClick={handleUseLivePrice}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
              >
                <span>השתמש כמחיר קנייה</span>
              </button>
            </div>
          )}

          {/* Sector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">סקטור / תחום פעילות</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="טכנולוגיה ותוכנה">טכנולוגיה ותוכנה</option>
              <option value="תוכנה ו-AI">תוכנה ו-AI</option>
              <option value="מוליכים למחצה">מוליכים למחצה</option>
              <option value="מדדי מניות">מדדי מניות (ETFs)</option>
              <option value="ביטקוין ואחזקות">ביטקוין וקריפטו</option>
              <option value="רכב חשמלי ואנרגיה">רכב חשמלי ואנרגיה</option>
              <option value="טכנולוגיה וחומרה">טכנולוגיה וחומרה</option>
              <option value="בריאות ופארמה">בריאות ופארמה</option>
              <option value="פיננסים ובנקאות">פיננסים ובנקאות</option>
              <option value="כללי">כללי / אחר</option>
            </select>
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">מחיר קנייה ($) *</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder="למשל 150.00"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">כמות מניות *</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder="למשל 5 או 2.5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Buy Date */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">תאריך קנייה</label>
            <input
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30"
            >
              {isSubmitting ? 'שומר...' : tradeToEdit ? 'עדכן השקעה' : 'הוסף לתיק'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
