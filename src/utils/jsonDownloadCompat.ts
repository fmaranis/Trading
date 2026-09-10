const JSON_BLOB_REVOKE_DELAY_MS = 15_000;

let installed = false;

/**
 * Some embedded browsers / preview WebViews schedule the actual download after
 * the click handler returns. Revoking a JSON blob URL synchronously can therefore
 * invalidate the URL before the browser has consumed it.
 *
 * Keep the workaround deliberately narrow: only blob URLs created from JSON are
 * delayed. Every other object URL keeps the browser's native lifecycle.
 */
export function installJsonDownloadCompatibility(): void {
  if (installed || typeof URL === 'undefined' || typeof Blob === 'undefined') return;
  installed = true;

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const jsonBlobUrls = new Set<string>();

  URL.createObjectURL = ((object: Blob | MediaSource) => {
    const url = originalCreateObjectURL(object);
    if (object instanceof Blob && object.type.toLowerCase().includes('application/json')) {
      jsonBlobUrls.add(url);
    }
    return url;
  }) as typeof URL.createObjectURL;

  URL.revokeObjectURL = ((url: string) => {
    if (!jsonBlobUrls.has(url)) {
      originalRevokeObjectURL(url);
      return;
    }

    window.setTimeout(() => {
      jsonBlobUrls.delete(url);
      originalRevokeObjectURL(url);
    }, JSON_BLOB_REVOKE_DELAY_MS);
  }) as typeof URL.revokeObjectURL;
}
