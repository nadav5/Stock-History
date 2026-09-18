import mongoose, { Schema, Document } from 'mongoose';

export interface ITrade extends Document {
  ticker: string;
  assetName?: string;
  sector?: string;
  status: 'ACTIVE' | 'CLOSED';
  type: 'BUY' | 'SELL';
  buyPrice: number;
  quantity: number;
  buyDate: Date;
  stopLossPrice?: number;
  targetPrice?: number;
  sellPrice?: number;
  sellDate?: Date;
  exitReason?: 'STOP_LOSS' | 'TARGET_REACHED' | 'MANUAL_EXIT' | 'IMPORTED';
  realizedPnL?: number;
  realizedPnLPercent?: number;
  currentPrice?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  dividends?: number;
  source?: 'BLINK' | 'MANUAL' | 'CSV_IMPORT';
  lastPriceUpdate?: Date;
  strategyTag: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema: Schema = new Schema(
  {
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    assetName: {
      type: String,
      default: '',
      trim: true,
    },
    sector: {
      type: String,
      default: 'כללי / טכנולוגיה',
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED'],
      default: 'ACTIVE',
      index: true,
    },
    type: {
      type: String,
      enum: ['BUY', 'SELL'],
      default: 'BUY',
    },
    buyPrice: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    buyDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    stopLossPrice: {
      type: Number,
      required: false,
      default: 0,
    },
    targetPrice: {
      type: Number,
      default: null,
    },
    sellPrice: {
      type: Number,
      default: null,
    },
    sellDate: {
      type: Date,
      default: null,
    },
    exitReason: {
      type: String,
      enum: ['STOP_LOSS', 'TARGET_REACHED', 'MANUAL_EXIT', 'IMPORTED'],
      default: null,
    },
    realizedPnL: {
      type: Number,
      default: 0,
    },
    realizedPnLPercent: {
      type: Number,
      default: 0,
    },
    currentPrice: {
      type: Number,
      default: null,
    },
    unrealizedPnL: {
      type: Number,
      default: 0,
    },
    unrealizedPnLPercent: {
      type: Number,
      default: 0,
    },
    dividends: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      default: 'MANUAL',
    },
    lastPriceUpdate: {
      type: Date,
      default: null,
    },
    strategyTag: {
      type: String,
      default: 'תיק השקעות',
      trim: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to calculate realized PnL when closing a trade if not set
TradeSchema.pre('save', function (next) {
  const trade = this as unknown as ITrade;
  if (trade.status === 'CLOSED' && trade.sellPrice != null) {
    if (trade.type === 'BUY') {
      trade.realizedPnL = Number(((trade.sellPrice - trade.buyPrice) * trade.quantity).toFixed(2));
      trade.realizedPnLPercent = Number((((trade.sellPrice - trade.buyPrice) / trade.buyPrice) * 100).toFixed(2));
    } else {
      trade.realizedPnL = Number(((trade.buyPrice - trade.sellPrice) * trade.quantity).toFixed(2));
      trade.realizedPnLPercent = Number((((trade.buyPrice - trade.sellPrice) / trade.buyPrice) * 100).toFixed(2));
    }
  } else if (trade.status === 'ACTIVE' && trade.currentPrice != null) {
    const diff = trade.currentPrice - trade.buyPrice;
    trade.unrealizedPnL = Number((diff * trade.quantity).toFixed(2));
    trade.unrealizedPnLPercent = Number(((diff / trade.buyPrice) * 100).toFixed(2));
  }
  next();
});

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
