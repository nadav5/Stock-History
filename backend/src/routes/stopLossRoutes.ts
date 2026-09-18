import express, { Request, Response } from 'express';
import { runStopLossCheck, getEngineStatus } from '../services/stopLossEngine';

const router = express.Router();

/**
 * POST /api/stoploss/trigger
 * Manually invokes the stop-loss check across all active trades immediately
 */
router.post('/trigger', async (_req: Request, res: Response) => {
  try {
    const result = await runStopLossCheck();
    return res.json({
      message: 'Stop-Loss engine triggered successfully.',
      result,
    });
  } catch (error: any) {
    console.error('Error triggering Stop-Loss check:', error);
    return res.status(500).json({ error: 'Failed to run stop-loss check', details: error.message });
  }
});

/**
 * GET /api/stoploss/status
 * Returns current scheduler status, last run timestamp, and recent execution logs
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = getEngineStatus();
    return res.json(status);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve engine status', details: error.message });
  }
});

export default router;
