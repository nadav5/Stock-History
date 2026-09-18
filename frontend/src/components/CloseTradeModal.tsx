import React, { useState, useEffect } from 'react';
import { X, ArrowDownCircle, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Trade } from '../types/trade';

interface CloseTradeModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmClose: (tradeId: string, data: { sellPrice: number; sellDate: string; exitReason: string }) => Promise<void>;
}

export const CloseTradeModal: React.FC<CloseTradeModalProps> = ({
  trade,
  isOpen,
  onClose,
  onConfirmClose,
}) => {
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [sellDate, setSellDate] = useState(new Date().toISOString().split('T')[0]);
  const [exitReason, setExitReason] = useState('MANUAL_EXIT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trade) {
      setSellPrice(trade.currentPrice || trade.buyPrice);
      setSellDate(new Date().toISOString().split('T')[0]);
      setExitReason('MANUAL_EXIT');
      setError(null);
    }
  }, [trade, isOpen]);

  if (!isOpen || !trade) return null;

  const numSellPrice = typeof sellPrice === 'number' ? sellPrice : 0;
  const pnl = numSellPrice > 0 ? (numSellPrice - trade.buyPrice) * trade.quantity : 0;
  const pnlPct = numSellPrice > 0 ? ((numSellPrice - trade.buyPrice) / trade.buyPrice) * 100 : 0;
  const isWin = pnl >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellPrice || Number(sellPrice) <= 0) {
      setError('אנא הזן מחיר מכירה תקין');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirmClose(trade._id, {
        sellPrice: Number(sellPrice),
        sellDate: new Date(sellDate).toISOString(),
        exitReason,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בסגירת הפוזיציה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl p-6 text-slate-100 text-right">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">מכירת פוזיציה: {trade.ticker}</h3>
              <p className="text-xs text-slate-400">סגירת העסקה ורישום רווח/הפסד ממומש בתיק</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 block mb-0.5">מחיר קנייה מקורי:</span>
              <div className="font-bold text-white">${trade.buyPrice.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">כמות מניות למכירה:</span>
              <div className="font-bold text-white">{trade.quantity} יח'</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              מחיר מכירה ליחידה ($) *
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                תאריך ביצוע המכירה
              </label>
              <input
                type="date"
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                סיבת יציאה
              </label>
              <select
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="MANUAL_EXIT">מכירה יזומה</option>
                <option value="TARGET_REACHED">השגת יעד רווח</option>
                <option value="STOP_LOSS">עצירת הפסד</option>
              </select>
            </div>
          </div>

          {/* Real-time preview */}
          {numSellPrice > 0 && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 block mb-1">
                תוצאת העסקה הצפויה:
              </span>
              <div
                className={`text-xl font-bold flex items-center justify-center gap-1.5 ${
                  isWin ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isWin ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <span>{isWin ? '+' : ''}${pnl.toFixed(2)} ({isWin ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {submitting ? 'מבצע מכירה...' : 'אשר מכירה וסגירה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
