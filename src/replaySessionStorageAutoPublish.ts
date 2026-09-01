const REPLAY_AUDIT_FORMAT = 'TRADING_HISTORICAL_REPLAY_AUDIT';
const REPLAY_AUDIT_SCHEMA_VERSION = 1;

let pendingReplayJson: string | null = null;
let publishing = false;

function buildAuditEnvelope(sessionJson: string): string {
  const session = JSON.parse(sessionJson);
  return JSON.stringify({
    metadata: {
      format: REPLAY_AUDIT_FORMAT,
      schemaVersion: REPLAY_AUDIT_SCHEMA_VERSION,
      replayStorageVersion: 3,
      exportedAt: new Date().toISOString(),
      source: 'fmaranis/Trading · Replay histórico auditado',
      note: 'Publicación automática desde el estado vivo del replay; no depende de que localStorage pueda persistir toda la sesión.'
    },
    session
  });
}

async function publishLatest(): Promise<void> {
  if (publishing || !pendingReplayJson) return;
  publishing = true;
  try {
    while (pendingReplayJson) {
      const current = pendingReplayJson;
      pendingReplayJson = null;
      try {
        await fetch('/api/validation/historical-audit/save?archive=0', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: buildAuditEnvelope(current)
        });
      } catch {
        // Best-effort audit publication must never interrupt replay calculation.
      }
    }
  } finally {
    publishing = false;
    if (pendingReplayJson) void publishLatest();
  }
}

/**
 * Queues the newest live replay snapshot for server/GitHub publication.
 * If several checkpoints finish while a publication is in flight, only the
 * newest waiting snapshot is sent next. Automatic checkpoint publication only
 * updates latest; archive copies are created explicitly at the end of a replay.
 */
export function queueReplayAutoPublish(sessionJson: string): void {
  pendingReplayJson = sessionJson;
  void publishLatest();
}
