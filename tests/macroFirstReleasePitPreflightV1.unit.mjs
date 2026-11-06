import assert from 'node:assert/strict';
import {
  STUDY, SOURCES, parseEurostatFirstRelease, parseEcbSpfPress, parseEcbYieldCsv,
  enforceInformationDate, runMacroPitPreflight
} from '../scripts/macroFirstReleasePitPreflightV1.mjs';

function eurostatFixture(value = 3.8, override = {}) {
  return JSON.stringify({
    class: 'dataset', id: ['freq','unit','coicop18','release','geo','time'], size: [1,1,2,2,1,1],
    dimension: {
      freq: { category: { index: { M: 0 } } },
      unit: { category: { index: { RCH_A: 0 } } },
      coicop18: { category: { index: { CP00: 0, CP01: 1 }, label: { CP00: 'Total', CP01: 'Food' } } },
      release: { category: { index: { F: 0, P: 1 }, label: { F: 'Final', P: 'Preliminary' } } },
      geo: { category: { index: { [override.geo ?? 'EA21']: 0 } } },
      time: { category: { index: { [override.period ?? '2026-09']: 0 } } },
    }, value: { 0: value, 1: 999, 2: 88, 3: 77 }
  });
}
const ecbSpfHtml = `<html><h1>Results of the ECB Survey of Professional Forecasters for the third quarter of 2022</h1><div>22 July 2022</div>
  <p>For 2022, 2023 and 2024, these stand at 7.3%, 3.6% and 2.1% respectively</p>
  <table><tr><th>Real GDP growth</th></tr><tr><td>Q3 2022 SPF</td><td>2.8</td><td>1.5</td><td>1.8</td></tr></table></html>`;
const ycCsv = 'KEY,TIME_PERIOD,OBS_VALUE\nYC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,2022-07-21,1.15\nYC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,2022-07-22,1.23\n';

assert.equal(STUDY, 'MACRO_FIRST_RELEASE_PIT_PREFLIGHT_V1');
const hicp = parseEurostatFirstRelease(eurostatFixture());
assert.equal(hicp.value, 3.8);
assert.equal(hicp.dimensionCodes.coicop18, 'CP00');
assert.equal(hicp.dimensionCodes.release, 'F');
assert.equal(hicp.originalReleaseDate, '2026-10-16');
assert.equal(hicp.earliestDecisionDate, '2026-10-19');
assert.equal(hicp.provenance, undefined, 'parsing alone cannot assert real provenance');
assert.equal(parseEcbSpfPress(ecbSpfHtml).inflationForecast, 3.6);
assert.equal(parseEcbSpfPress(ecbSpfHtml).gdpForecast, 1.5);
assert.equal(parseEcbYieldCsv(ycCsv).value, 1.23);
assert.equal(parseEcbYieldCsv(ycCsv).executableQuote, false);
assert.throws(() => parseEurostatFirstRelease(eurostatFixture(2.2)), /INDEPENDENT_RELEASE_MISMATCH/);
assert.throws(() => parseEurostatFirstRelease(eurostatFixture(3.8, {geo:'EA20'})), /MISSING/);
assert.throws(() => parseEurostatFirstRelease(eurostatFixture(3.8, {period:'2026-08'})), /MISSING/);
assert.throws(() => parseEurostatFirstRelease('bad'), /NOT_JSON/);
assert.throws(() => parseEcbSpfPress(ecbSpfHtml.replace('22 July 2022', '21 July 2022')), /SPF_RELEASE_DATE/);
assert.throws(() => parseEcbSpfPress(ecbSpfHtml.replace('3.6%', '3.5%')), /SPF_RELEASE_ANCHOR_MISMATCH/);
assert.throws(() => parseEcbYieldCsv(ycCsv.replace('2022-07-22,1.23', '2022-07-20,1.23')), /DATE_MISSING/);
assert.throws(() => parseEcbYieldCsv(ycCsv.replace('2022-07-22,1.23', '2022-07-22,')), /INVALID_YIELD/);
assert.throws(() => enforceInformationDate(hicp,'2026-09-30'), /LOOKAHEAD/);
assert.throws(() => enforceInformationDate(hicp,'2026-10-16'), /LOOKAHEAD/);
assert.equal(enforceInformationDate(hicp,'2026-10-19'),true);
const spf=parseEcbSpfPress(ecbSpfHtml);
assert.throws(() => enforceInformationDate(spf,'2022-07-22'), /LOOKAHEAD/);
assert.equal(enforceInformationDate(spf,'2022-07-25'), true);
const seen=[];
const mock=async (url) => { seen.push(url); return { ok:true, text: async () => url === SOURCES.hicp.url ? eurostatFixture() : url === SOURCES.spf.url ? ecbSpfHtml : ycCsv }; };
const run=await runMacroPitPreflight({fetchImpl:mock,now:()=> '2026-11-06T12:00:00.000Z'});
assert.equal(run.observations.length,3);
assert.equal(run.status,'PASS_FIXTURE_ONLY');
assert.equal(run.provenance,'SYNTHETIC');
assert.ok(run.observations.every(x=>x.provenance==='SYNTHETIC'));
assert.equal(run.economicOutcomesCalculated,false);
assert.equal(run.productionAuthority,false);
assert.equal(seen.length,3);
await assert.rejects(()=>runMacroPitPreflight({fetchImpl:mock,save:true}), /FIXTURE_CANNOT_PERSIST/);
await assert.rejects(() => runMacroPitPreflight({fetchImpl:async()=>({ok:false,status:403}),now:()=> '2026-11-06T12:00:00.000Z'}), /HTTP_403/);
console.log('MACRO_FIRST_RELEASE_PIT_PREFLIGHT_V1_UNIT_PASS',JSON.stringify({fixtureOnly:true, liveApiFetched:false, checks:'Eurostat JSONstat unique final, EA21, original date, SPF source date, ECB YC CSV, no lookahead, no silent fallback'}));
