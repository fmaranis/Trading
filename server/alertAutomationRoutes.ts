import express, { Request, Response } from 'express';
import { getAlertAutomationStatus, runDailyOpportunityCheck } from './alertAutomation';
import { accountRouter } from './accountRoutes';

export const alertAutomationRouter = express.Router();

// Mounted here to avoid widening the root server surface while the authenticated
// product layer is introduced. Public path: /api/alerts/account/*.
alertAutomationRouter.use('/account', accountRouter);

alertAutomationRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getAlertAutomationStatus();
    res.json({
      enabled: status.enabled,
      timezone: status.timezone,
      runTimeLocal: status.runTimeLocal,
      notificationChannelConfigured: status.notificationChannelConfigured,
      telegramConfigured: status.telegramConfigured,
      persistence: status.persistence,
      actionableAlertCount: status.actionableAlertCount,
      pendingNotificationEventCount: status.pendingNotificationEventCount,
      pendingNotificationEventKeys: status.pendingNotificationEventKeys,
      lastSuccessAt: status.state.lastSuccessAt,
      lastMarketDate: status.state.lastMarketDate,
      lastEvidenceState: status.state.lastEvidenceState,
      lastNotificationAt: status.state.lastNotificationAt,
      lastNotificationEventCount: status.state.lastNotificationEventCount,
      lastNotificationEventKeys: status.state.lastNotificationEventKeys,
      lastErrorPresent: Boolean(status.state.lastError),
      lastAlertCount: status.state.lastAlerts.length
    });
  } catch (error: any) {
    res.status(503).json({ ok: false, error: error?.message || String(error), persistence: 'UNAVAILABLE' });
  }
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
