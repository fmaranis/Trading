# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-28

The application is a React + TypeScript + Vite research/decision-support tool. It analyses, ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-28 19:04 UTC**, green with `technicalBlockers: []`, `researchReady: true`, `readyForManualPilot: false`, lint/build PASS, all unit and causal suites green, and the adaptive ETF + mixed ETF/fund capital sweep recorded.

### Multi-capital adaptive & mixed execution sweep results (19:04 UTC)

Research signal baseline: 488 trades / 73 rebalance windows / +12.55% return.

#### Adaptive ETF sweep (by capital band)
- **100 EUR (MICRO)**: 0 orders executed, 584 suppressed, 73 windows suppressed. Equity remains **100.00 EUR** (+0.00%, max DD 0.00%, 0.00 EUR fees). Safely preserves capital without paying minimum fees.
- **334 EUR (SMALL)**: 16 orders executed, 575 suppressed, 12 active windows. Equity: **336.05 EUR** (+0.61% net, max DD 2.67%), total fees 16.00 EUR (4.79% drag).
- **500 EUR (SMALL)**: 18 orders executed, 574 suppressed, 12 active windows. Equity: **526.88 EUR** (+5.38% net, max DD 4.37%), total fees 18.00 EUR (3.60% drag).
- **1,000 EUR (MEDIUM)**: 31 orders executed, 568 suppressed, 15 active windows. Equity: **1,128.79 EUR** (+12.88% net, max DD 2.32%), total fees 31.00 EUR (3.10% drag).
- **5,000 EUR (LARGE)**: 114 orders executed, 698 suppressed, 39 active windows. Equity: **5,928.68 EUR** (+18.57% net, max DD 2.47%), total fees 140.83 EUR (2.82% drag).
- **25,000 EUR (INSTITUTIONAL)**: 141 orders executed, 701 suppressed, 40 active windows. Equity: **28,904.28 EUR** (+15.62% net, max DD 2.48%), total fees 460.27 EUR (1.84% drag).

#### Mixed ETF + mutual-fund sweep
- **100 EUR**: 0 ETF orders, 0 fund operations, 584 suppressed ETF orders, final equity **100.00 EUR**.
- **334 EUR**: 16 ETF orders, final equity **336.05 EUR** (+0.61% net).
- **500 EUR**: 18 ETF orders, final equity **526.88 EUR** (+5.38% net).
- **1,000 EUR**: 31 ETF orders, final equity **1,128.79 EUR** (+12.88% net).
- **5,000 EUR**: 95 ETF orders, final equity **5,914.14 EUR** (+18.28% net, 121.65 EUR fees / 2.43% drag).
- **25,000 EUR**: 139 ETF orders, final equity **28,913.53 EUR** (+15.65% net, 458.95 EUR fees / 1.84% drag).

## Data and causal integrity

- Yahoo Finance primary daily history; EODHD secondary ETF cross-check and fund NAV/history.
- REAL requests never silently fall back to synthetic.
- Scanner and causal historical selection require at least 252 bars.
- Historical selection uses only information available at the decision date.
- Current-catalog survivorship/availability bias remains explicit.
- Latest shortlist-wide EODHD check passed 6/6 listed ETFs and 2/2 funds.

## Decision engine

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- Confidence is evidence quality, not probability of profit.

## Broker / MyInvestor model

Modeled ETF rules:

- whole shares only;
- 0.12% commission;
- 1 EUR minimum/order;
- 25 EUR maximum/order;
- exact ticker/ISIN availability still requires MyInvestor/Inversis verification.

Research targets and executable actions are separate layers.

## Actionable portfolio workflow

`portfolioExecutionPlan.ts` + `PortfolioExecutionPlanPanel.tsx` produce persistent manual actions under `custodia_pending_execution_plan_v1`:

- `BUY_ETF`, `SELL_ETF`, `SUBSCRIBE_FUND`, `TRANSFER_FUND`, `REDEEM_FUND`, `REVIEW`.

The checklist keeps ticker/ISIN, amount/shares, estimated ETF fee, rationale and completion state. Fund transfer review never asserts final tax/operational eligibility.

## Cost-aware execution — validated 18:33 UTC

`costAwareExecutionPolicy.ts` can suppress trades because of:

- small allocation drift;
- less than one whole share;
- small notional;
- excessive fee drag;
- rebalance fee budget;
- insufficient cash.

