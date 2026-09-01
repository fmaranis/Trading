const REPLAY_STORAGE_KEY = 'historical_progressive_audit_v3';

let latestReplayJson: string | null = null;
let installed = false;

/**
 * Keeps the latest replay JSON readable for the lifetime of the page even when
 * browser localStorage quota is exhausted. The normal localStorage write is
 * still attempted so small/medium sessions remain resumable after reload.
 *
 * Publication is deliberately NOT triggered from here. Historical audit
 * publication happens only when the user explicitly saves the finished replay,
 * avoiding repeated GitHub traffic for intermediate checkpoints.
 */
export function installReplaySessionStorageFallback(): void {
  if (installed || typeof window === 'undefined' || typeof Storage === 'undefined') return;
  installed = true;

  const storagePrototype = Storage.prototype;
  const nativeSetItem = storagePrototype.setItem;
  const nativeGetItem = storagePrototype.getItem;
  const nativeRemoveItem = storagePrototype.removeItem;

  storagePrototype.setItem = function patchedSetItem(key: string, value: string): void {
    if (this === window.localStorage && key === REPLAY_STORAGE_KEY) {
      latestReplayJson = String(value);
    }
    nativeSetItem.call(this, key, value);
  };

  storagePrototype.getItem = function patchedGetItem(key: string): string | null {
    if (this === window.localStorage && key === REPLAY_STORAGE_KEY && latestReplayJson != null) {
      return latestReplayJson;
    }
    return nativeGetItem.call(this, key);
  };

  storagePrototype.removeItem = function patchedRemoveItem(key: string): void {
    if (this === window.localStorage && key === REPLAY_STORAGE_KEY) latestReplayJson = null;
    nativeRemoveItem.call(this, key);
  };
}
