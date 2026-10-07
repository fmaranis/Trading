import assert from 'node:assert/strict';
import fs from 'node:fs';

const requirements=fs.readFileSync('backend/requirements-kronos.txt','utf8');
const runner=fs.readFileSync('backend/scripts/kronos_stage_a_smoke.py','utf8');
const bootstrap=fs.readFileSync('scripts/kronosStageALive.mjs','utf8');
const routes=fs.readFileSync('server/researchValidationRoutes.ts','utf8');
const ui=fs.readFileSync('src/components/ResearchValidationCenter.tsx','utf8');

assert.match(requirements,/pandas==2\.2\.2/);
assert.match(requirements,/huggingface_hub==0\.33\.1/);
assert.match(runner,/KRONOS_STAGE_A_SMOKE_V1_RESULT/);
assert.match(runner,/67b630e67f6a18c9e9be918d9b4337c960db1e9a/);
assert.match(runner,/NeoQuasar\/Kronos-small/);
assert.match(runner,/901c26c1332695a2a8f243eb2f37243a37bea320/);
assert.match(runner,/b082dfcbd8e8c142a725c8bbb99781802f38fec81210e13479effb32b3c3e020/);
assert.match(runner,/NeoQuasar\/Kronos-Tokenizer-base/);
assert.match(runner,/0e0117387f39004a9016484a186a908917e22426/);
assert.match(runner,/59d85f6af76a2c3b8240ea06cb21db4213b4eeca053f246b23e29cf832fc6bee/);
assert.match(runner,/snapshot_download/);
assert.match(runner,/git_blob_sha1/);
assert.match(runner,/sample_count=1/);
assert.match(runner,/PATH_COUNT = 4/);
assert.match(runner,/p_slope_positive/);
assert.match(runner,/p_return_positive/);
assert.match(runner,/sameSeedRepeatable/);
assert.match(runner,/differentSeedsProducePathDiversity/);
assert.match(runner,/"dataProvenance": "SYNTHETIC"/);
assert.match(runner,/"marketPricesFetched": False/);
assert.match(runner,/"marketOutcomesOpened": False/);
assert.match(runner,/"economicPolicyOpened": False/);
assert.match(runner,/"productionDefault": "LEGACY"/);
assert.match(runner,/"productionAuthority": False/);
assert.doesNotMatch(runner,/query1\.finance\.yahoo|EODHD|SEC_EDGAR|PortfolioDecisionEngine|PortfolioCandidateGate/i);

assert.match(bootstrap,/\.research-python.*kronos-v1/s);
assert.match(bootstrap,/download\.pytorch\.org\/whl\/cpu/);
assert.match(bootstrap,/torch==2\.8\.0/);
assert.match(bootstrap,/requirements-kronos\.txt/);
assert.match(bootstrap,/bootstrap\.pypa\.io\/get-pip\.py/);
assert.match(bootstrap,/kronos-pip-bootstrap/);
assert.match(bootstrap,/urllib\.request\.urlretrieve/);
assert.doesNotMatch(bootstrap,/sudo|apt-get|github actions/i);

const start=routes.indexOf("id: 'kronos-stage-a-smoke-v1'");
assert.ok(start>=0,'Kronos Stage A job must exist');
const end=routes.indexOf("id: 'pead-yahoo-calendar-source-audit-r3'",start);
const block=routes.slice(start,end>start?end:undefined);
assert.match(block,/visibility: 'CURRENT'/);
assert.match(block,/tests\/kronosStageASeal\.unit\.mjs/);
assert.match(block,/tests\/kronosPipBootstrap\.unit\.mjs/);
assert.match(block,/tests\/kronosStageAProtocol\.unit\.mjs/);
assert.match(block,/tests\/kronosStageAContract\.unit\.mjs/);
assert.match(block,/scripts\/kronosStageALive\.mjs/);
assert.doesNotMatch(block,/requiresTimesFmRunner: true/);

assert.match(ui,/KRONOS_STAGE_A_SMOKE_V1/);
assert.match(ui,/Ejecutar smoke Kronos/);

console.log('kronosStageAContract.unit: PASS');
