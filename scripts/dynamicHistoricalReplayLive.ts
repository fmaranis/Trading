import { spawn } from 'node:child_process';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import {
  AssetUniverseScanner,
  DEFAULT_CASH_BENCHMARK_ANNUAL_PCT,
  DynamicHistoricalReplayEngine,
  EUR_ASSET_UNIVERSE,
  historicalStartDates
} from '../src/investment/decision';

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round(value: number | null, digits = 2): number | null {
  return value == null ? null : Number(value.toFixed(digits));
}

async function main() {
  const base = 'http://127.0.0.1:3000';
  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;

  if (!(await waitFor(`${base}/api/health`, 1200))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitFor(`${base}/api/health`, 30_000))) {
      throw new Error('Servidor local no disponible en puerto 3000');
    }
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${base}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const end = new Date();
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - 7);

    const scan = await AssetUniverseScanner.scan(
      EUR_ASSET_UNIVERSE,
      isoDate(start),
      isoDate(end),
      { forceRefresh: false, concurrency: 3, maxSelected: 8, minimumBars: 252, maxDataAgeDays: 7 }
    );

    const provenance = scan.acceptedDataset.assets.map(asset => ({
      assetId: asset.assetId,
      ticker: asset.ticker,
      sourceType: asset.provenance.sourceType,
      provider: asset.provenance.provider ?? null,
      symbol: asset.provenance.symbol ?? null,
      bars: asset.bars.length,
      firstDate: asset.bars[0]?.timestamp.slice(0, 10) ?? null,
      lastDate: asset.bars.at(-1)?.timestamp.slice(0, 10) ?? null,
      datasetFingerprint: asset.provenance.datasetFingerprint ?? null
    }));

    const nonReal = provenance.filter(item => item.sourceType !== 'REAL');
    if (nonReal.length) {
      throw new Error(`El diagnóstico live exige REAL_ONLY; encontrados ${nonReal.length} activos no REAL.`);
    }

    const starts = historicalStartDates(scan.acceptedDataset, 'ANNUAL').slice(-5);
    if (!starts.length) throw new Error('No hay fechas históricas anuales válidas para ejecutar el replay dinámico REAL.');

    const scenarios = starts.map(startDate => {
      const replay = DynamicHistoricalReplayEngine.run({
        dataset: scan.acceptedDataset,
        catalog: EUR_ASSET_UNIVERSE,
        startDate,
        frequency: 'MONTHLY',
        initialCapitalEur: 1000,
        riskProfile: 'MEDIUM',
        horizonYears: 3,
        cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT,
        minimumBars: 252
      });

      const executedSignals = replay.signals
        .filter(signal => signal.executed)
        .map(signal => ({
          signalDate: signal.signalDate,
          executionDate: signal.executionDate,
          ticker: signal.ticker,
          action: signal.action,
          targetWeightPct: round(signal.targetWeight * 100, 1),
          currentWeightPct: round(signal.currentWeight * 100, 1),
          consensusScore: signal.consensusScore,
          favorableVotes: signal.favorableVotes,
          unfavorableVotes: signal.unfavorableVotes,
          structuralDowntrend: signal.structuralDowntrend,
          buyTheDipCandidate: signal.buyTheDipCandidate,
          unitsDelta: round(signal.unitsDelta, 6),
          notionalEur: round(signal.notionalEur),
          feeEur: round(signal.feeEur),
          executionPriceEur: round(signal.executionPriceEur),
          reason: signal.reason
        }));

      const materialNotExecuted = replay.signals
        .filter(signal => !signal.executed && ['BUY', 'ADD', 'REDUCE', 'EXIT'].includes(signal.action))
        .slice(0, 30)
        .map(signal => ({
          signalDate: signal.signalDate,
          ticker: signal.ticker,
          action: signal.action,
          targetWeightPct: round(signal.targetWeight * 100, 1),
          currentWeightPct: round(signal.currentWeight * 100, 1),
          consensusScore: signal.consensusScore,
          structuralDowntrend: signal.structuralDowntrend,
          buyTheDipCandidate: signal.buyTheDipCandidate,
          reason: signal.reason
        }));

      return {
        startDate: replay.startDate,
        endDate: replay.endDate,
        frequency: replay.frequency,
        initialCapitalEur: replay.initialCapitalEur,
        finalValueEur: round(replay.finalValueEur),
        totalReturnPct: round(replay.totalReturnPct),
        staticBuyHoldFinalEur: round(replay.staticBuyHoldFinalEur),
        staticBuyHoldReturnPct: round(replay.staticBuyHoldReturnPct),
        allCashFinalEur: round(replay.allCashFinalEur),
        allCashReturnPct: round(replay.allCashReturnPct),
        excessFinalEurVsStatic: round(replay.excessFinalEurVsStatic),
        excessReturnVsStaticPctPoints: round(replay.excessReturnVsStaticPctPoints),
        excessFinalEurVsCash: round(replay.excessFinalEurVsCash),
        excessReturnVsCashPctPoints: round(replay.excessReturnVsCashPctPoints),
        decisionPathMaxDrawdownPct: round(replay.decisionPathMaxDrawdownPct),
        decisions: replay.decisions,
        materialSignals: replay.materialSignals,
        executedBuys: replay.executedBuys,
        executedAdds: replay.executedAdds,
        executedReductions: replay.executedReductions,
        executedExits: replay.executedExits,
        totalFeesEur: round(replay.totalFeesEur),
        cashInterestEur: round(replay.cashInterestEur),
        executedSignals,
        materialNotExecuted
      };
    });

    const summary = {
      scenarioCount: scenarios.length,
      scenariosBeatingStatic: scenarios.filter(item => (item.excessFinalEurVsStatic ?? 0) > 0).length,
      scenariosBeatingCash: scenarios.filter(item => (item.excessFinalEurVsCash ?? 0) > 0).length,
      totalExecutedBuys: scenarios.reduce((sum, item) => sum + item.executedBuys, 0),
      totalExecutedAdds: scenarios.reduce((sum, item) => sum + item.executedAdds, 0),
      totalExecutedReductions: scenarios.reduce((sum, item) => sum + item.executedReductions, 0),
      totalExecutedExits: scenarios.reduce((sum, item) => sum + item.executedExits, 0),
      scenariosWithAnySellSignal: scenarios.filter(item => item.executedReductions + item.executedExits > 0).length,
      scenariosWithAnyBuySignal: scenarios.filter(item => item.executedBuys + item.executedAdds > 0).length
    };

    const result = {
      generatedAt: new Date().toISOString(),
      scope: 'REAL_DYNAMIC_HISTORICAL_REPLAY_SANITY_CHECK',
      configuration: {
        riskProfile: 'MEDIUM',
        horizonYears: 3,
        initialCapitalEur: 1000,
        frequency: 'MONTHLY',
        cashBenchmarkAnnualPct: DEFAULT_CASH_BENCHMARK_ANNUAL_PCT,
        minimumBars: 252,
        requestedHistoricalStarts: starts
      },
      scan: {
        scanned: scan.scanned,
        accepted: scan.accepted,
        rejected: scan.rejected,
        selectedNow: scan.selected.map(item => item.asset.ticker),
        rejectionCounts: scan.rejectionCounts
      },
      provenance,
      summary,
      scenarios,
      notes: [
        'All scenario inputs come from the live REAL market-data scan; synthetic fallback is forbidden.',
        'Historical decisions remain causal: each checkpoint uses only bars available on or before that date.',
        'Trades execute after the signal date; ETF commissions and whole-share constraints are modeled by the replay engine.',
        'Dynamic results are compared with the initial recommendation held unchanged and with remunerated all-cash over matching dates.',
        'Current-catalog survivorship bias remains: historical delisted/unavailable constituents are not reconstructed.',
        'This is historical diagnostic evidence, not a forecast.'
      ]
    };

    console.log('DYNAMIC_HISTORICAL_REPLAY_LIVE_RESULT');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('DYNAMIC_HISTORICAL_REPLAY_LIVE_ERROR', error?.message || String(error));
  process.exit(1);
});
