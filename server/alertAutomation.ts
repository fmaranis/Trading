import fs from 'node:fs';
import path from 'path';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  assessCrossProviderEvidence,
  AssetUniverseScanner,
  CurrentOpportunityAlertEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  PortfolioCandidateGate,
  type CurrentOpportunityAlert
} from '../src/investment/decision';
import { firebaseAdminConfigured, firebaseAdminServices } from './firebaseAdmin';

const STATE_DIR = path.join(process.cwd(), '.runtime');
const STATE_FILE = path.join(STATE_DIR, 'alertAutomationState.json');
const FIRESTORE_STATE_DOCUMENT = 'system/alertAutomation';
type NotifiedOpportunityLevel = 'GOOD_ENTRY' | 'HIGH_CONVICTION';

export interface AlertAutomationState {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastRunLocalDate: string | null;
  lastMarketDate: string | null;
  lastError: string | null;
  lastAlerts: CurrentOpportunityAlert[];
  lastDecision: unknown | null;
  lastEvidenceState: string | null;
  lastNotificationAt: string | null;
  lastNotificationEventCount: number;
  lastNotificationEventKeys: string[];
  lastNotifiedActionableLevels: Record<string, NotifiedOpportunityLevel>;
}

const EMPTY_STATE: AlertAutomationState = {
  lastAttemptAt: null, lastSuccessAt: null, lastRunLocalDate: null, lastMarketDate: null, lastError: null,
  lastAlerts: [], lastDecision: null, lastEvidenceState: null, lastNotificationAt: null,
  lastNotificationEventCount: 0, lastNotificationEventKeys: [], lastNotifiedActionableLevels: {}
};

function normalizeState(parsed: any): AlertAutomationState {
  return {
    ...EMPTY_STATE,
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
    lastAlerts: Array.isArray(parsed?.lastAlerts) ? parsed.lastAlerts : [],
    lastNotificationEventKeys: Array.isArray(parsed?.lastNotificationEventKeys) ? parsed.lastNotificationEventKeys : [],
    lastNotifiedActionableLevels: parsed?.lastNotifiedActionableLevels && typeof parsed.lastNotifiedActionableLevels === 'object'
      ? parsed.lastNotifiedActionableLevels
      : {}
  };
}

function persistentStateRequired(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.FIREBASE_AUTH_REQUIRED === 'true';
}

function loadLocalState(): AlertAutomationState {
  try {
    if (!fs.existsSync(STATE_FILE)) return { ...EMPTY_STATE };
    return normalizeState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
  } catch { return { ...EMPTY_STATE }; }
}

function saveLocalState(state: AlertAutomationState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function loadState(): Promise<AlertAutomationState> {
  if (firebaseAdminConfigured()) {
    const { db } = firebaseAdminServices();
    const snapshot = await db.doc(FIRESTORE_STATE_DOCUMENT).get();
    return snapshot.exists ? normalizeState(snapshot.data()) : { ...EMPTY_STATE };
  }
  if (persistentStateRequired()) throw new Error('ALERT_STATE_PERSISTENCE_NOT_CONFIGURED');
  return loadLocalState();
}

async function saveState(state: AlertAutomationState): Promise<void> {
  if (firebaseAdminConfigured()) {
    const { db } = firebaseAdminServices();
    await db.doc(FIRESTORE_STATE_DOCUMENT).set({
      ...state,
      persistence: 'FIRESTORE',
      updatedAt: new Date().toISOString()
    });
    return;
  }
  if (persistentStateRequired()) throw new Error('ALERT_STATE_PERSISTENCE_NOT_CONFIGURED');
  saveLocalState(state);
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function sevenYearsAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 7); return isoDate(d); }
function baseUrl(): string {
  const configured = process.env.ALERT_INTERNAL_BASE_URL?.trim() || process.env.APP_URL?.trim();
  return configured ? configured.replace(/\/$/, '') : 'http://127.0.0.1:3000';
}
function isActionable(alert: CurrentOpportunityAlert | undefined): alert is CurrentOpportunityAlert & { level: NotifiedOpportunityLevel } {
  return alert?.level === 'HIGH_CONVICTION' || alert?.level === 'GOOD_ENTRY';
}
function levelRank(level: NotifiedOpportunityLevel | undefined): number {
  if (level === 'HIGH_CONVICTION') return 2;
  if (level === 'GOOD_ENTRY') return 1;
  return 0;
}
function newOpportunityEvents(previousNotified: Record<string, NotifiedOpportunityLevel>, current: CurrentOpportunityAlert[]): CurrentOpportunityAlert[] {
  return current.filter(alert => isActionable(alert) && levelRank(alert.level) > levelRank(previousNotified[alert.assetId]));
}
function nextNotifiedLevels(
  previous: Record<string, NotifiedOpportunityLevel>,
  current: CurrentOpportunityAlert[],
  deliveredEvents: CurrentOpportunityAlert[]
): Record<string, NotifiedOpportunityLevel> {
  const currentActionable = new Map(current.filter(isActionable).map(alert => [alert.assetId, alert.level]));
  const next: Record<string, NotifiedOpportunityLevel> = {};
  for (const [assetId, level] of Object.entries(previous)) {
    if (currentActionable.has(assetId)) next[assetId] = level;
  }
  for (const alert of deliveredEvents) if (isActionable(alert)) next[alert.assetId] = alert.level;
  return next;
}

