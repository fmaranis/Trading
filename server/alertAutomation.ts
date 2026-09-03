import fs from 'node:fs';
import path from 'node:path';
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

const STATE_DIR = path.join(process.cwd(), '.runtime');
const STATE_FILE = path.join(STATE_DIR, 'alertAutomationState.json');

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
}

const EMPTY_STATE: AlertAutomationState = {
  lastAttemptAt: null, lastSuccessAt: null, lastRunLocalDate: null, lastMarketDate: null, lastError: null,
  lastAlerts: [], lastDecision: null, lastEvidenceState: null, lastNotificationAt: null,
  lastNotificationEventCount: 0, lastNotificationEventKeys: []
};

function loadState(): AlertAutomationState {
  try {
    if (!fs.existsSync(STATE_FILE)) return { ...EMPTY_STATE };
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      ...EMPTY_STATE,
      ...parsed,
      lastAlerts: Array.isArray(parsed?.lastAlerts) ? parsed.lastAlerts : [],
      lastNotificationEventKeys: Array.isArray(parsed?.lastNotificationEventKeys) ? parsed.lastNotificationEventKeys : []
    };
  } catch { return { ...EMPTY_STATE }; }
}
function saveState(state: AlertAutomationState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function sevenYearsAgo(): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - 7); return isoDate(d); }
function baseUrl(): string {
  const configured = process.env.ALERT_INTERNAL_BASE_URL?.trim() || process.env.APP_URL?.trim();
  return configured ? configured.replace(/\/$/, '') : 'http://127.0.0.1:3000';
}
function isActionable(alert: CurrentOpportunityAlert | undefined): boolean {
  return alert?.level === 'HIGH_CONVICTION' || alert?.level === 'GOOD_ENTRY';
}
function levelRank(alert: CurrentOpportunityAlert | undefined): number {
  if (alert?.level === 'HIGH_CONVICTION') return 2;
  if (alert?.level === 'GOOD_ENTRY') return 1;
  return 0;
}
function newOpportunityEvents(previous: CurrentOpportunityAlert[], current: CurrentOpportunityAlert[]): CurrentOpportunityAlert[] {
  const previousByAsset = new Map(previous.map(alert => [alert.assetId, alert]));
  return current.filter(alert => {
    if (!isActionable(alert)) return false;
    const before = previousByAsset.get(alert.assetId);
    return !isActionable(before) || levelRank(alert) > levelRank(before);
  });
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
  const state = loadState();
  const localRunDate = madridClock().date;
  state.lastAttemptAt = new Date().toISOString();
  state.lastRunLocalDate = localRunDate;
  state.lastError = null;
  saveState(state);
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
    const events = newOpportunityEvents(state.lastAlerts, alerts);

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

    const next: AlertAutomationState = {
      lastAttemptAt: state.lastAttemptAt, lastSuccessAt: new Date().toISOString(), lastRunLocalDate: localRunDate,
      lastMarketDate: marketDate, lastError: null, lastAlerts: alerts, lastDecision: null,
      lastEvidenceState: evidence?.state ?? 'PRIMARY_ONLY',
      lastNotificationAt: notificationSent ? new Date().toISOString() : state.lastNotificationAt,
      lastNotificationEventCount: notificationSent ? events.length : 0,
      lastNotificationEventKeys: notificationSent ? events.map(alert => `${alert.assetId}:${alert.level}`) : []
    };
    saveState(next);
    return next;
  } catch (error: any) {
    const failed = { ...state, lastRunLocalDate: localRunDate, lastError: error?.message || String(error) };
    saveState(failed);
    throw error;
  }
}

export function getAlertAutomationStatus() {
  return {
    enabled: process.env.ALERT_AUTOMATION_ENABLED === 'true',
    timezone: 'Europe/Madrid', runTimeLocal: process.env.ALERT_RUN_TIME_LOCAL || '22:30',
    webhookConfigured: Boolean(process.env.ALERT_WEBHOOK_URL?.trim()),
    state: loadState()
  };
}

export function startDailyAlertScheduler(): NodeJS.Timeout | null {
  if (process.env.ALERT_AUTOMATION_ENABLED !== 'true') return null;
  let running = false;
  const tick = async () => {
    if (running) return;
    const clock = madridClock();
    const target = configuredRunTime();
    const state = loadState();
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
