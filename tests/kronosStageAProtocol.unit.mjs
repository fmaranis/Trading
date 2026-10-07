import assert from 'node:assert/strict';
import { KRONOS_MARKET_CONTEXT_V1 as P } from '../scripts/kronosMarketContextV1Protocol.mjs';

assert.equal(P.version,'KRONOS_MARKET_CONTEXT_V1');
assert.equal(P.source.repository,'shiyu-coder/Kronos');
assert.equal(P.source.commit,'67b630e67f6a18c9e9be918d9b4337c960db1e9a');
assert.equal(P.source.license,'MIT');
assert.equal(P.model.repoId,'NeoQuasar/Kronos-small');
assert.equal(P.model.revision,'901c26c1332695a2a8f243eb2f37243a37bea320');
assert.equal(P.model.maxContext,512);
assert.equal(P.tokenizer.repoId,'NeoQuasar/Kronos-Tokenizer-base');
assert.equal(P.sampling.temperature,1);
assert.equal(P.sampling.topP,0.9);
assert.equal(P.sampling.stageASamplePaths,4);
assert.deepEqual(P.horizons,[20,60]);
assert.equal(P.stageA.dataProvenance,'SYNTHETIC');
assert.equal(P.stageA.marketPricesFetched,false);
assert.equal(P.stageA.marketOutcomesOpened,false);
assert.equal(P.pretrainingCutoff.known,false);
assert.equal(P.firstProspectiveEligibleWeek,'2026-10-12');
assert.equal(P.productionDefault,'LEGACY');
assert.equal(P.productionAuthority,false);

console.log('kronosStageAProtocol.unit: PASS');
