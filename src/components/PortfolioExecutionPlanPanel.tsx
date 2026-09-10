import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ClipboardList, Save } from 'lucide-react';
import {
  getMyInvestorAvailability,
  isPortfolioEquityTicker,
  ManualMyInvestorAvailabilityService,
  PortfolioExecutionPlanService,
  PortfolioStateExecutionService,
  SpanishTaxSettingsService,
  type AssetUniverseScanResult,
  type PortfolioExecutionPlan,
  type PortfolioStateExecutionReceipt,
  type SpanishTaxSettings
} from '../investment/decision';

interface Props {
  scan: AssetUniverseScanResult;
  executionPlan: PortfolioExecutionPlan;
  onInspectAsset?: (symbolOrIsin: string) => void;
}

function actionLabel(action: string, ticker?: string | null): string {
  const equity = isPortfolioEquityTicker(ticker);
  switch (action) {
    case 'BUY_ETF': return equity ? 'COMPRAR ACCIÓN' : 'COMPRAR ETF/ETC';
    case 'SELL_ETF': return equity ? 'VENDER ACCIÓN' : 'VENDER ETF/ETC';
    case 'SUBSCRIBE_FUND': return 'SUSCRIBIR FONDO';
    case 'TRANSFER_FUND': return 'TRASPASAR FONDO';
    case 'REDEEM_FUND': return 'REEMBOLSAR FONDO';
    default: return 'REVISAR / NO OPERAR';
  }
}

function actionClass(action: string): string {
  if (action === 'BUY_ETF' || action === 'SUBSCRIBE_FUND') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (action === 'TRANSFER_FUND') return 'text-cyan-300 border-cyan-500/25 bg-cyan-500/5';
  if (action === 'SELL_ETF' || action === 'REDEEM_FUND') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-slate-300 border-slate-700 bg-slate-900';
}

function availabilityClass(status: string): string {
  if (status === 'CONFIRMED_MYINVESTOR') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'ASSUMED_MYINVESTOR_AVAILABLE') return 'border-cyan-500/25 bg-cyan-500/5 text-cyan-100';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}

function availabilityLabel(status: string, evidence: string): string {
  if (status === 'CONFIRMED_MYINVESTOR' && evidence === 'USER_CONFIRMED_MYINVESTOR') return 'Confirmado por ti en MyInvestor';
  if (status === 'CONFIRMED_MYINVESTOR') return 'Confirmado MyInvestor';
  if (status === 'ASSUMED_MYINVESTOR_AVAILABLE') return 'Se asume disponible en MyInvestor salvo que indiques lo contrario';
  if (status === 'USER_CONFIRMED_UNAVAILABLE') return 'Marcado por ti como no disponible';
  return 'Disponibilidad no verificada';
}

