import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='validation-runs/diagnostics/pead-yahoo-calendar-source-audit-r3-result.json';
assert.equal(fs.existsSync(file),true,'PEAD_SIGNAL_R3_SOURCE_RESULT_MISSING');
const source=JSON.parse(fs.readFileSync(file,'utf8'));

assert.equal(source.study,'PEAD_EARNINGS_SOURCE_AUDIT_R3');
assert.equal(source.sourceRevision,'YAHOO_CALENDAR_RANGE_DUAL_PIT_R3_NEXT_SESSION');
assert.equal(source.status,'PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION_R3');
assert.equal(source.provenance,'REAL');
assert.equal(source.universeProvenance,'STATIC_REFERENCE');
assert.equal(source.priceOutcomesFetched,false);
assert.equal(source.economicOutcomesOpened,false);
assert.equal(source.productionDefault,'LEGACY');
assert.equal(source.productionAuthority,false);
assert.equal(source.promotionAllowed,false);
assert.equal(source.audit?.passed,true);
assert.equal(source.audit?.executionSemantics?.entry,'FIRST_REGULAR_OPEN_STRICTLY_AFTER_REPORT_DATE');
assert.equal(source.audit?.executionSemantics?.announcementDayReturnIncluded,false);
assert.equal(source.audit?.executionSemantics?.timingInferenceAllowed,false);
assert.ok(Number(source.audit?.counts?.causalEligible)>=440);
assert.ok(Array.isArray(source.causalEvents));
assert.equal(source.causalEvents.length,source.audit.counts.causalEligible);
assert.ok(source.causalEvents.every(row=>
  row&&typeof row.ticker==='string'
  &&/^\d{4}-\d{2}-\d{2}$/.test(row.reportDate)
  &&Number.isFinite(Number(row.surprisePct))
));

console.log('PEAD_SIGNAL_R3_SOURCE_READINESS_PASS');
