import React, { useState } from 'react';
import {
  TrendingUp,
  FileSpreadsheet,
  PlusCircle,
  UploadCloud,
  Zap,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onExportExcel: () => void;
  onResetPortfolio: () => Promise<void>;
  onRefreshData: () => Promise<void>;
  onRefreshPrices?: () => Promise<void>;
  isRefreshingPrices?: boolean;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAddModal,
  onOpenImportModal,
  onExportExcel,
  onResetPortfolio,
  onRefreshData,
  onRefreshPrices,
  isRefreshingPrices = false,
  isLoading,
}) => {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetClick = async () => {
    if (window.confirm('האם לאפס את כל הנתונים בתיק? המערכת תחזור למצב ריק לחלוטין.')) {
      try {
        setIsResetting(true);
        await onResetPortfolio();
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <header className="border-b border-slate-800 bg-[#0c1017]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & App Title */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-white/15">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                מעקב תיק השקעות <span className="text-emerald-400 font-extrabold text-sm">Blink</span>
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                פשוט וברור
              </span>
            </div>
            <p className="text-xs text-slate-400">ניהול השקעות, רווח והפסד, וקליטת דוחות מחשבון בלינק</p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Universal Document / Blink Statement Import Modal */}
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 text-amber-200 text-xs font-semibold border border-amber-500/30 transition-all shadow-sm"
          >
            <UploadCloud className="h-4 w-4 text-amber-300" />
            <span>טעינת דוח Blink / מסמך</span>
          </button>

          {/* Export to Excel */}
          <button
            onClick={onExportExcel}
            title="הורד קובץ אקסל מסודר עם כל ההשקעות, התנועות והפילוחים"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-medium border border-emerald-700/50 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>ייצוא לאקסל</span>
          </button>

          {/* Add Manual Investment */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>הוספת השקעה</span>
          </button>

          {/* Refresh Market Prices */}
          <button
            onClick={onRefreshPrices || onRefreshData}
            disabled={isRefreshingPrices || isLoading}
            title="רענן מחירי שוק בזמן אמת מול הבורסה (Yahoo Finance)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 hover:border-cyan-500/50 transition-all shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isRefreshingPrices || isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshingPrices ? 'מעדכן בורסה...' : 'רענון מחירי שוק'}</span>
          </button>

          {/* Clear / Reset Portfolio */}
          <button
            onClick={handleResetClick}
            disabled={isResetting || isLoading}
            title="איפוס כל הנתונים בתיק"
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-800/40 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
