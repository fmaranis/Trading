import fs from 'node:fs';

const SIGNAL_PATH = process.argv[2] ?? 'validation-runs/preregistration/core-outperformance-profitability-simfin-bridge-v1-input.json';
const PRICE_PATH = process.argv[3] ?? 'validation-runs/diagnostics/core-outperformance-profitability-simfin-bridge-v1-prices.json';

function positive(v) { return Number.isFinite(Number(v)) && Number(v) > 0; }
function pctReturn(start, end) {
  if (!positive(start) || !positive(end)) throw new Error('SIMFIN_BRIDGE_PRICE_INVALID');
  return (Number(end) / Number(start) - 1) * 100;
}
function cagrPct(periodReturnsPct, startDate, endDate) {
  const wealth = periodReturnsPct.reduce((w,r) => w * (1 + r / 100), 1);
  const years = (Date.parse(endDate) - Date.parse(startDate)) / (365.25 * 86400000);
  if (!(years > 0)) throw new Error('SIMFIN_BRIDGE_DATE_RANGE_INVALID');
  return (Math.pow(wealth, 1 / years) - 1) * 100;
}
function requirePrice(map, key, label) {
  const v = map?.[key];
  if (!positive(v)) throw new Error(`SIMFIN_BRIDGE_MISSING_${label}:${key}`);
  return Number(v);
}

const signal = JSON.parse(fs.readFileSync(SIGNAL_PATH,'utf8'));
const prices = JSON.parse(fs.readFileSync(PRICE_PATH,'utf8'));
if (signal.study !== 'CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1') throw new Error('SIMFIN_BRIDGE_SIGNAL_VERSION');
if (signal.priceOutcomesOpened !== false) throw new Error('SIMFIN_BRIDGE_SIGNAL_ALREADY_OPENED');
if (signal.productionDefault !== 'LEGACY' || signal.productionAuthority !== false) throw new Error('SIMFIN_BRIDGE_SIGNAL_PRODUCTION');
if (prices.study !== signal.study) throw new Error('SIMFIN_BRIDGE_PRICE_VERSION');

const formations = signal.formations.slice(0,4);
if (formations.length !== 4) throw new Error('SIMFIN_BRIDGE_FORMATION_COUNT');
const periods = [];

for (const formation of formations) {
  const p = prices.formations?.find(x => x.anchor === formation.anchor);
  if (!p) throw new Error(`SIMFIN_BRIDGE_PRICE_FORMATION_MISSING:${formation.anchor}`);
  if (!p.signalDate || !p.executionDate || !p.nextExecutionDate) throw new Error(`SIMFIN_BRIDGE_CALENDAR_MISSING:${formation.anchor}`);

  const capRows = formation.selected.map(row => {
    const close = requirePrice(p.signalRawClose, row.rawTicker, 'SIGNAL_CLOSE');
    const cap = close * Number(row.sharesBasic);
    if (!positive(cap)) throw new Error(`SIMFIN_BRIDGE_MARKET_CAP_INVALID:${formation.anchor}:${row.rawTicker}`);
    return { ...row, signalRawClose: close, marketCap: cap };
  });
  const totalCap = capRows.reduce((s,r) => s + r.marketCap, 0);
  if (!positive(totalCap)) throw new Error(`SIMFIN_BRIDGE_TOTAL_CAP_INVALID:${formation.anchor}`);

  const positions = capRows.map(row => {
    const start = requirePrice(p.startAdjustedOpen, row.rawTicker, 'START_AO');
    const end = requirePrice(p.endAdjustedOpen, row.rawTicker, 'END_AO');
    return {
      ticker: row.rawTicker,
      rank: row.rank,
      score: row.score,
      weight: row.marketCap / totalCap,
      returnPct: pctReturn(start,end)
    };
  });
  const weightSum = positions.reduce((s,r) => s + r.weight, 0);
  if (Math.abs(weightSum - 1) > 1e-9) throw new Error(`SIMFIN_BRIDGE_WEIGHT_SUM:${formation.anchor}:${weightSum}`);
  const candidateReturnPct = positions.reduce((s,r) => s + r.weight * r.returnPct, 0);

  const spyReturnPct = pctReturn(
    requirePrice(p.benchmarkStartAdjustedOpen,'SPY','SPY_START'),
    requirePrice(p.benchmarkEndAdjustedOpen,'SPY','SPY_END')
  );
  const urthReturnPct = pctReturn(
    requirePrice(p.benchmarkStartAdjustedOpen,'URTH','URTH_START'),
    requirePrice(p.benchmarkEndAdjustedOpen,'URTH','URTH_END')
  );

  periods.push({
    anchor: formation.anchor,
    signalDate: p.signalDate,
    executionDate: p.executionDate,
    nextExecutionDate: p.nextExecutionDate,
    candidateReturnPct,
    spyReturnPct,
    urthReturnPct,
    positions
  });
}

const startDate = periods[0].executionDate;
const endDate = periods.at(-1).nextExecutionDate;
const candidateCagrPct = cagrPct(periods.map(x=>x.candidateReturnPct),startDate,endDate);
const spyCagrPct = cagrPct(periods.map(x=>x.spyReturnPct),startDate,endDate);
const urthCagrPct = cagrPct(periods.map(x=>x.urthReturnPct),startDate,endDate);
const passed = candidateCagrPct > spyCagrPct && candidateCagrPct > urthCagrPct;

const result = {
  schemaVersion:1,
  study:signal.study,
  status:passed ? 'PASS_SIMFIN_BRIDGE_GROSS_ONLY' : 'FAIL_SIMFIN_BRIDGE',
  periodCount:periods.length,
  startDate,
  endDate,
  metrics:{
    candidateCagrPct,
    spyCagrPct,
    urthCagrPct,
    excessVsSpyPctPoints:candidateCagrPct-spyCagrPct,
    excessVsUrthPctPoints:candidateCagrPct-urthCagrPct
  },
  periods,
  productionDefault:'LEGACY',
  productionAuthority:false,
  interpretation:passed
    ? 'SECONDARY_CAUSAL_IMPLEMENTATION_RETAINS_GROSS_SIGNAL_DIAGNOSTIC_ONLY'
    : 'SECONDARY_CAUSAL_IMPLEMENTATION_DOES_NOT_RETAIN_GROSS_SIGNAL_NO_RETUNING'
};
console.log(JSON.stringify(result,null,2));
