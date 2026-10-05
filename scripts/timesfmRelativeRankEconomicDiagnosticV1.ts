import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { EUR_ASSET_UNIVERSE } from '../src/investment/decision/assetUniverse';
import { runDynamicReplayWithRotationExperiment } from '../src/investment/decision/replayRotationPolicyExperiment';
import { runDynamicReplayWithTimesFmRelativeRankV1 } from '../src/investment/decision/replayTimesFmRelativeRankExperiment';
import { TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1 as STAGE_B } from './timesfmStageBProtocol.mjs';
import { main as runStageBDiagnostic } from './timesfmStageBDiagnosticLive.mjs';
import {
  TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1 as P,
  classifyTimesFmHistoricalEconomicDiagnostic
} from './timesfmRelativeRankEconomicDiagnosticV1Protocol.mjs';

export const MARKER = 'TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1_RESULT';
const STAGE_B_RESULT_PATH = 'validation-runs/diagnostics/timesfm-stage-b-predictive-benchmark-v1-result.json';
const RESULT_PATH = 'validation-runs/diagnostics/timesfm-relative-rank-v1-economic-diagnostic-result.json';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function median(values: number[]): number | null {
  const rows = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}

function round(value: number | null | undefined, digits = 4): number | null {
  return Number.isFinite(value) ? Number(Number(value).toFixed(digits)) : null;
}

async function ensureStageBResult(): Promise<{ result: any; regenerated: boolean }> {
  let regenerated = false;
  if (!fs.existsSync(STAGE_B_RESULT_PATH)) {
    await runStageBDiagnostic();
    regenerated = true;
  }
  let result = JSON.parse(fs.readFileSync(STAGE_B_RESULT_PATH, 'utf8'));
  if (result?.status !== 'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION') {
    throw new Error('TIMESFM_ECONOMIC_STAGE_B_RESULT_NOT_PASS:' + String(result?.status ?? 'MISSING'));
  }
  const manifest = result?.evidence?.sourceManifest ?? {};
  const missingOrChanged = Object.values(manifest).some((row: any) => {
    const cachePath = String(row?.rawCachePath ?? '');
    if (!cachePath || !fs.existsSync(cachePath)) return true;
    const text = fs.readFileSync(cachePath, 'utf8');
    return sha256(text) !== String(row?.rawSha256 ?? '');
  });
  if (missingOrChanged) {
    await runStageBDiagnostic();
    regenerated = true;
    result = JSON.parse(fs.readFileSync(STAGE_B_RESULT_PATH, 'utf8'));
    if (result?.status !== 'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION') {
      throw new Error('TIMESFM_ECONOMIC_STAGE_B_REGEN_NOT_PASS:' + String(result?.status ?? 'MISSING'));
    }
  }
  return { result, regenerated };
}

function parseYahooOhlc(symbol: string, text: string) {
  const payload = JSON.parse(text);
  const result = payload?.chart?.result?.[0];
  if (payload?.chart?.error) throw new Error('TIMESFM_ECONOMIC_YAHOO_ERROR:' + symbol);
  if (!result?.timestamp?.length) throw new Error('TIMESFM_ECONOMIC_YAHOO_NO_DATA:' + symbol);
  const quote = result.indicators?.quote?.[0] ?? {};
  const bars: Array<{timestamp:string;open:number;high:number;low:number;close:number;volume:number}> = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const open = Number(quote.open?.[i]);
    const high = Number(quote.high?.[i]);
    const low = Number(quote.low?.[i]);
    const close = Number(quote.close?.[i]);
    if (![open, high, low, close].every(value => Number.isFinite(value) && value > 0)) continue;
    const volume = Number(quote.volume?.[i]);
    bars.push({
      timestamp: new Date(Number(result.timestamp[i]) * 1000).toISOString(),
      open, high, low, close,
      volume: Number.isFinite(volume) && volume >= 0 ? volume : 0
    });
  }
  bars.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  if (bars.length < 600) throw new Error('TIMESFM_ECONOMIC_YAHOO_OHLC_SHORT:' + symbol + ':' + bars.length);
  return bars;
}

function buildDataset(stageBResult: any) {
  const wanted = [STAGE_B.core.assetId, ...STAGE_B.assets.map((row:any)=>row.assetId)];
  const catalog = EUR_ASSET_UNIVERSE.filter(item => wanted.includes(item.assetId));
  if (catalog.length !== wanted.length) throw new Error('TIMESFM_ECONOMIC_CATALOG_COVERAGE:' + catalog.length + '/' + wanted.length);
  const manifest = stageBResult.evidence.sourceManifest;
  const assets = catalog.map(item => {
    const row = manifest[item.ticker];
    if (!row?.rawCachePath || !fs.existsSync(row.rawCachePath)) {
      throw new Error('TIMESFM_ECONOMIC_RAW_CACHE_MISSING:' + item.ticker);
    }
    const text = fs.readFileSync(row.rawCachePath, 'utf8');
    if (sha256(text) !== row.rawSha256) throw new Error('TIMESFM_ECONOMIC_RAW_CACHE_SHA:' + item.ticker);
    return {
      assetId: item.assetId,
      ticker: item.ticker,
      name: item.name,
      currency: 'EUR',
      bars: parseYahooOhlc(item.ticker, text),
      provenance: {
        sourceType: 'REAL' as const,
        provider: 'Yahoo Finance',
        symbol: item.ticker,
        isReproducible: true,
        datasetFingerprint: row.rawSha256
      }
    };
  });
  return { catalog, dataset: { timeframe: '1d', assets } };
}

