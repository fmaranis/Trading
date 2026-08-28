import type { MultiAssetDataset } from '../portfolioBacktesting';
import type { AssetUniverseItem } from './assetUniverse';

export type OpportunityOutcomeHorizon = 5 | 20 | 60;

export interface OpportunityOutcomeEvent {
  informationDate: string;
  ticker: string;
  assetId: string;
  rank: number;
  score: number;
  momentum120Pct: number;
  annualizedVolatilityPct: number;
  forwardReturnsPct: Partial<Record<OpportunityOutcomeHorizon, number>>;
  benchmarkForwardReturnsPct: Partial<Record<OpportunityOutcomeHorizon, number>>;
  excessReturnsPct: Partial<Record<OpportunityOutcomeHorizon, number>>;
}

export interface OpportunityOutcomeMetrics {
  horizonSessions: OpportunityOutcomeHorizon;
  evaluated: number;
  averageReturnPct: number | null;
  medianReturnPct: number | null;
  positiveHitRatePct: number | null;
  averageExcessReturnPct: number | null;
  outperformRatePct: number | null;
}

export interface OpportunityOutcomeBacktestResult {
  scope: 'CAUSAL_OPPORTUNITY_SIGNALS_WITHIN_CURRENTLY_VALIDATED_UNIVERSE';
  eventCount: number;
  observationWindows: number;
  events: OpportunityOutcomeEvent[];
  metrics: OpportunityOutcomeMetrics[];
  notes: string[];
}

function timelineDates(dataset: MultiAssetDataset): string[] {
  const dateCounts = new Map<string, number>();
  for (const asset of dataset.assets) {
    for (const bar of asset.bars) {
      const d = bar.timestamp.slice(0, 10);
      dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1);
    }
  }
  const minRequired = Math.min(2, dataset.assets.length);
  return Array.from(dateCounts.entries())
    .filter(([_, count]) => count >= minRequired)
    .map(([date]) => date)
    .sort();
}

function buildAssetCloseMap(dataset: MultiAssetDataset, dates: string[]): Record<string, Map<string, number>> {
  const result: Record<string, Map<string, number>> = {};
  for (const asset of dataset.assets) {
    const rawMap = new Map<string, number>();
    for (const b of asset.bars) {
      rawMap.set(b.timestamp.slice(0, 10), b.close);
    }
    const denseMap = new Map<string, number>();
    let lastKnown: number | null = null;
    for (const d of dates) {
      const existing = rawMap.get(d);
      if (existing != null) {
        lastKnown = existing;
        denseMap.set(d, existing);
      } else if (lastKnown != null) {
        denseMap.set(d, lastKnown);
      }
    }
    result[asset.assetId] = denseMap;
  }
  return result;
}
function pricesUntil(dataset: MultiAssetDataset, assetId: string, endDate: string): number[] {
  const asset = dataset.assets.find(a => a.assetId === assetId);
  return asset ? asset.bars.filter(b => b.timestamp.slice(0, 10) <= endDate).map(b => b.close) : [];
}
function pctReturn(prices: number[], lookback: number): number | null {
  if (prices.length <= lookback) return null;
  const a = prices[prices.length - 1 - lookback], b = prices[prices.length - 1];
  return a > 0 ? (b / a - 1) * 100 : null;
}
function annualizedVolatility(prices: number[], lookback = 60): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback + 1));
  if (slice.length < 3) return null;
  const r: number[] = [];
  for (let i = 1; i < slice.length; i++) r.push(Math.log(slice[i] / slice[i - 1]));
  const mean = r.reduce((a,b)=>a+b,0) / r.length;
  const variance = r.reduce((s,x)=>s+(x-mean)**2,0) / Math.max(1,r.length-1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}
function maxDrawdown(prices: number[], lookback = 252): number | null {
  const slice = prices.slice(-Math.min(prices.length, lookback));
  if (!slice.length) return null;
  let peak = slice[0], dd = 0;
  for (const p of slice) { peak = Math.max(peak,p); if (peak > 0) dd = Math.max(dd,(peak-p)/peak*100); }
  return dd;
}
function stats(prices: number[], defensive: boolean) {
  if (prices.length < 121) return null;
  const m20 = pctReturn(prices,20) ?? 0;
  const m60 = pctReturn(prices,60) ?? 0;
  const m120 = pctReturn(prices,120) ?? 0;
  const vol = annualizedVolatility(prices,60) ?? 30;
  const dd = maxDrawdown(prices,252) ?? 25;
  const score = m20*0.20 + m60*0.35 + m120*0.45 - vol*0.30 - dd*0.25 + (defensive ? 2.5 : 0);
  return { score, m120, vol };
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const x = [...values].sort((a,b)=>a-b); const m = Math.floor(x.length/2);
  return x.length % 2 ? x[m] : (x[m-1]+x[m])/2;
}
function round(v: number): number { return Number(v.toFixed(6)); }

