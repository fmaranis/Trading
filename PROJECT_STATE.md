# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-28

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-28 21:33 UTC**, green with `technicalBlockers: []`, `researchReady: true`, `readyForManualPilot: false`, lint/build PASS and all recorded suites (decision, causal, adaptive, mixed replay, analytics) green.

### Recorded adaptive ETF execution sweep (21:33 UTC)

Research reference: about 483 trades / 73 rebalance windows / +12.53% research return.

- **100 EUR (MICRO):** 0 orders, 584 suppressed, 100 EUR cash (0% return, 0 fees).
- **334 EUR (SMALL):** 16 orders, +0.61% net, 16 EUR fees (4.79% drag).
- **500 EUR (SMALL):** 18 orders, +5.38% net, 18 EUR fees (3.60% drag).
- **1,000 EUR (MEDIUM):** 33 orders, +12.69% net, 33 EUR fees (3.30% drag).
- **5,000 EUR (LARGE):** 112 orders, +17.23% net, 138.04 EUR fees (2.76% drag).
- **25,000 EUR (INSTITUTIONAL):** 145 orders, +15.01% net, 470.59 EUR fees (1.88% drag).

### Fund eligibility diagnosis (21:33 UTC)

- `acceptedFunds`: 8.
- `currentlySelectedFunds`: 2.
- `fundsEverSelectedCausally`: 0.
- `noMonthlyWindowAfterEligibility`: 8 (all 8 accepted funds reached the mandatory 252-bar threshold only *after* the last monthly causal backtest rebalance window).
- `eligibleButNotSelected`: 0.

This formally confirms that the live zero-fund historical operations result from historical NAV length rather than an engine flaw or ranking exclusion. `tests/mixedInstrumentCausalReplay.unit.ts` confirms that when causal fund history exists, the engine executes subscriptions, releases and accounting properly.

Historical diagnostics only, not forecasts.

## Data / causal integrity

- Yahoo primary daily history; EODHD secondary ETF cross-check and mutual-fund NAV/history.
- REAL never silently falls back to synthetic.
- Scanner and causal selection require at least 252 bars.
- Historical selection uses only information available at each decision date.
- Current-catalog survivorship/availability bias remains explicit.

## Decision / broker model

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- Confidence means evidence quality, not probability of profit.
- MyInvestor ETF model: whole shares, 0.12%, min 1 EUR/order, max 25 EUR/order.
- Exact ticker/ISIN availability still requires MyInvestor/Inversis verification.

## Actionable workflow

Primary user flow is now intentionally:

1. current market decision;
2. **Mi cartera real**;
3. **Operaciones pendientes**;
4. alerts/changes;
5. collapsed technical/history detail.

`portfolioExecutionPlan.ts` + `PortfolioExecutionPlanPanel.tsx` produce `BUY_ETF`, `SELL_ETF`, `SUBSCRIBE_FUND`, `TRANSFER_FUND`, `REDEEM_FUND`, `REVIEW` with ticker/ISIN, orientative amount/shares, estimated ETF fee, rationale and completion status.

## Capital-adaptive execution

`adaptiveExecutionPolicy.ts` changes only execution gates, never research targets:

- MICRO `<300`: 12 pp drift / 100 EUR min ETF order / 1.25% max order fee drag / 0.50% window fee budget.
- SMALL `300–999`: 8 pp / 80 EUR / 1.50% / 0.75%.
- MEDIUM `1,000–4,999`: 6 pp / 75 EUR / 1.50% / 0.75%.
- LARGE `5,000–24,999`: 4 pp / 100 EUR / 1.25% / 0.60%.
- INSTITUTIONAL `>=25,000`: 3 pp / 150 EUR / 1.00% / 0.50%.

## Mixed ETF + fund replay

`mixedInstrumentCausalReplay.ts`:

- ETFs: whole-share broker execution;
- funds: EUR/NAV with fractional units;
- possible fund operations: `SUBSCRIBE`, `REDEEM`, `TRANSFER_REVIEW`;
- ETF targets are measured against total equity including fund value;
- no negative cash;
- no claim of transfer tax eligibility;
- settlement/tax/transfer timing remains unmodeled.

The 19:16 live mixed sweep produced **0 fund operations at all six capital levels**. This is not being treated as an engine failure or “fixed” by forcing funds into the portfolio.

## New fund-selection diagnosis — implemented, pending fresh validation

`scripts/brokerAwareExecutionSweepLive.ts` now records per mutual fund:

- scanner acceptance/rejection;
- bar count and current score;
- current-shortlist presence;
- first date on which 252 historical fund bars exist;
- last causal monthly information date;
- historical causal selection appearances;
- diagnosis:
  - `NO_MONTHLY_CAUSAL_WINDOW_AFTER_252_BAR_ELIGIBILITY`,
  - `ELIGIBLE_BUT_OUTRANKED_OR_CATEGORY_DEDUPED`,
  - `SELECTED_CAUSALLY`, or rejection reason.

This should determine whether the live zero-fund result is simply caused by insufficient historical NAV depth before the last monthly decision. Current evidence strongly points that way because accepted funds had only ~258 observations.

New deterministic regression:

- `tests/mixedInstrumentCausalReplay.unit.ts`
- command: `npm run test:mixed-instrument-replay`
- included in `validate:aistudio:raw`.

It creates a causal mixed dataset where a fund genuinely enters and later leaves the selected universe, and requires the engine to produce a fund subscription followed by release/review while keeping cash non-negative. This separates **engine capability** from **live selection evidence**.

## UI de-duplication — implemented, pending fresh validation

Durable policy: `docs/DECISIONS.md` D24.

Removed from the primary decision flow:

- old/simple `DecisionBacktestEngine` card shown beside the modern causal/execution evidence;
- duplicate static `Ejecución ETF/ETC · MyInvestor` summary, because `Operaciones pendientes` is now the authoritative actionable surface;
- duplicate always-visible provider status at page top.

Collapsed by default:

- provider/coverage technical detail;
- decision history.

Navigation cleanup:

- `/portfolio.html` is now labeled **Laboratorio cuantitativo**, not “Cartera”; it uses SPY/GLD/QQQ/TLT research data and simulated capital, so it must not be confused with the real portfolio.
- `/legacy.html` is explicitly **Legacy** / historical experimental UI.

No research engines were deleted merely because their presentation was removed. The goal is less duplication without losing validation capability.

## Validation recording

`npm run validate:aistudio` records:

- `validation-results/latest-aistudio-run.json` even on early failure;
- `latest-aistudio.json`;
- `latest-broker-backtest-feasibility.json`;
- `latest-broker-aware-execution-sweep.json`.

Do not ask the user to paste normal output. Read `main`, then branch `validation-results` as fallback.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of selected ticker/ISIN remains unverified.
- Fund settlement/tax/transfer timing is not yet simulated.
- Historical universe retains current-catalog survivorship bias.
- Yahoo remains unofficial/non-contractual.

## Immediate next step

1. Advance instrument availability verification against MyInvestor/Inversis for the active shortlisted universe.
2. Advance fund settlement/transfer modeling when actual broker rules are specified.
