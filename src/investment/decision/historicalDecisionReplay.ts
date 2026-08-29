import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import { InvestmentDecisionEngine } from './investmentDecisionEngine';
import type { InvestmentHorizonYears, InvestorRiskProfile } from './types';
import { allCashBenchmark } from './remuneratedCash';
import { brokerCommission } from './costAwareExecutionPolicy';
import { DEFAULT_CASH_BENCHMARK_ANNUAL_PCT } from './cashBenchmark';

export type HistoricalReplayFrequency = 'ANNUAL' | 'QUARTERLY';

export interface HistoricalDecisionReplayLine {
  assetId: string;
  ticker: string;
  instrumentType: 'ETF_ETC' | 'MUTUAL_FUND';
  targetWeight: number;
  allocatedEur: number;
  entryDate: string | null;
  entryPriceEur: number | null;
  latestPriceEur: number | null;
  units: number;
  feeEur: number;
  residualCashFinalEur: number;
  finalValueEur: number;
  returnPct: number | null;
}

export interface HistoricalDecisionReplayCase {
  requestedDate: string;
  decisionDate: string;
  executionDate: string | null;
  endDate: string;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  method: string;
  regime: string;
  initialCapitalEur: number;
  finalValueEur: number;
  totalReturnPct: number;
  allCashFinalEur: number;
  allCashReturnPct: number;
  excessFinalEurVsCash: number;
  excessReturnVsCashPctPoints: number;
  beatsCash: boolean;
  cashBenchmarkAnnualPct: number;
  cashTargetWeight: number;
  eligibleAssets: number;
  allocations: HistoricalDecisionReplayLine[];
  summary: string;
}

export interface HistoricalDecisionReplayBatchResult {
  cases: HistoricalDecisionReplayCase[];
  requestedDates: string[];
  successfulCases: number;
  beatsCashCases: number;
  beatsCashPct: number;
  medianReturnPct: number | null;
  medianExcessPctPoints: number | null;
  bestCase: HistoricalDecisionReplayCase | null;
  worstCase: HistoricalDecisionReplayCase | null;
  notes: string[];
}

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sliceForDecision(dataset: MultiAssetDataset, requestedDate: string, minimumBars = 252): MultiAssetDataset {
  const assets = dataset.assets.map(asset => ({
    ...asset,
    bars: asset.bars.filter(bar => isoDate(bar.timestamp) <= requestedDate)
  })).filter(asset => asset.bars.length >= minimumBars);
  return { ...dataset, assets };
}

function latestDatasetDate(dataset: MultiAssetDataset): string {
  const dates = dataset.assets.flatMap(asset => asset.bars.slice(-1).map(bar => isoDate(bar.timestamp))).sort();
  if (!dates.length) throw new Error('No hay barras en el dataset para replay histórico.');
  return dates[dates.length - 1];
}

function assetById(dataset: MultiAssetDataset, assetId: string) {
  return dataset.assets.find(asset => asset.assetId === assetId) ?? null;
}

function catalogType(catalog: AssetUniverseItem[], assetId: string): 'ETF_ETC' | 'MUTUAL_FUND' {
  return catalog.find(asset => asset.assetId === assetId)?.instrumentType ?? 'ETF_ETC';
}

