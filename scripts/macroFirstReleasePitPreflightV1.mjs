import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const STUDY = 'MACRO_FIRST_RELEASE_PIT_PREFLIGHT_V1';
export const MARKER = 'MACRO_FIRST_RELEASE_PIT_PREFLIGHT_V1_RESULT';
export const OUTPUT_DIR = '.runtime/macro-first-release-pit-v1';

// Fixed documentary sample, NOT a trading strategy or an extensible live feed.
export const SOURCES = Object.freeze({
  hicp: {
    url: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_fpd?geo=EA21&freq=M&unit=RCH_A&sinceTimePeriod=2026-09&untilTimePeriod=2026-09&lang=EN',
    period: '2026-09', releaseDate: '2026-10-16', earliestDecisionDate: '2026-10-19', expectedAnnualRate: 3.8,
    releaseEvidence: 'https://ec.europa.eu/eurostat/en/web/products-euro-indicators/w/2-16102026-ap'
  },
  spf: {
    url: 'https://www.ecb.europa.eu/press/pr/date/2022/html/ecb.pr220722~3bb7720d07.en.html',
    round: '2022Q3', target: '2023', releaseDate: '2022-07-22', earliestDecisionDate: '2022-07-25'
  },
  yc: {
    url: 'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?startPeriod=2022-07-18&endPeriod=2022-07-22&format=csvdata',
    series: 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y', period: '2022-07-22', earliestDecisionDate: '2022-07-25'
  }
});

function requireData(condition, reason) { if (!condition) throw new Error(`MACRO_PIT_${reason}`); }
function indexEntries(dim) {
  const i = dim?.category?.index;
  requireData(i && typeof i === 'object', 'DIMENSION_INDEX_MISSING');
  if (Array.isArray(i)) return i.map((code, offset) => [String(code), offset]);
  return Object.entries(i);
}
function dimensionCode(dim, pos) {
  const found = indexEntries(dim).find(([, i]) => i === pos);
  requireData(Boolean(found), 'DIMENSION_POSITION_NOT_FOUND');
  return found[0];
}

export function parseEurostatFirstRelease(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('MACRO_PIT_EUROSTAT_NOT_JSON'); }
  requireData(d?.class === 'dataset' && Array.isArray(d.id) && Array.isArray(d.size) && d.id.length === d.size.length,
    'EUROSTAT_JSONSTAT_SCHEMA');
  for (const id of ['geo', 'freq', 'unit', 'release', 'time']) {
    requireData(d.id.includes(id) && d.dimension?.[id], 'EUROSTAT_DIMENSION_' + id);
  }
  const matches = [];
  const entries = Array.isArray(d.value) ? d.value.entries() : Object.entries(d.value ?? {});
  for (const [rawI, rawValue] of entries) {
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    let linear = Number(rawI);
    requireData(Number.isSafeInteger(linear) && linear >= 0, 'EUROSTAT_INDEX');
    const keys = {};
    for (let i = d.id.length - 1; i >= 0; i--) {
      const size = d.size[i];
      requireData(Number.isSafeInteger(size) && size > 0, 'EUROSTAT_SIZE');
      const offset = linear % size;
      linear = Math.floor(linear / size);
      keys[d.id[i]] = dimensionCode(d.dimension[d.id[i]], offset);
    }
    requireData(linear === 0, 'EUROSTAT_OVERFLOW');
    if (keys.geo !== 'EA21' || keys.freq !== 'M' || keys.unit !== 'RCH_A' || keys.time !== '2026-09') continue;
    const releaseLabel = d.dimension.release.category.label?.[keys.release] ?? keys.release;
    if (!/^final$/i.test(String(releaseLabel).trim())) continue;
    const classDim = d.id.find(k => k !== 'geo' && k !== 'freq' && k !== 'unit' && k !== 'release' && k !== 'time');
    requireData(Boolean(classDim), 'EUROSTAT_CLASSIFICATION_MISSING');
    const classCode = keys[classDim];
    const classLabel = d.dimension[classDim]?.category?.label?.[classCode] ?? classCode;
    if (!(classCode === 'CP00' || /^(total|all.items(?: hicp)?)$/i.test(String(classLabel).trim()))) continue;
    const value = Number(rawValue);
    requireData(Number.isFinite(value), 'EUROSTAT_VALUE_INVALID');
    matches.push({ value, dimensionCodes: keys });
  }
  requireData(matches.length === 1, `EUROSTAT_AMBIGUOUS_OR_MISSING_${matches.length}`);
  requireData(Math.abs(matches[0].value - SOURCES.hicp.expectedAnnualRate) < 1e-9, 'EUROSTAT_INDEPENDENT_RELEASE_MISMATCH');
  return {
    provider: 'EUROSTAT', series: 'prc_hicp_fpd', sourceRole: 'HICP_FIRST_PUBLISHED_FULL',
    provenance: 'REAL', observationPeriod: SOURCES.hicp.period,
    originalReleaseDate: SOURCES.hicp.releaseDate, earliestDecisionDate: SOURCES.hicp.earliestDecisionDate,
    value: matches[0].value, unit: 'annual_percent', sourceURL: SOURCES.hicp.url,
    releaseEvidence: SOURCES.hicp.releaseEvidence, dimensionCodes: matches[0].dimensionCodes
  };
}

