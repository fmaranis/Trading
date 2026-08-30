import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, CalendarRange, ChevronDown, PlayCircle, ReceiptText, ShieldCheck } from 'lucide-react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AssetUniverseScanner,
  CashBenchmarkService,
  DynamicHistoricalReplayEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  SpanishTaxSettingsService,
  allCashBenchmark,
  type AssetUniverseScanResult,
  type DynamicHistoricalReplayResult,
  type DynamicReplayEvent,
  type DynamicReplayFrequency,
  type DynamicReplaySignal,
  type InvestmentHorizonYears,
  type InvestorRiskProfile
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
}

interface ExternalValidationResult {
  recordedAt?: string;
  payload?: {
    outOfUniverseRobustness?: {
      pool?: { accepted?: number; rejected?: number };
      randomSample?: {
        tickers?: string[];
        replay?: { summary?: { scenarioCount?: number; scenariosBeatingStatic?: number; scenariosBeatingCash?: number } };
      };
      historicalNegativeWindowStress?: {
        evaluatedEpisodes?: number;
        episodesWithDefensiveSignal?: number;
        episodesWithExecutedBuyOrAdd?: number;
      };
    };
  };
}

type LoadingPhase = 'IDLE' | 'MARKET_DATA' | 'SIMULATION';

interface InitialHoldBenchmark {
  executionDate: string | null;
  finalValueEur: number;
  returnPct: number;
  residualCashAtExecutionEur: number;
  holdings: Array<{ assetId: string; units: number }>;
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function today(): string { return isoDate(new Date()); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function warmupDate(date: string): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 3); return isoDate(d); }
function signed(value: number | null, digits = 2): string {
  if (value == null) return 'N/D';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}
function frequencyLabel(frequency: DynamicReplayFrequency): string {
  if (frequency === 'DAILY') return 'Cada sesión';
  if (frequency === 'WEEKLY') return 'Semanal';
  if (frequency === 'MONTHLY') return 'Mensual';
  return 'Trimestral';
}
function actionLabel(action: DynamicReplaySignal['action']): string {
  if (action === 'BUY') return 'COMPRAR';
  if (action === 'ADD') return 'AÑADIR';
  if (action === 'REDUCE') return 'REDUCIR';
  if (action === 'EXIT') return 'SALIR';
  if (action === 'AVOID') return 'NO COMPRAR';
  return 'MANTENER';
}
function actionClass(action: DynamicReplaySignal['action']): string {
  if (action === 'BUY' || action === 'ADD') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
  if (action === 'REDUCE' || action === 'EXIT') return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
  if (action === 'AVOID') return 'border-amber-500/25 bg-amber-500/5 text-amber-100';
  return 'border-slate-700 bg-slate-950 text-slate-300';
}
function eventClass(type: DynamicReplayEvent['type']): string {
  if (type === 'BUY' || type === 'ADD') return 'text-emerald-200';
  if (type === 'REDUCE' || type === 'EXIT') return 'text-rose-200';
  return 'text-violet-200';
}
function catalogueItem(assetId: string) {
  return EUR_PORTFOLIO_DISCOVERY_UNIVERSE.find(item => item.assetId === assetId) ?? null;
}
function signalLabel(signal: DynamicReplaySignal): string {
  const item = catalogueItem(signal.assetId);
  return item?.name ?? signal.ticker;
}
function signalCode(signal: DynamicReplaySignal): string {
  const item = catalogueItem(signal.assetId);
  return item?.isin ?? item?.ticker ?? signal.ticker;
}
function closeOnOrBefore(scan: AssetUniverseScanResult, assetId: string, date: string): number | null {
  const asset = scan.acceptedDataset.assets.find(item => item.assetId === assetId);
  if (!asset) return null;
  const bar = [...asset.bars].reverse().find(item => item.timestamp.slice(0, 10) <= date);
  return bar && bar.close > 0 ? bar.close : null;
}

function ReplayTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const events = Array.isArray(row?.events) ? row.events as DynamicReplayEvent[] : [];
  return <div className="max-w-[340px] rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] shadow-xl">
    <div className="font-mono text-slate-400">{label}</div>
    <div className="mt-1 font-bold text-white">Patrimonio {Number(row?.equityEur ?? 0).toFixed(2)} €</div>
    <div className="mt-1 text-slate-400">Invertido {Number(row?.investedEur ?? 0).toFixed(2)} € · cash {Number(row?.cashEur ?? 0).toFixed(2)} €</div>
    <div className="text-slate-500">Primera cartera y mantener: {Number(row?.initialHoldEur ?? 0).toFixed(2)} €</div>
    <div className="text-slate-500">Todo en cuenta: {Number(row?.cashBenchmarkEur ?? 0).toFixed(2)} €</div>
    {events.length > 0 && <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">{events.map(event => <div key={event.id}><b className={eventClass(event.type)}>{event.label}</b><div className="text-slate-400">{event.detail}</div></div>)}</div>}
  </div>;
}

export const HistoricalDecisionReplayPanel: React.FC<Props> = ({ scan, capitalEur, riskProfile, horizonYears }) => {
  const [startDate, setStartDate] = useState(() => yearsAgo(1));
  const [frequency, setFrequency] = useState<DynamicReplayFrequency>('DAILY');
  const [initialCapital, setInitialCapital] = useState(() => Math.max(1, capitalEur).toFixed(2));
  const [dynamicResult, setDynamicResult] = useState<DynamicHistoricalReplayResult | null>(null);
  const [historicalScan, setHistoricalScan] = useState<AssetUniverseScanResult | null>(null);
  const [historicalCoverage, setHistoricalCoverage] = useState<{ accepted: number; scanned: number; from: string } | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [externalValidation, setExternalValidation] = useState<ExternalValidationResult | null>(null);
  const [externalValidationError, setExternalValidationError] = useState<string | null>(null);

  useEffect(() => setInitialCapital(Math.max(1, capitalEur).toFixed(2)), [capitalEur]);
  useEffect(() => {
    let active = true;
    fetch('/api/validation/latest-broker-aware')
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || `VALIDATION_HTTP_${response.status}`);
        return payload as ExternalValidationResult;
      })
      .then(payload => { if (active) setExternalValidation(payload); })
      .catch((e: any) => { if (active) setExternalValidationError(e?.message || String(e)); });
    return () => { active = false; };
  }, []);

  const run = async () => {
    if (loadingPhase !== 'IDLE') return;
    const capital = Number(initialCapital);
    if (!(capital > 0)) { setError('El capital inicial debe ser mayor que cero.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate >= today()) { setError('Elige una fecha pasada válida.'); return; }
    setError(null);
    setDynamicResult(null);
    setHistoricalScan(null);
    try {
      setLoadingPhase('MARKET_DATA');
      const from = warmupDate(startDate);
      const nextHistoricalScan = await AssetUniverseScanner.scan(
        EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        from,
        today(),
        { forceRefresh: false, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7 }
      );
      setHistoricalCoverage({ accepted: nextHistoricalScan.accepted, scanned: nextHistoricalScan.scanned, from });
      if (nextHistoricalScan.acceptedDataset.assets.length < 1) throw new Error('No hay instrumentos con histórico REAL suficiente para esa fecha.');
      setHistoricalScan(nextHistoricalScan);
      setLoadingPhase('SIMULATION');
      await new Promise(resolve => window.setTimeout(resolve, 0));
      const result = DynamicHistoricalReplayEngine.run({
        dataset: nextHistoricalScan.acceptedDataset,
        catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        startDate,
        frequency,
        initialCapitalEur: capital,
        riskProfile,
        horizonYears,
        cashBenchmarkAnnualPct: CashBenchmarkService.load(),
        minimumBars: 252,
        taxSettings: SpanishTaxSettingsService.load()
      });
      setDynamicResult(result);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoadingPhase('IDLE');
    }
  };

  const firstSignalDate = useMemo(() => dynamicResult?.signals.map(signal => signal.signalDate).sort()[0] ?? null, [dynamicResult]);
  const firstRecommendations = useMemo(() => dynamicResult && firstSignalDate
    ? dynamicResult.signals.filter(signal => signal.signalDate === firstSignalDate).sort((a, b) => {
      const material = (signal: DynamicReplaySignal) => ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action) ? 0 : 1;
      return material(a) - material(b) || b.targetWeight - a.targetWeight;
    }).slice(0, 10)
    : [], [dynamicResult, firstSignalDate]);

  const initialHoldBenchmark = useMemo<InitialHoldBenchmark | null>(() => {
    if (!dynamicResult || !historicalScan || !firstSignalDate) return null;
    const initialBuys = dynamicResult.signals.filter(signal =>
      signal.signalDate === firstSignalDate && signal.executed && signal.unitsDelta > 0 && signal.executionDate
    );
    if (initialBuys.length === 0) {
      return {
        executionDate: null,
        finalValueEur: dynamicResult.allCashFinalEur,
        returnPct: dynamicResult.allCashReturnPct,
        residualCashAtExecutionEur: dynamicResult.initialCapitalEur,
        holdings: []
      };
    }
    const executionDate = initialBuys.map(signal => signal.executionDate!).sort().at(-1)!;
    const rate = CashBenchmarkService.load();
    const capitalAtExecution = allCashBenchmark(dynamicResult.initialCapitalEur, rate, dynamicResult.startDate, executionDate).finalEur;
    const spent = initialBuys.reduce((sum, signal) => sum + signal.notionalEur + signal.feeEur, 0);
    const residualCashAtExecutionEur = Math.max(0, capitalAtExecution - spent);
    const holdings = initialBuys.map(signal => ({ assetId: signal.assetId, units: signal.unitsDelta }));
    const investedFinal = holdings.reduce((sum, holding) => {
      const price = closeOnOrBefore(historicalScan, holding.assetId, dynamicResult.endDate);
      return sum + (price == null ? 0 : holding.units * price);
    }, 0);
    const residualFinal = allCashBenchmark(residualCashAtExecutionEur, rate, executionDate, dynamicResult.endDate).finalEur;
    const finalValueEur = investedFinal + residualFinal;
    return {
      executionDate,
      finalValueEur,
      returnPct: (finalValueEur / dynamicResult.initialCapitalEur - 1) * 100,
      residualCashAtExecutionEur,
      holdings
    };
  }, [dynamicResult, historicalScan, firstSignalDate]);

  const visibleSignals = useMemo(() => dynamicResult
    ? dynamicResult.signals.filter(signal => showAllSignals || ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action))
    : [], [dynamicResult, showAllSignals]);

  const chartData = useMemo(() => {
    if (!dynamicResult) return [];
    const eventMap = new Map<string, DynamicReplayEvent[]>();
    for (const event of dynamicResult.events) eventMap.set(event.date, [...(eventMap.get(event.date) ?? []), event]);
    const rate = CashBenchmarkService.load();
    return dynamicResult.equityPath.map(point => {
      const events = eventMap.get(point.date) ?? [];
      let initialHoldEur = point.cashBenchmarkEur;
      if (initialHoldBenchmark && historicalScan && initialHoldBenchmark.executionDate) {
        if (point.date < initialHoldBenchmark.executionDate) {
          initialHoldEur = allCashBenchmark(dynamicResult.initialCapitalEur, rate, dynamicResult.startDate, point.date).finalEur;
        } else {
          const invested = initialHoldBenchmark.holdings.reduce((sum, holding) => {
            const price = closeOnOrBefore(historicalScan, holding.assetId, point.date);
            return sum + (price == null ? 0 : holding.units * price);
          }, 0);
          const cash = allCashBenchmark(initialHoldBenchmark.residualCashAtExecutionEur, rate, initialHoldBenchmark.executionDate, point.date).finalEur;
          initialHoldEur = invested + cash;
        }
      }
      return { ...point, events, initialHoldEur, eventEquityEur: events.length ? point.equityEur : null };
    });
  }, [dynamicResult, historicalScan, initialHoldBenchmark]);

  const external = externalValidation?.payload?.outOfUniverseRobustness;
  const dynamicVsInitialEur = dynamicResult && initialHoldBenchmark ? dynamicResult.finalValueEur - initialHoldBenchmark.finalValueEur : null;
  const dynamicVsInitialPp = dynamicResult && initialHoldBenchmark ? dynamicResult.totalReturnPct - initialHoldBenchmark.returnPct : null;

  return <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-indigo-300"/><h2 className="font-bold text-white">Prueba histórica de la cartera</h2></div>
        <p className="mt-1 text-[11px] text-slate-400">Elige cualquier fecha pasada. La app vuelve a ese día usando solo la información que existía entonces, muestra qué habría recomendado y simula qué ocurriría hasta hoy obedeciendo las recomendaciones posteriores.</p>
      </div>
      <span className="rounded-full border border-indigo-500/25 bg-indigo-500/5 px-3 py-1 text-[9px] font-black text-indigo-200">CAUSAL · SIN MIRAR EL FUTURO</span>
    </div>

    <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Volver al día</span><input type="date" value={startDate} max={yearsAgo(0)} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full bg-transparent font-mono text-sm outline-none"/></label>
      <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Capital inicial simulado €</span><input type="number" min="1" step="100" value={initialCapital} onChange={e => setInitialCapital(e.target.value)} className="mt-1 w-full bg-transparent font-mono text-sm outline-none"/></label>
      <label className="rounded-xl border border-slate-700 bg-slate-950 p-3"><span className="text-[9px] uppercase text-slate-500">Cada cuánto obedecer avisos</span><select value={frequency} onChange={e => setFrequency(e.target.value as DynamicReplayFrequency)} className="mt-1 w-full bg-transparent text-sm outline-none"><option className="bg-slate-900" value="DAILY">Cada sesión · prueba más exigente</option><option className="bg-slate-900" value="WEEKLY">Semanal</option><option className="bg-slate-900" value="MONTHLY">Mensual</option><option className="bg-slate-900" value="QUARTERLY">Trimestral</option></select></label>
      <button type="button" onClick={() => void run()} disabled={loadingPhase !== 'IDLE'} className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><PlayCircle className="h-4 w-4"/>{loadingPhase === 'MARKET_DATA' ? 'Cargando histórico REAL…' : loadingPhase === 'SIMULATION' ? 'Simulando decisiones…' : 'Probar desde esa fecha'}</button>
    </div>
    <div className="mt-2 text-[9px] text-slate-500">Modo {frequencyLabel(frequency)}. Para fechas antiguas se descarga bajo demanda el histórico necesario; no se amplía el escaneo live de la pantalla principal.</div>
    {historicalCoverage && <div className="mt-2 text-[9px] text-slate-500">Última prueba: {historicalCoverage.accepted}/{historicalCoverage.scanned} instrumentos REAL utilizables · histórico solicitado desde {historicalCoverage.from}.</div>}
    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {dynamicResult && <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300"/><b className="text-sm text-cyan-100">Qué habría dicho la app al empezar</b></div>
        <div className="mt-1 text-[10px] text-slate-400">Fecha solicitada {dynamicResult.requestedStartDate} · primera decisión causal utilizable {firstSignalDate ?? dynamicResult.startDate}.</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{firstRecommendations.map(signal => <div key={signal.id} className={`rounded-lg border p-3 text-[10px] ${actionClass(signal.action)}`}><div className="flex items-start justify-between gap-2"><div><b>{actionLabel(signal.action)} · {signalLabel(signal)}</b><div className="mt-0.5 font-mono opacity-70">{signalCode(signal)}</div></div><span className="font-mono">objetivo {(signal.targetWeight * 100).toFixed(1)}%</span></div><div className="mt-1 opacity-80">consenso {signal.consensusScore ?? 'N/D'} · {signal.favorableVotes ?? 0}/5 favorables</div>{signal.executed && <div className="mt-1 font-mono">Ejecutado {signal.executionDate}: {signal.notionalEur.toFixed(2)} €</div>}</div>)}</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Siguiendo todos los avisos</div><b className="font-mono text-emerald-200">{dynamicResult.finalValueEur.toFixed(2)} €</b><div>{signed(dynamicResult.totalReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Primera cartera y mantener</div><b className="font-mono text-cyan-200">{initialHoldBenchmark ? initialHoldBenchmark.finalValueEur.toFixed(2) : 'N/D'} €</b><div>{initialHoldBenchmark ? `${signed(initialHoldBenchmark.returnPct)}%` : 'N/D'}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Valor de avisos posteriores</div><b className={dynamicVsInitialEur != null && dynamicVsInitialEur >= 0 ? 'font-mono text-emerald-200' : 'font-mono text-rose-200'}>{dynamicVsInitialEur == null ? 'N/D' : `${signed(dynamicVsInitialEur)} €`}</b><div>{dynamicVsInitialPp == null ? 'N/D' : `${signed(dynamicVsInitialPp)} pp`}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Todo en cuenta</div><b className="font-mono">{dynamicResult.allCashFinalEur.toFixed(2)} €</b><div>{signed(dynamicResult.allCashReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ventaja vs cuenta</div><b className={dynamicResult.excessFinalEurVsCash >= 0 ? 'font-mono text-emerald-200' : 'font-mono text-rose-200'}>{signed(dynamicResult.excessFinalEurVsCash)} €</b><div>{signed(dynamicResult.excessReturnVsCashPctPoints)} pp</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Drawdown</div><b className="font-mono text-amber-200">-{dynamicResult.decisionPathMaxDrawdownPct.toFixed(2)}%</b><div>{dynamicResult.decisions} decisiones</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Costes + fiscalidad</div><b className="font-mono">{(dynamicResult.totalFeesEur + dynamicResult.totalEstimatedTaxEur).toFixed(2)} €</b><div>comisiones {dynamicResult.totalFeesEur.toFixed(2)} · impuesto {dynamicResult.totalEstimatedTaxEur.toFixed(2)}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Traspasos</div><b className="font-mono text-violet-200">{dynamicResult.totalTransferredEur.toFixed(2)} €</b><div>interés cash +{dynamicResult.cashInterestEur.toFixed(2)} €</div></div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">Evolución del dinero siguiendo las recomendaciones</b><div className="text-[9px] text-slate-500">Compara la misma primera cartera mantenida sin cambios, seguir todos los avisos y dejar todo en cash. Los puntos de operación muestran compras, ventas y traspasos.</div></div><div className="text-[9px] text-slate-500">{dynamicResult.startDate} → {dynamicResult.endDate}</div></div>
        <div className="h-[360px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 5, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" minTickGap={38} tick={{ fontSize: 9, fill: '#94a3b8' }}/><YAxis width={72} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => `${Number(value).toFixed(0)}€`}/><Tooltip content={<ReplayTooltip/>}/><Legend wrapperStyle={{ fontSize: 10 }}/><Line type="monotone" dataKey="equityEur" name="Siguiendo la app" stroke="#22c55e" strokeWidth={2} dot={false}/><Line type="monotone" dataKey="initialHoldEur" name="Primera cartera y mantener" stroke="#22d3ee" strokeWidth={1.5} dot={false}/><Line type="monotone" dataKey="cashBenchmarkEur" name="Todo en cuenta remunerada" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="5 4"/><Scatter dataKey="eventEquityEur" name="Operación" fill="#eab308"/></ComposedChart></ResponsiveContainer></div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-cyan-300"/><b className="text-sm">Operaciones y costes del camino</b></div><ChevronDown className="h-4 w-4"/></summary>
          <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto border-t border-slate-800 pt-3">{dynamicResult.events.map(event => <div key={event.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-[10px]"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1">{event.type === 'BUY' || event.type === 'ADD' ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300"/> : event.type === 'REDUCE' || event.type === 'EXIT' ? <ArrowDownRight className="h-3.5 w-3.5 text-rose-300"/> : <ArrowRightLeft className="h-3.5 w-3.5 text-violet-300"/>}<b className={eventClass(event.type)}>{event.label}</b></span><span className="font-mono text-slate-500">{event.date}</span></div><div className="mt-1 text-slate-400">{event.detail}</div></div>)}{dynamicResult.events.length === 0 && <div className="text-slate-500">No hubo operaciones ejecutables en el periodo.</div>}</div>
        </details>

        <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><b className="text-sm">Todas las decisiones, incluidas mantener/no comprar</b><ChevronDown className="h-4 w-4"/></summary>
          <div className="mt-3 border-t border-slate-800 pt-3"><button type="button" onClick={() => setShowAllSignals(v => !v)} className="mb-3 rounded-lg border border-slate-700 px-3 py-2 text-[10px]">{showAllSignals ? 'Mostrar solo operaciones' : 'Incluir mantener / no comprar'}</button><div className="max-h-[390px] space-y-2 overflow-y-auto">{visibleSignals.slice(0, 500).map(signal => <div key={signal.id} className={`rounded-lg border p-3 text-[10px] ${actionClass(signal.action)}`}><div className="flex items-start justify-between gap-2"><div><b>{actionLabel(signal.action)} · {signalLabel(signal)}</b><div className="font-mono opacity-60">{signalCode(signal)}</div></div><span className="font-mono">{signal.signalDate}</span></div><div className="mt-1 opacity-80">consenso {signal.consensusScore ?? 'N/D'} · {signal.favorableVotes ?? 0} favorables / {signal.unfavorableVotes ?? 0} adversas{signal.structuralDowntrend ? ' · deterioro estructural' : ''}</div></div>)}</div></div>
        </details>
      </div>

      <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-200">Supuestos, límites y fiscalidad de esta simulación</summary><div className="mt-3 space-y-1 border-t border-slate-800 pt-3 text-[10px] text-slate-400">{dynamicResult.notes.map(note => <div key={note}>• {note}</div>)}<div>• Comparación “Primera cartera y mantener”: congela exactamente las compras ejecutadas de la primera decisión dinámica, mantiene esas unidades hasta el final y remunera solo el cash residual. No usa el shortlist del replay histórico antiguo.</div><div>• Método fiscal usado: <b>{dynamicResult.taxMethod === 'CONFIGURED_PROGRESSIVE' ? 'escala progresiva configurada' : '30% conservador sobre plusvalías imponibles'}</b>.</div></div></details>
    </div>}

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <summary className="cursor-pointer text-xs font-bold text-slate-300">Validación externa y casos aleatorios anteriores</summary>
      <div className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-400">
        {externalValidationError && <div className="text-amber-200">No se pudo cargar la última validación externa: {externalValidationError}</div>}
        {!external && !externalValidationError && <div>Cargando último resultado externo registrado…</div>}
        {external && <div className="grid gap-2 sm:grid-cols-4"><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Activos externos válidos</div><b>{external.pool?.accepted ?? 0}</b></div><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Escenarios aleatorios</div><b>{external.randomSample?.replay?.summary?.scenarioCount ?? 0}</b></div><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó a mantener</div><b>{external.randomSample?.replay?.summary?.scenariosBeatingStatic ?? 0}/{external.randomSample?.replay?.summary?.scenarioCount ?? 0}</b></div><div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó al cash</div><b>{external.randomSample?.replay?.summary?.scenariosBeatingCash ?? 0}/{external.randomSample?.replay?.summary?.scenarioCount ?? 0}</b></div></div>}
        {externalValidation?.recordedAt && <div className="mt-2 font-mono text-[9px] text-slate-600">Resultado registrado {externalValidation.recordedAt}</div>}
      </div>
    </details>

    <div className="mt-3 text-[9px] text-slate-600">El escaneo live actual sigue usando su ventana corta para mantener fluidez. Esta prueba histórica larga solo se descarga cuando tú la ejecutas expresamente.</div>
  </section>;
};