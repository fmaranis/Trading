# Trading — Permanent Architecture & Product Decisions

This document records durable decisions that should survive chat changes. Operational status and the next task live in `PROJECT_STATE.md`. The master flow and closure route live in `docs/APP_FLOW_AND_ROADMAP.md`.

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

## D10. Discovery shortlist and diversification are separate layers

**Decision:** the product shortlist is a **dynamic Top64 maximum/target**, not a fixed whitelist and not a one-asset-per-category selector. `AssetUniverseScanner` discovers/ranks the current REAL candidates; when the dynamic shortlist is applied, up to 64 valid candidates may remain even when several share an exposure category. Diversification, concentration limits and category caps belong downstream in `PortfolioCandidateGate` / allocation. A defensive exposure may be considered by those downstream policies, but discovery must not suppress otherwise valid candidates merely to enforce one-per-category.

This decision supersedes the earlier scanner-level one-per-category rule for the canonical current/live product. Historical research engines that explicitly reproduce an older formula must remain labeled as research/legacy diagnostics and cannot redefine production architecture.

## D11. Confidence is evidence quality, not probability of profit

**Decision:** confidence communicates evidence/data quality, not expected win probability. Current cap remains 85.

## D12. Risk-profile methods

LOW → Inverse Volatility; MEDIUM → Risk Parity ERC; HIGH → Relative Momentum. Regime logic may increase cash defensively where the relevant engine/policy uses those methods. This historical allocation-method mapping does not override the current canonical `PortfolioDecisionEngine -> CORE_GATE_V1 -> CORE_ARCHITECTURE_V1` chain.

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

`brokerAwareCausalReplay.ts` replays already-causal research selection dates under execution constraints. It remains a research execution diagnostic, not a second product decision engine.

## D23. Execution thresholds adapt to capital; mixed ETF/fund replay uses instrument-specific semantics

**Decision:** execution quality cannot use one fixed threshold set for 100 EUR and 25,000 EUR. `adaptiveExecutionPolicy.ts` chooses a deterministic capital band and changes only execution thresholds, never research scores or target weights.

Current historical/research bands:

- MICRO `<300 EUR`: 12 pp minimum drift, 100 EUR minimum ETF order, 1.25% max order fee drag, 0.50% max rebalance fee budget;
- SMALL `300–999 EUR`: 8 pp, 80 EUR, 1.50%, 0.75%;
- MEDIUM `1,000–4,999 EUR`: 6 pp, 75 EUR, 1.50%, 0.75%;
- LARGE `5,000–24,999 EUR`: 4 pp, 100 EUR, 1.25%, 0.60%;
- INSTITUTIONAL `>=25,000 EUR`: 3 pp, 150 EUR, 1.00%, 0.50%.

**Mixed replay:** `mixedInstrumentCausalReplay.ts` models ETFs/ETCs as whole-share broker orders but mutual funds by EUR amount and NAV with fractional units. ETF target weights are measured against total portfolio equity, including remaining mutual-fund value.

**Fund operations:** historical fund operations may be labeled `SUBSCRIBE`, `REDEEM` or `TRANSFER_REVIEW`. `TRANSFER_REVIEW` is only a possible transfer candidate; it never asserts tax eligibility. Fund subscriptions/redemptions currently assume no explicit transaction commission in the diagnostic and do not simulate settlement delays, taxation or transfer processing time unless a later canonical replay layer explicitly models them.

These outputs are historical execution diagnostics, not forecasts and not an alternative product execution chain.

## D24. Primary UI is decision-first; research tools must not duplicate the actionable flow

**Decision:** the main page communicates one hierarchy: current decision → real portfolio → executable/review plan → registration/follow-up. Technical/research evidence may remain available but must not emit a second actionable decision or execution plan.

**Current route contract:**

- `/` is the canonical actionable product surface;
- `/portfolio.html` is explicitly a quantitative/research laboratory with no authority to emit an alternative product recommendation;
- `/legacy.html` **does not expose the old product**; it redirects to `/` and is not a supported historical/experimental actionable interface.

