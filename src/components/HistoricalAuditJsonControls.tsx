import React, { useRef, useState } from 'react';
import { Download, FileJson, Upload } from 'lucide-react';

interface Props {
  onImported?: () => void;
}

const STORAGE_KEY = 'historical_progressive_audit_v3';
const LEGACY_STORAGE_KEY = 'historical_progressive_audit_v2';
const FORMAT = 'TRADING_HISTORICAL_REPLAY_AUDIT';
const EXPORT_SCHEMA_VERSION = 1;

function finite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeExecution(raw: any): any {
  return {
    ...raw,
    id: String(raw?.id ?? ''),
    signature: String(raw?.signature ?? ''),
    executionDate: String(raw?.executionDate ?? ''),
    signalDate: String(raw?.signalDate ?? ''),
    assetId: String(raw?.assetId ?? ''),
    ticker: String(raw?.ticker ?? ''),
    unitsDelta: finite(raw?.unitsDelta),
    notionalEur: finite(raw?.notionalEur),
    feeEur: finite(raw?.feeEur),
    realizedGainEur: finite(raw?.realizedGainEur),
    estimatedTaxEur: finite(raw?.estimatedTaxEur),
    taxDeferredTransferEur: finite(raw?.taxDeferredTransferEur),
    executionPriceEur: raw?.executionPriceEur == null ? null : finite(raw.executionPriceEur),
    reason: String(raw?.reason ?? '')
  };
}

function normalizePathPoint(raw: any): any {
  return {
    ...raw,
    date: String(raw?.date ?? ''),
    equityEur: finite(raw?.equityEur),
    cashEur: finite(raw?.cashEur),
    investedEur: finite(raw?.investedEur),
    cashBenchmarkEur: finite(raw?.cashBenchmarkEur),
    regime: String(raw?.regime ?? 'UNKNOWN'),
    method: String(raw?.method ?? 'N/D'),
    assetValuesEur: raw?.assetValuesEur && typeof raw.assetValuesEur === 'object' ? raw.assetValuesEur : {}
  };
}

function normalizeSession(raw: any): any {
  if (!raw || typeof raw !== 'object') throw new Error('El JSON no contiene una sesión histórica válida.');
  if (Number(raw.version) !== 3) throw new Error(`Versión de replay no compatible: ${String(raw.version ?? 'desconocida')}. Se esperaba v3.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw.startDate ?? ''))) throw new Error('Falta una fecha inicial válida en la prueba.');
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(String(raw.frequency ?? ''))) throw new Error('La frecuencia histórica del JSON no es válida.');
  if (!['MANUAL', 'AUTO'].includes(String(raw.runMode ?? ''))) throw new Error('El modo de ejecución del JSON no es válido.');
  if (!(finite(raw.durationMonths) > 0) || !(finite(raw.chunkDays) > 0) || !(finite(raw.initialCapitalEur) > 0)) throw new Error('La configuración numérica de la prueba está incompleta.');
  for (const field of ['checkpoints', 'executions', 'path', 'signals']) if (!Array.isArray(raw[field])) throw new Error(`El JSON no contiene el bloque obligatorio “${field}”.`);

  return {
    ...raw,
    version: 3,
    durationMonths: finite(raw.durationMonths),
    chunkDays: finite(raw.chunkDays),
    initialCapitalEur: finite(raw.initialCapitalEur),
    checkpoints: raw.checkpoints,
    executions: raw.executions.map(normalizeExecution),
    path: raw.path.map(normalizePathPoint),
    signals: raw.signals,
    summary: raw.summary ?? null,
    positions: Array.isArray(raw.positions) ? raw.positions : []
  };
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

export const HistoricalAuditJsonControls: React.FC<Props> = ({ onImported }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportSession = () => {
    setError(null);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error('No hay ninguna prueba histórica guardada para exportar. Ejecuta o importa una prueba primero.');
      const session = normalizeSession(JSON.parse(raw));
      const payload = {
        metadata: {
          format: FORMAT,
          schemaVersion: EXPORT_SCHEMA_VERSION,
          replayStorageVersion: 3,
          exportedAt: new Date().toISOString(),
          source: 'fmaranis/Trading · Replay histórico auditado',
          note: 'Archivo autocontenido para auditoría, comparación y reimportación de una prueba histórica.'
        },
        session
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const first = safePart(session.startDate, 'inicio');
      const last = safePart(session.summary?.endDate ?? session.path?.at(-1)?.date ?? 'parcial', 'parcial');
      anchor.href = url;
      anchor.download = `trading-replay-${first}-${last}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`Prueba exportada: ${session.checkpoints.length} checkpoints · ${session.executions.length} operaciones · ${session.path.length} sesiones.`);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Selecciona un archivo .json exportado por la prueba histórica.');
      const parsed = JSON.parse(await file.text());
      const session = normalizeSession(unwrapImport(parsed));
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && existing !== JSON.stringify(session)) {
        const replace = window.confirm('Ya existe una prueba histórica guardada en este navegador. ¿Quieres sustituirla por la prueba importada?');
        if (!replace) { setMessage('Importación cancelada; la prueba actual no se ha modificado.'); return; }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      setMessage(`Prueba importada: ${session.checkpoints.length} checkpoints · ${session.executions.length} operaciones · ${session.path.length} sesiones. Los resultados ya están disponibles; para continuar calculando, usa “Preparar / reanudar”.`);
      onImported?.();
    } catch (e: any) {
      setError(`No se pudo importar la prueba: ${e?.message || String(e)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2"><FileJson className="h-4 w-4 text-cyan-300"/><b className="text-xs text-white">Archivo de auditoría de la prueba</b></div><div className="mt-1 text-[9px] text-slate-500">Exporta toda la sesión a JSON para archivarla o adjuntarla en ChatGPT. Al importar, recupera gráfica, checkpoints, señales, operaciones y resúmenes sin recalcular.</div></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={exportSession} className="flex min-h-10 items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[10px] font-bold text-cyan-100"><Download className="h-3.5 w-3.5"/>Exportar prueba JSON</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-10 items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] font-bold text-violet-100"><Upload className="h-3.5 w-3.5"/>Importar prueba JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => void importFile(e.target.files?.[0] ?? null)}/>
      </div>
    </div>
    {message && <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-[10px] text-emerald-100">{message}</div>}
    {error && <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-[10px] text-rose-100">{error}</div>}
  </div>;
};
