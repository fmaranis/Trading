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

React + TypeScript + Vite research/decision-support application. It analyses, ranks, backtests, alerts and proposes execution plans; it does **not** execute broker trades.

Implemented areas include REAL historical data with provenance/fingerprints, Yahoo primary daily data, EODHD secondary validation/fund NAV, portfolio analytics, risk-profile decisions, ETF/ETC/fund scanning, causal universe reselection, whole-share MyInvestor modelling, broker execution-quality/minimum-capital checks, broker-aware backtest cost diagnostics, opportunity research, unified ETF+fund portfolios and Python/vectorbt comparison infrastructure.

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

- listed ETFs: **6/6 checked, 6/6 matched**;
- observed listed-ETF price difference: **0.00%**;
- mutual funds: **2/2** routed through fund NAV pipeline;
- first pass: 8 upstream requests, 0 cache hits;
- immediate rerun: 0 upstream calls, 8 cache hits;
- same-process cache reuse: **100%**;
- `validationPassed: true`.

The shortlist-wide EODHD blocker is closed.

## Causal integrity

- Scanner minimum history: 252 bars.
- `CausalUniverseBacktestEngine` now enforces the same 252-bar minimum before historical scoring/selection.
- Causal warm-up cannot be forced below 252 bars.
- Regression tests cover history threshold, warm-up, future-data mutation invariance and accounting.
- Residual survivorship/catalog bias remains because delisted/no-longer-queryable historical instruments are absent.
- Mixed ETF trading dates and mutual-fund NAV dates still need to remain healthy in the common-date causal path on the latest full validation.

## Decision engine

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- Regime overlay may increase cash defensively.
- Confidence means evidence/data quality, not probability of profit.
- Current confidence cap remains 85 unless evidence policy changes.

## Broker / MyInvestor

Current model:

- no fractional ETF shares;
- ETF commission 0.12%;
- minimum 1 EUR/order;
- maximum 25 EUR/order;
- exact selected ticker/ISIN availability still requires MyInvestor/Inversis verification.

Theoretical allocation and executable portfolio remain separate concepts. For the 100 EUR MEDIUM case, whole-share execution can collapse to one position, so affordability alone is not sufficient diversification quality.

## Broker-aware backtest integrity

Module: `src/investment/decision/brokerBacktestFeasibility.ts`.

It prevents percentage-only research backtests from being interpreted as broker-executable economics when a fixed minimum commission applies. It reports:

- minimum commission lower bound = `totalTrades × broker minimum commission`;
- lower-bound trading costs;
- minimum commission drag as % of initial capital;
- commission understatement in EUR/factor;
- compatibility of the research commission model with the broker minimum;
- minimum capital required for a specified commission-drag ceiling;
- explicit warnings when simplified research costs are economically incompatible with MyInvestor.

Commands:

- `npm run test:broker-backtest-feasibility`
- `npm run test:broker-backtest-feasibility:live`

`validate:aistudio` runs both deterministic and live broker-cost diagnostics. Durable policy is recorded in `docs/DECISIONS.md` D20.

## Automatic validation-result recording — hardened 2026-08-28

The user must **not** be asked to copy/paste validation output into chat as the normal workflow.

Infrastructure:

- `scripts/validationResultStore.ts`
- `scripts/runRecordedValidation.ts`
- `validation-results/README.md`

Recorded commands:

- `npm run validate:aistudio`
  - executes internal `validate:aistudio:raw`;
  - captures `AI_STUDIO_VALIDATION_RESULT`;
  - captures `BROKER_BACKTEST_FEASIBILITY_RESULT`;
  - writes `validation-results/latest-aistudio.json`;
  - writes `validation-results/latest-broker-backtest-feasibility.json`.
- `npm run test:eodhd-shortlist`
  - executes internal `test:eodhd-shortlist:raw`;
  - captures `EODHD_SHORTLIST_VALIDATION_RESULT`;
  - writes `validation-results/latest-eodhd-shortlist.json`.

