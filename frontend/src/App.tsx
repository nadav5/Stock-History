import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  PieChart,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { SimpleInvestmentsTable } from './components/SimpleInvestmentsTable';
import { BreakdownsView } from './components/BreakdownsView';
import { BlinkTransactionsLedger } from './components/BlinkTransactionsLedger';
import { SimpleAddModal } from './components/SimpleAddModal';
import { CloseTradeModal } from './components/CloseTradeModal';
import { BlinkImportModal } from './components/BlinkImportModal';
import { NotificationToast, ToastMessage } from './components/NotificationToast';
import { Trade, BlinkTransaction, AnalyticsSummary } from './types/trade';
import { api } from './services/api';
import { exportPortfolioToExcel } from './services/excelExport';

export function App() {
  const [activeTab, setActiveTab] = useState<'investments' | 'breakdowns' | 'blink-ledger'>('investments');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [transactions, setTransactions] = useState<BlinkTransaction[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
  const [tradeToClose, setTradeToClose] = useState<Trade | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Refresh all trades, analytics, and transactions
  const refreshData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      const [allTrades, analyticsData, txData] = await Promise.all([
        api.getTrades(),
        api.getAnalytics(),
        api.getTransactions(),
      ]);

      setTrades(allTrades);
      setAnalytics(analyticsData);
      setTransactions(txData);
    } catch (err: any) {
      console.error('Error refreshing portfolio data:', err);
      if (!quiet) {
        addToast({
          type: 'error',
          title: 'שגיאת חיבור לשרת',
          message: 'לא ניתן לתקשר עם שרת הנתונים. אנא ודא שהשרת פועל.',
        });
      }
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  // Handler: Refresh live market prices from exchange
  const handleRefreshLivePrices = async () => {
    try {
      setIsRefreshingPrices(true);
      const res = await api.refreshAllPrices();
      await refreshData(true);
      addToast({
        type: 'success',
        title: 'מחירי השוק עודכנו בהצלחה',
        message: res?.message || 'מחירי המניות עודכנו ישירות מנתוני השוק בזמן אמת.',
      });
    } catch (err: any) {
      console.error('Error refreshing live prices:', err);
      addToast({
        type: 'error',
        title: 'שגיאה בעדכון מחירי שוק',
        message: err.message || 'לא ניתן לעדכן מחירי שוק כרגע.',
      });
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Periodic background price refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await api.refreshAllPrices();
        await refreshData(true);
      } catch (err) {
        console.error('Background price refresh error:', err);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [refreshData]);



  // Handler: Reset Portfolio
  const handleResetPortfolio = async () => {
    try {
      setIsLoading(true);
      await api.resetPortfolio();
      await refreshData(true);
      addToast({
        type: 'info',
        title: 'התיק אופס',
        message: 'כל הנתונים אופסו בהצלחה. כעת תוכל להזין או לטעון נתונים מחדש.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'שגיאה באיפוס התיק',
        message: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Export to Excel
  const handleExportExcel = () => {
    try {
      if (trades.length === 0 && transactions.length === 0) {
        addToast({
          type: 'warning',
          title: 'אין נתונים לייצוא',
          message: 'אנא טען או הזן השקעות לפני ביצוע ייצוא לאקסל.',
        });
        return;
      }
      exportPortfolioToExcel(trades, transactions, analytics);
      addToast({
        type: 'success',
        title: 'ייצוא לאקסל הושלם!',
        message: 'קובץ האקסל נוצר בהצלחה והורד למחשבך.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'שגיאה בייצוא',
        message: err.message || 'נכשלה יצירת קובץ האקסל.',
      });
    }
  };

  // Handler: Delete Trade
  const handleDeleteTrade = async (id: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק השקעה זו?')) return;
    try {
      await api.deleteTrade(id);
      await refreshData(true);
      addToast({
        type: 'success',
        title: 'השקעה נמחקה',
        message: 'ההשקעה הוסרה בהצלחה מתיק ההשקעות.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'שגיאה במחיקה',
        message: err.message,
      });
    }
  };

  // Handler: Confirm Close Trade
  const handleCloseTradeConfirm = async (
    tradeId: string,
    closeData: { sellPrice: number; sellDate: string; exitReason: string }
  ) => {
    await api.closeTrade(tradeId, closeData);
    await refreshData(true);
    addToast({
      type: 'success',
      title: 'הפוזיציה נסגרה בהצלחה',
      message: 'העסקה נרשמה כסגורה ורווחי המימוש חושבו.',
    });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Toast Notifications */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header */}
      <Header
        onOpenAddModal={() => {
          setTradeToEdit(null);
          setIsAddModalOpen(true);
        }}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportExcel={handleExportExcel}
        onResetPortfolio={handleResetPortfolio}
        onRefreshData={() => refreshData()}
        onRefreshPrices={handleRefreshLivePrices}
        isRefreshingPrices={isRefreshingPrices}
        isLoading={isLoading}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Cards */}
        <MetricCards analytics={analytics} isLoading={isLoading} />

        {/* Primary View Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('investments')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'investments'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>טבלת השקעות ופוזיציות</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/30">
                {trades.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('breakdowns')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'breakdowns'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <PieChart className="h-4 w-4" />
              <span>סטטיסטיקות ופילוחים (שנים / סקטורים / חודש אחרון)</span>
            </button>

            <button
              onClick={() => setActiveTab('blink-ledger')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'blink-ledger'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>תנועות חשבון בלינק (Blink Ledger)</span>
              {transactions.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/30">
                  {transactions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab View Content */}
        {activeTab === 'investments' && (
          <SimpleInvestmentsTable
            trades={trades}
            onEditTrade={(trade) => {
              setTradeToEdit(trade);
              setIsAddModalOpen(true);
            }}
            onCloseTrade={(trade) => setTradeToClose(trade)}
            onDeleteTrade={handleDeleteTrade}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenAddModal={() => {
              setTradeToEdit(null);
              setIsAddModalOpen(true);
            }}
            onRefreshPrices={handleRefreshLivePrices}
            isRefreshingPrices={isRefreshingPrices}
          />
        )}

        {activeTab === 'breakdowns' && (
          <BreakdownsView analytics={analytics} trades={trades} />
        )}

        {activeTab === 'blink-ledger' && (
          <BlinkTransactionsLedger
            transactions={transactions}
            onOpenImportModal={() => setIsImportModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        ניהול תיק השקעות פשוט וברור • מותאם לדוחות חשבון Blink • ייצוא מלא לאקסל
      </footer>

      {/* Modals */}
      <SimpleAddModal
        isOpen={isAddModalOpen}
        tradeToEdit={tradeToEdit}
        onClose={() => {
          setIsAddModalOpen(false);
          setTradeToEdit(null);
        }}
        onSuccess={(msg) => {
          refreshData(true);
          addToast({ type: 'success', title: 'נשמר בהצלחה', message: msg });
        }}
      />

      <CloseTradeModal
        isOpen={Boolean(tradeToClose)}
        trade={tradeToClose}
        onClose={() => setTradeToClose(null)}
        onConfirmClose={handleCloseTradeConfirm}
      />

      <BlinkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(msg) => {
          refreshData(true);
          addToast({ type: 'success', title: 'ייבוא הושלם', message: msg });
        }}
      />
    </div>
  );
}

export default App;

