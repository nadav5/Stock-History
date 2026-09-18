import React, { useState } from 'react';
import {
  FileText,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Receipt,
  Download,
} from 'lucide-react';
import { BlinkTransaction } from '../types/trade';

interface BlinkTransactionsLedgerProps {
  transactions: BlinkTransaction[];
  onOpenImportModal: () => void;
}

export const BlinkTransactionsLedger: React.FC<BlinkTransactionsLedgerProps> = ({
  transactions,
  onOpenImportModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const filtered = transactions.filter((tx) => {
    if (actionFilter !== 'ALL' && tx.actionType !== actionFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTicker = (tx.ticker || '').toLowerCase().includes(term);
      const matchName = (tx.assetName || '').toLowerCase().includes(term);
      const matchAction = tx.actionType.toLowerCase().includes(term);
      if (!matchTicker && !matchName && !matchAction) return false;
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    if (action === 'קניה') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
          <ArrowDownLeft className="h-3 w-3" /> קניה
        </span>
      );
    }
    if (action === 'מכירה') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
          <ArrowUpRight className="h-3 w-3" /> מכירה
        </span>
      );
    }
    if (action === 'דיבידנד') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold">
          <Gift className="h-3 w-3" /> דיבידנד
        </span>
      );
    }
    if (action.includes('מס')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Receipt className="h-3 w-3" /> {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
        {action}
      </span>
    );
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white">פירוט תנועות בחשבון (Blink Ledger)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            יומן הפעולות המדויק מתוך דוח הבלינק (קניות, מכירות, דיבידנדים, חיובי מס ומשיכות)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="חיפוש תנועה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-3 pr-9 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">כל הפעולות</option>
            <option value="קניה">קניה</option>
            <option value="מכירה">מכירה</option>
            <option value="דיבידנד">דיבידנד</option>
            <option value="משיכה">משיכה</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
          <p className="text-xs text-slate-400 mb-3">עדיין לא נטענו תנועות מחשבון מסחר או דוח בלינק.</p>
          <button
            onClick={onOpenImportModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-cyan-500 text-slate-950 text-xs font-bold transition-all shadow-md"
          >
            📂 טען דוח מסחר / קובץ תנועות
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 px-3">תאריך</th>
                <th className="py-3 px-3">סוג הפעולה</th>
                <th className="py-3 px-3">שם הנייר</th>
                <th className="py-3 px-3">כמות</th>
                <th className="py-3 px-3">מחיר ממוצע ($)</th>
                <th className="py-3 px-3">סכום הפעולה ($)</th>
                <th className="py-3 px-3">יתרת מזומן ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((tx, idx) => {
                const isAmountPos = tx.amount >= 0;
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-300">
                      {new Date(tx.date).toLocaleDateString('he-IL')}
                    </td>
                    <td className="py-3 px-3">
                      {getActionBadge(tx.actionType)}
                    </td>
                    <td className="py-3 px-3">
                      {tx.ticker ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{tx.ticker}</span>
                          {tx.assetName && (
                            <span className="text-[11px] text-slate-400">({tx.assetName})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {tx.quantity != null ? tx.quantity : '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {tx.price != null ? `$${tx.price.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span className={isAmountPos ? 'text-emerald-400' : 'text-slate-300'}>
                        {isAmountPos ? '+' : ''}${tx.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {tx.cashBalance != null ? `$${tx.cashBalance.toFixed(2)}` : '—'}
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