function readableHtml(html) {
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
export function parseEcbSpfPress(html) {
  const text = readableHtml(html);
  requireData(/Results of the ECB Survey of Professional Forecasters for the third quarter of 2022/i.test(text), 'SPF_TITLE');
  requireData(text.includes('22 July 2022'), 'SPF_RELEASE_DATE');
  const infl = text.match(/For 2022, 2023 and 2024, these stand at\s*([\d.]+)%,\s*([\d.]+)%\s+and\s*([\d.]+)%/i);
  requireData(Boolean(infl), 'SPF_INFLATION_ROW');
  // The table, not the prose, identifies GDP 2023 on the same horizon.
  const gdp = text.match(/Real GDP growth\s+Q3 2022 SPF\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  requireData(Boolean(gdp), 'SPF_GDP_ROW');
  requireData(Number(infl[2]) === 3.6 && Number(gdp[2]) === 1.5, 'SPF_RELEASE_ANCHOR_MISMATCH');
  return {
    provider: 'ECB', series: 'SPF_2022Q3_RELEASE', sourceRole: 'SPF_QUARTERLY_FORECAST',
    provenance: 'REAL', surveyRound: SOURCES.spf.round, forecastTargetPeriod: SOURCES.spf.target,
    originalReleaseDate: SOURCES.spf.releaseDate, earliestDecisionDate: SOURCES.spf.earliestDecisionDate,
    inflationForecast: Number(infl[2]), gdpForecast: Number(gdp[2]), unit: 'annual_percent', sourceURL: SOURCES.spf.url
  };
}

function csvLine(s) {
  const cells = []; let cell = '', quote = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') { if (quote && s[i + 1] === '"') { cell += '"'; i++; } else quote = !quote; }
    else if (c === ',' && !quote) { cells.push(cell); cell = ''; }
    else cell += c;
  }
  requireData(!quote, 'ECB_CSV_BAD_QUOTE');
  cells.push(cell);
  return cells;
}
export function parseEcbYieldCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  requireData(lines.length >= 2, 'YC_CSV_EMPTY');
  const header = csvLine(lines[0]);
  const dateColumn = header.indexOf('TIME_PERIOD'), valueColumn = header.indexOf('OBS_VALUE');
  const keyColumn = header.indexOf('KEY');
  requireData(dateColumn >= 0 && valueColumn >= 0 && keyColumn >= 0, 'YC_CSV_COLUMNS');
  const entries = lines.slice(1).map(csvLine).filter(x => x[dateColumn] === SOURCES.yc.period);
  requireData(entries.length === 1, `YC_DATE_MISSING_OR_AMBIGUOUS_${entries.length}`);
  const row = entries[0];
  requireData(row[keyColumn] === SOURCES.yc.series, 'YC_WRONG_SERIES');
  const value = Number(row[valueColumn]);
  requireData(String(row[valueColumn]).trim() !== '' && Number.isFinite(value), 'YC_INVALID_YIELD');
  return {
    provider: 'ECB', series: SOURCES.yc.series, sourceRole: 'ECB_YC_ESTIMATED_CURVE',
    provenance: 'REAL', observationPeriod: SOURCES.yc.period,
    earliestDecisionDate: SOURCES.yc.earliestDecisionDate, value, unit: 'percent_per_annum',
    sourceURL: SOURCES.yc.url, executableQuote: false
  };
}

