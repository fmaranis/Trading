import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, STUDY, AUTHORITY, SNAPSHOT_SHA256, loadSnapshot, verifyInfrastructureSeal, requiredSymbols,
  providerSymbol, sha256, fingerprint, completed, isSession, addDays, checkpointDate, requireThat, unsealEvidence } from './fundamentalQualityFutureForwardV1Infrastructure.mjs';
import { captureStart, verifyStart, validatePacket } from './fundamentalQualityFutureForwardV1Start.mjs';
import { evaluateCheckpoint } from './fundamentalQualityFutureForwardV1Evaluator.mjs';
import { verifyCorporateActionReview } from './researchCorporateActionsFailClosedV1.mjs';
import { ImmutableEvidenceStore } from './researchImmutableEvidenceStore.mjs';

export async function fetchYahooPacket(symbol,from,through,now,fetchImpl=fetch) {
  requireThat(completed(through,now),'FETCH_BEFORE_COMPLETED_SESSION');
  const ticker=providerSymbol(symbol);
  const sourceUrl=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${Date.parse(from+'T00:00:00Z')/1000}&period2=${Date.parse(addDays(through,1)+'T00:00:00Z')/1000}&interval=1d&events=div%2Csplits%2CcapitalGains&includeAdjustedClose=true`;
  const response=await fetchImpl(sourceUrl,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(30000)});
  requireThat(response.ok,`YAHOO_HTTP_${response.status}:${symbol}`);
  const raw=await response.text(),payload=JSON.parse(raw),r=payload?.chart?.result?.[0];
  requireThat(r && !payload.chart.error && r.meta?.symbol===ticker && r.meta?.currency==='USD'
    && r.meta.exchangeTimezoneName==='America/New_York' && r.meta.instrumentType===(['SPY','URTH'].includes(symbol)?'ETF':'EQUITY'),`YAHOO_IDENTITY:${symbol}`);
  const q=r.indicators?.quote?.[0],adj=r.indicators?.adjclose?.[0]?.adjclose;
  requireThat(q && adj && Array.isArray(r.timestamp),'YAHOO_PRICE_ARRAYS');
  const bars=r.timestamp.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),open:q.open?.[i],close:q.close?.[i],adjustedClose:adj[i]}));
  // Invalid/null values are not dropped: validation blocks them rather than drifting the start.
  const events=Object.entries(r.events??{}).flatMap(([type,rows])=>Object.values(rows).map(event=>({type,...event})));
  const packet={sourceType:'REAL',provider:'YAHOO_FINANCE',symbol,providerSymbol:ticker,returnedSymbol:r.meta.symbol,currency:r.meta.currency,
    sourceUrl,rawSha256:sha256(raw),requestFrom:from,requestThrough:through,fetchedAt:now,bars,events};
  validatePacket(packet,symbol,from,through,now);
  return {packet,raw};
}

// reviewAt is an explicit auditable data dependency, not a claim that Yahoo's event feed covers mergers/delistings.
export async function runFutureForward({mode,months,now=new Date().toISOString(),reviewAt,storeFactory=()=>new ImmutableEvidenceStore(),fetchPacket=fetchYahooPacket}) {
  const seal=verifyInfrastructureSeal(),snapshot=loadSnapshot(),symbols=requiredSymbols(snapshot);
  const base={study:STUDY,snapshotSha256:SNAPSHOT_SHA256,designSealSha256:fingerprint(seal),...AUTHORITY};
  requireThat(mode==='start' || mode==='evaluate','MODE_INVALID');
  if(mode==='evaluate') requireThat([3,6,12].includes(months),'UNFROZEN_HORIZON');
  // No network, token or price request on the snapshot weekend.
  if(!completed('2026-09-28',now))return {...base,status:'WAITING_FOR_COMPLETED_SESSION',startCaptured:false,outcomesState:'UNOPENED',earliestStartReadAt:'2026-09-28T22:00:00Z'};
  const store=storeFactory();
  const saved=await store.read('start');
  if(mode==='start' && saved){verifyStart(saved);return {...base,status:'START_ALREADY_CAPTURED',startSha256:saved.sha256,startDate:saved.payload.startDate};}
  if(mode==='evaluate') {
    requireThat(saved,'START_NOT_CAPTURED'); const start=verifyStart(saved); const through=checkpointDate(start.startDate,months);
    if(!completed(through,now))return {...base,status:'WAITING_FOR_CHECKPOINT',months,endDate:through,primaryGateEvaluated:false};
    const key=`checkpoint-${months}m`,prior=await store.read(key);
    if(prior){const value=unsealEvidence(prior);requireThat(value.startSha256===saved.sha256 && value.snapshotSha256===SNAPSHOT_SHA256,'CHECKPOINT_BINDING');return value;}
    const review=await reviewAt(through);
    verifyCorporateActionReview(review,symbols,start.startDate,through,now);
    await openOnce(store,`${key}-opening`,{...base,status:'OUTCOME_OPENED',months,openedAt:now,startSha256:saved.sha256,endDate:through});
    const input=await collect(store,`${key}-input`,symbols,start.startDate,through,now,review,fetchPacket);
    const result=evaluateCheckpoint(saved,input.packets,input.review,months,now);
    await store.create(key,result);return result.payload;
  }
  // Earliest-first search. A later start requires documented full-session non-tradability, never missing provider data.
  for(let date='2026-09-28';date<=now.slice(0,10);date=addDays(date,1)) {
    if(!isSession(date))continue;
    if(!completed(date,now))break;
    const review=await reviewAt(date);verifyCorporateActionReview(review,symbols,'2026-09-28',date,now);
    await openOnce(store,'start-opening',{...base,status:'START_DATA_OPENED',openedAt:now,outcomesState:'UNOPENED'});
    const input=await collect(store,`start-input-${date}`,symbols,'2026-09-28',date,now,review,fetchPacket);
    let start;
    try {start=captureStart(input.packets,input.review,now);} catch(error) {
      if(error.message==='NO_COMMON_TRADABLE_SESSION')continue;
      throw error;
    }
    await store.create('start',start); return start.payload;
  }
  return {...base,status:'WAITING_FOR_COMMON_COMPLETED_SESSION',startCaptured:false,outcomesState:'UNOPENED'};
}
async function openOnce(store,key,value){const prior=await store.read(key);if(!prior)await store.create(key,value);
  else requireThat(prior.snapshotSha256===value.snapshotSha256 && prior.designSealSha256===value.designSealSha256,'OPENING_LOCK_MISMATCH');}
async function collect(store,key,symbols,from,through,now,review,fetchPacket){
  const cached=await store.read(key); if(cached){requireThat(cached.from===from && cached.through===through && cached.snapshotSha256===SNAPSHOT_SHA256,'INPUT_CACHE_BINDING');return cached;}
  const packets={},rawResponses={};
  // Small sequential download; no polling/retry loop. Each symbol is durably cached to resume interruption.
  for(const symbol of symbols){
    const partKey=`${key}-${providerSymbol(symbol).toLowerCase()}`;
    let part=await store.read(partKey);
    if(!part){part=await fetchPacket(symbol,from,through,now);await store.create(partKey,part);}
    validatePacket(part.packet,symbol,from,through,now); requireThat(sha256(part.raw)===part.packet.rawSha256,'RAW_RESPONSE_HASH');
    packets[symbol]=part.packet;rawResponses[symbol]=part.raw;
  }
  const input={snapshotSha256:SNAPSHOT_SHA256,from,through,review,packets,rawResponses};await store.create(key,input);return input;
}

async function main(){
  const [mode,...args]=process.argv.slice(2);let months;let reviewDir;
  for(let i=0;i<args.length;i++) {if(args[i]==='--months')months=Number(args[++i]);else if(args[i]==='--review-dir')reviewDir=args[++i];else throw new Error('UNKNOWN_ARGUMENT');}
  const result=await runFutureForward({mode,months,reviewAt:async date=>{
    requireThat(reviewDir,'CORPORATE_ACTION_REVIEW_DIRECTORY_REQUIRED');const path=resolve(reviewDir,date+'.json');
    requireThat(existsSync(path),'CORPORATE_ACTION_REVIEW_REQUIRED');return JSON.parse(readFileSync(path,'utf8'));
  }});
  console.log(JSON.stringify(result));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(error=>{
  console.error(JSON.stringify({study:STUDY,status:'BLOCKED_FAIL_CLOSED',reason:error.message,...AUTHORITY}));process.exitCode=1;
});
