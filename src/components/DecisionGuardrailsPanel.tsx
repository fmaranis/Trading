import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CircleDollarSign, ShieldAlert } from 'lucide-react';
import {
  assessAgainstCashBenchmark,
  AssetUniverseScanResult,
  CASH_BENCHMARK_UPDATED_EVENT,
  CashBenchmarkService,
  getMyInvestorAvailability
} from '../investment/decision';

interface Props { scan: AssetUniverseScanResult; }

function brokerLabel(status: string, evidence: string): string {
  if (status === 'CONFIRMED_MYINVESTOR' && evidence === 'USER_CONFIRMED_MYINVESTOR') return 'Confirmado por ti';
  if (status === 'CONFIRMED_MYINVESTOR') return 'Confirmado MyInvestor';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'No disponible según tu comprobación';
  return 'Disponibilidad asumida / por confirmar';
}

export const DecisionGuardrailsPanel: React.FC<Props> = ({ scan }) => {
  const [benchmark, setBenchmark] = useState(() => CashBenchmarkService.load());
  const rows = useMemo(() => scan.selected.map(candidate => {
    const assessment = assessAgainstCashBenchmark({ momentum120Pct: candidate.momentum120Pct, benchmarkAnnualPct: benchmark, notionalEur: 0, estimatedFeeEur: 0 });
    const broker = getMyInvestorAvailability(candidate.asset);
    return { candidate, assessment, broker };
  }), [scan, benchmark]);

  const passCount = rows.filter(row => row.assessment.passes === true).length;
  const failCount = rows.filter(row => row.assessment.passes === false).length;
  const unavailableBroker = rows.filter(row => row.broker.status === 'USER_CONFIRMED_UNAVAILABLE').length;
  const updateBenchmark = (value: number) => setBenchmark(CashBenchmarkService.set(value));

  useEffect(() => {
    const syncBenchmark = () => setBenchmark(CashBenchmarkService.load());
    window.addEventListener(CASH_BENCHMARK_UPDATED_EVENT, syncBenchmark as EventListener);
    return () => window.removeEventListener(CASH_BENCHMARK_UPDATED_EVENT, syncBenchmark as EventListener);
  }, []);

  return <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/45 via-slate-900 to-slate-950 p-4 sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-300"/><h2 className="text-lg font-bold text-white">Gates actuales frente a efectivo y broker</h2></div>
        <p className="mt-1 text-xs text-slate-400">Este bloque sólo explica el estado current/live ya calculado. No ejecuta otro backtest ni crea una recomendación paralela. La investigación histórica se hace en el replay integrado.</p>
      </div>
      <label className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
        <div className="font-bold">Cuenta remunerada</div>
        <div className="mt-2 flex items-center gap-2"><input type="number" min="0" max="50" step="0.1" value={benchmark} onChange={event => updateBenchmark(Number(event.target.value))} className="w-24 rounded-lg border border-emerald-500/30 bg-slate-950 px-2 py-1.5 text-right font-mono text-white"/><span>% TAE</span></div>
        <div className="mt-1 text-[9px] text-emerald-200/70">Cambiarlo recalcula los candidatos de cartera.</div>
      </label>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="text-[10px] uppercase text-slate-500">Superan referencia</div><div className="mt-1 text-xl font-bold text-emerald-300">{passCount}/{rows.length}</div></div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><div className="text-[10px] uppercase text-slate-500">No compensan ahora</div><div className="mt-1 text-xl font-bold text-amber-300">{failCount}</div></div>
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><div className="text-[10px] uppercase text-slate-500">Broker bloqueado por ti</div><div className="mt-1 text-xl font-bold text-rose-300">{unavailableBroker}</div></div>
    </div>

    <div className="mobile-scroll-x mt-4 rounded-xl border border-slate-800">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-3 text-left">Producto</th><th className="p-3 text-right">Mom. 120d</th><th className="p-3 text-right">Proxy anual</th><th className="p-3 text-right">vs cuenta</th><th className="p-3 text-left">Gate efectivo</th><th className="p-3 text-left">MyInvestor</th></tr></thead>
        <tbody>{rows.map(({ candidate, assessment, broker }) => <tr key={candidate.asset.assetId} className="border-t border-slate-800 bg-slate-950/40">
          <td className="p-3"><div className="font-mono font-bold text-white">{candidate.asset.ticker}</div><div className="text-[9px] text-slate-500">{candidate.asset.category} · {candidate.asset.instrumentType === 'MUTUAL_FUND' ? 'FONDO' : 'ETF/ETC/ACCIÓN'}</div></td>
          <td className="p-3 text-right font-mono">{candidate.momentum120Pct == null ? 'N/D' : `${candidate.momentum120Pct.toFixed(2)}%`}</td>
          <td className="p-3 text-right font-mono">{assessment.netAnnualizedProxyPct == null ? 'N/D' : `${assessment.netAnnualizedProxyPct.toFixed(2)}%`}</td>
          <td className={`p-3 text-right font-mono ${(assessment.excessVsCashPctPoints ?? -Infinity) > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{assessment.excessVsCashPctPoints == null ? 'N/D' : `${assessment.excessVsCashPctPoints >= 0 ? '+' : ''}${assessment.excessVsCashPctPoints.toFixed(2)} pp`}</td>
          <td className="p-3">{assessment.passes === true ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300"><BadgeCheck className="h-3 w-3"/>SUPERA EFECTIVO</span> : <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300"><ShieldAlert className="h-3 w-3"/>NO SUPERA</span>}</td>
          <td className={`p-3 text-[10px] ${broker.status === 'USER_CONFIRMED_UNAVAILABLE' ? 'font-bold text-rose-200' : 'text-slate-300'}`}>{brokerLabel(broker.status, broker.evidence)}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-[10px] text-slate-500">El proxy anualiza momentum REAL de 120 sesiones para comparar con cash; no es una previsión. Si un instrumento está marcado por ti como no disponible en MyInvestor, el plan ejecutable central lo convierte en REVIEW aunque la señal de inversión siga siendo válida.</div>
  </section>;
};
