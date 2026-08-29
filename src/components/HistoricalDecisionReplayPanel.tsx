import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarRange, ChevronDown, GitCompareArrows, PlayCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CashBenchmarkService,
  DynamicHistoricalReplayEngine,
  EUR_ASSET_UNIVERSE,
  HistoricalDecisionReplayEngine,
  historicalStartDates,
  type AssetUniverseScanResult,
  type DynamicHistoricalReplayResult,
  type DynamicReplayFrequency,
  type DynamicReplaySignal,
  type HistoricalDecisionReplayBatchResult,
  type InvestmentHorizonYears,
  type InvestorRiskProfile
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
}

interface ExternalScenario {
  startDate: string;
  totalReturnPct: number;
  staticBuyHoldReturnPct: number | null;
  allCashReturnPct: number;
}
interface ExternalLossEpisode {
  assetId: string;
  ticker: string;
  name: string;
  window: '6M' | '12M';
  startDate: string;
  endDate: string;
  returnPct: number;
  maxDrawdownPct: number;
}
interface ExternalLossResponse {
  episode: ExternalLossEpisode;
  evaluated: boolean;
  responseDuringLossWindow?: {
    signalCounts: Record<string, number>;
    executedBuyOrAdd: boolean;
    everAvoided: boolean;
    reducedOrExited: boolean;
    firstDefensiveSignalDate: string | null;
  };
}
interface ExternalValidationResult {
  recordedAt?: string;
  payload?: {
    outOfUniverseRobustness?: {
      pool?: {
        accepted?: number;
        rejected?: number;
        acceptedMutualFunds?: string[];
        acceptedEtfs?: string[];
        rejectedInstruments?: Array<{ ticker: string; instrumentType: string; reason: string }>;
      };
      randomSample?: {
        tickers?: string[];
        replay?: {
          summary?: { scenarioCount?: number; scenariosBeatingStatic?: number; scenariosBeatingCash?: number };
          scenarios?: ExternalScenario[];
        };
      };
      historicalNegativeWindowStress?: {
        worst6mEpisodes?: ExternalLossEpisode[];
        worst12mEpisodes?: ExternalLossEpisode[];
        evaluatedEpisodes?: number;
        episodesWithDefensiveSignal?: number;
        episodesWithExecutedBuyOrAdd?: number;
        responses?: ExternalLossResponse[];
      };
    };
  };
}

function signed(value: number | null, digits = 2): string {
  if (value == null) return 'N/D';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}
function actionClass(action: DynamicReplaySignal['action']): string {
  if (action === 'BUY' || action === 'ADD') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (action === 'REDUCE' || action === 'EXIT') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  if (action === 'AVOID') return 'border-amber-500/25 bg-amber-500/5 text-amber-200';
  return 'border-slate-700 bg-slate-950 text-slate-300';
}
function actionLabel(action: DynamicReplaySignal['action']): string {
  if (action === 'BUY') return 'COMPRAR';
  if (action === 'ADD') return 'AÑADIR';
  if (action === 'REDUCE') return 'REDUCIR';
  if (action === 'EXIT') return 'SALIR';
  if (action === 'AVOID') return 'NO COMPRAR';
  return 'MANTENER';
}
function lossResponseLabel(response: ExternalLossResponse): string {
  const counts = response.responseDuringLossWindow?.signalCounts ?? {};
  if ((counts.EXIT ?? 0) > 0) return 'SALIR';
  if ((counts.REDUCE ?? 0) > 0) return 'REDUCIR';
  if ((counts.AVOID ?? 0) > 0 && !response.responseDuringLossWindow?.executedBuyOrAdd) return 'NO COMPRAR';
  if ((counts.BUY ?? 0) > 0 || (counts.ADD ?? 0) > 0) return 'COMPRAR / AÑADIR';
  if ((counts.HOLD ?? 0) > 0) return 'MANTENER';
  return 'SIN SEÑAL';
}

