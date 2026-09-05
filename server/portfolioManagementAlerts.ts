import type { AssetUniverseScanResult } from '../src/investment/decision/assetUniverseScanner';
import {
  assessDeteriorationStreak,
  classifyPositionHealth,
  isDiversifiedCoreCategory,
  PortfolioPositionHealthService,
  type PortfolioPositionHealthResult,
  type PositionHealthContext
} from '../src/investment/decision/portfolioPositionHealth';
import { PortfolioRotationReviewEngine } from '../src/investment/decision/portfolioRotationReview';
import { applyStrategicCoreShortTermProtection } from '../src/investment/decision/strategicCorePolicy';
import { StrategyConsensusEngine } from '../src/investment/decision/strategyConsensusEngine';
import { migrateUserPortfolioState, type UserPortfolioState } from '../src/investment/decision/userPortfolio';
import type { PortfolioExecutionHistoryEntry } from '../src/investment/decision/portfolioExecutionHistory';
import type { SpanishTaxSettings, TrackedTaxLot } from '../src/investment/decision/spanishTaxModel';
import { firebaseAdminConfigured, firebaseAdminServices } from './firebaseAdmin';
import { notifyTelegramPortfolioManagement, telegramNotificationConfigured } from './telegramNotifier';

type ManagementAction = 'ADD' | 'WATCH' | 'REDUCE' | 'EXIT';

interface PortfolioAlertState {
  lastDeliveredActions: Record<string, ManagementAction>;
  lastDeliveredRotationKey: string | null;
  lastNotificationAt: string | null;
  lastMarketDate: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export interface PortfolioManagementAlertSummary {
  configured: boolean;
  evaluated: boolean;
  evaluatedPositions: number;
  pendingEventCount: number;
  rotationStatus: string | null;
  notificationSent: boolean;
  error: string | null;
}

const EMPTY_ALERT_STATE: PortfolioAlertState = {
  lastDeliveredActions: {},
  lastDeliveredRotationKey: null,
  lastNotificationAt: null,
  lastMarketDate: null,
  lastError: null,
  updatedAt: null
};

function parseStoredJson<T>(values: Record<string, unknown>, key: string, fallback: T): T {
  const raw = values[key];
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function resolvePortfolioAlertUid(): string | null {
  const explicit = process.env.ALERT_PORTFOLIO_UID?.trim();
  if (explicit) return explicit;
  const bootstrapUids = (process.env.FIREBASE_BOOTSTRAP_ADMIN_UIDS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return bootstrapUids.length === 1 ? bootstrapUids[0] : null;
}

function normalizeExecutionHistory(raw: unknown): PortfolioExecutionHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry: any) => entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.appliedAt === 'string') as PortfolioExecutionHistoryEntry[];
}

function normalizeTaxLots(raw: unknown): Record<string, TrackedTaxLot[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, TrackedTaxLot[]> = {};
  for (const [ticker, lots] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(lots)) continue;
    const normalized = lots
      .map((lot: any) => ({
        shares: Math.max(0, Number(lot?.shares) || 0),
        acquisitionDate: String(lot?.acquisitionDate ?? ''),
        acquisitionCostEur: Math.max(0, Number(lot?.acquisitionCostEur) || 0)
      }))
      .filter(lot => lot.shares > 0 && /^\d{4}-\d{2}-\d{2}$/.test(lot.acquisitionDate));
    if (normalized.length) result[ticker.trim().toUpperCase()] = normalized;
  }
  return result;
}

function normalizeTaxSettings(raw: unknown): SpanishTaxSettings {
  const value: any = raw && typeof raw === 'object' ? raw : {};
  return {
    priorSavingsTaxableBaseEur: Math.max(0, Number(value.priorSavingsTaxableBaseEur) || 0),
    contextConfirmed: value.contextConfirmed === true
  };
}

function parseCashBenchmark(values: Record<string, unknown>, fallback: number): number {
  const raw = values['custodia_cash_benchmark_annual_pct_v1'];
  if (typeof raw !== 'string') return fallback;
  let parsed: unknown = raw;
  try { parsed = JSON.parse(raw); } catch { /* localStorage may contain a plain number string */ }
  const value = Number(parsed);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
}

