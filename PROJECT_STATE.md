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

## Latest recorded full validation before current execution-policy block

Latest recorded `validation-results/latest-aistudio.json` is from **2026-08-28 17:55 UTC** and is green:

- `technicalBlockers: []`;
- `researchReady: true`;
- `readyForManualPilot: false`;
- lint PASS;
- build PASS;
- decision 7/7 PASS;
- decision backtest 8/8 PASS;
- causal universe 13/13 PASS;
- broker execution 14/14 PASS;
- execution fidelity 10/10 PASS;
- opportunity, portfolio, multi-asset, analytics and regime suites PASS.

Latest recorded causal/broker diagnostic around that run:

- 100 EUR research backtest → about 112.46 EUR;
- return about +12.46%;
- max drawdown about 2.64%;
- about 488 research trades;
- MyInvestor minimum-fee lower bound about 488 EUR;
- minimum capital for the same raw order count to keep minimum commission drag <=2% about 24,400 EUR.

This confirms again that the research signal path is technically healthy but cannot be translated literally into broker orders at small capital.

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

The 17:55 UTC suite validated the previous actionable-operation UI and all earlier code, but the **new cost-aware policy / broker-aware replay / capital sweep commits were added after that run**.

Therefore do not yet claim this newest block is validated until a new `npm run validate:aistudio` result is recorded.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of the ultimately recommended ticker/ISIN set remains unverified.
- 100 EUR is structurally too small for many diversified whole-share ETF allocations.
- The new cost-aware replay must be measured before deciding whether the 100 EUR case is practical or should stay in cash/funds/one-position mode.
- Historical universe retains survivorship/catalog-availability bias.
- Yahoo remains unofficial despite successful EODHD validation of the current listed shortlist.
- Fund replay is intentionally conservative/incomplete: fund target weights are held as cash.
- Fund transfer eligibility is not inferred solely from `transferable`; final tax/operational eligibility must be confirmed by broker/entity.

## Immediate next step

Run:

`npm run validate:aistudio`

Then retrieve automatically:

1. `validation-results/latest-aistudio-run.json`;
2. `validation-results/latest-aistudio.json`;
3. `validation-results/latest-broker-backtest-feasibility.json`;
4. `validation-results/latest-broker-aware-execution-sweep.json`;
5. branch `validation-results` as fallback if needed.

Confirm specifically:

- lint/build remain green;
- `test:portfolio-execution-plan` passes;
- `test:cost-aware-execution` passes;
- causal/research suites remain green;
- capital sweep is generated for all six capitals;
- order suppression materially reduces broker order count;
- no negative cash or fee-budget violation;
- compare 100/334/500/1k/5k/25k before changing policy thresholds.

Do not tune thresholds merely to make 100 EUR look viable. Any threshold change must be evidence-based and recorded in D22.

## Working protocol for future chats

1. Read this file from `fmaranis/Trading/main`.
2. Read `docs/DECISIONS.md` when architecture/policy matters.
3. Inspect current `main` before assuming state is current.
4. Read `validation-results/latest-*.json` from `main`, then branch `validation-results`, before asking for validation output.
5. Continue from **Immediate next step** unless priority is explicitly changed.
6. After meaningful work, update this file again.
