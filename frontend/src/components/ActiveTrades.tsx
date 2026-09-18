import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ArrowDownCircle,
  Clock,
  Tag,
  DollarSign,
  CheckCircle2,
  Trash2,
  Edit2,
  Zap,
  Target,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trade } from '../types/trade';

interface ActiveTradesProps {
  trades: Trade[];
  onOpenCloseModal: (trade: Trade) => void;
  onOpenEditModal: (trade: Trade) => void;
  onDeleteTrade: (id: string) => Promise<void>;
  onSimulatePriceDrop: (ticker: string, targetPrice: number) => Promise<void>;
  onOpenAddModal: () => void;
}

export const ActiveTrades: React.FC<ActiveTradesProps> = ({
  trades,
  onOpenCloseModal,
  onOpenEditModal,
  onDeleteTrade,
  onSimulatePriceDrop,
  onOpenAddModal,
}) => {
  const [simulatingTicker, setSimulatingTicker] = useState<string | null>(null);

  const handleSimulate = async (trade: Trade) => {
    // Drop price to 0.5% below stop-loss price
    const sl = trade.stopLossPrice || trade.buyPrice * 0.95;
    const triggerPrice = Number((sl * 0.995).toFixed(2));
    try {
      setSimulatingTicker(trade.ticker);
      await onSimulatePriceDrop(trade.ticker, triggerPrice);
    } finally {
      setSimulatingTicker(null);
    }
  };

  if (trades.length === 0) {
    return (
      <Card className="p-12 text-center border-slate-800 bg-slate-900/40">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <CardTitle className="text-lg mb-1">No Active Positions</CardTitle>
        <CardDescription className="max-w-md mx-auto mb-6">
          You currently have no open risk. All cash is preserved or positions have reached their profit targets/stop-losses.
        </CardDescription>
        <Button
          variant="default"
          onClick={onOpenAddModal}
          className="gap-2 shadow-lg shadow-emerald-600/20"
        >
          <TrendingUp className="h-4 w-4" />
          <span>Open New Position</span>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Active Positions</h2>
            <Badge variant="success">
              {trades.length} Open
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time market tracking with automated stop-loss protection and buffer metrics.
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={onOpenAddModal}
          className="gap-1.5"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Add Trade</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trades.map((trade) => {
          const currentPrice = trade.currentPrice || trade.buyPrice;
          const unrealizedPnL =
            trade.unrealizedPnL != null
              ? trade.unrealizedPnL
              : (currentPrice - trade.buyPrice) * trade.quantity;
          const unrealizedPct =
            trade.unrealizedPnLPercent != null
              ? trade.unrealizedPnLPercent
              : ((currentPrice - trade.buyPrice) / trade.buyPrice) * 100;
          const isPositive = unrealizedPnL >= 0;

          // Stop-loss buffer calculation
          const slDistance = trade.stopLossPrice
            ? ((currentPrice - trade.stopLossPrice) / currentPrice) * 100
            : null;

          const isCriticalSL = slDistance !== null && slDistance <= 2.0;
          const isWarningSL = slDistance !== null && slDistance > 2.0 && slDistance <= 5.0;

          const positionValue = currentPrice * trade.quantity;

          // Risk & Target channels
          const safeStop = trade.stopLossPrice || trade.buyPrice * 0.95;
          const totalChannel = (trade.targetPrice || trade.buyPrice * 1.15) - safeStop;
          const currentPositionInChannel = Math.max(
            0,
            Math.min(100, ((currentPrice - safeStop) / (totalChannel || 1)) * 100)
          );

          return (
            <Card
              key={trade._id}
              className={`p-5 flex flex-col justify-between transition-all duration-200 ${
                isCriticalSL
                  ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-950/40'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header: Ticker, Type & Strategy */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold font-mono text-white text-base border border-slate-700 shadow-inner">
                      {trade.ticker.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-extrabold tracking-wide font-mono text-white">
                          {trade.ticker}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {trade.type}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {trade.quantity} shares &bull; ${positionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <Badge variant="info" className="gap-1">
                    <Tag className="h-2.5 w-2.5" />
                    {trade.strategyTag || 'Discretionary'}
                  </Badge>
                </div>

                {/* Price & PnL Overview Grid */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3.5">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Entry Price</span>
                    <span className="text-sm font-bold font-mono text-slate-200">
                      ${trade.buyPrice.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Market Price</span>
                    <span className="text-sm font-bold font-mono text-white">
                      ${currentPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400">Floating Unrealized PnL:</span>
                    <span
                      className={`text-sm font-extrabold font-mono flex items-center gap-1 ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {isPositive ? '+' : '-'}${Math.abs(unrealizedPnL).toFixed(2)}
                      <span className="text-xs font-semibold">
                        ({isPositive ? '+' : ''}{unrealizedPct.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                </div>

                {/* Visual Risk & Target Buffer Channel */}
                <div className="space-y-2 mb-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1 font-medium">
                      <ShieldAlert className={`h-3.5 w-3.5 ${isCriticalSL ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                      Stop-Loss: <strong className="text-rose-400 font-mono">${(trade.stopLossPrice || 0).toFixed(2)}</strong>
                    </span>
                    {slDistance !== null && (
                      <Badge
                        variant={isCriticalSL ? 'destructive' : isWarningSL ? 'warning' : 'secondary'}
                        className="text-[10px]"
                      >
                        {slDistance > 0 ? `+${slDistance.toFixed(1)}% buffer` : `${slDistance.toFixed(1)}% BREACH`}
                      </Badge>
                    )}
                  </div>

                  {/* Channel Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isCriticalSL
                          ? 'bg-rose-500 animate-pulse'
                          : isWarningSL
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${currentPositionInChannel}%` }}
                    />
                  </div>

                  {trade.targetPrice && (
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <Target className="h-3 w-3 text-emerald-400" /> Target:
                      </span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${trade.targetPrice.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {trade.notes && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 line-clamp-2">
                      "{trade.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenCloseModal(trade)}
                    className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs font-semibold"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5" />
                    <span>Sell Position</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSimulate(trade)}
                    disabled={simulatingTicker === trade.ticker}
                    title="Simulate price drop below stop-loss to test background engine"
                    className="gap-1 text-rose-300 border-rose-500/30 hover:bg-rose-500/10 text-xs font-medium"
                  >
                    <Zap className="h-3.5 w-3.5 text-rose-400" />
                    <span>Trigger SL</span>
                  </Button>
                </div>

                <div className="flex items-center justify-between text-slate-400 pt-1 text-xs">
                  <span className="text-[11px] flex items-center gap-1 text-slate-500">
                    <Clock className="h-3 w-3" />
                    {new Date(trade.buyDate).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenEditModal(trade)}
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                      title="Edit Trade"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTrade(trade._id)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete Trade"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
