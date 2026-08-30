import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import { DynamicHistoricalReplayEngine, type DynamicHistoricalReplayResult } from './dynamicHistoricalReplay';
import type { InvestmentHorizonYears, InvestorRiskProfile } from './types';
import type { SpanishTaxSettings } from './spanishTaxModel';

export interface DynamicReplayBatchCase {
  startDate: string;
  monthly: DynamicHistoricalReplayResult;
  dailyStress: DynamicHistoricalReplayResult | null;
}

export interface DynamicReplayBatchSummary {
  requestedStartDates: number;
  successfulMonthlyCases: number;
  comparableStaticCases: number;
  monthlyBeatsCashCases: number;
  monthlyBeatsStaticCases: number;
  monthlyBeatsCashPct: number;
  monthlyBeatsStaticPct: number | null;
  monthlyMedianReturnPct: number | null;
  monthlyMedianExcessVsStaticPctPoints: number | null;
  monthlyWorstExcessVsStaticPctPoints: number | null;
  monthlyMedianDrawdownPct: number | null;
  monthlyDefensiveSignalCases: number;
  monthlyExecutedDefensiveCases: number;
  dailyStressCases: number;
  dailyBetterThanMonthlyCases: number;
  dailyReducedDrawdownCases: number;
  dailyDefensiveSignalCases: number;
}

export interface DynamicReplayBatchResult {
  startDates: string[];
  cases: DynamicReplayBatchCase[];
  summary: DynamicReplayBatchSummary;
  notes: string[];
}

function isoDate(timestamp: string): string { return timestamp.slice(0, 10); }
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function hasDefensiveSignal(result: DynamicHistoricalReplayResult): boolean {
  return result.signals.some(signal => signal.action === 'REDUCE' || signal.action === 'EXIT');
}
function hasExecutedDefensiveSignal(result: DynamicHistoricalReplayResult): boolean {
  return result.executedReductions + result.executedExits > 0;
}
function pct(count: number, total: number): number { return total > 0 ? count / total * 100 : 0; }

/**
 * Selects broadly distributed historical entry dates without inspecting returns.
 * The selection depends only on chronology/history availability, never on outcomes.
 */
export function selectDynamicReplayBatchStartDates(
  dataset: MultiAssetDataset,
  options: { minimumBars?: number; minimumForwardSessions?: number; maxCases?: number } = {}
): string[] {
  const minimumBars = options.minimumBars ?? 252;
  const minimumForwardSessions = options.minimumForwardSessions ?? 126;
  const maxCases = Math.max(2, options.maxCases ?? 20);
  const sessions = [...new Set(dataset.assets.flatMap(asset => asset.bars.map(bar => isoDate(bar.timestamp))))].sort();
  if (sessions.length <= minimumForwardSessions) return [];

  const eligible = sessions.slice(0, Math.max(0, sessions.length - minimumForwardSessions)).filter(date =>
    dataset.assets.some(asset => asset.bars.filter(bar => isoDate(bar.timestamp) <= date).length >= minimumBars)
  );
  if (!eligible.length) return [];
  if (eligible.length <= maxCases) return eligible;

  const out: string[] = [];
  for (let i = 0; i < maxCases; i++) {
    const index = Math.round(i * (eligible.length - 1) / (maxCases - 1));
    const date = eligible[index];
    if (date && out.at(-1) !== date) out.push(date);
  }
  return out;
}

export function summarizeDynamicReplayBatch(startDates: string[], cases: DynamicReplayBatchCase[]): DynamicReplayBatchSummary {
  const monthly = cases.map(row => row.monthly);
  const comparable = monthly.filter(result => result.excessReturnVsStaticPctPoints != null);
  const monthlyBeatsCashCases = monthly.filter(result => result.excessFinalEurVsCash > 0).length;
  const monthlyBeatsStaticCases = comparable.filter(result => (result.excessFinalEurVsStatic ?? 0) > 0).length;
  const dailyCases = cases.filter(row => row.dailyStress != null);
  return {
    requestedStartDates: startDates.length,
    successfulMonthlyCases: monthly.length,
    comparableStaticCases: comparable.length,
    monthlyBeatsCashCases,
    monthlyBeatsStaticCases,
    monthlyBeatsCashPct: pct(monthlyBeatsCashCases, monthly.length),
    monthlyBeatsStaticPct: comparable.length ? pct(monthlyBeatsStaticCases, comparable.length) : null,
    monthlyMedianReturnPct: median(monthly.map(result => result.totalReturnPct)),
    monthlyMedianExcessVsStaticPctPoints: median(comparable.map(result => result.excessReturnVsStaticPctPoints!)),
    monthlyWorstExcessVsStaticPctPoints: comparable.length ? Math.min(...comparable.map(result => result.excessReturnVsStaticPctPoints!)) : null,
    monthlyMedianDrawdownPct: median(monthly.map(result => result.decisionPathMaxDrawdownPct)),
    monthlyDefensiveSignalCases: monthly.filter(hasDefensiveSignal).length,
    monthlyExecutedDefensiveCases: monthly.filter(hasExecutedDefensiveSignal).length,
    dailyStressCases: dailyCases.length,
    dailyBetterThanMonthlyCases: dailyCases.filter(row => row.dailyStress!.finalValueEur > row.monthly.finalValueEur + 0.01).length,
    dailyReducedDrawdownCases: dailyCases.filter(row => row.dailyStress!.decisionPathMaxDrawdownPct + 1e-9 < row.monthly.decisionPathMaxDrawdownPct).length,
    dailyDefensiveSignalCases: dailyCases.filter(row => hasDefensiveSignal(row.dailyStress!)).length
  };
}

