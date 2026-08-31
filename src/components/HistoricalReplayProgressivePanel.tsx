import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Loader2, Pause, PlayCircle, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

type RunMode = 'MANUAL' | 'AUTO';
type SessionStatus = 'IDLE' | 'LOADING_DATA' | 'READY' | 'RUNNING' | 'DONE';
type WorkerResponse =
  | { type: 'READY' }
  | { type: 'RESULT'; requestedEndDate: string; result: DynamicHistoricalReplayResult }
  | { type: 'ERROR'; error: string; requestedEndDate?: string }
  | { type: 'RESET_DONE' };

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
  realizedGainEur: number;
  estimatedTaxEur: number;
  taxDeferredTransferEur: number;
  executionPriceEur: number | null;
  reason: string;
}

interface AuditSignal {
  id: string;
  signalDate: string;
  executionDate: string | null;
  assetId: string;
  ticker: string;
  action: DynamicReplaySignal['action'];
  recommendedAmountEur: number;
  targetWeight: number;
  currentWeight: number;
  executed: boolean;
  reason: string;
}

interface AuditPathPoint {
  date: string;
  equityEur: number;
  cashEur: number;
  investedEur: number;
  cashBenchmarkEur: number;
  regime: string;
  method: string;
  assetValuesEur: Record<string, number>;
}

interface AuditCheckpoint {
  requestedEndDate: string;
  endDate: string;
  finalValueEur: number;
  totalReturnPct: number;
  cashEur: number;
  cashBenchmarkEur: number;
  maxDrawdownPct: number;
  decisions: number;
  cumulativeExecutions: number;
  assetValuesEur: Record<string, number>;
}

interface PositionSummary {
  id: string;
  assetId: string;
  ticker: string;
  name: string;
  entryDate: string;
  exitDate: string | null;
  status: 'CERRADA' | 'ABIERTA';
  entryPriceEur: number | null;
  totalBoughtEur: number;
  totalFeesEur: number;
  realizedGainEur: number;
  estimatedTaxEur: number;
  taxDeferredTransferEur: number;
  mfePct: number;
  maePct: number;
  finalGrossProfitEur: number;
  finalGrossPct: number;
  finalNetProfitEur: number;
  finalNetPct: number;
  taxLabel: string;
}

interface ReplaySummary {
  endDate: string;
  engineFinalEur: number;
  engineProfitEur: number;
  engineReturnPct: number;
  engineMaxDrawdownPct: number;
  engineFeesEur: number;
  engineTaxEur: number;
  engineTransferredEur: number;
  exactHoldFinalEur: number | null;
  exactHoldProfitEur: number | null;
  exactHoldReturnPct: number | null;
  advantageEur: number | null;
  advantagePctPoints: number | null;
  taxMethod: DynamicHistoricalReplayResult['taxMethod'];
  initialPortfolioDate: string | null;
}

interface AuditConfig {
  startDate: string;
  frequency: DynamicReplayFrequency;
  runMode: RunMode;
  durationMonths: number;
  chunkDays: number;
  initialCapitalEur: number;
}

interface PersistedAudit extends AuditConfig {
  version: 3;
  checkpoints: AuditCheckpoint[];
  executions: AuditExecution[];
  path: AuditPathPoint[];
  signals: AuditSignal[];
  summary?: ReplaySummary | null;
  positions?: PositionSummary[];
}

