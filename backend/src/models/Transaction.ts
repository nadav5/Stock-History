import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  date: Date;
  actionType: 'BUY' | 'SELL' | 'DIVIDEND' | 'TAX' | 'WITHDRAWAL' | 'DEPOSIT' | 'FEE' | string;
  ticker?: string;
  assetName?: string;
  quantity?: number;
  price?: number;
  amount: number;
  fee?: number;
  cashBalance?: number;
  rawDescription?: string;
  statementDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ticker: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    assetName: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: null,
    },
    price: {
      type: Number,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    fee: {
      type: Number,
      default: 0,
    },
    cashBalance: {
      type: Number,
      default: null,
    },
    rawDescription: {
      type: String,
      default: '',
    },
    statementDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