async function crossValidateEodhd(scan: Awaited<ReturnType<typeof AssetUniverseScanner.scan>>): Promise<any | null> {
  const statusResponse = await fetch(`${baseUrl()}/api/eodhd/status`);
  if (!statusResponse.ok) return null;
  const status: any = await statusResponse.json();
  if (!status.configured) return null;
  const response = await fetch(`${baseUrl()}/api/eodhd/cross-check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets: scan.selected.map(c => ({ ticker: c.asset.ticker, asOfDate: c.asOfDate, lastClose: c.lastClose })) })
  });
  return response.ok ? response.json() : null;
}

async function notifyWebhook(payload: unknown): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal
    });
    return response.ok;
  } finally { clearTimeout(timeout); }
}

function madridClock(now = new Date()): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')), minute: Number(value('minute')) };
}
function configuredRunTime(): { hour: number; minute: number } {
  const [h, m] = (process.env.ALERT_RUN_TIME_LOCAL || '22:30').split(':').map(Number);
  return { hour: Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 22, minute: Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 30 };
}

export async function runDailyOpportunityCheck(): Promise<AlertAutomationState> {
  const state = await loadState();
  const localRunDate = madridClock().date;
  state.lastAttemptAt = new Date().toISOString();
  state.lastRunLocalDate = localRunDate;
  state.lastError = null;
  await saveState(state);
  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${baseUrl()}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const scan = await AssetUniverseScanner.scan(EUR_PORTFOLIO_DISCOVERY_UNIVERSE, sevenYearsAgo(), isoDate(new Date()), {
      forceRefresh: true, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7
    });
    const cashBenchmarkAnnualPct = Number(process.env.ALERT_CASH_BENCHMARK_PCT) || 2.5;
    const gate = PortfolioCandidateGate.apply(scan, cashBenchmarkAnnualPct, 12);
    const alerts = CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmarkAnnualPct);
    const actionable = alerts.filter(isActionable);
    const events = newOpportunityEvents(state.lastNotifiedActionableLevels, alerts);

    const eodhd = await crossValidateEodhd(gate.scan).catch(() => null);
    const evidence = eodhd ? assessCrossProviderEvidence({
      primaryProvider: 'Yahoo Finance', secondaryProvider: 'EODHD', requested: eodhd.requested,
      checked: eodhd.checked, matched: eodhd.matched, divergent: eodhd.divergent,
      summaryState: eodhd.summaryState, checkedAt: eodhd.checkedAt
    }) : null;
    const marketDate = scan.candidates.filter(c => c.status === 'ACCEPTED' && c.asOfDate).map(c => c.asOfDate!).sort().at(-1) ?? isoDate(new Date());

    let notificationSent = false;
    if (events.length > 0) {
      notificationSent = await notifyWebhook({
        source: 'Custodia', kind: 'CURRENT_ENTRY_OPPORTUNITY_EVENTS', generatedAt: new Date().toISOString(),
        marketDate, cashBenchmarkAnnualPct,
        evidence: evidence ? { state: evidence.state, summary: evidence.summary } : { state: 'PRIMARY_ONLY' },
        eventRule: 'NEW_GOOD_ENTRY_OR_ESCALATION_TO_HIGH_CONVICTION',
        events,
        highConviction: events.filter(alert => alert.level === 'HIGH_CONVICTION'),
        goodEntries: events.filter(alert => alert.level === 'GOOD_ENTRY'),
        currentActionableCount: actionable.length
      }).catch(() => false);
    }
    const deliveredEvents = notificationSent ? events : [];

    const next: AlertAutomationState = {
      lastAttemptAt: state.lastAttemptAt, lastSuccessAt: new Date().toISOString(), lastRunLocalDate: localRunDate,
      lastMarketDate: marketDate, lastError: null, lastAlerts: alerts, lastDecision: null,
      lastEvidenceState: evidence?.state ?? 'PRIMARY_ONLY',
      lastNotificationAt: notificationSent ? new Date().toISOString() : state.lastNotificationAt,
      lastNotificationEventCount: notificationSent ? events.length : 0,
      lastNotificationEventKeys: notificationSent ? events.map(alert => `${alert.assetId}:${alert.level}`) : [],
      lastNotifiedActionableLevels: nextNotifiedLevels(state.lastNotifiedActionableLevels, alerts, deliveredEvents)
    };
    await saveState(next);
    return next;
  } catch (error: any) {
    const failed = { ...state, lastRunLocalDate: localRunDate, lastError: error?.message || String(error) };
    await saveState(failed);
    throw error;
  }
}

export async function getAlertAutomationStatus() {
  return {
    enabled: process.env.ALERT_AUTOMATION_ENABLED === 'true',
    timezone: 'Europe/Madrid', runTimeLocal: process.env.ALERT_RUN_TIME_LOCAL || '22:30',
    webhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL?.trim()),
    persistence: firebaseAdminConfigured() ? 'FIRESTORE' : persistentStateRequired() ? 'UNAVAILABLE' : 'LOCAL_DEV',
    state: await loadState()
  };
}

export function startDailyAlertScheduler(): NodeJS.Timeout | null {
  if (process.env.ALERT_AUTOMATION_ENABLED !== 'true') return null;
  let running = false;
  const tick = async () => {
    if (running) return;
    const clock = madridClock();
    const target = configuredRunTime();
    let state: AlertAutomationState;
    try { state = await loadState(); }
    catch (err) { console.error('[Custodia] alert state persistence unavailable:', err); return; }
    const reached = clock.hour > target.hour || (clock.hour === target.hour && clock.minute >= target.minute);
    if (!reached || state.lastRunLocalDate === clock.date) return;
    running = true;
    try { await runDailyOpportunityCheck(); }
    catch (err) { console.error('[Custodia] daily alert automation failed:', err); }
    finally { running = false; }
  };
  void tick();
  return setInterval(() => void tick(), 15 * 60 * 1000);
}
