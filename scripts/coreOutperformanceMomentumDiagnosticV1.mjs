import fs from 'node:fs';

const inputPath = process.argv[2] ?? 'validation-runs/diagnostics/core-outperformance-momentum-v1-input.json';
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function compound(values) {
  return values.reduce((wealth, r) => wealth * (1 + r), 1) - 1;
}
function cagrFromMonthly(values) {
  const total = compound(values);
  return Math.pow(1 + total, 12 / values.length) - 1;
}
function cagrFromEndpoints(start, end, years) {
  return Math.pow(end / start, 1 / years) - 1;
}

const momentum = Object.values(input.momentumMonthly);
const usMarket = Object.values(input.usMarketMonthly);
if (momentum.length !== 72 || usMarket.length !== 72) {
  throw new Error(`COVERAGE_MISMATCH:${momentum.length}:${usMarket.length}`);
}

const momentumCagr = cagrFromMonthly(momentum);
const usMarketCagr = cagrFromMonthly(usMarket);
const urthCagr = cagrFromEndpoints(input.globalProxy.adjustedCloseStart, input.globalProxy.adjustedCloseEnd, 6);
const spyCagr = cagrFromEndpoints(input.spyCrossCheck.adjustedCloseStart, input.spyCrossCheck.adjustedCloseEnd, 6);
const passed = momentumCagr > usMarketCagr && momentumCagr > urthCagr;

const result = {
  schemaVersion: 1,
  study: input.study,
  diagnosticWindow: input.diagnosticWindow,
  confirmationReserved: input.confirmationReserved,
  status: passed ? 'PASS_DIAGNOSTIC' : 'FAIL_DIAGNOSTIC',
  gate: {
    rule: 'gross CAGR excess > 0 versus US parent and URTH global proxy',
    passed
  },
  metrics: {
    momentumWinnerDecile: {
      totalReturnPct: compound(momentum) * 100,
      cagrPct: momentumCagr * 100
    },
    usMarket: {
      totalReturnPct: compound(usMarket) * 100,
      cagrPct: usMarketCagr * 100
    },
    urth: {
      totalReturnPct: (input.globalProxy.adjustedCloseEnd / input.globalProxy.adjustedCloseStart - 1) * 100,
      cagrPct: urthCagr * 100
    },
    spyCrossCheck: {
      totalReturnPct: (input.spyCrossCheck.adjustedCloseEnd / input.spyCrossCheck.adjustedCloseStart - 1) * 100,
      cagrPct: spyCagr * 100
    },
    excessCagrVsUsParentPctPoints: (momentumCagr - usMarketCagr) * 100,
    excessCagrVsUrthPctPoints: (momentumCagr - urthCagr) * 100
  },
  stopDecision: passed ? 'CONTINUE_TO_ACTIONABLE_REPLICA' : 'STOP_PRIMARY_REPLICA_NO_VARIANTS',
  productionDefault: 'LEGACY',
  productionAuthority: false,
  confirmationOpened: false
};

console.log(JSON.stringify(result, null, 2));
