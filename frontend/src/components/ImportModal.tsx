import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Table,
  ArrowRight,
  FileText,
  Sparkles,
  Wand2,
  Cpu,
  HelpCircle,
  Settings,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { api } from '../services/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // AI Schema Mapping state
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);
  const [requiresManualMapping, setRequiresManualMapping] = useState(false);
  const [manualMapping, setManualMapping] = useState<Record<string, string>>({
    ticker: '',
    buyPrice: '',
    quantity: '',
    buyDate: '',
    stopLossPrice: '',
    targetPrice: '',
    sellPrice: '',
    sellDate: '',
    strategyTag: '',
    notes: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    executeMagicImport(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    executeMagicImport(droppedFile);
  };

  const executeMagicImport = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setSuccessMsg(null);
    setRequiresManualMapping(false);
    setAiAnalysisResult(null);
    setImporting(true);

    try {
      const res = await api.magicImport(selectedFile, geminiApiKey || undefined);

      if (res.requiresManualMapping) {
        setRequiresManualMapping(true);
        setAiAnalysisResult(res);
        // Pre-populate partial mappings
        setManualMapping((prev) => ({
          ...prev,
          ...(res.partialMapping || {}),
        }));
        setError(res.message || 'Please specify the missing columns below.');
      } else {
        setAiAnalysisResult(res);
        setSuccessMsg(
          `AI Magic Import Successful! ${res.importedCount} trades imported using ${res.modelUsed || 'Gemini AI'}.`
        );
        await onImportComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process file with AI Magic Import.');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmManualMapping = async () => {
    if (!file) return;
    if (!manualMapping.ticker || !manualMapping.buyPrice) {
      setError('Please select columns for both Ticker and Buy Price.');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      const res = await api.magicConfirm(file, manualMapping);
      setSuccessMsg(`Successfully imported ${res.importedCount} trades into your journal!`);
      setRequiresManualMapping(false);
      await onImportComplete();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Manual mapping import failed.');
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      'ticker,buyPrice,quantity,buyDate,stopLossPrice,targetPrice,sellPrice,sellDate,status,strategyTag,exitReason,notes\n' +
      'NVDA,115.00,50,2024-01-10,108.00,135.00,132.50,2024-01-25,CLOSED,Breakout,TARGET_REACHED,Bullish breakout above ATH resistance\n' +
      'TSLA,220.00,30,2024-02-05,208.00,250.00,208.00,2024-02-12,CLOSED,Moving Average Cross,STOP_LOSS,Clean stop out on 50 EMA breach\n' +
      'AAPL,185.00,40,2024-03-01,178.00,210.00,205.00,2024-03-24,CLOSED,Breakout,TARGET_REACHED,Rallied after tech product keynote\n' +
      'SPY,510.00,35,2024-04-10,498.00,535.00,528.00,2024-05-02,CLOSED,VIX Reversal,MANUAL_EXIT,VIX spiked and reversed off 30\n' +
      'MSFT,420.00,20,2024-05-15,400.00,460.00,,,ACTIVE,Moving Average Bounce,,Long term cloud trend continuation\n' +
      'AMZN,178.00,45,2024-06-01,170.00,195.00,192.50,2024-06-20,CLOSED,Moving Average Cross,TARGET_REACHED,Golden cross confirmation trade';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tradetracker_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0e1626] border border-slate-800 shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-500/20">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">AI "Magic Import" via Gemini API</h3>
                <Badge variant="info" className="gap-1 text-[10px]">
                  <Sparkles className="h-2.5 w-2.5 text-cyan-300" /> Hybrid Schema Mapping
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Upload files in ANY structure or language (English, Hebrew, Broker exports).
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

        {/* Optional Gemini API Key Bar */}
        <div className="mb-3 flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span>AI Model Engine: <strong className="text-white">Google Gemini 1.5 Flash + Hybrid Semantic Engine</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
          >
            <Settings className="h-3 w-3" />
            {showKeyInput ? 'Hide Key' : 'Custom Gemini Key'}
          </button>
        </div>

        {showKeyInput && (
          <div className="mb-3 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <label className="text-[11px] text-slate-300 block">
              Optional Google Gemini API Key (defaults to backend configuration):
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dropzone */}
        {!requiresManualMapping && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-7 text-center cursor-pointer bg-slate-950/50 hover:bg-slate-900/60 transition-all mb-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-2">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-white">
                {file ? file.name : 'Drop Excel (.xlsx, .xls) or CSV file here'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Hybrid AI extracts 5 sample rows $\rightarrow$ Gemini maps the schema $\rightarrow$ 10,000+ rows parsed locally with zero token overload!
              </p>
              {importing && (
                <div className="mt-3 flex items-center gap-2 text-xs text-cyan-400 font-semibold animate-pulse">
                  <Sparkles className="h-4 w-4" />
                  <span>Gemini AI is analyzing column headers & mapping schema...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Mapping Results Banner */}
        {aiAnalysisResult?.mappingUsed && !requiresManualMapping && (
          <div className="mb-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                AI Mapping Detected ({aiAnalysisResult.detectedLanguage || 'Auto'})
              </span>
              <Badge variant="success">
                {aiAnalysisResult.modelUsed}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
              {Object.entries(aiAnalysisResult.mappingUsed)
                .filter(([_, val]) => Boolean(val))
                .map(([field, colName]) => (
                  <div key={field} className="p-1.5 rounded bg-slate-900 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">{field}</span>
                    <span className="text-cyan-300 font-bold truncate block">{String(colName)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Manual Column Picker if LLM requests clarification */}
        {requiresManualMapping && aiAnalysisResult?.headers && (
          <div className="space-y-3 mb-4 p-4 rounded-xl bg-slate-950 border border-amber-500/40">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertCircle className="h-4 w-4" />
              <span>Select Columns for Missing Critical Data:</span>
            </div>
            <p className="text-xs text-slate-400">
              The AI mapped what it could, but needs you to clarify the following columns:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Ticker Column */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Ticker / Symbol *
                </label>
                <select
                  value={manualMapping.ticker || ''}
                  onChange={(e) => setManualMapping({ ...manualMapping, ticker: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Column --</option>
                  {aiAnalysisResult.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buy Price Column */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Buy / Entry Price *
                </label>
                <select
                  value={manualMapping.buyPrice || ''}
                  onChange={(e) => setManualMapping({ ...manualMapping, buyPrice: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Column --</option>
                  {aiAnalysisResult.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Column */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Quantity / Shares
                </label>
                <select
                  value={manualMapping.quantity || ''}
                  onChange={(e) => setManualMapping({ ...manualMapping, quantity: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Column (or default to 1) --</option>
                  {aiAnalysisResult.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sell Price Column */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Sell / Exit Price
                </label>
                <select
                  value={manualMapping.sellPrice || ''}
                  onChange={(e) => setManualMapping({ ...manualMapping, sellPrice: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Optional: Sell Price --</option>
                  {aiAnalysisResult.headers.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleConfirmManualMapping}
                disabled={!manualMapping.ticker || !manualMapping.buyPrice || importing}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
              >
                <span>Complete Local Import</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Template Download */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs mb-4">
          <div className="flex items-center gap-2 text-slate-300">
            <FileText className="h-4 w-4 text-cyan-400" />
            <span>Need a formatted CSV / Excel template?</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={downloadSampleTemplate}
            className="gap-1.5 text-cyan-300 border-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Template</span>
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
