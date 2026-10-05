import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const seal=JSON.parse(fs.readFileSync(path.resolve(root,'validation-runs/preregistration/timesfm-stage-b-prospective-confirmation-v1-seal.json'),'utf8'));

function gitBlobSha(content){
  const body=Buffer.from(content,'utf8');
  const header=Buffer.from(`blob ${body.length}\0`,'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header,body])).digest('hex');
}

assert.equal(seal.version,'TIMESFM_STAGE_B_PROSPECTIVE_CONFIRMATION_V1_SEAL');
assert.equal(seal.sealRevision,5);
assert.equal(seal.historicalDiagnostic.observedResult,'PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION');
assert.equal(seal.historicalDiagnostic.consumed,true);
assert.equal(seal.prospective.sampleOpened,false);
assert.equal(seal.prospective.marketAccessed,false);
assert.equal(seal.prospective.outcomesOpened,false);
assert.equal(seal.prospective.noHistoricalCatchUp,true);
assert.equal(seal.prospective.noRetroactiveForecastAfterMissedAnchor,true);
assert.equal(seal.prospective.minimumMaturedAnchors,26);
assert.equal(seal.prospective.noRetuneAfterCollectionOpens,true);
assert.equal(seal.directShadow.version,'TIMESFM_DIRECT_SELECTOR_V1');
assert.equal(seal.directShadow.frozenBeforeFirstProspectiveAnchor,true);
assert.equal(seal.directShadow.candidatePool,'8_STAGE_B_ASSETS_PLUS_EUNL_CORE');
assert.deepEqual(seal.directShadow.horizons,[20,60]);
assert.equal(seal.directShadow.rule,'LOWEST_MEAN_ORDINAL_RANK_20_60');
assert.equal(seal.directShadow.tieBreak,'HIGHER_MEAN_PREDICTED_RELATIVE_RETURN_THEN_ASSET_ID');
assert.equal(seal.directShadow.structuralCoreRelativeForecastPct,0);
assert.equal(seal.directShadow.target,'100_PERCENT_EXECUTABLE_SHADOW_EQUITY_TO_SELECTED_ASSET');
assert.equal(seal.directShadow.persistsWinnerBeforeOutcomes,true);
assert.deepEqual(seal.directShadow.comparisonArms,['LEGACY_APP','EUNL_CORE_DIRECT']);
assert.equal(seal.directShadow.productionAuthority,false);
assert.equal(seal.productionDefault,'LEGACY');
assert.equal(seal.productionAuthority,false);

for(const [relative,expected] of Object.entries(seal.manifestGitBlobSha1)){
  const absolute=path.resolve(root,relative);
  assert.equal(fs.existsSync(absolute),true,`Missing sealed file: ${relative}`);
  assert.equal(gitBlobSha(fs.readFileSync(absolute,'utf8')),expected,`Sealed blob changed: ${relative}`);
}

const routes=fs.readFileSync(path.resolve(root,'server/researchValidationRoutes.ts'),'utf8');
const start=routes.indexOf("id: 'timesfm-stage-b-prospective-confirmation-v1'");
const end=routes.indexOf("id: 'timesfm-relative-rank-economic-diagnostic-v1'",start);
assert.ok(start>=0 && end>start,'Prospective job missing');
const block=routes.slice(start,end);
assert.match(block,/visibility: '(?:PARKED|CURRENT)'/);
assert.match(block,/requiresTimesFmRunner: true/);
assert.match(block,/requiresGithubReplayToken: true/);
assert.ok(block.indexOf('tests/timesFmDirectSelectorV1.unit.ts') < block.indexOf('scripts/timesfmStageBProspectiveCollectorLive.mjs'));
assert.ok(block.indexOf('tests/timesFmDirectSelectorV1Contract.unit.mjs') < block.indexOf('scripts/timesfmStageBProspectiveCollectorLive.mjs'));
assert.ok(block.indexOf('tests/timesFmDirectSelectorProspectiveParity.unit.ts') < block.indexOf('scripts/timesfmStageBProspectiveCollectorLive.mjs'));
assert.ok(block.indexOf('tests/timesfmStageBProspectiveSeal.unit.mjs') < block.indexOf('scripts/timesfmStageBProspectiveCollectorLive.mjs'));
assert.ok(block.indexOf("npm', args: ['run', 'lint']") < block.indexOf('scripts/timesfmStageBProspectiveCollectorLive.mjs'));

console.log('timesfmStageBProspectiveSeal.unit: PASS');
