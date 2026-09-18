import React from 'react';
import {
  Calendar,
  PieChart,
  Layers,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { AnalyticsSummary, Trade } from '../types/trade';

interface BreakdownsViewProps {
  analytics: AnalyticsSummary | null;
  trades: Trade[];
}

const SECTOR_COLORS: Record<string, string> = {
  'מוליכים למחצה': '#3b82f6', // blue
  'תוכנה ו-AI': '#8b5cf6', // purple
  'טכנולוגיה ותוכנה': '#a855f7', // purple
  'מדדי מניות': '#10b981', // emerald
  'ביטקוין ואחזקות': '#f59e0b', // amber
  'רכב חשמלי ואנרגיה': '#06b6d4', // cyan
  'כללי': '#64748b', // slate
};

export const BreakdownsView: React.FC<BreakdownsViewProps> = ({ analytics, trades }) => {
  if (!analytics) {
    return (
      <div className="py-12 text-center text-slate-400">
        טוען פילוחים וסטטיסטיקות...
      </div>
    );
  }

  const { yearBreakdown = [], sectorBreakdown = [], lastMonthStats } = analytics;

  return (
    <div className="space-y-6">
      {/* 1. SECTION: Last Month Summary (חודש אחרון) */}
      <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">סיכום חודש אחרון (30 ימים אחרונים)</h2>
              <p className="text-xs text-slate-400">ביצועים, עסקאות ותוצאות של התקופה האחרונה</p>
            </div>
          </div>
          {lastMonthStats && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                lastMonthStats.pnl >= 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
              }`}
            >
              {lastMonthStats.pnl >= 0 ? '+' : ''}${lastMonthStats.pnl.toFixed(2)} ({lastMonthStats.returnPercent > 0 ? '+' : ''}{lastMonthStats.returnPercent.toFixed(2)}%)
            </span>
          )}
        </div>

        {lastMonthStats && lastMonthStats.tradesCount > 0 ? (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block mb-1">סך עסקאות בחודש</span>
                <span className="text-lg font-bold text-white">{lastMonthStats.tradesCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block mb-1">עסקאות מורווחות</span>
                <span className="text-lg font-bold text-emerald-400">{lastMonthStats.wins}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block mb-1">עסקאות מופסדות</span>
                <span className="text-lg font-bold text-rose-400">{lastMonthStats.losses}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block mb-1">רווח / הפסד נקי</span>
                <span
                  className={`text-lg font-bold ${
                    lastMonthStats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {lastMonthStats.pnl >= 0 ? '+' : ''}${lastMonthStats.pnl.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/40">
              <div className="text-xs font-semibold text-slate-300 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
                עסקאות שבוצעו בחודש זה:
              </div>
              <div className="divide-y divide-slate-800/60 text-xs">
                {lastMonthStats.trades.map((t) => {
                  const pnl = t.status === 'CLOSED' ? (t.realizedPnL || 0) : (t.unrealizedPnL || 0);
                  const isPos = pnl >= 0;
                  return (
                    <div key={t._id} className="flex items-center justify-between p-3 px-4 hover:bg-slate-800/30">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-sm">{t.ticker}</span>
                        <span className="text-slate-400">{t.assetName || t.ticker}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {t.sector}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400">
                          {new Date(t.sellDate || t.buyDate).toLocaleDateString('he-IL')}
                        </span>
                        <span className={`font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPos ? '+' : ''}${pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3">אין עסקאות שתועדו בחודש האחרון.</p>
        )}
      </div>

      {/* 2. SECTION: Sector Breakdown (פילוח סקטורים) */}
      <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <PieChart className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">פילוח לפי סקטורים ותחומי פעילות</h2>
              <p className="text-xs text-slate-400">פיזור התיק, שווי שוק ותשואות לפי סקטור</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {sectorBreakdown.length} סקטורים פעילים
          </span>
        </div>

        {/* Visual Allocation Distribution Bar */}
        {sectorBreakdown.length > 0 && (
          <div className="mb-5">
            <div className="text-xs text-slate-400 mb-1.5 flex justify-between font-medium">
              <span>התפלגות השקעות בתיק:</span>
            </div>
            <div className="h-3.5 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              {sectorBreakdown.map((s, idx) => {
                const color = SECTOR_COLORS[s.sector] || '#64748b';
                return (
                  <div
                    key={idx}
                    style={{
                      width: `${s.percentOfPortfolio}%`,
                      backgroundColor: color,
                    }}
                    title={`${s.sector}: ${s.percentOfPortfolio}% ($${s.value.toFixed(2)})`}
                    className="h-full transition-all hover:opacity-90"
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Sector Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">סקטור</th>
                <th className="py-2.5 px-3">אחוז מהתיק</th>
                <th className="py-2.5 px-3">שווי כולל ($)</th>
                <th className="py-2.5 px-3">סך מושקע ($)</th>
                <th className="py-2.5 px-3">רווח / הפסד ($)</th>
                <th className="py-2.5 px-3">תשואה (%)</th>
                <th className="py-2.5 px-3">נכסים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sectorBreakdown.map((s, idx) => {
                const isPos = s.pnl >= 0;
                const dotColor = SECTOR_COLORS[s.sector] || '#64748b';
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full inline-block"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span>{s.sector}</span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-200">
                      {s.percentOfPortfolio}%
                    </td>
                    <td className="py-3 px-3 font-medium text-white">
                      ${s.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      ${s.invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                        {isPos ? '+' : ''}${s.pnl.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          isPos
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isPos ? '+' : ''}{s.pnlPercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{s.holdingsCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. SECTION: Year Breakdown (פילוח לפי שנים) */}
      <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">פילוח ביצועים לפי שנים</h2>
              <p className="text-xs text-slate-400">התקדמות התיק, השקעה, רווחים ותשואות לאורך השנים</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {yearBreakdown.map((y) => {
            const isPos = y.totalPnL >= 0;
            return (
              <div
                key={y.year}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-extrabold text-white">שנת {y.year}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isPos
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isPos ? '+' : ''}{y.returnPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-300">
                  {y.deposits != null && y.deposits > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">הפקדות מהבנק:</span>
                      <strong className="text-cyan-400">+${y.deposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                  {y.withdrawals != null && y.withdrawals > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">משיכות לבנק:</span>
                      <strong className="text-amber-400">-${y.withdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">נפח עסקאות:</span>
                    <strong>${y.invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">רווח / הפסד:</span>
                    <strong className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                      {isPos ? '+' : ''}${y.totalPnL.toFixed(2)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">מספר פעולות:</span>
                    <span>{y.tradesCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
