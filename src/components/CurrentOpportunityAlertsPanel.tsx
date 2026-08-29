import React, { useMemo } from 'react';
import { BellRing, BarChart3, ShieldAlert, Sparkles } from 'lucide-react';
import {
  CashBenchmarkService,
  CurrentOpportunityAlertEngine,
  PortfolioDecisionEngine,
  UserPortfolioService,
  type AssetUniverseScanResult,
  type CurrentOpportunityAlert,
  type InvestmentDecisionResult,
  type PortfolioPositionHealthResult
} from '../investment/decision';
import { AlertAutomationStatusPanel } from './AlertAutomationStatusPanel';

interface Props {
  scan: AssetUniverseScanResult;
  decision: InvestmentDecisionResult;
  positionHealth: PortfolioPositionHealthResult | null;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

function levelLabel(level: CurrentOpportunityAlert['level']): string {
  if (level === 'HIGH_CONVICTION') return 'ENTRADA DE ALTA CONVICCIÓN';
  if (level === 'GOOD_ENTRY') return 'BUENA OPORTUNIDAD';
  return 'ENTRADA VÁLIDA';
}
function levelClass(level: CurrentOpportunityAlert['level']): string {
  if (level === 'HIGH_CONVICTION') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100';
  if (level === 'GOOD_ENTRY') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
  return 'border-slate-700 bg-slate-900 text-slate-200';
}

export const CurrentOpportunityAlertsPanel: React.FC<Props> = ({ scan, decision, positionHealth, onInspectAsset }) => {
  const alerts = useMemo(() => CurrentOpportunityAlertEngine.evaluate(scan, CashBenchmarkService.load()), [scan, decision.asOfDate]);
  const portfolioDecision = useMemo(() => PortfolioDecisionEngine.evaluate({
    portfolio: UserPortfolioService.load(),
    scan,
    decision,
    positionHealth: positionHealth?.byKey,
    cashBenchmarkAnnualPct: CashBenchmarkService.load()
  }), [scan, decision, positionHealth]);
  const contributionByAsset = useMemo(() => new Map(portfolioDecision.contributions.map(row => [row.assetId, row])), [portfolioDecision]);
  const high = alerts.filter(alert => alert.level === 'HIGH_CONVICTION');
  const visible = alerts.slice(0, 6);
  const availableCapital = Math.max(0, portfolioDecision.currentCashEur + portfolioDecision.pendingCapitalEur);

  return <section className={`rounded-2xl border p-5 ${high.length > 0 ? 'border-emerald-400/35 bg-emerald-500/5' : 'border-amber-500/20 bg-slate-900'}`}>
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2">{high.length > 0 ? <Sparkles className="h-5 w-5 text-emerald-300"/> : <BellRing className="h-5 w-5 text-amber-300"/>}<h2 className="text-lg font-bold text-white">Dónde pondría dinero hoy</h2></div>
        <p className="mt-1 max-w-3xl text-xs text-slate-400">Las mismas oportunidades alimentan “Qué haría hoy”. El importe sugerido sale de tu liquidez REAL disponible, no de un capital infinito: se reparte por convicción, riesgo y concentración.</p>
      </div>
      <div className="grid gap-1 text-right"><div className={`rounded-xl border px-4 py-2 text-xs font-black ${high.length > 0 ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/25 bg-amber-500/5 text-amber-200'}`}>{high.length > 0 ? `${high.length} ALTA CONVICCIÓN` : 'SIN ALTA CONVICCIÓN HOY'}</div><div className="text-[10px] text-slate-500">Disponible: {availableCapital.toFixed(2)} € · asignado: {portfolioDecision.recommendedNewInvestmentEur.toFixed(2)} €</div></div>
    </div>

    {visible.length > 0 ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((alert, index) => {
      const contribution = contributionByAsset.get(alert.assetId);
      return <article key={alert.assetId} className={`rounded-xl border p-4 ${levelClass(alert.level)}`}>
        <div className="flex items-start justify-between gap-2"><div><div className="text-[9px] uppercase opacity-70">#{index + 1} · {levelLabel(alert.level)}</div><div className="mt-1 font-mono text-lg font-black">{alert.ticker}</div><div className="max-w-[250px] truncate text-[10px] opacity-70">{alert.name}</div></div>{alert.level === 'HIGH_CONVICTION' && <ShieldAlert className="h-5 w-5 shrink-0"/>}</div>
        <div className={`mt-3 rounded-lg border p-3 ${contribution ? 'border-emerald-400/30 bg-slate-950/35' : 'border-slate-600/40 bg-slate-950/30'}`}><div className="text-[9px] uppercase opacity-60">Capital sugerido ahora</div><div className="mt-1 font-mono text-xl font-black">{contribution ? `${contribution.amountEur.toFixed(2)} €` : '0 €'}</div><div className="mt-1 text-[9px] opacity-65">{contribution ? 'Incluido en el plan operativo actual.' : availableCapital <= 0.01 ? 'No hay liquidez libre disponible.' : 'Oportunidad válida, pero no recibe capital por límites de concentración/riesgo o prioridad relativa.'}</div></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><span>Consenso <b>{alert.consensusScore >= 0 ? '+' : ''}{alert.consensusScore}</b></span><span>Favorables <b>{alert.favorableVotes}/5</b></span><span>Momentum 120d <b>{alert.momentum120Pct?.toFixed(1) ?? 'N/D'}%</b></span><span>vs cash <b>{alert.excessVsCashPctPoints != null ? `${alert.excessVsCashPctPoints >= 0 ? '+' : ''}${alert.excessVsCashPctPoints.toFixed(1)} pp` : 'N/D'}</b></span></div>
        <details className="mt-3 text-[10px]"><summary className="cursor-pointer font-bold opacity-80">Por qué</summary><div className="mt-2 space-y-1 opacity-70">{alert.reasons.map(reason => <div key={reason}>• {reason}</div>)}{contribution && <div>• {contribution.reason}</div>}</div></details>
        {onInspectAsset && <button type="button" onClick={() => onInspectAsset(alert.ticker)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-cyan-400/30 bg-slate-950/40 px-3 py-2 text-[10px] font-bold text-cyan-100"><BarChart3 className="h-3.5 w-3.5"/>Abrir gráfica y señales</button>}
      </article>;
    })}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">No hay ninguna entrada que supere hoy todos los filtros mínimos. La ausencia de alerta es una señal válida: no se fuerza una compra.</div>}

    {alerts.length > visible.length && <div className="mt-3 text-[10px] text-slate-500">Se muestran las 6 mejores entradas actuales de {alerts.length} válidas. “Qué haría hoy” usa exactamente la misma priorización y el mismo capital disponible.</div>}

    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-300">Estado de alarmas autónomas</summary><div className="mt-3"><AlertAutomationStatusPanel /></div></details>
  </section>;
};