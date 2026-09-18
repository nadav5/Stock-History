import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  ShieldAlert,
  Target,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trade } from '../types/trade';
import { api } from '../services/api';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tradeData: Partial<Trade>) => Promise<void>;
  editTrade?: Trade | null;
}

const PRESET_STRATEGIES = [
  'Breakout',
  'Moving Average Cross',
  'VIX Reversal',
  'Moving Average Bounce',
  'VIX Hedge',
  'Trend Following',
  'Gap & Go',
];

export const AddTradeModal: React.FC<AddTradeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editTrade,
}) => {
  const [ticker, setTicker] = useState('');
  const [buyPrice, setBuyPrice] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>(10);
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [stopLossPrice, setStopLossPrice] = useState<number | ''>('');
  const [targetPrice, setTargetPrice] = useState<number | ''>('');
  const [strategyTag, setStrategyTag] = useState('Breakout');
  const [customStrategy, setCustomStrategy] = useState('');
  const [notes, setNotes] = useState('');

  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [quoteInfo, setQuoteInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editTrade) {
      setTicker(editTrade.ticker);
      setBuyPrice(editTrade.buyPrice);
      setQuantity(editTrade.quantity);
      setBuyDate(new Date(editTrade.buyDate).toISOString().split('T')[0]);
      setStopLossPrice(editTrade.stopLossPrice ?? '');
      setTargetPrice(editTrade.targetPrice || '');
      setNotes(editTrade.notes || '');
      if (PRESET_STRATEGIES.includes(editTrade.strategyTag)) {
        setStrategyTag(editTrade.strategyTag);
      } else {
        setStrategyTag('Custom');
        setCustomStrategy(editTrade.strategyTag);
      }
    } else {
      resetForm();
    }
  }, [editTrade, isOpen]);

  const resetForm = () => {
    setTicker('');
    setBuyPrice('');
    setQuantity(10);
    setBuyDate(new Date().toISOString().split('T')[0]);
    setStopLossPrice('');
    setTargetPrice('');
    setStrategyTag('Breakout');
    setCustomStrategy('');
    setNotes('');
    setError(null);
    setQuoteInfo(null);
  };

  const handleFetchQuote = async () => {
    if (!ticker.trim()) return;
    try {
      setFetchingQuote(true);
      setError(null);
      const quote = await api.getQuote(ticker);
      setBuyPrice(quote.price);
      if (!stopLossPrice) {
        setStopLossPrice(Number((quote.price * 0.95).toFixed(2)));
      }
      if (!targetPrice) {
        setTargetPrice(Number((quote.price * 1.10).toFixed(2)));
      }
      setQuoteInfo(`${quote.name || quote.ticker}: $${quote.price.toFixed(2)}`);
    } catch {
      setError('Could not fetch market quote. You can enter the price manually.');
    } finally {
      setFetchingQuote(false);
    }
  };

  const numBuy = typeof buyPrice === 'number' ? buyPrice : 0;
  const numSL = typeof stopLossPrice === 'number' ? stopLossPrice : 0;
  const numTarget = typeof targetPrice === 'number' ? targetPrice : 0;
  const numQty = typeof quantity === 'number' ? quantity : 0;

  const capitalRequired = numBuy * numQty;
  const riskPerShare = numBuy > 0 && numSL > 0 ? numBuy - numSL : 0;
  const totalRisk = riskPerShare * numQty;
  const riskPercent = numBuy > 0 && riskPerShare > 0 ? (riskPerShare / numBuy) * 100 : 0;

  const rewardPerShare = numTarget > numBuy ? numTarget - numBuy : 0;
  const plannedRR = riskPerShare > 0 && rewardPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(2) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ticker.trim()) {
      setError('Ticker symbol is required');
      return;
    }
    if (!buyPrice || Number(buyPrice) <= 0) {
      setError('Buy price must be greater than 0');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (stopLossPrice === '' || Number(stopLossPrice) <= 0) {
      setError('Stop-Loss price is required for automated risk protection');
      return;
    }
    if (Number(stopLossPrice) >= Number(buyPrice)) {
      setError('Stop-Loss price should be lower than entry price for long positions');
      return;
    }

    const finalStrategy = strategyTag === 'Custom' ? customStrategy.trim() || 'Custom' : strategyTag;

    try {
      setSubmitting(true);
      await onSubmit({
        ticker: ticker.trim().toUpperCase(),
        buyPrice: Number(buyPrice),
        quantity: Number(quantity),
        buyDate: new Date(buyDate).toISOString(),
        stopLossPrice: Number(stopLossPrice),
        targetPrice: targetPrice ? Number(targetPrice) : undefined,
        strategyTag: finalStrategy,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save trade');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0e1626] border border-slate-800 shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editTrade ? 'Edit Trade Position' : 'Log New Stock Position'}
              </h3>
              <p className="text-xs text-slate-400">
                Setup entry price, risk limits, and automated stop-loss protection
              </p>
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
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ticker & Quote */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Stock Ticker Symbol
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL, NVDA, TSLA"
                className="flex-1 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono uppercase text-sm font-semibold focus:outline-none focus:border-emerald-500"
                required
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleFetchQuote}
                disabled={fetchingQuote || !ticker.trim()}
                className="gap-1.5 border-slate-700"
              >
                <Search className="h-3.5 w-3.5 text-cyan-400" />
                <span>{fetchingQuote ? 'Fetching...' : 'Live Price'}</span>
              </Button>
            </div>
            {quoteInfo && (
              <p className="text-[11px] text-emerald-400 mt-1 font-mono flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {quoteInfo}
              </p>
            )}
          </div>

          {/* Buy Price & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Buy / Entry Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="150.00"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Quantity (Shares)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="10"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Stop-Loss & Target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1.5 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Stop-Loss Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="142.50"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-rose-500/40 text-rose-300 font-mono text-sm focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                Target Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="165.00"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300 font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Planned Risk Preview */}
          {numBuy > 0 && numSL > 0 && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Position Value:</span>
                <span className="text-white font-bold">${capitalRequired.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Total Capital at Risk (SL Hit):</span>
                <span>-${totalRisk.toFixed(2)} ({riskPercent.toFixed(1)}%)</span>
              </div>
              {plannedRR && (
                <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800/80">
                  <span>Planned Risk : Reward Ratio:</span>
                  <span className="font-bold">1 : {plannedRR}</span>
                </div>
              )}
            </div>
          )}

          {/* Strategy Tag & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Strategy Tag
              </label>
              <select
                value={strategyTag}
                onChange={(e) => setStrategyTag(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {PRESET_STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="Custom">+ Custom Strategy...</option>
              </select>

              {strategyTag === 'Custom' && (
                <input
                  type="text"
                  placeholder="e.g. Volume Breakout"
                  value={customStrategy}
                  onChange={(e) => setCustomStrategy(e.target.value)}
                  className="mt-2 w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Entry Date
              </label>
              <input
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Trade Rationale / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are you taking this trade? (e.g. 50 EMA golden cross with high volume)"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {submitting ? 'Saving...' : editTrade ? 'Update Trade' : 'Open Trade Position'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
