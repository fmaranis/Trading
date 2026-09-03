import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import type { AssetUniverseScanResult, FundPosition, UserHolding } from '../investment/decision';
import {
  calendarDaysBetween,
  CASH_BENCHMARK_UPDATED_EVENT,
  CashBenchmarkService,
  PortfolioCashFlowHistoryService,
  PortfolioExecutionHistoryService,
  TaxLotLedgerService,
  USER_REAL_FUND_POSITIONS,
  USER_REAL_STAGED_CAPITAL_PLAN
} from '../investment/decision';
import { FundMarketDataService } from '../investment/data/marketData/fundMarketData';
import { HistoricalMarketDataService } from '../investment/data/marketData/historicalMarketDataService';

type InstrumentType = 'FUND' | 'LISTED';
interface InstrumentDescriptor { key: string; type: InstrumentType; code: string; label: string; startDate: string; }
interface PriceSeries { descriptor: InstrumentDescriptor; prices: Map<string, number>; dates: string[]; }
interface EvolutionEvent { id: string; date: string; key: string; unitsDelta: number; externalContributionEur: number; cashDeltaEur: number; label: string; }
interface EvolutionPoint {
  date: string;
  valueEur: number;
  contributedEur: number;
  cashEur: number;
  investedEur: number;
  cashInterestEur: number;
  eventValueEur: number | null;
  eventLabels: string[];
}
interface EvolutionResult { points: EvolutionPoint[]; warnings: string[]; inferredEvents: number; reusedScanSeries: number; }

interface Props {
  scan: AssetUniverseScanResult;
  funds: FundPosition[];
  holdings: UserHolding[];
  cashEur: number;
  pendingCapitalEur: number;
  revision?: number;
}