`MarketUtilityDashboard` owns one canonical `portfolioDecision` and one downstream execution plan. Product child panels consume those same objects rather than recalculating gates/portfolio decisions independently.

Research-only cards, older engines and compatibility adapters may remain in the repository for research/history, but they do not acquire product authority by being present in code.

## D25. Broker availability is an evidence state, not an assumption

**Decision:** market-data validity and MyInvestor/Inversis tradability are separate facts. `brokerAvailability.ts` records broker evidence without changing research scores.

Current first-party MyInvestor evidence may set `CONFIRMED_MYINVESTOR`. Historical first-party evidence does not prove current availability and therefore remains `REQUIRES_INVERSIS_LOOKUP`. Failure to find an instrument on a public MyInvestor page is never, by itself, proof of unavailability.

As of 2026-08-28, first-party MyInvestor content supported MyInvestor presence for the documented Vanguard examples at that date; those observations are evidence snapshots, not a guarantee of permanent availability. Exact current ticker/ISIN availability can still require current verification.

A recommendation may remain research-valid while broker availability is pending, but it must not be represented as broker-confirmed/executable solely from exchange listing or third-party broker evidence.

## D26. User broker confirmations are persistent evidence and remain separate from official evidence

**Decision:** the user may manually confirm whether an exact ISIN/ticker is available in their MyInvestor account. `ManualMyInvestorAvailabilityService` keeps that confirmation logically separate from first-party/public evidence.

Manual `AVAILABLE` becomes the effective `CONFIRMED_MYINVESTOR` state with evidence `USER_CONFIRMED_MYINVESTOR` and renders as user-confirmed evidence. Manual `UNAVAILABLE` becomes `USER_CONFIRMED_UNAVAILABLE`; it means only that the user did not find the instrument at the recorded time and must not be presented as an official delisting or global unavailability claim.

Manual evidence has precedence in the actionable UI but does not mutate the separate public evidence registry. Removing the manual confirmation restores the underlying public evidence state.

**Persistence:** the service may use the existing local representation/cache, but authenticated private-state synchronization includes `custodia_myinvestor_manual_availability_v1` in Firestore by UID. Therefore the canonical deployed architecture is no longer “device-only”: after authenticated cloud-state hydration/sync, this private evidence can persist with the user's account while remaining isolated from other users. Local storage remains a cache/representation, not the shared identity source.

`tests/brokerAvailability.unit.ts` must preserve available/unavailable override semantics, deletion/restoration and separation of manual vs official evidence. Private-user security tests must protect cross-user isolation of synchronized state.

## D27. Cash remuneration is an execution hurdle for new investment

**Decision:** cash held in a remunerated account has an opportunity cost. Research ranking remains independent, but the executable layer must not present deployment of new cash as mandatory when the configured cash hurdle is not cleared.

The current cash benchmark is user/configuration state and may change. It must not be described as a permanently guaranteed broker rate.

Historical/current comparison proxies remain diagnostic evidence, not forecasts or guaranteed expected returns. Execution suppression preserves the underlying theoretical/research signal for auditability.

## D28. Historical execution must compete against remunerated cash on identical dates

**Decision:** historical executable replay must measure whether taking investment risk added value versus leaving the same starting capital in the selected cash benchmark over identical dates.

The replay must keep portfolio cash accounting and cash-benchmark accounting independent, avoid duplicated interest/tax, and expose comparable final/excess metrics. When external cash flows exist, they are not return and must be reflected through flow-adjusted metrics; a benchmark that cannot receive equivalent flows must be shown as N/D rather than invented.

This comparison remains historical diagnostic evidence and is not an expected return or guarantee.

## D29. Product UX is a unified decision loop, not a dashboard of disconnected analytics

**Decision:** the default user experience answers the investment question and leads into the user's portfolio without requiring the user to reconcile independent engines.

