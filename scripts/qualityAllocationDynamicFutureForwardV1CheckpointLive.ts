import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { brokerCommission } from '../src/investment/decision/costAwareExecutionPolicy';
import {
  AssetUniverseScanner,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  InvestmentDecisionEngine,
  PortfolioCandidateGate,
  type AssetUniverseScanResult,
  type InvestmentDecisionResult,
  type UserPortfolioState
} from '../src/investment/decision';
import {
  PortfolioDecisionEngine,
  type OpportunityAllocationPolicy,
  type PortfolioDecisionResult
} from '../src/investment/decision/portfolioDecisionEngine';
import {
  QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_MARKER,
  QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_PROTOCOL as PROTOCOL,
  absolutePlanDeltaEur,
  addImmutableObservation,
  addImmutableOutcome,
  calendarMonthOf,
  cashGrowthFactor,
  createEmptyProspectiveState,
  prospectivePhaseSummary,
  protocolFingerprintSha256,
  sha256Canonical,
  verifyProspectiveState,
  type QualityAllocationArmOutcome,
  type QualityAllocationArmSnapshot,
  type QualityAllocationForwardHorizon,
  type QualityAllocationObservation,
  type QualityAllocationObservationBody,
  type QualityAllocationPlanRow,
  type QualityAllocationProspectiveState
} from './qualityAllocationDynamicFutureForwardV1Protocol';

const STATE_FILE = path.join(process.cwd(), '.runtime', 'qualityAllocationDynamicFutureForwardV1.json');
const BASE_URL = (process.env.ALERT_INTERNAL_BASE_URL?.trim() || 'http://127.0.0.1:3000').replace(/\/$/, '');

type PriceBar = { timestamp: string; open: number; high: number; low: number; close: number; volume?: number };

