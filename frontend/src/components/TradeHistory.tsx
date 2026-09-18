import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Trash2,
  Calendar,
  Tag,
  ShieldAlert,
  Target,
  ArrowUpRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import { Trade } from '../types/trade';

interface TradeHistoryProps {
  trades: Trade[];
  onDeleteTrade: (id: string) => Promise<void>;
  onOpenImportModal: () => void;
}

type SortField = 'ticker' | 'buyDate' | 'sellDate' | 'buyPrice' | 'sellPrice' | 'quantity' | 'realizedPnL' | 'realizedPnLPercent' | 'strategyTag';
type SortDirection = 'asc' | 'desc';

export const TradeHistory: React.FC<TradeHistoryProps> = ({
  trades,
  onDeleteTrade,
  onOpenImportModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [strategyFilter, setStrategyFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');
  const [exitReasonFilter, setExitReasonFilter] = useState('ALL');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('sellDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Extract unique strategies
  const uniqueStrategies = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.strategyTag) set.add(t.strategyTag);
    });
    return ['ALL', ...Array.from(set)];
  }, [trades]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const matchesSearch =
        trade.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStrategy =
        strategyFilter === 'ALL' || trade.strategyTag === strategyFilter;

      const pnl = trade.realizedPnL || 0;
      const matchesOutcome =
        outcomeFilter === 'ALL' ||
        (outcomeFilter === 'WINS' && pnl > 0) ||
        (outcomeFilter === 'LOSSES' && pnl < 0);

      const matchesExit =
        exitReasonFilter === 'ALL' || trade.exitReason === exitReasonFilter;

      return matchesSearch && matchesStrategy && matchesOutcome && matchesExit;
    });
  }, [trades, searchTerm, strategyFilter, outcomeFilter, exitReasonFilter]);

  // Sorted trades
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'buyDate' || sortField === 'sellDate') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      } else {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTrades, sortField, sortDirection]);

  // Paginated trades
  const totalPages = Math.ceil(sortedTrades.length / pageSize) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTrades.slice(start, start + pageSize);
  }, [sortedTrades, currentPage, pageSize]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-600 group-hover:text-slate-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-400" />
    );
  };

  const renderExitBadge = (reason?: string) => {
    switch (reason) {
      case 'STOP_LOSS':
        return (
          <Badge variant="destructive" className="gap-1 font-mono">
            <ShieldAlert className="h-3 w-3" /> Stop-Loss
          </Badge>
        );
      case 'TARGET_REACHED':
        return (
          <Badge variant="success" className="gap-1 font-mono">
            <Target className="h-3 w-3" /> Target Hit
          </Badge>
        );
      case 'MANUAL_EXIT':
        return (
          <Badge variant="info" className="gap-1 font-mono">
            <ArrowUpRight className="h-3 w-3" /> Manual Exit
          </Badge>
        );
      case 'IMPORTED':
      default:
        return (
          <Badge variant="secondary" className="gap-1 font-mono">
            Historical
          </Badge>
        );
    }
  };

  const calculateHoldingDays = (buyDateStr: string, sellDateStr?: string) => {
    if (!sellDateStr) return '1d';
    const start = new Date(buyDateStr).getTime();
    const end = new Date(sellDateStr).getTime();
    const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    return `${diffDays}d`;
  };

  const exportFilteredToCSV = () => {
    if (sortedTrades.length === 0) return;
    const headers = 'Ticker,Type,Strategy,BuyDate,SellDate,BuyPrice,SellPrice,Quantity,RealizedPnL,RealizedPnLPercent,ExitReason,Notes\n';
    const rows = sortedTrades
      .map((t) =>
        [
          t.ticker,
          t.type,
          `"${t.strategyTag}"`,
          t.buyDate,
          t.sellDate || '',
          t.buyPrice,
          t.sellPrice || '',
          t.quantity,
          t.realizedPnL || 0,
          t.realizedPnLPercent || 0,
          t.exitReason || '',
          `"${(t.notes || '').replace(/"/g, '""')}"`,
        ].join(',')
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tradetracker_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/80 shadow-lg">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Trade History & Audit Journal</CardTitle>
              <Badge variant="secondary">
                {filteredTrades.length} Records
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Shadcn Data Table with interactive multi-column sorting, outcome filtering, and CSV export.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportFilteredToCSV}
              disabled={sortedTrades.length === 0}
              className="gap-1.5 text-xs text-slate-300"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenImportModal}
              className="gap-1.5 text-xs text-cyan-300 border-slate-700"
            >
              <Calendar className="h-3.5 w-3.5 text-cyan-400" />
              <span>Import History</span>
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search ticker or note..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Strategy Filter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <Tag className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <select
              value={strategyFilter}
              onChange={(e) => {
                setStrategyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-200 focus:outline-none text-xs w-full cursor-pointer"
            >
              {uniqueStrategies.map((s) => (
                <option key={s} value={s} className="bg-slate-900 text-slate-200">
                  {s === 'ALL' ? 'All Strategies' : s}
                </option>
              ))}
            </select>
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <Filter className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-200 focus:outline-none text-xs w-full cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Outcomes</option>
              <option value="WINS" className="bg-slate-900 text-emerald-400">Wins Only (+)</option>
              <option value="LOSSES" className="bg-slate-900 text-rose-400">Losses Only (-)</option>
            </select>
          </div>

          {/* Exit Trigger Filter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
            <select
              value={exitReasonFilter}
              onChange={(e) => {
                setExitReasonFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-200 focus:outline-none text-xs w-full cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Exit Reasons</option>
              <option value="STOP_LOSS" className="bg-slate-900 text-rose-400">Stop-Loss Hit</option>
              <option value="TARGET_REACHED" className="bg-slate-900 text-emerald-400">Target Reached</option>
              <option value="MANUAL_EXIT" className="bg-slate-900 text-blue-400">Manual Exit</option>
              <option value="IMPORTED" className="bg-slate-900 text-slate-300">Historical Import</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredTrades.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-500 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-white mb-1">No Matching Trades Found</p>
            <p className="text-xs text-slate-400 mb-4">
              Try adjusting your search keywords, strategy selection, or exit filters.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Ticker */}
                  <TableHead>
                    <button
                      onClick={() => handleSort('ticker')}
                      className="group flex items-center gap-1.5 uppercase text-[11px] hover:text-white"
                    >
                      <span>Ticker</span>
                      {renderSortIndicator('ticker')}
                    </button>
                  </TableHead>

                  {/* Strategy */}
                  <TableHead>
                    <button
                      onClick={() => handleSort('strategyTag')}
                      className="group flex items-center gap-1.5 uppercase text-[11px] hover:text-white"
                    >
                      <span>Strategy</span>
                      {renderSortIndicator('strategyTag')}
                    </button>
                  </TableHead>

                  {/* Dates & Hold */}
                  <TableHead>
                    <button
                      onClick={() => handleSort('sellDate')}
                      className="group flex items-center gap-1.5 uppercase text-[11px] hover:text-white"
                    >
                      <span>Date & Hold</span>
                      {renderSortIndicator('sellDate')}
                    </button>
                  </TableHead>

                  {/* Buy Price */}
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort('buyPrice')}
                      className="group flex items-center justify-end gap-1.5 uppercase text-[11px] hover:text-white w-full"
                    >
                      <span>Buy Price</span>
                      {renderSortIndicator('buyPrice')}
                    </button>
                  </TableHead>

                  {/* Sell Price */}
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort('sellPrice')}
                      className="group flex items-center justify-end gap-1.5 uppercase text-[11px] hover:text-white w-full"
                    >
                      <span>Sell Price</span>
                      {renderSortIndicator('sellPrice')}
                    </button>
                  </TableHead>

                  {/* Quantity */}
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort('quantity')}
                      className="group flex items-center justify-end gap-1.5 uppercase text-[11px] hover:text-white w-full"
                    >
                      <span>Shares</span>
                      {renderSortIndicator('quantity')}
                    </button>
                  </TableHead>

                  {/* Realized PnL */}
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort('realizedPnL')}
                      className="group flex items-center justify-end gap-1.5 uppercase text-[11px] hover:text-white w-full"
                    >
                      <span>Realized PnL</span>
                      {renderSortIndicator('realizedPnL')}
                    </button>
                  </TableHead>

                  {/* Exit Reason */}
                  <TableHead className="text-center">Exit Trigger</TableHead>

                  {/* Notes */}
                  <TableHead>Rationale</TableHead>

                  {/* Actions */}
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedTrades.map((trade) => {
                  const pnl = trade.realizedPnL || 0;
                  const pnlPct = trade.realizedPnLPercent || 0;
                  const isWin = pnl >= 0;

                  return (
                    <TableRow key={trade._id}>
                      {/* Ticker */}
                      <TableCell className="font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">
                            {trade.ticker}
                          </span>
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {trade.type}
                          </span>
                        </div>
                      </TableCell>

                      {/* Strategy */}
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="info">
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {trade.strategyTag || 'Discretionary'}
                        </Badge>
                      </TableCell>

                      {/* Dates & Hold */}
                      <TableCell className="whitespace-nowrap text-slate-300">
                        <div className="text-[11px]">
                          <div>
                            {new Date(trade.buyDate).toLocaleDateString()} &rarr;{' '}
                            {trade.sellDate ? new Date(trade.sellDate).toLocaleDateString() : 'Closed'}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            Hold: {calculateHoldingDays(trade.buyDate, trade.sellDate)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Buy Price */}
                      <TableCell className="text-right font-mono text-slate-300">
                        ${trade.buyPrice.toFixed(2)}
                      </TableCell>

                      {/* Sell Price */}
                      <TableCell className="text-right font-mono text-white font-bold">
                        ${trade.sellPrice ? trade.sellPrice.toFixed(2) : '-'}
                      </TableCell>

                      {/* Quantity */}
                      <TableCell className="text-right font-mono text-slate-400">
                        {trade.quantity}
                      </TableCell>

                      {/* Realized PnL */}
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        <div
                          className={`font-bold text-sm flex items-center justify-end gap-1 ${
                            isWin ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isWin ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isWin ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                        </div>
                        <div className={`text-[11px] font-semibold ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isWin ? '+' : ''}{pnlPct.toFixed(2)}%
                        </div>
                      </TableCell>

                      {/* Exit Reason */}
                      <TableCell className="text-center whitespace-nowrap">
                        {renderExitBadge(trade.exitReason)}
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="max-w-[180px] truncate text-slate-400 text-[11px]">
                        {trade.notes || '-'}
                      </TableCell>

                      {/* Delete Action */}
                      <TableCell className="text-center">
                        <button
                          onClick={() => onDeleteTrade(trade._id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredTrades.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredTrades.length)} to{' '}
                {Math.min(currentPage * pageSize, filteredTrades.length)} of {filteredTrades.length} entries
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </Button>
              <span className="px-2 font-mono text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 px-2"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
