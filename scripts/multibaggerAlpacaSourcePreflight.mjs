// One-off research source diagnostic. No orders, no persistence, no backtest.
import assert from 'node:assert/strict';
const cases = [
  { id: 'active_control', symbol: 'AAPL', asof: '2017-12-29', start: '2017-01-01', end: '2017-12-31', actionEnd: '2017-12-31' },
  { id: 'cash_acquisition', symbol: 'TWTR', asof: '2022-10-27', start: '2022-01-01', end: '2022-11-30', actionEnd: '2023-01-31' },
  { id: 'bank_suspension', symbol: 'SIVB', asof: '2023-03-09', start: '2022-03-01', end: '2023-04-30', actionEnd: '2024-12-31' },
  { id: 'bankruptcy', symbol: 'BBBY', asof: '2023-04-28', start: '2022-04-01', end: '2023-05-31', actionEnd: '2024-12-31' },
  { id: 'rename', symbol: 'META', asof: '2022-12-30', start: '2022-01-01', end: '2022-12-31', actionEnd: '2022-12-31' }
];
function inspectBars(bars) {
  if (!Array.isArray(bars)) return { valid: false, count: 0 };
  const valid = bars.length > 0 && bars.every((b,i) => typeof b.t === 'string' &&
    Number.isFinite(Date.parse(b.t)) && (!i || Date.parse(b.t) > Date.parse(bars[i-1].t)) &&
    [b.o,b.h,b.l,b.c].every(v => Number.isFinite(v) && v > 0) &&
    Number.isFinite(b.v) && b.v >= 0 &&
    b.l <= Math.min(b.o,b.c) && b.h >= Math.max(b.o,b.c));
  return { valid, count: bars.length, first: bars[0]?.t ?? null, last: bars.at(-1)?.t ?? null };
}
function inspectActions(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !payload.corporate_actions || typeof payload.corporate_actions !== 'object' ||
      Array.isArray(payload.corporate_actions)) return { valid: false, types: {} };
  const entries = Object.entries(payload.corporate_actions);
  return { valid: entries.every(([,v]) => Array.isArray(v)),
    types: Object.fromEntries(entries.map(([k,v]) => [k, Array.isArray(v) ? v.length : null])) };
}
function selfTest() {
  const b={t:'2017-01-03T05:00:00Z',o:10,h:11,l:9,c:10,v:50};
  assert.equal(inspectBars([b]).valid,true);
  assert.equal(inspectBars([]).valid,false);
  assert.equal(inspectBars([b,b]).valid,false);
  assert.equal(inspectBars([{...b,h:9}]).valid,false);
  assert.equal(inspectActions({corporate_actions:{cash_mergers:[{}]}}).types.cash_mergers,1);
  assert.equal(inspectActions({}).valid,false);
  assert.equal(inspectActions({corporate_actions:{cash_mergers:null}}).valid,false);
  console.log('ALPACA_PREFLIGHT_SELF_TEST_PASS');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const key = process.env.APCA_API_KEY_ID?.trim();
  const secret = process.env.APCA_API_SECRET_KEY?.trim();
  if (!key || !secret) {
    console.log(JSON.stringify({status:'BLOCKED_CREDENTIALS',sourceApproved:false}));
    process.exitCode=2; return;
  }
  async function get(path,params) {
    const u = new URL(path,'https://data.alpaca.markets');
    u.search = new URLSearchParams(params).toString();
    try {
      const response = await fetch(u,{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
      if (!response.ok) return {http:response.status};
      try { return {http:response.status,data:await response.json()}; }
      catch { return {http:response.status,error:'INVALID_JSON'}; }
    } catch { return {http:null,error:'NETWORK_OR_TIMEOUT'}; }
  }
  const rows=[];
  for (const c of cases) {
    const bars=await get('/v2/stocks/'+encodeURIComponent(c.symbol)+'/bars',
      {timeframe:'1Day',feed:'sip',adjustment:'raw',asof:c.asof,start:c.start,end:c.end,limit:'10000'});
    const actions=await get('/v1/corporate-actions',
      {symbols:c.symbol,start:c.start,end:c.actionEnd,data_quality:'all',limit:'1000'});
    rows.push({id:c.id,symbol:c.symbol,asof:c.asof,barsHttp:bars.http,barsError:bars.error??null,
      ...inspectBars(bars.data?.bars),barsTruncated:Boolean(bars.data?.next_page_token),
      actionsHttp:actions.http,actionsError:actions.error??null,
      actions:inspectActions(actions.data),actionsTruncated:Boolean(actions.data?.next_page_token)});
  }
  const complete=rows.every(r=>r.barsHttp===200&&r.valid&&!r.barsTruncated&&r.actionsHttp===200&&r.actions.valid&&!r.actionsTruncated);
  console.log(JSON.stringify({status:complete?'ENDPOINT_SHAPES_AVAILABLE_NOT_PIT_CERTIFIED':'INCOMPLETE_SOURCE_PREFLIGHT',
    sourceApproved:false,terminalPaymentsVerified:false,universeCoverageVerified:false,
    productionAuthority:false,rows},null,2));
  if (!complete) process.exitCode=1;
}
main().catch(()=>{console.error('ALPACA_PREFLIGHT_UNEXPECTED_ERROR');process.exitCode=1});
