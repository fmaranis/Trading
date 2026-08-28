# Trading — Canonical Project State

> **Purpose:** operational memory of the project. New chats must read this file before continuing work.
>
> **Continuation instruction:** `Continúa Trading desde PROJECT_STATE.md`.
>
> **Maintenance rule:** after meaningful changes to architecture, providers, validation, decision/execution logic, tests, blockers or next steps, update this file in the same work block.

## Current reference

- Repository: `fmaranis/Trading`
- Canonical branch: `main`
- State updated: **2026-08-28**
- Repository, not chat memory, is the source of truth.
- Do not add or depend on GitHub Actions.

## Latest recorded full validation — 2026-08-28 18:33 UTC

Latest recorded run `validation-results/latest-aistudio-run.json` and marker files `latest-aistudio.json`, `latest-broker-backtest-feasibility.json`, and `latest-broker-aware-execution-sweep.json` are recorded and **green**:

- `technicalBlockers: []`;
- `researchReady: true`;
- `readyForManualPilot: false`;
- lint PASS;
- build PASS;
- `test:cost-aware-execution` PASS;
- `test:portfolio-execution-plan` PASS;
- decision 7/7 PASS;
- decision backtest 8/8 PASS;
- causal universe 13/13 PASS;
- broker execution 14/14 PASS;
- execution fidelity 10/10 PASS;
- opportunity, portfolio, multi-asset, analytics and regime suites PASS.

### Multi-capital broker-aware execution sweep results (18:33 UTC)

Research signal baseline: 491 trades / 73 rebalance windows / +12.55% return.

Replay with whole shares + MyInvestor fees + cost-aware no-trade gates (min 5 pp drift, min 50 € notional, max 2% order fee, max 1% window fee):

- **100 EUR**: 0 orders executed, 584 suppressed, 73/73 windows suppressed. Equity remains **100 EUR** in cash (0% return, 0% drawdown, 0 € fees). Confirms that at 100 EUR, suppressing uneconomic ETF turnover safely preserves capital instead of bleeding in minimum fees.
- **334 EUR**: 16 orders executed (vs 491 research), 575 suppressed, 12 active windows. Final equity: **336.05 EUR** (+0.61% net, max DD 2.67%), total fees 16 EUR (4.79% of initial capital).
- **500 EUR**: 20 orders executed, 573 suppressed, 12 active windows. Final equity: **564.85 EUR** (+12.97% net, max DD 4.09%), total fees 20 EUR (4.00% of initial capital).
- **1,000 EUR**: 43 orders executed, 571 suppressed, 18 active windows. Final equity: **1,107.52 EUR** (+10.75% net, max DD 2.88%), total fees 43 EUR (4.30% of initial capital).
- **5,000 EUR**: 77 orders executed, 732 suppressed, 25 active windows. Final equity: **5,936.85 EUR** (+18.74% net, max DD 2.81%), total fees 101.85 EUR (2.04% of initial capital).
- **25,000 EUR**: 88 orders executed, 647 suppressed, 30 active windows. Final equity: **29,362.38 EUR** (+17.45% net, max DD 2.48%), total fees 390.46 EUR (1.56% of initial capital).

**Key conclusion:** Cost-aware gating cuts executed order count by **82% to 100%**, completely eliminating the 490 EUR fee disaster on small accounts and making 500 €+ accounts realistically operable under MyInvestor pricing.

## Product shape

React + TypeScript + Vite research/decision-support application. It analyses, ranks, backtests, alerts and proposes manual execution plans; it does **not** submit broker trades.

Implemented areas now include:

- REAL historical data with provenance/fingerprints;
- Yahoo primary daily data, EODHD secondary validation/fund NAV;
- causal universe reselection;
- risk-profile portfolio decisions;
- whole-share MyInvestor modeling;
- broker feasibility diagnostics;
- actionable persistent portfolio operations;
- **cost-aware no-trade execution policy**;
- **broker-aware causal execution replay**;
- **multi-capital execution sweep**;
- opportunity research and portfolio analytics;
- Python/vectorbt comparison infrastructure.

## Data providers

### Yahoo Finance

- Primary daily historical source through server proxy.
- REAL requests never silently fall back to synthetic data.
- Yahoo is unofficial/non-contractual and is not described as exchange-grade real time.

### EODHD