function replayOne(input: {
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
  requestedDate: string;
  initialCapitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
  cashBenchmarkAnnualPct: number;
  minimumBars: number;
}): HistoricalDecisionReplayCase | null {
  const historical = sliceForDecision(input.dataset, input.requestedDate, input.minimumBars);
  if (historical.assets.length < 2) return null;

  const decision = InvestmentDecisionEngine.decide(
    historical,
    { capitalEur: input.initialCapitalEur, riskProfile: input.riskProfile, horizonYears: input.horizonYears },
    new Date(`${input.requestedDate}T23:59:59Z`)
  );
  const endDate = latestDatasetDate(input.dataset);
  if (decision.asOfDate >= endDate) return null;

  const allocations: HistoricalDecisionReplayLine[] = [];
  let firstExecutionDate: string | null = null;
  let finalInvested = 0;

  for (const recommendation of decision.assets.filter(asset => asset.weight > 1e-8)) {
    const full = assetById(input.dataset, recommendation.assetId);
    const allocatedEur = input.initialCapitalEur * recommendation.weight;
    if (!full) {
      allocations.push({ assetId: recommendation.assetId, ticker: recommendation.ticker, instrumentType: 'ETF_ETC', targetWeight: recommendation.weight, allocatedEur, entryDate: null, entryPriceEur: null, latestPriceEur: null, units: 0, feeEur: 0, residualCashFinalEur: allocatedEur, finalValueEur: allocatedEur, returnPct: null });
      finalInvested += allocatedEur;
      continue;
    }
    const bars = [...full.bars].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const entry = bars.find(bar => isoDate(bar.timestamp) > decision.asOfDate) ?? null;
    const latest = bars.at(-1) ?? null;
    const instrumentType = catalogType(input.catalog, recommendation.assetId);
    if (!entry || !latest || !(entry.open > 0) || !(latest.close > 0)) {
      allocations.push({ assetId: recommendation.assetId, ticker: recommendation.ticker, instrumentType, targetWeight: recommendation.weight, allocatedEur, entryDate: null, entryPriceEur: null, latestPriceEur: null, units: 0, feeEur: 0, residualCashFinalEur: allocatedEur, finalValueEur: allocatedEur, returnPct: null });
      finalInvested += allocatedEur;
      continue;
    }

    const entryDate = isoDate(entry.timestamp);
    if (!firstExecutionDate || entryDate < firstExecutionDate) firstExecutionDate = entryDate;
    if (instrumentType === 'MUTUAL_FUND') {
      const units = allocatedEur / entry.open;
      const finalValueEur = units * latest.close;
      allocations.push({ assetId: recommendation.assetId, ticker: recommendation.ticker, instrumentType, targetWeight: recommendation.weight, allocatedEur, entryDate, entryPriceEur: entry.open, latestPriceEur: latest.close, units, feeEur: 0, residualCashFinalEur: 0, finalValueEur, returnPct: allocatedEur > 0 ? (finalValueEur / allocatedEur - 1) * 100 : 0 });
      finalInvested += finalValueEur;
      continue;
    }

    let units = Math.floor(allocatedEur / entry.open);
    let feeEur = units > 0 ? brokerCommission(units * entry.open) : 0;
    while (units > 0 && units * entry.open + feeEur > allocatedEur + 1e-9) {
      units--;
      feeEur = units > 0 ? brokerCommission(units * entry.open) : 0;
    }
    const spent = units * entry.open + feeEur;
    const residualInitial = Math.max(0, allocatedEur - spent);
    const residualCashFinalEur = allCashBenchmark(residualInitial, input.cashBenchmarkAnnualPct, entryDate, endDate).finalEur;
    const finalValueEur = units * latest.close + residualCashFinalEur;
    allocations.push({ assetId: recommendation.assetId, ticker: recommendation.ticker, instrumentType, targetWeight: recommendation.weight, allocatedEur, entryDate, entryPriceEur: entry.open, latestPriceEur: latest.close, units, feeEur, residualCashFinalEur, finalValueEur, returnPct: allocatedEur > 0 ? (finalValueEur / allocatedEur - 1) * 100 : 0 });
    finalInvested += finalValueEur;
  }

  const explicitCashInitial = input.initialCapitalEur * decision.cashWeight;
  const explicitCashFinal = allCashBenchmark(explicitCashInitial, input.cashBenchmarkAnnualPct, decision.asOfDate, endDate).finalEur;
  const finalValueEur = finalInvested + explicitCashFinal;
  const totalReturnPct = (finalValueEur / input.initialCapitalEur - 1) * 100;
  const allCash = allCashBenchmark(input.initialCapitalEur, input.cashBenchmarkAnnualPct, decision.asOfDate, endDate);
  const excessFinalEurVsCash = finalValueEur - allCash.finalEur;
  const excessReturnVsCashPctPoints = totalReturnPct - allCash.returnPct;
  const top = allocations.filter(x => x.targetWeight > 0.01).sort((a, b) => b.targetWeight - a.targetWeight).slice(0, 3).map(x => `${x.ticker} ${(x.targetWeight * 100).toFixed(0)}%`).join(' + ');

  return {
    requestedDate: input.requestedDate,
    decisionDate: decision.asOfDate,
    executionDate: firstExecutionDate,
    endDate,
    riskProfile: input.riskProfile,
    horizonYears: input.horizonYears,
    method: decision.recommendedMethod,
    regime: decision.marketRegime,
    initialCapitalEur: input.initialCapitalEur,
    finalValueEur,
    totalReturnPct,
    allCashFinalEur: allCash.finalEur,
    allCashReturnPct: allCash.returnPct,
    excessFinalEurVsCash,
    excessReturnVsCashPctPoints,
    beatsCash: excessFinalEurVsCash > 0,
    cashBenchmarkAnnualPct: input.cashBenchmarkAnnualPct,
    cashTargetWeight: decision.cashWeight,
    eligibleAssets: historical.assets.length,
    allocations,
    summary: `${decision.asOfDate}: ${top || 'sin activos de riesgo'} · efectivo ${(decision.cashWeight * 100).toFixed(0)}% · ${decision.recommendedMethod}.`
  };
}

