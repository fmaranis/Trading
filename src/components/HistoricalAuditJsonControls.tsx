import React, { useEffect, useRef, useState } from 'react';
import { Download, FileJson, Save, Trash2, Upload } from 'lucide-react';

interface Props { onImported?: () => void; }

const STORAGE_KEY = 'historical_progressive_audit_v3';
const LEGACY_STORAGE_KEY = 'historical_progressive_audit_v2';
const FORMAT = 'TRADING_HISTORICAL_REPLAY_AUDIT';
const EXPORT_SCHEMA_VERSION = 1;
const SUPPORTED_REPLAY_STORAGE_VERSIONS = new Set([3, 4]);
const AUDIT_BROADCAST_CHANNEL = 'historical-replay-audit-v3';

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeExecution(raw: any): any {
  return {
    ...raw,
    id: String(raw?.id ?? ''), signature: String(raw?.signature ?? ''), executionDate: String(raw?.executionDate ?? ''),
    signalDate: String(raw?.signalDate ?? ''), assetId: String(raw?.assetId ?? ''), ticker: String(raw?.ticker ?? ''),
    unitsDelta: finite(raw?.unitsDelta), notionalEur: finite(raw?.notionalEur), feeEur: finite(raw?.feeEur),
    realizedGainEur: finite(raw?.realizedGainEur), estimatedTaxEur: finite(raw?.estimatedTaxEur),
    taxDeferredTransferEur: finite(raw?.taxDeferredTransferEur),
    executionPriceEur: raw?.executionPriceEur == null ? null : finite(raw.executionPriceEur), reason: String(raw?.reason ?? '')
  };
}

function normalizePathPoint(raw: any): any {
  return {
    ...raw,
    date: String(raw?.date ?? ''), equityEur: finite(raw?.equityEur), cashEur: finite(raw?.cashEur),
    investedEur: finite(raw?.investedEur), cashBenchmarkEur: finite(raw?.cashBenchmarkEur),
    regime: String(raw?.regime ?? 'UNKNOWN'), method: String(raw?.method ?? 'N/D'),
    assetValuesEur: raw?.assetValuesEur && typeof raw.assetValuesEur === 'object' ? raw.assetValuesEur : {}
  };
}

function extractTrendProtectionV2Counterfactual(session: any): any | null {
  const direct = session?.summary?.trendProtectionV2Counterfactual;
  if (direct && typeof direct === 'object') return direct;
  for (const signal of Array.isArray(session?.signals) ? session.signals : []) {
    const candidate = signal?.auditExtensions?.trendProtectionV2Counterfactual;
    if (candidate && typeof candidate === 'object') return candidate;
  }
  return null;
}

function attachCounterfactualToSummary(session: any): any {
  const counterfactual = extractTrendProtectionV2Counterfactual(session);
  if (!counterfactual) return session;
  return { ...session, summary: { ...(session.summary ?? {}), trendProtectionV2Counterfactual: counterfactual } };
}