function buildEvidence(stageBResult: any) {
  const eventRows: any[] = Array.isArray(stageBResult?.events) ? stageBResult.events : [];
  const dates: string[] = [...new Set<string>(
    eventRows.map((row: any): string => String(row.informationDate))
  )].sort((a, b) => a.localeCompare(b));
  if (dates.length !== P.decisionCountExpected) {
    throw new Error('TIMESFM_ECONOMIC_INFORMATION_DATE_COUNT:' + dates.length);
  }
  const evidenceByDate: Record<string, Array<{assetId:string;predictedRelativeReturn20Pct:number;predictedRelativeReturn60Pct:number}>> = {};
  for (const date of dates) {
    const rows: any[] = eventRows.filter((row: any) => String(row.informationDate) === date);
    const evidence = STAGE_B.assets.map((asset:any) => {
      const r20 = rows.find((row:any)=>row.assetId === asset.assetId && row.horizon === 20);
      const r60 = rows.find((row:any)=>row.assetId === asset.assetId && row.horizon === 60);
      const v20 = Number(r20?.mvPredRelativeReturnPct);
      const v60 = Number(r60?.mvPredRelativeReturnPct);
      if (!Number.isFinite(v20) || !Number.isFinite(v60)) {
        throw new Error('TIMESFM_ECONOMIC_FORECAST_MISSING:' + date + ':' + asset.assetId);
      }
      return { assetId: asset.assetId, predictedRelativeReturn20Pct: v20, predictedRelativeReturn60Pct: v60 };
    });
    evidence.push({
      assetId: STAGE_B.core.assetId,
      predictedRelativeReturn20Pct: 0,
      predictedRelativeReturn60Pct: 0
    });
    evidenceByDate[date] = evidence;
  }
  return { dates, evidenceByDate };
}

function executedTradeSignature(result: any): string {
  return result.signals
    .filter((row:any)=>row.executed && !row.isInitialAllocation)
    .map((row:any)=>[
      row.signalDate,
      row.executionDate,
      row.assetId,
      row.action,
      Number(row.notionalEur ?? 0).toFixed(2),
      Number(row.feeEur ?? 0).toFixed(2)
    ].join('|'))
    .join('\n');
}

function summarizeArm(result: any) {
  const finalPoint = result.equityPath.at(-1);
  return {
    finalValueEur: round(result.finalValueEur, 2),
    totalReturnPct: round(result.totalReturnPct),
    cashFlowAdjustedReturnPct: round(result.cashFlowAdjustedReturnPct),
    structuralCoreBenchmarkFinalEur: round(result.structuralCoreBenchmarkFinalEur, 2),
    structuralCoreBenchmarkReturnPct: round(result.structuralCoreBenchmarkReturnPct),
    excessFinalEurVsStructuralCore: round(result.excessFinalEurVsStructuralCore, 2),
    excessReturnVsStructuralCorePctPoints: round(result.excessReturnVsStructuralCorePctPoints),
    beatsStructuralCoreBenchmark: result.beatsStructuralCoreBenchmark,
    maxDrawdownPct: round(result.decisionPathMaxDrawdownPct),
    totalFeesEur: round(result.totalFeesEur, 2),
    totalEstimatedTaxEur: round(result.totalEstimatedTaxEur, 2),
    executedBuys: result.executedBuys,
    executedAdds: result.executedAdds,
    executedReductions: result.executedReductions,
    executedExits: result.executedExits,
    finalCashEur: round(finalPoint?.cashEur, 2),
    decisions: result.decisions,
    materialSignals: result.materialSignals
  };
}

