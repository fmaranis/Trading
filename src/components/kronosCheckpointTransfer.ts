/**
 * Browser-preview downloads can be intercepted by AI Studio's cookie gate.
 * Validate the actual response before ever naming it a Kronos checkpoint.
 */
export function parseKronosCheckpointDownload(raw: string, contentType: string): string {
  const trimmed = raw.trimStart();
  if (/text\/html/i.test(contentType) || /^<(?:!doctype\s+html|html)\b/i.test(trimmed)) {
    throw new Error('AI Studio ha devuelto una página de autenticación en lugar del checkpoint. No se ha descargado ninguna copia válida. Compruebe la sesión/cookies sin reiniciar el backend.');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('El servidor no devolvió un JSON válido de checkpoint; no se ha guardado el archivo.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El archivo descargado no tiene la estructura de un checkpoint Kronos.');
  }
  const item = parsed as Record<string, unknown>;
  const plainObject = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (item.version !== 'KRONOS_STAGE_B_DIAGNOSTIC_V1' ||
      !plainObject(item.completed) || !plainObject(item.partial)) {
    throw new Error('La respuesta no es un checkpoint Kronos Stage B; se ha evitado guardar un archivo incorrecto.');
  }
  return JSON.stringify(parsed, null, 2) + '\n';
}

export interface KronosCheckpointStatusResponse {
  available: boolean;
  completedAnchors?: number;
  partialAnchors?: number;
  completedPaths?: number;
  expectedMaximumPaths?: number;
  progressPctOfMaximum?: number;
  savedAt?: string;
  durablePaths?: number;
  locallySavedPaths?: number;
  durableConfirmed?: boolean;
  persistence?: 'GITHUB_REPLAY_RESULTS';
  note?: string;
}

/** Fail visibly on login pages, empty bodies and malformed backend responses. */
export function parseKronosCheckpointStatusResponse(
  raw: string, contentType: string, httpStatus: number
): KronosCheckpointStatusResponse {
  if (/text\/html/i.test(contentType) || /^\s*<(?:!doctype\s+html|html)\b/i.test(raw)) {
    throw new Error('AI Studio ha interceptado la consulta con una página de autenticación (Cookie check). No se ha podido comprobar el checkpoint; no significa que se haya perdido.');
  }
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new Error('El backend no ha devuelto un JSON válido al consultar el progreso de Kronos. No se puede confirmar si existe checkpoint.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('El backend devolvió una respuesta inválida. No se puede comprobar el checkpoint.');
  }
  const item = data as Record<string, unknown>;
  if (httpStatus < 200 || httpStatus >= 300) {
    const detail = typeof item.error === 'string' ? item.error : 'Error desconocido';
    throw new Error(`Consulta rechazada por el backend (HTTP ${httpStatus}): ${detail}. No se ha borrado ningún checkpoint.`);
  }
  if (typeof item.available !== 'boolean') {
    throw new Error('La respuesta no contiene el estado del checkpoint; no se puede confirmar su existencia.');
  }
  if (item.available) {
    for (const name of ['completedAnchors', 'partialAnchors', 'completedPaths', 'expectedMaximumPaths']) {
      const value = item[name];
      if (!Number.isInteger(value) || (value as number) < 0) {
        throw new Error('El backend ha devuelto contadores de checkpoint inválidos.');
      }
    }
    if (typeof item.progressPctOfMaximum !== 'number' || !Number.isFinite(item.progressPctOfMaximum) ||
        item.progressPctOfMaximum < 0 || item.progressPctOfMaximum > 100 || typeof item.savedAt !== 'string') {
      throw new Error('El backend ha devuelto datos de progreso inválidos.');
    }
  }
  return item as unknown as KronosCheckpointStatusResponse;
}