export function historicalStartDates(dataset: MultiAssetDataset, frequency: HistoricalReplayFrequency = 'ANNUAL'): string[] {
  const dates = dataset.assets.flatMap(asset => asset.bars.map(bar => isoDate(bar.timestamp))).sort();
  if (!dates.length) return [];
  const firstYear = Number(dates[0].slice(0, 4)) + 1;
  const lastYear = Number(dates[dates.length - 1].slice(0, 4));
  const months = frequency === 'ANNUAL' ? [1] : [1, 4, 7, 10];
  const out: string[] = [];
  for (let year = firstYear; year <= lastYear; year++) for (const month of months) {
    const d = `${year}-${String(month).padStart(2, '0')}-01`;
    if (d < dates[dates.length - 1]) out.push(d);
  }
  return out;
}

export class HistoricalDecisionReplayEngine {
  static run(input: {
    dataset: MultiAssetDataset;
    catalog: AssetUniverseItem[];
    requestedDates?: string[];
    frequency?: HistoricalReplayFrequency;
    initialCapitalEur: number;
    riskProfile: InvestorRiskProfile;
    horizonYears: InvestmentHorizonYears;
    cashBenchmarkAnnualPct?: number;
    minimumBars?: number;
  }): HistoricalDecisionReplayBatchResult {
    if (!(input.initialCapitalEur > 0)) throw new Error('El capital del replay histórico debe ser > 0.');
    const cashBenchmarkAnnualPct = Number.isFinite(input.cashBenchmarkAnnualPct) ? Math.max(0, Number(input.cashBenchmarkAnnualPct)) : DEFAULT_CASH_BENCHMARK_ANNUAL_PCT;
    const requestedDates = input.requestedDates?.length ? [...input.requestedDates] : historicalStartDates(input.dataset, input.frequency ?? 'ANNUAL');
    const cases = requestedDates.map(requestedDate => replayOne({ ...input, requestedDate, cashBenchmarkAnnualPct, minimumBars: input.minimumBars ?? 252 })).filter(Boolean) as HistoricalDecisionReplayCase[];
    const bestCase = [...cases].sort((a, b) => b.excessReturnVsCashPctPoints - a.excessReturnVsCashPctPoints)[0] ?? null;
    const worstCase = [...cases].sort((a, b) => a.excessReturnVsCashPctPoints - b.excessReturnVsCashPctPoints)[0] ?? null;
    const beatsCashCases = cases.filter(c => c.beatsCash).length;
    return {
      cases,
      requestedDates,
      successfulCases: cases.length,
      beatsCashCases,
      beatsCashPct: cases.length ? beatsCashCases / cases.length * 100 : 0,
      medianReturnPct: median(cases.map(c => c.totalReturnPct)),
      medianExcessPctPoints: median(cases.map(c => c.excessReturnVsCashPctPoints)),
      bestCase,
      worstCase,
      notes: [
        'Cada decisión usa exclusivamente datos disponibles hasta la fecha solicitada; la ejecución empieza en la siguiente barra disponible.',
        'Los activos sin el mínimo de historia causal quedan excluidos de esa fecha.',
        'ETFs usan títulos enteros y comisión MyInvestor modelada; fondos usan unidades fraccionarias.',
        'El efectivo objetivo y el residual se comparan con la referencia remunerada sobre las mismas fechas.',
        'Este replay mantiene la recomendación inicial hasta el final; no simula todavía seguir todas las recomendaciones posteriores.'
      ]
    };
  }
}
