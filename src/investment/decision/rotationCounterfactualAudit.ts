import type { MultiAssetDataset } from '../portfolioBacktesting/types';
import type { AssetUniverseItem } from './assetUniverse';
import { brokerCommission } from './costAwareExecutionPolicy';
import type { DynamicHistoricalReplayResult, DynamicReplaySignal } from './dynamicHistoricalReplay';

export type RotationCounterfactualHorizon = 'S5' | 'S20' | 'S60' | 'END';

export interface RotationCounterfactualOutcome {
  date: string | null;
  incumbentPct: number | null;
  challengerPct: number | null;
  corePct: number | null;
  challengerVsIncumbentPp: number | null;
  coreVsIncumbentPp: number | null;
}

export interface RotationCounterfactualAudit {
  version: 1;
  saleSignalId: string;
  signalDate: string;
  executionDate: string;
  incumbentAssetId: string;
  incumbentTicker: string;
  challengerAssetId: string;
  challengerTicker: string;
  coreAssetId: string | null;
  coreTicker: string | null;
  saleGrossEur: number;
  saleFeeEur: number;
  saleTaxEur: number;
  horizons: Record<RotationCounterfactualHorizon, RotationCounterfactualOutcome>;
  note: string;
}

const CORE_PRIORITY = [
  'FUND_VANGUARD_GLOBAL',
  'FUND_VANGUARD_ESG_DEVELOPED',
  'EUNL',
  'IWDA',
  'SXR8',
  'VUSA'
] as const;

const MARKER = '[ROTATION_CF_V1]';

