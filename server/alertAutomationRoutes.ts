import express, { Request, Response } from 'express';
import { getAlertAutomationStatus, runDailyOpportunityCheck } from './alertAutomation';
import { accountRouter } from './accountRoutes';
import { notifyTelegramOpportunity, telegramNotificationConfigured } from './telegramNotifier';

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
      notificationChannelConfigured: status.webhookConfigured,
      telegramConfigured: telegramNotificationConfigured(),
      persistence: status.persistence,
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

// Internal relay used by ALERT_WEBHOOK_URL. It is deliberately protected with
// ALERT_ADMIN_TOKEN so the public Cloud Run service cannot be abused to spam Telegram.
alertAutomationRouter.post('/telegram-relay', async (req: Request, res: Response): Promise<void> => {
  const expected = process.env.ALERT_ADMIN_TOKEN?.trim();
  const supplied = String(req.query.token ?? '').trim();
  if (!expected || supplied !== expected) {
    res.status(403).json({ ok: false, error: 'TELEGRAM_RELAY_AUTH_REQUIRED' });
    return;
  }
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  if (!events.length) {
    res.status(400).json({ ok: false, error: 'TELEGRAM_RELAY_EVENTS_REQUIRED' });
    return;
  }
  try {
    const sent = await notifyTelegramOpportunity({
      marketDate: String(req.body?.marketDate ?? ''),
      events,
      evidenceState: String(req.body?.evidence?.state ?? 'PRIMARY_ONLY')
    });
    if (!sent) {
      res.status(503).json({ ok: false, error: 'TELEGRAM_NOTIFICATION_NOT_SENT' });
      return;
    }
    res.json({ ok: true, delivered: events.length });
  } catch (error: any) {
    res.status(502).json({ ok: false, error: 'TELEGRAM_NOTIFICATION_FAILED', detail: error?.message || String(error) });
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
