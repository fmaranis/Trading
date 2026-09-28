import assert from 'node:assert/strict';
import { cagrPct, reconcileRow, OFFICIAL } from '../scripts/sector52WeekHighLeadershipV1YahooNavAudit.mjs';

const start=100;
const target=OFFICIAL.XLF.nav;
const end=start*Math.pow(1+target/100,10);
assert.ok(Math.abs(cagrPct(start,end,10)-target)<1e-10);
const pass=reconcileRow('XLF',start,end);
assert.equal(pass.pass,true);
const fail=reconcileRow('XLF',start,start*Math.pow(1+(target+0.25)/100,10));
assert.equal(fail.pass,false);
assert.throws(()=>reconcileRow('ZZZ',100,200),/REFERENCE_MISSING/);
console.log('SECTOR_52W_HIGH_LEADERSHIP_V1_NAV_AUDIT_UNIT_PASS');
