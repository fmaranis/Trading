import express from 'express';
import path from 'path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { marketDataRouter } from './server/marketDataRoutes';
import { alphaVantageRouter } from './server/alphaVantageRoutes';
import { eodhdRouter } from './server/eodhdRoutes';
import { alertAutomationRouter } from './server/alertAutomationRoutes';
import { startDailyAlertScheduler } from './server/alertAutomation';

const HISTORICAL_AUDIT_FORMAT = 'TRADING_HISTORICAL_REPLAY_AUDIT';
const HISTORICAL_AUDIT_SCHEMA_VERSION = 1;
const MAX_HISTORICAL_AUDIT_BYTES = 25 * 1024 * 1024;

function redactSecrets(value: unknown): unknown {
  const secrets = [process.env.ALPHA_VANTAGE_API_KEY, process.env.EODHD_API_KEY, process.env.MARKET_DATA_API_KEY, process.env.GEMINI_API_KEY, process.env.ALERT_WEBHOOK_URL, process.env.ALERT_ADMIN_TOKEN]
    .filter((v): v is string => Boolean(v && v.trim()));
  if (!secrets.length) return value;
  const scrub = (input: unknown): unknown => {
    if (typeof input === 'string') return secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), input);
    if (Array.isArray(input)) return input.map(scrub);
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, scrub(v)]));
    return input;
  };
  return scrub(value);
}

function validateHistoricalAuditPayload(payload: any): void {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_AUDIT_PAYLOAD');
  if (payload?.metadata?.format !== HISTORICAL_AUDIT_FORMAT) throw new Error('INVALID_AUDIT_FORMAT');
  if (Number(payload?.metadata?.schemaVersion) !== HISTORICAL_AUDIT_SCHEMA_VERSION) throw new Error('UNSUPPORTED_AUDIT_SCHEMA');
  const session = payload.session;
  if (!session || Number(session.version) !== 3) throw new Error('UNSUPPORTED_REPLAY_STORAGE_VERSION');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(session.startDate ?? ''))) throw new Error('INVALID_START_DATE');
  for (const field of ['checkpoints', 'executions', 'path', 'signals']) {
    if (!Array.isArray(session[field])) throw new Error(`MISSING_${field.toUpperCase()}`);
  }
}

function auditArchiveName(exportedAt: string): string {
  const safe = exportedAt.replace(/[:.]/g, '-').replace(/[^0-9TZ-]/g, '');
  return `${safe || Date.now()}-historical-replay.json`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: `${MAX_HISTORICAL_AUDIT_BYTES}b` }));

  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => originalJson(redactSecrets(body))) as typeof res.json;
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/validation/latest-broker-aware', async (_req, res) => {
    try {
      const validationPath = path.join(process.cwd(), 'validation-results', 'latest-broker-aware-execution-sweep.json');
      const raw = await readFile(validationPath, 'utf8');
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (error: any) {
      res.status(404).json({ error: 'LATEST_VALIDATION_RESULT_NOT_AVAILABLE', detail: error?.message || String(error) });
    }
  });

  app.post('/api/validation/historical-audit/save', async (req, res) => {
    try {
      validateHistoricalAuditPayload(req.body);
      const serialized = JSON.stringify(req.body, null, 2);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_HISTORICAL_AUDIT_BYTES) {
        return res.status(413).json({ error: 'HISTORICAL_AUDIT_TOO_LARGE' });
      }

      const root = path.resolve(process.cwd(), 'validation-runs');
      const archiveDir = path.resolve(root, 'archive');
      if (!archiveDir.startsWith(`${root}${path.sep}`)) throw new Error('INVALID_ARCHIVE_PATH');
      await mkdir(archiveDir, { recursive: true });

      const exportedAt = String(req.body?.metadata?.exportedAt || new Date().toISOString());
      const archiveName = auditArchiveName(exportedAt);
      const latestPath = path.resolve(root, 'latest.json');
      const archivePath = path.resolve(archiveDir, archiveName);
      if (!latestPath.startsWith(`${root}${path.sep}`) || !archivePath.startsWith(`${archiveDir}${path.sep}`)) throw new Error('INVALID_OUTPUT_PATH');

      await writeFile(latestPath, `${serialized}\n`, 'utf8');
      await writeFile(archivePath, `${serialized}\n`, 'utf8');

      res.json({
        ok: true,
        latestPath: path.relative(process.cwd(), latestPath).replaceAll('\\', '/'),
        archivePath: path.relative(process.cwd(), archivePath).replaceAll('\\', '/'),
        bytes: Buffer.byteLength(serialized, 'utf8')
      });
    } catch (error: any) {
      res.status(400).json({ error: 'HISTORICAL_AUDIT_SAVE_FAILED', detail: error?.message || String(error) });
    }
  });

  app.use('/api/market-data', marketDataRouter);
  app.use('/api/alpha-vantage', alphaVantageRouter);
  app.use('/api/eodhd', eodhdRouter);
  app.use('/api/alerts', alertAutomationRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Custodia] Server running on http://0.0.0.0:${PORT}`);
    const scheduler = startDailyAlertScheduler();
    console.log(`[Custodia] Daily alerts ${scheduler ? 'enabled' : 'disabled'}${scheduler ? ` (${process.env.ALERT_RUN_TIME_LOCAL || '22:30'} Europe/Madrid)` : ''}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
