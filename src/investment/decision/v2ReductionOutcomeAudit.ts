import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { TrendProtectionV2ReplayComparison } from './trendProtectionReplayComparison';

export type V2ReductionCause = 'WINNER_PROTECTION' | 'LOSER_FAILURE' | 'OTHER';

export interface V2ReductionOutcomeRow {
  assetId: string;
  ticker: string;
  signalDate: string;
  executionDate: string;
  cause: V2ReductionCause;
  notionalEur: number;
  executionPriceEur: number;
  positionReturnPctAtSignal: number | null;
  positionMfePctAtSignal: number | null;
  givebackFromMfePctPointsAtSignal: number | null;
  feeEur: number;
  estimatedTaxEur: number;
  realizedFrictionEur: number;
  forward20SessionsReturnPct: number | null;
  forward60SessionsReturnPct: number | null;
  forwardToEndReturnPct: number | null;
  maxAdverse20SessionsPct: number | null;
  maxAdverse60SessionsPct: number | null;
  maxAdverseToEndPct: number | null;
  maxFavorable20SessionsPct: number | null;
  maxFavorable60SessionsPct: number | null;
  maxFavorableToEndPct: number | null;
  markToMarketProtectionProxy20Eur: number | null;
  markToMarketProtectionProxy60Eur: number | null;
  markToMarketProtectionProxyToEndEur: number | null;
  reason: string;
}

export interface V2ReductionOutcomeAudit {
  policy: 'V2_REDUCTION_OUTCOME_AUDIT_V1';
  methodology: 'EX_POST_DIAGNOSTIC_ONLY_NEVER_DECISION_INPUT';
  valid: boolean;
  reductions: number;
  rows: V2ReductionOutcomeRow[];
  aggregate: {
    totalReducedNotionalEur: number;
    totalRealizedFrictionEur: number;
    rowsWith20Sessions: number;
    rowsWith60Sessions: number;
    rowsWithEndMark: number;
    sumMarkToMarketProtectionProxy20Eur: number | null;
    sumMarkToMarketProtectionProxy60Eur: number | null;
    sumMarkToMarketProtectionProxyToEndEur: number | null;
    winnerProtectionReductions: number;
    loserFailureReductions: number;
    otherReductions: number;
  };
  notes: string[];
}

type V2Trade = TrendProtectionV2ReplayComparison['trades'][number];

type DatasetAsset = MultiAssetDataset['assets'][number];

function causeFromReason(reason: string): V2ReductionCause {
  if (/Protecci[oó]n de beneficio/i.test(reason)) return 'WINNER_PROTECTION';
  if (/Tesis fallida/i.test(reason)) return 'LOSER_FAILURE';
  return 'OTHER';
}

function assetSeries(dataset: MultiAssetDataset, assetId: string, ticker: string): DatasetAsset | null {
  const normalizedTicker = ticker.toUpperCase();
  return dataset.assets.find(asset => asset.assetId === assetId)
    ?? dataset.assets.find(asset => asset.ticker.toUpperCase() === normalizedTicker)
    ?? null;
}

function finitePositive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function returnPct(referencePrice: number, futurePrice: number | null): number | null {
  return futurePrice != null && referencePrice > 0
    ? (futurePrice / referencePrice - 1) * 100
    : null;
}

function extremaPct(referencePrice: number, values: number[]): { adverse: number | null; favorable: number | null } {
  if (!(referencePrice > 0) || !values.length) return { adverse: null, favorable: null };
  const returns = values.map(value => (value / referencePrice - 1) * 100);
  return {
    adverse: Math.min(...returns),
    favorable: Math.max(...returns)
  };
}

function protectionProxyEur(notionalEur: number, forwardReturnPct: number | null, frictionEur: number): number | null {
  if (forwardReturnPct == null || !Number.isFinite(forwardReturnPct)) return null;
  // Positive => selling the reduced notional outperformed simply holding that same notional
  // mark-to-market through the horizon, after immediate fee + estimated tax friction.
  return -(notionalEur * forwardReturnPct / 100) - frictionEur;
}

function horizonOutcome(input: {
  asset: DatasetAsset | null;
  executionDate: string;
  executionPriceEur: number;
  sessions: number | null;
}) {
  const { asset, executionDate, executionPriceEur, sessions } = input;
  if (!asset || !(executionPriceEur > 0)) {
    return { forwardReturnPct: null, adversePct: null, favorablePct: null };
  }
  const bars = asset.bars
    .filter(bar => bar.timestamp.slice(0, 10) >= executionDate && Number.isFinite(bar.close) && bar.close > 0)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (!bars.length) return { forwardReturnPct: null, adversePct: null, favorablePct: null };

  const requestedIndex = sessions == null ? bars.length - 1 : sessions;
  if (sessions != null && bars.length <= requestedIndex) {
    return { forwardReturnPct: null, adversePct: null, favorablePct: null };
  }
  const horizonIndex = Math.min(requestedIndex, bars.length - 1);
  const closes = bars.slice(0, horizonIndex + 1).map(bar => bar.close).filter((value): value is number => Number.isFinite(value) && value > 0);
  const terminal = finitePositive(bars[horizonIndex]?.close ?? null);
  const extrema = extremaPct(executionPriceEur, closes);
  return {
    forwardReturnPct: returnPct(executionPriceEur, terminal),
    adversePct: extrema.adverse,
    favorablePct: extrema.favorable
  };
}

