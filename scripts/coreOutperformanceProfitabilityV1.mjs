import fs from 'node:fs';

const inputPath = process.argv[2] ?? 'validation-runs/diagnostics/core-outperformance-profitability-v1-input.json';
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function values(obj) { return Object.values(obj).map(Number); }
function compoundPct(monthlyPct) {
  return (monthlyPct.reduce((w, r) => w * (1 + r / 100), 1) - 1) * 100;
}
function cagrPct(monthlyPct) {
  const wealth = monthlyPct.reduce((w, r) => w * (1 + r / 100), 1);
  return (Math.pow(wealth, 12 / monthlyPct.length) - 1) * 100;
}
function risk(monthlyPct) {
  const r = monthlyPct.map(v => v / 100);
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / (r.length - 1));
  let wealth = 1, peak = 1, maxDrawdown = 0;
  for (const x of r) {
    wealth *= 1 + x;
    peak = Math.max(peak, wealth);
    maxDrawdown = Math.min(maxDrawdown, wealth / peak - 1);
  }
  const cagr = Math.pow(wealth, 12 / r.length) - 1;
  return {
    annualizedVolPct: sd * Math.sqrt(12) * 100,
    maxMonthlyPathDrawdownPct: maxDrawdown * 100,
    returnVolRatio: cagr / (sd * Math.sqrt(12))
  };
}
function endpointCagrPct(start, end, years) {
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}
function leg(monthlyPct) {
  return {
    months: monthlyPct.length,
    totalReturnPct: compoundPct(monthlyPct),
    cagrPct: cagrPct(monthlyPct),
    ...risk(monthlyPct)
  };
}

const dCand = values(input.diagnostic.candidateMonthlyPct);
const dUs = values(input.diagnostic.usParentMonthlyPct);
const cCand = values(input.confirmation.candidateMonthlyPct);
const cUs = values(input.confirmation.usParentMonthlyPct);
const cDev = values(input.confirmation.developedGlobalMonthlyPct);
if ([dCand.length, dUs.length, cCand.length, cUs.length, cDev.length].some(n => n !== 72)) {
  throw new Error('PROFITABILITY_V1_COVERAGE_MISMATCH');
}

const diagnostic = {
  candidate: leg(dCand),
  usParent: leg(dUs),
  urth: {
    totalReturnPct: (input.diagnostic.globalProxy.adjustedCloseEnd / input.diagnostic.globalProxy.adjustedCloseStart - 1) * 100,
    cagrPct: endpointCagrPct(input.diagnostic.globalProxy.adjustedCloseStart, input.diagnostic.globalProxy.adjustedCloseEnd, 6)
  }
};
diagnostic.excessCagrVsUsPctPoints = diagnostic.candidate.cagrPct - diagnostic.usParent.cagrPct;
diagnostic.excessCagrVsUrthPctPoints = diagnostic.candidate.cagrPct - diagnostic.urth.cagrPct;
diagnostic.passed = diagnostic.excessCagrVsUsPctPoints > 0 && diagnostic.excessCagrVsUrthPctPoints > 0;

const confirmation = {
  candidate: leg(cCand),
  usParent: leg(cUs),
  developedGlobal: leg(cDev)
};
confirmation.excessCagrVsUsPctPoints = confirmation.candidate.cagrPct - confirmation.usParent.cagrPct;
confirmation.excessCagrVsDevelopedPctPoints = confirmation.candidate.cagrPct - confirmation.developedGlobal.cagrPct;
confirmation.passed = confirmation.excessCagrVsUsPctPoints > 0 && confirmation.excessCagrVsDevelopedPctPoints > 0;

const result = {
  schemaVersion: 1,
  study: input.study,
  status: diagnostic.passed && confirmation.passed ? 'PASS_CONFIRMATION_SIGNAL_ONLY' : diagnostic.passed ? 'FAIL_CONFIRMATION' : 'FAIL_DIAGNOSTIC',
  diagnostic,
  confirmation,
  productionDefault: 'LEGACY',
  productionAuthority: false,
  nextAction: diagnostic.passed && confirmation.passed
    ? 'FREEZE_ACTIONABLE_PIT_TRANSLATION'
    : 'STOP_THIS_CANDIDATE'
};
console.log(JSON.stringify(result, null, 2));
