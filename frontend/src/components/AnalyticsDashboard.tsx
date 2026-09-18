import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Calendar,
  PieChart as PieIcon,
  Tag,
  Filter,
  Layers,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AnalyticsSummary } from '../types/trade';

interface AnalyticsDashboardProps {
  analytics: AnalyticsSummary | null;
  isLoading: boolean;
  onStrategyFilterChange?: (strategy: string) => void;
  selectedStrategy?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analytics,
  isLoading,
  onStrategyFilterChange,
  selectedStrategy = 'ALL',
}) => {
  const [activeCurveMode, setActiveCurveMode] = useState<'cumulative' | 'equity'>('cumulative');

  if (isLoading || !analytics) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-72 rounded-xl bg-slate-900/60 border border-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 rounded-xl bg-slate-900/60 border border-slate-800" />
          <div className="h-64 rounded-xl bg-slate-900/60 border border-slate-800" />
        </div>
      </div>
    );
  }

  const {
    equityCurve,
    dailyCalendarPnL,
    winLossDistribution,
    strategyBreakdown,
    winRatePercent,
    profitFactor,
    totalRealizedPnL,
  } = analytics;

  // Pie chart data
  const pieData = [
    { name: 'Wins', value: winLossDistribution.wins, color: '#10b981' },
    { name: 'Losses', value: winLossDistribution.losses, color: '#ef4444' },
    { name: 'Breakeven', value: winLossDistribution.breakeven, color: '#64748b' },
  ].filter((d) => d.value > 0);

  // Strategy performance data formatted for BarChart
  const strategyChartData = strategyBreakdown.map((s) => ({
    name: s.strategy,
    pnl: s.totalPnL,
    winRate: s.winRate,
    trades: s.totalTrades,
  }));

  // Best strategy
  const bestStrategy = [...strategyBreakdown].sort((a, b) => b.totalPnL - a.totalPnL)[0];

  // Calendar cells
  const calendarCells = dailyCalendarPnL.slice(-35);

  const getCalendarDayColor = (pnl: number) => {
    if (pnl > 500) return 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/50';
    if (pnl > 150) return 'bg-emerald-600/90 text-white';
    if (pnl > 0) return 'bg-emerald-700/60 text-emerald-100';
    if (pnl === 0) return 'bg-slate-800 text-slate-400';
    if (pnl > -150) return 'bg-rose-700/60 text-rose-100';
    if (pnl > -500) return 'bg-rose-600/90 text-white';
    return 'bg-rose-500 text-white shadow-sm shadow-rose-500/50';
  };

  const availableStrategies = useMemo(() => {
    return ['ALL', ...strategyBreakdown.map((s) => s.strategy)];
  }, [strategyBreakdown]);

  return (
    <div className="space-y-6">
      {/* Strategy Tag Filter Header */}
      <Card className="border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Filter Analytics by Strategy Tag:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {availableStrategies.map((strat) => (
              <Button
                key={strat}
                variant={selectedStrategy === strat ? 'default' : 'secondary'}
                size="sm"
                onClick={() => onStrategyFilterChange && onStrategyFilterChange(strat)}
                className={`text-xs h-7 px-2.5 ${
                  selectedStrategy === strat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {strat === 'ALL' ? 'All Strategies' : strat}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* 1. Equity Curve Line/Area Chart */}
      <Card className="border-slate-800 bg-slate-900/80 shadow-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <CardTitle>Portfolio Equity Curve</CardTitle>
                {selectedStrategy !== 'ALL' && (
                  <Badge variant="info">
                    Filtered: {selectedStrategy}
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-0.5">
                Dynamic line chart tracking total portfolio growth and cumulative trade returns over time.
              </CardDescription>
            </div>

            <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 self-start text-xs font-semibold">
              <button
                onClick={() => setActiveCurveMode('cumulative')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeCurveMode === 'cumulative'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cumulative PnL ($)
              </button>
              <button
                onClick={() => setActiveCurveMode('equity')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeCurveMode === 'equity'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Portfolio Equity ($10k base)
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {equityCurve.length <= 1 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
              No closed trades found for this strategy to chart equity curve.
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => {
                      const parts = val.split('-');
                      return parts.length === 3 ? `${parts[1]}/${parts[2]}` : val;
                    }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => `$${val.toLocaleString()}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const isWin = data.tradePnL >= 0;
                        return (
                          <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 shadow-xl text-xs font-mono">
                            <div className="text-slate-400 font-sans text-[11px] mb-1">
                              {data.date} {data.ticker ? `(${data.ticker})` : ''} {data.strategy ? `[${data.strategy}]` : ''}
                            </div>
                            {data.tradeIndex > 0 && (
                              <div className="flex justify-between gap-4 mb-1">
                                <span className="text-slate-400">Trade PnL:</span>
                                <span className={isWin ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                  {isWin ? '+' : ''}${data.tradePnL.toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Cumulative PnL:</span>
                              <span className="text-white font-bold">
                                ${data.cumulativePnL.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Total Account Equity:</span>
                              <span className="text-emerald-400 font-bold">
                                ${data.equity.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={activeCurveMode === 'cumulative' ? 'cumulativePnL' : 'equity'}
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#equityGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Middle Row: Calendar PnL Heatmap & Win/Loss Doughnut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PnL Calendar Heatmap */}
        <Card className="lg:col-span-2 border-slate-800 bg-slate-900/80 shadow-md flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-cyan-400" />
                <CardTitle>Daily PnL Calendar Heatmap</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                Green = Win / Red = Loss
              </Badge>
            </div>
            <CardDescription>
              Visual calendar matrix showing profit/loss intensity by trading session.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {calendarCells.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-slate-500 text-xs">
                No trading sessions recorded for current filter.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                {calendarCells.map((day) => {
                  const isPositive = day.pnl > 0;
                  const isZero = day.pnl === 0;

                  return (
                    <div
                      key={day.date}
                      className={`rounded-lg p-2.5 border border-slate-700/50 flex flex-col justify-between transition-all hover:scale-105 cursor-pointer ${getCalendarDayColor(
                        day.pnl
                      )}`}
                      title={`${day.date}: ${isPositive ? '+' : ''}$${day.pnl} (${day.tradesCount} trades, ${day.wins}W / ${day.losses}L)`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-80 mb-1">
                        <span>{day.date.slice(5)}</span>
                        <span>{day.tradesCount}t</span>
                      </div>
                      <div className="font-mono font-bold text-xs tracking-tight">
                        {isZero ? '$0' : `${isPositive ? '+' : '-'}$${Math.abs(day.pnl).toFixed(0)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-[11px]">Heatmap Scale:</span>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <span className="h-3 w-5 rounded bg-rose-600 inline-block" />
                  <span className="h-3 w-5 rounded bg-rose-800 inline-block" />
                  <span className="h-3 w-5 rounded bg-slate-800 inline-block" />
                  <span className="h-3 w-5 rounded bg-emerald-800 inline-block" />
                  <span className="h-3 w-5 rounded bg-emerald-500 inline-block" />
                </div>
              </div>
              <span className="font-mono text-[11px] text-slate-300">
                Recorded Sessions: {dailyCalendarPnL.length}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Win / Loss Doughnut Chart */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-md flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-indigo-400" />
              <CardTitle>Win / Loss Distribution</CardTitle>
            </div>
            <CardDescription>
              Outcome ratio of settled positions.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-slate-500 text-xs">
                No closed trades to compute win ratio.
              </div>
            ) : (
              <div className="h-48 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          return (
                            <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-xs font-mono text-white">
                              {data.name}: <strong className="text-emerald-400">{data.value}</strong>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black font-mono text-white">
                    {winRatePercent.toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Win Rate</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center text-xs">
              <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/20">
                <div className="text-[10px] text-slate-400">Wins</div>
                <div className="font-bold font-mono text-emerald-400 text-sm">
                  {winLossDistribution.wins}
                </div>
              </div>
              <div className="p-2 rounded bg-rose-950/30 border border-rose-500/20">
                <div className="text-[10px] text-slate-400">Losses</div>
                <div className="font-bold font-mono text-rose-400 text-sm">
                  {winLossDistribution.losses}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-800/40 border border-slate-700/40">
                <div className="text-[10px] text-slate-400">Tie/BE</div>
                <div className="font-bold font-mono text-slate-300 text-sm">
                  {winLossDistribution.breakeven}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Strategy Tag Performance Comparison */}
      <Card className="border-slate-800 bg-slate-900/80 shadow-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-400" />
                <CardTitle>Strategy Tag Performance Matrix</CardTitle>
              </div>
              <CardDescription>
                Compare strategy setups ("Moving Average Cross", "VIX Reversal", "Breakout", "Moving Average Bounce", "VIX Hedge") to identify which strategy delivers maximum profit factor and edge.
              </CardDescription>
            </div>

            {bestStrategy && (
              <Badge variant="warning" className="gap-1.5 self-start text-xs py-1">
                <Award className="h-3.5 w-3.5 text-amber-400" />
                <span>Most Profitable: {bestStrategy.strategy} (+${bestStrategy.totalPnL.toFixed(0)})</span>
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {strategyBreakdown.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-slate-500 text-xs">
              No strategy tags logged yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-white">
                              <div className="font-bold text-cyan-400 font-sans mb-1">{d.name}</div>
                              <div>Net PnL: <strong className={d.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${d.pnl.toFixed(2)}</strong></div>
                              <div>Win Rate: <strong>{d.winRate}%</strong></div>
                              <div>Trades: <strong>{d.trades}</strong></div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="pnl"
                      name="Net PnL ($)"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Strategy Tag</th>
                      <th className="py-2.5 px-3 text-right">Trades</th>
                      <th className="py-2.5 px-3 text-right">Win Rate</th>
                      <th className="py-2.5 px-3 text-right">Profit Factor</th>
                      <th className="py-2.5 px-3 text-right">Net Realized PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {strategyBreakdown.map((s) => {
                      const isPositive = s.totalPnL >= 0;
                      return (
                        <tr
                          key={s.strategy}
                          onClick={() => onStrategyFilterChange && onStrategyFilterChange(s.strategy)}
                          className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3 font-semibold text-white">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-cyan-400" />
                              {s.strategy}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {s.totalTrades}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <span className={s.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}>
                              {s.winRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {s.profitFactor >= 90 ? '99.9+' : s.profitFactor.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                              {isPositive ? '+' : ''}${s.totalPnL.toFixed(2)}
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
        </CardContent>
      </Card>
    </div>
  );
};