function candidateFor(scan: AssetUniverseScanResult, key: string) {
  const normalized = key.toUpperCase();
  return scan.candidates.find(candidate =>
    candidate.asset.assetId === key
    || candidate.asset.ticker.toUpperCase() === normalized
    || candidate.asset.isin?.toUpperCase() === normalized
  );
}

function executionKeys(entry: PortfolioExecutionHistoryEntry): string[] {
  return [entry.sourceId, entry.sourceIsin, entry.targetAssetId, entry.targetTicker, entry.targetIsin]
    .map(value => String(value ?? '').trim().toUpperCase())
    .filter(Boolean);
}

function latestEpisodeDate(
  history: PortfolioExecutionHistoryEntry[],
  keys: Array<string | null | undefined>,
  actions: PortfolioExecutionHistoryEntry['action'][]
): string | null {
  const wanted = new Set(keys.map(value => String(value ?? '').trim().toUpperCase()).filter(Boolean));
  if (!wanted.size) return null;
  return history
    .filter(entry => actions.includes(entry.action) && executionKeys(entry).some(key => wanted.has(key)))
    .map(entry => entry.appliedAt.slice(0, 10))
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1) ?? null;
}

function laterDate(a: string | null | undefined, b: string | null | undefined): string | null {
  return [a, b]
    .filter((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)))
    .sort()
    .at(-1) ?? null;
}

function barDate(timestamp: string): string { return timestamp.slice(0, 10); }

function pathContext(input: {
  bars: Array<{ timestamp: string; close: number }>;
  acquisitionDate: string | null;
  investedEur: number | null;
  units: number | null;
  category: any;
  tickerOrAssetId: string;
  deteriorationStreakSessions: number;
  momentum20Pct: number | null | undefined;
}): PositionHealthContext {
  const base: PositionHealthContext = {
    category: input.category ?? 'UNKNOWN',
    isDiversifiedCore: isDiversifiedCoreCategory(input.category, input.tickerOrAssetId),
    deteriorationStreakSessions: input.deteriorationStreakSessions,
    momentum20Pct: input.momentum20Pct ?? null,
    currentReturnPct: null,
    mfePct: null,
    givebackFromMfePctPoints: null
  };
  if (!input.acquisitionDate || !(input.investedEur != null && input.investedEur > 0) || !(input.units != null && input.units > 0)) return base;
  const held = input.bars.filter(bar => barDate(bar.timestamp) >= input.acquisitionDate! && Number.isFinite(bar.close) && bar.close > 0);
  if (!held.length) return base;
  const returns = held.map(bar => (bar.close * input.units! / input.investedEur! - 1) * 100);
  const currentReturnPct = returns.at(-1) ?? null;
  const mfePct = returns.length ? Math.max(...returns, 0) : null;
  return {
    ...base,
    currentReturnPct,
    mfePct,
    givebackFromMfePctPoints: currentReturnPct == null || mfePct == null ? null : Math.max(0, mfePct - currentReturnPct)
  };
}

function rebuildByKey(result: PortfolioPositionHealthResult): void {
  const byKey: PortfolioPositionHealthResult['byKey'] = {};
  for (const position of result.positions) {
    byKey[position.key] = position;
    byKey[position.tickerOrIsin.toUpperCase()] = position;
  }
  result.byKey = byKey;
}

function applyStrategicCoreAlertProtection(result: PortfolioPositionHealthResult, scan: AssetUniverseScanResult): void {
  result.positions = result.positions.map(position => {
    const candidate = candidateFor(scan, position.key) ?? candidateFor(scan, position.tickerOrIsin);
    return applyStrategicCoreShortTermProtection(candidate?.asset.assetId ?? null, position);
  });
  rebuildByKey(result);
}

