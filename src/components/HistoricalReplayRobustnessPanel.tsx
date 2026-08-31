import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Loader2, PlayCircle, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import { CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ComposedChart } from 'recharts';
import {
  AssetUniverseScanner,
  CashBenchmarkService,
  EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
  SpanishTaxSettingsService,
  type AssetUniverseScanResult,
  type DynamicHistoricalReplayResult,
  type DynamicReplayFrequency,
  type DynamicReplaySignal,
  type InvestmentHorizonYears,
  type InvestorRiskProfile
} from '../investment/decision';

interface Props {
  capitalEur: number;
  riskProfile: InvestorRiskProfile;
  horizonYears: InvestmentHorizonYears;
}

interface AuditExecution {
  id: string;
  signature: string;
  executionDate: string;
  signalDate: string;
  assetId: string;
  ticker: string;
  action: 'BUY' | 'ADD' | 'REDUCE' | 'EXIT';
  unitsDelta: number;
  notionalEur: number;
  feeEur: number;
  estimatedTaxEur: number;
  executionPriceEur: number | null;
  reason: string;
}

interface AuditCheckpoint {
  requestedEndDate: string;
  endDate: string;
  finalValueEur: number;
  totalReturnPct: number;
  cashEur: number;
  cashBenchmarkEur: number;
  staticBuyHoldFinalEur: number | null;
  maxDrawdownPct: number;
  decisions: number;
  cumulativeExecutions: number;
  assetValuesEur: Record<string, number>;
}

interface PersistedAudit {
  version: 1;
  startDate: string;
  frequency: DynamicReplayFrequency;
  chunkMonths: number;
  initialCapitalEur: number;
  checkpoints: AuditCheckpoint[];
  executions: AuditExecution[];
}

type SessionStatus = 'IDLE' | 'LOADING_DATA' | 'READY' | 'RUNNING' | 'DONE';

type WorkerResponse =
  | { type: 'READY' }
  | { type: 'RESULT'; requestedEndDate: string; result: DynamicHistoricalReplayResult }
  | { type: 'ERROR'; error: string; requestedEndDate?: string }
  | { type: 'RESET_DONE' };

const STORAGE_KEY = 'historical_progressive_audit_v1';
const MATERIAL_ACTIONS = new Set(['BUY', 'ADD', 'REDUCE', 'EXIT']);

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function today(): string { return isoDate(new Date()); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function warmupDate(date: string): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 3); return isoDate(d); }
function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDate(d);
}
function buildChunkEnds(startDate: string, finalDate: string, months: number): string[] {
  const out: string[] = [];
  let cursor = addMonths(startDate, months);
  while (cursor < finalDate) {
    out.push(cursor);
    cursor = addMonths(cursor, months);
  }
  if (!out.length || out.at(-1) !== finalDate) out.push(finalDate);
  return out;
}
function formatAction(action: AuditExecution['action']): string {
  if (action === 'BUY') return 'COMPRAR';
  if (action === 'ADD') return 'AÑADIR';
  if (action === 'REDUCE') return 'REDUCIR';
  return 'SALIR';
}
function catalogueLabel(assetId: string, ticker: string): string {
  const item = EUR_PORTFOLIO_DISCOVERY_UNIVERSE.find(asset => asset.assetId === assetId);
  return item?.name ?? ticker;
}
function closeOnOrBefore(scan: AssetUniverseScanResult, assetId: string, date: string): number | null {
  const asset = scan.acceptedDataset.assets.find(item => item.assetId === assetId);
  if (!asset) return null;
  const bar = [...asset.bars].reverse().find(item => item.timestamp.slice(0, 10) <= date);
  return bar && bar.close > 0 ? bar.close : null;
}
function executionSignature(signal: DynamicReplaySignal): string {
  return [
    signal.id,
    signal.executionDate ?? '',
    signal.action,
    signal.assetId,
    signal.unitsDelta.toFixed(10),
    signal.notionalEur.toFixed(6),
    signal.feeEur.toFixed(6),
    signal.estimatedTaxEur.toFixed(6),
    signal.executionPriceEur == null ? '' : signal.executionPriceEur.toFixed(8)
  ].join('|');
}
function toAuditExecution(signal: DynamicReplaySignal): AuditExecution {
  return {
    id: signal.id,
    signature: executionSignature(signal),
    executionDate: signal.executionDate!,
    signalDate: signal.signalDate,
    assetId: signal.assetId,
    ticker: signal.ticker,
    action: signal.action as AuditExecution['action'],
    unitsDelta: signal.unitsDelta,
    notionalEur: signal.notionalEur,
    feeEur: signal.feeEur,
    estimatedTaxEur: signal.estimatedTaxEur,
    executionPriceEur: signal.executionPriceEur,
    reason: signal.reason
  };
}
function loadPersistedAudit(): PersistedAudit | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAudit;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
function sameConfiguration(saved: PersistedAudit | null, startDate: string, frequency: DynamicReplayFrequency, chunkMonths: number, capital: number): boolean {
  return Boolean(saved
    && saved.startDate === startDate
    && saved.frequency === frequency
    && saved.chunkMonths === chunkMonths
    && Math.abs(saved.initialCapitalEur - capital) < 0.01);
}

