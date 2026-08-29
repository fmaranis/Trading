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

## D24. Primary UI is decision-first; research tools must not duplicate the actionable flow

**Decision:** the main page should communicate one hierarchy: current decision → real portfolio → pending manual operations → alerts. Technical/research evidence may remain available but must not repeat a second execution plan or a weaker backtest beside the validated causal evidence.

**UI cleanup:** the simple allocation-backtest card was removed from the primary decision page; the duplicate static ETF execution summary was removed because `PortfolioExecutionPlanPanel` is now the actionable execution surface; provider details and decision history are collapsed by default. `portfolio.html` is explicitly labeled **Laboratorio cuantitativo**, not “Cartera”, because it uses a research universe and simulated capital. `legacy.html` remains available only as a historical/experimental interface.

**Fund-selection rule:** zero historical fund operations must not be “fixed” by forcing funds into the shortlist. The live sweep must diagnose each fund's 252-bar causal eligibility, current acceptance, current shortlist status and historical selection appearances. A fund with insufficient pre-decision history is distinct from a fund that was eligible but lost on score/category deduplication.

**Regression rule:** `mixedInstrumentCausalReplay.unit.ts` must prove independently that when a causal selection genuinely includes a mutual fund, the mixed engine can subscribe it and later release/review it without negative cash. This separates engine capability from live-universe selection evidence.

## D25. Broker availability is an evidence state, not an assumption

**Decision:** market-data validity and MyInvestor/Inversis tradability are separate facts. `brokerAvailability.ts` records broker evidence without changing research scores.

Current first-party MyInvestor evidence may set `CONFIRMED_MYINVESTOR`. Historical first-party evidence does not prove current availability and therefore remains `REQUIRES_INVERSIS_LOOKUP`. Failure to find an instrument on a public MyInvestor page is never, by itself, proof of unavailability.

As of 2026-08-28, first-party MyInvestor content supports current MyInvestor presence for Vanguard Global Stock Index `IE00B03HD191`, Vanguard Emerging Markets Stock Index `IE0031786696`, and Vanguard U.S. 500 Stock Index `IE0032126645`. Vanguard ESG Developed World `IE00B5456744` has historical MyInvestor evidence but current standalone availability is not proven. Active shortlisted ETFs remain `REQUIRES_INVERSIS_LOOKUP` until their exact ISIN/ticker is confirmed.

A recommendation may remain research-valid while broker availability is pending, but it must not be represented as broker-confirmed/executable solely from exchange listing or third-party broker evidence.

## D26. User broker confirmations are persistent evidence and must remain distinguishable from official evidence

**Decision:** the user may manually confirm whether an exact ISIN/ticker is available in their MyInvestor account. `ManualMyInvestorAvailabilityService` persists that result by normalized ISIN/ticker in browser localStorage.

Manual `AVAILABLE` becomes the effective `CONFIRMED_MYINVESTOR` state with evidence `USER_CONFIRMED_MYINVESTOR` and must render as **“Confirmado por ti en MyInvestor”**. Manual `UNAVAILABLE` becomes `USER_CONFIRMED_UNAVAILABLE`; it means only that the user did not find the instrument at the recorded time and must not be presented as an official delisting or global unavailability claim.

Manual evidence has precedence in the actionable UI but does not mutate the separate first-party/public evidence registry. Removing the manual confirmation restores the underlying public evidence state. Confirmation controls belong on BUY/SUBSCRIBE/TRANSFER targets in `Operaciones pendientes`, keyed by exact ISIN/ticker.

Current persistence is device/browser-local. Cross-device/account sync requires a future authenticated storage layer and must not be implied before it exists.

`tests/brokerAvailability.unit.ts` must preserve persistence, available/unavailable override semantics, deletion/restoration, and separation of manual vs official evidence.

## D27. Cash remuneration is an execution hurdle for new investment

**Decision:** cash held in the user's remunerated MyInvestor account has an opportunity cost. The research ranking remains independent, but `Operaciones pendientes` must not propose deploying new cash into an ETF/fund unless the current return proxy beats the configured annual cash benchmark after modeled ETF entry commission.

The default user benchmark is **2.5% annual**, stored separately in `cashBenchmark.ts` / browser localStorage and editable from the execution-plan UI because the account remuneration may change.

The current comparison proxy annualizes the scanner's REAL trailing 120-session momentum to 252 sessions. For ETFs, estimated entry commission drag is subtracted from the first-year proxy before comparison. Funds currently use zero explicit transaction commission because broker-specific fund fees remain unverified. This proxy is historical/diagnostic and must never be described as a forecast or guaranteed expected return.

If the net proxy is `<=` the cash benchmark, or cannot be computed, the target becomes `REVIEW` with explicit **“Mantener en cuenta / no invertir todavía”** wording. The theoretical research signal is preserved for auditability; only execution is suppressed. The same hurdle applies to a proposed fund destination before suggesting a transfer, while tax/operational transfer considerations remain separate.

`tests/portfolioExecutionPlan.unit.ts` must prove that investments beating the benchmark can remain actionable and investments below it are suppressed to review.

## D28. Historical execution must compete against remunerated cash on identical dates

**Decision:** the historical executable replay must measure whether taking investment risk added value versus leaving the same starting capital in the configured remunerated cash account.

`remuneratedCash.ts` compounds the annual cash reference across actual calendar-day gaps using a 365-day basis. `MixedInstrumentCausalReplayEngine` applies that growth only to the residual cash balance while ETF/fund positions remain invested. In parallel, an all-cash benchmark keeps the complete initial capital remunerated from the first replay date to the last.

The replay must expose final all-cash value/return, interest earned by strategy residual cash, final EUR excess versus all-cash, percentage-point excess, and a boolean indicating whether the strategy beat cash. A no-trade replay must exactly equal the all-cash benchmark; a 0% cash rate must reproduce the legacy no-trade result.

The primary app must show this comparison on demand, using the currently selected capital, risk profile, horizon and cash benchmark. It must not run automatically at page startup because the causal replay is materially heavier than the current-decision calculation.

This comparison remains historical diagnostic evidence. It must not be described as an expected return or guarantee, and the configured cash rate itself must not be presented as permanently guaranteed by the broker.

## Change protocol

When a durable decision changes:

1. modify the relevant section rather than silently contradicting it elsewhere;
2. record the reason;
3. update `PROJECT_STATE.md` if it affects current status or next steps;
4. add/update deterministic tests where executable behaviour changes.
