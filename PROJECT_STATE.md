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

## Product shape

React + TypeScript + Vite research/decision-support application. It analyses, ranks, backtests, alerts and proposes manual execution plans; it does **not** submit broker trades.

Implemented areas include REAL historical data with provenance/fingerprints, Yahoo primary daily data, EODHD secondary validation/fund NAV, portfolio analytics, risk-profile decisions, ETF/ETC/fund scanning, causal universe reselection, whole-share MyInvestor modelling, broker execution-quality/minimum-capital checks, broker-aware backtest cost diagnostics, opportunity research, unified ETF+fund portfolios, actionable pending portfolio operations and Python/vectorbt comparison infrastructure.

## Latest recorded full validation — 2026-08-28

Automatic result files are available under `validation-results/`.

Latest completed suite before the new pending-operation UI block:

- `technicalBlockers: []`;
- `researchReady: true`;
- `readyForManualPilot: false`;
- lint PASS;
- build PASS;
- decision tests PASS;
- decision-backtest PASS;
- causal-universe tests **13/13 PASS**;
- broker-execution PASS;
- execution-fidelity PASS;
- opportunity tests PASS;
- user portfolio PASS;
- multi-asset PASS;
- portfolio analytics PASS;
- regime analytics PASS.

Universe scan:

- catalog: 38;
- accepted: 30;
- rejected: 8 (`MarketDataSymbolNotFoundError`);
- selected: 8.

Current causal MEDIUM research backtest from the recorded run:

- initial capital: 100 EUR;
- final equity: about **112.55 EUR**;
- total return: about **+12.55%**;
- max drawdown: about **2.63%**;
- trades: **486** in the AI Studio report;
- rebalance/selection windows: **73**.

The mixed ETF/fund universe completed the causal path successfully in this recorded run, so the previous concern that common-date alignment might prevent the engine from running is currently closed. Different ETF trading-date and fund NAV semantics remain a modeling limitation and must not be hidden.

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

## Broker / MyInvestor

Current modeled rules:

- no fractional ETF shares;
- ETF commission 0.12%;
- minimum 1 EUR/order;
- maximum 25 EUR/order;
- exact selected ticker/ISIN availability still requires MyInvestor/Inversis verification.

Theoretical allocation and executable portfolio are separate concepts.

Latest recorded manual-pilot blockers:

1. 100 EUR does not preserve the current MEDIUM diversification criteria; recorded minimum diversified capital estimate is about **334 EUR** for at least two positions under the current static execution-quality criteria.
2. Exact MyInvestor/Inversis availability of the selected ticker/ISIN set is not verified.
3. High-turnover causal research results are not directly executable under the broker minimum-fee model.

### Broker-aware backtest diagnostic

Latest live diagnostic reported approximately:

- 490 research trades/orders;
- modeled research commission: ~0.96 EUR;
- MyInvestor minimum-commission lower bound: **490 EUR**;
- lower-bound commission drag on 100 EUR: **490%**;
- minimum capital for that same order count to keep minimum-commission drag <=2%: **24,500 EUR**.

This does not mean the strategy requires 24,500 EUR in general. It means the current high-turnover research path cannot be translated literally into broker orders at 100 EUR. Real execution needs no-trade thresholds, batching/rebalance gating and/or lower turnover.

## Actionable portfolio execution workflow — implemented 2026-08-28

The previous UI showed `AUMENTAR`, `REDUCIR` and `REVISAR TRASPASO` but did not convert those recommendations into an actionable workflow. This gap is now implemented.

New decision module:

- `src/investment/decision/portfolioExecutionPlan.ts`

New UI:

- `src/components/PortfolioExecutionPlanPanel.tsx`

Persistence:

- localStorage key `custodia_pending_execution_plan_v1`.

The panel appears immediately below **Mi cartera real** and provides **Operaciones pendientes · Mi cartera**.

`Preparar operaciones` converts the current saved portfolio + current recommendation into persistent manual actions:

- `BUY_ETF` — whole-share ETF/ETC purchase;
- `SELL_ETF` — quantified whole-share reduction where possible;
- `SUBSCRIBE_FUND` — fund subscription by amount;
- `TRANSFER_FUND` — fund-to-fund transfer review;
- `REDEEM_FUND` — fund redemption review;
- `REVIEW` — non-executable/ambiguous case that needs manual review.