export const HistoricalReplayRobustnessPanel: React.FC<Props> = ({ capitalEur, riskProfile, horizonYears }) => {
  const [startDate, setStartDate] = useState(() => yearsAgo(2));
  const [frequency, setFrequency] = useState<DynamicReplayFrequency>('MONTHLY');
  const [chunkMonths, setChunkMonths] = useState(3);
  const [initialCapital, setInitialCapital] = useState(() => Math.max(1, capitalEur).toFixed(2));
  const [status, setStatus] = useState<SessionStatus>('IDLE');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{ accepted: number; scanned: number; from: string } | null>(null);
  const [chunkEnds, setChunkEnds] = useState<string[]>([]);
  const [checkpoints, setCheckpoints] = useState<AuditCheckpoint[]>([]);
  const [executions, setExecutions] = useState<AuditExecution[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const scanRef = useRef<AssetUniverseScanResult | null>(null);
  const executionsRef = useRef<AuditExecution[]>([]);
  const checkpointsRef = useRef<AuditCheckpoint[]>([]);
  const configRef = useRef<{ startDate: string; frequency: DynamicReplayFrequency; chunkMonths: number; initialCapitalEur: number } | null>(null);

  useEffect(() => { executionsRef.current = executions; }, [executions]);
  useEffect(() => { checkpointsRef.current = checkpoints; }, [checkpoints]);
  useEffect(() => setInitialCapital(Math.max(1, capitalEur).toFixed(2)), [capitalEur]);

  useEffect(() => {
    const saved = loadPersistedAudit();
    if (!saved) return;
    setStartDate(saved.startDate);
    setFrequency(saved.frequency);
    setChunkMonths(saved.chunkMonths);
    setInitialCapital(saved.initialCapitalEur.toFixed(2));
    setCheckpoints(saved.checkpoints ?? []);
    setExecutions(saved.executions ?? []);
    setMessage(`Hay ${saved.checkpoints?.length ?? 0} checkpoints guardados. Pulsa “Preparar / reanudar” para continuar sin borrar lo ya calculado.`);
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const persist = (nextCheckpoints: AuditCheckpoint[], nextExecutions: AuditExecution[]) => {
    const config = configRef.current;
    if (!config) return;
    try {
      const payload: PersistedAudit = {
        version: 1,
        ...config,
        checkpoints: nextCheckpoints,
        executions: nextExecutions
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setWarning(null);
    } catch {
      setWarning('El cálculo continúa, pero el navegador no pudo guardar este checkpoint en almacenamiento local.');
    }
  };

  const finishWorkerResult = (requestedEndDate: string, result: DynamicHistoricalReplayResult) => {
    const scan = scanRef.current;
    if (!scan) {
      setError('Se perdió el dataset REAL de la sesión. Prepara de nuevo para reanudar.');
      setStatus('IDLE');
      return;
    }

    const currentSignals = result.signals
      .filter(signal => signal.executed && signal.executionDate && MATERIAL_ACTIONS.has(signal.action))
      .map(toAuditExecution)
      .sort((a, b) => a.executionDate.localeCompare(b.executionDate) || a.id.localeCompare(b.id));
    const currentById = new Map(currentSignals.map(item => [item.id, item]));

    for (const previous of executionsRef.current) {
      const current = currentById.get(previous.id);
      if (!current || current.signature !== previous.signature) {
        setError(`INCONSISTENCIA DE AUDITORÍA: una ejecución ya guardada (${previous.executionDate} ${previous.ticker} ${previous.action}) desapareció o cambió al ampliar el histórico. El programa no continuará silenciosamente.`);
        setStatus('READY');
        return;
      }
    }

    const previousIds = new Set(executionsRef.current.map(item => item.id));
    const newExecutions = currentSignals.filter(item => !previousIds.has(item.id));
    const nextExecutions = [...executionsRef.current, ...newExecutions]
      .sort((a, b) => a.executionDate.localeCompare(b.executionDate) || a.id.localeCompare(b.id));

    const unitsByAsset = new Map<string, number>();
    for (const operation of currentSignals) {
      unitsByAsset.set(operation.assetId, Math.max(0, (unitsByAsset.get(operation.assetId) ?? 0) + operation.unitsDelta));
    }
    const trackedAssets = new Set(nextExecutions.map(item => item.assetId));
    const assetValuesEur: Record<string, number> = {};
    for (const assetId of trackedAssets) {
      const units = unitsByAsset.get(assetId) ?? 0;
      const price = closeOnOrBefore(scan, assetId, result.endDate);
      assetValuesEur[assetId] = units > 0 && price != null ? units * price : 0;
    }

    const lastPath = result.equityPath.at(-1);
    const checkpoint: AuditCheckpoint = {
      requestedEndDate,
      endDate: result.endDate,
      finalValueEur: result.finalValueEur,
      totalReturnPct: result.totalReturnPct,
      cashEur: lastPath?.cashEur ?? Math.max(0, result.finalValueEur - Object.values(assetValuesEur).reduce((a, b) => a + b, 0)),
      cashBenchmarkEur: lastPath?.cashBenchmarkEur ?? result.allCashFinalEur,
      staticBuyHoldFinalEur: result.staticBuyHoldFinalEur,
      maxDrawdownPct: result.decisionPathMaxDrawdownPct,
      decisions: result.decisions,
      cumulativeExecutions: currentSignals.length,
      assetValuesEur
    };

    const withoutSameEnd = checkpointsRef.current.filter(item => item.requestedEndDate !== requestedEndDate);
    const nextCheckpoints = [...withoutSameEnd, checkpoint].sort((a, b) => a.requestedEndDate.localeCompare(b.requestedEndDate));
    setExecutions(nextExecutions);
    setCheckpoints(nextCheckpoints);
    executionsRef.current = nextExecutions;
    checkpointsRef.current = nextCheckpoints;
    persist(nextCheckpoints, nextExecutions);

    const config = configRef.current;
    const expectedTotal = config ? buildChunkEnds(config.startDate, today(), config.chunkMonths).length : nextCheckpoints.length + 1;
    const complete = nextCheckpoints.length >= expectedTotal;
    setStatus(complete ? 'DONE' : 'READY');
    setMessage(complete
      ? `Replay auditado completado: ${nextCheckpoints.length}/${expectedTotal} tramos guardados.`
      : `Tramo guardado hasta ${result.endDate}. ${newExecutions.length} operaciones nuevas. La interfaz queda libre antes del siguiente tramo.`);
  };

  const prepare = async () => {
    if (status === 'LOADING_DATA' || status === 'RUNNING') return;
    const capital = Number(initialCapital);
    if (!(capital > 0)) { setError('El capital inicial debe ser mayor que cero.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate >= today()) { setError('Elige una fecha pasada válida.'); return; }
    setError(null);
    setWarning(null);
    setStatus('LOADING_DATA');
    setMessage('Descargando una sola vez el histórico REAL necesario para la sesión…');
    try {
      const from = warmupDate(startDate);
      const nextScan = await AssetUniverseScanner.scan(
        EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        from,
        today(),
        { forceRefresh: false, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7 }
      );
      if (nextScan.acceptedDataset.assets.length < 1) throw new Error('No hay instrumentos con histórico REAL suficiente para esa fecha.');
      setCoverage({ accepted: nextScan.accepted, scanned: nextScan.scanned, from });
      scanRef.current = nextScan;
      const ends = buildChunkEnds(startDate, today(), chunkMonths);
      setChunkEnds(ends);

      const saved = loadPersistedAudit();
      const resume = sameConfiguration(saved, startDate, frequency, chunkMonths, capital);
      const restoredCheckpoints = resume ? (saved?.checkpoints ?? []).filter(item => ends.includes(item.requestedEndDate)) : [];
      const restoredExecutions = resume ? (saved?.executions ?? []) : [];
      setCheckpoints(restoredCheckpoints);
      setExecutions(restoredExecutions);
      checkpointsRef.current = restoredCheckpoints;
      executionsRef.current = restoredExecutions;
      configRef.current = { startDate, frequency, chunkMonths, initialCapitalEur: capital };
      if (!resume) localStorage.removeItem(STORAGE_KEY);

      workerRef.current?.terminate();
      const worker = new Worker(new URL('../workers/historicalReplayAudit.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        if (response.type === 'READY') {
          const alreadyDone = checkpointsRef.current.length >= ends.length;
          setStatus(alreadyDone ? 'DONE' : 'READY');
          setMessage(alreadyDone
            ? `La sesión guardada ya contiene ${ends.length}/${ends.length} tramos.`
            : checkpointsRef.current.length
              ? `Reanudado: ${checkpointsRef.current.length}/${ends.length} checkpoints ya estaban guardados.`
              : `Preparado: ${ends.length} tramos de ${chunkMonths} mes${chunkMonths === 1 ? '' : 'es'}.`);
        } else if (response.type === 'RESULT') {
          finishWorkerResult(response.requestedEndDate, response.result);
        } else if (response.type === 'ERROR') {
          setError(`El tramo ${response.requestedEndDate ?? ''} no pudo completarse: ${response.error}`);
          setStatus('READY');
        }
      };
      worker.onerror = event => {
        setError(`El proceso de cálculo aislado falló: ${event.message || 'WORKER_ERROR'}. Los checkpoints anteriores permanecen guardados.`);
        setStatus('IDLE');
      };
      worker.postMessage({
        type: 'INIT',
        dataset: nextScan.acceptedDataset,
        catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE,
        startDate,
        frequency,
        initialCapitalEur: capital,
        riskProfile,
        horizonYears,
        cashBenchmarkAnnualPct: CashBenchmarkService.load(),
        minimumBars: 252,
        taxSettings: SpanishTaxSettingsService.load()
      });
    } catch (e: any) {
      setError(e?.message || String(e));
      setStatus('IDLE');
    }
  };

  const runNextChunk = () => {
    if (status !== 'READY' || !workerRef.current) return;
    const completedEnds = new Set(checkpointsRef.current.map(item => item.requestedEndDate));
    const endDate = chunkEnds.find(date => !completedEnds.has(date));
    if (!endDate) { setStatus('DONE'); return; }
    setError(null);
    setStatus('RUNNING');
    setMessage(`Calculando en proceso aislado el siguiente tramo hasta ${endDate}. Puedes seguir usando la interfaz; al terminar se guardará el checkpoint.`);
    workerRef.current.postMessage({ type: 'RUN', endDate });
  };

  const cancelCurrentWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus('IDLE');
    setMessage('Cálculo aislado cancelado. Los checkpoints ya guardados no se han borrado; pulsa “Preparar / reanudar” para continuar.');
  };

  const reset = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    scanRef.current = null;
    configRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setStatus('IDLE');
    setMessage('');
    setError(null);
    setWarning(null);
    setCoverage(null);
    setChunkEnds([]);
    setCheckpoints([]);
    setExecutions([]);
    checkpointsRef.current = [];
    executionsRef.current = [];
  };

  const assetLegend = useMemo(() => {
    const map = new Map<string, { assetId: string; ticker: string; label: string }>();
    for (const execution of executions) {
      if (!map.has(execution.assetId)) map.set(execution.assetId, {
        assetId: execution.assetId,
        ticker: execution.ticker,
        label: catalogueLabel(execution.assetId, execution.ticker)
      });
    }
    return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [executions]);

  const assetChartKeys = useMemo(() => new Map(assetLegend.map((asset, index) => [asset.assetId, `asset_${index}`])), [assetLegend]);
  const chartData = useMemo(() => checkpoints.map(checkpoint => {
    const row: Record<string, string | number | null> = {
      date: checkpoint.endDate,
      patrimonio: checkpoint.finalValueEur,
      cash: checkpoint.cashEur,
      cuenta: checkpoint.cashBenchmarkEur,
      primeraCartera: checkpoint.staticBuyHoldFinalEur
    };
    for (const asset of assetLegend) row[assetChartKeys.get(asset.assetId)!] = checkpoint.assetValuesEur[asset.assetId] ?? 0;
    return row;
  }), [checkpoints, assetLegend, assetChartKeys]);

  const completed = checkpoints.length;
  const total = chunkEnds.length;
  const progressPct = total > 0 ? Math.min(100, completed / total * 100) : 0;
  const controlsLocked = status === 'LOADING_DATA' || status === 'READY' || status === 'RUNNING' || status === 'DONE';

  return <section className="mt-5 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/20 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-fuchsia-300"/><h2 className="font-bold text-white">Replay auditado por tramos</h2></div>
        <p className="mt-1 text-[11px] text-slate-400">Elige una fecha de inicio. Cada tramo recalcula causalmente desde esa fecha hasta un checkpoint, pero el trabajo pesado se ejecuta fuera del hilo de la interfaz. Después de cada tramo se guardan patrimonio, composición y todas las compras/ventas. Una operación ya registrada no puede cambiar o desaparecer silenciosamente: si ocurre, la auditoría se detiene.</p>
      </div>
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1 text-[9px] font-black text-emerald-200"><ShieldCheck className="h-3 w-3"/> CHECKPOINTS PERSISTENTES</span>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-4">
      <label className="text-[10px] text-slate-400">Fecha inicial<input type="date" value={startDate} disabled={controlsLocked} max={today()} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/></label>
      <label className="text-[10px] text-slate-400">Frecuencia de decisiones<select value={frequency} disabled={controlsLocked} onChange={e => setFrequency(e.target.value as DynamicReplayFrequency)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"><option value="MONTHLY">Mensual</option><option value="WEEKLY">Semanal</option><option value="DAILY">Cada sesión</option><option value="QUARTERLY">Trimestral</option></select></label>
      <label className="text-[10px] text-slate-400">Tamaño del tramo<select value={chunkMonths} disabled={controlsLocked} onChange={e => setChunkMonths(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"><option value={1}>1 mes</option><option value={2}>2 meses</option><option value={3}>3 meses</option><option value={6}>6 meses</option></select></label>
      <label className="text-[10px] text-slate-400">Capital inicial<input type="number" min="1" step="100" value={initialCapital} disabled={controlsLocked} onChange={e => setInitialCapital(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/></label>
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {status === 'IDLE' && <button type="button" onClick={() => void prepare()} className="flex min-h-11 items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold text-fuchsia-100"><PlayCircle className="h-4 w-4"/>Preparar / reanudar</button>}
      {status === 'LOADING_DATA' && <button disabled className="flex min-h-11 items-center gap-2 rounded-xl border border-fuchsia-500/20 px-4 py-2 text-xs text-fuchsia-200 opacity-70"><Loader2 className="h-4 w-4 animate-spin"/>Cargando histórico REAL…</button>}
      {status === 'READY' && <button type="button" onClick={runNextChunk} className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-100"><PlayCircle className="h-4 w-4"/>Ejecutar siguiente tramo</button>}
      {status === 'RUNNING' && <button type="button" onClick={cancelCurrentWorker} className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-100"><Square className="h-4 w-4"/>Cancelar tramo</button>}
      <button type="button" onClick={reset} disabled={status === 'LOADING_DATA' || status === 'RUNNING'} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-300 disabled:opacity-40"><RotateCcw className="h-4 w-4"/>Nueva sesión</button>
    </div>

    {total > 0 && <div className="mt-3 rounded-lg border border-fuchsia-500/15 bg-slate-950/60 p-3"><div className="flex items-center justify-between text-[10px] text-slate-400"><span>{message}</span><b className="font-mono text-fuchsia-200">{completed}/{total}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${progressPct}%` }}/></div></div>}
    {!total && message && <div className="mt-3 text-[10px] text-slate-400">{message}</div>}
    {coverage && <div className="mt-2 text-[9px] text-slate-500">Cobertura REAL preparada: {coverage.accepted}/{coverage.scanned} instrumentos · warm-up desde {coverage.from}.</div>}
    {warning && <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">{warning}</div>}
    {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</div>}

    {checkpoints.length > 0 && <div className="mt-5 space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Último checkpoint</div><b>{checkpoints.at(-1)!.endDate}</b><div className="text-[9px] text-slate-500">guardado en navegador</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Patrimonio</div><b>{checkpoints.at(-1)!.finalValueEur.toFixed(2)} €</b><div>{checkpoints.at(-1)!.totalReturnPct >= 0 ? '+' : ''}{checkpoints.at(-1)!.totalReturnPct.toFixed(2)}%</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Operaciones auditadas</div><b>{executions.length}</b><div className="text-[9px] text-slate-500">BUY / ADD / REDUCE / EXIT</div></div>
        <div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Integridad</div><b className="text-emerald-200">SIN CAMBIOS SILENCIOSOS</b><div className="text-[9px] text-slate-500">se compara cada checkpoint con los anteriores</div></div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-2"><b className="text-xs text-white">Evolución por tramos y composición real simulada</b><div className="text-[9px] text-slate-500">Cada línea de activo es el valor de esa posición en el checkpoint. Si sale de cartera pasa a 0; si entra aparece desde su compra.</div></div>
        <div className="h-[360px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.18}/><XAxis dataKey="date" tick={{ fontSize: 9 }}/><YAxis tick={{ fontSize: 9 }}/><Tooltip formatter={(value: any, name: any) => [`${Number(value ?? 0).toFixed(2)} €`, name]}/><Legend wrapperStyle={{ fontSize: 9 }}/><Line type="monotone" dataKey="patrimonio" name="Patrimonio total" dot={false} strokeWidth={3}/><Line type="monotone" dataKey="cuenta" name="Todo en cuenta" dot={false} strokeDasharray="5 5"/>{assetLegend.map(asset => <Line key={asset.assetId} type="monotone" dataKey={assetChartKeys.get(asset.assetId)!} name={`${asset.ticker} · posición`} dot={false}/>)}</ComposedChart></ResponsiveContainer></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[900px] text-[10px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Checkpoint</th><th className="p-2 text-right">Patrimonio</th><th className="p-2 text-right">Cash</th><th className="p-2 text-right">DD</th><th className="p-2 text-right">Decisiones</th><th className="p-2 text-left">Composición</th></tr></thead><tbody>{checkpoints.map(checkpoint => <tr key={checkpoint.requestedEndDate} className="border-t border-slate-800"><td className="p-2 font-mono">{checkpoint.endDate}</td><td className="p-2 text-right">{checkpoint.finalValueEur.toFixed(2)} €</td><td className="p-2 text-right">{checkpoint.cashEur.toFixed(2)} €</td><td className="p-2 text-right text-amber-200">-{checkpoint.maxDrawdownPct.toFixed(2)}%</td><td className="p-2 text-right">{checkpoint.decisions}</td><td className="p-2 text-slate-300">{assetLegend.filter(asset => (checkpoint.assetValuesEur[asset.assetId] ?? 0) > 0.01).map(asset => `${asset.ticker} ${(checkpoint.assetValuesEur[asset.assetId] ?? 0).toFixed(0)} €`).join(' · ') || 'Sin posiciones'}</td></tr>)}</tbody></table></div>

      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full min-w-[1080px] text-[10px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Ejecución</th><th className="p-2 text-left">Acción</th><th className="p-2 text-left">Activo</th><th className="p-2 text-right">Importe</th><th className="p-2 text-right">Unidades</th><th className="p-2 text-right">Precio</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{executions.map(operation => <tr key={operation.id} className="border-t border-slate-800"><td className="p-2 font-mono text-slate-300">{operation.executionDate}</td><td className={`p-2 font-bold ${operation.action === 'BUY' || operation.action === 'ADD' ? 'text-emerald-200' : 'text-rose-200'}`}>{formatAction(operation.action)}</td><td className="p-2"><b>{operation.ticker}</b><div className="max-w-[260px] truncate text-[9px] text-slate-500">{catalogueLabel(operation.assetId, operation.ticker)}</div></td><td className="p-2 text-right">{operation.notionalEur.toFixed(2)} €</td><td className="p-2 text-right font-mono">{operation.unitsDelta >= 0 ? '+' : ''}{operation.unitsDelta.toFixed(6)}</td><td className="p-2 text-right">{operation.executionPriceEur == null ? 'N/D' : `${operation.executionPriceEur.toFixed(4)} €`}</td><td className="p-2 text-slate-400">{operation.reason}</td></tr>)}</tbody></table></div>
    </div>}
  </section>;
};
