import fs from 'node:fs';

type Input = {
  momentumMonthly: Record<string, number>;
  usMarketMonthly: Record<string, number>;
  globalProxy: { adjustedCloseStart: number; adjustedCloseEnd: number; years: number };
  spyCrossCheck: { adjustedCloseStart: number; adjustedCloseEnd: number; years: number };
};

function compound(values: number[]): number {
  return values.reduce((wealth, value) => wealth * (1 + value), 1) - 1;
}

function cagrMonthly(values: number[]): number {
  const total = compound(values);
  return Math.pow(1 + total, 12 / values.length) - 1;
}

function priceCagr(start: number, end: number, years: number): number {
  return Math.pow(end / start, 1 / years) - 1;
}

const path = process.argv[2] ?? 'validation-runs/diagnostics/core-outperformance-momentum-diagnostic-v1-input.json';
const input = JSON.parse(fs.readFileSync(path, 'utf8')) as Input;
const momentum = Object.values(input.momentumMonthly);
const usParent = Object.values(input.usMarketMonthly);

if (momentum.length !== 72 || usParent.length !== 72) {
  throw new Error(`EXPECTED_72_MONTHS: momentum=${momentum.length} parent=${usParent.length}`);
}

const momentumCagr = cagrMonthly(momentum);
const usParentCagr = cagrMonthly(usParent);
const globalProxyCagr = priceCagr(
  input.globalProxy.adjustedCloseStart,
  input.globalProxy.adjustedCloseEnd,
  input.globalProxy.years
);
const spyCrossCheckCagr = priceCagr(
  input.spyCrossCheck.adjustedCloseStart,
  input.spyCrossCheck.adjustedCloseEnd,
  input.spyCrossCheck.years
);

const excessVsUsParent = momentumCagr - usParentCagr;
const excessVsGlobalProxy = momentumCagr - globalProxyCagr;
const passed = excessVsUsParent > 0 && excessVsGlobalProxy > 0;

console.log(JSON.stringify({
  status: passed ? 'PASS_DIAGNOSTIC_GATE' : 'FAIL_DIAGNOSTIC',
  momentumCagr,
  usParentCagr,
  globalProxyCagr,
  spyCrossCheckCagr,
  excessVsUsParentPctPoints: excessVsUsParent * 100,
  excessVsGlobalProxyPctPoints: excessVsGlobalProxy * 100,
  passed
}, null, 2));