export class OpportunityOutcomeBacktestEngine {
  static run(dataset: MultiAssetDataset, catalog: AssetUniverseItem[], maxSelected = 8): OpportunityOutcomeBacktestResult {
    if (dataset.assets.length < 2) throw new Error('Se requieren al menos 2 activos para validar oportunidades.');
    if (dataset.assets.some(a => a.provenance.sourceType !== 'REAL')) throw new Error('La validación de oportunidades exige datos REAL.');
    const dates = timelineDates(dataset);
    if (dates.length < 250) throw new Error('Histórico común insuficiente para validar oportunidades.');
    const catalogById = new Map(catalog.map(x => [x.assetId,x]));
    const barMaps = buildAssetCloseMap(dataset, dates);
    const events: OpportunityOutcomeEvent[] = [];
    let observationWindows = 0;

    for (let i = 181; i < dates.length - 5; i++) {
      const d = dates[i];
      const next = dates[i+1];
      if (d.slice(0,7) === next.slice(0,7)) continue;
      observationWindows++;
      const ranked = dataset.assets.map(asset => {
        const item = catalogById.get(asset.assetId);
        const s = stats(pricesUntil(dataset, asset.assetId, d), Boolean(item?.defensive));
        return item && s ? { asset, item, ...s } : null;
      }).filter((x): x is NonNullable<typeof x> => Boolean(x)).sort((a,b)=>b.score-a.score);

      const diversified: typeof ranked = [];
      const used = new Set<string>();
      const defensive = ranked.find(x => x.item.defensive);
      if (defensive) { diversified.push(defensive); used.add(defensive.item.category); }
      for (const x of ranked) {
        if (diversified.length >= Math.min(8,maxSelected)) break;
        if (diversified.some(y => y.asset.assetId === x.asset.assetId) || used.has(x.item.category)) continue;
        diversified.push(x); used.add(x.item.category);
      }
      const sortedDiversified = [...diversified].sort((a,b)=>b.score-a.score);
      const opportunityCandidates = sortedDiversified.slice(0,3).filter(x => x.score >= 2 && x.m120 > 0 && x.vol <= 30);

      for (const x of opportunityCandidates) {
        const event: OpportunityOutcomeEvent = {
          informationDate: d, ticker: x.asset.ticker, assetId: x.asset.assetId,
          rank: sortedDiversified.findIndex(y=>y.asset.assetId===x.asset.assetId)+1,
          score: round(x.score), momentum120Pct: round(x.m120), annualizedVolatilityPct: round(x.vol),
          forwardReturnsPct: {}, benchmarkForwardReturnsPct: {}, excessReturnsPct: {}
        };
        const start = Number(barMaps[x.asset.assetId].get(d));
        for (const h of [5,20,60] as OpportunityOutcomeHorizon[]) {
          if (i + h >= dates.length || !(start > 0)) continue;
          const futureDate = dates[i+h];
          const end = Number(barMaps[x.asset.assetId].get(futureDate));
          if (!(end > 0)) continue;
          const assetRet = (end/start - 1)*100;
          const universeReturns = dataset.assets.map(a => {
            const a0 = Number(barMaps[a.assetId].get(d)); const a1 = Number(barMaps[a.assetId].get(futureDate));
            return a0 > 0 && a1 > 0 ? (a1/a0 - 1)*100 : null;
          }).filter((v): v is number => v != null && Number.isFinite(v));
          const benchmark = universeReturns.length ? universeReturns.reduce((s,v)=>s+v,0)/universeReturns.length : 0;
          event.forwardReturnsPct[h] = round(assetRet);
          event.benchmarkForwardReturnsPct[h] = round(benchmark);
          event.excessReturnsPct[h] = round(assetRet-benchmark);
        }
        events.push(event);
      }
    }

    const metrics = ([5,20,60] as OpportunityOutcomeHorizon[]).map(h => {
      const rows = events.filter(e => e.forwardReturnsPct[h] != null && e.excessReturnsPct[h] != null);
      const returns = rows.map(e => e.forwardReturnsPct[h]!);
      const excess = rows.map(e => e.excessReturnsPct[h]!);
      const med = median(returns);
      return {
        horizonSessions: h,
        evaluated: rows.length,
        averageReturnPct: returns.length ? round(returns.reduce((s,v)=>s+v,0)/returns.length) : null,
        medianReturnPct: med == null ? null : round(med),
        positiveHitRatePct: returns.length ? round(returns.filter(v=>v>0).length/returns.length*100) : null,
        averageExcessReturnPct: excess.length ? round(excess.reduce((s,v)=>s+v,0)/excess.length) : null,
        outperformRatePct: excess.length ? round(excess.filter(v=>v>0).length/excess.length*100) : null
      };
    });

    return {
      scope: 'CAUSAL_OPPORTUNITY_SIGNALS_WITHIN_CURRENTLY_VALIDATED_UNIVERSE',
      eventCount: events.length, observationWindows, events, metrics,
      notes: [
        'Cada señal usa exclusivamente datos disponibles hasta la fecha de información; el resultado se observa después.',
        'El benchmark de cada señal es el retorno medio equiponderado del universo validado durante el mismo horizonte.',
        'Las métricas no son una promesa de rentabilidad futura ni justifican por sí solas una orden automática.',
        'Persiste sesgo residual de survivorship porque el universo histórico parte de instrumentos actualmente consultables.'
      ]
    };
  }
}
