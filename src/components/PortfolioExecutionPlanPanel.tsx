import React, { useMemo, useState } from 'react';
import { Check, ClipboardList, RefreshCw, Trash2 } from 'lucide-react';
import {
  AssetUniverseScanResult,
  buildPortfolioExecutionPlan,
  InvestmentDecisionResult,
  PortfolioDecisionEngine,
  PortfolioExecutionPlan,
  PortfolioExecutionPlanService,
  UserPortfolioService
} from '../investment/decision';

interface Props { scan: AssetUniverseScanResult; decision: InvestmentDecisionResult; }
function actionLabel(action: string): string {
  switch (action) {
    case 'BUY_ETF': return 'COMPRAR ETF/ETC';
    case 'SELL_ETF': return 'VENDER ETF/ETC';
    case 'SUBSCRIBE_FUND': return 'SUSCRIBIR FONDO';
    case 'TRANSFER_FUND': return 'TRASPASAR FONDO';
    case 'REDEEM_FUND': return 'REEMBOLSAR FONDO';
    default: return 'REVISAR / NO OPERAR';
  }
}
function actionClass(action: string): string {
  if (action === 'BUY_ETF' || action === 'SUBSCRIBE_FUND') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (action === 'TRANSFER_FUND') return 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10';
  if (action === 'SELL_ETF' || action === 'REDEEM_FUND') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-slate-300 border-slate-700 bg-slate-900';
}

export const PortfolioExecutionPlanPanel: React.FC<Props> = ({ scan, decision }) => {
  const [plan, setPlan] = useState<PortfolioExecutionPlan | null>(() => PortfolioExecutionPlanService.load());
  const pending = useMemo(() => plan?.lines.filter(line => line.status === 'PENDING').length ?? 0, [plan]);
  const generate = () => {
    const portfolio = UserPortfolioService.load();
    const portfolioDecision = PortfolioDecisionEngine.evaluate({ portfolio, scan, decision });
    const next = buildPortfolioExecutionPlan({ portfolio, scan, decisionAsOf: decision.asOfDate, portfolioDecision });
    setPlan(PortfolioExecutionPlanService.save(next));
    window.setTimeout(() => document.getElementById('pending-portfolio-operations')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  const setStatus = (id: string, status: 'DONE' | 'DISMISSED') => setPlan(PortfolioExecutionPlanService.updateStatus(id, status));
  const clear = () => { PortfolioExecutionPlanService.clear(); setPlan(null); };

  return <section id="pending-portfolio-operations" className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-cyan-300"/><h2 className="font-bold">Operaciones pendientes · Mi cartera</h2></div><p className="mt-1 max-w-3xl text-[11px] text-slate-400">Convierte la recomendación en pasos manuales concretos y aplica una política anti-sobreoperación: una señal puede quedar en “no operar todavía” si el nominal es pequeño o la comisión pesa demasiado.</p></div>
      <div className="flex gap-2">{plan && <button onClick={clear} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"><Trash2 className="h-3.5 w-3.5"/>Vaciar</button>}<button onClick={generate} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500"><RefreshCw className="h-3.5 w-3.5"/>{plan ? 'Actualizar plan' : 'Preparar operaciones'}</button></div>
    </div>

    {!plan && <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-500">Pulsa <b>Preparar operaciones</b> para transformar la recomendación actual en una lista sobre la cartera guardada. La app puede decidir explícitamente que una operación teórica no merece ejecutarse todavía.</div>}

    {plan && <>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400"><span className="rounded-full border border-slate-700 px-3 py-1">Decisión: {plan.decisionAsOf}</span><span className="rounded-full border border-cyan-500/25 px-3 py-1 text-cyan-300">{pending} pendientes</span><span className="rounded-full border border-slate-700 px-3 py-1">Creado: {new Date(plan.createdAt).toLocaleString('es-ES')}</span><span className="rounded-full border border-amber-500/25 px-3 py-1 text-amber-200">Filtro costes activo</span></div>
      <div className="mt-4 space-y-3">
        {plan.lines.length === 0 && <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">No hay operaciones accionables con la cartera y la decisión actuales.</div>}
        {plan.lines.map((line, index) => <article key={line.id} className={`rounded-xl border p-4 ${line.status === 'DONE' ? 'border-emerald-500/20 bg-emerald-500/5 opacity-70' : 'border-slate-800 bg-slate-950/70'}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{index + 1}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${actionClass(line.action)}`}>{actionLabel(line.action)}</span>{line.status === 'DONE' && <span className="text-[10px] font-bold text-emerald-300">HECHA</span>}</div><div className="mt-2 text-sm font-semibold text-white">{line.instruction}</div><div className="mt-1 text-[10px] text-slate-500">{line.rationale}</div></div>{line.status === 'PENDING' && <div className="flex shrink-0 gap-2"><button onClick={() => setStatus(line.id, 'DONE')} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 px-3 py-2 text-[10px] font-bold text-emerald-300"><Check className="h-3 w-3"/>Marcar hecha</button><button onClick={() => setStatus(line.id, 'DISMISSED')} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-500">Descartar</button></div>}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-[10px]">{line.sourceIsin && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Origen ISIN</span><div className="font-mono text-slate-200">{line.sourceIsin}</div></div>}{line.targetTicker && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Ticker / referencia</span><div className="font-mono text-slate-200">{line.targetTicker}</div></div>}{line.targetIsin && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Destino ISIN</span><div className="font-mono text-slate-200">{line.targetIsin}</div></div>}{line.amountEur != null && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Importe orientativo</span><div className="font-mono text-slate-200">{line.amountEur.toFixed(2)} €</div></div>}{line.estimatedFeeEur != null && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Comisión est.</span><div className="font-mono text-slate-200">{line.estimatedFeeEur.toFixed(2)} €</div></div>}{line.shares != null && <div className="rounded-lg bg-slate-900 p-2"><span className="text-slate-500">Títulos</span><div className="font-mono text-slate-200">{line.shares}</div></div>}</div>
          {line.taxNote && <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2 text-[10px] text-cyan-100"><b>Fondos / fiscalidad:</b> {line.taxNote}</div>}
        </article>)}
      </div>
      <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-100">La política actual evita órdenes ETF pequeñas: deriva mínima 5 pp, nominal orientativo mínimo 50 € y comisión máxima del 2% del nominal por orden. Antes de operar confirma disponibilidad, precios, comisiones reales y —en traspasos— elegibilidad fiscal y operativa en MyInvestor/Inversis.</div>
    </>}
  </section>;
};
