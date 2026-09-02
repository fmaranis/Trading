import type { DynamicHistoricalReplayResult, DynamicReplaySignal } from './dynamicHistoricalReplay';
import type { InvestorRiskProfile } from './types';
import { profitCaptureRatioPct, type TrendProtectionV2Action } from './trendProtectionPolicy';

export interface TrendProtectionV2ReplayComparison {
  policy: 'TREND_PROTECTION_V2';
  methodology: 'FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE';
  valid: boolean;
  startDate: string;
  endDate: string;
  initialCapitalEur: number;
  finalValueEur: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  totalFeesEur: number;
  totalEstimatedTaxEur: number;
  totalTransferredEur: number;
  cashInterestEur: number;
  turnoverEur: number;
  managementTurnoverEur: number;
  executedReductions: number;
  executedExits: number;
  actionCounts: Record<TrendProtectionV2Action, number>;
  averageProfitCaptureRatioPct: number | null;
  realizedManagementGainEur: number;
  lossSaleCounts: {
    atOrBelowMinus10Pct: number;
    atOrBelowMinus20Pct: number;
    atOrBelowMinus30Pct: number;
  };
  entryParity: {
    baselineExecutedEntries: number;
    reproducedEntries: number;
    exact: boolean;
    shortfallCount: number;
    shortfallEur: number;
    mismatches: string[];
  };
  portfolioConstraints: {
    maxAllowedPositions: number;
    maxObservedPositions: number;
    cashNeverNegative: boolean;
  };
  deltaVsCurrentPolicy: {
    finalValueEur: number;
    returnPctPoints: number;
    maxDrawdownPctPoints: number;
    feesEur: number;
    estimatedTaxEur: number;
    turnoverEur: number;
  };
  trades: Array<{
    id: string;
    source: 'POLICY_ENTRY' | 'TREND_PROTECTION_V2';
    signalDate: string;
    executionDate: string;
    assetId: string;
    ticker: string;
    action: 'BUY' | 'ADD' | 'REDUCE' | 'EXIT';
    unitsDelta: number;
    notionalEur: number;
    feeEur: number;
    realizedGainEur: number;
    realizedReturnPct: number | null;
    estimatedTaxEur: number;
    taxDeferredTransferEur: number;
    executionPriceEur: number;
    positionReturnPctAtSignal: number | null;
    positionMfePctAtSignal: number | null;
    givebackFromMfePctPointsAtSignal: number | null;
    profitCaptureRatioPct: number | null;
    reason: string;
  }>;
  equityPath: DynamicHistoricalReplayResult['equityPath'];
  notes: string[];
}

function maxPositionsForRisk(risk: InvestorRiskProfile): number {
  if (risk === 'LOW') return 8;
  if (risk === 'HIGH') return 16;
  return 12;
}

function executedEntries(result: DynamicHistoricalReplayResult): DynamicReplaySignal[] {
  return result.signals.filter(signal => signal.executed && signal.executionDate && (signal.action === 'BUY' || signal.action === 'ADD') && signal.unitsDelta > 0);
}

function entrySignature(signal: DynamicReplaySignal): string {
  return [
    signal.signalDate,
    signal.executionDate ?? '',
    signal.assetId,
    signal.action,
    signal.unitsDelta.toFixed(8),
    signal.notionalEur.toFixed(4)
  ].join('|');
}

function entryParity(baseline: DynamicHistoricalReplayResult, v2: DynamicHistoricalReplayResult) {
  const base = executedEntries(baseline);
  const next = executedEntries(v2);
  const available = new Map<string, number>();
  for (const signal of next) {
    const signature = entrySignature(signal);
    available.set(signature, (available.get(signature) ?? 0) + 1);
  }
  let matched = 0;
  const missing: DynamicReplaySignal[] = [];
  for (const signal of base) {
    const signature = entrySignature(signal);
    const count = available.get(signature) ?? 0;
    if (count > 0) {
      matched++;
      available.set(signature, count - 1);
    } else missing.push(signal);
  }
  const extras: string[] = [];
  for (const signal of next) {
    const signature = entrySignature(signal);
    const count = available.get(signature) ?? 0;
    if (count <= 0) continue;
    extras.push(`V2_EXTRA:${signal.executionDate}:${signal.assetId}:${signal.action}:${signal.notionalEur.toFixed(2)}`);
    available.set(signature, count - 1);
  }
  const mismatches = [
    ...missing.map(signal => `BASELINE_ONLY:${signal.executionDate}:${signal.assetId}:${signal.action}:${signal.notionalEur.toFixed(2)}`),
    ...extras
  ];
  return {
    baselineExecutedEntries: base.length,
    reproducedEntries: matched,
    exact: matched === base.length && next.length === base.length,
    shortfallCount: missing.length,
    shortfallEur: missing.reduce((sum, signal) => sum + signal.notionalEur + signal.feeEur, 0),
    mismatches: mismatches.slice(0, 100)
  };
}