export const PortfolioExecutionPlanPanel: React.FC<Props> = ({ scan, executionPlan, onInspectAsset }) => {
  const [plan, setPlan] = useState<PortfolioExecutionPlan>(executionPlan);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [taxSettings, setTaxSettings] = useState<SpanishTaxSettings>(() => SpanishTaxSettingsService.load());
  const [lastExecution, setLastExecution] = useState<PortfolioStateExecutionReceipt | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(PortfolioExecutionPlanService.save(executionPlan));
  }, [executionPlan]);

  const pending = useMemo(() => plan.lines.filter(line => line.status === 'PENDING').length, [plan]);
  const actionable = useMemo(() => plan.lines.filter(line => line.status === 'PENDING' && ['BUY_ETF','SELL_ETF','SUBSCRIBE_FUND','TRANSFER_FUND','REDEEM_FUND'].includes(line.action)), [plan]);
  const reviews = useMemo(() => plan.lines.filter(line => line.status === 'PENDING' && line.action === 'REVIEW'), [plan]);

  const saveTaxSettings = () => {
    const saved = SpanishTaxSettingsService.save(taxSettings);
    setTaxSettings(saved);
  };

  const applyLine = (line: PortfolioExecutionPlan['lines'][number]) => {
    setExecutionError(null);
    try {
      const receipt = PortfolioStateExecutionService.execute(line);
      setLastExecution(receipt);
      setPlan(previous => ({ ...previous, lines: previous.lines.map(row => row.id === line.id ? { ...row, status: 'DONE' } : row) }));
    } catch (error: any) {
      setExecutionError(error?.message || String(error));
    }
  };

  const assetForLine = (line: PortfolioExecutionPlan['lines'][number]) => scan.candidates.find(c =>
    c.asset.assetId === line.targetAssetId
    || (!!line.targetIsin && c.asset.isin?.toUpperCase() === line.targetIsin.toUpperCase())
    || (!!line.targetTicker && c.asset.ticker.toUpperCase() === line.targetTicker.toUpperCase())
  )?.asset;
  const markUnavailable = (key: string) => { ManualMyInvestorAvailabilityService.set(key, 'UNAVAILABLE'); setAvailabilityRevision(value => value + 1); };
  const resetAvailability = (key: string) => { ManualMyInvestorAvailabilityService.remove(key); setAvailabilityRevision(value => value + 1); };
  void availabilityRevision;

  const headline = actionable.length > 0
    ? `${actionable.length} OPERACIÓN${actionable.length === 1 ? '' : 'ES'} EJECUTABLE${actionable.length === 1 ? '' : 'S'} HOY`
    : reviews.length > 0
      ? 'SIN ORDEN EJECUTABLE · HAY PUNTOS A REVISAR'
      : 'HOY: MANTENER / NO FORZAR OPERACIONES';

  return <section id="pending-portfolio-operations" className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4 sm:p-5">
    <div className="flex items-start gap-2"><ClipboardList className="mt-0.5 h-5 w-5 text-cyan-300"/><div><h2 className="font-bold">Plan ejecutable de la decisión</h2><p className="mt-1 max-w-3xl text-[11px] text-slate-400">Este bloque no vuelve a decidir cartera ni a repetir el gate de candidatos. Recibe el único plan derivado de la decisión superior y sólo aplica ejecución, disponibilidad y fiscalidad.</p></div></div>

    <details className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
      <summary className="touch-target flex cursor-pointer items-center text-xs font-bold text-amber-100">Fiscalidad España aplicada a las rotaciones</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><label className="text-[10px] text-slate-400">Base del ahorro positiva ya acumulada este año antes de estas ventas (€)<input type="number" min="0" step="100" value={taxSettings.priorSavingsTaxableBaseEur} onChange={event => setTaxSettings(previous => ({ ...previous, priorSavingsTaxableBaseEur: Math.max(0, Number(event.target.value) || 0) }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"/></label><button type="button" onClick={saveTaxSettings} className="touch-target flex items-center justify-center gap-1 rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-100"><Save className="h-3.5 w-3.5"/>Guardar contexto fiscal</button></div>
      <label className="mt-3 flex items-start gap-2 text-[10px] text-slate-300"><input type="checkbox" checked={taxSettings.contextConfirmed} onChange={event => setTaxSettings(previous => ({ ...previous, contextConfirmed: event.target.checked }))}/><span>Confirmo que esta cifra es una aproximación útil de mi base positiva del ahorro acumulada. Si no se marca, el motor reserva de forma conservadora el 30% de la plusvalía.</span></label>
      <div className="mt-2 text-[9px] text-slate-500">Escala implementada: 19% / 21% / 23% / 27% / 30%. El contexto fiscal puede aplazar una rotación, pero no sustituye una salida estructural por deterioro severo.</div>
    </details>

    {lastExecution && <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100"><div className="font-bold">Cartera actualizada</div><div className="mt-1">{lastExecution.description}</div><div className="mt-1 font-mono text-[10px] text-emerald-200">Liquidez: {lastExecution.liquidityBeforeEur.toFixed(2)} € → {lastExecution.liquidityAfterEur.toFixed(2)} €</div></div>}
    {executionError && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100"><b>No se ha aplicado la operación.</b> {executionError}</div>}

    <div className={`mt-4 rounded-xl border p-4 ${actionable.length > 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/5'}`}><div className="text-[10px] uppercase text-slate-500">Ejecución final</div><div className={`mt-1 text-lg font-black ${actionable.length > 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{headline}</div>{actionable.length > 0 && <div className="mt-2 text-xs text-slate-300">{actionable.map(line => `${actionLabel(line.action, line.targetTicker)} ${line.targetTicker ?? line.targetIsin ?? line.sourceLabel ?? ''}${line.amountEur != null ? ` · ${line.amountEur.toFixed(2)} €` : ''}`).join('  |  ')}</div>}{reviews.length > 0 && <div className="mt-2 text-[10px] text-amber-100">{reviews.length} línea{reviews.length === 1 ? '' : 's'} quedaron en REVIEW por costes, efectivo, datos o fiscalidad; no se muestran arriba como órdenes ejecutables.</div>}</div>

    <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-400"><span className="rounded-full border border-slate-700 px-3 py-1">Datos: {plan.decisionAsOf}</span><span className="rounded-full border border-cyan-500/25 px-3 py-1 text-cyan-300">{pending} pendientes</span><span className="rounded-full border border-emerald-500/25 px-3 py-1 text-emerald-200">Cash ref.: {plan.cashBenchmarkAnnualPct.toFixed(2)}%</span></div>

    {plan.warnings.length > 0 && <details className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"><summary className="touch-target flex cursor-pointer items-center text-[10px] font-bold text-amber-100">Avisos de ejecución · {plan.warnings.length}</summary><div className="mt-2 text-[9px] leading-relaxed text-amber-100/70">{plan.warnings.join(' · ')}</div></details>}

    <div className="mt-4 space-y-3">{plan.lines.length === 0 && <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">No hay operaciones ni revisiones derivadas de la decisión actual.</div>}{plan.lines.map((line, index) => {
      const targetAsset = assetForLine(line);
      const availability = targetAsset ? getMyInvestorAvailability(targetAsset) : null;
      const availabilityKey = targetAsset ? (targetAsset.isin ?? targetAsset.ticker) : (line.targetIsin ?? line.targetTicker ?? null);
      const needsTargetAvailability = ['BUY_ETF', 'SUBSCRIBE_FUND', 'TRANSFER_FUND'].includes(line.action) && Boolean(availabilityKey);
      const unavailable = needsTargetAvailability && availability?.status === 'USER_CONFIRMED_UNAVAILABLE';
      const canApply = line.status === 'PENDING' && ['BUY_ETF','SELL_ETF','SUBSCRIBE_FUND','TRANSFER_FUND','REDEEM_FUND'].includes(line.action) && !unavailable;
      const displayTicker = line.targetTicker ?? targetAsset?.ticker ?? null;
      const inspectKey = line.instrumentType === 'MUTUAL_FUND' ? (line.targetIsin ?? line.sourceIsin ?? line.targetTicker ?? null) : (line.targetTicker ?? line.targetIsin ?? null);
      return <article key={line.id} className={`rounded-xl border p-4 ${line.status === 'DONE' ? 'border-emerald-500/20 bg-emerald-500/5 opacity-70' : 'border-slate-800 bg-slate-950/70'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{index + 1}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${actionClass(line.action)}`}>{actionLabel(line.action, displayTicker)}</span>{line.status === 'DONE' && <span className="rounded-full border border-emerald-500/25 px-2 py-1 text-[9px] font-bold text-emerald-200">REGISTRADA</span>}</div><div className="mt-2 text-sm font-semibold text-white">{line.instruction}</div><details className="mt-2"><summary className="touch-target flex cursor-pointer items-center text-[10px] text-slate-500">Por qué</summary><div className="mt-1 text-[10px] text-slate-500">{line.rationale}</div></details></div>{line.status === 'PENDING' && <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">{inspectKey && onInspectAsset && <button type="button" onClick={() => onInspectAsset(inspectKey)} className="touch-target flex items-center justify-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-[10px] font-bold text-cyan-200"><BarChart3 className="h-3 w-3"/>Ver gráfica</button>}{canApply && <button type="button" onClick={() => applyLine(line)} className="touch-target flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white"><Check className="h-3 w-3"/>Aplicar a mi cartera</button>}</div>}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px]">{line.targetTicker && <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono">Ticker {line.targetTicker}</span>}{line.targetIsin && <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-cyan-200">ISIN {line.targetIsin}</span>}{line.amountEur != null && <span className="rounded-lg bg-slate-900 px-2 py-1">{line.amountEur.toFixed(2)} €</span>}{line.shares != null && <span className="rounded-lg bg-slate-900 px-2 py-1">{line.shares} títulos</span>}{line.estimatedFeeEur != null && <span className="rounded-lg bg-slate-900 px-2 py-1">comisión {line.estimatedFeeEur.toFixed(2)} €</span>}</div>
        {needsTargetAvailability && availability && availabilityKey && <div className={`mt-3 rounded-lg border p-3 text-[10px] ${availabilityClass(availability.status)}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><b>MyInvestor:</b> {availabilityLabel(availability.status, availability.evidence)}<div className="mt-1 opacity-75">Código de búsqueda: <span className="font-mono">{availabilityKey}</span></div></div><div>{availability.status === 'USER_CONFIRMED_UNAVAILABLE' ? <button type="button" onClick={() => resetAvailability(availabilityKey)} className="touch-target rounded-md border border-cyan-500/40 px-2 py-1 font-bold text-cyan-200">Volver a asumir disponible</button> : <button type="button" onClick={() => markUnavailable(availabilityKey)} className="touch-target rounded-md border border-rose-500/40 px-2 py-1 text-rose-200">No está disponible</button>}</div></div></div>}
        {line.taxNote && <details className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-100"><summary className="touch-target flex cursor-pointer items-center font-bold">Fiscalidad / fricción de salida</summary><div className="mt-1">{line.taxNote}</div></details>}
      </article>;
    })}</div>
  </section>;
};