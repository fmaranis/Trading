import type { DynamicHistoricalReplayResult, DynamicReplaySignal } from './dynamicHistoricalReplay';

export interface ReplayAssetAllocationDelta {
  assetId: string;
  ticker: string;
  currentEntryEur: number;
  coreEntryEur: number;
  deltaEntryEur: number;
  currentManagementEur: number;
  coreManagementEur: number;
  deltaManagementEur: number;
  currentRealizedGainEur: number;
  coreRealizedGainEur: number;
  deltaRealizedGainEur: number;
  activityDifferenceEur: number;
}

export interface ReplayDivergenceRow {
  assetId: string;
  ticker: string;
  action: 'BUY' | 'ADD' | 'REDUCE' | 'EXIT';
  currentNotionalEur: number;
  coreNotionalEur: number;
  deltaCoreMinusCurrentEur: number;
  currentUnitsDelta: number;
  coreUnitsDelta: number;
}

export interface CurrentVsCoreCausalAttribution {
  policy: 'CURRENT_VS_CORE_CAUSAL_ATTRIBUTION_V1';
  valid: boolean;
  accountingIdentity: {
    currentFinalValueEur: number;
    trendProtectionV2FinalValueEur: number;
    strategicCoreFinalValueEur: number;
    trendProtectionV2EffectEur: number;
    strategicCoreHoldIncrementalEffectEur: number;
    totalCoreVsCurrentEur: number;
    reconstructedCoreVsCurrentEur: number;
    residualEur: number;
    reconcilesWithinOneCent: boolean;
    trendProtectionV2EffectReturnPctPoints: number;
    strategicCoreHoldIncrementalEffectReturnPctPoints: number;
    totalCoreVsCurrentReturnPctPoints: number;
    reconstructedCoreVsCurrentReturnPctPoints: number;
    residualReturnPctPoints: number;
  };
  firstExecutionDivergence: {
    date: string | null;
    rows: ReplayDivergenceRow[];
  };
  pathExposure: {
    matchedDates: number;
    averageCashCurrentEur: number | null;
    averageCashCoreEur: number | null;
    averageCashDeltaCoreMinusCurrentEur: number | null;
    averageInvestedCurrentEur: number | null;
    averageInvestedCoreEur: number | null;
    averageInvestedDeltaCoreMinusCurrentEur: number | null;
    finalCashCurrentEur: number | null;
    finalCashCoreEur: number | null;
    finalCashDeltaCoreMinusCurrentEur: number | null;
    maxCoreEquityAdvantageEur: number | null;
    maxCoreEquityAdvantageDate: string | null;
    maxCurrentEquityAdvantageEur: number | null;
    maxCurrentEquityAdvantageDate: string | null;
  };
  executedActionCounts: {
    current: Record<'BUY' | 'ADD' | 'REDUCE' | 'EXIT', number>;
    core: Record<'BUY' | 'ADD' | 'REDUCE' | 'EXIT', number>;
    deltaCoreMinusCurrent: Record<'BUY' | 'ADD' | 'REDUCE' | 'EXIT', number>;
  };
  largestAssetAllocationDifferences: ReplayAssetAllocationDelta[];
  notes: string[];
}

const ACTIONS = ['BUY', 'ADD', 'REDUCE', 'EXIT'] as const;
type MaterialAction = typeof ACTIONS[number];

function materialExecutedSignals(result: DynamicHistoricalReplayResult): DynamicReplaySignal[] {
  return result.signals.filter(signal =>
    signal.executed
    && signal.executionDate != null
    && ACTIONS.includes(signal.action as MaterialAction)
  );
}

function actionCounts(result: DynamicHistoricalReplayResult): Record<MaterialAction, number> {
  const counts: Record<MaterialAction, number> = { BUY: 0, ADD: 0, REDUCE: 0, EXIT: 0 };
  for (const signal of materialExecutedSignals(result)) counts[signal.action as MaterialAction] += 1;
  return counts;
}

