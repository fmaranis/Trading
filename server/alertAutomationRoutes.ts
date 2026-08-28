import express, { Request, Response } from 'express';
import { getAlertAutomationStatus, runDailyOpportunityCheck } from './alertAutomation';

export const alertAutomationRouter = express.Router();

alertAutomationRouter.get('/status', (_req: Request, res: Response) => {
  res.json(getAlertAutomationStatus());
});

alertAutomationRouter.post('/run-now', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    const expected = process.env.ALERT_ADMIN_TOKEN?.trim();
    const supplied = String(req.header('x-alert-admin-token') ?? '').trim();
    if (!expected || supplied !== expected) {
      res.status(403).json({ ok: false, error: 'ALERT_ADMIN_AUTH_REQUIRED' });
      return;
    }
  }
  try {
    const state = await runDailyOpportunityCheck();
    res.json({ ok: true, state });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
});