export const HistoricalDecisionReplayPanel: React.FC<Props> = ({ scan, capitalEur, riskProfile, horizonYears }) => {
  const starts = useMemo(() => historicalStartDates(scan.acceptedDataset, 'ANNUAL'), [scan]);
  const [startDate, setStartDate] = useState(() => starts[0] ?? '');
  const [frequency, setFrequency] = useState<DynamicReplayFrequency>('MONTHLY');
  const [dynamicResult, setDynamicResult] = useState<DynamicHistoricalReplayResult | null>(null);
  const [robustnessResult, setRobustnessResult] = useState<HistoricalDecisionReplayBatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [externalValidation, setExternalValidation] = useState<ExternalValidationResult | null>(null);
  const [externalValidationError, setExternalValidationError] = useState<string | null>(null);
  const benchmark = CashBenchmarkService.load();

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

  const run = () => {
    if (loading || !startDate) return;
    setLoading(true);
    setError(null);
    window.setTimeout(() => {
      try {
        setDynamicResult(DynamicHistoricalReplayEngine.run({
          dataset: scan.acceptedDataset,
          catalog: EUR_ASSET_UNIVERSE,
          startDate,
          frequency,
          initialCapitalEur: Math.max(1, capitalEur),
          riskProfile,
          horizonYears,
          cashBenchmarkAnnualPct: CashBenchmarkService.load(),
          minimumBars: 252
        }));
        setRobustnessResult(HistoricalDecisionReplayEngine.run({
          dataset: scan.acceptedDataset,
          catalog: EUR_ASSET_UNIVERSE,
          frequency: 'ANNUAL',
          initialCapitalEur: Math.max(1, capitalEur),
          riskProfile,
          horizonYears,
          cashBenchmarkAnnualPct: CashBenchmarkService.load(),
          minimumBars: 252
        }));
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  const visibleSignals = dynamicResult
    ? dynamicResult.signals.filter(signal => showAllSignals || ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action))
    : [];
  const external = externalValidation?.payload?.outOfUniverseRobustness;
  const externalScenarios = external?.randomSample?.replay?.scenarios ?? [];
  const randomChartData = externalScenarios.map(item => ({ start: item.startDate, dynamic: item.totalReturnPct, static: item.staticBuyHoldReturnPct ?? 0, cash: item.allCashReturnPct }));
  const lossStress = external?.historicalNegativeWindowStress;
  const lossEpisodes = [...(lossStress?.worst6mEpisodes ?? []), ...(lossStress?.worst12mEpisodes ?? [])];
  const worstVisible = [...lossEpisodes].sort((a, b) => a.returnPct - b.returnPct).slice(0, 3);
  const lossChartData = lossEpisodes.map(item => ({ episode: `${item.ticker} · ${item.window}`, returnPct: item.returnPct, drawdownPct: -Math.abs(item.maxDrawdownPct) }));
  const fundFailures = external?.pool?.rejectedInstruments?.filter(item => item.instrumentType === 'MUTUAL_FUND') ?? [];

  return <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl"><div className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-indigo-300"/><h2 className="font-bold text-white">¿Funciona también fuera de los casos cómodos?</h2></div><p className="mt-1 text-[11px] text-slate-400">Primero muestra la evidencia REAL con activos externos y caídas históricas. Después, si quieres, puedes reconstruir una fecha concreta de tu universo habitual.</p></div>
      <div className="flex flex-wrap gap-2"><select value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">{starts.map(date => <option key={date} value={date}>Desde {date}</option>)}</select><select value={frequency} onChange={e => setFrequency(e.target.value as DynamicReplayFrequency)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"><option value="MONTHLY">Revisar cada mes</option><option value="QUARTERLY">Revisar cada trimestre</option></select><button onClick={run} disabled={loading || !startDate} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PlayCircle className="h-3.5 w-3.5"/>{loading ? 'Analizando…' : 'Analizar una fecha'}</button></div>
    </div>

    <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><b className="text-sm text-cyan-100">Pruebas con activos que NO son los de siempre</b><div className="mt-1 text-[10px] text-slate-400">Se cargan automáticamente desde la última validación REAL registrada.</div></div>{externalValidation?.recordedAt && <span className="font-mono text-[9px] text-slate-500">{externalValidation.recordedAt}</span>}</div>
      {externalValidationError && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">No se pudo cargar la evidencia externa: {externalValidationError}</div>}
      {!external && !externalValidationError && <div className="mt-3 text-xs text-slate-500">Cargando evidencia externa…</div>}
      {external && <>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Activos externos aceptados</div><b>{external.pool?.accepted ?? 0}</b></div>
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Muestra aleatoria</div><b>{external.randomSample?.tickers?.length ?? 0}</b></div>
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó a mantener</div><b className="text-emerald-200">{external.randomSample?.replay?.summary?.scenariosBeatingStatic ?? 0}/{external.randomSample?.replay?.summary?.scenarioCount ?? 0}</b></div>
          <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Ganó al cash</div><b className="text-emerald-200">{external.randomSample?.replay?.summary?.scenariosBeatingCash ?? 0}/{external.randomSample?.replay?.summary?.scenarioCount ?? 0}</b></div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">{worstVisible.map(episode => {
          const response = lossStress?.responses?.find(item => item.episode.assetId === episode.assetId && item.episode.window === episode.window && item.episode.startDate === episode.startDate);
          return <div key={`${episode.assetId}_${episode.window}_${episode.startDate}`} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3"><div className="flex items-center justify-between gap-2"><b className="font-mono text-xs text-white">{episode.ticker} · {episode.window}</b><span className="text-[10px] font-bold text-cyan-200">{response ? lossResponseLabel(response) : 'ESTRÉS'}</span></div><div className="mt-1 font-mono text-lg font-black text-rose-200">{episode.returnPct.toFixed(2)}%</div><div className="text-[9px] text-slate-500">DD -{episode.maxDrawdownPct.toFixed(2)}% · {episode.startDate} → {episode.endDate}</div></div>;
        })}</div>
        <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-200">Ver gráficas y todos los casos externos</summary><div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="mb-2 text-xs font-bold">Muestra aleatoria externa</div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={randomChartData}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="start" tick={{ fontSize: 9, fill: '#94a3b8' }}/><YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => `${Number(value).toFixed(0)}%`}/><Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`}/><Legend wrapperStyle={{ fontSize: 10 }}/><Bar dataKey="dynamic" name="Seguir avisos"/><Bar dataKey="static" name="Comprar y mantener"/><Bar dataKey="cash" name="Cash"/></BarChart></ResponsiveContainer></div><div className="mt-2 flex flex-wrap gap-1">{external.randomSample?.tickers?.map(ticker => <span key={ticker} className="rounded bg-slate-900 px-2 py-1 font-mono text-[9px]">{ticker}</span>)}</div></div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="mb-2 text-xs font-bold">Peores ventanas reales de 6/12 meses</div><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={lossChartData} layout="vertical" margin={{ left: 65 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => `${Number(value).toFixed(0)}%`}/><YAxis type="category" dataKey="episode" width={100} tick={{ fontSize: 9, fill: '#94a3b8' }}/><Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`}/><Legend wrapperStyle={{ fontSize: 10 }}/><Bar dataKey="returnPct" name="Retorno ventana"/><Bar dataKey="drawdownPct" name="Drawdown máximo"/></BarChart></ResponsiveContainer></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{lossStress?.responses?.map(response => <div key={`${response.episode.assetId}_${response.episode.window}_${response.episode.startDate}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-[10px]"><div className="flex items-center justify-between gap-2"><b>{response.episode.ticker} · {response.episode.window}</b><b className="text-cyan-200">{lossResponseLabel(response)}</b></div><div className="mt-1 text-slate-400">{signed(response.episode.returnPct)}% · {Object.entries(response.responseDuringLossWindow?.signalCounts ?? {}).map(([key, value]) => `${key} ${value}`).join(' · ') || 'sin señales'}</div></div>)}</div></div>
        </div></details>
        {fundFailures.length > 0 && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">Los fondos externos no entraron en esta ejecución: {fundFailures.map(item => `${item.ticker}: ${item.reason}`).join(' · ')}. La evidencia externa visible corresponde por ahora a ETFs/ETCs REAL.</div>}
      </>}
    </div>

    <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] text-sky-100">Los tests externos y de pérdidas son evidencia de robustez/estrés, no datos de la cartera actual. Las decisiones históricas usan solo lo conocido en cada fecha.</div>
    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {dynamicResult && <div className="mt-4 space-y-4">
      <div className="grid gap-2 sm:grid-cols-3 text-xs"><div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Siguiendo avisos</div><b className="font-mono">{dynamicResult.finalValueEur.toFixed(2)} € · {signed(dynamicResult.totalReturnPct)}%</b></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Comprar y mantener</div><b className="font-mono">{dynamicResult.staticBuyHoldFinalEur?.toFixed(2) ?? 'N/D'} € · {signed(dynamicResult.staticBuyHoldReturnPct)}%</b></div><div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Cash</div><b className="font-mono">{dynamicResult.allCashFinalEur.toFixed(2)} € · {signed(dynamicResult.allCashReturnPct)}%</b></div></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="mb-2 text-xs font-bold">Evolución del capital</div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={dynamicResult.equityPath}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} minTickGap={28}/><YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => `${Number(value).toFixed(0)}€`}/><Tooltip formatter={(value: number) => `${Number(value).toFixed(2)} €`}/><Line type="monotone" dataKey="equityEur" name="Patrimonio" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></div>
      <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-cyan-300"/><b className="text-sm">Ver avisos históricos</b></div><ChevronDown className="h-4 w-4"/></summary><div className="mt-3 border-t border-slate-800 pt-3"><button onClick={() => setShowAllSignals(v => !v)} className="mb-3 rounded-lg border border-slate-700 px-3 py-2 text-[10px]">{showAllSignals ? 'Solo operativos' : 'Incluir mantener/no comprar'}</button><div className="max-h-[420px] space-y-2 overflow-y-auto">{visibleSignals.map(signal => <div key={signal.id} className={`rounded-lg border p-3 ${actionClass(signal.action)}`}><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1">{signal.action === 'BUY' || signal.action === 'ADD' ? <ArrowUpRight className="h-3.5 w-3.5"/> : signal.action === 'REDUCE' || signal.action === 'EXIT' ? <ArrowDownRight className="h-3.5 w-3.5"/> : null}<b>{actionLabel(signal.action)} · {signal.ticker}</b></span><span className="font-mono text-[9px]">{signal.signalDate}</span></div><div className="mt-1 text-[9px] opacity-80">consenso {signal.consensusScore ?? 'N/D'} · {signal.favorableVotes ?? 0} favorables / {signal.unfavorableVotes ?? 0} adversas{signal.structuralDowntrend ? ' · deterioro estructural' : ''}</div></div>)}</div></div></details>
      {robustnessResult && <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-300"/><b className="text-sm">Robustez por distintas fechas de inicio</b></div><ChevronDown className="h-4 w-4"/></summary><div className="mt-3 grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-4 text-xs"><div className="rounded-lg bg-slate-900 p-3">Fechas <b>{robustnessResult.successfulCases}/{robustnessResult.requestedDates.length}</b></div><div className="rounded-lg bg-slate-900 p-3">Ganó cash <b>{robustnessResult.beatsCashPct.toFixed(0)}%</b></div><div className="rounded-lg bg-slate-900 p-3">Retorno mediano <b>{signed(robustnessResult.medianReturnPct)}%</b></div><div className="rounded-lg bg-slate-900 p-3">Exceso vs cash <b>{signed(robustnessResult.medianExcessPctPoints)} pp</b></div></div></details>}
      <div className="text-[10px] text-slate-500">Periodo {dynamicResult.startDate} → {dynamicResult.endDate}. Benchmark cash {benchmark.toFixed(2)}% anual.</div>
    </div>}
  </section>;
};
