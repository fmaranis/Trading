import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, GitCompareArrows, PlayCircle } from 'lucide-react';
import {
  CashBenchmarkService,
  DynamicHistoricalReplayEngine,
  EUR_ASSET_UNIVERSE,
  historicalStartDates,
  type AssetUniverseScanResult,
  type DynamicHistoricalReplayResult,
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

export const DynamicHistoricalReplayPanel: React.FC<Props> = ({ scan, capitalEur, riskProfile, horizonYears }) => {
  const starts = useMemo(() => historicalStartDates(scan.acceptedDataset, 'ANNUAL'), [scan]);
  const [startDate, setStartDate] = useState(() => starts[0] ?? '');
  const [frequency, setFrequency] = useState<DynamicReplayFrequency>('MONTHLY');
  const [result, setResult] = useState<DynamicHistoricalReplayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const benchmark = CashBenchmarkService.load();

  const run = () => {
    if (loading || !startDate) return;
    setLoading(true); setError(null); setResult(null);
    window.setTimeout(() => {
      try {
        setResult(DynamicHistoricalReplayEngine.run({
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
      } catch (e: any) { setError(e?.message || String(e)); }
      finally { setLoading(false); }
    }, 0);
  };

  const visibleSignals = result
    ? result.signals.filter(signal => showAllSignals || ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action))
    : [];

  return <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-cyan-300"/><h2 className="font-bold text-white">¿Habría mejorado seguir todos los avisos posteriores?</h2></div>
        <p className="mt-1 text-[11px] text-slate-400">Replay dinámico causal: reconstruye la cartera en cada fecha, vuelve a calcular shortlist, régimen, asignación y consenso, y simula los avisos posteriores de comprar, añadir, mantener, no comprar o reducir. Compara el resultado con comprar la primera recomendación y no tocarla, y con mantener todo el capital en efectivo remunerado al {benchmark.toFixed(2)}%.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={startDate} onChange={e => { setStartDate(e.target.value); setResult(null); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
          {starts.map(date => <option key={date} value={date}>Inicio {date}</option>)}
        </select>
        <select value={frequency} onChange={e => { setFrequency(e.target.value as DynamicReplayFrequency); setResult(null); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
          <option value="MONTHLY">Revisar cada mes</option>
          <option value="QUARTERLY">Revisar cada trimestre</option>
        </select>
        <button onClick={run} disabled={loading || !startDate} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><PlayCircle className="h-3.5 w-3.5"/>{loading ? 'Recorriendo histórico…' : result ? 'Recalcular' : 'Seguir avisos históricos'}</button>
      </div>
    </div>

    <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-[10px] text-sky-100">Regla anti-hindsight: una caída posterior nunca crea una venta retrospectiva. La reducción solo aparece si, en aquella fecha, el consenso causal marcaba <b>REDUCE_REVIEW</b> y la asignación objetivo también pedía menos exposición. Una compra nueva exige consenso <b>BUY</b>; una ampliación exige <b>ADD</b>.</div>
    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {result && <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6 text-xs">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Siguiendo avisos</div><b className="font-mono">{result.finalValueEur.toFixed(2)} €</b><div className={result.totalReturnPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(result.totalReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Compra inicial + mantener</div><b className="font-mono">{result.staticBuyHoldFinalEur == null ? 'N/D' : `${result.staticBuyHoldFinalEur.toFixed(2)} €`}</b><div className={(result.staticBuyHoldReturnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(result.staticBuyHoldReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Solo efectivo</div><b className="font-mono">{result.allCashFinalEur.toFixed(2)} €</b><div className="text-slate-400">{signed(result.allCashReturnPct)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Valor de los avisos</div><b className={`font-mono ${(result.excessFinalEurVsStatic ?? 0) >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>{result.excessFinalEurVsStatic == null ? 'N/D' : `${signed(result.excessFinalEurVsStatic)} €`}</b><div className="text-[9px] text-slate-500">{signed(result.excessReturnVsStaticPctPoints)} pp vs mantener</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">vs efectivo</div><b className={`font-mono ${result.excessFinalEurVsCash >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{signed(result.excessFinalEurVsCash)} €</b><div className="text-[9px] text-slate-500">{signed(result.excessReturnVsCashPctPoints)} pp</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Drawdown trayectoria</div><b className="font-mono text-amber-200">-{result.decisionPathMaxDrawdownPct.toFixed(2)}%</b><div className="text-[9px] text-slate-600">fechas de decisión/ejecución</div></div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-[10px]">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><span className="text-slate-500">Decisiones</span><b className="ml-2">{result.decisions}</b></div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"><span className="text-slate-500">Compras</span><b className="ml-2 text-emerald-200">{result.executedBuys + result.executedAdds}</b></div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3"><span className="text-slate-500">Reducciones/salidas</span><b className="ml-2 text-rose-200">{result.executedReductions + result.executedExits}</b></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><span className="text-slate-500">Comisiones</span><b className="ml-2 font-mono">{result.totalFeesEur.toFixed(2)} €</b></div>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><span className="text-slate-500">Interés cash</span><b className="ml-2 font-mono">{result.cashInterestEur.toFixed(2)} €</b></div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60">
        <div className="flex flex-col gap-2 border-b border-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-cyan-300"/><b className="text-sm">Línea temporal de avisos</b></div><div className="mt-1 text-[9px] text-slate-500">Por defecto se muestran las señales que podían cambiar posiciones. Puedes incluir HOLD/NO COMPRAR para auditar todas las revisiones.</div></div>
          <button onClick={() => setShowAllSignals(v => !v)} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300">{showAllSignals ? 'Solo señales operativas' : 'Mostrar también mantener/no comprar'}</button>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-3">
          {visibleSignals.length === 0 && <div className="rounded-lg border border-slate-800 p-4 text-xs text-slate-500">No hubo señales materiales con estas reglas y este periodo.</div>}
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

      <div className="mt-3 text-[10px] text-slate-500">Periodo efectivo {result.startDate} → {result.endDate}. Esta prueba mide si seguir las señales que realmente habría producido el motor mejora o empeora la recomendación inicial. No busca la secuencia retrospectiva de operaciones que habría maximizado el beneficio.</div>
    </>}
  </section>;
};
