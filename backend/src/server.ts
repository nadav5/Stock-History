import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import tradeRoutes from './routes/tradeRoutes';
import marketRoutes from './routes/marketRoutes';
import stopLossRoutes from './routes/stopLossRoutes';
import importRoutes from './routes/importRoutes';
import { initStopLossCron } from './services/stopLossEngine';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tradetracker';
const CRON_INTERVAL = process.env.STOP_LOSS_CRON_INTERVAL || '*/30 * * * * *';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TradeTracker Backend API',
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

// Register API Routes
app.use('/api/trades', tradeRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/stoploss', stopLossRoutes);
app.use('/api/import', importRoutes);

// Serve static frontend build if available
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({ error: 'Internal server error', details: err?.message || String(err) });
});

// Process-level safety guards to prevent unexpected termination from external network glitches
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Guard: Handled Async Rejection]:', reason);
});

process.on('uncaughtException', (err) => {
  console.warn('[Server Guard: Handled Exception]:', err?.message || err);
});

// Connect to MongoDB & Start Server
async function startServer() {
  try {
    console.log(`[Database] Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('[Database] MongoDB connected successfully.');

    // Initialize Automatic Periodic Market Price Refresh (Every 60 seconds)
    const { refreshActiveTradesPrices } = require('./services/marketData');
    setInterval(async () => {
      try {
        await refreshActiveTradesPrices();
      } catch (err: any) {
        // Silent catch for network hiccups
      }
    }, 60000);
    console.log('[MarketData] Automatic live stock price refresh active (every 60s).');

    // Initialize Stop-Loss Background Engine only if explicitly enabled
    if (process.env.ENABLE_STOP_LOSS_CRON === 'true') {
      initStopLossCron(CRON_INTERVAL);
    } else {
      console.log('[StopLossEngine] Background cron disabled (on-demand mode).');
    }

    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 TradeTracker Backend API running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      if (fs.existsSync(frontendDistPath)) {
        console.log(`🌐 Frontend UI live at: http://localhost:${PORT}`);
      }
      console.log(`=======================================================`);
    });

    server.on('error', (err: any) => {
      console.error('[Server Socket Error]:', err);
    });
  } catch (error) {
    console.error('[Database] Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

startServer();
