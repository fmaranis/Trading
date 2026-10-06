import assert from 'node:assert/strict';
import { spearmanRankIc } from '../scripts/timesfmPanelStickyOosV1Postmortem';

const perfect=spearmanRankIc(
  [{id:'A',value:3},{id:'B',value:2},{id:'C',value:1}],
  [{id:'A',value:30},{id:'B',value:20},{id:'C',value:10}]
);
assert.equal(Number(perfect?.toFixed(6)),1);

const inverse=spearmanRankIc(
  [{id:'A',value:3},{id:'B',value:2},{id:'C',value:1}],
  [{id:'A',value:10},{id:'B',value:20},{id:'C',value:30}]
);
assert.equal(Number(inverse?.toFixed(6)),-1);

const tied=spearmanRankIc(
  [{id:'A',value:2},{id:'B',value:2},{id:'C',value:1}],
  [{id:'A',value:2},{id:'B',value:1},{id:'C',value:0}]
);
assert.ok(Number.isFinite(tied));

console.log('timesfmPanelStickyOosV1Postmortem.unit: PASS');
