import assert from 'node:assert/strict';
import { parseYahooPayload, assertIdentity, nextDay } from '../scripts/sector52WeekHighLeadershipV1YahooInput.mjs';

const ts1=Math.floor(Date.parse('2024-01-02T21:00:00Z')/1000),ts2=Math.floor(Date.parse('2024-01-03T21:00:00Z')/1000);
const payload={chart:{result:[{
  meta:{symbol:'XLK',currency:'USD',exchangeName:'PCX',instrumentType:'ETF',firstTradeDate:Math.floor(Date.parse('1998-12-22T00:00:00Z')/1000),timezone:'America/New_York'},
  timestamp:[ts1,ts2],
  indicators:{quote:[{open:[100,102],close:[101,103]}],adjclose:[{adjclose:[50.5,51.5]}]},
  events:{splits:{a:{date:ts2,numerator:2,denominator:1}},dividends:{}}
}],error:null}};
const text=JSON.stringify(payload),parsed=parseYahooPayload('XLK',text);
assert.equal(parsed.bars.length,2);
assert.ok(Math.abs(parsed.bars[0].open-50)<1e-12);
assert.equal(parsed.bars[0].close,50.5);
assert.equal(parsed.meta.rawEventCounts.splits,1);
assert.doesNotThrow(()=>assertIdentity('XLK',parsed.meta));
assert.throws(()=>assertIdentity('XLE',{...parsed.meta,symbol:'XLK'}),/IDENTITY/);
assert.throws(()=>assertIdentity('XLK',{...parsed.meta,currency:'EUR'}),/NON_USD/);
assert.equal(nextDay('2026-01-07'),'2026-01-08');
console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_YAHOO_INPUT_PASS');