- Server-side key, never exposed to client.
- Secondary/non-blocking ETF cross-validation and fund NAV/history source.
- Yahoo `.DE` maps to EODHD `.XETRA` for ETF checks.
- ETF tolerance: 1%.
- Cross-check cache TTL: 24 h; fund-history cache TTL: 6 h.

### Verified shortlist-wide EODHD result — 2026-08-28

`npm run test:eodhd-shortlist` passed with 8 selected assets: `XEON.DE`, `ISPA.DE`, `EUN6.DE`, `ZPRV.DE`, `EXSA.DE`, `IE00B5456744`, `XDWH.DE`, `IE0032126645`.

- listed ETFs: 6/6 checked and 6/6 matched;
- observed listed-ETF price difference: 0.00%;
- mutual funds: 2/2 routed through fund NAV pipeline;
- immediate rerun: 0 upstream calls and 8 cache hits;
- `validationPassed: true`.

## Causal integrity

- Scanner minimum history: 252 bars.
- `CausalUniverseBacktestEngine` enforces the same 252-bar minimum before historical scoring/selection.
- Causal warm-up cannot be forced below 252 bars.
- Regression tests cover history threshold, warm-up, future-data mutation invariance and accounting.
- Residual survivorship/catalog bias remains because delisted/no-longer-queryable historical instruments are absent.

## Decision engine

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- Regime overlay may increase cash defensively.
- Confidence means evidence/data quality, not probability of profit.
- Current confidence cap remains 85 unless evidence policy changes.

## Broker / MyInvestor model

Current modeled rules:

- no fractional ETF shares;
- ETF commission 0.12%;
- minimum 1 EUR/order;
- maximum 25 EUR/order;
- exact selected ticker/ISIN availability still requires MyInvestor/Inversis verification.

Theoretical allocation and executable portfolio are separate concepts.

## Actionable portfolio execution workflow

Files:

- `src/investment/decision/portfolioExecutionPlan.ts`
- `src/components/PortfolioExecutionPlanPanel.tsx`

Persistence key: `custodia_pending_execution_plan_v1`.

The panel appears immediately below **Mi cartera real** and can generate persistent manual actions:

- `BUY_ETF`;
- `SELL_ETF`;
- `SUBSCRIBE_FUND`;
- `TRANSFER_FUND`;
- `REDEEM_FUND`;
- `REVIEW`.

Each line may retain ticker/ISIN, amount, whole ETF shares, estimated commission, rationale, fund/fiscal note and status `PENDING`, `DONE` or `DISMISSED`.

Funds marked transferable prefer a fund-to-fund transfer review when a supported fund destination exists. The app does not claim final tax/operational eligibility.

## Cost-aware execution policy — implemented 2026-08-28

New module:

- `src/investment/decision/costAwareExecutionPolicy.ts`

Durable policy: `docs/DECISIONS.md` D22.

Default ETF execution gates:

- minimum absolute allocation drift: **5 percentage points**;
- minimum order notional: **50 EUR**;
- maximum modeled commission drag per order: **2%**;
- maximum total modeled commission per rebalance window: **1% of current equity**;
- whole shares only;
- MyInvestor modeled 0.12%, min 1 EUR, max 25 EUR;
- sells before buys;
- cash may never become negative.

Suppression reasons are explicit:

- `DRIFT_BELOW_THRESHOLD`;
- `BELOW_ONE_WHOLE_SHARE`;
- `ORDER_NOTIONAL_TOO_SMALL`;
- `ORDER_FEE_DRAG_TOO_HIGH`;
- `REBALANCE_FEE_BUDGET_EXCEEDED`;
- `INSUFFICIENT_CASH`.

The UI execution checklist now uses the same cost gate. A theoretical ETF recommendation can therefore become **REVISAR / NO OPERAR** rather than a buy/sell instruction when execution economics are poor. The theoretical recommendation remains visible as rationale.

## Broker-aware causal replay — implemented 2026-08-28

New module:

- `src/investment/decision/brokerAwareCausalReplay.ts`

Scope:

`BROKER_AWARE_ETF_EXECUTION_REPLAY_ON_CAUSAL_SELECTIONS`

Key design:

- uses the already-causal research `selectionHistory` dates;
- recomputes allocation using only historical selected data at each decision date;
- does not alter research signals to improve broker results;
- executes ETF targets using whole shares + cost-aware suppression;
- reports executed and suppressed orders, commissions, windows with trades, cash, return and drawdown.