function reductionRow(dataset: MultiAssetDataset, trade: V2Trade): V2ReductionOutcomeRow {
  const asset = assetSeries(dataset, trade.assetId, trade.ticker);
  const executionPriceEur = finitePositive(trade.executionPriceEur) ?? 0;
  const outcome20 = horizonOutcome({ asset, executionDate: trade.executionDate, executionPriceEur, sessions: 20 });
  const outcome60 = horizonOutcome({ asset, executionDate: trade.executionDate, executionPriceEur, sessions: 60 });
  const outcomeEnd = horizonOutcome({ asset, executionDate: trade.executionDate, executionPriceEur, sessions: null });
  const friction = Math.max(0, trade.feeEur) + Math.max(0, trade.estimatedTaxEur);

  return {
    assetId: trade.assetId,
    ticker: trade.ticker,
    signalDate: trade.signalDate,
    executionDate: trade.executionDate,
    cause: causeFromReason(trade.reason),
    notionalEur: trade.notionalEur,
    executionPriceEur,
    positionReturnPctAtSignal: trade.positionReturnPctAtSignal,
    positionMfePctAtSignal: trade.positionMfePctAtSignal,
    givebackFromMfePctPointsAtSignal: trade.givebackFromMfePctPointsAtSignal,
    feeEur: trade.feeEur,
    estimatedTaxEur: trade.estimatedTaxEur,
    realizedFrictionEur: friction,
    forward20SessionsReturnPct: outcome20.forwardReturnPct,
    forward60SessionsReturnPct: outcome60.forwardReturnPct,
    forwardToEndReturnPct: outcomeEnd.forwardReturnPct,
    maxAdverse20SessionsPct: outcome20.adversePct,
    maxAdverse60SessionsPct: outcome60.adversePct,
    maxAdverseToEndPct: outcomeEnd.adversePct,
    maxFavorable20SessionsPct: outcome20.favorablePct,
    maxFavorable60SessionsPct: outcome60.favorablePct,
    maxFavorableToEndPct: outcomeEnd.favorablePct,
    markToMarketProtectionProxy20Eur: protectionProxyEur(trade.notionalEur, outcome20.forwardReturnPct, friction),
    markToMarketProtectionProxy60Eur: protectionProxyEur(trade.notionalEur, outcome60.forwardReturnPct, friction),
    markToMarketProtectionProxyToEndEur: protectionProxyEur(trade.notionalEur, outcomeEnd.forwardReturnPct, friction),
    reason: trade.reason
  };
}

function finiteSum(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) : null;
}

/**
 * EX-POST audit only. Future prices are intentionally used to evaluate whether an
 * already executed V2 REDUCE subsequently protected capital or created opportunity
 * cost. This output must never be fed back into PortfolioDecisionEngine or any causal
 * signal/ranking/sizing policy.
 */
export function buildV2ReductionOutcomeAudit(input: {
  dataset: MultiAssetDataset;
  v2Comparison: TrendProtectionV2ReplayComparison;
}): V2ReductionOutcomeAudit {
  const trades = input.v2Comparison.trades.filter(trade => trade.action === 'REDUCE');
  const rows = trades.map(trade => reductionRow(input.dataset, trade));
  const winnerProtectionReductions = rows.filter(row => row.cause === 'WINNER_PROTECTION').length;
  const loserFailureReductions = rows.filter(row => row.cause === 'LOSER_FAILURE').length;
  const otherReductions = rows.length - winnerProtectionReductions - loserFailureReductions;
  const valid = rows.every(row =>
    Number.isFinite(row.notionalEur)
    && row.notionalEur >= 0
    && Number.isFinite(row.realizedFrictionEur)
    && row.realizedFrictionEur >= 0
  );

  return {
    policy: 'V2_REDUCTION_OUTCOME_AUDIT_V1',
    methodology: 'EX_POST_DIAGNOSTIC_ONLY_NEVER_DECISION_INPUT',
    valid,
    reductions: rows.length,
    rows,
    aggregate: {
      totalReducedNotionalEur: rows.reduce((sum, row) => sum + row.notionalEur, 0),
      totalRealizedFrictionEur: rows.reduce((sum, row) => sum + row.realizedFrictionEur, 0),
      rowsWith20Sessions: rows.filter(row => row.forward20SessionsReturnPct != null).length,
      rowsWith60Sessions: rows.filter(row => row.forward60SessionsReturnPct != null).length,
      rowsWithEndMark: rows.filter(row => row.forwardToEndReturnPct != null).length,
      sumMarkToMarketProtectionProxy20Eur: finiteSum(rows.map(row => row.markToMarketProtectionProxy20Eur)),
      sumMarkToMarketProtectionProxy60Eur: finiteSum(rows.map(row => row.markToMarketProtectionProxy60Eur)),
      sumMarkToMarketProtectionProxyToEndEur: finiteSum(rows.map(row => row.markToMarketProtectionProxyToEndEur)),
      winnerProtectionReductions,
      loserFailureReductions,
      otherReductions
    },
    notes: [
      'Auditoría EX POST: usa precios posteriores a la ejecución exclusivamente para evaluar la calidad histórica de REDUCE ya realizados. Está prohibido reutilizar estas métricas como input causal del motor.',
      'La proxy mark-to-market compara vender el notional reducido frente a mantener ese mismo notional hasta el horizonte, descontando comisión e impuesto estimado realizados en la venta. No es una descomposición exacta del P&L total de cartera ni modela fiscalidad futura del escenario hold.',
      'Retornos 20/60 se cuentan en sesiones disponibles desde la fecha de ejecución; si no existen suficientes sesiones antes del final del dataset quedan null. El horizonte final usa la última barra disponible del activo dentro del replay.'
    ]
  };
}
