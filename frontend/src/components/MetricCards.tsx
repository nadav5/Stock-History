import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  DollarSign,
  Gift,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { AnalyticsSummary } from '../types/trade';

interface MetricCardsProps {
  analytics: AnalyticsSummary | null;
  isLoading: boolean;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ analytics, isLoading }) => {
  if (isLoading || !analytics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-28 bg-slate-900/40 border-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const {
    portfolioValue = 0,
    totalInvested = 0,
    cashBalance = 0,
    totalPnL = 0,
    totalPnLPercent = 0,
    totalRealizedPnL = 0,
    totalUnrealizedPnL = 0,
    totalDividends = 0,
    winRatePercent = 0,
    closedTradesCount = 0,
    activeTradesCount = 0,
  } = analytics;

  const isTotalPositive = totalPnL >= 0;
  const isUnrealizedPositive = totalUnrealizedPnL >= 0;
  const cashPercent = portfolioValue > 0 ? ((cashBalance / portfolioValue) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Portfolio Value */}
      <Card className="p-4 bg-[#111827]/80 border-slate-800 hover:border-slate-700 transition-all shadow-sm rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold text-slate-300">שווי תיק כולל</span>
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
          <span>השקעות פעילות: <strong className="text-slate-200">${totalInvested.toFixed(2)}</strong></span>
          <span className="text-slate-500">({activeTradesCount} נכסים)</span>
        </div>
      </Card>

      {/* 2. Total Net PnL (Realized + Unrealized + Dividends) */}
      <Card className="p-4 bg-[#111827]/80 border-slate-800 hover:border-slate-700 transition-all shadow-sm rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold text-slate-300">רווח / הפסד כולל</span>
          <div className={`p-2 rounded-lg ${isTotalPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {isTotalPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className={`text-2xl font-bold tracking-tight ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isTotalPositive ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isTotalPositive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
            }`}
          >
            {isTotalPositive ? '+' : ''}{totalPnLPercent.toFixed(2)}%
          </span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
          <span>לא ממומש: <strong className={isUnrealizedPositive ? 'text-emerald-400' : 'text-rose-400'}>{isUnrealizedPositive ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}</strong></span>
          <span>ממומש: <strong className={totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{totalRealizedPnL >= 0 ? '+' : ''}${totalRealizedPnL.toFixed(2)}</strong></span>
        </div>
      </Card>

      {/* 3. Cash Balance */}
      <Card className="p-4 bg-[#111827]/80 border-slate-800 hover:border-slate-700 transition-all shadow-sm rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold text-slate-300">יתרת מזומן בדולר</span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Coins className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">
          ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
          <span>חלק מהתיק: <strong className="text-amber-300">{cashPercent}%</strong></span>
          <span className="text-emerald-400 font-medium">זמין למסחר</span>
        </div>
      </Card>

      {/* 4. Realized PnL & Dividends */}
      <Card className="p-4 bg-[#111827]/80 border-slate-800 hover:border-slate-700 transition-all shadow-sm rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold text-slate-300">דיבידנדים והצלחה</span>
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
            <Gift className="h-4 w-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-teal-300 tracking-tight">
          +${totalDividends.toFixed(2)}
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
          <span>אחוז הצלחה: <strong className="text-slate-200">{winRatePercent}%</strong></span>
          <span className="text-slate-500">({closedTradesCount} עסקאות שנסגרו)</span>
        </div>
      </Card>
    </div>
  );
};
