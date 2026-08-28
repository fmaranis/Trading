# Trading — Permanent Architecture & Product Decisions

This document records durable decisions that should survive chat changes. Operational status and the next task live in `PROJECT_STATE.md`.

## D1. Repository is the memory source of truth

**Decision:** `fmaranis/Trading/main` is canonical. Chat memory is supplementary only.

**Reason:** work happens across desktop/mobile and multiple chats; relying on conversation continuity loses implementation state.

**Rule:** after meaningful project work, update `PROJECT_STATE.md`. New chats should read it first.

## D2. No GitHub Actions dependency

**Decision:** do not add or rely on GitHub Actions for validation or operation.

**Reason:** project validation is intentionally local/manual and the owner does not want a paid Actions dependency.

**Allowed:** deterministic npm scripts, local AI Studio execution, local/server tests, Git history for rollback.

## D3. Research/decision support, not autonomous trade execution

**Decision:** the application may analyse, rank, backtest, alert and propose execution plans, but it must not pretend to place broker trades unless a future explicit broker integration is implemented and verified.

**Rule:** distinguish theoretical allocation from broker-executable orders.

## D4. REAL data never silently becomes synthetic

**Decision:** `REAL` requests must either return validated real data or fail explicitly.

**Reason:** synthetic fallback would contaminate backtests and decision evidence without the user knowing.

**Rule:** provenance and dataset fingerprints remain first-class outputs.

## D5. Yahoo Finance primary, EODHD secondary

**Decision:** Yahoo Finance is currently the primary daily historical market-data source. EODHD is secondary for cross-validation and fund data.

**Reason:** Yahoo provides broad practical coverage without an API key; EODHD adds independent evidence and fund/NAV capabilities.

**Constraints:** Yahoo is unofficial/non-contractual and must be labelled accordingly; EODHD failures/quota limits are non-blocking for the primary Yahoo path; EODHD credentials remain server-side; do not call daily historical data “real time”.

## D6. Cross-provider discrepancies are evidence, not hidden corrections

**Decision:** compare providers explicitly rather than silently replacing one price with another.

**Current policy:** EODHD cross-check route uses a 1% tolerance for `MATCH` vs `PRICE_DIVERGENCE`.

## D7. Cache secondary-provider checks

**Decision:** EODHD cross-check results are cached for 24 h for unchanged ticker/date/close inputs; fund-history data currently uses a shorter cache.

## D8. Causal backtests are mandatory for decision claims

**Decision:** any historical decision/selection validation must use only information available at the historical decision date.

**Execution convention:** information through `Close(t-1)`; execution at `Open(t)` where the engine models NEXT_OPEN.

## D9. Current-catalog causal reselection is not survivorship-bias-free

**Decision:** causal universe backtesting across the currently queryable catalog may be used as research evidence but must retain a residual-bias warning.

## D10. Scanner diversification by exposure category

**Decision:** shortlist selection currently permits at most one selected asset per category and tries to retain a defensive exposure when available.

## D11. Confidence is evidence quality, not probability of profit

**Decision:** decision-engine confidence communicates quality/recency/sufficiency of evidence, not expected win rate or probability of positive return.

**Current cap:** 85 while provider breadth and universe validation remain limited.

## D12. Risk-profile methods

Current default decision mapping: LOW → Inverse Volatility; MEDIUM → Risk Parity ERC; HIGH → Relative Momentum. Regime logic may increase cash defensively.

## D13. Broker constraints must alter the executable plan

**Decision:** theoretical fractional allocations must not be shown as directly executable at a whole-share broker.

**Current MyInvestor model:** ETF fractions not supported; commission 0.12%; minimum 1 EUR/order; maximum 25 EUR/order; exact instrument availability must be verified by ticker/ISIN before a manual pilot.

## D14. Diversification quality is separate from affordability

**Decision:** broker execution must distinguish whether any whole-share order is affordable from whether the resulting portfolio retains enough diversification, concentration control and cost efficiency for the requested profile.

## D15. Small-capital experiments must expose structural limitations

**Decision:** when capital is too low to reproduce a strategy, the app should calculate/report the limitation rather than fake precision with fractional shares.

