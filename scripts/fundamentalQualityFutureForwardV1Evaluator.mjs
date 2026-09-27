import { loadSnapshot, requiredSymbols, STUDY, SNAPSHOT_SHA256, AUTHORITY, requireThat, fingerprint,
  completed, checkpointDate, sessionsBetween, adjustedOpen, almostEqual, sessionOpen, sessionClose, sealEvidence } from './fundamentalQualityFutureForwardV1Infrastructure.mjs';
import { validatePacket, verifyStart } from './fundamentalQualityFutureForwardV1Start.mjs';
import { verifyCorporateActionReview } from './researchCorporateActionsFailClosedV1.mjs';

export const RISK_CONVENTION = Object.freeze({riskFree:'CONSTANT_ZERO_DAILY_RESEARCH_REFERENCE',annualizationSessions:252,
  standardDeviation:'SAMPLE_N_MINUS_1',sharpe:'MEAN_DAILY_EXCESS_DIV_SAMPLE_SD_DAILY_EXCESS_TIMES_SQRT_252',
  firstReturn:'START_ADJUSTED_OPEN_TO_START_ADJUSTED_CLOSE',cagr:'ACTUAL_ELAPSED_SECONDS_DIV_365_25_DAYS',
  weighting:'FROZEN_INITIAL_WEIGHTS_BUY_AND_HOLD_NO_REBALANCE',returnBasis:'GROSS_USD_TOTAL_RETURN_PROXY_NO_TAX_OR_COST'});
export function pathMetrics(nav, elapsedYears) {
  requireThat(nav.length>=3 && nav.every(x=>typeof x==='number' && Number.isFinite(x) && x>0) && elapsedYears>0,'INVALID_NAV');
  const r=nav.slice(1).map((x,i)=>x/nav[i]-1);
  const mean=r.reduce((a,b)=>a+b,0)/r.length;
  const sd=Math.sqrt(r.reduce((a,x)=>a+(x-mean)**2,0)/(r.length-1));
  let peak=nav[0], dd=0; for(const x of nav){peak=Math.max(peak,x);dd=Math.max(dd,1-x/peak);}
  return {totalReturnPct:(nav.at(-1)/nav[0]-1)*100,cagrEquivalentPct:((nav.at(-1)/nav[0])**(1/elapsedYears)-1)*100,
    annualizedDailyVolatilityPct:sd*Math.sqrt(252)*100,maxDailyDrawdownPct:dd*100,
    sharpe:sd>0?mean/sd*Math.sqrt(252):null,sharpeUnavailableReason:sd===0?'ZERO_DAILY_VOLATILITY':null,observations:r.length};
}
export function evaluateCheckpoint(startEnvelope, packets, review, months, now) {
  const snapshot=loadSnapshot(); const start=verifyStart(startEnvelope);
  const endDate=checkpointDate(start.startDate,months);
  requireThat(completed(endDate,now),'CHECKPOINT_NOT_MATURE');
  const symbols=requiredSymbols(snapshot);
  const reviewHash=verifyCorporateActionReview(review,symbols,start.startDate,endDate,now);
  requireThat(Object.keys(packets).length===102 && symbols.every(s=>packets[s]),'INCONCLUSIVE_OUTCOME_COVERAGE');
  const dates=sessionsBetween(start.startDate,endDate);
  const paths={};
  for(const symbol of symbols) {
    const packet=validatePacket(packets[symbol],symbol,start.startDate,endDate,now);
    requireThat(packet.bars.length===dates.length && packet.bars.every((b,i)=>b.date===dates[i]), `INCONCLUSIVE_DAILY_COVERAGE:${symbol}`);
    const base=packet.bars[0],locked=start.prices[symbol];
    requireThat(almostEqual(base.open,locked.open) && almostEqual(base.close,locked.close),'START_RAW_PRICE_REVISION_OR_SPLIT');
    // Never divide a new-vintage adjusted close by the old-vintage locked adjusted open.
    // Rebase the ENTIRE same-vintage series to the immutable start; no change of date, holdings or weights.
    const divisor=adjustedOpen(base);
    paths[symbol]=[1,...packet.bars.map(bar=>bar.adjustedClose/divisor)];
  }
  const nav=[1,...dates.map((_,i)=>snapshot.selected.reduce((sum,row)=>sum+row.weight*paths[row.symbol][i+1],0))];
  const years=(sessionClose(endDate)-sessionOpen(start.startDate))/(365.25*86400000);
  const candidate=pathMetrics(nav,years), SPY=pathMetrics(paths.SPY,years), URTH=pathMetrics(paths.URTH,years);
  const primary=months===12;
  return sealEvidence({study:STUDY,kind:'CHECKPOINT',months,startDate:start.startDate,endDate, evaluatedAt:now,
    snapshotSha256:SNAPSHOT_SHA256,startSha256:startEnvelope.sha256,packetsHash:fingerprint(packets),reviewHash,
    status:primary?(candidate.totalReturnPct-SPY.totalReturnPct>1e-10 && candidate.totalReturnPct-URTH.totalReturnPct>1e-10
      ?'PASS_PRIMARY_12M_SIGNAL_ONLY':'FAIL_PRIMARY_12M'):'DESCRIPTIVE_CHECKPOINT_NO_PROMOTION',
    primaryGateEvaluated:primary,outcomeCoveragePct:100,securityCount:100,benchmarkCount:2,
    riskConvention:RISK_CONVENTION,candidate,benchmarks:{SPY,URTH},
    excessVsSpyPctPoints:candidate.totalReturnPct-SPY.totalReturnPct,
    excessVsUrthPctPoints:candidate.totalReturnPct-URTH.totalReturnPct,
    dates,nav,benchmarkNav:{SPY:paths.SPY,URTH:paths.URTH},...AUTHORITY});
}