function dateOf(timestamp: string): string { return timestamp.slice(0, 10); }
function finite(value: number): number | null { return Number.isFinite(value) ? value : null; }
function itemFor(catalog: AssetUniverseItem[], assetId: string): AssetUniverseItem | null {
  return catalog.find(item => item.assetId === assetId) ?? null;
}
function assetAvailableOn(dataset: MultiAssetDataset, assetId: string, date: string): boolean {
  const asset = dataset.assets.find(row => row.assetId === assetId);
  return Boolean(asset?.bars.some(bar => dateOf(bar.timestamp) <= date && bar.close > 0));
}
function chooseCoreAsset(dataset: MultiAssetDataset, catalog: AssetUniverseItem[], date: string): AssetUniverseItem | null {
  for (const assetId of CORE_PRIORITY) {
    const item = itemFor(catalog, assetId);
    if (item && assetAvailableOn(dataset, assetId, date)) return item;
  }
  return catalog
    .filter(item => item.category === 'GLOBAL_EQUITY' && !item.assetId.startsWith('EQ_') && assetAvailableOn(dataset, item.assetId, date))
    .sort((a, b) => a.assetId.localeCompare(b.assetId))[0] ?? null;
}
function barsFrom(dataset: MultiAssetDataset, assetId: string, executionDate: string, endDate: string) {
  const asset = dataset.assets.find(row => row.assetId === assetId);
  if (!asset) return [];
  return asset.bars
    .filter(bar => dateOf(bar.timestamp) >= executionDate && dateOf(bar.timestamp) <= endDate && bar.close > 0)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
function routeReturnAt(input: {
  dataset: MultiAssetDataset;
  assetId: string;
  executionDate: string;
  endDate: string;
  horizonSessions: number | null;
  startingCapitalEur: number;
  referenceGrossEur: number;
  entryFeeEur: number;
}): { date: string | null; pct: number | null } {
  const bars = barsFrom(input.dataset, input.assetId, input.executionDate, input.endDate);
  if (!bars.length || !(input.referenceGrossEur > 0) || !(input.startingCapitalEur >= 0)) return { date: null, pct: null };
  const entry = bars[0];
  const entryPrice = entry.open > 0 ? entry.open : entry.close;
  if (!(entryPrice > 0)) return { date: null, pct: null };
  const index = input.horizonSessions == null ? bars.length - 1 : input.horizonSessions;
  if (index >= bars.length) return { date: null, pct: null };
  const target = bars[index];
  const investable = Math.max(0, input.startingCapitalEur - input.entryFeeEur);
  const value = investable * (target.close / entryPrice);
  return { date: dateOf(target.timestamp), pct: finite((value / input.referenceGrossEur - 1) * 100) };
}
function incumbentReturnAt(input: {
  dataset: MultiAssetDataset;
  assetId: string;
  executionDate: string;
  endDate: string;
  horizonSessions: number | null;
  grossEur: number;
}): { date: string | null; pct: number | null } {
  return routeReturnAt({
    ...input,
    startingCapitalEur: input.grossEur,
    referenceGrossEur: input.grossEur,
    entryFeeEur: 0
  });
}
function actualEntryFee(signal: DynamicReplaySignal): number {
  return Math.max(0, signal.feeEur || 0);
}
function hypotheticalCoreEntryFee(item: AssetUniverseItem, capitalEur: number): number {
  return item.instrumentType === 'MUTUAL_FUND' ? 0 : brokerCommission(Math.max(0, capitalEur));
}
function challengerToken(reason: string): string | null {
  return reason.match(/Rotación competitiva persistente 1:1:\s*([^\s]+)\s+aparece/i)?.[1] ?? null;
}
function matchesToken(item: AssetUniverseItem | null, signal: DynamicReplaySignal, token: string | null): boolean {
  if (!token) return false;
  const normalized = token.toUpperCase();
  return signal.assetId.toUpperCase() === normalized
    || signal.ticker.toUpperCase() === normalized
    || item?.ticker?.toUpperCase() === normalized
    || item?.isin?.toUpperCase() === normalized;
}
function pairedChallenger(sale: DynamicReplaySignal, result: DynamicHistoricalReplayResult, catalog: AssetUniverseItem[]): DynamicReplaySignal | null {
  const token = challengerToken(sale.reason);
  const executableBuys = result.signals.filter(signal =>
    signal.executed
    && (signal.action === 'BUY' || signal.action === 'ADD')
    && signal.executionDate === sale.executionDate
  );
  const exact = executableBuys.find(signal => matchesToken(itemFor(catalog, signal.assetId), signal, token));
  if (exact) return exact;
  return executableBuys.find(signal => /Entrada por rotación persistente/i.test(signal.reason)) ?? null;
}
function outcome(input: {
  dataset: MultiAssetDataset;
  sale: DynamicReplaySignal;
  challenger: DynamicReplaySignal;
  core: AssetUniverseItem | null;
  endDate: string;
  horizonSessions: number | null;
}): RotationCounterfactualOutcome {
  const gross = input.sale.notionalEur;
  const saleNet = Math.max(0, gross - input.sale.feeEur - input.sale.estimatedTaxEur);
  const incumbent = incumbentReturnAt({ dataset: input.dataset, assetId: input.sale.assetId, executionDate: input.sale.executionDate!, endDate: input.endDate, horizonSessions: input.horizonSessions, grossEur: gross });
  const challenger = routeReturnAt({ dataset: input.dataset, assetId: input.challenger.assetId, executionDate: input.sale.executionDate!, endDate: input.endDate, horizonSessions: input.horizonSessions, startingCapitalEur: saleNet, referenceGrossEur: gross, entryFeeEur: actualEntryFee(input.challenger) });
  const coreFee = input.core ? hypotheticalCoreEntryFee(input.core, saleNet) : 0;
  const core = input.core
    ? routeReturnAt({ dataset: input.dataset, assetId: input.core.assetId, executionDate: input.sale.executionDate!, endDate: input.endDate, horizonSessions: input.horizonSessions, startingCapitalEur: saleNet, referenceGrossEur: gross, entryFeeEur: coreFee })
    : { date: null, pct: null };
  const date = incumbent.date ?? challenger.date ?? core.date;
  return {
    date,
    incumbentPct: incumbent.pct,
    challengerPct: challenger.pct,
    corePct: core.pct,
    challengerVsIncumbentPp: incumbent.pct == null || challenger.pct == null ? null : finite(challenger.pct - incumbent.pct),
    coreVsIncumbentPp: incumbent.pct == null || core.pct == null ? null : finite(core.pct - incumbent.pct)
  };
}

export function appendRotationCounterfactualAudit(input: {
  result: DynamicHistoricalReplayResult;
  dataset: MultiAssetDataset;
  catalog: AssetUniverseItem[];
}): DynamicHistoricalReplayResult {
  for (const sale of input.result.signals) {
    if (!sale.executed || sale.action !== 'EXIT' || !sale.executionDate || !/Rotación competitiva persistente 1:1/i.test(sale.reason)) continue;
    const challenger = pairedChallenger(sale, input.result, input.catalog);
    if (!challenger) continue;
    const core = chooseCoreAsset(input.dataset, input.catalog, sale.executionDate);
    const audit: RotationCounterfactualAudit = {
      version: 1,
      saleSignalId: sale.id,
      signalDate: sale.signalDate,
      executionDate: sale.executionDate,
      incumbentAssetId: sale.assetId,
      incumbentTicker: sale.ticker,
      challengerAssetId: challenger.assetId,
      challengerTicker: challenger.ticker,
      coreAssetId: core?.assetId ?? null,
      coreTicker: core?.ticker ?? null,
      saleGrossEur: sale.notionalEur,
      saleFeeEur: sale.feeEur,
      saleTaxEur: sale.estimatedTaxEur,
      horizons: {
        S5: outcome({ dataset: input.dataset, sale, challenger, core, endDate: input.result.endDate, horizonSessions: 5 }),
        S20: outcome({ dataset: input.dataset, sale, challenger, core, endDate: input.result.endDate, horizonSessions: 20 }),
        S60: outcome({ dataset: input.dataset, sale, challenger, core, endDate: input.result.endDate, horizonSessions: 60 }),
        END: outcome({ dataset: input.dataset, sale, challenger, core, endDate: input.result.endDate, horizonSessions: null })
      },
      note: 'Contrafactual diagnóstico: KEEP no vende; CHALLENGER y CORE descuentan comisión/impuesto de la venta y coste de entrada. El core se elige por prioridad fija de índice global, nunca por rentabilidad futura.'
    };
    sale.reason = `${sale.reason.replace(new RegExp(`\\s*\\${MARKER}.*$`), '')} ${MARKER}${JSON.stringify(audit)}`;
  }
  return input.result;
}