The actionable hierarchy is: complete current market/portfolio evidence → canonical portfolio decision → single executable/review plan → registration of real execution → follow-up. Heavy research charts/provider diagnostics remain secondary.

The app may preserve rich analytics, but new analytical widgets should not be added to the primary page unless they change or explain the canonical actionable decision. Research-only tools belong behind secondary/lab surfaces and have no independent execution authority.

## D30. Core usefulness must not require paid external data subscriptions

**Decision:** the primary decision, historical replay, strategy comparison and portfolio simulation should remain usable with free/zero-incremental-cost data paths available to the application where feasible. No new strategy may silently make a paid market-data/news/fundamental subscription a runtime requirement.

A free source may be replaced if it becomes unreliable, but the architecture must degrade explicitly rather than silently fabricating data or forcing a paid plan. Premium fundamentals/news may only be optional future evidence layers unless an explicit future architecture decision changes this rule.

## D31. Allocation drift is not a sell signal; existing holdings have a higher action threshold

**Decision:** a position being above theoretical target weight is diagnostic information, not sufficient evidence to sell. Existing positions require stronger health/deterioration evidence than new-money decisions.

A weak recent window or an overweight category alone cannot authorise a sell. The portfolio UI must distinguish theoretical distribution from executable action. Current health decisions flow through the canonical portfolio/health chain and downstream execution controls.

## D32. Historical dated-decision replay is a mandatory sanity check before promoting new strategy logic

**Decision:** historical decision/replay research must answer what the app could have known and recommended at a historical date using only information available then, with execution after the signal.

Historical research engines that reproduce older shortlist/allocation formulas remain diagnostic and must be labeled accordingly. They do not override the current dynamic-Top64 product architecture.

The current historical universe retains survivorship/catalog limitations and must say so. Promotion of new policy logic requires frozen rules and fresh/blind/OOS evidence appropriate to the claim; historical sanity checks are not survivorship-bias-free proof.

## D33. Dynamic market selection is the canonical product discovery architecture

**Decision:** current/live production uses `AssetUniverseScanner -> dynamic Top64 -> PortfolioCandidateGate`. The 64 names are not frozen; the rules are. Yahoo current discovery cannot be used retrospectively to invent a historical universe. `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md` is normative for this point.

## D34. Product decisions and economic research are one chain with different authority

**Decision:** research may add audit fields, shadow modes or explicit research options inside existing architecture, but must not create independent product engines. Production remains `LEGACY` until a candidate policy has valid fresh evidence. A research FAIL does not automatically invalidate the predictive information feeding it.

## D35. Private account state is cloud-persisted by UID in the deployed architecture

**Decision:** Firebase Authentication + server-side token verification + Firebase Admin SDK + Firestore private state form the canonical account/persistence architecture. `localStorage` is an isolated cache/representation after authentication, not the source of user identity. An admin may manage account metadata/claims but must not gain client access to another user's private financial state.

## D36. Operational alerts must reuse canonical/shared decision logic

**Decision:** backend alert automation must not duplicate trading rules. Entry alerts reuse the existing opportunity engine; portfolio-management alerts must reuse shared portfolio-health/canonical decision logic and maintain dedupe per user. Any residual backend path capable of producing a rotation/action through a non-canonical engine must be audited before V1 operational closure.

## D37. Methodological samples are consumable evidence

**Decision:** once a historical sample has been used to design or interpret a candidate economic policy, it is consumed for promotion. It may still diagnose causal reach, bugs, architecture or signal behavior, but thresholds/coefficients/confirmation rules cannot be retuned on that sample and then presented as validated. Promotion requires policy freeze before fresh/blind/OOS evidence.

## Change protocol

When a durable decision changes:

1. modify the relevant section rather than silently contradicting it elsewhere;
2. record the reason;
3. update `PROJECT_STATE.md` if it affects current status or next steps;
4. add/update deterministic tests where executable behaviour changes;
5. keep `docs/APP_FLOW_AND_ROADMAP.md` aligned when the change affects the closure route.