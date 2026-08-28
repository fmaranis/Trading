# Trading — Permanent Architecture & Product Decisions

This document records durable decisions that should survive chat changes. Operational status and the next task live in `PROJECT_STATE.md`.

## D1. Repository is the memory source of truth

**Decision:** `fmaranis/Trading/main` is canonical. Chat memory is supplementary only.

## D2. No GitHub Actions dependency

**Decision:** do not add or rely on GitHub Actions for validation or operation.

## D3. Research/decision support, not autonomous trade execution

**Decision:** the application may analyse, rank, backtest, alert and propose execution plans, but it must not pretend to place broker trades unless a future explicit broker integration is implemented and verified.

## D4. REAL data never silently becomes synthetic

**Decision:** `REAL` requests must either return validated real data or fail explicitly.

## D5. Yahoo Finance primary, EODHD secondary

**Decision:** Yahoo Finance is currently the primary daily historical market-data source. EODHD is secondary for cross-validation and fund data. Provider and freshness semantics remain explicit.

## D6. Cross-provider discrepancies are evidence, not hidden corrections

**Decision:** compare providers explicitly rather than silently replacing one price with another. Current ETF tolerance is 1%.

## D7. Cache secondary-provider checks

**Decision:** EODHD cross-check results are cached for 24 h for unchanged ETF checks; fund-history data uses a shorter cache.

## D8. Causal backtests are mandatory for decision claims

**Decision:** historical selection/decision validation uses only information available at the decision date. Default convention is Close(t-1) information and Open(t) execution where supported.

## D9. Current-catalog causal reselection is not survivorship-bias-free

**Decision:** the current-queryable universe may support causal research evidence but retains an explicit residual survivorship/catalog warning.

## D10. Scanner diversification by exposure category

**Decision:** shortlist selection permits at most one selected asset per category and tries to retain a defensive exposure when available.

## D11. Confidence is evidence quality, not probability of profit

**Decision:** confidence communicates evidence/data quality, not expected win probability. Current cap remains 85.

## D12. Risk-profile methods

LOW → Inverse Volatility; MEDIUM → Risk Parity ERC; HIGH → Relative Momentum. Regime logic may increase cash defensively.

## D13. Broker constraints must alter the executable plan

**Decision:** theoretical fractional allocations must not be shown as directly executable at a whole-share broker.

**Current MyInvestor model:** ETF fractions not supported; commission 0.12%; minimum 1 EUR/order; maximum 25 EUR/order; exact ticker/ISIN availability must still be verified.

## D14. Diversification quality is separate from affordability

**Decision:** distinguish whether any whole-share order is affordable from whether the resulting portfolio preserves intended diversification, concentration and cost quality.

## D15. Small-capital experiments must expose structural limitations

**Decision:** if capital is too small to reproduce a strategy, calculate/report the limitation instead of fabricating fractional execution.

## D16. Deterministic local validation is the release gate

**Decision:** research readiness, manual-pilot readiness and broker/instrument verification remain separate. Green research tests do not imply real-money readiness.

## D17. Unified fund + ETF evidence is allowed, but provenance must remain explicit

**Decision:** ETF and fund evidence may coexist in one universe/portfolio layer while provider, price/NAV and freshness semantics remain explicit.

## D18. Opportunity-threshold research stays causal and diagnostic

**Decision:** alert thresholds may be researched and walk-forward tested but remain chronological/causal and non-predictive in wording.

## D19. Do not overclaim provider or broker verification

**Decision:** code support for a provider/broker rule is not equivalent to live verification of every asset or broker listing.

## D20. Backtest costs must be separated from broker-executable costs

**Decision:** percentage-only research commission models are not broker-executable evidence when a broker imposes fixed minimum commissions. `brokerBacktestFeasibility.ts` reports the lower bound and resulting drag separately.

## D21. Recommendations must become an explicit manual execution plan

**Decision:** ADD/REDUCE/REVIEW_TRANSFER labels must be convertible into a persistent manual checklist with ticker/ISIN, orientative amount/shares, rationale and completion status. Fund transfer review is preferred when a current fund is marked transferable and a supported fund destination exists, without asserting fiscal eligibility.

## D22. Research targets and cost-aware executable actions are separate layers

**Decision:** a change in theoretical target allocation is not sufficient reason to trade. The research signal remains unchanged and auditable while a separate execution policy may suppress/defer broker orders.

Base broker-aware rules are implemented in `costAwareExecutionPolicy.ts`: whole ETF shares, MyInvestor min/max commission, sell-before-buy ordering, no negative cash, drift threshold, minimum order notional, maximum fee drag per order and maximum fee budget per rebalance.

`brokerAwareCausalReplay.ts` replays the already-causal research selection dates under execution constraints. It remains an ETF execution diagnostic and may hold fund target weights as cash.

## D23. Execution thresholds adapt to capital; mixed ETF/fund replay uses instrument-specific semantics

**Decision:** execution quality cannot use one fixed threshold set for 100 EUR and 25,000 EUR. `adaptiveExecutionPolicy.ts` chooses a deterministic capital band and changes only execution thresholds, never research scores or target weights.

Current bands:

- MICRO `<300 EUR`: 12 pp minimum drift, 100 EUR minimum ETF order, 1.25% max order fee drag, 0.50% max rebalance fee budget;
- SMALL `300–999 EUR`: 8 pp, 80 EUR, 1.50%, 0.75%;
- MEDIUM `1,000–4,999 EUR`: 6 pp, 75 EUR, 1.50%, 0.75%;
- LARGE `5,000–24,999 EUR`: 4 pp, 100 EUR, 1.25%, 0.60%;
- INSTITUTIONAL `>=25,000 EUR`: 3 pp, 150 EUR, 1.00%, 0.50%.

**Mixed replay:** `mixedInstrumentCausalReplay.ts` models ETFs/ETCs as whole-share broker orders but mutual funds by EUR amount and NAV with fractional units. ETF target weights are measured against total portfolio equity, including remaining mutual-fund value.

**Fund operations:** historical fund operations may be labeled `SUBSCRIBE`, `REDEEM` or `TRANSFER_REVIEW`. `TRANSFER_REVIEW` is only a possible transfer candidate; it never asserts tax eligibility. Fund subscriptions/redemptions currently assume no explicit transaction commission in the diagnostic and do not simulate settlement delays, taxation or transfer processing time.

**Validation:** the capital sweep must report both adaptive ETF-only execution and mixed ETF+fund execution for 100, 334, 500, 1,000, 5,000 and 25,000 EUR. These outputs are historical execution diagnostics, not forecasts.

## Change protocol

When a durable decision changes:

1. modify the relevant section rather than silently contradicting it elsewhere;
2. record the reason;
3. update `PROJECT_STATE.md` if it affects current status or next steps;
4. add/update deterministic tests where executable behaviour changes.
