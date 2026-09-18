import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  History,
} from 'lucide-react';
import { api } from '../services/api';

interface BlinkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const BlinkImportModal: React.FC<BlinkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [activeInputMode, setActiveInputMode] = useState<'FILE' | 'TEXT'>('FILE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted Consolidated State for Preview & Verification
  const [previewData, setPreviewData] = useState<{
    statements?: any[];
    consolidated: any;
  } | null>(null);

  const [previewTab, setPreviewTab] = useState<'active' | 'closed' | 'transactions' | 'years'>('active');
  const [wipeExisting, setWipeExisting] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handler: Parse Uploaded Files (Supports 1 or multiple periodic statements)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesList = Array.from(e.target.files);
    setSelectedFiles(filesList);
    setErrorMessage(null);
    setPreviewData(null);

    try {
      setIsProcessing(true);
      let res: any;

      if (filesList.length > 1) {
        res = await api.parseMultipleDocuments(filesList);
      } else {
        res = await api.parseDocument(filesList[0]);
      }

      if (!res || !res.consolidated) {
        throw new Error('לא זוהו נתונים קריאים במסמכים. אנא ודא שהקבצים הם דוחות Blink או טבלאות מניות.');
      }

      setPreviewData({
        statements: res.statements || (res.holdings ? [res] : []),
        consolidated: res.consolidated,
      });
    } catch (err: any) {
      console.error('Error parsing document:', err);
      setErrorMessage(err.message || 'שגיאה בפענוח המסמכים. אנא ודא שהקבצים תקינים.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Parse Pasted Text
  const handleParsePastedText = async () => {
    if (!pastedText.trim()) return;
    setErrorMessage(null);
    setPreviewData(null);

    try {
      setIsProcessing(true);
      const res = await api.parseDocument(undefined, pastedText);
      if (!res || !res.consolidated) {
        throw new Error('לא זוהו נתוני עסקאות בטקסט שהודבק.');
      }
      setPreviewData({
        statements: [res],
        consolidated: res.consolidated,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'שגיאה בפענוח הטקסט.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Confirm & Save to Portfolio
  const handleConfirmImport = async () => {
    if (!previewData?.consolidated) return;
    try {
      setIsProcessing(true);
      setErrorMessage(null);

      const res = await api.applyStatement(
        { consolidated: previewData.consolidated },
        wipeExisting
      );
      onSuccess(res.message || 'הדוחות אוחדו ויובאו בהצלחה לתיק ההשקעות שלך!');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'שגיאה בשמירת נתוני הדוח.');
    } finally {
      setIsProcessing(false);
    }
  };

  const consolidated = previewData?.consolidated;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 text-amber-300 border border-amber-500/30 shadow-sm">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">קליטת דוחות מסחר / Blink (תמיכה בריבוי שנים)</h3>
              <p className="text-xs text-slate-400">
                העלאת דוח אחד או מספר דוחות תקופתיים במקביל לאיחוד היסטורי רציף וחישוב עלויות אמת
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Switcher */}
          {!previewData && (
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setActiveInputMode('FILE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeInputMode === 'FILE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                }`}
              >
                העלאת מסמכים / קבצים (ניתן לבחור מספר קבצים יחד)
              </button>
              <button
                onClick={() => setActiveInputMode('TEXT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeInputMode === 'TEXT'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                }`}
              >
                הדבקת טקסט דוח
              </button>
            </div>
          )}

          {/* Mode 1: Multi-File Upload */}
          {activeInputMode === 'FILE' && !previewData && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv"
                className="hidden"
              />
              <div
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isProcessing
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/50'
                }`}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="h-9 w-9 text-emerald-400 animate-spin mb-3" />
                    <p className="text-sm font-bold text-white mb-1">
                      מפענח ומאחד {selectedFiles.length > 1 ? `${selectedFiles.length} דוחות` : 'את הדוח'}...
                    </p>
                    <p className="text-xs text-slate-400">
                      בונה ספר תנועות כרונולוגי, מחשב מחירי קנייה משוקללים אמיתיים ורווחים לפי שנים
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center gap-3 mb-3 text-slate-500">
                      <FileText className="h-8 w-8 text-cyan-400" />
                      <ImageIcon className="h-8 w-8 text-amber-400" />
                      <FileSpreadsheet className="h-8 w-8 text-emerald-400" />
                    </div>
                    <p className="text-sm text-slate-200 font-semibold mb-1">
                      {selectedFiles.length > 0
                        ? `נבחרו ${selectedFiles.length} קבצים: ${selectedFiles.map((f) => f.name).join(', ')}`
                        : 'לחץ לבחירת דוחות (ניתן לבחור מספר דוחות משנים שונות יחד) או גרור לכאן'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                      תומך ב-<strong>PDF</strong>, צילומי מסך <strong>(PNG/JPG)</strong>, או <strong>Excel / CSV</strong>.
                      המערכת תסדר את הדוחות כרונולוגית ותמנע רווחים או הפקדות מפוברקות!
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mode 2: Direct Text Paste */}
          {activeInputMode === 'TEXT' && !previewData && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                הדבק כאן טקסט מתוך דוח החשבון:
              </label>
              <textarea
                rows={7}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`לדוגמה:\nדוח מצב חשבון על שם נדב בר לתאריך 30.06.2026\nשם הנייר כמות מחיר ליום הדוח שווי\nMSTR 17.6999 86.93 1,538.65\nQQQ 1.5551 736.40 1,145.18\nיתרת מזומן בדולר ארה"ב 1,400.82`}
                className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
              <button
                onClick={handleParsePastedText}
                disabled={isProcessing || !pastedText.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>פענח טקסט זה</span>
              </button>
            </div>
          )}

          {/* PREVIEW: Consolidated Chronological Overview */}
          {consolidated && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Header Info & Timeline Bar */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {consolidated.clientName ? `דוחות תיק על שם: ${consolidated.clientName}` : 'איחוד דוחות מאומת'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        איחוד של <strong>{consolidated.statementsCount} תקופות</strong> | טווח תאריכים:{' '}
                        <strong>{consolidated.earliestStatementDate || 'התחלה'}</strong> ➔{' '}
                        <strong>{consolidated.latestStatementDate || 'עדכני'}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setPreviewData(null);
                      setSelectedFiles([]);
                      setPastedText('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    טען קבצים אחרים
                  </button>
                </div>

                {/* Timeline Pills of Statements */}
                {consolidated.statementDates && consolidated.statementDates.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 font-medium">ציר זמן תקופות שזוהו:</span>
                    {consolidated.statementDates.map((d: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-[11px] font-bold text-slate-200"
                      >
                        <Calendar className="h-3 w-3 text-cyan-400" />
                        <span>דוח {d}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary Financial Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-0.5">סך הפקדות הון:</span>
                  <span className="text-base font-bold text-cyan-400">
                    +${consolidated.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-0.5">סך משיכות הון:</span>
                  <span className="text-base font-bold text-amber-400">
                    -${consolidated.totalWithdrawn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-0.5">יתרת מזומן נוכחית:</span>
                  <span className="text-base font-bold text-white">
                    ${consolidated.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-0.5">שווי תיק כולל עדכני:</span>
                  <span className="text-base font-bold text-emerald-400">
                    ${consolidated.totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabs: Active Holdings vs Closed Trades vs Transactions vs Years */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
                <button
                  onClick={() => setPreviewTab('active')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    previewTab === 'active'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                  }`}
                >
                  החזקות פתוחות בעלות אמת ({consolidated.activeHoldings?.length || 0})
                </button>
                <button
                  onClick={() => setPreviewTab('closed')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    previewTab === 'closed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                  }`}
                >
                  עסקאות שנסגרו ({consolidated.closedTrades?.length || 0})
                </button>
                <button
                  onClick={() => setPreviewTab('years')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    previewTab === 'years'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                  }`}
                >
                  רווחים לפי שנים
                </button>
                <button
                  onClick={() => setPreviewTab('transactions')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    previewTab === 'transactions'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                  }`}
                >
                  ספר תנועות מאוחד ({consolidated.allTransactions?.length || 0})
                </button>
              </div>

              {/* Tab 1: Active Holdings with True Cost Basis */}
              {previewTab === 'active' && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-900/80 sticky top-0">
                          <th className="py-2.5 px-3">טיקר</th>
                          <th className="py-2.5 px-3">שם החברה</th>
                          <th className="py-2.5 px-3">כמות</th>
                          <th className="py-2.5 px-3">עלות קנייה משוקללת</th>
                          <th className="py-2.5 px-3">מחיר סוף דוח</th>
                          <th className="py-2.5 px-3">שווי שוק</th>
                          <th className="py-2.5 px-3">רווח/הפסד לא ממומש</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-[11px]">
                        {(consolidated.activeHoldings || []).map((h: any, idx: number) => {
                          const pnl = h.unrealizedPnL || 0;
                          const isPos = pnl >= 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 font-bold text-white">{h.ticker}</td>
                              <td className="py-2.5 px-3 text-slate-300">{h.assetName || h.ticker}</td>
                              <td className="py-2.5 px-3 text-slate-200 font-mono">{h.quantity}</td>
                              <td className="py-2.5 px-3 font-semibold text-cyan-300">
                                ${Number(h.buyPrice).toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-300">${Number(h.reportPrice).toFixed(2)}</td>
                              <td className="py-2.5 px-3 font-semibold text-white">${Number(h.value).toFixed(2)}</td>
                              <td className="py-2.5 px-3 font-bold">
                                <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                                  {isPos ? '+' : ''}${pnl.toFixed(2)} ({h.unrealizedPnLPercent > 0 ? '+' : ''}
                                  {h.unrealizedPnLPercent?.toFixed(2)}%)
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Closed Trades */}
              {previewTab === 'closed' && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-900/80 sticky top-0">
                          <th className="py-2.5 px-3">טיקר</th>
                          <th className="py-2.5 px-3">תאריך קנייה</th>
                          <th className="py-2.5 px-3">מחיר קנייה</th>
                          <th className="py-2.5 px-3">תאריך מכירה</th>
                          <th className="py-2.5 px-3">מחיר מכירה</th>
                          <th className="py-2.5 px-3">כמות</th>
                          <th className="py-2.5 px-3">רווח ממומש</th>
                          <th className="py-2.5 px-3">שנה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-[11px]">
                        {(consolidated.closedTrades || []).map((ct: any, idx: number) => {
                          const isPos = ct.realizedPnL >= 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 font-bold text-white">{ct.ticker}</td>
                              <td className="py-2.5 px-3 text-slate-400">{ct.buyDate}</td>
                              <td className="py-2.5 px-3 text-slate-300">${ct.buyPrice.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-slate-400">{ct.sellDate}</td>
                              <td className="py-2.5 px-3 text-slate-300">${ct.sellPrice.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-slate-200">{ct.quantity}</td>
                              <td className="py-2.5 px-3 font-bold">
                                <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                                  {isPos ? '+' : ''}${ct.realizedPnL.toFixed(2)} ({ct.realizedPnLPercent > 0 ? '+' : ''}
                                  {ct.realizedPnLPercent.toFixed(2)}%)
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                                  {ct.year}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Years Summary */}
              {previewTab === 'years' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(consolidated.realizedPnLByYear || {}).map(([yr, data]: [string, any]) => {
                    const isPos = data.pnl >= 0;
                    return (
                      <div key={yr} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-white">שנת {yr}</span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isPos ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            רווח ממומש: {isPos ? '+' : ''}${data.pnl.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          עסקאות שנסגרו בשנה זו: <strong>{data.count}</strong> | סך תמורה ממכירות:{' '}
                          <strong>${data.volume?.toFixed(2)}</strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab 4: All Transactions */}
              {previewTab === 'transactions' && (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-900/80 sticky top-0">
                          <th className="py-2 px-3">תאריך</th>
                          <th className="py-2 px-3">פעולה</th>
                          <th className="py-2 px-3">נייר</th>
                          <th className="py-2 px-3">כמות</th>
                          <th className="py-2 px-3">מחיר</th>
                          <th className="py-2 px-3">סכום</th>
                          <th className="py-2 px-3">יתרת מזומן</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-[11px]">
                        {(consolidated.allTransactions || []).map((tx: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 text-slate-300">{tx.date}</td>
                            <td className="py-2 px-3 font-semibold text-amber-300">{tx.actionType}</td>
                            <td className="py-2 px-3 font-bold text-white">{tx.ticker || '—'}</td>
                            <td className="py-2 px-3 text-slate-300">{tx.quantity || '—'}</td>
                            <td className="py-2 px-3 text-slate-300">{tx.price ? `$${tx.price.toFixed(2)}` : '—'}</td>
                            <td className={`py-2 px-3 font-semibold ${tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-slate-300">
                              {tx.cashBalance != null ? `$${tx.cashBalance.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Wipe Clean Option */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <input
                  type="checkbox"
                  id="wipeExistingClean"
                  checked={wipeExisting}
                  onChange={(e) => setWipeExisting(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-950 h-4 w-4"
                />
                <label htmlFor="wipeExistingClean" className="text-xs text-slate-300 cursor-pointer">
                  החלף את כל התיק בנתוני מסמכים אלו בלבד (מוחק נתונים קודמים אם היו)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!previewData?.consolidated || isProcessing}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>טוען ומסנכרן...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>אשר וטען את כל התקופות לתיק ההשקעות שלי</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