function firstExecutionDivergence(current: DynamicHistoricalReplayResult, core: DynamicHistoricalReplayResult) {
  const currentSignals = materialExecutedSignals(current);
  const coreSignals = materialExecutedSignals(core);
  const dates = [...new Set([
    ...currentSignals.map(signal => signal.executionDate!),
    ...coreSignals.map(signal => signal.executionDate!)
  ])].sort();

  for (const date of dates) {
    const aggregate = new Map<string, ReplayDivergenceRow>();
    const add = (signal: DynamicReplaySignal, side: 'current' | 'core') => {
      const action = signal.action as MaterialAction;
      const key = `${signal.assetId}|${action}`;
      const row = aggregate.get(key) ?? {
        assetId: signal.assetId,
        ticker: signal.ticker,
        action,
        currentNotionalEur: 0,
        coreNotionalEur: 0,
        deltaCoreMinusCurrentEur: 0,
        currentUnitsDelta: 0,
        coreUnitsDelta: 0
      };
      if (side === 'current') {
        row.currentNotionalEur += signal.notionalEur;
        row.currentUnitsDelta += signal.unitsDelta;
      } else {
        row.coreNotionalEur += signal.notionalEur;
        row.coreUnitsDelta += signal.unitsDelta;
      }
      aggregate.set(key, row);
    };

    for (const signal of currentSignals.filter(signal => signal.executionDate === date)) add(signal, 'current');
    for (const signal of coreSignals.filter(signal => signal.executionDate === date)) add(signal, 'core');

    const rows = [...aggregate.values()]
      .map(row => ({ ...row, deltaCoreMinusCurrentEur: row.coreNotionalEur - row.currentNotionalEur }))
      .filter(row => Math.abs(row.deltaCoreMinusCurrentEur) > 0.01 || Math.abs(row.coreUnitsDelta - row.currentUnitsDelta) > 1e-8)
      .sort((a, b) => Math.abs(b.deltaCoreMinusCurrentEur) - Math.abs(a.deltaCoreMinusCurrentEur));
    if (rows.length) return { date, rows: rows.slice(0, 12) };
  }
  return { date: null, rows: [] as ReplayDivergenceRow[] };
}

function assetAllocationDifferences(current: DynamicHistoricalReplayResult, core: DynamicHistoricalReplayResult): ReplayAssetAllocationDelta[] {
  interface MutableRow extends ReplayAssetAllocationDelta { }
  const rows = new Map<string, MutableRow>();
  const add = (signal: DynamicReplaySignal, side: 'current' | 'core') => {
    const row = rows.get(signal.assetId) ?? {
      assetId: signal.assetId,
      ticker: signal.ticker,
      currentEntryEur: 0,
      coreEntryEur: 0,
      deltaEntryEur: 0,
      currentManagementEur: 0,
      coreManagementEur: 0,
      deltaManagementEur: 0,
      currentRealizedGainEur: 0,
      coreRealizedGainEur: 0,
      deltaRealizedGainEur: 0,
      activityDifferenceEur: 0
    };
    const isEntry = signal.action === 'BUY' || signal.action === 'ADD';
    if (side === 'current') {
      if (isEntry) row.currentEntryEur += signal.notionalEur;
      else row.currentManagementEur += signal.notionalEur;
      row.currentRealizedGainEur += signal.realizedGainEur;
    } else {
      if (isEntry) row.coreEntryEur += signal.notionalEur;
      else row.coreManagementEur += signal.notionalEur;
      row.coreRealizedGainEur += signal.realizedGainEur;
    }
    rows.set(signal.assetId, row);
  };

  for (const signal of materialExecutedSignals(current)) add(signal, 'current');
  for (const signal of materialExecutedSignals(core)) add(signal, 'core');

  return [...rows.values()]
    .map(row => {
      const deltaEntryEur = row.coreEntryEur - row.currentEntryEur;
      const deltaManagementEur = row.coreManagementEur - row.currentManagementEur;
      const deltaRealizedGainEur = row.coreRealizedGainEur - row.currentRealizedGainEur;
      return {
        ...row,
        deltaEntryEur,
        deltaManagementEur,
        deltaRealizedGainEur,
        activityDifferenceEur: Math.abs(deltaEntryEur) + Math.abs(deltaManagementEur)
      };
    })
    .filter(row => row.activityDifferenceEur > 0.01 || Math.abs(row.deltaRealizedGainEur) > 0.01)
    .sort((a, b) => b.activityDifferenceEur - a.activityDifferenceEur)
    .slice(0, 20);
}

