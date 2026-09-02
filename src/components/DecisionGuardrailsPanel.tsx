import React, { useMemo, useState } from 'react';
import { BadgeCheck, Calculator, CircleDollarSign, ShieldAlert } from 'lucide-react';
import {
  assessAgainstCashBenchmark,
  AssetUniverseScanResult,
  CashBenchmarkService,
  CausalUniverseBacktestEngine,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  getMyInvestorAvailability,
  InvestmentHorizonYears,
  InvestorRiskProfile,
  MixedInstrumentCausalReplayEngine,
  type MixedInstrumentCausalReplayResult
} from '../investment/decision';

interface Props { scan: AssetUniverseScanResult; capitalEur: number; riskProfile: InvestorRiskProfile; horizonYears: InvestmentHorizonYears; }

function brokerLabel(status: string, evidence: string): string {
  if (status === 'CONFIRMED_MYINVESTOR' && evidence === 'USER_CONFIRMED_MYINVESTOR') return 'Confirmado por ti';
  if (status === 'CONFIRMED_MYINVESTOR') return 'Confirmado MyInvestor';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'No disponible según tu comprobación';
  return 'Pendiente MyInvestor/Inversis';
}

export const DecisionGuardrailsPanel: React.FC<Props> = ({ scan, capitalEur, riskProfile, horizonYears }) => {
  const [benchmark, setBenchmark] = useState(() => CashBenchmarkService.load());
  const [historical, setHistorical] = useState<MixedInstrumentCausalReplayResult | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const rows = useMemo(() => scan.selected.map(candidate => {
    const assessment = assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: benchmark, notionalEur: 0, estimatedFeeEur: 0 });
    const broker = getMyInvestorAvailability(candidate.asset);
    return { candidate, assessment, broker };
  }), [scan, benchmark]);

  const passCount = rows.filter(r => r.assessment.passes === true).length;
  const failCount = rows.filter(r => r.assessment.passes === false).length;
  const pendingBroker = rows.filter(r => r.broker.status !== 'CONFIRMED_MYINVESTOR').length;
  const updateBenchmark = (value: number) => { setBenchmark(CashBenchmarkService.set(value)); setHistorical(null); };

  const calculateHistorical = () => {
    if (historicalLoading) return;
    setHistoricalLoading(true); setHistoricalError(null); setHistorical(null);
    window.setTimeout(() => {
      try {
        const config = { initialCapital: Math.max(1, capitalEur), commissionPct: 0.05, slippagePct: 0.02, riskProfile, horizonYears, rebalanceFrequency: 'MONTHLY' as const };
        const research = CausalUniverseBacktestEngine.run(scan.acceptedDataset, EUR_PORTFOLIO_DISCOVERY_UNIVERSE, config, 8);
        setHistorical(MixedInstrumentCausalReplayEngine.run({ universeDataset: scan.acceptedDataset, catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE, researchResult: research, config, cashBenchmarkAnnualPct: benchmark }));
      } catch (e: any) { setHistoricalError(e?.message || String(e)); }
      finally { setHistoricalLoading(false); }
    }, 0);
  };

  return <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/45 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-300"/><h2 className="text-lg font-bold text-white">¿Compensa invertir frente a dejar el dinero en MyInvestor?</h2></div>
        <p className="mt-1 text-xs text-slate-400">El filtro se aplica antes de construir la cartera: un candidato que no supera la cuenta o no logra consenso BUY no llega al asignador. Costes, títulos enteros y broker se comprueban después.</p>
      </div>
      <label className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
        <div className="font-bold">Cuenta remunerada</div>
        <div className="mt-2 flex items-center gap-2"><input type="number" min="0" max="50" step="0.1" value={benchmark} onChange={e => updateBenchmark(Number(e.target.value))} className="w-24 rounded-lg border border-emerald-500/30 bg-slate-950 px-2 py-1.5 text-right font-mono text-white"/><span>% TAE</span></div>
        <div className="mt-1 text-[9px] text-emerald-200/70">Cambiarlo recalcula los candidatos de cartera.</div>
      </label>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="text-[10px] uppercase text-slate-500">Superan referencia</div><div className="mt-1 text-xl font-bold text-emerald-300">{passCount}/{rows.length}</div></div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><div className="text-[10px] uppercase text-slate-500">No compensan ahora</div><div className="mt-1 text-xl font-bold text-amber-300">{failCount}</div></div>
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3"><div className="text-[10px] uppercase text-slate-500">Broker por confirmar</div><div className="mt-1 text-xl font-bold text-sky-300">{pendingBroker}</div></div>
    </div>

    <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-3 text-left">Producto</th><th className="p-3 text-right">Mom. 120d</th><th className="p-3 text-right">Proxy anual</th><th className="p-3 text-right">vs cuenta</th><th className="p-3 text-left">Decisión económica</th><th className="p-3 text-left">MyInvestor</th></tr></thead>
        <tbody>{rows.map(({ candidate, assessment, broker }) => <tr key={candidate.asset.assetId} className="border-t border-slate-800 bg-slate-950/40">
          <td className="p-3"><div className="font-mono font-bold text-white">{candidate.asset.ticker}</div><div className="text-[9px] text-slate-500">{candidate.asset.category} · {candidate.asset.instrumentType === 'MUTUAL_FUND' ? 'FONDO' : 'ETF/ETC/ACCIÓN'}</div></td>
          <td className="p-3 text-right font-mono">{candidate.momentum120Pct == null ? 'N/D' : `${candidate.momentum120Pct.toFixed(2)}%`}</td>
          <td className="p-3 text-right font-mono">{assessment.netAnnualizedProxyPct == null ? 'N/D' : `${assessment.netAnnualizedProxyPct.toFixed(2)}%`}</td>
          <td className={`p-3 text-right font-mono ${(assessment.excessVsCashPctPoints ?? -Infinity) > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{assessment.excessVsCashPctPoints == null ? 'N/D' : `${assessment.excessVsCashPctPoints >= 0 ? '+' : ''}${assessment.excessVsCashPctPoints.toFixed(2)} pp`}</td>
          <td className="p-3">{assessment.passes === true ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300"><BadgeCheck className="h-3 w-3"/>SUPERA EFECTIVO</span> : <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300"><ShieldAlert className="h-3 w-3"/>MANTENER EN CUENTA</span>}</td>
          <td className="p-3 text-[10px] text-slate-300">{brokerLabel(broker.status, broker.evidence)}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="mt-5 rounded-xl border border-emerald-500/20 bg-slate-950/55 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="font-bold text-emerald-100">Estrategia histórica vs todo en efectivo remunerado</div><div className="mt-1 text-[10px] text-slate-500">Replay causal con {capitalEur.toFixed(2)} €, riesgo {riskProfile}, horizonte {horizonYears} años. El efectivo residual dentro de la estrategia también devenga {benchmark.toFixed(2)}% TAE por días naturales.</div><div className="mt-1 text-[9px] text-amber-300/80">Escenario de TAE constante: este replay aplica la TAE configurada durante toda la ventana. No reconstruye la remuneración bancaria histórica de cada año.</div></div>
        <button onClick={calculateHistorical} disabled={historicalLoading} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Calculator className="h-3.5 w-3.5"/>{historicalLoading ? 'Calculando…' : historical ? 'Recalcular' : 'Calcular comparación'}</button>
      </div>
      {historicalError && <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">{historicalError}</div>}
      {historical && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5 text-xs">
        <div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Estrategia final</div><b className="font-mono">{historical.finalEquityEur.toFixed(2)} €</b><div className="text-[10px] text-slate-500">{historical.totalReturnPct >= 0 ? '+' : ''}{historical.totalReturnPct.toFixed(2)}%</div></div>
        <div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Todo en cuenta</div><b className="font-mono">{historical.allCashFinalEur.toFixed(2)} €</b><div className="text-[10px] text-slate-500">+{historical.allCashReturnPct.toFixed(2)}%</div></div>
        <div className={`rounded-lg p-3 ${historical.beatsAllCashBenchmark ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}><div className="text-[9px] uppercase text-slate-500">Diferencia</div><b className={`font-mono ${historical.beatsAllCashBenchmark ? 'text-emerald-200' : 'text-amber-200'}`}>{historical.excessFinalEurVsCash >= 0 ? '+' : ''}{historical.excessFinalEurVsCash.toFixed(2)} €</b><div className="text-[10px] text-slate-500">{historical.excessReturnVsCashPctPoints >= 0 ? '+' : ''}{historical.excessReturnVsCashPctPoints.toFixed(2)} pp</div></div>
        <div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Interés efectivo residual</div><b className="font-mono text-sky-200">+{historical.cashInterestEarnedEur.toFixed(2)} €</b></div>
        <div className="rounded-lg bg-slate-900 p-3"><div className="text-[9px] uppercase text-slate-500">Conclusión histórica</div><b className={historical.beatsAllCashBenchmark ? 'text-emerald-200' : 'text-amber-200'}>{historical.beatsAllCashBenchmark ? 'ESTRATEGIA > EFECTIVO' : 'EFECTIVO > ESTRATEGIA'}</b></div>
      </div>}
    </div>

    <div className="mt-3 text-[10px] text-slate-500">El proxy superior anualiza el momentum REAL de 120 sesiones. La comparación histórica inferior es un replay causal ejecutable con costes y remuneración del efectivo residual bajo una TAE constante configurada. Ninguno de los dos es una previsión o garantía.</div>
  </section>;
};
