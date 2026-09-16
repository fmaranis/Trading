import { PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_PROTOCOL as PROTOCOL } from './phase6ForwardRiskContextStageAProtocol';

export interface Phase6StageAForwardBar {
  open: number;
  close: number;
}

export interface Phase6StageAMaturedRow {
  informationDate: string;
  assetId: string;
  gateStatus: 'ELIGIBLE' | 'REJECTED';
  contextStatus: 'AVAILABLE' | 'UNAVAILABLE';
  highRiskContext: boolean;
  nextOpen: number;
  forwardBars: Phase6StageAForwardBar[];
}

export type Phase6StageAEvaluationVerdict =
  | 'STAGE_A_PASS_CANDIDATE_FOR_STAGE_B_POLICY_DESIGN'
  | 'STAGE_A_FAIL_NO_INCREMENTAL_DOWNSIDE_INFORMATION'
  | 'STAGE_A_INCONCLUSIVE_OUTCOMES_IMMATURE'
  | 'STAGE_A_INCONCLUSIVE_INSUFFICIENT_REAL_DATA'
  | 'STAGE_A_INCONCLUSIVE_INSUFFICIENT_INCREMENTAL_REACH';

function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2;
}

function isoWeekKey(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function computePhase6StageAForwardMaxDrawdownPct(nextOpen: number, forwardBars: Phase6StageAForwardBar[]): number | null {
  if (!(nextOpen > 0) || forwardBars.length < PROTOCOL.predictiveOutcome.horizonSessions) return null;
  const closes = forwardBars.slice(0, PROTOCOL.predictiveOutcome.horizonSessions).map(row => row.close);
  if (closes.some(value => !(value > 0) || !Number.isFinite(value))) return null;
  let peak = nextOpen;
  let maxDrawdownPct = 0;
  for (const close of closes) {
    peak = Math.max(peak, close);
    maxDrawdownPct = Math.max(maxDrawdownPct, peak > 0 ? (peak - close) / peak * 100 : 0);
  }
  return maxDrawdownPct;
}

export function evaluatePhase6ForwardRiskContextStageA(input: {
  rows: Phase6StageAMaturedRow[];
  frozenWindowCollectionComplete: boolean;
}) {
  const eligible = input.rows.filter(row => row.gateStatus === 'ELIGIBLE');
  const missingContextEligible = eligible.filter(row => row.contextStatus !== 'AVAILABLE');
  const matured = eligible.flatMap(row => {
    if (row.contextStatus !== 'AVAILABLE') return [];
    const maxDrawdownPct = computePhase6StageAForwardMaxDrawdownPct(row.nextOpen, row.forwardBars);
    return maxDrawdownPct == null ? [] : [{ ...row, maxDrawdownPct }];
  });
  const high = matured.filter(row => row.highRiskContext);
  const normal = matured.filter(row => !row.highRiskContext);
  const highEvents = high.filter(row => row.maxDrawdownPct >= PROTOCOL.predictiveOutcome.materialDownsideThresholdPct).length;
  const normalEvents = normal.filter(row => row.maxDrawdownPct >= PROTOCOL.predictiveOutcome.materialDownsideThresholdPct).length;
  const highEventRatePct = high.length ? highEvents / high.length * 100 : null;
  const normalEventRatePct = normal.length ? normalEvents / normal.length * 100 : null;
  const eventRateLiftPctPoints = highEventRatePct != null && normalEventRatePct != null ? highEventRatePct - normalEventRatePct : null;
  const riskRatio = highEventRatePct != null && normalEventRatePct != null
    ? normalEventRatePct === 0 ? (highEventRatePct > 0 ? Number.POSITIVE_INFINITY : 1) : highEventRatePct / normalEventRatePct
    : null;
  const highMedianDrawdownPct = median(high.map(row => row.maxDrawdownPct));
  const normalMedianDrawdownPct = median(normal.map(row => row.maxDrawdownPct));
  const medianSeverityLiftPctPoints = highMedianDrawdownPct != null && normalMedianDrawdownPct != null
    ? highMedianDrawdownPct - normalMedianDrawdownPct
    : null;
  const highAssetIds = new Set(high.map(row => row.assetId));
  const highWeeks = new Set(high.map(row => isoWeekKey(row.informationDate)));
  const highByAsset = new Map<string, number>();
  for (const row of high) highByAsset.set(row.assetId, (highByAsset.get(row.assetId) ?? 0) + 1);
  const maximumSingleAssetShareOfHighRiskEligiblePct = high.length
    ? Math.max(...highByAsset.values()) / high.length * 100
    : null;
  const missingContextPct = eligible.length ? missingContextEligible.length / eligible.length * 100 : 100;

  const reach = {
    evaluableEligibleObservations: matured.length,
    highRiskEligibleObservations: high.length,
    normalRiskEligibleObservations: normal.length,
    assetsWithHighRiskEligibleObservations: highAssetIds.size,
    distinctCalendarWeeksWithHighRiskEligibleObservations: highWeeks.size,
    maximumSingleAssetShareOfHighRiskEligiblePct,
    missingContextPct,
    pass: matured.length >= PROTOCOL.reachGate.minimumEvaluableEligibleObservations
      && high.length >= PROTOCOL.reachGate.minimumHighRiskEligibleObservations
      && normal.length >= PROTOCOL.reachGate.minimumNormalRiskEligibleObservations
      && highAssetIds.size >= PROTOCOL.reachGate.minimumAssetsWithHighRiskEligibleObservations
      && highWeeks.size >= PROTOCOL.reachGate.minimumDistinctCalendarWeeksWithHighRiskEligibleObservations
      && (maximumSingleAssetShareOfHighRiskEligiblePct ?? 100) <= PROTOCOL.reachGate.maximumSingleAssetShareOfHighRiskEligiblePct
  };

  const predictive = {
    highEventRatePct,
    normalEventRatePct,
    eventRateLiftPctPoints,
    riskRatio,
    highMedianDrawdownPct,
    normalMedianDrawdownPct,
    medianSeverityLiftPctPoints,
    pass: (eventRateLiftPctPoints ?? -Infinity) >= PROTOCOL.predictiveGate.minimumAbsoluteMaterialDownsideRateLiftPctPoints
      && (riskRatio ?? -Infinity) >= PROTOCOL.predictiveGate.minimumMaterialDownsideRiskRatio
      && (medianSeverityLiftPctPoints ?? -Infinity) >= PROTOCOL.predictiveGate.minimumMedianMaxDrawdownSeverityLiftPctPoints
  };

  const allEligibleMature = eligible.length > 0 && matured.length + missingContextEligible.length === eligible.length;
  let verdict: Phase6StageAEvaluationVerdict;
  if (!input.frozenWindowCollectionComplete || !allEligibleMature) verdict = PROTOCOL.verdicts.immature;
  else if (matured.length === 0) verdict = PROTOCOL.verdicts.insufficientData;
  else if (!reach.pass) verdict = PROTOCOL.verdicts.insufficientReach;
  else verdict = predictive.pass ? PROTOCOL.verdicts.pass : PROTOCOL.verdicts.fail;

  return {
    version: PROTOCOL.version,
    methodology: 'FROZEN_V8_CONTEXT_WITHIN_PORTFOLIO_CANDIDATE_GATE_STAGE_A',
    productionDefault: PROTOCOL.productionDefault,
    economicPolicyDefined: PROTOCOL.economicPolicyDefined,
    eligibleRows: eligible.length,
    missingContextEligibleRows: missingContextEligible.length,
    maturedEligibleRows: matured.length,
    reach,
    predictive,
    verdict
  } as const;
}