async function evaluateWithPrivateContext(input: {
  portfolio: UserPortfolioState;
  scan: AssetUniverseScanResult;
  cashBenchmarkAnnualPct: number;
  executionHistory: PortfolioExecutionHistoryEntry[];
  taxLots: Record<string, TrackedTaxLot[]>;
}): Promise<PortfolioPositionHealthResult> {
  const result = await PortfolioPositionHealthService.evaluate(input.portfolio, input.scan, input.cashBenchmarkAnnualPct);
  result.warnings = result.warnings.filter(warning => !warning.startsWith('POSITION_COST_BASIS_INCOMPLETE:'));

  for (const holding of input.portfolio.holdings) {
    const candidate = candidateFor(input.scan, holding.ticker);
    if (candidate?.status !== 'ACCEPTED') continue;
    const snapshot = result.positions.find(position => position.key === holding.ticker.toUpperCase() || position.tickerOrIsin.toUpperCase() === holding.ticker.toUpperCase());
    if (!snapshot) continue;

    const assessment = StrategyConsensusEngine.assess(input.scan, candidate.asset.assetId, input.cashBenchmarkAnnualPct);
    const lots = input.taxLots[holding.ticker.toUpperCase()] ?? [];
    const trackedShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
    const investedEur = lots.reduce((sum, lot) => sum + lot.acquisitionCostEur, 0);
    const basisComplete = holding.shares > 0
      && Math.abs(trackedShares - holding.shares) <= Math.max(1e-7, holding.shares * 1e-7)
      && investedEur > 0;
    if (!basisComplete) result.warnings.push(`POSITION_COST_BASIS_INCOMPLETE:${holding.ticker.toUpperCase()}:tracked=${trackedShares.toFixed(6)}:portfolio=${holding.shares.toFixed(6)}`);
    const latestLotDate = lots.map(lot => lot.acquisitionDate).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1) ?? null;
    const latestExecutionDate = latestEpisodeDate(input.executionHistory, [candidate.asset.assetId, candidate.asset.ticker, candidate.asset.isin], ['BUY_ETF', 'SELL_ETF']);
    const series = input.scan.acceptedDataset.assets.find(asset => asset.assetId === candidate.asset.assetId);
    const context = pathContext({
      bars: series?.bars ?? [],
      acquisitionDate: basisComplete ? laterDate(latestLotDate, latestExecutionDate) : null,
      investedEur: basisComplete ? investedEur : null,
      units: basisComplete ? holding.shares : null,
      category: candidate.asset.category,
      tickerOrAssetId: candidate.asset.assetId,
      deteriorationStreakSessions: assessDeteriorationStreak(input.scan, candidate.asset.assetId, input.cashBenchmarkAnnualPct),
      momentum20Pct: candidate.momentum20Pct
    });
    const classification = classifyPositionHealth(assessment, snapshot.excessVsCashPctPoints, context);
    Object.assign(snapshot, classification, {
      category: context.category ?? null,
      isDiversifiedCore: context.isDiversifiedCore ?? null,
      currentReturnPct: context.currentReturnPct ?? null,
      mfePct: context.mfePct ?? null,
      givebackFromMfePctPoints: context.givebackFromMfePctPoints ?? null,
      deteriorationStreakSessions: context.deteriorationStreakSessions ?? null,
      momentum20Pct: context.momentum20Pct ?? assessment?.momentum20Pct ?? null
    });
  }

  for (const fund of input.portfolio.funds ?? []) {
    const candidate = candidateFor(input.scan, fund.isin) ?? candidateFor(input.scan, fund.id);
    if (candidate?.status !== 'ACCEPTED') continue;
    const snapshot = result.positions.find(position => position.key === fund.id || position.tickerOrIsin.toUpperCase() === fund.isin.toUpperCase());
    if (!snapshot) continue;

    const assessment = StrategyConsensusEngine.assess(input.scan, candidate.asset.assetId, input.cashBenchmarkAnnualPct);
    const latestExecutionDate = latestEpisodeDate(
      input.executionHistory,
      [fund.id, fund.isin, candidate.asset.assetId, candidate.asset.ticker, candidate.asset.isin],
      ['SUBSCRIBE_FUND', 'REDEEM_FUND', 'TRANSFER_FUND']
    );
    const series = input.scan.acceptedDataset.assets.find(asset => asset.assetId === candidate.asset.assetId);
    const context = pathContext({
      bars: series?.bars ?? [],
      acquisitionDate: laterDate(fund.acquisitionDate, latestExecutionDate),
      investedEur: fund.investedEur,
      units: fund.units,
      category: candidate.asset.category,
      tickerOrAssetId: candidate.asset.assetId,
      deteriorationStreakSessions: assessDeteriorationStreak(input.scan, candidate.asset.assetId, input.cashBenchmarkAnnualPct),
      momentum20Pct: candidate.momentum20Pct
    });
    const classification = classifyPositionHealth(assessment, snapshot.excessVsCashPctPoints, context);
    Object.assign(snapshot, classification, {
      category: context.category ?? null,
      isDiversifiedCore: context.isDiversifiedCore ?? null,
      currentReturnPct: context.currentReturnPct ?? null,
      mfePct: context.mfePct ?? null,
      givebackFromMfePctPoints: context.givebackFromMfePctPoints ?? null,
      deteriorationStreakSessions: context.deteriorationStreakSessions ?? null,
      momentum20Pct: context.momentum20Pct ?? assessment?.momentum20Pct ?? null
    });
  }

  applyStrategicCoreAlertProtection(result, input.scan);
  return result;
}

