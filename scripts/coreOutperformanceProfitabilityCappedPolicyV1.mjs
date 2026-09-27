export const PROFITABILITY_CAPPED_POLICY_V1 = Object.freeze({
  version: 'CORE_OUTPERFORMANCE_PROFITABILITY_CAPPED_POLICY_V1',
  issuerCap: 0.05,
  productionDefault: 'LEGACY',
  productionAuthority: false,
  researchOnly: true
});

export function capProRataFrozenWeights(rows, cap = PROFITABILITY_CAPPED_POLICY_V1.issuerCap) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('CAPPED_POLICY_ROWS_REQUIRED');
  if (!(cap > 0 && cap < 1)) throw new Error('CAPPED_POLICY_CAP_INVALID');
  if (rows.length * cap < 1 - 1e-12) throw new Error('CAPPED_POLICY_INFEASIBLE_CAP');

  const out = rows.map(row => ({
    ...row,
    baseWeight: Number(row.baseWeight ?? row.selectedWeight),
    policyWeight: 0,
    capped: false
  }));
  if (out.some(row => !Number.isFinite(row.baseWeight) || row.baseWeight <= 0)) {
    throw new Error('CAPPED_POLICY_BASE_WEIGHT_INVALID');
  }
  const baseTotal = out.reduce((s,row)=>s+row.baseWeight,0);
  if (Math.abs(baseTotal - 1) > 1e-9) throw new Error(`CAPPED_POLICY_BASE_SUM_INVALID:${baseTotal}`);

  let freeMass = 1;
  let active = [...out];
  while (active.length) {
    const activeBase = active.reduce((s,row)=>s+row.baseWeight,0);
    let clipped = false;
    const next = [];
    for (const row of active) {
      const tentative = freeMass * row.baseWeight / activeBase;
      if (tentative > cap + 1e-15) {
        row.policyWeight = cap;
        row.capped = true;
        freeMass -= cap;
        clipped = true;
      } else {
        next.push(row);
      }
    }
    if (!clipped) {
      const remainingBase = next.reduce((s,row)=>s+row.baseWeight,0);
      for (const row of next) row.policyWeight = freeMass * row.baseWeight / remainingBase;
      break;
    }
    active = next;
  }

  const total = out.reduce((s,row)=>s+row.policyWeight,0);
  if (Math.abs(total - 1) > 1e-9) throw new Error(`CAPPED_POLICY_SUM_INVALID:${total}`);
  if (out.some(row => row.policyWeight > cap + 1e-12)) throw new Error('CAPPED_POLICY_CAP_BREACH');
  return out;
}

export function evaluateCappedPolicy(snapshot, priceInput) {
  if (!snapshot || snapshot.study !== PROFITABILITY_CAPPED_POLICY_V1.version) throw new Error('CAPPED_POLICY_SNAPSHOT_INVALID');
  if (snapshot.outcome?.outcomeOpened !== false) throw new Error('CAPPED_POLICY_OUTCOME_ALREADY_OPENED');
  const selected = snapshot.selected ?? [];
  const start = priceInput?.selectedStartAdjustedPrices ?? {};
  const end = priceInput?.selectedEndAdjustedPrices ?? {};
  const missing = selected.filter(row => !(Number(start[row.symbol])>0) || !(Number(end[row.symbol])>0)).map(row=>row.symbol);
  const b0 = priceInput?.benchmarkStartAdjustedPrices ?? {};
  const b1 = priceInput?.benchmarkEndAdjustedPrices ?? {};
  const missingBenchmarks = ['SPY','URTH'].filter(k=>!(Number(b0[k])>0)||!(Number(b1[k])>0));
  if (missing.length || missingBenchmarks.length) return {
    version:PROFITABILITY_CAPPED_POLICY_V1.version,
    status:'INCONCLUSIVE_OUTCOME_COVERAGE',
    missingSelectedSymbols:missing,
    missingBenchmarks,
    productionDefault:'LEGACY',
    productionAuthority:false
  };
  const basketReturnPct = selected.reduce((s,row)=>{
    const r=(Number(end[row.symbol])/Number(start[row.symbol])-1)*100;
    return s+Number(row.policyWeight)*r;
  },0);
  const spy=(Number(b1.SPY)/Number(b0.SPY)-1)*100;
  const urth=(Number(b1.URTH)/Number(b0.URTH)-1)*100;
  const months=Number(priceInput.months);
  const primary=months===12;
  if(!primary && ![3,6].includes(months)) throw new Error(`CAPPED_POLICY_HORIZON_NOT_FROZEN:${months}`);
  return {
    version:PROFITABILITY_CAPPED_POLICY_V1.version,
    months,
    status:primary ? (basketReturnPct>spy&&basketReturnPct>urth?'PASS_PRIMARY_12M_POLICY_ONLY':'FAIL_PRIMARY_12M_POLICY') : 'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION',
    basketReturnPct,
    spyReturnPct:spy,
    urthReturnPct:urth,
    excessVsSpyPctPoints:basketReturnPct-spy,
    excessVsUrthPctPoints:basketReturnPct-urth,
    productionDefault:'LEGACY',
    productionAuthority:false
  };
}
