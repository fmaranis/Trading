import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SNAPSHOT_PATH = 'validation-runs/preregistration/fundamental-quality-future-forward-v1-snapshot.json';
export const SNAPSHOT_SHA256 = '06ad777b20970fe8c957d9febe8ccadcbcc75ecbf08cc870cd600236488ab2f2';
export const SEAL_PATH = 'validation-runs/preregistration/fundamental-quality-future-forward-v1-infrastructure-seal.json';
export const STUDY = 'FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1';
export const AUTHORITY = Object.freeze({ productionDefault: 'LEGACY', productionAuthority: false, promotionAllowed: false });
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
export const fingerprint = value => sha256(canonical(value));
export const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
export const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
export const almostEqual = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
export function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
export function loadSnapshot(bytes = readFileSync(resolve(ROOT, SNAPSHOT_PATH))) {
  requireThat(sha256(bytes) === SNAPSHOT_SHA256, 'SNAPSHOT_FINGERPRINT_MISMATCH');
  const s = JSON.parse(bytes);
  requireThat(s.study === STUDY && s.snapshotDate === '2026-09-27', 'SNAPSHOT_STUDY');
  requireThat(s.productionDefault === 'LEGACY' && s.productionAuthority === false && s.outcome.outcomeOpened === false, 'SNAPSHOT_AUTHORITY_OR_OUTCOMES');
  requireThat(s.selected.length === 100 && s.counts.evaluable === 347 && s.counts.members === 500, 'SNAPSHOT_COUNTS');
  const issuers = new Map();
  const symbols = new Set(); const providerSymbols = new Set();
  for (const row of s.selected) {
    requireThat(positive(row.weight) && row.symbol && row.issuerKey && !symbols.has(row.symbol), 'SNAPSHOT_SYMBOL_OR_WEIGHT');
    requireThat(row.symbol.split(':').at(-1) === row.ticker, 'SNAPSHOT_TICKER_IDENTITY');
    symbols.add(row.symbol); providerSymbols.add(providerSymbol(row.symbol));
    issuers.set(row.issuerKey, (issuers.get(row.issuerKey) ?? 0) + row.weight);
  }
  requireThat(issuers.size === 99 && providerSymbols.size === 100, 'SNAPSHOT_ISSUER_OR_ALIAS_COUNT');
  requireThat(Math.abs(s.selected.reduce((a,r)=>a+r.weight,0)-1) < 1e-10, 'SNAPSHOT_WEIGHT_SUM');
  requireThat([...issuers.values()].every(w=>w <= .05+1e-10), 'SNAPSHOT_ISSUER_CAP');
  return deepFreeze(s);
}
export function providerSymbol(symbol) {
  requireThat(/^(?:(?:NASDAQ|NYSE|AMEX):)?[A-Z0-9]+(?:[.-][A-Z0-9]+)?$/.test(symbol), 'UNSUPPORTED_SYMBOL');
  return symbol.split(':').at(-1).replace(/\./g, '-');
}
export const requiredSymbols = snapshot => [...snapshot.selected.map(r=>r.symbol), 'SPY','URTH'];
export function verifyInfrastructureSeal() {
  const seal = JSON.parse(readFileSync(resolve(ROOT, SEAL_PATH), 'utf8'));
  requireThat(seal.study === STUDY && seal.snapshotSha256 === SNAPSHOT_SHA256 && seal.outcomesState === 'UNOPENED'
    && seal.productionDefault === 'LEGACY' && seal.productionAuthority === false, 'INFRASTRUCTURE_SEAL_INVALID');
  for (const [path, expected] of Object.entries(seal.filesSha256)) {
    requireThat(sha256(readFileSync(resolve(ROOT,path))) === expected, `INFRASTRUCTURE_SEAL_MISMATCH:${path}`);
  }
  loadSnapshot(); return seal;
}

// Official scheduled NYSE cash-equity closures, announcement 2025-12-23. Exceptional closures BLOCK.
const holidays = new Set(['2026-11-26','2026-12-25','2027-01-01','2027-01-18','2027-02-15',
  '2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24']);
const early = new Set(['2026-11-27','2026-12-24','2027-11-26']);
export function validDate(date) {
  requireThat(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(date+'T00:00:00Z').toISOString().slice(0,10) === date, 'INVALID_DATE'); return date;
}
export function addDays(date, n) { validDate(date); return new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10); }
export function isSession(date) {
  validDate(date); requireThat(date >= '2026-09-28' && date <= '2027-12-31', 'CALENDAR_OUTSIDE_FROZEN_COVERAGE');
  const d = new Date(date+'T12:00:00Z').getUTCDay(); return d !== 0 && d !== 6 && !holidays.has(date);
}
function nyTimestamp(date, time) {
  const name = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'})
    .formatToParts(new Date(date+'T12:00:00Z')).find(p=>p.type==='timeZoneName').value;
  const hours = Number(name.replace('GMT','')); requireThat(hours===-4 || hours===-5,'TIMEZONE_UNSUPPORTED');
  return Date.parse(date+'T'+time+':00Z') - hours*3600000;
}
export const sessionOpen = date => nyTimestamp(date,'09:30');
export const sessionClose = date => nyTimestamp(date,early.has(date)?'13:00':'16:00');
// Conservative availability: 22:00 UTC, after regular cash close in either DST regime.
export const availableAt = date => Date.parse(validDate(date)+'T22:00:00Z');
export function completed(date, now) { return isSession(date) && Number.isFinite(Date.parse(now)) && Date.parse(now)>=availableAt(date); }
export function sessionsBetween(from,to) {
  const dates=[]; for(let d=from;d<=to;d=addDays(d,1)) if(isSession(d)) dates.push(d); return dates;
}
export function checkpointDate(start,months) {
  requireThat([3,6,12].includes(months),'UNFROZEN_HORIZON'); validDate(start);
  const [y,m,d]=start.split('-').map(Number);
  const first=new Date(Date.UTC(y,m-1+months,1));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  let date=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d,last))).toISOString().slice(0,10);
  while(!isSession(date)) date=addDays(date,1); return date;
}
export function adjustedOpen(bar) {
  requireThat(bar && [bar.open,bar.close,bar.adjustedClose].every(positive),'INVALID_ADJUSTED_OPEN');
  return bar.open*bar.adjustedClose/bar.close;
}
export function sealEvidence(payload) { return { schemaVersion:1, sha256:fingerprint(payload), payload }; }
export function unsealEvidence(envelope) {
  requireThat(envelope?.schemaVersion===1 && envelope.sha256===fingerprint(envelope.payload),'EVIDENCE_HASH_MISMATCH');
  return envelope.payload;
}