function isManagementAction(action: string): action is ManagementAction {
  return action === 'ADD' || action === 'WATCH' || action === 'REDUCE' || action === 'EXIT';
}

function normalizeAlertState(raw: unknown): PortfolioAlertState {
  const value: any = raw && typeof raw === 'object' ? raw : {};
  const actions: Record<string, ManagementAction> = {};
  if (value.lastDeliveredActions && typeof value.lastDeliveredActions === 'object') {
    for (const [key, action] of Object.entries(value.lastDeliveredActions)) {
      if (typeof action === 'string' && isManagementAction(action)) actions[key] = action;
    }
  }
  return {
    ...EMPTY_ALERT_STATE,
    lastDeliveredActions: actions,
    lastDeliveredRotationKey: typeof value.lastDeliveredRotationKey === 'string' ? value.lastDeliveredRotationKey : null,
    lastNotificationAt: typeof value.lastNotificationAt === 'string' ? value.lastNotificationAt : null,
    lastMarketDate: typeof value.lastMarketDate === 'string' ? value.lastMarketDate : null,
    lastError: typeof value.lastError === 'string' ? value.lastError : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null
  };
}

export async function runPortfolioManagementAlerts(input: {
  scan: AssetUniverseScanResult;
  marketDate: string;
  defaultCashBenchmarkAnnualPct: number;
}): Promise<PortfolioManagementAlertSummary> {
  const uid = resolvePortfolioAlertUid();
  if (!uid || !firebaseAdminConfigured() || !telegramNotificationConfigured()) {
    return { configured: false, evaluated: false, evaluatedPositions: 0, pendingEventCount: 0, rotationStatus: null, notificationSent: false, error: uid ? null : 'PORTFOLIO_ALERT_UID_NOT_CONFIGURED' };
  }

  const { auth, db } = firebaseAdminServices();
  const stateRef = db.doc(`users/${uid}/private/portfolioAlertAutomation`);
  try {
    const user = await auth.getUser(uid);
    const active = !user.disabled && (user.customClaims?.accessGranted === true || user.customClaims?.isAdmin === true);
    if (!active) return { configured: true, evaluated: false, evaluatedPositions: 0, pendingEventCount: 0, rotationStatus: null, notificationSent: false, error: 'PORTFOLIO_ALERT_ACCOUNT_NOT_ACTIVE' };

    const privateSnapshot = await db.doc(`users/${uid}/private/state`).get();
    if (!privateSnapshot.exists) return { configured: true, evaluated: false, evaluatedPositions: 0, pendingEventCount: 0, rotationStatus: null, notificationSent: false, error: 'PORTFOLIO_PRIVATE_STATE_NOT_FOUND' };
    const values = (privateSnapshot.data()?.values ?? {}) as Record<string, unknown>;
    const rawPortfolio = parseStoredJson<any>(values, 'custodia_user_portfolio_v1', null);
    if (!rawPortfolio) return { configured: true, evaluated: false, evaluatedPositions: 0, pendingEventCount: 0, rotationStatus: null, notificationSent: false, error: 'PORTFOLIO_STATE_NOT_FOUND' };

    const portfolio = migrateUserPortfolioState(rawPortfolio);
    const executionHistory = normalizeExecutionHistory(parseStoredJson<unknown>(values, 'custodia_portfolio_execution_history_v1', []));
    const taxLots = normalizeTaxLots(parseStoredJson<unknown>(values, 'custodia_spanish_tax_lots_v1', {}));
    const taxSettings = normalizeTaxSettings(parseStoredJson<unknown>(values, 'custodia_spanish_tax_settings_v1', {}));
    const cashBenchmarkAnnualPct = parseCashBenchmark(values, input.defaultCashBenchmarkAnnualPct);
    const health = await evaluateWithPrivateContext({ portfolio, scan: input.scan, cashBenchmarkAnnualPct, executionHistory, taxLots });
    const rotation = PortfolioRotationReviewEngine.evaluate({
      portfolio,
      scan: input.scan,
      positionHealth: health,
      cashBenchmarkAnnualPct,
      horizonYears: Math.max(1, Number(process.env.ALERT_HORIZON_YEARS) || 3),
      privateContext: { taxSettings, taxLotsByTicker: taxLots }
    });

    const previousSnapshot = await stateRef.get();
    const previous = normalizeAlertState(previousSnapshot.exists ? previousSnapshot.data() : null);
    const currentActions: Record<string, ManagementAction> = {};
    const actionEvents = health.positions
      .filter(position => isManagementAction(position.action))
      .map(position => {
        const key = position.key || position.tickerOrIsin.toUpperCase();
        currentActions[key] = position.action as ManagementAction;
        return { key, position };
      })
      .filter(({ key, position }) => previous.lastDeliveredActions[key] !== position.action)
      .map(({ position }) => ({
        key: position.key,
        label: position.label,
        tickerOrIsin: position.tickerOrIsin,
        action: position.action as ManagementAction,
        reason: position.reason,
        suggestedReductionPct: position.suggestedReductionPct
      }));

    const rotationKey = rotation.status === 'ROTATE_NOW' && rotation.sourceId && rotation.targetAssetId
      ? `${rotation.sourceId}->${rotation.targetAssetId}`
      : null;
    const rotationEvent = rotationKey && rotationKey !== previous.lastDeliveredRotationKey
      ? {
          sourceLabel: rotation.sourceLabel ?? rotation.sourceId ?? 'posición actual',
          targetLabel: rotation.targetTicker ?? rotation.targetName ?? rotation.targetAssetId ?? 'destino',
          reason: rotation.reason
        }
      : null;
    const pendingEventCount = actionEvents.length + (rotationEvent ? 1 : 0);

    let notificationSent = false;
    if (pendingEventCount > 0) {
      notificationSent = await notifyTelegramPortfolioManagement({
        marketDate: input.marketDate,
        actionEvents,
        rotationEvent
      }).catch(() => false);
    }

    const retainedActions: Record<string, ManagementAction> = {};
    for (const [key, action] of Object.entries(previous.lastDeliveredActions)) {
      if (currentActions[key] === action) retainedActions[key] = action;
    }
    const deliveredActions = notificationSent ? currentActions : retainedActions;
    const nextRotationKey = notificationSent ? rotationKey : (rotationKey === previous.lastDeliveredRotationKey ? previous.lastDeliveredRotationKey : null);
    const now = new Date().toISOString();
    await stateRef.set({
      lastDeliveredActions: deliveredActions,
      lastDeliveredRotationKey: nextRotationKey,
      lastNotificationAt: notificationSent ? now : previous.lastNotificationAt,
      lastMarketDate: input.marketDate,
      lastError: null,
      updatedAt: now,
      lastEvaluatedPositionCount: health.positions.length,
      lastPendingEventCount: pendingEventCount,
      lastRotationStatus: rotation.status
    }, { merge: false });

    return {
      configured: true,
      evaluated: true,
      evaluatedPositions: health.positions.length,
      pendingEventCount,
      rotationStatus: rotation.status,
      notificationSent,
      error: null
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    const now = new Date().toISOString();
    await stateRef.set({ lastError: message, updatedAt: now, lastMarketDate: input.marketDate }, { merge: true }).catch(() => undefined);
    return { configured: true, evaluated: false, evaluatedPositions: 0, pendingEventCount: 0, rotationStatus: null, notificationSent: false, error: message };
  }
}