function isoDate(value: Date): string { return value.toISOString().slice(0, 10); }
function madridNow(): { iso: string; date: string; calendarMonth: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const read = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const date = `${read('year')}-${read('month')}-${read('day')}`;
  return { iso: now.toISOString(), date, calendarMonth: date.slice(0, 7) };
}
function historyStart(endDate: string): string {
  const d = new Date(`${endDate}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 3);
  return isoDate(d);
}
function marketAsOfDate(scan: AssetUniverseScanResult): string {
  const dates = scan.selected.map(row => row.asOfDate).filter((value): value is string => Boolean(value)).sort();
  return dates.at(-1) ?? '';
}
function methodForMedium(): InvestmentDecisionResult['recommendedMethod'] { return 'RISK_PARITY_ERC'; }
function cashOnlyDecision(scan: AssetUniverseScanResult, capitalEur: number, runDate: string): InvestmentDecisionResult {
  const asOfDate = marketAsOfDate(scan) || runDate;
  return {
    generatedAt: new Date().toISOString(), asOfDate, dataAgeDays: 0, currency: 'EUR', capitalEur,
    riskProfile: 'MEDIUM', horizonYears: 3, marketRegime: 'UNKNOWN', regimeTrendPct: null, regimeVolatilityPct: null,
    confidence: 'MEDIUM', confidenceScore: 70, recommendedMethod: methodForMedium(), cashWeight: 1, cashAmountEur: capitalEur,
    assets: [], portfolioDatasetFingerprint: `QUALITY_FF_CASH_ONLY:${asOfDate}`, evidence: 'REAL_ONLY',
    warnings: ['Prospective research checkpoint: no candidate passed the frozen current gates; both allocation arms remain cash.'],
    summary: 'No candidate passed the frozen current gates. The valid prospective action is no allocation.',
    methodology: ['Dynamic current-market discovery.', 'Frozen LEGACY candidate gates.', 'No forced investment.']
  };
}
function researchPortfolio(runAt: string): UserPortfolioState {
  return {
    cashEur: PROTOCOL.researchAllocationNotionalEur,
    holdings: [],
    funds: [],
    stagedCapitalPlan: { availableEur: 0, horizonMonths: 12, preferredMode: 'MONTHLY' },
    updatedAt: runAt
  };
}
function planRows(result: PortfolioDecisionResult): QualityAllocationPlanRow[] {
  return result.contributions.map(row => ({
    assetId: row.assetId,
    ticker: row.ticker,
    category: row.category,
    instrumentType: row.instrumentType,
    amountEur: row.amountEur,
    priorityScore: row.priorityScore ?? null,
    qualityAllocationMultiplier: row.qualityAllocationMultiplier ?? 1,
    opportunityLevel: row.opportunityLevel ?? null,
    timingState: row.timingState ?? null,
    suggestedInitialFraction: row.suggestedInitialFraction ?? null
  }));
}
function armSnapshot(policy: OpportunityAllocationPolicy, result: PortfolioDecisionResult): QualityAllocationArmSnapshot {
  const contributions = planRows(result);
  const amount = contributions.reduce((sum, row) => sum + row.amountEur, 0);
  if (amount > PROTOCOL.researchAllocationNotionalEur + 0.02) throw new Error(`QUALITY_FF_PLAN_EXCEEDS_RESEARCH_NOTIONAL:${policy}:${amount}`);
  return {
    policy,
    recommendedNewInvestmentEur: result.recommendedNewInvestmentEur,
    residualPlannedCashEur: result.residualPlannedCashEur,
    targetCashEur: result.targetCashEur,
    deployableToAssetsEur: result.deployableToAssetsEur,
    contributionCount: contributions.length,
    contributions,
    planHashSha256: sha256Canonical({ policy, contributions, residualPlannedCashEur: result.residualPlannedCashEur })
  };
}
function buildObservationBody(input: {
  runAt: string;
  runDate: string;
  calendarMonth: string;
  scan: AssetUniverseScanResult;
  gate: ReturnType<typeof PortfolioCandidateGate.apply>;
  decision: InvestmentDecisionResult;
  legacy: QualityAllocationArmSnapshot;
  quality: QualityAllocationArmSnapshot;
}): QualityAllocationObservationBody {
  const provenanceByAsset = new Map(input.scan.acceptedDataset.assets.map(asset => [asset.assetId, asset.provenance?.sourceType ?? null]));
  const candidatePool = input.scan.candidates.map(candidate => ({
    assetId: candidate.asset.assetId,
    ticker: candidate.asset.ticker,
    category: candidate.asset.category,
    status: candidate.status,
    reason: candidate.reason ?? null,
    score: candidate.score,
    reliabilityScore: candidate.reliabilityScore ?? null,
    opportunityScore: candidate.opportunityScore ?? null,
    asOfDate: candidate.asOfDate,
    provenance: provenanceByAsset.get(candidate.asset.assetId) ?? candidate.response?.provenance?.sourceType ?? null,
    openDiscovered: candidate.asset.assetId.startsWith('OPEN_')
  }));
  const shortlistAssetIds = input.scan.dynamicMarketShortlist?.shortlistAssetIds ?? [];
  const decisionAssets = input.decision.assets.map(row => ({ assetId: row.assetId, ticker: row.ticker, weight: row.weight }));
  const delta = absolutePlanDeltaEur(input.legacy.contributions, input.quality.contributions);
  return {
    id: `QUALITY_FF_${input.calendarMonth}`,
    calendarMonth: input.calendarMonth,
    checkpointRunAt: input.runAt,
    checkpointRunDate: input.runDate,
    marketAsOfDate: marketAsOfDate(input.scan),
    researchFixture: {
      capitalEur: PROTOCOL.researchAllocationNotionalEur,
      riskProfile: PROTOCOL.riskProfile,
      horizonYears: PROTOCOL.horizonYears,
      cashBenchmarkAnnualPct: PROTOCOL.cashBenchmarkAnnualPct,
      noUserPortfolioData: true,
      notRecurringContribution: true
    },
    discovery: {
      attempted: input.scan.currentOpenDiscovery?.attempted === true,
      promotedAssets: input.scan.currentOpenDiscovery?.promotedAssets ?? 0,
      generatedAt: input.scan.currentOpenDiscovery?.generatedAt ?? null,
      error: input.scan.currentOpenDiscovery?.error ?? null
    },
    scanner: {
      scanned: input.scan.scanned,
      accepted: input.scan.accepted,
      rejected: input.scan.rejected,
      rejectionCounts: input.scan.rejectionCounts,
      shortlistSize: input.scan.dynamicMarketShortlist?.shortlistSize ?? 0,
      rankingVersion: input.scan.dynamicMarketShortlist?.rankingVersion ?? 'UNKNOWN',
      candidatePool,
      shortlistAssetIds,
      shortlistHashSha256: sha256Canonical(shortlistAssetIds)
    },
    gate: {
      selectionPolicy: input.gate.selectionPolicy,
      eligibleCount: input.gate.eligibleCount,
      rejectedCount: input.gate.rejectedCount,
      selectedCount: input.gate.selectedCount,
      eligibleAssetIds: input.gate.entries.filter(row => row.status === 'ELIGIBLE').map(row => row.assetId).sort()
    },
    decision: {
      asOfDate: input.decision.asOfDate,
      marketRegime: input.decision.marketRegime,
      cashWeight: input.decision.cashWeight,
      recommendedMethod: input.decision.recommendedMethod,
      confidence: input.decision.confidence,
      confidenceScore: input.decision.confidenceScore,
      assets: decisionAssets,
      decisionHashSha256: sha256Canonical({
        asOfDate: input.decision.asOfDate,
        marketRegime: input.decision.marketRegime,
        cashWeight: input.decision.cashWeight,
        recommendedMethod: input.decision.recommendedMethod,
        assets: decisionAssets
      })
    },
    arms: {
      legacy: input.legacy,
      quality: input.quality,
      planChanged: delta > 0.01,
      absolutePlannedNotionalDeltaEur: delta
    }
  };
}
function validateFreshDynamicScan(scan: AssetUniverseScanResult): void {
  const discovery = scan.currentOpenDiscovery;
  const shortlist = scan.dynamicMarketShortlist;
  if (!discovery?.attempted) throw new Error('QUALITY_FF_CURRENT_DISCOVERY_NOT_ATTEMPTED');
  if (discovery.error) throw new Error(`QUALITY_FF_CURRENT_DISCOVERY_DEGRADED:${discovery.error}`);
  if (discovery.promotedAssets < PROTOCOL.currentDiscoveryMinimumPromotedAssets) {
    throw new Error(`QUALITY_FF_CURRENT_DISCOVERY_BREADTH_INSUFFICIENT:${discovery.promotedAssets}`);
  }
  if (!shortlist?.applied || shortlist.mode !== PROTOCOL.dynamicMarketMode) throw new Error('QUALITY_FF_DYNAMIC_SHORTLIST_NOT_APPLIED');
  if (shortlist.targetSize !== PROTOCOL.dynamicShortlistTarget || shortlist.shortlistSize !== PROTOCOL.dynamicShortlistTarget) {
    throw new Error(`QUALITY_FF_DYNAMIC_SHORTLIST_INCOMPLETE:${shortlist?.shortlistSize ?? 0}`);
  }
  const selectedIds = new Set(shortlist.shortlistAssetIds);
  const nonReal = scan.acceptedDataset.assets.filter(asset => selectedIds.has(asset.assetId) && asset.provenance?.sourceType !== 'REAL');
  if (nonReal.length) throw new Error(`QUALITY_FF_NON_REAL_SHORTLIST:${nonReal.map(row => row.assetId).join(',')}`);
}
function loadState(nowIso: string, calendarMonth: string): { state: QualityAllocationProspectiveState; existed: boolean } {
  if (!existsSync(STATE_FILE)) {
    if (calendarMonth !== PROTOCOL.firstEligibleCalendarMonth) {
      throw new Error(`QUALITY_FF_BASELINE_MISSING_AFTER_START_WINDOW:${calendarMonth}`);
    }
    return { state: createEmptyProspectiveState(nowIso), existed: false };
  }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as QualityAllocationProspectiveState;
  verifyProspectiveState(state);
  return { state, existed: true };
}
function saveState(state: QualityAllocationProspectiveState): void {
  verifyProspectiveState(state);
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const temporary = `${STATE_FILE}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(temporary, STATE_FILE);
}
async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE_URL}/api/health`)).ok) return true; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}
async function ensureLocalServer(): Promise<{ server: ReturnType<typeof spawn> | null; ownsServer: boolean }> {
  if (await waitForHealth(1500)) return { server: null, ownsServer: false };
  const server = spawn('npm', ['run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: { ...process.env, DISABLE_HMR: 'true' }
  });
  if (!(await waitForHealth(30_000))) {
    server.kill('SIGTERM');
    throw new Error('QUALITY_FF_LOCAL_SERVER_UNAVAILABLE');
  }
  return { server, ownsServer: true };
}
function configureRealProvider(): void {
  const registry = new MarketDataProviderRegistry();
  registry.register(new RealMarketDataProvider(`${BASE_URL}/api/market-data/history`));
  registry.setDefaultProvider('yahoo_finance');
  HistoricalMarketDataService.setRegistry(registry);
}
async function forwardBars(ticker: string, startDate: string, endDate: string): Promise<PriceBar[] | null> {
  try {
    const response = await HistoricalMarketDataService.getHistoricalBars({
      symbol: ticker, startDate, endDate, timeframe: '1d', adjusted: true
    }, { forceRefresh: true, providerId: 'yahoo_finance', maxRetries: 1 });
    if (response.provenance?.sourceType !== 'REAL') return null;
    return response.bars.filter(bar => bar.timestamp.slice(0, 10) > startDate) as PriceBar[];
  } catch {
    return null;
  }
}
function executableUnits(amountEur: number, priceEur: number): { units: number; grossEur: number; feeEur: number; leftoverEur: number } {
  let units = Math.floor(amountEur / priceEur + 1e-9);
  let feeEur = units > 0 ? brokerCommission(units * priceEur) : 0;
  while (units > 0 && units * priceEur + feeEur > amountEur + 1e-9) {
    units--;
    feeEur = units > 0 ? brokerCommission(units * priceEur) : 0;
  }
  const grossEur = units * priceEur;
  return { units, grossEur, feeEur, leftoverEur: Math.max(0, amountEur - grossEur - feeEur) };
}
async function evaluateArmOutcome(
  observation: QualityAllocationObservation,
  arm: QualityAllocationArmSnapshot,
  horizonSessions: QualityAllocationForwardHorizon,
  endDate: string,
  barsCache: Map<string, PriceBar[] | null>
): Promise<QualityAllocationArmOutcome | null> {
  const growth = cashGrowthFactor(horizonSessions);
  const requested = arm.contributions.reduce((sum, row) => sum + row.amountEur, 0);
  let finalValueEur = Math.max(0, PROTOCOL.researchAllocationNotionalEur - requested) * growth;
  let investedAtEntryEur = 0;
  let entryFeesEur = 0;

  for (const row of arm.contributions) {
    const key = `${observation.id}:${row.ticker}`;
    let bars = barsCache.get(key);
    if (bars === undefined) {
      bars = await forwardBars(row.ticker, observation.checkpointRunDate, endDate);
      barsCache.set(key, bars);
    }
    if (!bars || bars.length <= horizonSessions) return null;
    const entry = bars[0];
    const mark = bars[horizonSessions];
    if (!(entry.open > 0) || !(mark.close > 0)) return null;

    if (row.instrumentType === 'MUTUAL_FUND') {
      const units = row.amountEur / entry.open;
      investedAtEntryEur += row.amountEur;
      finalValueEur += units * mark.close;
      continue;
    }

    const executed = executableUnits(row.amountEur, entry.open);
    investedAtEntryEur += executed.grossEur;
    entryFeesEur += executed.feeEur;
    finalValueEur += executed.units * mark.close + executed.leftoverEur * growth;
  }

  return {
    policy: arm.policy,
    finalValueEur,
    returnPct: (finalValueEur / PROTOCOL.researchAllocationNotionalEur - 1) * 100,
    investedAtEntryEur,
    entryFeesEur,
    residualCashAtStartEur: Math.max(0, PROTOCOL.researchAllocationNotionalEur - requested),
    evaluatedAssets: arm.contributions.length
  };
}
async function resolveMaturedOutcomes(state: QualityAllocationProspectiveState, endDate: string) {
  const resolved: Array<{ observationId: string; horizonSessions: number; deltaPctPoints: number }> = [];
  const pending: Array<{ observationId: string; horizonSessions: number }> = [];
  const barsCache = new Map<string, PriceBar[] | null>();
  for (const observation of state.observations) {
    for (const horizonSessions of PROTOCOL.forwardOutcomeSessions) {
      if (state.outcomes.some(row => row.observationId === observation.id && row.horizonSessions === horizonSessions)) continue;
      if (observation.arms.legacy.contributionCount === 0 && observation.arms.quality.contributionCount === 0) {
        pending.push({ observationId: observation.id, horizonSessions });
        continue;
      }
      const legacy = await evaluateArmOutcome(observation, observation.arms.legacy, horizonSessions, endDate, barsCache);
      const quality = await evaluateArmOutcome(observation, observation.arms.quality, horizonSessions, endDate, barsCache);
      if (!legacy || !quality) {
        pending.push({ observationId: observation.id, horizonSessions });
        continue;
      }
      const outcome = addImmutableOutcome(state, {
        observationId: observation.id,
        calendarMonth: observation.calendarMonth,
        horizonSessions,
        resolvedAt: new Date().toISOString(),
        status: 'RESOLVED',
        legacy,
        quality,
        qualityMinusLegacyPctPoints: quality.returnPct - legacy.returnPct,
        qualityMinusLegacyFinalEur: quality.finalValueEur - legacy.finalValueEur
      });
      resolved.push({ observationId: observation.id, horizonSessions, deltaPctPoints: outcome.qualityMinusLegacyPctPoints });
    }
  }
  return { resolved, pending };
}

async function main() {
  const clock = madridNow();
  const loaded = loadState(clock.iso, clock.calendarMonth);
  const state = loaded.state;
  const existingThisMonth = state.observations.find(row => row.calendarMonth === clock.calendarMonth) ?? null;
  const local = await ensureLocalServer();
  try {
    configureRealProvider();
    const outcomeResolution = await resolveMaturedOutcomes(state, clock.date);
    if (outcomeResolution.resolved.length) saveState(state);

    let observation: QualityAllocationObservation | null = existingThisMonth;
    let observationRecordedThisRun = false;
    if (!existingThisMonth && state.observations.length < PROTOCOL.maximumCheckpoints) {
      const scan = await AssetUniverseScanner.scan(
        EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        historyStart(clock.date),
        clock.date,
        {
          forceRefresh: true,
          concurrency: 3,
          maxSelected: PROTOCOL.dynamicShortlistTarget,
          minimumBars: PROTOCOL.minimumBars,
          maxDataAgeDays: PROTOCOL.maxDataAgeDays,
          currentOpenDiscovery: true
        }
      );
      validateFreshDynamicScan(scan);

      const gate = PortfolioCandidateGate.apply(scan, PROTOCOL.cashBenchmarkAnnualPct, 12, 'LEGACY');
      const decision = gate.scan.selected.length > 0
        ? InvestmentDecisionEngine.decide(
          gate.scan.dataset,
          { capitalEur: PROTOCOL.researchAllocationNotionalEur, riskProfile: PROTOCOL.riskProfile, horizonYears: PROTOCOL.horizonYears },
          new Date(clock.iso)
        )
        : cashOnlyDecision(scan, PROTOCOL.researchAllocationNotionalEur, clock.date);
      const portfolio = researchPortfolio(clock.iso);
      const commonInput = {
        portfolio,
        scan: gate.scan,
        decision,
        fundMarketValues: {},
        positionHealth: {},
        cashBenchmarkAnnualPct: PROTOCOL.cashBenchmarkAnnualPct
      };
      const legacyResult = PortfolioDecisionEngine.evaluate({ ...commonInput, opportunityAllocationPolicy: 'LEGACY' });
      const qualityResult = PortfolioDecisionEngine.evaluate({ ...commonInput, opportunityAllocationPolicy: 'QUALITY_ALLOCATION_BRIDGE_V1' });
      const legacy = armSnapshot('LEGACY', legacyResult);
      const quality = armSnapshot('QUALITY_ALLOCATION_BRIDGE_V1', qualityResult);
      const body = buildObservationBody({ runAt: clock.iso, runDate: clock.date, calendarMonth: clock.calendarMonth, scan, gate, decision, legacy, quality });
      observation = addImmutableObservation(state, body);
      saveState(state);
      observationRecordedThisRun = true;
    }

    const result = {
      version: PROTOCOL.version,
      status: observationRecordedThisRun ? 'PROSPECTIVE_CHECKPOINT_RECORDED' : 'PROSPECTIVE_STATE_VERIFIED_NO_REWRITE',
      generatedAt: new Date().toISOString(),
      protocol: PROTOCOL,
      protocolFingerprintSha256: protocolFingerprintSha256(),
      stateFile: '.runtime/qualityAllocationDynamicFutureForwardV1.json',
      stateExistedBeforeRun: loaded.existed,
      observationRecordedThisRun,
      currentObservation: observation,
      outcomeResolution,
      phaseSummary: prospectivePhaseSummary(state),
      continuity: {
        observationsAreImmutable: true,
        outcomesAreImmutable: true,
        duplicateMonthCannotOverwrite: true,
        missingBaselineAfterFirstEligibleMonthFailsClosed: true,
        currentStateHashSha256: sha256Canonical(state)
      },
      interpretationContract: {
        productionPolicyRemains: 'LEGACY',
        qualityBridgeResearchOnly: true,
        phaseACanPromoteProduction: false,
        noRetuningAfterObservedCheckpoint: true,
        independentResearchNotionalIsNotMonthlyContribution: true,
        historicalReplayUsed: false,
        currentDynamicMarketRulesFrozenNotAssetNames: true
      }
    };
    console.log(`${QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_MARKER}${JSON.stringify(result)}`);
  } finally {
    if (local.ownsServer && local.server) local.server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FATAL', error);
  process.exitCode = 1;
});
