import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarRange, ChevronDown, ChevronUp, GitCompareArrows, PlayCircle } from 'lucide-react';
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
  const benchmark = CashBenchmarkService.load();

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
          <div><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-indigo-300"/><b className="text-sm">¿Depende demasiado de la fecha de inicio?</b></div><div className="mt-1 text-[9px] text-slate-500">Contraste adicional con distintas fechas históricas anuales. No es otro motor: es una comprobación de robustez del mismo análisis.</div></div>
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
        </div>}
      </div>}

      <div className="mt-3 text-[10px] text-slate-500">Periodo analizado {dynamicResult.startDate} → {dynamicResult.endDate}. El universo es REAL y causal dentro del catálogo actualmente consultable; sigue existiendo sesgo de supervivencia del catálogo histórico.</div>
    </>}
  </section>;
};