Each line can retain:

- source/destination ticker and/or ISIN;
- orientative amount;
- number of whole ETF shares;
- rationale;
- fund/fiscal note;
- status `PENDING`, `DONE` or `DISMISSED`.

Whole-share integrity:

- an ETF contribution below one full share is not emitted as a fake executable purchase;
- it becomes a `REVIEW` line with an explicit affordability warning.

Fund transfer policy:

- if an existing fund is marked transferable and a supported mutual-fund destination exists, the plan prefers **reviewing a transfer** before reimbursement + subscription;
- ETFs are never treated as destinations for a tax-deferred fund-to-fund transfer;
- the application does not assert tax or operational eligibility; MyInvestor/Inversis must confirm it before execution.

The workflow is manual guidance only. It does not submit orders to a broker. Durable policy is recorded in `docs/DECISIONS.md` D21.

New deterministic test:

- `tests/portfolioExecutionPlan.unit.ts`
- command: `npm run test:portfolio-execution-plan`
- added to `validate:aistudio:raw`.

**Important:** this new execution-plan block has been implemented but has not yet been validated by a fresh recorded `npm run validate:aistudio` after these commits. Do not claim it fully validated until that run is recorded.

## Automatic validation-result recording

The user must not be asked to copy/paste normal validation output into chat.

Recorded commands:

- `npm run validate:aistudio`
- `npm run test:eodhd-shortlist`

Result files are written under `validation-results/`. The wrapper attempts publication to `main` and uses dedicated branch `validation-results` as remote fallback when the validation checkout cannot fast-forward `main`.

Future retrieval order after the user says a validation/check finished:

1. read `validation-results/latest-*.json` on `main`;
2. if absent/stale, read branch `validation-results`;
3. only request pasted terminal output if both automated paths demonstrably fail.

No GitHub Actions are used.

## Important validation commands

- `npm run lint`
- `npm run build`
- `npm run test:decision`
- `npm run test:decision-backtest`
- `npm run test:causal-universe-backtest`
- `npm run test:broker-execution`
- `npm run test:broker-backtest-feasibility`
- `npm run test:broker-backtest-feasibility:live`
- `npm run test:execution-fidelity`
- `npm run test:opportunity-alerts`
- `npm run test:opportunity-outcomes`
- `npm run test:user-portfolio`
- `npm run test:fund-portfolio`
- `npm run test:unified-universe`
- `npm run test:portfolio-decision`
- `npm run test:portfolio-execution-plan`
- `npm run test:eodhd-shortlist`
- `npm run validate:aistudio`

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of the ultimately recommended ticker/ISIN set remains unverified.
- 100 EUR remains structurally too small for many diversified whole-share ETF allocations with 1 EUR minimum commissions.
- Percentage-only strategy backtests remain research evidence; broker-aware diagnostics must accompany execution-readiness interpretation.
- Historical universe retains survivorship/catalog-availability bias.
- Yahoo remains unofficial despite successful EODHD validation of the current listed shortlist.
- Fund transfer eligibility is not inferred solely from the app's `transferable` flag; final tax/operational eligibility must be confirmed by the broker/entity.
- Cross-process cache persistence is not guaranteed by the in-memory EODHD cache.

## Immediate next step

Run the current recorded validation after the new actionable portfolio workflow:

`npm run validate:aistudio`

Do not request pasted output. Retrieve the recorded results automatically from `validation-results/latest-aistudio.json` and `validation-results/latest-broker-backtest-feasibility.json`, using branch `validation-results` as fallback.

Specifically confirm:

1. `test:portfolio-execution-plan` passes;
2. TypeScript/lint passes with the new UI/module;
3. build passes;
4. previous decision/portfolio/causal tests remain green;
5. current live-data result remains technically healthy.

If green, continue with the next execution-layer improvement: reduce real-world turnover through no-trade thresholds/order batching and improve exact MyInvestor instrument-availability verification.

## Working protocol for future chats

1. Read this file from `fmaranis/Trading/main`.
2. Read `docs/DECISIONS.md` when architecture/policy matters.
3. Inspect current `main` HEAD and intervening commits before assuming state is current.
4. Read `validation-results/latest-*.json` from `main`, then branch `validation-results`, before asking for validation output.
5. Continue from **Immediate next step** unless priority is explicitly changed.
6. After meaningful work, update this file again.