function maxObservedPositions(result: DynamicHistoricalReplayResult): number {
  const byDate = new Map<string, DynamicReplaySignal[]>();
  for (const signal of result.signals.filter(signal => signal.executed && signal.executionDate && signal.unitsDelta !== 0)) {
    byDate.set(signal.executionDate!, [...(byDate.get(signal.executionDate!) ?? []), signal]);
  }
  const units = new Map<string, number>();
  let maximum = 0;
  for (const date of [...byDate.keys()].sort()) {
    const day = [...(byDate.get(date) ?? [])].sort((a, b) => {
      const rank = (signal: DynamicReplaySignal) => signal.unitsDelta < 0 ? 0 : 1;
      return rank(a) - rank(b);
    });
    for (const signal of day) {
      const next = Math.max(0, (units.get(signal.assetId) ?? 0) + signal.unitsDelta);
      if (next <= 1e-10) units.delete(signal.assetId); else units.set(signal.assetId, next);
    }
    maximum = Math.max(maximum, units.size);
  }
  return maximum;
}

function turnover(result: DynamicHistoricalReplayResult): number {
  return result.signals.filter(signal => signal.executed).reduce((sum, signal) => sum + Math.max(0, signal.notionalEur), 0);
}

function v2Tag(signal: DynamicReplaySignal): TrendProtectionV2Action | null {
  const match = signal.reason.match(/\[TREND_PROTECTION_V2:(HOLD|WATCH|PROTECT|REDUCE|EXIT)\]/);
  return match ? match[1] as TrendProtectionV2Action : null;
}