function isoDate(value: string): string { return value.slice(0, 10); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function keyFund(isin: string): string { return `FUND:${isin.trim().toUpperCase()}`; }
function keyListed(ticker: string): string { return `LISTED:${ticker.trim().toUpperCase()}`; }
function priceOnOrAfter(series: PriceSeries, date: string): number | null { for (const d of series.dates) if (d >= date) return series.prices.get(d) ?? null; return null; }
function priceOnOrBefore(series: PriceSeries, date: string): number | null { for (let i = series.dates.length - 1; i >= 0; i--) if (series.dates[i] <= date) return series.prices.get(series.dates[i]) ?? null; return null; }
function monthEndDates(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  const start = new Date(`${fromDate.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  for (let cursor = start; cursor <= end;) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const date = monthEnd.toISOString().slice(0, 10);
    if (date >= fromDate && date <= toDate) out.push(date);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return out;
}

function seriesFromScan(descriptor: InstrumentDescriptor, scan: AssetUniverseScanResult): PriceSeries | null {
  const code = descriptor.code.toUpperCase();
  const candidate = scan.candidates.find(row => row.asset.ticker.toUpperCase() === code || row.asset.isin?.toUpperCase() === code);
  if (!candidate) return null;
  const asset = scan.acceptedDataset.assets.find(row => row.assetId === candidate.asset.assetId);
  if (!asset) return null;
  const rows = asset.bars.filter(bar => isoDate(bar.timestamp) >= descriptor.startDate && Number.isFinite(bar.close) && bar.close > 0);
  if (!rows.length) return null;
  const prices = new Map(rows.map(bar => [isoDate(bar.timestamp), bar.close]));
  return { descriptor, prices, dates: [...prices.keys()].sort() };
}

async function loadSeries(descriptor: InstrumentDescriptor, scan: AssetUniverseScanResult): Promise<{ series: PriceSeries; reused: boolean }> {
  const existing = seriesFromScan(descriptor, scan);
  if (existing) return { series: existing, reused: true };
  if (descriptor.type === 'FUND') {
    const response = await FundMarketDataService.history(descriptor.code, descriptor.startDate, today());
    const prices = new Map(response.points.map(point => [point.date, point.nav]));
    return { series: { descriptor, prices, dates: [...prices.keys()].sort() }, reused: false };
  }
  const response = await HistoricalMarketDataService.getHistoricalBars({ symbol: descriptor.code, startDate: descriptor.startDate, endDate: today(), timeframe: '1d', adjusted: true }, { forceRefresh: false, maxRetries: 1 });
  const prices = new Map(response.bars.map(bar => [isoDate(bar.timestamp), bar.close]));
  return { series: { descriptor, prices, dates: [...prices.keys()].sort() }, reused: false };
}

async function reconstruct(funds: FundPosition[], holdings: UserHolding[], scan: AssetUniverseScanResult, cashAnnualPct: number): Promise<EvolutionResult> {
  const history = PortfolioExecutionHistoryService.load();
  const descriptors = new Map<string, InstrumentDescriptor>();
  const warnings: string[] = [];
  const addDescriptor = (descriptor: InstrumentDescriptor) => { const previous = descriptors.get(descriptor.key); if (!previous || descriptor.startDate < previous.startDate) descriptors.set(descriptor.key, descriptor); };

  for (const fund of USER_REAL_FUND_POSITIONS) if (fund.isin) addDescriptor({ key: keyFund(fund.isin), type: 'FUND', code: fund.isin, label: fund.name, startDate: fund.acquisitionDate });
  for (const fund of funds) if (fund.isin) addDescriptor({ key: keyFund(fund.isin), type: 'FUND', code: fund.isin, label: fund.name, startDate: fund.acquisitionDate });
  for (const holding of holdings) {
    const lots = TaxLotLedgerService.lots(holding.ticker);
    const startDate = lots.map(lot => lot.acquisitionDate).sort()[0] ?? today();
    addDescriptor({ key: keyListed(holding.ticker), type: 'LISTED', code: holding.ticker.toUpperCase(), label: holding.ticker.toUpperCase(), startDate });
    if (!lots.length && !history.some(row => row.action === 'BUY_ETF' && row.targetTicker?.toUpperCase() === holding.ticker.toUpperCase())) warnings.push(`${holding.ticker}: no hay fecha/lote de compra; su historia anterior a hoy no puede reconstruirse exactamente.`);
  }
  for (const row of history) {
    const date = isoDate(row.appliedAt);
    if (row.targetIsin && ['SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(row.action)) addDescriptor({ key: keyFund(row.targetIsin), type: 'FUND', code: row.targetIsin.toUpperCase(), label: row.targetName ?? row.targetIsin, startDate: date });
    if (row.sourceIsin && ['REDEEM_FUND', 'TRANSFER_FUND'].includes(row.action)) addDescriptor({ key: keyFund(row.sourceIsin), type: 'FUND', code: row.sourceIsin.toUpperCase(), label: row.sourceLabel ?? row.sourceIsin, startDate: date });
    if (row.targetTicker && ['BUY_ETF', 'SELL_ETF'].includes(row.action)) addDescriptor({ key: keyListed(row.targetTicker), type: 'LISTED', code: row.targetTicker.toUpperCase(), label: row.targetName ?? row.targetTicker, startDate: date });
  }

  const loaded = await Promise.all([...descriptors.values()].map(async descriptor => {
    try { return await loadSeries(descriptor, scan); }
    catch (e: any) { warnings.push(`${descriptor.code}: ${e?.message || String(e)}`); return null; }
  }));
  const validLoaded = loaded.filter(Boolean) as Array<{ series: PriceSeries; reused: boolean }>;
  const seriesByKey = new Map(validLoaded.map(row => [row.series.descriptor.key, row.series]));
  const reusedScanSeries = validLoaded.filter(row => row.reused).length;
  if (!seriesByKey.size) return { points: [], warnings: warnings.length ? warnings : ['No hay series REAL suficientes para reconstruir la cartera.'], inferredEvents: 0, reusedScanSeries };

  const events: EvolutionEvent[] = [];
  let inferredEvents = 0;
  const historyFundTargets = new Set(history.filter(row => ['SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(row.action) && row.targetIsin).map(row => row.targetIsin!.toUpperCase()));
  const historyListedTargets = new Set(history.filter(row => row.action === 'BUY_ETF' && row.targetTicker).map(row => row.targetTicker!.toUpperCase()));

  for (const fund of USER_REAL_FUND_POSITIONS) {
    const series = seriesByKey.get(keyFund(fund.isin));
    if (!series) continue;
    const price = priceOnOrAfter(series, fund.acquisitionDate);
    const units = fund.units && fund.units > 0 ? fund.units : price && fund.investedEur > 0 ? fund.investedEur / price : 0;
    if (!(units > 0)) { warnings.push(`${fund.isin}: no se pudieron reconstruir las participaciones iniciales.`); continue; }
    events.push({ id: `baseline_${fund.id}`, date: fund.acquisitionDate, key: keyFund(fund.isin), unitsDelta: units, externalContributionEur: 0, cashDeltaEur: -fund.investedEur, label: `Compra inicial ${fund.name}: -${fund.investedEur.toFixed(2)} € de la cuenta` });
  }
  for (const fund of funds) {
    if (!fund.isin || USER_REAL_FUND_POSITIONS.some(base => base.isin.toUpperCase() === fund.isin.toUpperCase()) || historyFundTargets.has(fund.isin.toUpperCase())) continue;
    const series = seriesByKey.get(keyFund(fund.isin));
    if (!series) continue;
    const price = priceOnOrAfter(series, fund.acquisitionDate);
    const units = fund.units && fund.units > 0 ? fund.units : price && fund.investedEur > 0 ? fund.investedEur / price : 0;
    if (!(units > 0)) { warnings.push(`${fund.isin}: posición manual sin unidades reconstruibles.`); continue; }
    if (fund.units == null) inferredEvents++;
    events.push({ id: `manual_${fund.id}`, date: fund.acquisitionDate, key: keyFund(fund.isin), unitsDelta: units, externalContributionEur: fund.investedEur, cashDeltaEur: -fund.investedEur, label: `Posición registrada ${fund.name}: ${fund.investedEur.toFixed(2)} €` });
  }
  for (const holding of holdings) {
    if (historyListedTargets.has(holding.ticker.toUpperCase())) continue;
    const lots = TaxLotLedgerService.lots(holding.ticker);
    for (const [index, lot] of lots.entries()) events.push({ id: `lot_${holding.ticker}_${index}_${lot.acquisitionDate}`, date: lot.acquisitionDate, key: keyListed(holding.ticker), unitsDelta: lot.shares, externalContributionEur: lot.acquisitionCostEur, cashDeltaEur: -lot.acquisitionCostEur, label: `Compra ${holding.ticker}: ${lot.shares} títulos · ${lot.acquisitionCostEur.toFixed(2)} €` });
  }
  for (const row of history) {
    const date = isoDate(row.appliedAt), amount = Math.max(0, row.amountEur ?? 0), fee = Math.max(0, row.feeEur);
    if (row.action === 'BUY_ETF' && row.targetTicker && (row.shares ?? 0) > 0) {
      events.push({ id: row.id, date, key: keyListed(row.targetTicker), unitsDelta: Number(row.shares), externalContributionEur: 0, cashDeltaEur: -(amount + fee), label: `Compra ${row.targetTicker}: -${(amount + fee).toFixed(2)} € de la cuenta` });
    } else if (row.action === 'SELL_ETF' && row.targetTicker && (row.shares ?? 0) > 0) {
      events.push({ id: row.id, date, key: keyListed(row.targetTicker), unitsDelta: -Number(row.shares), externalContributionEur: 0, cashDeltaEur: Math.max(0, amount - fee), label: `Venta ${row.targetTicker}: +${Math.max(0, amount - fee).toFixed(2)} € a la cuenta` });
    } else if (row.action === 'SUBSCRIBE_FUND' && row.targetIsin) {
      const series = seriesByKey.get(keyFund(row.targetIsin));
      const price = series ? priceOnOrBefore(series, date) ?? priceOnOrAfter(series, date) : null;
      const units = row.shares != null && row.shares > 0 ? row.shares : price && amount > 0 ? amount / price : 0;
      if (row.shares == null) inferredEvents++;
      if (units > 0) events.push({ id: row.id, date, key: keyFund(row.targetIsin), unitsDelta: units, externalContributionEur: 0, cashDeltaEur: -amount, label: `Suscripción ${row.targetName ?? row.targetIsin}: -${amount.toFixed(2)} € de la cuenta${row.shares == null ? ' · unidades inferidas' : ''}` });
    } else if (row.action === 'REDEEM_FUND' && row.sourceIsin) {
      const series = seriesByKey.get(keyFund(row.sourceIsin));
      const price = series ? priceOnOrBefore(series, date) ?? priceOnOrAfter(series, date) : null;
      const units = price && amount > 0 ? amount / price : 0;
      inferredEvents++;
      if (units > 0) events.push({ id: row.id, date, key: keyFund(row.sourceIsin), unitsDelta: -units, externalContributionEur: 0, cashDeltaEur: amount, label: `Reembolso ${row.sourceLabel ?? row.sourceIsin}: +${amount.toFixed(2)} € a la cuenta · unidades inferidas` });
    } else if (row.action === 'TRANSFER_FUND' && row.sourceIsin && row.targetIsin) {
      const sourceSeries = seriesByKey.get(keyFund(row.sourceIsin)), targetSeries = seriesByKey.get(keyFund(row.targetIsin));
      const sourcePrice = sourceSeries ? priceOnOrBefore(sourceSeries, date) ?? priceOnOrAfter(sourceSeries, date) : null;
      const targetPrice = targetSeries ? priceOnOrBefore(targetSeries, date) ?? priceOnOrAfter(targetSeries, date) : null;
      const sourceUnits = sourcePrice && amount > 0 ? amount / sourcePrice : 0;
      const targetUnits = row.shares != null && row.shares > 0 ? row.shares : targetPrice && amount > 0 ? amount / targetPrice : 0;
      inferredEvents++;
      if (sourceUnits > 0) events.push({ id: `${row.id}_out`, date, key: keyFund(row.sourceIsin), unitsDelta: -sourceUnits, externalContributionEur: 0, cashDeltaEur: 0, label: `Traspaso sale ${row.sourceLabel ?? row.sourceIsin}: ${amount.toFixed(2)} €` });
      if (targetUnits > 0) events.push({ id: `${row.id}_in`, date, key: keyFund(row.targetIsin), unitsDelta: targetUnits, externalContributionEur: 0, cashDeltaEur: 0, label: `Traspaso entra ${row.targetName ?? row.targetIsin}: ${amount.toFixed(2)} €` });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const baselineDate = USER_REAL_FUND_POSITIONS.map(fund => fund.acquisitionDate).sort()[0] ?? events[0]?.date ?? today();
  const baselineCapitalEur = USER_REAL_FUND_POSITIONS.reduce((sum, fund) => sum + fund.investedEur, 0) + USER_REAL_STAGED_CAPITAL_PLAN.availableEur;
  PortfolioCashFlowHistoryService.ensureBaseline(baselineCapitalEur, baselineDate, `Aportación inicial a cuenta: +${baselineCapitalEur.toFixed(2)} €`);
  const cashFlows = PortfolioCashFlowHistoryService.load();
  const cashFlowsByDate = new Map<string, typeof cashFlows>();
  for (const flow of cashFlows) cashFlowsByDate.set(flow.date, [...(cashFlowsByDate.get(flow.date) ?? []), flow]);

  const firstEventDate = [...events.map(event => event.date), ...cashFlows.map(flow => flow.date)].sort()[0];
  if (!firstEventDate) return { points: [], warnings, inferredEvents, reusedScanSeries };
  const endDate = today();
  const settlementDates = new Set(monthEndDates(firstEventDate, endDate));
  const allDates = [...new Set([
    ...[...seriesByKey.values()].flatMap(series => series.dates).filter(date => date >= firstEventDate && date <= endDate),
    ...events.map(event => event.date).filter(date => date >= firstEventDate && date <= endDate),
    ...cashFlows.map(flow => flow.date).filter(date => date >= firstEventDate && date <= endDate),
    ...settlementDates,
    endDate
  ])].sort();

  const units = new Map<string, number>(), lastPrice = new Map<string, number>(), eventsByDate = new Map<string, EvolutionEvent[]>();
  for (const event of events) eventsByDate.set(event.date, [...(eventsByDate.get(event.date) ?? []), event]);
  const effectiveDailyRate = cashAnnualPct > 0 ? Math.pow(1 + cashAnnualPct / 100, 1 / 365) - 1 : 0;
  let cashEur = 0, contributedEur = 0, pendingInterestEur = 0, creditedInterestEur = 0;
  let previousDate = allDates[0];
  const points: EvolutionPoint[] = [];

  for (const date of allDates) {
    const elapsedDays = date === previousDate ? 0 : calendarDaysBetween(previousDate, date);
    if (elapsedDays > 0 && cashEur > 0 && effectiveDailyRate > 0) pendingInterestEur += cashEur * effectiveDailyRate * elapsedDays;

    for (const [key, series] of seriesByKey) { const price = series.prices.get(date); if (price != null && price > 0) lastPrice.set(key, price); }
    const labels: string[] = [];

    if (settlementDates.has(date) && pendingInterestEur > 0.000001) {
      cashEur += pendingInterestEur;
      creditedInterestEur += pendingInterestEur;
      labels.push(`Interés mensual cuenta ${cashAnnualPct.toFixed(2)}% TAE: +${pendingInterestEur.toFixed(2)} €`);
      pendingInterestEur = 0;
    }

    for (const flow of cashFlowsByDate.get(date) ?? []) {
      cashEur = Math.max(0, cashEur + flow.amountEur);
      contributedEur = Math.max(0, contributedEur + flow.amountEur);
      labels.push(flow.label);
    }

    const dayEvents = eventsByDate.get(date) ?? [];
    for (const event of dayEvents) {
      const requiredCash = Math.max(0, -event.cashDeltaEur - cashEur);
      const external = Math.max(event.externalContributionEur, requiredCash);
      if (external > 0) {
        contributedEur += external;
        cashEur += external;
        labels.push(`Aportación inferida para ejecutar operación: +${external.toFixed(2)} €`);
      }
      cashEur = Math.max(0, cashEur + event.cashDeltaEur);
      units.set(event.key, Math.max(0, (units.get(event.key) ?? 0) + event.unitsDelta));
      labels.push(event.label);
    }

    let investedEur = 0;
    for (const [key, quantity] of units) investedEur += quantity * (lastPrice.get(key) ?? 0);
    const valueEur = investedEur + cashEur;
    points.push({
      date,
      valueEur,
      contributedEur,
      cashEur,
      investedEur,
      cashInterestEur: creditedInterestEur,
      eventValueEur: labels.length ? valueEur : null,
      eventLabels: labels
    });
    previousDate = date;
  }
  return { points, warnings, inferredEvents, reusedScanSeries };
}

function EvolutionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return <div className="max-w-[350px] rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] shadow-xl"><div className="font-mono text-slate-400">{label}</div><div className="mt-1 font-bold text-white">Valor reconstruido {Number(row?.valueEur ?? 0).toFixed(2)} €</div><div className="text-slate-400">Invertido {Number(row?.investedEur ?? 0).toFixed(2)} € · cuenta remunerada {Number(row?.cashEur ?? 0).toFixed(2)} €</div><div className="text-sky-300">Intereses ya abonados {Number(row?.cashInterestEur ?? 0).toFixed(2)} €</div><div className="text-slate-500">Aportación externa neta {Number(row?.contributedEur ?? 0).toFixed(2)} €</div>{row?.eventLabels?.length > 0 && <div className="mt-2 border-t border-slate-800 pt-2 text-cyan-200">{row.eventLabels.map((labelText: string) => <div key={labelText}>• {labelText}</div>)}</div>}</div>;
}

export const PortfolioEvolutionChart: React.FC<Props> = ({ scan, funds, holdings, cashEur, pendingCapitalEur, revision = 0 }) => {
  const [result, setResult] = useState<EvolutionResult | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null);
  const [cashBenchmarkAnnualPct, setCashBenchmarkAnnualPct] = useState(() => CashBenchmarkService.load());
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    reconstruct(funds, holdings, scan, cashBenchmarkAnnualPct).then(value => { if (active) setResult(value); }).catch((e: any) => { if (active) setError(e?.message || String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [funds, holdings, scan, revision, cashBenchmarkAnnualPct]);
  useEffect(() => {
    const sync = () => setCashBenchmarkAnnualPct(CashBenchmarkService.load());
    window.addEventListener(CASH_BENCHMARK_UPDATED_EVENT, sync as EventListener);
    return () => window.removeEventListener(CASH_BENCHMARK_UPDATED_EVENT, sync as EventListener);
  }, []);

  const last = result?.points.at(-1) ?? null;
  const gain = last ? last.valueEur - last.contributedEur : null;
  const gainPct = last && gain != null && last.contributedEur > 0 ? gain / last.contributedEur * 100 : null;
  const registeredLiquidityEur = Math.max(0, cashEur) + Math.max(0, pendingCapitalEur);
  const warnings = useMemo(() => result?.warnings ?? [], [result]);

  return <div className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-950/55 p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300"/><b className="text-sm text-white">Evolución real registrada</b></div><div className="mt-1 text-[10px] text-slate-500">Reconstruye en la misma gráfica inversiones y cuenta operativa desde la aportación inicial hasta hoy. La cuenta sube por aportaciones e interés mensual al {cashBenchmarkAnnualPct.toFixed(2)}% TAE y baja/sube exactamente en las fechas de compras, ventas y reembolsos.</div></div>{loading && <span className="text-[10px] text-cyan-300">Actualizando histórico…</span>}</div>
    {error && <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-[10px] text-rose-200">{error}</div>}
    {last && <>
      <div className="mt-3 grid gap-2 sm:grid-cols-4 text-xs"><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Valor reconstruido</div><b className="font-mono">{last.valueEur.toFixed(2)} €</b></div><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Aportación externa neta</div><b className="font-mono">{last.contributedEur.toFixed(2)} €</b></div><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Resultado reconstruido</div><b className={`font-mono ${gain != null && gain >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{gain == null ? 'N/D' : `${gain >= 0 ? '+' : ''}${gain.toFixed(2)} €`}</b><div className={`mt-1 font-mono text-[10px] ${gainPct != null && gainPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{gainPct == null ? 'Rentabilidad N/D' : `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}% sobre aportación neta`}</div></div><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Cuenta remunerada reconstruida</div><b className="font-mono text-sky-200">{last.cashEur.toFixed(2)} €</b><div className="mt-1 text-[9px] text-slate-500">Interés abonado +{last.cashInterestEur.toFixed(2)} € · principal registrado hoy {registeredLiquidityEur.toFixed(2)} €</div></div></div>
      <div className="mt-3 h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={result!.points} margin={{ top: 10, right: 10, left: 5, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" minTickGap={38} tick={{ fontSize: 9, fill: '#94a3b8' }}/><YAxis width={70} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => `${Number(value).toFixed(0)}€`}/><Tooltip content={<EvolutionTooltip/>}/><Legend wrapperStyle={{ fontSize: 10 }}/><Line type="monotone" dataKey="valueEur" name="Valor real reconstruido" stroke="#22d3ee" strokeWidth={2} dot={false}/><Line type="stepAfter" dataKey="contributedEur" name="Aportación externa neta" stroke="#94a3b8" strokeDasharray="5 4" dot={false}/><Line type="stepAfter" dataKey="cashEur" name={`Cuenta remunerada · ${cashBenchmarkAnnualPct.toFixed(2)}% TAE`} stroke="#38bdf8" strokeWidth={2.5} dot={false}/><Scatter dataKey="eventValueEur" name="Movimiento real" fill="#22c55e"/></ComposedChart></ResponsiveContainer></div>
      <div className="mt-1 text-[9px] text-slate-600">Series reutilizadas del scan actual: {result!.reusedScanSeries}. La historia termina hoy; no contiene ninguna proyección futura.</div>
    </>}
    {!loading && result && result.points.length === 0 && <div className="mt-3 text-xs text-slate-500">Todavía no hay historia suficiente para dibujar la evolución.</div>}
    {(warnings.length > 0 || (result?.inferredEvents ?? 0) > 0) && <details className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/5 p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] font-bold text-amber-100"><AlertTriangle className="h-3.5 w-3.5"/>Precisión de la reconstrucción</summary><div className="mt-2 space-y-1 text-[9px] text-slate-400">{(result?.inferredEvents ?? 0) > 0 && <div>• {result!.inferredEvents} operación(es) sin unidades exactas se han convertido a unidades usando el NAV/precio de esa fecha.</div>}{warnings.map(warning => <div key={warning}>• {warning}</div>)}<div>• La aportación inicial real se registra una sola vez en la cuenta y las compras iniciales salen de ese mismo saldo; no se autofinancia cada posición por separado.</div><div>• La TAE se convierte a rendimiento diario equivalente y se abona visualmente al cierre de cada mes; no significa 2,5% cada mes.</div></div></details>}
  </div>;
};