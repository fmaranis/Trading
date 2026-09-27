// Shared research data-acceptance guard; not a corporate-action valuation engine.
import { requireThat, fingerprint } from './fundamentalQualityFutureForwardV1Infrastructure.mjs';
export const CORPORATE_ACTION_POLICY = 'RESEARCH_CORPORATE_ACTIONS_FAIL_CLOSED_V1';
export function verifyCorporateActionReview(review, symbols, from, through, now) {
  requireThat(review?.policy===CORPORATE_ACTION_POLICY && review.sourceType==='REAL', 'CORPORATE_ACTION_REVIEW_REQUIRED');
  requireThat(review.from===from && review.through===through && review.coverage==='COMPLETE', 'CORPORATE_ACTION_COVERAGE');
  requireThat(Number.isFinite(Date.parse(review.reviewedAt)) && Date.parse(review.reviewedAt)<=Date.parse(now)
    && Date.parse(review.reviewedAt)>=Date.parse(through+'T22:00:00Z'), 'CORPORATE_ACTION_REVIEW_TIME');
  requireThat(review.reviewer && Array.isArray(review.sources) && review.sources.length>0
    && review.sources.every(s=>/^https:\/\//.test(s.url) && /^[a-f0-9]{64}$/.test(s.sha256)), 'CORPORATE_ACTION_SOURCE_LINEAGE');
  requireThat(Array.isArray(review.symbols) && review.symbols.length===symbols.length
    && new Set(review.symbols).size===symbols.length && symbols.every(s=>review.symbols.includes(s)), 'CORPORATE_ACTION_IDENTITIES');
  requireThat(Array.isArray(review.events) && Array.isArray(review.nonTradableSessions), 'CORPORATE_ACTION_MANIFEST');
  for(const e of review.events) {
    requireThat(symbols.includes(e.symbol) && e.effectiveDate>=from && e.effectiveDate<=through && e.sourceUrl
      && Number.isFinite(Date.parse(e.knownAt)) && Date.parse(e.knownAt)<=Date.parse(now), 'CORPORATE_ACTION_EVENT_INVALID');
    // All structural events, including splits, are deliberately unsupported until accounting is independently frozen.
    requireThat(e.type==='ORDINARY_CASH_DIVIDEND' && e.adjustment==='PROVIDER_TOTAL_RETURN', `INCONCLUSIVE_CORPORATE_ACTION_ACCOUNTING:${e.type}:${e.symbol}`);
  }
  for(const r of review.nonTradableSessions) requireThat(symbols.includes(r.symbol) && r.date>=from && r.date<=through
    && r.reason==='EXCHANGE_CONFIRMED_FULL_SESSION_HALT' && /^https:\/\//.test(r.sourceUrl)
    && /^[a-f0-9]{64}$/.test(r.sourceSha256), 'NON_TRADABLE_EVIDENCE_INVALID');
  return fingerprint(review);
}
