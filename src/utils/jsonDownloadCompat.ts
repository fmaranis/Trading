const JSON_BLOB_REVOKE_DELAY_MS = 15_000;
const TOUCH_RETRIGGER_GUARD_MS = 700;

let installed = false;

function normalizedText(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('es-ES');
}

function downloadButtonFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest('button');
  if (!(button instanceof HTMLButtonElement)) return null;
  return normalizedText(button.textContent).includes('descargar json') ? button : null;
}

/**
 * Some embedded browsers / preview WebViews schedule the actual download after
 * the click handler returns. Revoking a JSON blob URL synchronously can therefore
 * invalidate the URL before the browser has consumed it.
 *
 * Some Android WebViews also fail to synthesize a reliable click from a touch on
 * small buttons. The compatibility layer therefore keeps JSON blob URLs alive
 * briefly and, only for the "Descargar JSON" control, converts the completed
 * touch/pointer gesture into an explicit click. The bridge is deliberately
 * narrow so normal application controls keep native browser behaviour.
 */
export function installJsonDownloadCompatibility(): void {
  if (installed || typeof URL === 'undefined' || typeof Blob === 'undefined' || typeof document === 'undefined') return;
  installed = true;

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  const jsonBlobUrls = new Set<string>();
  const lastForcedActivation = new WeakMap<HTMLButtonElement, number>();

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

  const activateDownloadButton = (event: Event) => {
    const button = downloadButtonFromTarget(event.target);
    if (!button || button.disabled) return;
    const now = Date.now();
    if (now - (lastForcedActivation.get(button) ?? 0) < TOUCH_RETRIGGER_GUARD_MS) return;
    lastForcedActivation.set(button, now);
    event.preventDefault();
    button.click();
  };

  if ('PointerEvent' in window) {
    document.addEventListener('pointerup', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') activateDownloadButton(event);
    }, { passive: false });
  } else {
    document.addEventListener('touchend', activateDownloadButton, { passive: false });
  }
}
