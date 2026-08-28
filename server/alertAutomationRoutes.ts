import express, { Request, Response } from 'express';
import { getAlertAutomationStatus, runDailyOpportunityCheck } from './alertAutomation';

export const alertAutomationRouter = express.Router();

alertAutomationRouter.get('/status', (_req: Request, res: Response) => {
  res.json(getAlertAutomationStatus());
});

alertAutomationRouter.post('/run-now', async (_req: Request, res: Response): Promise<void> => {
  try {
    const state = await runDailyOpportunityCheck();
    res.json({ ok: true, state });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});
