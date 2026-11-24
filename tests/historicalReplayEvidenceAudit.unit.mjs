import assert from 'node:assert/strict';
import { auditHistoricalReplayEvidence } from '../scripts/auditHistoricalReplayEvidence.mjs';

function fixture() {
  return {
    metadata: { format: 'TRADING_HISTORICAL_REPLAY_AUDIT', exportedAt: '2026-11-24T00:00:00Z' },
    session: {
      initialCapitalEur: 100,
      path: [
        { date: '2020-01-01', equityEur: 100, cashEur: 100, investedEur: 0, assetValuesEur: {}, cashBenchmarkEur: 100 },
        { date: '2020-01-02', equityEur: 102, cashEur: 89, investedEur: 13, assetValuesEur: {A: 13}, cashBenchmarkEur: 100.01 },
        { date: '2020-01-03', equityEur: 104, cashEur: 89, investedEur: 15, assetValuesEur: {A: 15}, cashBenchmarkEur: 100.02 }
      ],
      signals: [{id:'s1',signalDate:'2020-01-01',executionDate:'2020-01-02',assetId:'A',action:'BUY',executed:true,
        notionalEur:10,unitsDelta:1,feeEur:1,estimatedTaxEur:0}],
      executions: [{id:'s1',signalDate:'2020-01-01',executionDate:'2020-01-02',assetId:'A',action:'BUY',
        notionalEur:10,unitsDelta:1,feeEur:1,estimatedTaxEur:0,executionPriceEur:10}],
      checkpoints: [{ finalValueEur: 104 }],
      summary: {
        engineFinalEur:104, engineReturnPct:4,engineMaxDrawdownPct:0,engineFeesEur:1,engineTaxEur:0,
        exactHoldFinalEur:100.02,
        structuralCoreBenchmark:{available:true,finalEur:110,returnPct:10,excessFinalEur:-6,excessReturnPctPoints:-6}
      }
    }
  };
}
let count=0;
function check(label, fn) { fn(); count++; console.log('✓ '+label); }
function rejected(change, expected) {
  const base=fixture(); change(base);
  assert.throws(() => auditHistoricalReplayEvidence(base), e =>
    e instanceof Error && e.message === 'HISTORICAL_EVIDENCE_INTEGRITY_FAIL:'+expected);
}

check('archived replay shape audits independently without importing production strategy', () => {
  const result=auditHistoricalReplayEvidence(fixture());
  assert.equal(result.technical.accounting,'PASS');
  assert.equal(result.technical.signalExecutionParity,'PASS');
  assert.equal(result.technical.nextPortfolioSessionExecutionCount,1);
  assert.equal(result.economic.engineMinusCoreEur,-6);
  assert.equal(result.economic.beatsCore,false);
  assert.equal(result.evidenceLimits.productionPromotionAllowed,false);
  assert.equal(result.evidenceLimits.nextOpenExecutionPriceCannotBeIndependentlyChecked,true);
});
check('negative cash fails',()=>rejected(x=>{x.session.path[1].cashEur=-1},'NEGATIVE_CASH'));
check('equity identities must reconcile',()=>rejected(x=>{x.session.path[1].equityEur+=5},'EQUITY_CASH_ASSETS_MISMATCH'));
check('invested portfolio must equal actual asset values',()=>rejected(x=>{x.session.path[2].assetValuesEur.A=14},'INVESTED_ASSET_SUM_MISMATCH'));
check('same-day execution fails',()=>rejected(x=>{x.session.executions[0].signalDate='2020-01-02'},'SAME_DAY_OR_LOOKAHEAD_EXECUTION'));
check('unmatched fabricated execution fails',()=>rejected(x=>{x.session.executions[0].assetId='FAKE'},'EXECUTION_WITHOUT_EXACT_SIGNAL'));
check('duplicate executed transaction fails',()=>rejected(x=>{x.session.executions.push({...x.session.executions[0]})},'DUPLICATE_EXECUTION_ID'));
check('future lookahead in historical path date fails',()=>rejected(x=>{x.session.path[1].date='2020-01-04'},'PATH_DATES_NOT_STRICTLY_ASCENDING'));
check('fabricated fees fail',()=>rejected(x=>{x.session.summary.engineFeesEur=99},'FEES_MISMATCH'));
check('reported drawdown must equal independent path recomputation',()=>rejected(x=>{x.session.summary.engineMaxDrawdownPct=9},'DRAWDOWN_MISMATCH'));
check('reported core advantage must be arithmetically correct',()=>rejected(x=>{x.session.summary.structuralCoreBenchmark.excessFinalEur=8},'CORE_BENCHMARK_EXCESS_EUR_MISMATCH'));
check('additional paid-in capital does not silently count as investment return',()=>{
  const x=fixture(); x.session.externalCashFlows=[{date:'2020-01-02',kind:'CONTRIBUTION',amountEur:20}];
  const result=auditHistoricalReplayEvidence(x);
  assert.equal(result.evidenceLimits.externalFlows,'RETURN_N_D_UNTIL_FLOW_ADJUSTED_AUDIT');
  assert.equal(result.economic.calendarYears[0].returnPct,null);
  assert.equal(result.economic.engineReturnPct,null);
  assert.equal(result.economic.beatsCore,null);
  assert.equal(result.verdict,'LEDGER_CONSISTENT_FLOW_ADJUSTED_RETURNS_NOT_AUDITED');
});
console.log('Historical replay evidence independent unit: '+count+'/'+count+' PASS (no market data or replay).');