export class DynamicHistoricalReplayBatchEngine {
  static run(input: {
    dataset: MultiAssetDataset;
    catalog: AssetUniverseItem[];
    initialCapitalEur: number;
    riskProfile: InvestorRiskProfile;
    horizonYears: InvestmentHorizonYears;
    cashBenchmarkAnnualPct: number;
    taxSettings?: SpanishTaxSettings;
    minimumBars?: number;
    maximumStartDates?: number;
    dailyStressCases?: number;
  }): DynamicReplayBatchResult {
    const minimumBars = input.minimumBars ?? 252;
    const startDates = selectDynamicReplayBatchStartDates(input.dataset, {
      minimumBars,
      minimumForwardSessions: 126,
      maxCases: input.maximumStartDates ?? 20
    });
    const monthlyRows: Array<{ startDate: string; monthly: DynamicHistoricalReplayResult }> = [];
    for (const startDate of startDates) {
      try {
        monthlyRows.push({
          startDate,
          monthly: DynamicHistoricalReplayEngine.run({
            dataset: input.dataset,
            catalog: input.catalog,
            startDate,
            frequency: 'MONTHLY',
            initialCapitalEur: input.initialCapitalEur,
            riskProfile: input.riskProfile,
            horizonYears: input.horizonYears,
            cashBenchmarkAnnualPct: input.cashBenchmarkAnnualPct,
            minimumBars,
            taxSettings: input.taxSettings
          })
        });
      } catch {
        // A date can be unusable because the causal gate leaves no executable history.
        // Keep the batch running; the requested/successful counts make this visible.
      }
    }

    const stressCount = Math.max(0, Math.min(input.dailyStressCases ?? 4, monthlyRows.length));
    const stressDates = new Set(
      [...monthlyRows]
        .sort((a, b) => b.monthly.decisionPathMaxDrawdownPct - a.monthly.decisionPathMaxDrawdownPct)
        .slice(0, stressCount)
        .map(row => row.startDate)
    );

    const cases: DynamicReplayBatchCase[] = monthlyRows.map(row => {
      let dailyStress: DynamicHistoricalReplayResult | null = null;
      if (stressDates.has(row.startDate)) {
        try {
          dailyStress = DynamicHistoricalReplayEngine.run({
            dataset: input.dataset,
            catalog: input.catalog,
            startDate: row.startDate,
            frequency: 'DAILY',
            initialCapitalEur: input.initialCapitalEur,
            riskProfile: input.riskProfile,
            horizonYears: input.horizonYears,
            cashBenchmarkAnnualPct: input.cashBenchmarkAnnualPct,
            minimumBars,
            taxSettings: input.taxSettings
          });
        } catch {
          dailyStress = null;
        }
      }
      return { ...row, dailyStress };
    });

    return {
      startDates,
      cases,
      summary: summarizeDynamicReplayBatch(startDates, cases),
      notes: [
        'Las fechas se seleccionan por disponibilidad cronológica, no por rentabilidad observada.',
        'La batería principal usa MONTHLY para cubrir muchas fechas sin multiplicar ruido operativo.',
        'DAILY se repite únicamente en los casos con mayor drawdown mensual como stress diagnóstico; no se usa para ajustar parámetros.',
        'Cada caso compara seguir todos los avisos contra cash y contra congelar exactamente la primera cartera ejecutada.',
        'Un buen resultado aislado no valida el motor: importan la mediana, el peor caso y la proporción de fechas favorables.'
      ]
    };
  }
}