Previous fixed-policy replay reduced the ~490 theoretical research trades to between 0 and 88 executed ETF orders depending on capital. At 100 EUR it correctly chose 100% cash instead of destructive fee turnover.

## NEW: capital-adaptive execution policy — implemented, pending fresh validation

New module:

- `src/investment/decision/adaptiveExecutionPolicy.ts`

Durable decision: `docs/DECISIONS.md` D23.

Execution bands:

- MICRO `<300 EUR`: 12 pp drift, 100 EUR min ETF order, 1.25% max order fee drag, 0.50% max rebalance fee budget;
- SMALL `300–999 EUR`: 8 pp, 80 EUR, 1.50%, 0.75%;
- MEDIUM `1,000–4,999 EUR`: 6 pp, 75 EUR, 1.50%, 0.75%;
- LARGE `5,000–24,999 EUR`: 4 pp, 100 EUR, 1.25%, 0.60%;
- INSTITUTIONAL `>=25,000 EUR`: 3 pp, 150 EUR, 1.00%, 0.50%.

This changes execution only. Research scores/targets are unchanged.

`PortfolioExecutionPlan` now also selects the adaptive band from `portfolioDecision.totalPlannedCapitalEur`, so the real checklist and historical execution diagnostics no longer use conflicting fixed thresholds.

New deterministic test:

- `tests/adaptiveExecutionPolicy.unit.ts`
- command: `npm run test:adaptive-execution`
- included in `validate:aistudio:raw`.

`tests/portfolioExecutionPlan.unit.ts` was updated to test MEDIUM and MICRO adaptive behavior.

## NEW: mixed ETF + mutual-fund causal execution replay — implemented, pending fresh validation

New module:

- `src/investment/decision/mixedInstrumentCausalReplay.ts`

Scope:

`MIXED_ETF_FUND_BROKER_AWARE_REPLAY_ON_CAUSAL_SELECTIONS`

Semantics:

- causal selection dates remain those of the research backtest;
- ETFs/ETCs execute as whole-share broker orders under the adaptive MyInvestor policy;
- mutual funds execute by EUR amount and NAV with fractional units;
- ETF target weights are measured against **total portfolio equity**, including current fund value;
- fund operations use separate drift/minimum-movement gates;
- possible fund-to-fund moves can be labeled `TRANSFER_REVIEW`, but this is only a review candidate;
- no claim of fiscal eligibility;
- fund transaction commission is currently modeled as zero for this diagnostic;
- settlement delay, taxation, spread/cánones and transfer processing time are not simulated.

This is still a historical execution diagnostic, not a profitability forecast.

## Updated capital sweep — pending fresh validation

`scripts/brokerAwareExecutionSweepLive.ts` now produces two parallel sweeps for:

- 100 EUR;
- 334 EUR;
- 500 EUR;
- 1,000 EUR;
- 5,000 EUR;
- 25,000 EUR.

Outputs:

1. **adaptiveEtfSweep** — ETF-only execution using capital-specific thresholds;
2. **mixedSweep** — ETF + fund execution with instrument-specific semantics.

The existing marker remains `BROKER_AWARE_EXECUTION_SWEEP_RESULT`, so automatic result retrieval continues through `validation-results/latest-broker-aware-execution-sweep.json`.

## Validation recording

`npm run validate:aistudio` records:

- `latest-aistudio-run.json` even on early failure;
- `latest-aistudio.json`;
- `latest-broker-backtest-feasibility.json`;
- `latest-broker-aware-execution-sweep.json`.

Do not ask the user to paste normal validation output. Read `main` first and branch `validation-results` second.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of selected ticker/ISINs is still unverified.
- Fund settlement/tax/transfer timing is not yet simulated in the mixed replay.
- Fund transaction-fee assumptions need broker-specific verification before manual-pilot claims.
- Historical universe retains current-catalog survivorship bias.
- Yahoo remains unofficial/non-contractual.

## Immediate next step

Run a fresh:

`npm run validate:aistudio`

Then retrieve the recorded files automatically and specifically verify:

1. TypeScript/lint and build;
2. adaptive policy unit tests;
3. updated portfolio execution-plan tests;
4. mixed replay completes on REAL mixed universe without negative cash/accounting errors;
5. compare adaptive ETF-only vs mixed ETF+fund results across all six capital levels;
6. ensure previous decision/causal/broker suites remain green.

If green, update this file with the new recorded sweep and then move to exact MyInvestor/Inversis instrument-availability verification and stronger fund settlement/transfer modeling.