function pathExposure(current: DynamicHistoricalReplayResult, core: DynamicHistoricalReplayResult): CurrentVsCoreCausalAttribution['pathExposure'] {
  const coreByDate = new Map(core.equityPath.map(point => [point.date, point]));
  const pairs = current.equityPath
    .map(currentPoint => ({ current: currentPoint, core: coreByDate.get(currentPoint.date) }))
    .filter((pair): pair is { current: DynamicHistoricalReplayResult['equityPath'][number]; core: DynamicHistoricalReplayResult['equityPath'][number] } => pair.core != null);

  if (!pairs.length) {
    return {
      matchedDates: 0,
      averageCashCurrentEur: null,
      averageCashCoreEur: null,
      averageCashDeltaCoreMinusCurrentEur: null,
      averageInvestedCurrentEur: null,
      averageInvestedCoreEur: null,
      averageInvestedDeltaCoreMinusCurrentEur: null,
      finalCashCurrentEur: current.equityPath.at(-1)?.cashEur ?? null,
      finalCashCoreEur: core.equityPath.at(-1)?.cashEur ?? null,
      finalCashDeltaCoreMinusCurrentEur: null,
      maxCoreEquityAdvantageEur: null,
      maxCoreEquityAdvantageDate: null,
      maxCurrentEquityAdvantageEur: null,
      maxCurrentEquityAdvantageDate: null
    };
  }

  const sum = (selector: (pair: typeof pairs[number]) => number) => pairs.reduce((total, pair) => total + selector(pair), 0);
  const averageCashCurrentEur = sum(pair => pair.current.cashEur) / pairs.length;
  const averageCashCoreEur = sum(pair => pair.core.cashEur) / pairs.length;
  const averageInvestedCurrentEur = sum(pair => pair.current.investedEur) / pairs.length;
  const averageInvestedCoreEur = sum(pair => pair.core.investedEur) / pairs.length;
  const finalCurrent = pairs.at(-1)!.current;
  const finalCore = pairs.at(-1)!.core;

  let maxCore = { value: -Infinity, date: null as string | null };
  let maxCurrent = { value: -Infinity, date: null as string | null };
  for (const pair of pairs) {
    const delta = pair.core.equityEur - pair.current.equityEur;
    if (delta > maxCore.value) maxCore = { value: delta, date: pair.current.date };
    if (-delta > maxCurrent.value) maxCurrent = { value: -delta, date: pair.current.date };
  }

  return {
    matchedDates: pairs.length,
    averageCashCurrentEur,
    averageCashCoreEur,
    averageCashDeltaCoreMinusCurrentEur: averageCashCoreEur - averageCashCurrentEur,
    averageInvestedCurrentEur,
    averageInvestedCoreEur,
    averageInvestedDeltaCoreMinusCurrentEur: averageInvestedCoreEur - averageInvestedCurrentEur,
    finalCashCurrentEur: finalCurrent.cashEur,
    finalCashCoreEur: finalCore.cashEur,
    finalCashDeltaCoreMinusCurrentEur: finalCore.cashEur - finalCurrent.cashEur,
    maxCoreEquityAdvantageEur: Math.max(0, maxCore.value),
    maxCoreEquityAdvantageDate: maxCore.date,
    maxCurrentEquityAdvantageEur: Math.max(0, maxCurrent.value),
    maxCurrentEquityAdvantageDate: maxCurrent.date
  };
}