Important conservative fund boundary:

- mutual-fund target weights are **held as cash** in this replay;
- they are not simulated as ETF trades;
- fund NAV/settlement/transfer semantics require a separate future model;
- therefore the replay is an execution/cost diagnostic, not a complete fund+ETF profitability forecast.

## Multi-capital execution sweep — implemented 2026-08-28

New live diagnostic:

- `scripts/brokerAwareExecutionSweepLive.ts`
- command: `npm run test:broker-aware-execution-sweep:live`

Capital levels:

- 100 EUR;
- 334 EUR;
- 500 EUR;
- 1,000 EUR;
- 5,000 EUR;
- 25,000 EUR.

For each level it records:

- final equity/return/drawdown;
- executed orders;
- suppressed orders;
- rebalance windows;
- windows with trades / fully suppressed;
- total commission;
- commission drag vs initial capital;
- residual cash.

This sweep is designed to answer whether cost-aware suppression materially improves practical executability instead of merely extrapolating `trades × 1 EUR`.

## New deterministic tests

- `tests/costAwareExecutionPolicy.unit.ts`
  - whole shares;
  - no negative cash;
  - broker minimum commission;
  - per-order fee cap;
  - rebalance fee budget;
  - small-drift suppression;
  - explicit suppression reasons;
  - broker-aware replay uses causal windows;
  - replay order count expected below fractional research trade count;
  - fund limitation explicit.

- `tests/portfolioExecutionPlan.unit.ts` expanded:
  - costed ETF buys/sells;
  - order with whole shares but too-small notional becomes `REVIEW`;
  - cost-policy warning explicit.

Commands:

- `npm run test:cost-aware-execution`
- `npm run test:portfolio-execution-plan`

Both are included in `validate:aistudio:raw`.

## Automatic validation-result recording — hardened again 2026-08-28

Normal user workflow must not require copying/pasting terminal output.

`npm run validate:aistudio` now expects and records:

- `AI_STUDIO_VALIDATION_RESULT` → `validation-results/latest-aistudio.json`;
- `BROKER_BACKTEST_FEASIBILITY_RESULT` → `validation-results/latest-broker-backtest-feasibility.json`;
- `BROKER_AWARE_EXECUTION_SWEEP_RESULT` → `validation-results/latest-broker-aware-execution-sweep.json`.

Additionally the wrapper **always** writes:

- `validation-results/latest-aistudio-run.json`

with exit code, expected/detected markers and a bounded output tail. Therefore even an early failure before structured markers should leave a retrievable run record.

`test:eodhd-shortlist` similarly writes a generic run record.

Publication to `main` remains best-effort and the dedicated branch `validation-results` remains fallback. No GitHub Actions are used.

## Current validation status of this newest block

The entire suite including the cost-aware policy, whole-share suppression, portfolio execution plan generator, deterministic unit tests, and live multi-capital broker-aware execution sweep has been validated and recorded at **18:33 UTC** with all tests passing and zero technical blockers.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of the ultimately recommended ticker/ISIN set remains unverified.
- 100 EUR is structurally too small for diversified whole-share ETF allocations; the cost-aware policy safely chooses not to trade (keeps 100% cash) rather than taking destructive fee drag.
- Historical universe retains survivorship/catalog-availability bias.
- Yahoo remains unofficial despite successful EODHD validation of the current listed shortlist.
- Fund replay is intentionally conservative/incomplete: fund target weights are held as cash.
- Fund transfer eligibility is not inferred solely from `transferable`; final tax/operational eligibility must be confirmed by broker/entity.

## Immediate next step

1. Model fund NAV subscription/redemption/transfer dynamics in the broker-aware replay so fund target weights don't sit in idle cash during mixed universe backtests.
2. Advance instrument availability verification against MyInvestor/Inversis for the active shortlisted universe.

## Working protocol for future chats

1. Read this file from `fmaranis/Trading/main`.
2. Read `docs/DECISIONS.md` when architecture/policy matters.
3. Inspect current `main` before assuming state is current.
4. Read `validation-results/latest-*.json` from `main`, then branch `validation-results`, before asking for validation output.
5. Continue from **Immediate next step** unless priority is explicitly changed.
6. After meaningful work, update this file again.
