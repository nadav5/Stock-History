import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  MoreVertical,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { Trade } from '../types/trade';

interface SimpleInvestmentsTableProps {
  trades: Trade[];
  onEditTrade: (trade: Trade) => void;
  onCloseTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => Promise<void>;
  onOpenImportModal: () => void;
  onOpenAddModal: () => void;
  onRefreshPrices?: () => Promise<void>;
  isRefreshingPrices?: boolean;
}

export const SimpleInvestmentsTable: React.FC<SimpleInvestmentsTableProps> = ({
  trades,
  onEditTrade,
  onCloseTrade,
  onDeleteTrade,
  onOpenImportModal,
  onOpenAddModal,
  onRefreshPrices,
  isRefreshingPrices = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'ticker' | 'value' | 'pnl' | 'pnlPercent' | 'date'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Extract unique sectors
  const sectors = useMemo(() => {
    const s = new Set<string>();
    trades.forEach((t) => {
      if (t.sector) s.add(t.sector);
    });
    return Array.from(s);
  }, [trades]);

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => {
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (sectorFilter !== 'ALL' && t.sector !== sectorFilter) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchTicker = t.ticker.toLowerCase().includes(term);
          const matchName = (t.assetName || '').toLowerCase().includes(term);
          if (!matchTicker && !matchName) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'ticker') {
          diff = a.ticker.localeCompare(b.ticker);
        } else if (sortBy === 'value') {
          const valA = (a.status === 'CLOSED' ? (a.sellPrice || 0) : (a.currentPrice || a.buyPrice)) * a.quantity;
          const valB = (b.status === 'CLOSED' ? (b.sellPrice || 0) : (b.currentPrice || b.buyPrice)) * b.quantity;
          diff = valA - valB;
        } else if (sortBy === 'pnl') {
          const pnlA = a.status === 'CLOSED' ? (a.realizedPnL || 0) : (a.unrealizedPnL || 0);
          const pnlB = b.status === 'CLOSED' ? (b.realizedPnL || 0) : (b.unrealizedPnL || 0);
          diff = pnlA - pnlB;
        } else if (sortBy === 'pnlPercent') {
          const pctA = a.status === 'CLOSED' ? (a.realizedPnLPercent || 0) : (a.unrealizedPnLPercent || 0);
          const pctB = b.status === 'CLOSED' ? (b.realizedPnLPercent || 0) : (b.unrealizedPnLPercent || 0);
          diff = pctA - pctB;
        } else {
          // date
          const dateA = new Date(a.sellDate || a.buyDate).getTime();
          const dateB = new Date(b.sellDate || b.buyDate).getTime();
          diff = dateA - dateB;
        }
        return sortAsc ? diff : -diff;
      });
  }, [trades, statusFilter, sectorFilter, searchTerm, sortBy, sortAsc]);

  const activeCount = trades.filter((t) => t.status === 'ACTIVE').length;
  const closedCount = trades.filter((t) => t.status === 'CLOSED').length;

  const handleSort = (column: 'ticker' | 'value' | 'pnl' | 'pnlPercent' | 'date') => {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        {/* Status Tabs */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-700 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            כל ההשקעות ({trades.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            החזקות פתוחות ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              statusFilter === 'CLOSED'
                ? 'bg-slate-700 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            עסקאות סגורות ({closedCount})
          </button>
        </div>

        {/* Search & Sector Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="חיפוש לפי טיקר או שם..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Sector Select */}
          {sectors.length > 0 && (
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">כל הסקטורים</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Live Price Refresh Button */}
          {onRefreshPrices && trades.length > 0 && (
            <button
              onClick={onRefreshPrices}
              disabled={isRefreshingPrices}
              title="רענון מחירי מניות בזמן אמת מהבורסה"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 hover:border-cyan-500 rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isRefreshingPrices ? 'animate-spin' : ''}`} />
              <span>{isRefreshingPrices ? 'מעדכן מהבורסה...' : 'רענן מחירי שוק'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table or Focused Welcome Hub */}
      {filteredTrades.length === 0 ? (
        <div className="py-12 px-6 border border-slate-800 rounded-2xl bg-slate-900/40 text-center">
          <div className="max-w-xl mx-auto mb-8">
            <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ברוך הבא למעקב ההשקעות
            </span>
            <h3 className="text-xl font-bold text-white mt-3 mb-2">כיצד תרצה להתחיל?</h3>
            <p className="text-xs text-slate-400">
              בחר באחת משתי הדרכים הפשוטות ביותר לטעינת נתונים לתיק שלך:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-6">
            {/* Option 1: Universal Document Upload (PDF, Image, Excel) */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-500/10 to-slate-900/90 border border-amber-500/30 hover:border-amber-500/50 transition-all flex flex-col justify-between text-right">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                    מומלץ • PDF / תמונה / אקסל
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mb-1">טעינת דוח Blink / מסמך</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  העלה את דוח ה-PDF שירד מבלינק, צילום מסך מהאפליקציה, או קובץ אקסל. המערכת תזהה את ההשקעות, הרווח/הפסד והתנועות באופן אוטומטי.
                </p>
              </div>
              <button
                onClick={onOpenImportModal}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>⚡ בחר או גרור קובץ דוח</span>
              </button>
            </div>

            {/* Option 2: Add Manual Investment */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-cyan-500/10 to-slate-900/90 border border-cyan-500/30 hover:border-cyan-500/50 transition-all flex flex-col justify-between text-right">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                    הזנה ידנית
                  </span>
                </div>
                <h4 className="text-base font-bold text-white mb-1">הוספת השקעה ידנית</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  רוצה להכניס השקעה בודדת ידנית? הזן בקלות טיקר מניה, כמות שנרכשה, מחיר קניה ותאריך.
                </p>
              </div>
              <button
                onClick={onOpenAddModal}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>+ הוסף השקעה ידנית</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th
                  onClick={() => handleSort('ticker')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>מניה / נכס</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-3">סקטור</th>
                <th className="py-3 px-3">סטטוס</th>
                <th className="py-3 px-3">כמות</th>
                <th className="py-3 px-3">מחיר קנייה</th>
                <th className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span>מחיר שוק / מכירה</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" title="נתוני שוק חיים"></span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('value')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>סה״כ שווי</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pnl')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>רווח / הפסד ($)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pnlPercent')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>תשואה (%)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-3">דיבידנדים</th>
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>תאריך</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-2 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTrades.map((trade) => {
                const isClosed = trade.status === 'CLOSED';
                const currentOrSell = isClosed
                  ? (trade.sellPrice || trade.buyPrice)
                  : (trade.currentPrice || trade.buyPrice);
                const totalValue = currentOrSell * trade.quantity;
                const pnl = isClosed ? (trade.realizedPnL || 0) : (trade.unrealizedPnL || 0);
                const pnlPercent = isClosed ? (trade.realizedPnLPercent || 0) : (trade.unrealizedPnLPercent || 0);
                const isProfitable = pnl >= 0;

                const displayDate = trade.sellDate
                  ? new Date(trade.sellDate).toLocaleDateString('he-IL')
                  : new Date(trade.buyDate).toLocaleDateString('he-IL');

                return (
                  <tr
                    key={trade._id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Ticker & Asset Name */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-emerald-400">
                          {trade.ticker.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-white tracking-wide">{trade.ticker}</div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {trade.assetName || trade.ticker}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Sector Badge */}
                    <td className="py-3.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] border border-slate-700/80">
                        {trade.sector || 'כללי'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      {isClosed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 text-[10px] font-medium border border-slate-700">
                          <CheckCircle2 className="h-2.5 w-2.5 text-slate-400" />
                          סגורה
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          פתוחה
                        </span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3.5 px-3 font-medium text-slate-300">
                      {trade.quantity}
                    </td>

                    {/* Buy Price */}
                    <td className="py-3.5 px-3 text-slate-300">
                      ${trade.buyPrice.toFixed(2)}
                    </td>

                    {/* Current / Sell Price */}
                    <td className="py-3.5 px-3 font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span>${currentOrSell.toFixed(2)}</span>
                        {!isClosed && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20" title="שער שוק עדכני מהבורסה">
                            חי
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Value */}
                    <td className="py-3.5 px-3 font-semibold text-white">
                      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* PnL $ */}
                    <td className="py-3.5 px-3 font-bold">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          isProfitable ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfitable ? '+' : ''}${pnl.toFixed(2)}
                      </span>
                    </td>

                    {/* PnL % */}
                    <td className="py-3.5 px-3 font-bold">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] ${
                          isProfitable
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </td>

                    {/* Dividends */}
                    <td className="py-3.5 px-3 text-teal-300 font-medium">
                      {trade.dividends ? `+$${trade.dividends.toFixed(2)}` : '—'}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                      {displayDate}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {!isClosed && (
                          <button
                            onClick={() => onCloseTrade(trade)}
                            title="סגור פוזיציה / מכור"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-400 border border-slate-700 text-[10px] font-medium transition-colors"
                          >
                            סגירה
                          </button>
                        )}
                        <button
                          onClick={() => onEditTrade(trade)}
                          title="ערוך השקעה"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTrade(trade._id)}
                          title="מחק מהתיק"
                          className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
