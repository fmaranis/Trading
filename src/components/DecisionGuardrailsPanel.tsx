import React, { useMemo, useState } from 'react';
import { BadgeCheck, CircleDollarSign, ShieldAlert } from 'lucide-react';
import {
  assessAgainstCashBenchmark,
  AssetUniverseScanResult,
  CashBenchmarkService,
  getMyInvestorAvailability
} from '../investment/decision';

interface Props { scan: AssetUniverseScanResult; }

function brokerLabel(status: string, evidence: string): string {
  if (status === 'CONFIRMED_MYINVESTOR' && evidence === 'USER_CONFIRMED_MYINVESTOR') return 'Confirmado por ti';
  if (status === 'CONFIRMED_MYINVESTOR') return 'Confirmado MyInvestor';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'No disponible según tu comprobación';
  return 'Pendiente MyInvestor/Inversis';
}

export const DecisionGuardrailsPanel: React.FC<Props> = ({ scan }) => {
  const [benchmark, setBenchmark] = useState(() => CashBenchmarkService.load());
  const rows = useMemo(() => scan.selected.map(candidate => {
    const assessment = assessAgainstCashBenchmark({
      momentum120Pct: candidate.momentum120Pct,
      benchmarkAnnualPct: benchmark,
      notionalEur: 0,
      estimatedFeeEur: 0
    });
    const broker = getMyInvestorAvailability(candidate.asset);
    return { candidate, assessment, broker };
  }), [scan, benchmark]);

  const passCount = rows.filter(r => r.assessment.passes === true).length;
  const failCount = rows.filter(r => r.assessment.passes === false).length;
  const pendingBroker = rows.filter(r => r.broker.status !== 'CONFIRMED_MYINVESTOR').length;

  const updateBenchmark = (value: number) => setBenchmark(CashBenchmarkService.set(value));

  return <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/45 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-300"/><h2 className="text-lg font-bold text-white">¿Compensa invertir frente a dejar el dinero en MyInvestor?</h2></div>
        <p className="mt-1 text-xs text-slate-400">Este filtro es visible y operativo. El shortlist puede seguir siendo válido para investigación, pero una compra solo pasa a ejecución si supera la referencia de efectivo y después los filtros de costes, títulos enteros y disponibilidad broker.</p>
      </div>
      <label className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
        <div className="font-bold">Cuenta remunerada</div>
        <div className="mt-2 flex items-center gap-2"><input type="number" min="0" max="50" step="0.1" value={benchmark} onChange={e => updateBenchmark(Number(e.target.value))} className="w-24 rounded-lg border border-emerald-500/30 bg-slate-950 px-2 py-1.5 text-right font-mono text-white"/><span>% anual</span></div>
        <div className="mt-1 text-[9px] text-emerald-200/70">Guardado en este navegador.</div>
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
          <td className="p-3"><div className="font-mono font-bold text-white">{candidate.asset.ticker}</div><div className="text-[9px] text-slate-500">{candidate.asset.category} · {candidate.asset.instrumentType === 'MUTUAL_FUND' ? 'FONDO' : 'ETF/ETC'}</div></td>
          <td className="p-3 text-right font-mono">{candidate.momentum120Pct == null ? 'N/D' : `${candidate.momentum120Pct.toFixed(2)}%`}</td>
          <td className="p-3 text-right font-mono">{assessment.netAnnualizedProxyPct == null ? 'N/D' : `${assessment.netAnnualizedProxyPct.toFixed(2)}%`}</td>
          <td className={`p-3 text-right font-mono ${(assessment.excessVsCashPctPoints ?? -Infinity) > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{assessment.excessVsCashPctPoints == null ? 'N/D' : `${assessment.excessVsCashPctPoints >= 0 ? '+' : ''}${assessment.excessVsCashPctPoints.toFixed(2)} pp`}</td>
          <td className="p-3">{assessment.passes === true ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300"><BadgeCheck className="h-3 w-3"/>SUPERA EFECTIVO</span> : <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300"><ShieldAlert className="h-3 w-3"/>MANTENER EN CUENTA</span>}</td>
          <td className="p-3 text-[10px] text-slate-300">{brokerLabel(broker.status, broker.evidence)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="mt-3 text-[10px] text-slate-500">El proxy anualiza el momentum REAL de 120 sesiones. Esta tabla es comparativa y no una previsión. La comisión real se aplica después en “Operaciones pendientes”, por lo que un activo que pasa aquí todavía puede quedar bloqueado por coste o tamaño de orden.</div>
  </section>;
};