function normalizeSession(raw: any): any {
  if (!raw || typeof raw !== 'object') throw new Error('El JSON no contiene una sesión histórica válida.');
  const replayStorageVersion = Number(raw.version);
  if (!SUPPORTED_REPLAY_STORAGE_VERSIONS.has(replayStorageVersion)) throw new Error(`Versión de replay no compatible: ${String(raw.version ?? 'desconocida')}. Se esperaba v3 o v4.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw.startDate ?? ''))) throw new Error('Falta una fecha inicial válida en la prueba.');
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(String(raw.frequency ?? ''))) throw new Error('La frecuencia histórica del JSON no es válida.');
  if (!['MANUAL', 'AUTO'].includes(String(raw.runMode ?? ''))) throw new Error('El modo de ejecución del JSON no es válido.');
  if (!(finite(raw.durationMonths) > 0) || !(finite(raw.chunkDays) > 0) || !(finite(raw.initialCapitalEur) > 0)) throw new Error('La configuración numérica de la prueba está incompleta.');
  for (const field of ['checkpoints', 'executions', 'path', 'signals']) if (!Array.isArray(raw[field])) throw new Error(`El JSON no contiene el bloque obligatorio “${field}”.`);
  return attachCounterfactualToSummary({
    ...raw, version: replayStorageVersion, durationMonths: finite(raw.durationMonths), chunkDays: finite(raw.chunkDays), initialCapitalEur: finite(raw.initialCapitalEur),
    checkpoints: raw.checkpoints, executions: raw.executions.map(normalizeExecution), path: raw.path.map(normalizePathPoint), signals: raw.signals,
    summary: raw.summary ?? null, positions: Array.isArray(raw.positions) ? raw.positions : []
  });
}

function unwrapImport(parsed: any): any {
  if (parsed?.metadata?.format === FORMAT && parsed?.session) {
    if (Number(parsed.metadata.schemaVersion) !== EXPORT_SCHEMA_VERSION) throw new Error(`Esquema de exportación no compatible: ${String(parsed.metadata.schemaVersion)}.`);
    return parsed.session;
  }
  return parsed;
}

function safePart(value: unknown, fallback: string): string {
  const clean = String(value ?? '').replace(/[^0-9A-Za-z_-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || fallback;
}

function buildPayload(session: any) {
  return {
    metadata: {
      format: FORMAT, schemaVersion: EXPORT_SCHEMA_VERSION, replayStorageVersion: Number(session?.version), exportedAt: new Date().toISOString(),
      source: 'fmaranis/Trading · Replay histórico auditado',
      note: 'Archivo autocontenido para auditoría, comparación, reimportación y lectura directa desde GitHub tras sincronizar el proyecto.'
    },
    session: attachCounterfactualToSummary(session)
  };
}

export const HistoricalAuditJsonControls: React.FC<Props> = ({ onImported }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [clearingArchive, setClearingArchive] = useState(false);
  const [counterfactual, setCounterfactual] = useState<any | null>(null);

  const currentSession = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('No hay ninguna prueba histórica guardada. Ejecuta o importa una prueba primero.');
    return normalizeSession(JSON.parse(raw));
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCounterfactual(extractTrendProtectionV2Counterfactual(normalizeSession(JSON.parse(raw))));
    } catch { setCounterfactual(null); }
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(AUDIT_BROADCAST_CHANNEL);
    channel.onmessage = event => {
      if (event.data?.type === 'TREND_PROTECTION_V2_COUNTERFACTUAL' && event.data?.counterfactual) setCounterfactual(event.data.counterfactual);
    };
    return () => channel.close();
  }, []);

  const exportSession = () => {
    setError(null);
    try {
      const session = currentSession();
      const blob = new Blob([JSON.stringify(buildPayload(session), null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `trading-replay-${safePart(session.startDate, 'inicio')}-${safePart(session.summary?.endDate ?? session.path?.at(-1)?.date ?? 'parcial', 'parcial')}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setMessage(`Prueba exportada: ${session.checkpoints.length} checkpoints · ${session.executions.length} operaciones · ${session.path.length} sesiones.`);
    } catch (e: any) { setError(e?.message || String(e)); }
  };

  const saveToProject = async () => {
    setError(null); setMessage(null); setSavingProject(true);
    try {
      const session = currentSession();
      const response = await fetch('/api/validation/historical-audit/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload(session))
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.detail || body?.error || `HTTP ${response.status}`);
      const sync = body?.githubSync;
      if (sync?.published === true) {
        const fullInfo = sync?.fullPath ? ` Replay completo: ${sync.fullPath}.` : '';
        const archiveInfo = sync?.archived === true ? ` Histórico legible: ${sync.archivePath}; se conservan como máximo ${sync.archiveLimit ?? 10} pruebas.` : '';
        setMessage(`Prueba publicada para ChatGPT como JSON normal en ${sync.repository}:${sync.branch}/${sync.path}.${fullInfo}${archiveInfo} Puedes decir “revisa las últimas pruebas”.`);
      } else if (sync?.configured === false) {
        setMessage(`Prueba guardada localmente en ${body.latestPath}. La publicación automática para ChatGPT aún no está configurada: añade el secreto server-side GITHUB_REPLAY_SYNC_TOKEN una sola vez.`);
      } else if (sync?.blockedReason === 'PRODUCTION_SYNC_DISABLED') {
        setMessage(`Prueba guardada localmente en ${body.latestPath}. La escritura automática a GitHub está bloqueada deliberadamente en producción; este canal sólo se habilita en desarrollo/AI Studio.`);
      } else if (sync?.error) {
        setMessage(`Prueba guardada localmente en ${body.latestPath}, pero la publicación automática a GitHub falló: ${String(sync.error)}`);
      } else setMessage(`Prueba guardada en el proyecto: ${body.latestPath}. También archivada en ${body.archivePath}.`);
    } catch (e: any) { setError(`No se pudo guardar la prueba en el proyecto: ${e?.message || String(e)}`); }
    finally { setSavingProject(false); }
  };

  const clearArchive = async () => {
    if (!window.confirm('Se borrarán las copias históricas de replay guardadas para ChatGPT, pero se conservará latest-chatgpt.json con la última prueba. ¿Continuar?')) return;
    setError(null); setMessage(null); setClearingArchive(true);
    try {
      const response = await fetch('/api/validation/historical-audit/archive', { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.detail || body?.error || `HTTP ${response.status}`);
      const remote = body?.githubArchive;
      if (remote?.error) throw new Error(String(remote.error));
      setMessage(`Histórico limpiado: ${Number(body?.localDeleted ?? 0)} copias locales y ${Number(remote?.deleted ?? 0)} copias de GitHub eliminadas. latest-chatgpt.json se conserva.`);
    } catch (e: any) { setError(`No se pudo limpiar el histórico: ${e?.message || String(e)}`); }
    finally { setClearingArchive(false); }
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    setError(null); setMessage(null);
    try {
      if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Selecciona un archivo .json exportado por la prueba histórica.');
      const session = normalizeSession(unwrapImport(JSON.parse(await file.text())));
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && existing !== JSON.stringify(session) && !window.confirm('Ya existe una prueba histórica guardada en este navegador. ¿Quieres sustituirla por la prueba importada?')) {
        setMessage('Importación cancelada; la prueba actual no se ha modificado.'); return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); localStorage.removeItem(LEGACY_STORAGE_KEY);
      setCounterfactual(extractTrendProtectionV2Counterfactual(session));
      setMessage(`Prueba importada: ${session.checkpoints.length} checkpoints · ${session.executions.length} operaciones · ${session.path.length} sesiones. Los resultados ya están disponibles; para continuar calculando, usa “Preparar / reanudar”.`);
      onImported?.();
    } catch (e: any) { setError(`No se pudo importar la prueba: ${e?.message || String(e)}`); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };

  const baselineReturn = counterfactual == null ? null : finite(counterfactual.totalReturnPct) - finite(counterfactual.deltaVsCurrentPolicy?.returnPctPoints);
  const baselineDrawdown = counterfactual == null ? null : finite(counterfactual.maxDrawdownPct) - finite(counterfactual.deltaVsCurrentPolicy?.maxDrawdownPctPoints);
  const fullCausal = counterfactual?.methodology === 'FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE';
  const parityExact = counterfactual?.entryParity?.exact === true;
  const counterfactualValid = counterfactual?.valid === true && (fullCausal || parityExact);
  const constraints = counterfactual?.portfolioConstraints;

  return <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2"><FileJson className="h-4 w-4 text-cyan-300"/><b className="text-xs text-white">Archivo de auditoría de la prueba</b></div><div className="mt-1 text-[9px] text-slate-500">“Guardar + publicar” genera latest-chatgpt.json y latest-chatgpt-full.json. El A/B CURRENT_POLICY vs TREND_PROTECTION_V2 queda incluido en summary cuando existe.</div></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void saveToProject()} disabled={savingProject} className="flex min-h-10 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-100 disabled:opacity-50"><Save className="h-3.5 w-3.5"/>{savingProject ? 'Publicando JSON…' : 'Guardar + publicar para ChatGPT'}</button>
        <button type="button" onClick={() => void clearArchive()} disabled={clearingArchive} className="flex min-h-10 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-bold text-rose-100 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>{clearingArchive ? 'Borrando…' : 'Borrar histórico ChatGPT'}</button>
        <button type="button" onClick={exportSession} className="flex min-h-10 items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[10px] font-bold text-cyan-100"><Download className="h-3.5 w-3.5"/>Exportar prueba JSON</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-10 items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] font-bold text-violet-100"><Upload className="h-3.5 w-3.5"/>Importar prueba JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => void importFile(e.target.files?.[0] ?? null)}/>
      </div>
    </div>

    {counterfactual && <div className={`mt-3 rounded-xl border p-3 ${counterfactualValid ? 'border-violet-500/25 bg-violet-500/5' : 'border-rose-500/30 bg-rose-500/10'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><b className="text-xs text-white">A/B gestión de posiciones · CURRENT_POLICY vs TREND_PROTECTION_V2</b><div className="mt-1 text-[9px] text-slate-500">{fullCausal ? 'Dos replays completos con el mismo scanner/timing/sizing y las mismas restricciones. Si la gestión cambia cash o plazas, las entradas posteriores pueden divergir causalmente y siguen siendo económicamente válidas.' : 'Diagnóstico antiguo de entradas congeladas: sólo es interpretable con paridad exacta.'}</div></div>
        <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${counterfactualValid ? 'border-emerald-500/30 text-emerald-200' : 'border-rose-500/30 text-rose-200'}`}>{counterfactualValid ? (fullCausal ? 'REPLAY CAUSAL · VÁLIDO' : 'PARIDAD EXACTA · VÁLIDO') : 'A/B INVÁLIDO'}</span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <div className="rounded-lg bg-slate-950/70 p-2"><div className="text-[8px] uppercase text-slate-500">Retorno baseline → V2</div><b className="text-xs text-white">{baselineReturn?.toFixed(2)}% → {finite(counterfactual.totalReturnPct).toFixed(2)}%</b><div className={finite(counterfactual.deltaVsCurrentPolicy?.returnPctPoints) >= 0 ? 'text-[9px] text-emerald-300' : 'text-[9px] text-rose-300'}>{finite(counterfactual.deltaVsCurrentPolicy?.returnPctPoints) >= 0 ? '+' : ''}{finite(counterfactual.deltaVsCurrentPolicy?.returnPctPoints).toFixed(2)} pp</div></div>
        <div className="rounded-lg bg-slate-950/70 p-2"><div className="text-[8px] uppercase text-slate-500">DD máx. baseline → V2</div><b className="text-xs text-white">{baselineDrawdown?.toFixed(2)}% → {finite(counterfactual.maxDrawdownPct).toFixed(2)}%</b><div className={finite(counterfactual.deltaVsCurrentPolicy?.maxDrawdownPctPoints) <= 0 ? 'text-[9px] text-emerald-300' : 'text-[9px] text-rose-300'}>{finite(counterfactual.deltaVsCurrentPolicy?.maxDrawdownPctPoints) >= 0 ? '+' : ''}{finite(counterfactual.deltaVsCurrentPolicy?.maxDrawdownPctPoints).toFixed(2)} pp</div></div>
        <div className="rounded-lg bg-slate-950/70 p-2"><div className="text-[8px] uppercase text-slate-500">Gestión V2</div><b className="text-xs text-white">{finite(counterfactual.executedReductions)} REDUCE · {finite(counterfactual.executedExits)} EXIT</b><div className="text-[9px] text-slate-500">Turnover gestión {finite(counterfactual.managementTurnoverEur).toFixed(2)} € · fees {finite(counterfactual.totalFeesEur).toFixed(2)} €</div></div>
        <div className="rounded-lg bg-slate-950/70 p-2"><div className="text-[8px] uppercase text-slate-500">Coincidencia de entradas</div><b className="text-xs text-white">{finite(counterfactual.entryParity?.reproducedEntries)}/{finite(counterfactual.entryParity?.baselineExecutedEntries)}</b><div className="text-[9px] text-slate-500">{fullCausal ? 'Divergencia posterior permitida por cash/plazas' : `Shortfalls ${finite(counterfactual.entryParity?.shortfallCount)} · ${finite(counterfactual.entryParity?.shortfallEur).toFixed(2)} €`}</div></div>
      </div>
      <div className="mt-2 text-[9px] text-slate-500">Capture ratio medio: {counterfactual.averageProfitCaptureRatioPct == null ? 'N/D' : `${finite(counterfactual.averageProfitCaptureRatioPct).toFixed(1)}%`} · pérdidas ≤-10%: {finite(counterfactual.lossSaleCounts?.atOrBelowMinus10Pct)} · ≤-20%: {finite(counterfactual.lossSaleCounts?.atOrBelowMinus20Pct)} · ≤-30%: {finite(counterfactual.lossSaleCounts?.atOrBelowMinus30Pct)}{fullCausal && constraints ? ` · plazas máx. ${finite(constraints.maxObservedPositions)}/${finite(constraints.maxAllowedPositions)} · cash no negativo: ${constraints.cashNeverNegative === true ? 'sí' : 'NO'}` : ''}.</div>
    </div>}

    {message && <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-[10px] text-emerald-100">{message}</div>}
    {error && <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-[10px] text-rose-100">{error}</div>}
  </div>;
};
