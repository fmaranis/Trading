export const FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1 = Object.freeze({
  version: 'FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1',
  researchOnly: true,
  productionAuthority: false,
  productionDefault: 'LEGACY',
  snapshotDate: '2026-09-27',
  selectedCount: 100,
  winsorLow: 0.05,
  winsorHigh: 0.95,
  issuerCap: 0.05,
  quantileConvention: 'LINEAR_P_N_MINUS_1',
  zScoreConvention: 'POPULATION',
  descriptors: ['ROE_HIGH', 'DEBT_TO_EQUITY_LOW', 'EARNINGS_VARIABILITY_LOW'],
  epsAnchorYears: [2021, 2022, 2023, 2024, 2025, 2026],
  benchmarks: ['SPY','URTH'],
  primaryHorizonMonths: 12,
  descriptiveCheckpointsMonths: [3,6]
});

export function quantileLinear(values, p) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('QUALITY_QUANTILE_EMPTY');
  if (!(p >= 0 && p <= 1)) throw new Error('QUALITY_QUANTILE_P');
  const xs = values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if (!xs.length) throw new Error('QUALITY_QUANTILE_NO_FINITE');
  const h = p * (xs.length - 1);
  const lo = Math.floor(h), hi = Math.ceil(h);
  if (lo === hi) return xs[lo];
  return xs[lo] + (h - lo) * (xs[hi] - xs[lo]);
}

export function winsorize(values, lowP=0.05, highP=0.95) {
  const lo = quantileLinear(values, lowP);
  const hi = quantileLinear(values, highP);
  return {
    low: lo,
    high: hi,
    values: values.map(v => Math.max(lo, Math.min(hi, Number(v))))
  };
}

export function populationZ(values) {
  const xs=values.map(Number);
  const mean=xs.reduce((a,b)=>a+b,0)/xs.length;
  const variance=xs.reduce((s,x)=>s+(x-mean)**2,0)/xs.length;
  const sd=Math.sqrt(variance);
  if (!(sd > 0)) throw new Error('QUALITY_ZERO_SD');
  return { mean, sd, z: xs.map(x=>(x-mean)/sd) };
}

export function qualityScoreFromZ(z) {
  const x=Number(z);
  if (!Number.isFinite(x)) throw new Error('QUALITY_Z_INVALID');
  return x > 0 ? 1 + x : 1 / (1 - x);
}

export function capWeights(rows, cap=0.05) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('QUALITY_CAP_EMPTY');
  const base=rows.map(r=>({ ...r, rawWeight:Number(r.rawWeight) }));
  if (base.some(r=>!(r.rawWeight>0))) throw new Error('QUALITY_CAP_RAW_INVALID');
  const total=base.reduce((s,r)=>s+r.rawWeight,0);
  const weights=base.map(r=>r.rawWeight/total);
  const capped=new Array(base.length).fill(false);
  let remaining=1;
  for (let guard=0; guard<base.length+2; guard++) {
    const free=weights.map((_,i)=>i).filter(i=>!capped[i]);
    const freeRaw=free.reduce((s,i)=>s+base[i].rawWeight,0);
    if (!free.length || !(freeRaw>0)) break;
    let changed=false;
    for (const i of free) {
      const tentative=remaining*base[i].rawWeight/freeRaw;
      if (tentative>cap+1e-15) {
        weights[i]=cap; capped[i]=true; remaining-=cap; changed=true;
      }
    }
    if (!changed) {
      for (const i of free) weights[i]=remaining*base[i].rawWeight/freeRaw;
      break;
    }
  }
  const sum=weights.reduce((a,b)=>a+b,0);
  if (Math.abs(sum-1)>1e-10 || weights.some(w=>w>cap+1e-10 || w<0)) {
    throw new Error('QUALITY_CAP_INVALID_RESULT');
  }
  return base.map((r,i)=>({ ...r, weight:weights[i] }));
}
