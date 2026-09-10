export type JsonDownloadDisposition = 'DOWNLOAD_TRIGGERED' | 'OPENED_IN_NEW_TAB';

/**
 * Client-side export helper for data that only exists in browser storage.
 *
 * Do not revoke the Blob URL synchronously after anchor.click(): mobile browsers
 * may consume the URL after the current event loop and an immediate revoke can
 * cancel the transfer. Validation results that already live on the backend use
 * a normal HTTP attachment endpoint instead of this helper.
 */
export function downloadJsonFile(filename: string, payload: unknown): JsonDownloadDisposition {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.position = 'fixed';
  anchor.style.left = '-9999px';
  document.body.appendChild(anchor);

  let disposition: JsonDownloadDisposition = 'DOWNLOAD_TRIGGERED';
  try {
    anchor.click();
  } catch {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      anchor.remove();
      URL.revokeObjectURL(url);
      throw new Error('El navegador bloqueó tanto la descarga como la apertura del JSON.');
    }
    disposition = 'OPENED_IN_NEW_TAB';
  }

  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 30_000);

  return disposition;
}
