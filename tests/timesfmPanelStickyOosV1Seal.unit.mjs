import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const seal=JSON.parse(fs.readFileSync(path.resolve(root,'validation-runs/preregistration/timesfm-panel-sticky-oos-v1-seal.json'),'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

assert.equal(seal.version,'TIMESFM_PANEL_STICKY_OOS_V1_SEAL');
assert.equal(seal.sealRevision,1);
assert.equal(seal.design.policy,'TIMESFM_PANEL_STICKY_SELECTOR_V1');
assert.equal(seal.design.signalArm,'FULL_PANEL_TARGETS_ONLY');
assert.equal(seal.design.forecastHorizonSessions,60);
assert.equal(seal.design.entryRank,1);
assert.equal(seal.design.incumbentRetentionRank,3);
assert.equal(seal.design.relativeReturnFloorPct,0);
assert.equal(seal.design.executionSemantics,'NEXT_OPEN');
assert.equal(seal.holdout.firstCalendarMonth,'2025-10');
assert.equal(seal.holdout.lastCalendarMonth,'2026-06');
assert.equal(seal.holdout.expectedAnchors,9);
assert.equal(seal.holdout.outcomesThrough,'2026-09-30');
assert.equal(seal.holdout.opened,false);
assert.equal(seal.holdout.yahooAccessed,false);
assert.equal(seal.holdout.timesFmForecastsReturned,false);
assert.equal(seal.holdout.outcomesEvaluated,false);
assert.deepEqual(seal.comparators,['LEGACY_APP','EUNL_CORE_DIRECT','PANEL_TOP1_60_NAIVE']);
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);

for(const [relative,expected] of Object.entries(seal.manifestGitBlobSha1)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  assert.equal(gitBlobSha(fs.readFileSync(absolute,'utf8')),expected,`Sealed blob changed: ${relative}`);
}

const routes=fs.readFileSync(path.resolve(root,'server/researchValidationRoutes.ts'),'utf8');
const start=routes.indexOf("id: 'timesfm-panel-sticky-oos-v1'");
const end=routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'",start);
assert.ok(start>=0&&end>start,'TimesFM sticky OOS job missing');
const block=routes.slice(start,end);
assert.match(block,/visibility: 'CURRENT'/);
assert.match(block,/requiresTimesFmRunner: true/);
assert.match(block,/requiresTimesFmAuth: true/);
assert.ok(block.indexOf('tests/timesfmPanelStickyOosV1Seal.unit.mjs') < block.indexOf('scripts/timesfmPanelStickyOosV1Live.ts'));
assert.ok(block.indexOf("npm', args: ['run', 'lint']") < block.indexOf('scripts/timesfmPanelStickyOosV1Live.ts'));

console.log('timesfmPanelStickyOosV1Seal.unit: PASS');
