import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { HistoricalMarketDataService } from '../src/investment/data/marketData/historicalMarketDataService';
import { MarketDataProviderRegistry } from '../src/investment/data/marketData/registry';
import { RealMarketDataProvider } from '../src/investment/data/marketData/providers/realMarketDataProvider';
import { saveDurableResearchValidationEvidence } from '../server/researchValidationEvidenceStore';
import {
  FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1 as P,
  epsGrowthVariability,
  median,
  scoreQualityCrossSection,
  splitHighQualityByValuation,
  type QualityScored
} from './fundamentalQualityValuationBroadPitV1Protocol';

const JOB_ID = 'fundamental-quality-valuation-broad-pit-v1';
const JOB_NAME = 'Fundamental Quality × valoración · validación PIT amplia';
const MARKER = 'FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1_RESULT';
const LOCAL_RECOVERY_PATH = '.runtime/fundamental-quality-valuation-broad-pit-v1-result.json';
const SEAL_PATH = 'validation-runs/preregistration/fundamental-quality-valuation-broad-pit-v1-seal.json';
const BASE_URL = 'http://127.0.0.1:3000';
const INFO_PRICE_END_DATE = '2021-05-04';
const OUTCOME_REQUEST_END_DATE = '2022-05-04';
const SEC_MIN_INTERVAL_MS = 125;

type HistoricalComponent = {
  Code?: string;
  Name?: string;
  StartDate?: string;
  EndDate?: string | null;
  IsActiveNow?: number;
  IsDelisted?: number;
};

type SecTickerRow = {
  cik_str?: number;
  ticker?: string;
  title?: string;
};

type SecFactRow = {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};

type AnnualFact = {
  start: string;
  end: string;
  value: number;
  filed: string;
  accn: string | null;
  tag: string;
};

type InstantFact = {
  end: string;
  value: number;
  filed: string;
  accn: string | null;
  tag: string;
};

type FundamentalRow = {
  ticker: string;
  yahooTicker: string;
  companyName: string;
  cik: string;
  operatingIncome: number;
  annualNetIncome: number;
  annualPeriodEnd: string;
  equity: number;
  totalDebt: number | null;
  sharesOutstanding: number | null;
  roe: number;
  debtEquity: number | null;
  earningsVariability: number | null;
  annualEpsLastFive: number[] | null;
  causalFilings: string[];
};

type OutcomeRow = {
  ticker: string;
  yahooTicker: string;
  companyName: string;
  cik: string;
  qualityScore: number;
  roe: number;
  debtEquity: number | null;
  earningsVariability: number | null;
  earningsYield: number;
  rawPriceAtInformationDate: number;
  adjustedReturnPct: number;
  excessVsSpyPctPoints: number;
  excessVsUrthPctPoints: number;
};

type BroadPitSeal = {
  version: string;
  frozenAt: string;
  sampleRole: string;
  informationDate: string;
  outcomeDate: string;
  productionDefault: string;
  productionAuthority: boolean;
  noRetuningAfterOutcome: boolean;
  currentYahooDiscoveryHistorical: boolean;
  expectedGitBlobSha: Record<string, string>;
};

