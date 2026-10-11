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