Each recorded result includes timestamp, Git HEAD/branch and structured payload. The wrapper commits only generated validation-result files and does not stage unrelated local changes.

### Remote publication policy

Publishing directly to `main` remains best-effort because the local validation checkout may lag behind remote `main` while ChatGPT is making direct repository commits.

To prevent a non-fast-forward `main` push from hiding validation results, `scripts/runRecordedValidation.ts` now also publishes the validation-result commit to the dedicated remote branch:

`validation-results`

The wrapper attempts:

1. normal push of the current branch;
2. independent publication of the exact result commit to remote branch `validation-results` using force-with-lease, with a force fallback only for this dedicated result branch.

This branch is only a transport/reference point for latest validation artifacts; `main` remains canonical for application code.

**Future-chat retrieval rule:** after the user says a validation/check finished:

1. first try `validation-results/latest-*.json` on `main`;
2. if absent, read the same files from branch `validation-results`;
3. do not ask the user to paste terminal output unless both automated remote paths demonstrably failed.

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
- `npm run test:opportunity-threshold-research`
- `npm run test:opportunity-threshold-walk-forward`
- `npm run test:user-portfolio`
- `npm run test:fund-portfolio`
- `npm run test:unified-universe`
- `npm run test:portfolio-decision`
- `npm run test:eodhd`
- `npm run test:eodhd-shortlist`
- `npm run validate:aistudio`

Internal raw commands exist only so the recording wrapper can run the original checks without recursion:

- `npm run validate:aistudio:raw`
- `npm run test:eodhd-shortlist:raw`

## Validation status

Verified provider-dependent:

- `test:eodhd-shortlist`: PASS;
- 6/6 listed ETFs matched EODHD;
- 2/2 mutual funds routed correctly;
- immediate rerun 0 upstream / 8 cache hits;
- `validationPassed: true`.

Previous deterministic suite before the newest broker-aware/history-hardening commits had reported lint/build/core tests PASS, `technicalBlockers: []`, `researchReady: true`, `readyForManualPilot: false`.

The first run after automatic-result recording was reported finished by the user, but its result did not reach remote `main`. Root cause: normal push may fail when the local validation checkout is behind remote `main`. The publishing workflow has now been hardened with the dedicated `validation-results` branch fallback.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of the ultimately recommended ticker/ISIN set remains unverified.
- 100 EUR is structurally too small for many diversified ETF allocations with whole shares and 1 EUR minimum commissions.
- Percentage-only strategy backtests remain research evidence; broker-aware diagnostics accompany execution-readiness interpretation.
- Historical universe retains survivorship/catalog-availability bias.
- Yahoo remains unofficial despite successful EODHD validation of the current listed shortlist.
- Mixed ETF/fund common-date alignment must remain verified on the latest causal run.
- Cross-process cache persistence is not guaranteed by the in-memory EODHD cache.

## Immediate next step

Run once more on an updated checkout:

`npm run validate:aistudio`

After it finishes, do **not** request pasted output. Retrieve automatically in this order:

1. `validation-results/latest-aistudio.json` from `main`;
2. `validation-results/latest-broker-backtest-feasibility.json` from `main`;
3. if absent, the same paths from remote branch `validation-results`.

If green, continue with the highest-impact remaining blocker: broker/manual-pilot viability and exact instrument availability, while keeping strategy research separate from execution economics.

## Working protocol for future chats

1. Read this file from `fmaranis/Trading/main`.
2. Read `docs/DECISIONS.md` when architecture/policy matters.
3. Inspect current `main` HEAD and intervening commits before assuming state is current.
4. Read `validation-results/latest-*.json` from `main`, then branch `validation-results`, before asking for any validation output.
5. Continue from **Immediate next step** unless priority is explicitly changed.
6. After meaningful work, update this file again.