export function buildTrendProtectionV2ReplayComparison(input: {
  baseline: DynamicHistoricalReplayResult;
  v2: DynamicHistoricalReplayResult;
  riskProfile: InvestorRiskProfile;
}): TrendProtectionV2ReplayComparison {
  const { baseline, v2 } = input;
  const parity = entryParity(baseline, v2);
  const maxAllowedPositions = maxPositionsForRisk(input.riskProfile);
  const observed = maxObservedPositions(v2);
  const cashNeverNegative = v2.equityPath.every(point => point.cashEur >= -1e-6);
  const valid = Number.isFinite(v2.finalValueEur)
    && Number.isFinite(v2.totalReturnPct)
    && Number.isFinite(v2.decisionPathMaxDrawdownPct)
    && cashNeverNegative
    && observed <= maxAllowedPositions;

  const actionCounts: Record<TrendProtectionV2Action, number> = { HOLD: 0, WATCH: 0, PROTECT: 0, REDUCE: 0, EXIT: 0 };
  for (const signal of v2.signals) {
    const tag = v2Tag(signal);
    if (tag) actionCounts[tag] += 1;
  }

  const executed = v2.signals.filter(signal => signal.executed && signal.executionDate && ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action));
  const management = executed.filter(signal => signal.action === 'REDUCE' || signal.action === 'EXIT');
  const capture = management
    .map(signal => profitCaptureRatioPct(signal.positionCurrentReturnPct ?? null, signal.positionMfePct ?? null))
    .filter((value): value is number => value != null && Number.isFinite(value));
  const trades = executed.map(signal => {
    const realizedReturnPct = signal.positionCurrentReturnPct ?? null;
    const mfePct = signal.positionMfePct ?? null;
    return {
      id: signal.id,
      source: signal.action === 'BUY' || signal.action === 'ADD' ? 'POLICY_ENTRY' as const : 'TREND_PROTECTION_V2' as const,
      signalDate: signal.signalDate,
      executionDate: signal.executionDate!,
      assetId: signal.assetId,
      ticker: signal.ticker,
      action: signal.action as 'BUY' | 'ADD' | 'REDUCE' | 'EXIT',
      unitsDelta: signal.unitsDelta,
      notionalEur: signal.notionalEur,
      feeEur: signal.feeEur,
      realizedGainEur: signal.realizedGainEur,
      realizedReturnPct,
      estimatedTaxEur: signal.estimatedTaxEur,
      taxDeferredTransferEur: signal.taxDeferredTransferEur,
      executionPriceEur: signal.executionPriceEur ?? 0,
      positionReturnPctAtSignal: signal.positionCurrentReturnPct ?? null,
      positionMfePctAtSignal: mfePct,
      givebackFromMfePctPointsAtSignal: signal.positionGivebackFromMfePctPoints ?? null,
      profitCaptureRatioPct: profitCaptureRatioPct(realizedReturnPct, mfePct),
      reason: signal.reason
    };
  });

  const v2Turnover = turnover(v2);
  const baselineTurnover = turnover(baseline);
  const managementTurnoverEur = management.reduce((sum, signal) => sum + signal.notionalEur, 0);
  const lossBasis = management.map(signal => signal.positionCurrentReturnPct ?? Infinity);

  return {
    policy: 'TREND_PROTECTION_V2',
    methodology: 'FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE',
    valid,
    startDate: v2.startDate,
    endDate: v2.endDate,
    initialCapitalEur: v2.initialCapitalEur,
    finalValueEur: v2.finalValueEur,
    totalReturnPct: v2.totalReturnPct,
    maxDrawdownPct: v2.decisionPathMaxDrawdownPct,
    totalFeesEur: v2.totalFeesEur,
    totalEstimatedTaxEur: v2.totalEstimatedTaxEur,
    totalTransferredEur: v2.totalTransferredEur,
    cashInterestEur: v2.cashInterestEur,
    turnoverEur: v2Turnover,
    managementTurnoverEur,
    executedReductions: v2.executedReductions,
    executedExits: v2.executedExits,
    actionCounts,
    averageProfitCaptureRatioPct: capture.length ? capture.reduce((sum, value) => sum + value, 0) / capture.length : null,
    realizedManagementGainEur: management.reduce((sum, signal) => sum + signal.realizedGainEur, 0),
    lossSaleCounts: {
      atOrBelowMinus10Pct: lossBasis.filter(value => value <= -10).length,
      atOrBelowMinus20Pct: lossBasis.filter(value => value <= -20).length,
      atOrBelowMinus30Pct: lossBasis.filter(value => value <= -30).length
    },
    entryParity: parity,
    portfolioConstraints: {
      maxAllowedPositions,
      maxObservedPositions: observed,
      cashNeverNegative
    },
    deltaVsCurrentPolicy: {
      finalValueEur: v2.finalValueEur - baseline.finalValueEur,
      returnPctPoints: v2.totalReturnPct - baseline.totalReturnPct,
      maxDrawdownPctPoints: v2.decisionPathMaxDrawdownPct - baseline.decisionPathMaxDrawdownPct,
      feesEur: v2.totalFeesEur - baseline.totalFeesEur,
      estimatedTaxEur: v2.totalEstimatedTaxEur - baseline.totalEstimatedTaxEur,
      turnoverEur: v2Turnover - baselineTurnover
    },
    trades,
    equityPath: v2.equityPath,
    notes: [
      'A/B económico principal: dos replays completos y causalmente ejecutables con el mismo universo, scanner, Entry Timing, sizing, CORE_GATE_V1, cash inicial y límites de plazas. CURRENT_POLICY y TREND_PROTECTION_V2 sólo difieren en la protección de posiciones.',
      'La paridad de entradas es diagnóstica, no un requisito de validez: después de una diferencia de gestión, cash y plazas pueden cambiar y causar entradas distintas. Esa divergencia es una consecuencia económica real de la política, no financiación inventada.',
      'valid=true exige trayectoria finita, cash nunca negativo y respeto del máximo de posiciones del perfil. No se permite deuda ni una 13.ª plaza en MEDIUM.',
      'El antiguo FIXED_BASELINE_ENTRIES se conserva sólo como diagnóstico de atribución y puede quedar invalidado cuando una venta baseline financia una entrada posterior o cuando conservar incumbents llenaría más plazas.'
    ]
  };
}
