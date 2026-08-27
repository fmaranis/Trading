import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { marketDataRouter } from './server/marketDataRoutes';
import { alphaVantageRouter } from './server/alphaVantageRoutes';

function redactSecrets(value: unknown): unknown {
  const secrets = [process.env.ALPHA_VANTAGE_API_KEY, process.env.MARKET_DATA_API_KEY, process.env.GEMINI_API_KEY]
    .filter((v): v is string => Boolean(v && v.trim()));
  if (!secrets.length) return value;
  const scrub = (input: unknown): unknown => {
    if (typeof input === 'string') {
      return secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), input);
    }
    if (Array.isArray(input)) return input.map(scrub);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, scrub(v)]));
    }
    return input;
  };
  return scrub(value);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Defense in depth: never let known server-side secrets leak in JSON responses,
  // even if an upstream provider echoes them inside an error or notice string.
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => originalJson(redactSecrets(body))) as typeof res.json;
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/market-data', marketDataRouter);
  app.use('/api/alpha-vantage', alphaVantageRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Custodia] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
