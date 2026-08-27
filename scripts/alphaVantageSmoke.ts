import { spawn } from 'node:child_process';

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  const base = 'http://127.0.0.1:3000';
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  if (!(await waitFor(`${base}/api/health`, 1200))) {
    server = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', env: process.env });
    ownsServer = true;
    if (!(await waitFor(`${base}/api/health`, 30_000))) throw new Error('Servidor local no disponible en puerto 3000');
  }

  try {
    const statusRes = await fetch(`${base}/api/alpha-vantage/status`);
    const status = await statusRes.json();
    if (!status.configured) {
      console.log('ALPHA_VANTAGE_SMOKE_RESULT');
      console.log(JSON.stringify({ configured: false, blocker: 'ALPHA_VANTAGE_API_KEY_NOT_CONFIGURED' }, null, 2));
      return;
    }

    const end = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const yahooRes = await fetch(`${base}/api/market-data/history?symbol=EUN6.DE&startDate=${startDate}&endDate=${end}&timeframe=1d&adjusted=true`);
    if (!yahooRes.ok) throw new Error(`Yahoo smoke HTTP ${yahooRes.status}`);
    const yahoo = await yahooRes.json();
    const last = yahoo.bars.at(-1);
    const crossRes = await fetch(`${base}/api/alpha-vantage/cross-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: [{ ticker: 'EUN6.DE', asOfDate: last.timestamp.slice(0, 10), lastClose: last.close }] })
    });
    const cross = await crossRes.json();
    console.log('ALPHA_VANTAGE_SMOKE_RESULT');
    console.log(JSON.stringify({
      configured: true,
      status,
      crossValidation: cross
    }, null, 2));
    if (!crossRes.ok) process.exitCode = 1;
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('ALPHA_VANTAGE_SMOKE_ERROR', err?.message || String(err));
  process.exit(1);
});