## D16. Deterministic local validation is the release gate

**Decision:** technical readiness is based on deterministic tests/build plus explicit live-data checks where required. Research readiness, manual-pilot readiness and broker/instrument verification remain separate concepts.

## D17. Unified fund + ETF evidence is allowed, but provenance must remain explicit

**Decision:** the project may combine supported ETF and fund evidence in a unified investment universe / portfolio-decision layer, while keeping provider, price/NAV and freshness semantics explicit.

## D18. Opportunity-threshold research stays causal and diagnostic

**Decision:** opportunity alert thresholds may be researched and walk-forward tested, but threshold tuning must remain chronological/causal and should not be marketed as guaranteed alpha.

## D19. Do not overclaim provider or broker verification

**Decision:** code support for a provider/broker rule is not the same as successful live verification of every asset.

## D20. Backtest costs must be separated from broker-executable costs

**Decision:** a percentage-only commission model may be retained for strategy research, but it must not be interpreted as broker-executable evidence when the broker has a fixed minimum commission per order.

**Current implementation:** `brokerBacktestFeasibility.ts` computes a mathematical lower bound equal to `number of executed orders × broker minimum commission`, compares that lower bound with the modeled backtest commission, and reports the minimum capital required to keep that lower-bound commission drag under an explicit target.

**Rule:** strategy performance and broker execution feasibility must be reported as separate evidence.

## D21. Recommendations must become an explicit manual execution plan

**Decision:** portfolio recommendations must not end at labels such as ADD, REDUCE or REVIEW_TRANSFER. The application should convert them into a persistent manual checklist tied to the saved portfolio.

**Current implementation:** `portfolioExecutionPlan.ts` and `PortfolioExecutionPlanPanel.tsx` create/store pending actions such as whole-share ETF buy/sell, fund subscription, fund transfer review and fund redemption review. Each line retains ticker/ISIN where available, orientative amount/number of shares, rationale and completion status.

**Fund rule:** when a current fund is marked transferable and a supported fund destination exists, the plan prefers a transfer review over reimbursement + new subscription. It must not claim tax or operational eligibility until the broker/entity confirms it.

## D22. Research targets and cost-aware executable actions are separate layers

**Decision:** a change in theoretical target allocation is not sufficient reason to trade. The research signal must remain unchanged and auditable, while a separate execution policy may suppress, defer or batch broker orders when they are too small or too expensive.

**Current default execution policy:**

- minimum absolute allocation drift before considering an ETF trade: **5 percentage points**;
- minimum ETF order notional: **50 EUR**;
- maximum modeled commission drag per ETF order: **2% of order notional**;
- maximum modeled commission budget per rebalance window: **1% of current equity**;
- ETF orders use whole shares and MyInvestor modeled min/max commission;
- sell orders are evaluated before buys and cash may never become negative.

**Architecture:** `costAwareExecutionPolicy.ts` owns broker-aware no-trade gating. `brokerAwareCausalReplay.ts` replays the already-causal research selection dates under these execution constraints rather than changing historical signals to make them look better.

**Fund boundary:** the broker-aware historical replay does not pretend mutual-fund NAV subscriptions/transfers are ETF orders. Fund target weights are conservatively held as cash in this replay until fund-specific settlement/NAV/transfer semantics are modeled. This is intentionally conservative and must be visible in results.

**Validation:** compare multiple capital levels rather than optimizing a single 100 EUR case. Current sweep levels are 100, 334, 500, 1,000, 5,000 and 25,000 EUR. Report executed orders, suppressed orders, commission, windows with trades and cash; do not treat the replay as a profitability forecast.

**UI rule:** `PortfolioExecutionPlan` may convert an ETF recommendation to `REVIEW / NO OPERAR` even when whole shares are affordable if the cost policy rejects the order. The theoretical recommendation remains visible as rationale.

## Change protocol

When a durable decision changes:

1. modify the relevant section rather than silently contradicting it elsewhere;
2. record the reason;
3. update `PROJECT_STATE.md` if it affects current status or next steps;
4. add/update deterministic tests where the decision changes executable behaviour.