function gitBlobSha(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const bytes = Buffer.from(normalized, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function verifyPreRunSeal(): BroadPitSeal {
  const seal = JSON.parse(readFileSync(SEAL_PATH, 'utf8')) as BroadPitSeal;
  if (seal.version !== 'FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1_SEAL') throw new Error('QUALITY_VALUATION_SEAL_VERSION_INVALID');
  if (seal.informationDate !== P.informationDate || seal.outcomeDate !== P.outcomeDate) throw new Error('QUALITY_VALUATION_SEAL_DATES_MISMATCH');
  if (seal.productionDefault !== 'LEGACY' || seal.productionAuthority !== false) throw new Error('QUALITY_VALUATION_SEAL_PRODUCTION_AUTHORITY_INVALID');
  if (seal.noRetuningAfterOutcome !== true || seal.currentYahooDiscoveryHistorical !== false) throw new Error('QUALITY_VALUATION_SEAL_METHODOLOGY_INVALID');
  for (const [path, expected] of Object.entries(seal.expectedGitBlobSha)) {
    const actual = gitBlobSha(readFileSync(path, 'utf8'));
    if (actual !== expected) throw new Error(`QUALITY_VALUATION_SEAL_MISMATCH:${path}:${expected}:${actual}`);
  }
  return seal;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`FUNDAMENTAL_QUALITY_VALUATION_${name}_REQUIRED`);
  return value;
}

function iso(value: unknown): string {
  return String(value ?? '').slice(0, 10);
}

function tickerKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function yahooTicker(value: string): string {
  return value.trim().toUpperCase().replace(/\./g, '-');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealth(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await sleep(400);
  }
  return false;
}

async function fetchJson(url: string, headers: Record<string, string>, label: string): Promise<any> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(Number(process.env.MARKET_DATA_TIMEOUT_MS) || 30_000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${label}_HTTP_${response.status}:${text.slice(0, 240)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}_INVALID_JSON`);
  }
}

let lastSecRequestAt = 0;
async function secJson(url: string, userAgent: string, label: string): Promise<any> {
  const elapsed = Date.now() - lastSecRequestAt;
  if (elapsed < SEC_MIN_INTERVAL_MS) await sleep(SEC_MIN_INTERVAL_MS - elapsed);
  lastSecRequestAt = Date.now();
  return fetchJson(url, {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'User-Agent': userAgent
  }, label);
}

function valuesOfObject<T>(value: unknown): T[] {
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, T>);
}

async function loadHistoricalMembers(apiKey: string): Promise<HistoricalComponent[]> {
  const url = `https://eodhd.com/api/mp/unicornbay/spglobal/comp/${encodeURIComponent(P.universe.indexSymbol)}?api_token=${encodeURIComponent(apiKey)}&fmt=json`;
  const payload = await fetchJson(url, { Accept: 'application/json', 'User-Agent': 'Custodia/1.0 QualityValuationPIT' }, 'QUALITY_VALUATION_EODHD_INDEX');
  const rows = valuesOfObject<HistoricalComponent>(payload?.HistoricalTickerComponents);
  const active = rows.filter(row => {
    const start = iso(row.StartDate);
    const end = iso(row.EndDate);
    return Boolean(row.Code)
      && Boolean(start)
      && start <= P.informationDate
      && (!end || P.informationDate <= end);
  });
  const unique = new Map<string, HistoricalComponent>();
  for (const row of active) {
    const code = String(row.Code ?? '').trim().toUpperCase();
    if (code && !unique.has(code)) unique.set(code, row);
  }
  return [...unique.values()].sort((a, b) => String(a.Code).localeCompare(String(b.Code)));
}

async function loadSecTickerMap(userAgent: string): Promise<Map<string, SecTickerRow>> {
  const payload = await secJson('https://www.sec.gov/files/company_tickers.json', userAgent, 'QUALITY_VALUATION_SEC_TICKERS');
  const map = new Map<string, SecTickerRow>();
  for (const row of valuesOfObject<SecTickerRow>(payload)) {
    const ticker = String(row.ticker ?? '').trim();
    if (!ticker || !Number.isFinite(Number(row.cik_str))) continue;
    map.set(tickerKey(ticker), row);
  }
  return map;
}

function normalizedUnitRows(payload: any, taxonomy: string, tag: string, unitKind: 'USD' | 'EPS' | 'SHARES'): SecFactRow[] {
  const units = payload?.facts?.[taxonomy]?.[tag]?.units;
  if (!units || typeof units !== 'object') return [];
  const entries = Object.entries(units as Record<string, SecFactRow[]>);
  const match = entries.find(([unit]) => {
    const u = unit.toLowerCase().replace(/\s+/g, '');
    if (unitKind === 'USD') return u === 'usd';
    if (unitKind === 'SHARES') return u === 'shares';
    return u.includes('usd') && u.includes('share');
  });
  return Array.isArray(match?.[1]) ? match![1] : [];
}

function causal(row: SecFactRow): boolean {
  const filed = iso(row.filed);
  return Boolean(filed) && filed <= P.informationDate && Number.isFinite(Number(row.val));
}

function isAnnualDuration(row: SecFactRow): boolean {
  const start = Date.parse(String(row.start ?? ''));
  const end = Date.parse(String(row.end ?? ''));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  const days = (end - start) / 86_400_000;
  return days >= 250 && days <= 460;
}

function annualSeries(payload: any, tags: string[], unitKind: 'USD' | 'EPS'): AnnualFact[] {
  let best: AnnualFact[] = [];
  for (const tag of tags) {
    const rows = normalizedUnitRows(payload, 'us-gaap', tag, unitKind)
      .filter(row => causal(row)
        && P.fundamentals.acceptedAnnualForms.includes(String(row.form) as any)
        && Boolean(row.start)
        && Boolean(row.end)
        && isAnnualDuration(row));
    if (!rows.length) continue;
    const byEnd = new Map<string, SecFactRow>();
    for (const row of rows) {
      const end = iso(row.end);
      const previous = byEnd.get(end);
      if (!previous || iso(row.filed) > iso(previous.filed)) byEnd.set(end, row);
    }
    const series = [...byEnd.entries()]
      .map(([end, row]) => ({
        start: iso(row.start),
        end,
        value: Number(row.val),
        filed: iso(row.filed),
        accn: row.accn ?? null,
        tag
      }))
      .sort((a, b) => a.end.localeCompare(b.end));
    if (series.length > best.length) best = series;
  }
  return best;
}

function instantAtEnd(
  payload: any,
  taxonomy: 'us-gaap' | 'dei',
  tags: string[],
  unitKind: 'USD' | 'SHARES',
  targetEnd: string
): InstantFact | null {
  for (const tag of tags) {
    const rows = normalizedUnitRows(payload, taxonomy, tag, unitKind)
      .filter(row => causal(row) && iso(row.end) === targetEnd);
    if (!rows.length) continue;
    rows.sort((a, b) => iso(a.filed).localeCompare(iso(b.filed)));
    const row = rows.at(-1)!;
    return { end: targetEnd, value: Number(row.val), filed: iso(row.filed), accn: row.accn ?? null, tag };
  }
  return null;
}

function latestInstant(
  payload: any,
  taxonomy: 'us-gaap' | 'dei',
  tags: string[],
  unitKind: 'USD' | 'SHARES'
): InstantFact | null {
  for (const tag of tags) {
    const rows = normalizedUnitRows(payload, taxonomy, tag, unitKind)
      .filter(row => causal(row) && Boolean(row.end) && iso(row.end) <= P.informationDate)
      .sort((a, b) => {
        const byEnd = iso(a.end).localeCompare(iso(b.end));
        return byEnd !== 0 ? byEnd : iso(a.filed).localeCompare(iso(b.filed));
      });
    if (!rows.length) continue;
    const row = rows.at(-1)!;
    return { end: iso(row.end), value: Number(row.val), filed: iso(row.filed), accn: row.accn ?? null, tag };
  }
  return null;
}

function debtAtEnd(payload: any, end: string): { value: number | null; filings: string[] } {
  const total = instantAtEnd(payload, 'us-gaap', [
    'LongTermDebtAndFinanceLeaseObligations',
    'LongTermDebtAndCapitalLeaseObligations',
    'LongTermDebt'
  ], 'USD', end);
  const current = instantAtEnd(payload, 'us-gaap', [
    'LongTermDebtAndFinanceLeaseObligationsCurrent',
    'LongTermDebtAndCapitalLeaseObligationsCurrent',
    'LongTermDebtCurrent'
  ], 'USD', end);
  const noncurrent = instantAtEnd(payload, 'us-gaap', [
    'LongTermDebtAndFinanceLeaseObligationsNoncurrent',
    'LongTermDebtAndCapitalLeaseObligationsNoncurrent',
    'LongTermDebtNoncurrent'
  ], 'USD', end);
  const shortTerm = instantAtEnd(payload, 'us-gaap', [
    'ShortTermBorrowings',
    'ShortTermDebt',
    'CommercialPaper'
  ], 'USD', end);

  let longTerm: number | null = null;
  const used: InstantFact[] = [];
  if (total && total.value >= 0) {
    longTerm = total.value;
    used.push(total);
  } else if (current || noncurrent) {
    longTerm = Math.max(0, current?.value ?? 0) + Math.max(0, noncurrent?.value ?? 0);
    if (current) used.push(current);
    if (noncurrent) used.push(noncurrent);
  }
  if (longTerm == null && !shortTerm) return { value: null, filings: [] };
  if (shortTerm) used.push(shortTerm);
  return {
    value: Math.max(0, longTerm ?? 0) + Math.max(0, shortTerm?.value ?? 0),
    filings: [...new Set(used.map(row => row.filed))]
  };
}

function annualAtEnd(series: AnnualFact[], end: string): AnnualFact | null {
  return series.find(row => row.end === end) ?? null;
}

function fundamentalFromCompanyFacts(
  ticker: string,
  companyName: string,
  cik: string,
  payload: any
): FundamentalRow | null {
  const operating = annualSeries(payload, ['OperatingIncomeLoss'], 'USD');
  const netIncome = annualSeries(payload, ['NetIncomeLoss', 'ProfitLoss'], 'USD');
  const commonEnds = operating
    .map(row => row.end)
    .filter(end => netIncome.some(row => row.end === end))
    .sort();
  const annualPeriodEnd = commonEnds.at(-1);
  if (!annualPeriodEnd) return null;

  const op = annualAtEnd(operating, annualPeriodEnd);
  const ni = annualAtEnd(netIncome, annualPeriodEnd);
  if (!op || !ni || !(op.value > 0)) return null;

  const equity = instantAtEnd(payload, 'us-gaap', [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'
  ], 'USD', annualPeriodEnd);
  if (!equity || !(equity.value > 0)) return null;

  const debt = debtAtEnd(payload, annualPeriodEnd);
  const epsSeries = annualSeries(payload, [
    'EarningsPerShareDiluted',
    'EarningsPerShareDilutedIncludingExtraordinaryItems'
  ], 'EPS').filter(row => row.end <= annualPeriodEnd);
  const lastFiveEpsRows = epsSeries.slice(-5);
  const lastFiveEps = lastFiveEpsRows.length === 5 ? lastFiveEpsRows.map(row => row.value) : null;
  const earningsVariability = lastFiveEps ? epsGrowthVariability(lastFiveEps) : null;

  const shares = latestInstant(payload, 'dei', ['EntityCommonStockSharesOutstanding'], 'SHARES')
    ?? latestInstant(payload, 'us-gaap', ['CommonStockSharesOutstanding'], 'SHARES');

  const roe = ni.value / equity.value;
  const debtEquity = debt.value == null ? null : debt.value / equity.value;
  const causalFilings = [
    op.filed,
    ni.filed,
    equity.filed,
    ...debt.filings,
    ...lastFiveEpsRows.map(row => row.filed),
    ...(shares ? [shares.filed] : [])
  ].filter(Boolean);

  if (causalFilings.some(filed => filed > P.informationDate)) {
    throw new Error(`QUALITY_VALUATION_LOOKAHEAD_DETECTED:${ticker}`);
  }

  return {
    ticker,
    yahooTicker: yahooTicker(ticker),
    companyName,
    cik,
    operatingIncome: op.value,
    annualNetIncome: ni.value,
    annualPeriodEnd,
    equity: equity.value,
    totalDebt: debt.value,
    sharesOutstanding: shares?.value && shares.value > 0 ? shares.value : null,
    roe,
    debtEquity,
    earningsVariability,
    annualEpsLastFive: lastFiveEps,
    causalFilings: [...new Set(causalFilings)].sort()
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function exactClose(symbol: string, adjusted: boolean, startDate: string, endDate: string, exactDate: string): Promise<number> {
  const response = await HistoricalMarketDataService.getHistoricalBars({
    symbol,
    startDate,
    endDate,
    timeframe: '1d',
    adjusted
  }, { forceRefresh: false, maxRetries: 2 });
  if (response.provenance.sourceType !== 'REAL') throw new Error(`QUALITY_VALUATION_NON_REAL_PRICE:${symbol}`);
  const bar = response.bars.find(row => iso(row.timestamp) === exactDate);
  if (!bar?.close || !(bar.close > 0)) throw new Error(`QUALITY_VALUATION_EXACT_PRICE_MISSING:${symbol}:${exactDate}:${adjusted ? 'ADJ' : 'RAW'}`);
  return bar.close;
}

async function adjustedReturn(symbol: string): Promise<number> {
  const response = await HistoricalMarketDataService.getHistoricalBars({
    symbol,
    startDate: P.informationDate,
    endDate: OUTCOME_REQUEST_END_DATE,
    timeframe: '1d',
    adjusted: true
  }, { forceRefresh: false, maxRetries: 2 });
  if (response.provenance.sourceType !== 'REAL') throw new Error(`QUALITY_VALUATION_NON_REAL_OUTCOME:${symbol}`);
  const start = response.bars.find(row => iso(row.timestamp) === P.informationDate);
  const end = response.bars.find(row => iso(row.timestamp) === P.outcomeDate);
  if (!start?.close || !end?.close || !(start.close > 0) || !(end.close > 0)) {
    throw new Error(`QUALITY_VALUATION_OUTCOME_PRICE_MISSING:${symbol}`);
  }
  return end.close / start.close - 1;
}

function mean(values: number[]): number | null {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((s, v) => s + v, 0) / clean.length : null;
}

function pct(value: number): number {
  return value * 100;
}

function summarizeGroup(rows: OutcomeRow[], spyReturn: number, urthReturn: number) {
  const returns = rows.map(row => row.adjustedReturnPct);
  const spyExcess = rows.map(row => row.adjustedReturnPct - spyReturn);
  const urthExcess = rows.map(row => row.adjustedReturnPct - urthReturn);
  return {
    count: rows.length,
    tickers: rows.map(row => row.ticker).sort(),
    meanReturnPct: mean(returns),
    medianReturnPct: rows.length ? median(returns) : null,
    meanExcessVsSpyPctPoints: mean(spyExcess),
    medianExcessVsSpyPctPoints: rows.length ? median(spyExcess) : null,
    beatSpyCount: rows.filter(row => row.adjustedReturnPct > spyReturn).length,
    meanExcessVsUrthPctPoints: mean(urthExcess),
    medianExcessVsUrthPctPoints: rows.length ? median(urthExcess) : null,
    beatUrthCount: rows.filter(row => row.adjustedReturnPct > urthReturn).length
  };
}

function persistLocal(payload: unknown): void {
  mkdirSync(dirname(LOCAL_RECOVERY_PATH), { recursive: true });
  writeFileSync(LOCAL_RECOVERY_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function persist(payload: unknown): Promise<unknown> {
  persistLocal(payload);
  const recordedAt = new Date().toISOString();
  const durable = await saveDurableResearchValidationEvidence({
    schemaVersion: 1,
    jobId: JOB_ID,
    jobName: JOB_NAME,
    evidenceKind: 'ORIGINAL_VALIDATION',
    recordedAt,
    status: 'PASSED',
    startedAt: null,
    finishedAt: recordedAt,
    result: payload,
    note: 'Broad PIT stock-level diagnostic of the frozen fundamental Quality x valuation interaction. Diagnostic sample cannot authorize production promotion.'
  });
  return { ...(payload as any), durable };
}

async function main() {
  const seal = verifyPreRunSeal();
  const eodhdKey = requiredEnv('EODHD_API_KEY');
  const secUserAgent = requiredEnv('SEC_EDGAR_USER_AGENT');
  requiredEnv('GITHUB_REPLAY_SYNC_TOKEN');

  const members = await loadHistoricalMembers(eodhdKey);
  if (members.length < P.coverageGate.minimumHistoricalMembers) {
    const result = await persist({
      version: P.version,
      verdict: 'INCONCLUSIVE_HISTORICAL_UNIVERSE_COVERAGE',
      protocol: P,
      dataQuality: { historicalMembers: members.length, required: P.coverageGate.minimumHistoricalMembers },
      productionDefault: 'LEGACY',
      productionAuthority: false
    });
    console.log(MARKER, JSON.stringify(result));
    return;
  }

  const tickerMap = await loadSecTickerMap(secUserAgent);
  const mapped = members
    .map(member => {
      const ticker = String(member.Code ?? '').trim().toUpperCase();
      const sec = tickerMap.get(tickerKey(ticker));
      return sec ? {
        ticker,
        companyName: String(member.Name ?? sec.title ?? ticker),
        cik: String(sec.cik_str).padStart(10, '0')
      } : null;
    })
    .filter((row): row is { ticker: string; companyName: string; cik: string } => row != null);

  if (mapped.length < P.coverageGate.minimumCikMapped) {
    const result = await persist({
      version: P.version,
      verdict: 'INCONCLUSIVE_CIK_MAPPING_COVERAGE',
      protocol: P,
      dataQuality: { historicalMembers: members.length, cikMapped: mapped.length, required: P.coverageGate.minimumCikMapped },
      productionDefault: 'LEGACY',
      productionAuthority: false
    });
    console.log(MARKER, JSON.stringify(result));
    return;
  }

  const fundamentalRows: FundamentalRow[] = [];
  const exclusions: Array<{ ticker: string; stage: string; reason: string }> = [];
  for (let index = 0; index < mapped.length; index++) {
    const item = mapped[index];
    try {
      const payload = await secJson(
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${item.cik}.json`,
        secUserAgent,
        `QUALITY_VALUATION_SEC_COMPANYFACTS_${item.ticker}`
      );
      const row = fundamentalFromCompanyFacts(item.ticker, item.companyName, item.cik, payload);
      if (row) fundamentalRows.push(row);
      else exclusions.push({ ticker: item.ticker, stage: 'FUNDAMENTALS', reason: 'PROFITABILITY_OR_REQUIRED_FUNDAMENTAL_UNAVAILABLE' });
    } catch (error: any) {
      exclusions.push({ ticker: item.ticker, stage: 'SEC_FETCH', reason: error?.message || String(error) });
    }
    if ((index + 1) % 50 === 0) console.log(`QUALITY_VALUATION_SEC_PROGRESS ${index + 1}/${mapped.length}`);
  }

  const qualityInputs = fundamentalRows
    .filter(row => Number.isFinite(row.roe) && (row.debtEquity != null || row.earningsVariability != null))
    .map(row => ({
      id: row.ticker,
      roe: row.roe,
      debtEquity: row.debtEquity,
      earningsVariability: row.earningsVariability,
      earningsYield: null
    }));

  if (qualityInputs.length < P.coverageGate.minimumEvaluableProfitable) {
    const result = await persist({
      version: P.version,
      verdict: 'INCONCLUSIVE_FUNDAMENTAL_COVERAGE',
      protocol: P,
      dataQuality: {
        historicalMembers: members.length,
        cikMapped: mapped.length,
        profitableFundamentalRows: fundamentalRows.length,
        qualityEvaluable: qualityInputs.length,
        required: P.coverageGate.minimumEvaluableProfitable
      },
      exclusions,
      productionDefault: 'LEGACY',
      productionAuthority: false
    });
    console.log(MARKER, JSON.stringify(result));
    return;
  }

  const scored = scoreQualityCrossSection(qualityInputs);
  const qualityMedian = median(scored.map(row => row.qualityScore));
  const highQualityIds = new Set(scored.filter(row => row.qualityScore >= qualityMedian).map(row => row.id));
  if (highQualityIds.size < P.coverageGate.minimumHighQuality) {
    throw new Error(`QUALITY_VALUATION_HIGH_QUALITY_COVERAGE_TOO_SMALL:${highQualityIds.size}`);
  }

  let server: ReturnType<typeof spawn> | null = null;
  let ownsServer = false;
  if (!(await waitForHealth(`${BASE_URL}/api/health`, 1500))) {
    server = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, DISABLE_HMR: 'true' }
    });
    ownsServer = true;
    if (!(await waitForHealth(`${BASE_URL}/api/health`, 30_000))) throw new Error('QUALITY_VALUATION_LOCAL_SERVER_UNAVAILABLE');
  }

  try {
    const registry = new MarketDataProviderRegistry();
    registry.register(new RealMarketDataProvider(`${BASE_URL}/api/market-data/history`));
    registry.setDefaultProvider('yahoo_finance');
    HistoricalMarketDataService.setRegistry(registry);

    const fundamentalByTicker = new Map(fundamentalRows.map(row => [row.ticker, row] as const));
    const highQualityScored = scored.filter(row => highQualityIds.has(row.id));
    const withValuation = await mapLimit(highQualityScored, 4, async row => {
      const fundamental = fundamentalByTicker.get(row.id)!;
      if (!(fundamental.sharesOutstanding && fundamental.sharesOutstanding > 0)) {
        exclusions.push({ ticker: row.id, stage: 'VALUATION', reason: 'CAUSAL_SHARES_OUTSTANDING_UNAVAILABLE' });
        return { ...row, earningsYield: null, rawPriceAtInformationDate: null as number | null };
      }
      try {
        const raw = await exactClose(
          fundamental.yahooTicker,
          false,
          P.informationDate,
          INFO_PRICE_END_DATE,
          P.informationDate
        );
        const marketCap = raw * fundamental.sharesOutstanding;
        if (!(marketCap > 0)) throw new Error('NON_POSITIVE_MARKET_CAP');
        return {
          ...row,
          earningsYield: fundamental.annualNetIncome / marketCap,
          rawPriceAtInformationDate: raw
        };
      } catch (error: any) {
        exclusions.push({ ticker: row.id, stage: 'VALUATION_PRICE', reason: error?.message || String(error) });
        return { ...row, earningsYield: null, rawPriceAtInformationDate: null as number | null };
      }
    });

    const scoredWithValuation: QualityScored[] = scored.map(row => {
      const enriched = withValuation.find(item => item.id === row.id);
      return enriched ? { ...row, earningsYield: enriched.earningsYield } : row;
    });
    const split = splitHighQualityByValuation(scoredWithValuation);

    if (
      split.cheapReasonable.length < P.coverageGate.minimumPerValuationBranch
      || split.expensive.length < P.coverageGate.minimumPerValuationBranch
    ) {
      const result = await persist({
        version: P.version,
        verdict: 'INCONCLUSIVE_VALUATION_COVERAGE',
        protocol: P,
        dataQuality: {
          historicalMembers: members.length,
          cikMapped: mapped.length,
          profitableFundamentalRows: fundamentalRows.length,
          qualityEvaluable: scored.length,
          highQuality: split.highQuality.length,
          highQualityWithValuation: split.cheapReasonable.length + split.expensive.length,
          cheapReasonable: split.cheapReasonable.length,
          expensive: split.expensive.length,
          minimumPerValuationBranch: P.coverageGate.minimumPerValuationBranch
        },
        exclusions,
        productionDefault: 'LEGACY',
        productionAuthority: false
      });
      console.log(MARKER, JSON.stringify(result));
      return;
    }

    const spyReturn = pct(await adjustedReturn(P.outcomes.primaryBenchmark));
    const urthReturn = pct(await adjustedReturn(P.outcomes.secondaryStructuralCoreProxy));
    const branchByTicker = new Map<string, 'CHEAP_OR_REASONABLE' | 'EXPENSIVE'>();
    split.cheapReasonable.forEach(row => branchByTicker.set(row.id, 'CHEAP_OR_REASONABLE'));
    split.expensive.forEach(row => branchByTicker.set(row.id, 'EXPENSIVE'));

    const outcomeRowsRaw = await mapLimit(
      [...split.cheapReasonable, ...split.expensive],
      4,
      async row => {
        const fundamental = fundamentalByTicker.get(row.id)!;
        const enriched = withValuation.find(item => item.id === row.id);
        try {
          const ret = pct(await adjustedReturn(fundamental.yahooTicker));
          return {
            ticker: row.id,
            yahooTicker: fundamental.yahooTicker,
            companyName: fundamental.companyName,
            cik: fundamental.cik,
            qualityScore: row.qualityScore,
            roe: row.roe,
            debtEquity: row.debtEquity,
            earningsVariability: row.earningsVariability,
            earningsYield: row.earningsYield as number,
            rawPriceAtInformationDate: enriched?.rawPriceAtInformationDate as number,
            adjustedReturnPct: ret,
            excessVsSpyPctPoints: ret - spyReturn,
            excessVsUrthPctPoints: ret - urthReturn
          } satisfies OutcomeRow;
        } catch (error: any) {
          exclusions.push({ ticker: row.id, stage: 'OUTCOME_PRICE', reason: error?.message || String(error) });
          return null;
        }
      }
    );
    const outcomeRows = outcomeRowsRaw.filter((row): row is OutcomeRow => row != null);
    const cheapRows = outcomeRows.filter(row => branchByTicker.get(row.ticker) === 'CHEAP_OR_REASONABLE');
    const expensiveRows = outcomeRows.filter(row => branchByTicker.get(row.ticker) === 'EXPENSIVE');

    if (
      cheapRows.length < P.coverageGate.minimumPerValuationBranch
      || expensiveRows.length < P.coverageGate.minimumPerValuationBranch
    ) {
      const result = await persist({
        version: P.version,
        verdict: 'INCONCLUSIVE_OUTCOME_COVERAGE',
        protocol: P,
        dataQuality: {
          cheapReasonableWithOutcomes: cheapRows.length,
          expensiveWithOutcomes: expensiveRows.length,
          minimumPerValuationBranch: P.coverageGate.minimumPerValuationBranch
        },
        exclusions,
        productionDefault: 'LEGACY',
        productionAuthority: false
      });
      console.log(MARKER, JSON.stringify(result));
      return;
    }

    const cheap = summarizeGroup(cheapRows, spyReturn, urthReturn);
    const expensive = summarizeGroup(expensiveRows, spyReturn, urthReturn);
    const interaction = {
      meanReturnDeltaCheapMinusExpensivePctPoints:
        (cheap.meanReturnPct as number) - (expensive.meanReturnPct as number),
      meanExcessVsSpyDeltaPctPoints:
        (cheap.meanExcessVsSpyPctPoints as number) - (expensive.meanExcessVsSpyPctPoints as number),
      meanExcessVsUrthDeltaPctPoints:
        (cheap.meanExcessVsUrthPctPoints as number) - (expensive.meanExcessVsUrthPctPoints as number),
      cheapPositiveVsSpy: (cheap.meanExcessVsSpyPctPoints as number) > 0,
      cheapPositiveVsUrth: (cheap.meanExcessVsUrthPctPoints as number) > 0,
      expensiveNegativeVsSpy: (expensive.meanExcessVsSpyPctPoints as number) < 0,
      expensiveNegativeVsUrth: (expensive.meanExcessVsUrthPctPoints as number) < 0
    };
    const directionalConfirmation =
      interaction.meanReturnDeltaCheapMinusExpensivePctPoints > 0
      && interaction.cheapPositiveVsSpy
      && interaction.cheapPositiveVsUrth
      && interaction.expensiveNegativeVsSpy
      && interaction.expensiveNegativeVsUrth;

    const resultCore = {
      version: P.version,
      generatedAt: new Date().toISOString(),
      verdict: directionalConfirmation
        ? 'BROAD_PIT_DIRECTIONAL_CONFIRMATION_SUPPORTS_QUALITY_X_VALUATION'
        : 'BROAD_PIT_DOES_NOT_CONFIRM_QUALITY_X_VALUATION',
      protocol: P,
      seal: { version: seal.version, frozenAt: seal.frozenAt, sampleRole: seal.sampleRole },
      productionDefault: 'LEGACY',
      productionAuthority: false,
      promotionAllowedFromThisResult: false,
      benchmarks: {
        SPY: { returnPct: spyReturn, role: 'US_PARENT_BENCHMARK' },
        URTH: { returnPct: urthReturn, role: 'USD_MSCI_WORLD_STRUCTURAL_CORE_PROXY' }
      },
      dataQuality: {
        historicalMembers: members.length,
        cikMapped: mapped.length,
        profitableFundamentalRows: fundamentalRows.length,
        qualityEvaluable: scored.length,
        highQuality: split.highQuality.length,
        highQualityWithValuation: split.cheapReasonable.length + split.expensive.length,
        cheapReasonableWithOutcomes: cheapRows.length,
        expensiveWithOutcomes: expensiveRows.length,
        allFundamentalFilingsAtOrBeforeInformationDate: fundamentalRows.every(row => row.causalFilings.every(date => date <= P.informationDate)),
        currentDiscoveryUsed: false,
        syntheticDataUsed: false
      },
      thresholds: {
        qualityMedian: split.qualityMedian,
        highQualityEarningsYieldMedian: split.valuationMedian
      },
      groups: { cheapReasonable: cheap, expensive },
      interaction,
      rows: outcomeRows.map(row => ({
        ...row,
        valuationBranch: branchByTicker.get(row.ticker),
        annualPeriodEnd: fundamentalByTicker.get(row.ticker)?.annualPeriodEnd ?? null,
        causalFilings: fundamentalByTicker.get(row.ticker)?.causalFilings ?? []
      })),
      exclusions,
      interpretationContract: {
        broadHistoricalDiagnosticOnly: true,
        noProductionPromotion: true,
        noThresholdRetuningOnThisSample: true,
        qualityFormulaFrozenBeforeOutcomeRead: true,
        valuationDefinitionFrozenBeforeOutcomeRead: true,
        benchmarkSelectionFrozenBeforeOutcomeRead: true,
        nextIfPositive: 'FREEZE_RESEARCH_ONLY_PROJECT_TRANSLATION_THEN_USE_FRESH_BLIND_CONFIRMATION',
        nextIfNegative: 'DO_NOT_RETUNE_ON_THIS_SAMPLE; ARCHIVE_OR_DESIGN_MATERIALLY_DISTINCT_HYPOTHESIS'
      },
      sourceNotes: [
        'Historical membership: EODHD S&P 500 historical components, filtered at 2021-05-03.',
        'Fundamentals: SEC EDGAR companyfacts, every selected fact constrained to filed <= 2021-05-03.',
        'Prices/outcomes: Yahoo Finance REAL path already used by Custodia; current Yahoo discovery is not used.',
        'SEC causal earnings yield is a provider-independent translation of the same valuation concept, not a reproduction of Wolfram historical EarningsYield.'
      ]
    };

    const result = await persist(resultCore);
    console.log(MARKER, JSON.stringify(result));
  } finally {
    if (ownsServer && server) server.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error('FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1_FATAL', error);
  process.exit(1);
});
