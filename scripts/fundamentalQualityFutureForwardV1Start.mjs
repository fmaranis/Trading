import { loadSnapshot, requiredSymbols, SNAPSHOT_SHA256, STUDY, AUTHORITY, requireThat, completed,
  sessionsBetween, adjustedOpen, sealEvidence, unsealEvidence, providerSymbol, fingerprint, almostEqual } from './fundamentalQualityFutureForwardV1Infrastructure.mjs';
import { verifyCorporateActionReview } from './researchCorporateActionsFailClosedV1.mjs';

export function validatePacket(packet, symbol, from, through, now) {
  requireThat(packet?.sourceType==='REAL' && packet.provider==='YAHOO_FINANCE' && packet.symbol===symbol
    && packet.providerSymbol===providerSymbol(symbol) && packet.returnedSymbol===providerSymbol(symbol)
    && packet.currency==='USD', `PRICE_IDENTITY_OR_PROVENANCE:${symbol}`);
  requireThat(packet.requestFrom===from && packet.requestThrough===through && /^https:\/\//.test(packet.sourceUrl)
    && /^[a-f0-9]{64}$/.test(packet.rawSha256), `PRICE_REQUEST_LINEAGE:${symbol}`);
  requireThat(Number.isFinite(Date.parse(packet.fetchedAt)) && Date.parse(packet.fetchedAt)<=Date.parse(now)
    && completed(through,packet.fetchedAt), `PRICE_FETCH_BEFORE_CLOSE:${symbol}`);
  requireThat(Array.isArray(packet.bars) && Array.isArray(packet.events), 'PRICE_PACKET_ARRAYS');
  const dates=new Set();
  for(const bar of packet.bars) {
    requireThat(bar.date>=from && bar.date<=through && completed(bar.date,now) && !dates.has(bar.date), 'PRICE_DATE_DUPLICATE_OR_FUTURE');
    dates.add(bar.date); adjustedOpen(bar);
  }
  for(const event of packet.events) requireThat(event.type==='dividends', `INCONCLUSIVE_CORPORATE_ACTION_ACCOUNTING:${event.type}:${symbol}`);
  return packet;
}

export function captureStart(packets, review, now) {
  const snapshot=loadSnapshot(); const symbols=requiredSymbols(snapshot);
  const through=review?.through;
  requireThat(through && completed(through,now),'NO_COMPLETED_START_SESSION');
  const reviewHash=verifyCorporateActionReview(review,symbols,'2026-09-28',through,now);
  requireThat(Object.keys(packets).length===102 && symbols.every(s=>packets[s]),'INCONCLUSIVE_START_COVERAGE');
  symbols.forEach(s=>validatePacket(packets[s],s,'2026-09-28',through,now));
  const skipped=[];
  for(const date of sessionsBetween('2026-09-28',through)) {
    const missing=symbols.filter(s=>!packets[s].bars.some(b=>b.date===date));
    if(missing.length) {
      requireThat(missing.every(symbol=>review.nonTradableSessions.some(r=>r.date===date && r.symbol===symbol)), `UNRESOLVED_EARLIER_SESSION:${date}`);
      skipped.push({date,nonTradableSymbols:missing}); continue;
    }
    const prices=Object.fromEntries(symbols.map(symbol=>{
      const bar=packets[symbol].bars.find(b=>b.date===date);
      return [symbol,{...bar,adjustedOpen:adjustedOpen(bar)}];
    }));
    return sealEvidence({ study:STUDY, kind:'START', status:'START_CAPTURED', snapshotSha256:SNAPSHOT_SHA256,
      capturedAt:now, startDate:date, coveragePct:100, securityCount:100, benchmarkCount:2, prices,
      skipped, reviewedThrough:through, reviewHash, packetsHash:fingerprint(packets), outcomesState:'UNOPENED', ...AUTHORITY });
  }
  throw new Error('NO_COMMON_TRADABLE_SESSION');
}
export function verifyStart(startEnvelope) {
  const snapshot=loadSnapshot(); const start=unsealEvidence(startEnvelope); const symbols=requiredSymbols(snapshot);
  requireThat(start.study===STUDY && start.kind==='START' && start.status==='START_CAPTURED'
    && start.snapshotSha256===SNAPSHOT_SHA256 && start.coveragePct===100 && start.outcomesState==='UNOPENED'
    && start.productionDefault==='LEGACY' && start.productionAuthority===false && start.promotionAllowed===false, 'START_CONTRACT');
  requireThat(start.startDate>'2026-09-27' && completed(start.startDate,start.capturedAt),'START_NOT_COMPLETED');
  requireThat(Object.keys(start.prices).length===102 && symbols.every(s=>start.prices[s]),'START_COVERAGE');
  for(const symbol of symbols) requireThat(start.prices[symbol].date===start.startDate
    && almostEqual(adjustedOpen(start.prices[symbol]),start.prices[symbol].adjustedOpen),'START_PRICE_TAMPER');
  return start;
}
