import express, { Request, Response } from 'express';
import { getAlertAutomationStatus, runDailyOpportunityCheck } from './alertAutomation';
import { accountRouter } from './accountRoutes';
import { researchValidationRouter } from './researchValidationRoutes';
import { assetDiscoveryRouter } from './assetDiscoveryRoutes';

export const alertAutomationRouter = express.Router();

// Mounted here to avoid widening the root server surface while the authenticated
// product layer is introduced. Public path: /api/alerts/account/*.
alertAutomationRouter.use('/account', accountRouter);

// Fixed local research jobs: no arbitrary shell command and no AI API.
alertAutomationRouter.use('/research-validation', researchValidationRouter);

// Open Yahoo discovery used by replay/research when an asset is not present in
// the curated production catalogue. It only returns EUR instruments as usable.
alertAutomationRouter.use('/asset-discovery', assetDiscoveryRouter);

alertAutomationRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getAlertAutomationStatus();
    const portfolio = status.state.lastPortfolioManagementSummary;
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
      lastAlertCount: status.state.lastAlerts.length,
      portfolioManagement: {
        lastCheckedAt: status.state.lastPortfolioManagementAt,
        configured: portfolio?.configured ?? false,
        evaluated: portfolio?.evaluated ?? false,
        evaluatedPositions: portfolio?.evaluatedPositions ?? 0,
        pendingEventCount: portfolio?.pendingEventCount ?? 0,
        rotationStatus: portfolio?.rotationStatus ?? null,
        notificationSent: portfolio?.notificationSent ?? false,
        errorPresent: Boolean(portfolio?.error)
      }
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
