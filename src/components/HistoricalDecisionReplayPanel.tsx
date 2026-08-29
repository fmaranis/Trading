import React, { useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import {
  CashBenchmarkService,
  EUR_ASSET_UNIVERSE,
  HistoricalDecisionReplayEngine,
  type HistoricalDecisionReplayBatchResult,
  type HistoricalDecisionReplayCase,
  type HistoricalReplayFrequency,
  type AssetUniverseScanResult,
  type InvestmentHorizonYears,
  type InvestorRiskProfile
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
}

function signed(value: number, digits = 2): string { return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`; }

export const HistoricalDecisionReplayPanel: React.FC<Props> = ({ scan, capitalEur, riskProfile, horizonYears }) => {
  const [frequency, setFrequency] = useState<HistoricalReplayFrequency>('ANNUAL');
  const [result, setResult] = useState<HistoricalDecisionReplayBatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCase, setOpenCase] = useState<string | null>(null);

  const benchmark = useMemo(() => CashBenchmarkService.load(), [result]);

  const run = () => {
    if (loading) return;
    setLoading(true); setError(null); setResult(null);
    window.setTimeout(() => {
      try {
        // The first release deliberately uses the current accepted REAL universe. The engine itself
        // removes assets that lacked 252 causal bars at each historical date; current-catalog
        // survivorship remains explicit until historical constituent reconstruction is available.
        const next = HistoricalDecisionReplayEngine.run({
          dataset: scan.acceptedDataset,
          catalog: EUR_ASSET_UNIVERSE,
          frequency,
          initialCapitalEur: Math.max(1, capitalEur),
          riskProfile,
          horizonYears,
          cashBenchmarkAnnualPct: CashBenchmarkService.load(),
          minimumBars: 252
        });
        setResult(next);
      } catch (e: any) { setError(e?.message || String(e)); }
      finally { setLoading(false); }
    }, 0);
  };

  return <section className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><CalendarRange className="h-5 w-5 text-indigo-300"/><h2 className="font-bold text-white">¿Qué habría recomendado el motor años atrás y cuánto valdría hoy?</h2></div>
        <p className="mt-1 text-[11px] text-slate-400">Reconstruye decisiones causales usando solo datos disponibles hasta cada fecha, entra en la siguiente sesión y mantiene aquella recomendación hasta el último dato REAL. La compara con dejar el mismo capital remunerado al {benchmark.toFixed(2)}%.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={frequency} onChange={e => { setFrequency(e.target.value as HistoricalReplayFrequency); setResult(null); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"><option value="ANNUAL">Cada 1 de enero</option><option value="QUARTERLY">Cada trimestre</option></select>
        <button onClick={run} disabled={loading} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><FlaskConical className="h-3.5 w-3.5"/>{loading ? 'Reconstruyendo…' : result ? 'Recalcular' : 'Probar decisiones históricas'}</button>
      </div>
    </div>

    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">Primera versión: reconstruye causalmente las señales dentro del catálogo/universo REAL que hoy podemos consultar. Evita look-ahead de precios, pero conserva sesgo de supervivencia del catálogo actual. No se utilizará como prueba definitiva OOS hasta reconstruir universos históricos independientes.</div>
    {error && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

    {result && <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6 text-xs">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Fechas válidas</div><b>{result.successfulCases}</b><div className="text-[9px] text-slate-600">de {result.requestedDates.length} solicitadas</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Superó efectivo</div><b className={result.beatsCashPct >= 50 ? 'text-emerald-200' : 'text-amber-200'}>{result.beatsCashCases}/{result.successfulCases}</b><div className="text-[9px] text-slate-500">{result.beatsCashPct.toFixed(0)}%</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Retorno mediano</div><b className="font-mono">{result.medianReturnPct == null ? 'N/D' : `${signed(result.medianReturnPct)}%`}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Exceso mediano vs efectivo</div><b className={`font-mono ${(result.medianExcessPctPoints ?? 0) >= 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{result.medianExcessPctPoints == null ? 'N/D' : `${signed(result.medianExcessPctPoints)} pp`}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Mejor inicio</div><b className="font-mono">{result.bestCase?.decisionDate ?? 'N/D'}</b><div className="text-emerald-300">{result.bestCase ? `${signed(result.bestCase.excessReturnVsCashPctPoints)} pp` : ''}</div></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Peor inicio</div><b className="font-mono">{result.worstCase?.decisionDate ?? 'N/D'}</b><div className="text-amber-300">{result.worstCase ? `${signed(result.worstCase.excessReturnVsCashPctPoints)} pp` : ''}</div></div>
      </div>

      <div className="mt-4 space-y-2">{result.cases.map((item: HistoricalDecisionReplayCase) => <article key={`${item.requestedDate}_${item.decisionDate}`} className="rounded-xl border border-slate-800 bg-slate-950/60">
        <button onClick={() => setOpenCase(openCase === item.requestedDate ? null : item.requestedDate)} className="grid w-full gap-2 p-3 text-left md:grid-cols-[1.1fr_1.2fr_1fr_1fr_auto] md:items-center">
          <div><div className="text-[9px] uppercase text-slate-500">Decisión</div><b className="font-mono">{item.decisionDate}</b><div className="text-[9px] text-slate-600">pedido {item.requestedDate}</div></div>
          <div><div className="text-[9px] uppercase text-slate-500">Motor / régimen</div><b className="text-[11px]">{item.method}</b><div className="text-[9px] text-slate-600">{item.regime} · cash {(item.cashTargetWeight * 100).toFixed(0)}%</div></div>
          <div><div className="text-[9px] uppercase text-slate-500">Valor hoy</div><b className="font-mono">{item.finalValueEur.toFixed(2)} €</b><div className={item.totalReturnPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{signed(item.totalReturnPct)}%</div></div>
          <div><div className="text-[9px] uppercase text-slate-500">vs efectivo</div><b className={`font-mono ${item.beatsCash ? 'text-emerald-200' : 'text-amber-200'}`}>{signed(item.excessFinalEurVsCash)} €</b><div className="text-[9px] text-slate-500">{signed(item.excessReturnVsCashPctPoints)} pp</div></div>
          <div>{openCase === item.requestedDate ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</div>
        </button>
        {openCase === item.requestedDate && <div className="border-t border-slate-800 p-3">
          <div className="mb-3 text-[10px] text-slate-400">{item.summary} · {item.eligibleAssets} activos con historia causal suficiente.</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">Producto</th><th className="p-2 text-right">Peso</th><th className="p-2 text-right">Entrada</th><th className="p-2 text-right">Precio entrada</th><th className="p-2 text-right">Precio final</th><th className="p-2 text-right">Valor final</th><th className="p-2 text-right">Resultado</th></tr></thead><tbody>{item.allocations.map(line => <tr key={line.assetId} className="border-t border-slate-800"><td className="p-2 font-mono">{line.ticker}<div className="text-[8px] text-slate-600">{line.instrumentType}</div></td><td className="p-2 text-right">{(line.targetWeight * 100).toFixed(1)}%</td><td className="p-2 text-right font-mono">{line.entryDate ?? 'N/D'}</td><td className="p-2 text-right font-mono">{line.entryPriceEur?.toFixed(2) ?? 'N/D'}</td><td className="p-2 text-right font-mono">{line.latestPriceEur?.toFixed(2) ?? 'N/D'}</td><td className="p-2 text-right font-mono">{line.finalValueEur.toFixed(2)} €</td><td className={`p-2 text-right font-mono ${(line.returnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{line.returnPct == null ? 'N/D' : `${signed(line.returnPct)}%`}</td></tr>)}</tbody></table></div>
        </div>}
      </article>)}</div>
      <div className="mt-3 text-[10px] text-slate-500">Esta prueba contesta “qué habría recomendado aquella fecha y cuánto valdría hoy si no hubiese tocado esa recomendación”. El replay dinámico que siga todas las recomendaciones posteriores será una prueba separada para medir si los rebalanceos aportan o destruyen valor.</div>
    </>}
  </section>;
};