export async function main() {
  const stageB = await ensureStageBResult();
  const { catalog, dataset } = buildDataset(stageB.result);
  const { dates, evidenceByDate } = buildEvidence(stageB.result);

  const rows:any[] = [];
  for (const capital of P.capitalScenarios) {
    for (const riskProfile of P.riskProfiles) {
      const input:any = {
        dataset,
        catalog,
        startDate: dates[0],
        explicitDecisionDates: dates,
        frequency: 'QUARTERLY',
        initialCapitalEur: capital.initialCapitalEur,
        riskProfile,
        horizonYears: P.horizonYears,
        cashBenchmarkAnnualPct: 2.5,
        cashBenchmarkMode: P.cashBenchmarkMode,
        minimumBars: P.minimumBars,
        taxSettings: { priorSavingsTaxableBaseEur: 0, contextConfirmed: false },
        externalCashFlows: []
      };

      const baseline = runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1');
      const candidate = runDynamicReplayWithTimesFmRelativeRankV1(input, evidenceByDate);
      const baselineSignature = executedTradeSignature(baseline);
      const candidateSignature = executedTradeSignature(candidate);
      rows.push({
        capitalBand: capital.band,
        initialCapitalEur: capital.initialCapitalEur,
        riskProfile,
        horizonYears: P.horizonYears,
        executedTradeSignatureChanged: baselineSignature !== candidateSignature,
        baseline: summarizeArm(baseline),
        candidate: summarizeArm(candidate),
        excessFinalEur: candidate.finalValueEur - baseline.finalValueEur,
        excessReturnPctPoints: candidate.totalReturnPct - baseline.totalReturnPct,
        maxDrawdownDeltaPctPoints: candidate.decisionPathMaxDrawdownPct - baseline.decisionPathMaxDrawdownPct,
        feeDeltaEur: candidate.totalFeesEur - baseline.totalFeesEur,
        taxDeltaEur: candidate.totalEstimatedTaxEur - baseline.totalEstimatedTaxEur,
        finalCashDeltaEur: (candidate.equityPath.at(-1)?.cashEur ?? 0) - (baseline.equityPath.at(-1)?.cashEur ?? 0),
        candidateBeatsLegacy: candidate.finalValueEur > baseline.finalValueEur + 0.005,
        candidateBeatsStructuralCore: candidate.beatsStructuralCoreBenchmark
      });
    }
  }

  const verdict = classifyTimesFmHistoricalEconomicDiagnostic(rows);
  const positive = rows.filter(row=>row.excessFinalEur > 0.005).length;
  const negative = rows.filter(row=>row.excessFinalEur < -0.005).length;
  const flat = rows.length - positive - negative;
  const reach = rows.filter(row=>row.executedTradeSignatureChanged || Math.abs(row.excessFinalEur) > 0.005).length;
  const result = {
    schemaVersion: 1,
    study: P.version,
    generatedAt: new Date().toISOString(),
    status: verdict,
    role: P.role,
    methodology: P,
    evidence: {
      stageBResultPath: STAGE_B_RESULT_PATH,
      stageBResultRegenerated: stageB.regenerated,
      stageBStatus: stageB.result.status,
      informationDates: dates,
      informationDateCount: dates.length,
      yahooRawSourceManifest: stageB.result.evidence.sourceManifest
    },
    aggregate: {
      scenarios: rows.length,
      scenariosWithEconomicReach: reach,
      positiveScenarios: positive,
      negativeScenarios: negative,
      flatScenarios: flat,
      medianExcessFinalEur: round(median(rows.map(row=>row.excessFinalEur)), 2),
      medianExcessReturnPctPoints: round(median(rows.map(row=>row.excessReturnPctPoints))),
      candidateBeatsStructuralCoreScenarios: rows.filter(row=>row.candidateBeatsStructuralCore === true).length,
      baselineBeatsStructuralCoreScenarios: rows.filter(row=>row.baseline.beatsStructuralCoreBenchmark === true).length
    },
    scenarios: rows.map(row=>({
      ...row,
      excessFinalEur: round(row.excessFinalEur, 2),
      excessReturnPctPoints: round(row.excessReturnPctPoints),
      maxDrawdownDeltaPctPoints: round(row.maxDrawdownDeltaPctPoints),
      feeDeltaEur: round(row.feeDeltaEur, 2),
      taxDeltaEur: round(row.taxDeltaEur, 2),
      finalCashDeltaEur: round(row.finalCashDeltaEur, 2)
    })),
    notes: [
      'CONSUMED HISTORICAL DIAGNOSTIC ONLY: this result cannot promote production.',
      'All 15 frozen capital/risk scenarios are reported; no scenario selection after outcomes.',
      'Both arms use identical REAL Yahoo data, exact Stage B information dates, CORE_ARCHITECTURE_V1, ECB historical cash, taxes and NEXT_OPEN execution.',
      'The only intended candidate-arm intervention is TIMESFM_RELATIVE_RANK_V1 among already-eligible candidates.',
      'Fresh prospective confirmation remains mandatory regardless of this verdict.'
    ],
    productionDefault: 'LEGACY',
    productionAuthority: false
  };

  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(MARKER);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  main().catch(error => {
    console.error(MARKER);
    console.error(JSON.stringify({
      study: P.version,
      status: 'BLOCKED_OR_TECHNICAL_FAILED',
      error: error?.message ?? String(error),
      productionDefault: 'LEGACY',
      productionAuthority: false
    }, null, 2));
    process.exitCode = 1;
  });
}