export function enforceInformationDate(observation, decisionDate) {
  requireData(/^\d{4}-\d{2}-\d{2}$/.test(decisionDate), 'INVALID_DECISION_DATE');
  requireData(decisionDate >= observation.earliestDecisionDate, 'LOOKAHEAD_' + observation.provider);
  return true;
}

async function fetchOfficialText(url, fetchImpl) {
  const u = new URL(url);
  requireData((u.protocol === 'https:' && ['ec.europa.eu', 'www.ecb.europa.eu', 'data-api.ecb.europa.eu'].includes(u.hostname)), 'HOST_NOT_OFFICIAL');
  const response = await fetchImpl(url, { headers: { Accept: 'text/csv, text/html, application/json' }, signal: AbortSignal.timeout(15000) });
  requireData(response.ok, 'HTTP_' + response.status);
  const body = await response.text();
  requireData(body.length > 30 && body.length < 4_000_000, 'RESPONSE_SIZE');
  return body;
}
export async function runMacroPitPreflight({ fetchImpl = fetch, save = false, now = () => new Date().toISOString() } = {}) {
  const text = {};
  for (const role of ['hicp', 'spf', 'yc']) text[role] = await fetchOfficialText(SOURCES[role].url, fetchImpl);
  const observations = [parseEurostatFirstRelease(text.hicp), parseEcbSpfPress(text.spf), parseEcbYieldCsv(text.yc)];
  for (const observation of observations) {
    enforceInformationDate(observation, observation.earliestDecisionDate);
    const oneDayEarly = new Date(Date.parse(observation.earliestDecisionDate + 'T00:00:00Z') - 86400000).toISOString().slice(0,10);
    requireData(oneDayEarly < observation.earliestDecisionDate, 'EARLIEST_DATE_ORDER');
  }
  const capture = Object.fromEntries(Object.entries(text).map(([role, raw]) => [role, {
    url: SOURCES[role].url, sha256: crypto.createHash('sha256').update(raw).digest('hex'), length: Buffer.byteLength(raw)
  }]));
  const result = { study: STUDY, status: 'PASS_SOURCE_PARSER_ONLY', capturedAt: now(),
    provenance: 'REAL', capture, observations, productionAuthority: false, economicOutcomesCalculated: false,
    historicalTradingAuthority: false, policyFrozen: false,
    limitations: ['Eurostat release date anchored to official press release; API does not supply per-observation publication timestamp',
      'ECB SPF press page is documentary source, not a tradable surprise series',
      'ECB YC zero-coupon model curve is estimated, not ETF bid/ask or historical exact publication timestamp',
      'The checked historical periods are already consumed for economic policy promotion'] };
  if (save) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const [role, raw] of Object.entries(text)) {
      const rawFile = path.join(OUTPUT_DIR, `${role}-${capture[role].sha256}.raw`);
      if (fs.existsSync(rawFile)) {
        requireData(crypto.createHash('sha256').update(fs.readFileSync(rawFile)).digest('hex') === capture[role].sha256, 'CACHE_CONFLICT');
      } else fs.writeFileSync(rawFile, raw, { flag: 'wx' });
    }
    const record = path.join(OUTPUT_DIR, `preflight-${result.capturedAt.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(record, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runMacroPitPreflight({ save: true }).then(r => {
    console.log(MARKER, JSON.stringify({ status: r.status, capture: r.capture, observations: r.observations, productionAuthority: false }));
  }).catch(e => { console.error(MARKER, JSON.stringify({ status: 'BLOCKED', reason: e?.message ?? String(e), productionAuthority: false })); process.exitCode = 1; });
}