export function buildCurrentVsCoreCausalAttribution(input: {
  current: DynamicHistoricalReplayResult;
  trendProtectionV2: DynamicHistoricalReplayResult;
  strategicCore: DynamicHistoricalReplayResult;
}): CurrentVsCoreCausalAttribution {
  const { current, trendProtectionV2, strategicCore } = input;
  const trendProtectionV2EffectEur = trendProtectionV2.finalValueEur - current.finalValueEur;
  const strategicCoreHoldIncrementalEffectEur = strategicCore.finalValueEur - trendProtectionV2.finalValueEur;
  const totalCoreVsCurrentEur = strategicCore.finalValueEur - current.finalValueEur;
  const reconstructedCoreVsCurrentEur = trendProtectionV2EffectEur + strategicCoreHoldIncrementalEffectEur;
  const residualEur = totalCoreVsCurrentEur - reconstructedCoreVsCurrentEur;

  const trendProtectionV2EffectReturnPctPoints = trendProtectionV2.totalReturnPct - current.totalReturnPct;
  const strategicCoreHoldIncrementalEffectReturnPctPoints = strategicCore.totalReturnPct - trendProtectionV2.totalReturnPct;
  const totalCoreVsCurrentReturnPctPoints = strategicCore.totalReturnPct - current.totalReturnPct;
  const reconstructedCoreVsCurrentReturnPctPoints = trendProtectionV2EffectReturnPctPoints + strategicCoreHoldIncrementalEffectReturnPctPoints;
  const residualReturnPctPoints = totalCoreVsCurrentReturnPctPoints - reconstructedCoreVsCurrentReturnPctPoints;

  const currentCounts = actionCounts(current);
  const coreCounts = actionCounts(strategicCore);
  const deltaCounts = Object.fromEntries(ACTIONS.map(action => [action, coreCounts[action] - currentCounts[action]])) as Record<MaterialAction, number>;
  const exposure = pathExposure(current, strategicCore);
  const finite = [
    current.finalValueEur,
    trendProtectionV2.finalValueEur,
    strategicCore.finalValueEur,
    current.totalReturnPct,
    trendProtectionV2.totalReturnPct,
    strategicCore.totalReturnPct
  ].every(Number.isFinite);
  const reconcilesWithinOneCent = Math.abs(residualEur) <= 0.01 && Math.abs(residualReturnPctPoints) <= 1e-9;

  return {
    policy: 'CURRENT_VS_CORE_CAUSAL_ATTRIBUTION_V1',
    valid: finite && reconcilesWithinOneCent,
    accountingIdentity: {
      currentFinalValueEur: current.finalValueEur,
      trendProtectionV2FinalValueEur: trendProtectionV2.finalValueEur,
      strategicCoreFinalValueEur: strategicCore.finalValueEur,
      trendProtectionV2EffectEur,
      strategicCoreHoldIncrementalEffectEur,
      totalCoreVsCurrentEur,
      reconstructedCoreVsCurrentEur,
      residualEur,
      reconcilesWithinOneCent,
      trendProtectionV2EffectReturnPctPoints,
      strategicCoreHoldIncrementalEffectReturnPctPoints,
      totalCoreVsCurrentReturnPctPoints,
      reconstructedCoreVsCurrentReturnPctPoints,
      residualReturnPctPoints
    },
    firstExecutionDivergence: firstExecutionDivergence(current, strategicCore),
    pathExposure: exposure,
    executedActionCounts: {
      current: currentCounts,
      core: coreCounts,
      deltaCoreMinusCurrent: deltaCounts
    },
    largestAssetAllocationDifferences: assetAllocationDifferences(current, strategicCore),
    notes: [
      'Atribución integrada, no un séptimo brazo: reutiliza CURRENT, TREND_PROTECTION_V2 y STRATEGIC_CORE_HOLD ya calculados y no ejecuta ningún replay adicional.',
      'Identidad causal exacta: CORE−CURRENT = (V2−CURRENT) + (CORE−V2). El primer término mide sustituir la gestión CURRENT por TREND_PROTECTION_V2; el segundo mide únicamente añadir STRATEGIC_CORE_HOLD sobre V2.',
      'Las diferencias por activo y cash describen cómo divergen las trayectorias después de la primera decisión distinta. No se presentan como una descomposición contrafactual exacta del P&L por activo: una operación distinta cambia cash, plazas y decisiones posteriores.',
      'Signo de los deltas: positivo significa que CORE/HOLD tiene más valor, entrada, venta o cash que CURRENT; negativo significa que CURRENT tiene más.'
    ]
  };
}
