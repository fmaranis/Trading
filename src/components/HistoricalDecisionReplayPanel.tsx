import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarRange, ChevronDown, ChevronUp, GitCompareArrows, PlayCircle } from 'lucide-react';
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
  type HistoricalDecisionReplayCase,
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
    everBoughtOrAdded: boolean;
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
          summary?: {
            scenarioCount?: number;
            scenariosBeatingStatic?: number;
            scenariosBeatingCash?: number;
          };
          scenarios?: ExternalScenario[];
        };
      };
      historicalNegativeWindowStress?: {
        warning?: string;
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
  const [showRobustness, setShowRobustness] = useState(false);
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [externalValidation, setExternalValidation] = useState<ExternalValidationResult | null>(null);
  const [externalValidationLoading, setExternalValidationLoading] = useState(false);
  const [externalValidationError, setExternalValidationError] = useState<string | null>(null);
  const benchmark = CashBenchmarkService.load();

  useEffect(() => {
    if (!showRobustness || externalValidation || externalValidationLoading) return;
    let active = true;
    setExternalValidationLoading(true);
    setExternalValidationError(null);
    fetch('/api/validation/latest-broker-aware')
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || `VALIDATION_HTTP_${response.status}`);
        return payload as ExternalValidationResult;
      })
      .then(payload => { if (active) setExternalValidation(payload); })
      .catch((e: any) => { if (active) setExternalValidationError(e?.message || String(e)); })
      .finally(() => { if (active) setExternalValidationLoading(false); });
    return () => { active = false; };
  }, [showRobustness, externalValidation, externalValidationLoading]);

  const run = () => {
    if (loading || !startDate) return;
    setLoading(true);
    setError(null);
    setDynamicResult(null);
    setRobustnessResult(null);
    window.setTimeout(() => {
      try {
        const dynamic = DynamicHistoricalReplayEngine.run({
          dataset: scan.acceptedDataset,
          catalog: EUR_ASSET_UNIVERSE,
          startDate,
          frequency,
          initialCapitalEur: Math.max(1, capitalEur),
          riskProfile,
          horizonYears,
          cashBenchmarkAnnualPct: CashBenchmarkService.load(),
          minimumBars: 252
        });
        const robustness = HistoricalDecisionReplayEngine.run({
          dataset: scan.acceptedDataset,
          catalog: EUR_ASSET_UNIVERSE,
          frequency: 'ANNUAL',
          initialCapitalEur: Math.max(1, capitalEur),
          riskProfile,
          horizonYears,
          cashBenchmarkAnnualPct: CashBenchmarkService.load(),
          minimumBars: 252
        });
        setDynamicResult(dynamic);
        setRobustnessResult(robustness);
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
  const randomChartData = externalScenarios.map(item => ({
    start: item.startDate,
    dynamic: item.totalReturnPct,
    static: item.staticBuyHoldReturnPct ?? 0,
    cash: item.allCashReturnPct
  }));
  const lossStress = external?.historicalNegativeWindowStress;
  const lossEpisodes = [...(lossStress?.worst6mEpisodes ?? []), ...(lossStress?.worst12mEpisodes ?? [])];
  const lossChartData = lossEpisodes.map(item => ({
    episode: `${item.ticker} · ${item.window}`,
    returnPct: item.returnPct,
    drawdownPct: -Math.abs(item.maxDrawdownPct)
  }));

  return <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-indigo-300"/><h2 className="font-bold text-white">Cómo habría funcionado esta decisión en el pasado</h2></div>
        <p className="mt-1 text-[11px] text-slate-400">Un único análisis histórico: reconstruye lo que la app habría sabido en cada fecha, sigue sus avisos posteriores y compara esa gestión con comprar la primera recomendación y mantenerla, y con dejar el capital en efectivo remunerado al {benchmark.toFixed(2)}%.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={startDate} onChange={e => { setStartDate(e.target.value); setDynamicResult(null); setRobustnessResult(null); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
          {starts.map(date => <option key={date} value={date}>Desde {date}</option>)}
        </select>
        <select value={frequency} onChange={e => { setFrequency(e.target.value as DynamicReplayFrequency); setDynamicResult(null); setRobustnessResult(null); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
          <option value="MONTHLY">Revisar cada mes</option>
          <option value="QUARTERLY">Revisar cada trimestre</option>
        </select>
        <button onClick={run} disabled={loading || !startDate} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PlayCircle className="h-3.5 w-3.5"/>{loading ? 'Analizando…' : dynamicResult ? 'Recalcular' : 'Analizar histórico'}</button>
      </div>
    </div>

    <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] text-sky-100">Usa únicamente datos disponibles en cada fecha. No busca compras o ventas perfectas a posteriori: una reducción solo aparece si entonces existía deterioro estructural suficiente y la asignación también pedía menos exposición.</div>
    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {dynamicResult && <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6 text-xs">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Siguiendo avisos</div><b className="font-mono">{dynamicResult.finalValueEur.toFixed(2)} €</b><div className={dynamicResult.totalReturnPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(dynamicResult.totalReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Comprar y mantener</div><b className="font-mono">{dynamicResult.staticBuyHoldFinalEur == null ? 'N/D' : `${dynamicResult.staticBuyHoldFinalEur.toFixed(2)} €`}</b><div className={(dynamicResult.staticBuyHoldReturnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(dynamicResult.staticBuyHoldReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Solo efectivo</div><b className="font-mono">{dynamicResult.allCashFinalEur.toFixed(2)} €</b><div className="text-slate-400">{signed(dynamicResult.allCashReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Valor de gestionar</div><b className={`font-mono ${(dynamicResult.excessFinalEurVsStatic ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{dynamicResult.excessFinalEurVsStatic == null ? 'N/D' : `${signed(dynamicResult.excessFinalEurVsStatic)} €`}</b><div className="text-[9px] text-slate-500">{signed(dynamicResult.excessReturnVsStaticPctPoints)} pp vs mantener</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">vs efectivo</div><b className={`font-mono ${dynamicResult.excessFinalEurVsCash >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{signed(dynamicResult.excessFinalEurVsCash)} €</b><div className="text-[9px] text-slate-500">{signed(dynamicResult.excessReturnVsCashPctPoints)} pp</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Drawdown</div><b className="font-mono text-amber-200">-{dynamicResult.decisionPathMaxDrawdownPct.toFixed(2)}%</b><div className="text-[9px] text-slate-600">trayectoria observada</div></div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-3"><b className="text-sm text-white">Evolución del capital siguiendo los avisos</b><div className="text-[9px] text-slate-500">Curva observada en los puntos de decisión/ejecución; el área entre decisiones no es una serie diaria.</div></div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dynamicResult.equityPath} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} minTickGap={28} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} width={58} tickFormatter={value => `${Number(value).toFixed(0)}€`} />
              <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} formatter={(value: number) => [`${Number(value).toFixed(2)} €`, 'Patrimonio']} />
              <Line type="monotone" dataKey="equityEur" name="Patrimonio" stroke="#818cf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-[10px]">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><span className="text-slate-500">Revisiones</span><b className="ml-2">{dynamicResult.decisions}</b></div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"><span className="text-slate-500">Compras / aumentos</span><b className="ml-2 text-emerald-200">{dynamicResult.executedBuys + dynamicResult.executedAdds}</b></div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3"><span className="text-slate-500">Reducciones / salidas</span><b className="ml-2 text-rose-200">{dynamicResult.executedReductions + dynamicResult.executedExits}</b></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><span className="text-slate-500">Comisiones</span><b className="ml-2 font-mono">{dynamicResult.totalFeesEur.toFixed(2)} €</b></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><span className="text-slate-500">Interés cash</span><b className="ml-2 font-mono">{dynamicResult.cashInterestEur.toFixed(2)} €</b></div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60">
        <div className="flex flex-col gap-2 border-b border-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-cyan-300"/><b className="text-sm">Qué avisos habría recibido</b></div><div className="mt-1 text-[9px] text-slate-500">Se muestran primero las señales que podían cambiar una posición. Mantener/no comprar queda disponible para auditoría.</div></div>
          <button onClick={() => setShowAllSignals(v => !v)} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300">{showAllSignals ? 'Solo avisos operativos' : 'Ver también mantener/no comprar'}</button>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-3">
          {visibleSignals.length === 0 && <div className="rounded-lg border border-slate-800 p-4 text-xs text-slate-500">No hubo avisos operativos con estas reglas y este periodo.</div>}
          <div className="space-y-2">{visibleSignals.map(signal => <div key={signal.id} className={`rounded-xl border p-3 ${actionClass(signal.action)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">{signal.action === 'BUY' || signal.action === 'ADD' ? <ArrowUpRight className="h-4 w-4"/> : signal.action === 'REDUCE' || signal.action === 'EXIT' ? <ArrowDownRight className="h-4 w-4"/> : null}<b>{actionLabel(signal.action)} · {signal.ticker}</b></div>
              <div className="font-mono text-[10px]">{signal.signalDate}{signal.executed && signal.executionDate ? ` → ${signal.executionDate}` : ''}</div>
            </div>
            <div className="mt-1 text-[10px] text-slate-300">Peso {Math.max(0, signal.currentWeight * 100).toFixed(1)}% → objetivo {(signal.targetWeight * 100).toFixed(1)}% · consenso {signal.consensusScore == null ? 'N/D' : `${signal.consensusScore > 0 ? '+' : ''}${signal.consensusScore}`} · {signal.favorableVotes ?? 0} favorables / {signal.unfavorableVotes ?? 0} adversas{signal.buyTheDipCandidate ? ' · buy-the-dip' : ''}{signal.structuralDowntrend ? ' · deterioro estructural' : ''}</div>
            {signal.executed && <div className="mt-1 font-mono text-[10px] text-white">Ejecutado: {signal.unitsDelta > 0 ? '+' : ''}{signal.unitsDelta.toFixed(4)} uds · {signal.notionalEur.toFixed(2)} € · precio {signal.executionPriceEur?.toFixed(2) ?? 'N/D'} € · comisión {signal.feeEur.toFixed(2)} €</div>}
            <div className="mt-1 text-[9px] text-slate-400">{signal.reason}</div>
          </div>)}</div>
        </div>
      </div>

      {robustnessResult && <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50">
        <button onClick={() => setShowRobustness(v => !v)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
          <div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-300"/><b className="text-sm">¿Depende demasiado de la fecha o de los activos elegidos?</b></div><div className="mt-1 text-[9px] text-slate-500">Una sola comprobación de robustez: distintas fechas del catálogo principal y última validación REAL con activos externos y episodios históricos perdedores.</div></div>
          {showRobustness ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
        </button>
        {showRobustness && <div className="border-t border-slate-800 p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
            <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Fechas válidas</span><div className="font-bold">{robustnessResult.successfulCases}/{robustnessResult.requestedDates.length}</div></div>
            <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Superó efectivo</span><div className={robustnessResult.beatsCashPct >= 50 ? 'font-bold text-emerald-200' : 'font-bold text-amber-200'}>{robustnessResult.beatsCashPct.toFixed(0)}%</div></div>
            <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Retorno mediano</span><div className="font-mono font-bold">{signed(robustnessResult.medianReturnPct)}%</div></div>
            <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Exceso mediano vs cash</span><div className="font-mono font-bold">{signed(robustnessResult.medianExcessPctPoints)} pp</div></div>
          </div>
          <div className="mt-3 space-y-2">{robustnessResult.cases.map((item: HistoricalDecisionReplayCase) => <article key={`${item.requestedDate}_${item.decisionDate}`} className="rounded-lg border border-slate-800 bg-slate-900/60">
            <button onClick={() => setOpenCase(openCase === item.requestedDate ? null : item.requestedDate)} className="grid w-full gap-2 p-3 text-left md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
              <div><div className="text-[9px] uppercase text-slate-500">Inicio</div><b className="font-mono">{item.decisionDate}</b></div>
              <div><div className="text-[9px] uppercase text-slate-500">Valor final</div><b className="font-mono">{item.finalValueEur.toFixed(2)} €</b></div>
              <div><div className="text-[9px] uppercase text-slate-500">vs efectivo</div><b className={item.beatsCash ? 'font-mono text-emerald-200' : 'font-mono text-amber-200'}>{signed(item.excessReturnVsCashPctPoints)} pp</b></div>
              <div>{openCase === item.requestedDate ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</div>
            </button>
            {openCase === item.requestedDate && <div className="border-t border-slate-800 p-3 text-[10px] text-slate-400">{item.summary}</div>}
          </article>)}</div>

          <div className="mt-5 border-t border-slate-800 pt-4">
            <div className="mb-3"><b className="text-sm text-white">Prueba REAL con otros activos</b><div className="mt-1 text-[9px] text-slate-500">Última validación registrada fuera del catálogo productivo. No cambia las recomendaciones actuales ni se usa para ajustar umbrales.</div></div>
            {externalValidationLoading && <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">Cargando última validación REAL…</div>}
            {externalValidationError && <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">No se pudo cargar la validación externa: {externalValidationError}</div>}
            {external && <>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
                <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Activos externos aceptados</span><div className="font-bold">{external.pool?.accepted ?? 0}</div></div>
                <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Muestra aleatoria</span><div className="font-bold">{external.randomSample?.tickers?.length ?? 0}</div></div>
                <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Superó mantener</span><div className="font-bold text-emerald-200">{external.randomSample?.replay?.summary?.scenariosBeatingStatic ?? 0}/{external.randomSample?.replay?.summary?.scenarioCount ?? 0}</div></div>
                <div className="rounded-lg bg-slate-900 p-3"><span className="text-[9px] uppercase text-slate-500">Superó cash</span><div className="font-bold text-emerald-200">{external.randomSample?.replay?.summary?.scenariosBeatingCash ?? 0}/{external.randomSample?.replay?.summary?.scenarioCount ?? 0}</div></div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2"><b className="text-xs text-white">Muestra aleatoria externa: resultado por fecha de inicio</b><div className="text-[9px] text-slate-500">Seguir avisos frente a comprar y mantener y frente a efectivo remunerado.</div></div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={randomChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="start" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => `${Number(value).toFixed(0)}%`} />
                      <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="dynamic" name="Seguir avisos" fill="#818cf8" />
                      <Bar dataKey="static" name="Comprar y mantener" fill="#22d3ee" />
                      <Bar dataKey="cash" name="Cash" fill="#94a3b8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">{external.randomSample?.tickers?.map(ticker => <span key={ticker} className="rounded bg-slate-900 px-2 py-1 font-mono text-[9px] text-slate-300">{ticker}</span>)}</div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2"><b className="text-xs text-white">Caídas reales encontradas en otros activos</b><div className="text-[9px] text-slate-500">Peores ventanas históricas de 6 y 12 meses. Son pruebas de estrés ex post, no una muestra OOS para optimizar el sistema.</div></div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lossChartData} layout="vertical" margin={{ top: 8, right: 16, left: 70, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={value => `${Number(value).toFixed(0)}%`} />
                      <YAxis type="category" dataKey="episode" width={105} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="returnPct" name="Retorno ventana" fill="#fb7185" />
                      <Bar dataKey="drawdownPct" name="Drawdown máximo" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2">{lossStress?.responses?.map(response => <div key={`${response.episode.assetId}_${response.episode.window}_${response.episode.startDate}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-[10px]">
                  <div className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-white">{response.episode.ticker} · {response.episode.window}</b><span className={response.responseDuringLossWindow?.reducedOrExited || response.responseDuringLossWindow?.everAvoided ? 'font-bold text-emerald-200' : response.responseDuringLossWindow?.executedBuyOrAdd ? 'font-bold text-amber-200' : 'font-bold text-slate-300'}>{lossResponseLabel(response)}</span></div>
                  <div className="mt-1 text-slate-400">{response.episode.startDate} → {response.episode.endDate} · activo {signed(response.episode.returnPct)}% · DD -{response.episode.maxDrawdownPct.toFixed(2)}%</div>
                  <div className="mt-1 text-slate-500">Señales: {Object.entries(response.responseDuringLossWindow?.signalCounts ?? {}).map(([key, value]) => `${key} ${value}`).join(' · ') || 'ninguna'}{response.responseDuringLossWindow?.firstDefensiveSignalDate ? ` · primera defensiva ${response.responseDuringLossWindow.firstDefensiveSignalDate}` : ''}</div>
                </div>)}</div>
              </div>

              {(external.pool?.acceptedMutualFunds?.length ?? 0) === 0 && (external.pool?.rejectedInstruments?.length ?? 0) > 0 && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">Fondos tradicionales externos todavía no aceptados en esta ejecución. Motivos: {external.pool?.rejectedInstruments?.filter(item => item.instrumentType === 'MUTUAL_FUND').map(item => `${item.ticker}: ${item.reason}`).join(' · ') || 'sin detalle'}.</div>}
              <div className="mt-2 text-[9px] text-slate-600">Validación registrada: {externalValidation?.recordedAt ?? 'N/D'}.</div>
            </>}
          </div>
        </div>}
      </div>}

      <div className="mt-3 text-[10px] text-slate-500">Periodo analizado {dynamicResult.startDate} → {dynamicResult.endDate}. El universo es REAL y causal dentro del catálogo actualmente consultable; sigue existiendo sesgo de supervivencia del catálogo histórico.</div>
    </>}
  </section>;
};