const STORAGE_KEY = 'historical_progressive_audit_v3';
const LEGACY_STORAGE_KEY = 'historical_progressive_audit_v2';
const MATERIAL_ACTIONS = new Set(['BUY', 'ADD', 'REDUCE', 'EXIT']);
const AUTO_PAUSE_MS = 300;
const ASSET_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#34d399', '#fb7185', '#60a5fa', '#f472b6', '#a3e635', '#fb923c', '#2dd4bf', '#c084fc', '#facc15'];

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function today(): string { return isoDate(new Date()); }
function yearsAgo(years: number): string { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return isoDate(d); }
function warmupDate(date: string): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 3); return isoDate(d); }
function addDays(date: string, days: number): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return isoDate(d); }
function addMonths(date: string, months: number): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + months); return isoDate(d); }
function earlierDate(a: string, b: string): string { return a < b ? a : b; }
function buildChunkEnds(startDate: string, finalDate: string, chunkDays: number): string[] {
  const out: string[] = [];
  let cursor = addDays(startDate, chunkDays);
  while (cursor < finalDate) { out.push(cursor); cursor = addDays(cursor, chunkDays); }
  if (!out.length || out.at(-1) !== finalDate) out.push(finalDate);
  return out;
}
function catalogueLabel(assetId: string, ticker: string): string {
  return EUR_PORTFOLIO_DISCOVERY_UNIVERSE.find(asset => asset.assetId === assetId)?.name ?? ticker;
}
function actionLabel(action: DynamicReplaySignal['action']): string {
  if (action === 'BUY') return 'COMPRAR';
  if (action === 'ADD') return 'AÑADIR';
  if (action === 'REDUCE') return 'REDUCIR';
  if (action === 'EXIT') return 'SALIR';
  if (action === 'AVOID') return 'NO COMPRAR';
  return 'MANTENER';
}
function executionSignature(signal: DynamicReplaySignal): string {
  return [signal.id, signal.executionDate ?? '', signal.action, signal.assetId, signal.unitsDelta.toFixed(10), signal.notionalEur.toFixed(6), signal.feeEur.toFixed(6), signal.realizedGainEur.toFixed(6), signal.estimatedTaxEur.toFixed(6), signal.taxDeferredTransferEur.toFixed(6), signal.executionPriceEur == null ? '' : signal.executionPriceEur.toFixed(8)].join('|');
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
    realizedGainEur: signal.realizedGainEur,
    estimatedTaxEur: signal.estimatedTaxEur,
    taxDeferredTransferEur: signal.taxDeferredTransferEur,
    executionPriceEur: signal.executionPriceEur,
    reason: signal.reason
  };
}
function toAuditSignal(signal: DynamicReplaySignal): AuditSignal {
  return {
    id: signal.id,
    signalDate: signal.signalDate,
    executionDate: signal.executionDate,
    assetId: signal.assetId,
    ticker: signal.ticker,
    action: signal.action,
    recommendedAmountEur: signal.recommendedAmountEur,
    targetWeight: signal.targetWeight,
    currentWeight: signal.currentWeight,
    executed: signal.executed,
    reason: signal.reason
  };
}
function loadPersistedAudit(): PersistedAudit | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAudit;
    return parsed?.version === 3 ? parsed : null;
  } catch { return null; }
}
function loadLegacyAudit(): any | null {
  try { const raw = localStorage.getItem(LEGACY_STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function sameConfiguration(saved: PersistedAudit | null, config: AuditConfig): boolean {
  return Boolean(saved
    && saved.startDate === config.startDate
    && saved.frequency === config.frequency
    && saved.runMode === config.runMode
    && saved.durationMonths === config.durationMonths
    && saved.chunkDays === config.chunkDays
    && Math.abs(saved.initialCapitalEur - config.initialCapitalEur) < 0.01);
}
function latestPrice(scan: AssetUniverseScanResult, assetId: string, date: string): number | null {
  const asset = scan.acceptedDataset.assets.find(item => item.assetId === assetId);
  const bar = asset?.bars.filter(item => item.timestamp.slice(0, 10) <= date).at(-1);
  return bar && bar.close > 0 ? bar.close : null;
}

function buildPath(result: DynamicHistoricalReplayResult, scan: AssetUniverseScanResult, executions: AuditExecution[], requestedStartDate: string): AuditPathPoint[] {
  const trackedAssets = [...new Set(executions.map(item => item.assetId))];
  const pricesByAssetDate = new Map<string, Map<string, number>>();
  for (const assetId of trackedAssets) {
    const asset = scan.acceptedDataset.assets.find(item => item.assetId === assetId);
    pricesByAssetDate.set(assetId, new Map((asset?.bars ?? []).map(bar => [bar.timestamp.slice(0, 10), bar.close])));
  }
  const operationsByDate = new Map<string, AuditExecution[]>();
  for (const operation of executions) operationsByDate.set(operation.executionDate, [...(operationsByDate.get(operation.executionDate) ?? []), operation]);
  const units = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  const out: AuditPathPoint[] = [];

  if (!result.equityPath.length || result.equityPath[0].date > requestedStartDate) {
    out.push({ date: requestedStartDate, equityEur: result.initialCapitalEur, cashEur: result.initialCapitalEur, investedEur: 0, cashBenchmarkEur: result.initialCapitalEur, regime: 'PRE_DECISION', method: 'N/D', assetValuesEur: {} });
  }

  for (const point of result.equityPath) {
    for (const assetId of trackedAssets) {
      const price = pricesByAssetDate.get(assetId)?.get(point.date);
      if (price != null && price > 0) lastPrice.set(assetId, price);
    }
    for (const operation of operationsByDate.get(point.date) ?? []) {
      units.set(operation.assetId, Math.max(0, (units.get(operation.assetId) ?? 0) + operation.unitsDelta));
    }
    const assetValuesEur: Record<string, number> = {};
    for (const assetId of trackedAssets) assetValuesEur[assetId] = (units.get(assetId) ?? 0) * (lastPrice.get(assetId) ?? 0);
    out.push({ date: point.date, equityEur: point.equityEur, cashEur: point.cashEur, investedEur: point.investedEur, cashBenchmarkEur: point.cashBenchmarkEur, regime: point.regime, method: point.method, assetValuesEur });
  }
  return out;
}

function buildExactInitialHold(input: {
  scan: AssetUniverseScanResult;
  executions: AuditExecution[];
  path: AuditPathPoint[];
  initialCapitalEur: number;
  endDate: string;
}): { finalEur: number | null; returnPct: number | null; firstDate: string | null } {
  const positive = input.executions.filter(operation => operation.unitsDelta > 0).sort((a, b) => a.executionDate.localeCompare(b.executionDate));
  const firstDate = positive[0]?.executionDate ?? null;
  if (!firstDate) return { finalEur: null, returnPct: null, firstDate: null };
  const initialBuys = positive.filter(operation => operation.executionDate === firstDate);
  const spent = initialBuys.reduce((sum, operation) => sum + operation.notionalEur + operation.feeEur, 0);
  const residualCash = Math.max(0, input.initialCapitalEur - spent);
  const benchmarkAtEntry = input.path.find(point => point.date >= firstDate)?.cashBenchmarkEur ?? input.initialCapitalEur;
  const benchmarkEnd = input.path.at(-1)?.cashBenchmarkEur ?? benchmarkAtEntry;
  const cashGrowth = benchmarkAtEntry > 0 ? benchmarkEnd / benchmarkAtEntry : 1;
  let finalEur = residualCash * cashGrowth;
  for (const operation of initialBuys) {
    const price = latestPrice(input.scan, operation.assetId, input.endDate);
    if (price == null) return { finalEur: null, returnPct: null, firstDate };
    finalEur += Math.max(0, operation.unitsDelta) * price;
  }
  return { finalEur, returnPct: (finalEur / input.initialCapitalEur - 1) * 100, firstDate };
}

function buildPositionSummaries(scan: AssetUniverseScanResult, executions: AuditExecution[], endDate: string): PositionSummary[] {
  const grouped = new Map<string, AuditExecution[]>();
  for (const operation of executions) grouped.set(operation.assetId, [...(grouped.get(operation.assetId) ?? []), operation]);
  const summaries: PositionSummary[] = [];

  for (const [assetId, rawOperations] of grouped) {
    const operations = [...rawOperations].sort((a, b) => a.executionDate.localeCompare(b.executionDate) || a.id.localeCompare(b.id));
    const asset = scan.acceptedDataset.assets.find(item => item.assetId === assetId);
    const bars = asset?.bars.map(bar => ({ date: bar.timestamp.slice(0, 10), close: bar.close })).filter(bar => bar.close > 0) ?? [];
    let cycleIndex = 0;
    let cycleOps: AuditExecution[] = [];
    let runningUnits = 0;

    const closeCycle = (ops: AuditExecution[], closed: boolean) => {
      if (!ops.length) return;
      cycleIndex += 1;
      const entryDate = ops.find(op => op.unitsDelta > 0)?.executionDate;
      if (!entryDate) return;
      const exitDate = closed ? ops.at(-1)!.executionDate : null;
      const cycleEnd = exitDate ?? endDate;
      const totalBoughtEur = ops.filter(op => op.unitsDelta > 0).reduce((sum, op) => sum + op.notionalEur, 0);
      const totalFeesEur = ops.reduce((sum, op) => sum + op.feeEur, 0);
      const realizedGainEur = ops.reduce((sum, op) => sum + op.realizedGainEur, 0);
      const estimatedTaxEur = ops.reduce((sum, op) => sum + op.estimatedTaxEur, 0);
      const deferredInEur = ops.filter(op => op.unitsDelta > 0).reduce((sum, op) => sum + op.taxDeferredTransferEur, 0);
      const deferredOutEur = ops.filter(op => op.unitsDelta < 0).reduce((sum, op) => sum + op.taxDeferredTransferEur, 0);
      const taxDeferredTransferEur = deferredInEur + deferredOutEur;
      const entryPriceEur = ops.find(op => op.unitsDelta > 0)?.executionPriceEur ?? null;
      const opsByDate = new Map<string, AuditExecution[]>();
      for (const op of ops) opsByDate.set(op.executionDate, [...(opsByDate.get(op.executionDate) ?? []), op]);

      let units = 0;
      let basisEur = 0;
      let contributedEur = 0;
      let cumulativeRealizedGain = 0;
      let maxPct = Number.NEGATIVE_INFINITY;
      let minPct = Number.POSITIVE_INFINITY;
      for (const bar of bars.filter(bar => bar.date >= entryDate && bar.date <= cycleEnd)) {
        for (const op of opsByDate.get(bar.date) ?? []) {
          if (op.unitsDelta > 0) {
            units += op.unitsDelta;
            basisEur += op.notionalEur + op.feeEur;
            contributedEur += op.notionalEur + op.feeEur;
          } else if (op.unitsDelta < 0 && units > 0) {
            const soldUnits = Math.min(units, Math.abs(op.unitsDelta));
            basisEur -= basisEur * (soldUnits / units);
            units -= soldUnits;
            cumulativeRealizedGain += op.realizedGainEur;
          }
        }
        const unrealized = units > 0 ? units * bar.close - basisEur : 0;
        const pct = contributedEur > 0 ? (cumulativeRealizedGain + unrealized) / contributedEur * 100 : 0;
        maxPct = Math.max(maxPct, pct);
        minPct = Math.min(minPct, pct);
      }
      if (!Number.isFinite(maxPct)) maxPct = 0;
      if (!Number.isFinite(minPct)) minPct = 0;
      const endPrice = latestPrice(scan, assetId, cycleEnd);
      const remainingUnits = ops.reduce((sum, op) => Math.max(0, sum + op.unitsDelta), 0);
      const remainingBasisApprox = (() => {
        let u = 0; let basis = 0;
        for (const op of ops) {
          if (op.unitsDelta > 0) { u += op.unitsDelta; basis += op.notionalEur + op.feeEur; }
          else if (op.unitsDelta < 0 && u > 0) { const sold = Math.min(u, Math.abs(op.unitsDelta)); basis -= basis * sold / u; u -= sold; }
        }
        return basis;
      })();
      const unrealizedAtEnd = remainingUnits > 0 && endPrice != null ? remainingUnits * endPrice - remainingBasisApprox : 0;
      const afterFeesBeforeTaxProfitEur = realizedGainEur + unrealizedAtEnd;
      const finalGrossProfitEur = afterFeesBeforeTaxProfitEur + totalFeesEur;
      const finalNetProfitEur = afterFeesBeforeTaxProfitEur - estimatedTaxEur;
      const denominator = Math.max(1e-9, totalBoughtEur);
      const taxLabel = deferredOutEur > 0 && estimatedTaxEur > 1e-9
        ? `TRASPASO PARCIAL · ${deferredOutEur.toFixed(2)} € diferidos · parte no diferida con impuesto ${estimatedTaxEur.toFixed(2)} €`
        : deferredOutEur > 0
          ? `TRASPASO DIFERIDO · ${deferredOutEur.toFixed(2)} € · impuesto inmediato 0 €`
          : estimatedTaxEur > 0
            ? `VENTA CON PLUSVALÍA · impuesto estimado ${estimatedTaxEur.toFixed(2)} €`
            : realizedGainEur < -1e-9
              ? 'VENTA CON PÉRDIDA · impuesto estimado 0 € en esta operación'
              : !closed && deferredInEur > 0
                ? `POSICIÓN ABIERTA · ${deferredInEur.toFixed(2)} € recibidos mediante traspaso fiscalmente diferido`
                : closed
                  ? 'SIN IMPUESTO ESTIMADO EN LA SALIDA'
                  : 'POSICIÓN ABIERTA · fiscalidad no realizada todavía';
      summaries.push({
        id: `${assetId}_${cycleIndex}_${entryDate}`,
        assetId,
        ticker: ops[0].ticker,
        name: catalogueLabel(assetId, ops[0].ticker),
        entryDate,
        exitDate,
        status: closed ? 'CERRADA' : 'ABIERTA',
        entryPriceEur,
        totalBoughtEur,
        totalFeesEur,
        realizedGainEur,
        estimatedTaxEur,
        taxDeferredTransferEur,
        mfePct: Math.max(0, maxPct),
        maePct: Math.min(0, minPct),
        finalGrossProfitEur,
        finalGrossPct: finalGrossProfitEur / denominator * 100,
        finalNetProfitEur,
        finalNetPct: finalNetProfitEur / denominator * 100,
        taxLabel
      });
    };

    for (const operation of operations) {
      const before = runningUnits;
      if (before <= 1e-10 && operation.unitsDelta > 0) cycleOps = [];
      cycleOps.push(operation);
      runningUnits = Math.max(0, runningUnits + operation.unitsDelta);
      if (before > 0 && runningUnits <= 1e-10) { closeCycle(cycleOps, true); cycleOps = []; }
    }
    if (cycleOps.length && runningUnits > 1e-10) closeCycle(cycleOps, false);
  }
  return summaries.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.ticker.localeCompare(b.ticker));
}

export const HistoricalReplayProgressivePanel: React.FC<Props> = ({ capitalEur, riskProfile, horizonYears }) => {
  const [startDate, setStartDate] = useState(() => yearsAgo(2));
  const [frequency, setFrequency] = useState<DynamicReplayFrequency>('MONTHLY');
  const [runMode, setRunMode] = useState<RunMode>('MANUAL');
  const [durationMonths, setDurationMonths] = useState(12);
  const [chunkDays, setChunkDays] = useState(30);
  const [initialCapital, setInitialCapital] = useState(() => Math.max(1, capitalEur).toFixed(2));
  const [status, setStatus] = useState<SessionStatus>('IDLE');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{ accepted: number; scanned: number; from: string } | null>(null);
  const [chunkEnds, setChunkEnds] = useState<string[]>([]);
  const [checkpoints, setCheckpoints] = useState<AuditCheckpoint[]>([]);
  const [executions, setExecutions] = useState<AuditExecution[]>([]);
  const [path, setPath] = useState<AuditPathPoint[]>([]);
  const [signals, setSignals] = useState<AuditSignal[]>([]);
  const [summary, setSummary] = useState<ReplaySummary | null>(null);
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const scanRef = useRef<AssetUniverseScanResult | null>(null);
  const checkpointsRef = useRef<AuditCheckpoint[]>([]);
  const executionsRef = useRef<AuditExecution[]>([]);
  const pathRef = useRef<AuditPathPoint[]>([]);
  const signalsRef = useRef<AuditSignal[]>([]);
  const configRef = useRef<AuditConfig | null>(null);
  const chunkEndsRef = useRef<string[]>([]);
  const autoRunningRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);

  useEffect(() => { checkpointsRef.current = checkpoints; }, [checkpoints]);
  useEffect(() => { executionsRef.current = executions; }, [executions]);
  useEffect(() => { pathRef.current = path; }, [path]);
  useEffect(() => { signalsRef.current = signals; }, [signals]);
  useEffect(() => { autoRunningRef.current = autoRunning; }, [autoRunning]);
  useEffect(() => setInitialCapital(Math.max(1, capitalEur).toFixed(2)), [capitalEur]);
  useEffect(() => () => { workerRef.current?.terminate(); if (autoTimerRef.current != null) window.clearTimeout(autoTimerRef.current); }, []);

  useEffect(() => {
    const saved = loadPersistedAudit();
    if (saved) {
      setStartDate(saved.startDate); setFrequency(saved.frequency); setRunMode(saved.runMode); setDurationMonths(saved.durationMonths); setChunkDays(saved.chunkDays); setInitialCapital(saved.initialCapitalEur.toFixed(2));
      setCheckpoints(saved.checkpoints ?? []); setExecutions(saved.executions ?? []); setPath(saved.path ?? []); setSignals(saved.signals ?? []); setSummary(saved.summary ?? null); setPositions(saved.positions ?? []);
      checkpointsRef.current = saved.checkpoints ?? []; executionsRef.current = saved.executions ?? []; pathRef.current = saved.path ?? []; signalsRef.current = saved.signals ?? [];
      setMessage(`Hay ${saved.checkpoints?.length ?? 0} checkpoints guardados. Pulsa “Preparar / reanudar” para continuar.`);
      return;
    }
    const legacy = loadLegacyAudit();
    if (legacy?.version === 2) {
      setStartDate(legacy.startDate); setFrequency(legacy.frequency); setRunMode(legacy.runMode); setDurationMonths(legacy.durationMonths); setChunkDays(legacy.chunkDays); setInitialCapital(Number(legacy.initialCapitalEur).toFixed(2));
      setCheckpoints(legacy.checkpoints ?? []); setExecutions(legacy.executions ?? []);
      checkpointsRef.current = legacy.checkpoints ?? []; executionsRef.current = legacy.executions ?? [];
      setMessage('He recuperado los checkpoints anteriores. La trayectoria completa aparecerá al calcular el siguiente tramo.');
    }
  }, []);

  const persist = (nextCheckpoints: AuditCheckpoint[], nextExecutions: AuditExecution[], nextPath: AuditPathPoint[], nextSignals: AuditSignal[], nextSummary: ReplaySummary | null, nextPositions: PositionSummary[]) => {
    const config = configRef.current;
    if (!config) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, ...config, checkpoints: nextCheckpoints, executions: nextExecutions, path: nextPath, signals: nextSignals, summary: nextSummary, positions: nextPositions } satisfies PersistedAudit));
      setWarning(null);
    } catch {
      setWarning('El cálculo continúa, pero el navegador no pudo guardar toda la trayectoria localmente. Los resultados siguen visibles mientras no cierres esta sesión.');
    }
  };

  const nextPendingEnd = (points = checkpointsRef.current): string | null => {
    const done = new Set(points.map(item => item.requestedEndDate));
    return chunkEndsRef.current.find(date => !done.has(date)) ?? null;
  };
  const postRun = (endDate: string) => {
    if (!workerRef.current) return;
    setError(null); setStatus('RUNNING');
    setMessage(`Calculando tramo hasta ${endDate}. La interfaz permanece separada del cálculo.`);
    workerRef.current.postMessage({ type: 'RUN', endDate });
  };
  const scheduleNextAuto = () => {
    if (!autoRunningRef.current) return;
    const next = nextPendingEnd();
    if (!next) { setAutoRunning(false); autoRunningRef.current = false; setStatus('DONE'); return; }
    if (autoTimerRef.current != null) window.clearTimeout(autoTimerRef.current);
    autoTimerRef.current = window.setTimeout(() => { if (autoRunningRef.current) postRun(next); }, AUTO_PAUSE_MS);
  };

  const finishWorkerResult = (requestedEndDate: string, result: DynamicHistoricalReplayResult) => {
    const scan = scanRef.current;
    if (!scan) { setError('Se perdió el dataset REAL de la sesión. Prepara de nuevo.'); setStatus('IDLE'); setAutoRunning(false); autoRunningRef.current = false; return; }

    const currentExecutions = result.signals.filter(signal => signal.executed && signal.executionDate && MATERIAL_ACTIONS.has(signal.action)).map(toAuditExecution).sort((a, b) => a.executionDate.localeCompare(b.executionDate) || a.id.localeCompare(b.id));
    const currentById = new Map(currentExecutions.map(item => [item.id, item]));
    for (const previous of executionsRef.current) {
      const current = currentById.get(previous.id);
      if (!current || current.signature !== previous.signature) {
        setError(`INCONSISTENCIA DE AUDITORÍA: una ejecución guardada (${previous.executionDate} ${previous.ticker} ${previous.action}) desapareció o cambió. El programa no continuará silenciosamente.`);
        setStatus('READY'); setAutoRunning(false); autoRunningRef.current = false; return;
      }
    }

    const currentSignals = result.signals.map(toAuditSignal).sort((a, b) => a.signalDate.localeCompare(b.signalDate) || a.id.localeCompare(b.id));
    const nextPath = buildPath(result, scan, currentExecutions, configRef.current?.startDate ?? startDate);
    const lastPath = nextPath.at(-1);
    const assetValuesEur = lastPath?.assetValuesEur ?? {};
    const checkpoint: AuditCheckpoint = {
      requestedEndDate,
      endDate: result.endDate,
      finalValueEur: result.finalValueEur,
      totalReturnPct: result.totalReturnPct,
      cashEur: lastPath?.cashEur ?? result.finalValueEur,
      cashBenchmarkEur: lastPath?.cashBenchmarkEur ?? result.allCashFinalEur,
      maxDrawdownPct: result.decisionPathMaxDrawdownPct,
      decisions: result.decisions,
      cumulativeExecutions: currentExecutions.length,
      assetValuesEur
    };
    const nextCheckpoints = [...checkpointsRef.current.filter(item => item.requestedEndDate !== requestedEndDate), checkpoint].sort((a, b) => a.requestedEndDate.localeCompare(b.requestedEndDate));
    const exactHold = buildExactInitialHold({ scan, executions: currentExecutions, path: nextPath, initialCapitalEur: result.initialCapitalEur, endDate: result.endDate });
    const nextSummary: ReplaySummary = {
      endDate: result.endDate,
      engineFinalEur: result.finalValueEur,
      engineProfitEur: result.finalValueEur - result.initialCapitalEur,
      engineReturnPct: result.totalReturnPct,
      engineMaxDrawdownPct: result.decisionPathMaxDrawdownPct,
      engineFeesEur: result.totalFeesEur,
      engineTaxEur: result.totalEstimatedTaxEur,
      engineTransferredEur: result.totalTransferredEur,
      exactHoldFinalEur: exactHold.finalEur,
      exactHoldProfitEur: exactHold.finalEur == null ? null : exactHold.finalEur - result.initialCapitalEur,
      exactHoldReturnPct: exactHold.returnPct,
      advantageEur: exactHold.finalEur == null ? null : result.finalValueEur - exactHold.finalEur,
      advantagePctPoints: exactHold.returnPct == null ? null : result.totalReturnPct - exactHold.returnPct,
      taxMethod: result.taxMethod,
      initialPortfolioDate: exactHold.firstDate
    };
    const nextPositions = buildPositionSummaries(scan, currentExecutions, result.endDate);

    setExecutions(currentExecutions); setSignals(currentSignals); setPath(nextPath); setCheckpoints(nextCheckpoints); setSummary(nextSummary); setPositions(nextPositions);
    executionsRef.current = currentExecutions; signalsRef.current = currentSignals; pathRef.current = nextPath; checkpointsRef.current = nextCheckpoints;
    persist(nextCheckpoints, currentExecutions, nextPath, currentSignals, nextSummary, nextPositions);

    const complete = nextCheckpoints.length >= chunkEndsRef.current.length;
    if (complete) {
      setStatus('DONE'); setAutoRunning(false); autoRunningRef.current = false;
      setMessage(`Replay completado: ${nextCheckpoints.length}/${chunkEndsRef.current.length} checkpoints. Trayectoria completa: ${nextPath.length} sesiones.`);
      return;
    }
    setStatus('READY');
    setMessage(`Checkpoint ${result.endDate} guardado · ${nextPath.length} sesiones visibles · ${currentSignals.length} señales · ${currentExecutions.length} operaciones.`);
    if (runMode === 'AUTO' && autoRunningRef.current) scheduleNextAuto();
  };

  const prepare = async () => {
    if (status === 'LOADING_DATA' || status === 'RUNNING') return;
    const capital = Number(initialCapital); const duration = Math.trunc(Number(durationMonths)); const days = Math.trunc(Number(chunkDays));
    if (!(capital > 0)) { setError('El capital inicial debe ser mayor que cero.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || startDate >= today()) { setError('Elige una fecha pasada válida.'); return; }
    if (!(duration >= 1 && duration <= 120)) { setError('La duración total debe estar entre 1 y 120 meses.'); return; }
    if (!(days >= 1 && days <= 365)) { setError('El tramo debe estar entre 1 y 365 días.'); return; }
    const finalDate = earlierDate(addMonths(startDate, duration), today());
    if (finalDate <= startDate) { setError('La duración elegida no deja un periodo válido.'); return; }

    const config: AuditConfig = { startDate, frequency, runMode, durationMonths: duration, chunkDays: days, initialCapitalEur: capital };
    setError(null); setWarning(days > 90 ? 'Has elegido un tramo grande; cada checkpoint puede tardar más.' : null); setStatus('LOADING_DATA'); setMessage('Descargando una sola vez el histórico REAL necesario…');
    try {
      const from = warmupDate(startDate);
      const nextScan = await AssetUniverseScanner.scan(EUR_PORTFOLIO_DISCOVERY_UNIVERSE, from, finalDate, { forceRefresh: false, concurrency: 3, maxSelected: 12, minimumBars: 252, maxDataAgeDays: 7 });
      if (nextScan.acceptedDataset.assets.length < 1) throw new Error('No hay instrumentos con histórico REAL suficiente para ese periodo.');
      setCoverage({ accepted: nextScan.accepted, scanned: nextScan.scanned, from }); scanRef.current = nextScan;
      const ends = buildChunkEnds(startDate, finalDate, days); setChunkEnds(ends); chunkEndsRef.current = ends;

      const saved = loadPersistedAudit();
      const resume = sameConfiguration(saved, config);
      const restoredCheckpoints = resume ? (saved?.checkpoints ?? []).filter(item => ends.includes(item.requestedEndDate)) : [];
      const restoredExecutions = resume ? saved?.executions ?? [] : [];
      const restoredPath = resume ? saved?.path ?? [] : [];
      const restoredSignals = resume ? saved?.signals ?? [] : [];
      setCheckpoints(restoredCheckpoints); setExecutions(restoredExecutions); setPath(restoredPath); setSignals(restoredSignals); setSummary(resume ? saved?.summary ?? null : null); setPositions(resume ? saved?.positions ?? [] : []);
      checkpointsRef.current = restoredCheckpoints; executionsRef.current = restoredExecutions; pathRef.current = restoredPath; signalsRef.current = restoredSignals; configRef.current = config;
      if (!resume) { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY); }

      workerRef.current?.terminate();
      const worker = new Worker(new URL('../workers/historicalReplayAudit.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        if (response.type === 'READY') {
          const alreadyDone = checkpointsRef.current.length >= ends.length;
          setStatus(alreadyDone ? 'DONE' : 'READY');
          setMessage(alreadyDone ? `La sesión ya contiene ${ends.length}/${ends.length} checkpoints.` : checkpointsRef.current.length ? `Reanudado: ${checkpointsRef.current.length}/${ends.length} checkpoints · ${pathRef.current.length} sesiones visibles.` : `Preparado: ${ends.length} checkpoints cada ${days} días durante ${duration} meses.`);
        } else if (response.type === 'RESULT') finishWorkerResult(response.requestedEndDate, response.result);
        else if (response.type === 'ERROR') { setError(`El tramo ${response.requestedEndDate ?? ''} no pudo completarse: ${response.error}`); setStatus('READY'); setAutoRunning(false); autoRunningRef.current = false; }
      };
      worker.onerror = event => { setError(`El proceso aislado falló: ${event.message || 'WORKER_ERROR'}.`); setStatus('IDLE'); setAutoRunning(false); autoRunningRef.current = false; };
      worker.postMessage({ type: 'INIT', dataset: nextScan.acceptedDataset, catalog: EUR_PORTFOLIO_DISCOVERY_UNIVERSE, startDate, frequency, initialCapitalEur: capital, riskProfile, horizonYears, cashBenchmarkAnnualPct: CashBenchmarkService.load(), minimumBars: 252, taxSettings: SpanishTaxSettingsService.load() });
    } catch (e: any) { setError(e?.message || String(e)); setStatus('IDLE'); }
  };

  const runNextChunk = () => { if (status !== 'READY' || !workerRef.current) return; const next = nextPendingEnd(); if (!next) { setStatus('DONE'); return; } postRun(next); };
  const startAutomatic = () => { if (status !== 'READY' || !workerRef.current) return; setAutoRunning(true); autoRunningRef.current = true; const next = nextPendingEnd(); if (!next) { setStatus('DONE'); setAutoRunning(false); autoRunningRef.current = false; return; } postRun(next); };
  const pauseAutomatic = () => { setAutoRunning(false); autoRunningRef.current = false; if (autoTimerRef.current != null) window.clearTimeout(autoTimerRef.current); autoTimerRef.current = null; setMessage(status === 'RUNNING' ? 'Pausa solicitada: terminará este tramo y no iniciará el siguiente.' : 'Ejecución automática pausada.'); };
  const cancelCurrentWorker = () => { workerRef.current?.terminate(); workerRef.current = null; setAutoRunning(false); autoRunningRef.current = false; setStatus('IDLE'); setMessage('Tramo cancelado. Los checkpoints anteriores siguen guardados.'); };
  const reset = () => {
    workerRef.current?.terminate(); workerRef.current = null; if (autoTimerRef.current != null) window.clearTimeout(autoTimerRef.current); autoTimerRef.current = null; scanRef.current = null; configRef.current = null; chunkEndsRef.current = [];
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY);
    setStatus('IDLE'); setAutoRunning(false); autoRunningRef.current = false; setMessage(''); setError(null); setWarning(null); setCoverage(null); setChunkEnds([]); setCheckpoints([]); setExecutions([]); setPath([]); setSignals([]); setSummary(null); setPositions([]); setSelectedAssetId(null);
    checkpointsRef.current = []; executionsRef.current = []; pathRef.current = []; signalsRef.current = [];
  };

  const assetLegend = useMemo(() => {
    const map = new Map<string, { assetId: string; ticker: string; label: string; color: string }>();
    for (const execution of executions) if (!map.has(execution.assetId)) {
      const index = map.size;
      map.set(execution.assetId, { assetId: execution.assetId, ticker: execution.ticker, label: catalogueLabel(execution.assetId, execution.ticker), color: ASSET_COLORS[index % ASSET_COLORS.length] });
    }
    return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [executions]);
  const assetChartKeys = useMemo(() => new Map(assetLegend.map((asset, index) => [asset.assetId, `asset_${index}`])), [assetLegend]);
  const chartData = useMemo(() => path.map(point => {
    const row: Record<string, string | number> = { date: point.date, patrimonio: point.equityEur, cash: point.cashEur, cuenta: point.cashBenchmarkEur };
    for (const asset of assetLegend) row[assetChartKeys.get(asset.assetId)!] = point.assetValuesEur[asset.assetId] ?? 0;
    return row;
  }), [path, assetLegend, assetChartKeys]);
  const visibleSignals = useMemo(() => showAllSignals ? signals : signals.filter(signal => MATERIAL_ACTIONS.has(signal.action)), [signals, showAllSignals]);

  const completed = checkpoints.length; const total = chunkEnds.length; const progressPct = total > 0 ? Math.min(100, completed / total * 100) : 0; const controlsLocked = status !== 'IDLE';

  return <section className="mt-5 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/20 via-slate-900 to-slate-950 p-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-fuchsia-300"/><h2 className="font-bold text-white">Replay histórico auditado · manual o automático</h2></div><p className="mt-1 text-[11px] text-slate-400">La gráfica conserva todas las sesiones desde la fecha inicial. Las líneas de cada inversión son seleccionables. El cierre compara el motor contra congelar exactamente las compras iniciales y muestra rentabilidad, caídas, costes e impuestos por posición.</p></div>
      <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1 text-[9px] font-black text-emerald-200"><ShieldCheck className="h-3 w-3"/> AUDITORÍA PERSISTENTE</span>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <label className="text-[10px] text-slate-400">Fecha inicial<input type="date" value={startDate} disabled={controlsLocked} max={today()} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/></label>
      <label className="text-[10px] text-slate-400">Duración total (meses)<input type="number" min="1" max="120" step="1" value={durationMonths} disabled={controlsLocked} onChange={e => setDurationMonths(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/></label>
      <label className="text-[10px] text-slate-400">Frecuencia de decisiones<select value={frequency} disabled={controlsLocked} onChange={e => setFrequency(e.target.value as DynamicReplayFrequency)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"><option value="MONTHLY">Mensual</option><option value="WEEKLY">Semanal</option><option value="DAILY">Cada sesión</option><option value="QUARTERLY">Trimestral</option></select></label>
      <label className="text-[10px] text-slate-400">Tramo de cálculo (días)<input type="number" min="1" max="365" step="1" value={chunkDays} disabled={controlsLocked} onChange={e => setChunkDays(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/><span className="mt-1 block text-[8px] text-slate-600">Editable: 3, 7, 12, 25, 45…</span></label>
      <label className="text-[10px] text-slate-400">Modo<select value={runMode} disabled={controlsLocked} onChange={e => setRunMode(e.target.value as RunMode)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"><option value="MANUAL">Manual · revisar cada tramo</option><option value="AUTO">Automático · encadenar</option></select></label>
      <label className="text-[10px] text-slate-400">Capital inicial<input type="number" min="1" step="100" value={initialCapital} disabled={controlsLocked} onChange={e => setInitialCapital(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-60"/></label>
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      {status === 'IDLE' && <button type="button" onClick={() => void prepare()} className="flex min-h-11 items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-xs font-bold text-fuchsia-100"><PlayCircle className="h-4 w-4"/>Preparar / reanudar</button>}
      {status === 'LOADING_DATA' && <button disabled className="flex min-h-11 items-center gap-2 rounded-xl border border-fuchsia-500/20 px-4 py-2 text-xs text-fuchsia-200 opacity-70"><Loader2 className="h-4 w-4 animate-spin"/>Cargando histórico REAL…</button>}
      {status === 'READY' && runMode === 'MANUAL' && <button type="button" onClick={runNextChunk} className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-100"><PlayCircle className="h-4 w-4"/>Ejecutar siguiente tramo</button>}
      {status === 'READY' && runMode === 'AUTO' && !autoRunning && <button type="button" onClick={startAutomatic} className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-100"><PlayCircle className="h-4 w-4"/>Iniciar / continuar automático</button>}
      {runMode === 'AUTO' && autoRunning && <button type="button" onClick={pauseAutomatic} className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-100"><Pause className="h-4 w-4"/>Pausar automático</button>}
      {status === 'RUNNING' && <button type="button" onClick={cancelCurrentWorker} className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-100"><Square className="h-4 w-4"/>Cancelar tramo actual</button>}
      <button type="button" onClick={reset} disabled={status === 'LOADING_DATA' || status === 'RUNNING'} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-300 disabled:opacity-40"><RotateCcw className="h-4 w-4"/>Nueva sesión</button>
    </div>

    {total > 0 && <div className="mt-3 rounded-lg border border-fuchsia-500/15 bg-slate-950/60 p-3"><div className="flex items-center justify-between gap-3 text-[10px] text-slate-400"><span>{message}</span><b className="shrink-0 font-mono text-fuchsia-200">{completed}/{total}</b></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${progressPct}%` }}/></div></div>}
    {!total && message && <div className="mt-3 text-[10px] text-slate-400">{message}</div>}
    {coverage && <div className="mt-2 text-[9px] text-slate-500">Cobertura REAL: {coverage.accepted}/{coverage.scanned} instrumentos · warm-up desde {coverage.from}.</div>}
    {warning && <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">{warning}</div>}
    {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</div>}

    {path.length > 0 && <div className="mt-5 space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs"><div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Periodo visible</div><b>{path[0].date} → {path.at(-1)!.date}</b><div className="text-[9px] text-slate-500">{path.length} sesiones</div></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Patrimonio</div><b>{path.at(-1)!.equityEur.toFixed(2)} €</b></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Señales / decisiones</div><b>{signals.length}</b></div><div className="rounded-lg bg-slate-950 p-3"><div className="text-[9px] uppercase text-slate-500">Operaciones ejecutadas</div><b>{executions.length}</b></div></div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-2"><b className="text-xs text-white">Evolución completa desde la fecha inicial</b><div className="text-[9px] text-slate-500">Cada activo tiene color estable. Pulsa su etiqueta para destacarlo; vuelve a pulsarla o usa “Mostrar todas” para recuperar el conjunto.</div></div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedAssetId(null)} className={`rounded-full border px-3 py-1 text-[9px] font-bold ${selectedAssetId == null ? 'border-white/40 bg-white/10 text-white' : 'border-slate-700 text-slate-400'}`}>Mostrar todas</button>
          {assetLegend.map(asset => <button key={asset.assetId} type="button" onClick={() => setSelectedAssetId(current => current === asset.assetId ? null : asset.assetId)} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[9px] font-bold transition ${selectedAssetId === asset.assetId ? 'border-white/50 bg-white/10 text-white shadow-[0_0_16px_rgba(255,255,255,0.20)]' : selectedAssetId ? 'border-slate-800 text-slate-600 opacity-50' : 'border-slate-700 text-slate-300'}`}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: asset.color, boxShadow: selectedAssetId === asset.assetId ? `0 0 12px ${asset.color}` : 'none' }}/>{asset.ticker}</button>)}
        </div>
        <div className="h-[400px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData}><CartesianGrid strokeDasharray="3 3" opacity={0.18}/><XAxis dataKey="date" tick={{ fontSize: 9 }} minTickGap={28}/><YAxis tick={{ fontSize: 9 }}/><Tooltip formatter={(value: any, name: any) => [`${Number(value ?? 0).toFixed(2)} €`, name]}/><Line type="monotone" dataKey="patrimonio" name="Patrimonio total" dot={false} stroke="#f8fafc" strokeWidth={3}/><Line type="monotone" dataKey="cuenta" name="Todo en cuenta" dot={false} stroke="#94a3b8" strokeDasharray="5 5" strokeOpacity={0.75}/>{assetLegend.map(asset => { const selected = selectedAssetId === asset.assetId; const dimmed = selectedAssetId != null && !selected; return <Line key={asset.assetId} type="monotone" dataKey={assetChartKeys.get(asset.assetId)!} name={`${asset.ticker} · posición`} dot={false} stroke={asset.color} strokeWidth={selected ? 4.5 : 2} strokeOpacity={dimmed ? 0.14 : 0.95} activeDot={{ r: selected ? 6 : 4 }}/>; })}</ComposedChart></ResponsiveContainer></div>
      </div>

      {summary && <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
        <div><b className="text-sm text-white">Resumen final del periodo · Motor vs comprar y mantener</b><div className="mt-1 text-[9px] text-slate-500">“Mantener” congela exactamente las primeras compras ejecutadas por este replay: mismos activos, unidades, comisiones y efectivo residual. No usa el comparador histórico antiguo.</div></div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><div className="text-[9px] uppercase text-emerald-300">Seguir el motor</div><div className="mt-1 text-lg font-black text-white">{summary.engineFinalEur.toFixed(2)} €</div><div className={summary.engineReturnPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{summary.engineProfitEur >= 0 ? '+' : ''}{summary.engineProfitEur.toFixed(2)} € · {summary.engineReturnPct >= 0 ? '+' : ''}{summary.engineReturnPct.toFixed(2)}%</div><div className="mt-2 text-[9px] text-slate-500">DD máx. -{summary.engineMaxDrawdownPct.toFixed(2)}% · comisiones {summary.engineFeesEur.toFixed(2)} € · impuestos ya soportados {summary.engineTaxEur.toFixed(2)} €</div></div>
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3"><div className="text-[9px] uppercase text-indigo-300">Mismas compras iniciales · mantener</div><div className="mt-1 text-lg font-black text-white">{summary.exactHoldFinalEur == null ? 'N/D' : `${summary.exactHoldFinalEur.toFixed(2)} €`}</div><div className={(summary.exactHoldReturnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{summary.exactHoldProfitEur == null ? 'N/D' : `${summary.exactHoldProfitEur >= 0 ? '+' : ''}${summary.exactHoldProfitEur.toFixed(2)} € · ${summary.exactHoldReturnPct! >= 0 ? '+' : ''}${summary.exactHoldReturnPct!.toFixed(2)}%`}</div><div className="mt-2 text-[9px] text-slate-500">Primera cartera ejecutada: {summary.initialPortfolioDate ?? 'N/D'} · sin ventas posteriores ni impuesto realizado durante el periodo.</div></div>
          <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3"><div className="text-[9px] uppercase text-fuchsia-300">Valor aportado por mover la cartera</div><div className={`mt-1 text-lg font-black ${(summary.advantageEur ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{summary.advantageEur == null ? 'N/D' : `${summary.advantageEur >= 0 ? '+' : ''}${summary.advantageEur.toFixed(2)} €`}</div><div className={(summary.advantagePctPoints ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{summary.advantagePctPoints == null ? 'N/D' : `${summary.advantagePctPoints >= 0 ? '+' : ''}${summary.advantagePctPoints.toFixed(2)} pp`}</div><div className="mt-2 text-[9px] text-slate-500">Fiscalidad del motor: {summary.taxMethod === 'CONFIGURED_PROGRESSIVE' ? 'escala configurada' : 'reserva conservadora 30%'} · traspasos diferidos {summary.engineTransferredEur.toFixed(2)} €.</div></div>
        </div>
      </div>}

      {positions.length > 0 && <div className="rounded-xl border border-slate-800">
        <div className="p-3"><b className="text-xs text-white">Resultado de cada posición comprada</b><div className="mt-1 text-[9px] text-slate-500">MFE = máxima ganancia alcanzada por la posición agregada; MAE = máxima caída desde su coste acumulado. ADD actualiza el coste medio; REDUCE disminuye unidades sin crear una posición falsa; una recompra después de EXIT inicia un ciclo nuevo. “Bruto” es antes de comisiones/impuestos; “neto” descuenta ambos una sola vez.</div></div>
        <div className="max-h-[520px] overflow-auto border-t border-slate-800"><table className="w-full min-w-[1400px] text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Activo</th><th className="p-2 text-left">Entrada → salida</th><th className="p-2 text-right">P. entrada</th><th className="p-2 text-right">Invertido</th><th className="p-2 text-right">Máx. ganancia</th><th className="p-2 text-right">Máx. caída</th><th className="p-2 text-right">Resultado bruto</th><th className="p-2 text-right">Impuesto</th><th className="p-2 text-right">Comisiones</th><th className="p-2 text-right">Resultado neto</th><th className="p-2 text-left">Tratamiento fiscal</th></tr></thead><tbody>{positions.map(position => <tr key={position.id} className={`border-t border-slate-800 ${selectedAssetId === position.assetId ? 'bg-white/5' : ''}`} onClick={() => setSelectedAssetId(current => current === position.assetId ? null : position.assetId)}><td className="cursor-pointer p-2"><b>{position.ticker}</b><div className="max-w-[240px] truncate text-[9px] text-slate-500">{position.name}</div></td><td className="p-2 font-mono">{position.entryDate} → {position.exitDate ?? 'ABIERTA'}</td><td className="p-2 text-right">{position.entryPriceEur == null ? 'N/D' : `${position.entryPriceEur.toFixed(4)} €`}</td><td className="p-2 text-right">{position.totalBoughtEur.toFixed(2)} €</td><td className="p-2 text-right font-bold text-emerald-300">+{position.mfePct.toFixed(2)}%</td><td className="p-2 text-right font-bold text-rose-300">{position.maePct.toFixed(2)}%</td><td className={`p-2 text-right ${position.finalGrossPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{position.finalGrossProfitEur >= 0 ? '+' : ''}{position.finalGrossProfitEur.toFixed(2)} € · {position.finalGrossPct >= 0 ? '+' : ''}{position.finalGrossPct.toFixed(2)}%</td><td className="p-2 text-right">-{position.estimatedTaxEur.toFixed(2)} €</td><td className="p-2 text-right">-{position.totalFeesEur.toFixed(2)} €</td><td className={`p-2 text-right font-bold ${position.finalNetPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{position.finalNetProfitEur >= 0 ? '+' : ''}{position.finalNetProfitEur.toFixed(2)} € · {position.finalNetPct >= 0 ? '+' : ''}{position.finalNetPct.toFixed(2)}%</td><td className="p-2 text-slate-400">{position.taxLabel}</td></tr>)}</tbody></table></div>
      </div>}

      <div className="rounded-xl border border-slate-800"><div className="flex items-center justify-between gap-2 p-3"><div><b className="text-xs text-white">Decisiones y señales cronológicas</b><div className="text-[9px] text-slate-500">Incluye lo que el motor pensó en cada fecha, aunque no hubiese operación.</div></div><button type="button" onClick={() => setShowAllSignals(value => !value)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-[10px] text-slate-300">{showAllSignals ? 'Solo movimientos' : 'Ver también MANTENER / NO COMPRAR'}</button></div><div className="max-h-[420px] overflow-auto border-t border-slate-800"><table className="w-full min-w-[1040px] text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Fecha señal</th><th className="p-2 text-left">Acción</th><th className="p-2 text-left">Activo</th><th className="p-2 text-right">Importe recomendado</th><th className="p-2 text-right">Peso actual → objetivo</th><th className="p-2 text-left">Ejecución</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{visibleSignals.map(signal => <tr key={signal.id} className="border-t border-slate-800"><td className="p-2 font-mono">{signal.signalDate}</td><td className={`p-2 font-bold ${signal.action === 'BUY' || signal.action === 'ADD' ? 'text-emerald-200' : signal.action === 'REDUCE' || signal.action === 'EXIT' ? 'text-rose-200' : signal.action === 'AVOID' ? 'text-amber-200' : 'text-slate-300'}`}>{actionLabel(signal.action)}</td><td className="p-2"><b>{signal.ticker}</b><div className="max-w-[250px] truncate text-[9px] text-slate-500">{catalogueLabel(signal.assetId, signal.ticker)}</div></td><td className="p-2 text-right">{signal.recommendedAmountEur.toFixed(2)} €</td><td className="p-2 text-right">{(signal.currentWeight * 100).toFixed(1)}% → {(signal.targetWeight * 100).toFixed(1)}%</td><td className="p-2">{signal.executed ? `Sí · ${signal.executionDate ?? ''}` : 'No'}</td><td className="p-2 text-slate-400">{signal.reason}</td></tr>)}</tbody></table></div></div>

      <div className="overflow-x-auto rounded-xl border border-slate-800"><div className="p-3"><b className="text-xs text-white">Operaciones realmente ejecutadas</b><div className="text-[9px] text-slate-500">Compras, aportaciones, reducciones y salidas con fiscalidad realmente aplicada por el replay.</div></div><table className="w-full min-w-[1260px] border-t border-slate-800 text-[10px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">Ejecución</th><th className="p-2 text-left">Acción</th><th className="p-2 text-left">Activo</th><th className="p-2 text-right">Importe</th><th className="p-2 text-right">Unidades</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right">Ganancia realizada</th><th className="p-2 text-right">Impuesto</th><th className="p-2 text-right">Traspaso diferido</th><th className="p-2 text-left">Motivo</th></tr></thead><tbody>{executions.map(operation => <tr key={operation.id} className="border-t border-slate-800"><td className="p-2 font-mono text-slate-300">{operation.executionDate}</td><td className={`p-2 font-bold ${operation.action === 'BUY' || operation.action === 'ADD' ? 'text-emerald-200' : 'text-rose-200'}`}>{actionLabel(operation.action)}</td><td className="p-2"><b>{operation.ticker}</b><div className="max-w-[260px] truncate text-[9px] text-slate-500">{catalogueLabel(operation.assetId, operation.ticker)}</div></td><td className="p-2 text-right">{operation.notionalEur.toFixed(2)} €</td><td className="p-2 text-right font-mono">{operation.unitsDelta >= 0 ? '+' : ''}{operation.unitsDelta.toFixed(6)}</td><td className="p-2 text-right">{operation.executionPriceEur == null ? 'N/D' : `${operation.executionPriceEur.toFixed(4)} €`}</td><td className={`p-2 text-right ${operation.realizedGainEur >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{operation.realizedGainEur >= 0 ? '+' : ''}{operation.realizedGainEur.toFixed(2)} €</td><td className="p-2 text-right">{operation.estimatedTaxEur.toFixed(2)} €</td><td className="p-2 text-right">{operation.taxDeferredTransferEur.toFixed(2)} €</td><td className="p-2 text-slate-400">{operation.reason}</td></tr>)}</tbody></table></div>
    </div>}
  </section>;
};
