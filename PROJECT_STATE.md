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

## Current product shape

React + TypeScript + Vite research/decision-support application. It analyses, ranks, backtests, alerts and proposes execution plans; it does **not** execute broker trades.

Main implemented areas:

- REAL historical market data with provenance/fingerprints;
- Yahoo primary daily data;
- EODHD secondary cross-validation + fund NAV/history;
- single/multi-asset backtesting;
- portfolio analytics and regime analysis;
- risk-profile decision engine;
- ETF/ETC/fund universe scanning;
- causal historical universe reselection;
- whole-share MyInvestor execution modelling;
- broker execution quality and minimum diversified capital estimation;
- broker-aware backtest cost feasibility diagnostics;
- opportunity alerts/outcomes/threshold research/walk-forward;
- user/fund portfolios and unified ETF+fund universe;
- portfolio decision engine;
- Python/vectorbt comparison infrastructure.

## Data providers

### Yahoo Finance

- Primary daily historical source through server proxy.
- REAL requests must never silently fall back to synthetic data.
- Yahoo remains unofficial/non-contractual and must not be described as exchange-grade real time.

### EODHD

- Server-side key; never exposed to client.
- Secondary/non-blocking for ETF cross-validation; also fund NAV/history source.
- `.DE` Yahoo listings map to `.XETRA` for ETF cross-check.
- ETF tolerance: 1%.
- Cross-check cache TTL: 24 h.
- Fund-history cache TTL: 6 h.

### Verified shortlist-wide EODHD result — 2026-08-28

`npm run test:eodhd-shortlist` passed in the configured environment.

Selected 8 assets:

- `XEON.DE`
- `ISPA.DE`
- `EUN6.DE`
- `ZPRV.DE`
- `EXSA.DE`
- `IE00B5456744`
- `XDWH.DE`
- `IE0032126645`

Result:

- listed ETFs: **6/6 checked, 6/6 matched**;
- observed price difference: **0.00%** for all six checked ETFs;
- mutual funds: **2/2** correctly routed through the fund NAV pipeline;
- first pass: 8 upstream requests, 0 cache hits;
- immediate rerun: 0 upstream calls, 8 cache hits;
- same-process cache reuse: **100%**;
- `validationPassed: true`.

The previous shortlist-wide EODHD blocker is closed.

## Asset universe / causal integrity

- Discovery catalog remains modest; last broad scan reported 22/30 accepted and 8 unavailable through Yahoo.
- Shortlist permits maximum one selected exposure per category and includes a defensive exposure when available.
- Scanner score: momentum 20/60/120, annualised 60-return volatility, 252-bar max drawdown, defensive bonus.
- No full correlation penalty or point-in-time delisted universe should be assumed.

### 2026-08-28 causal-history hardening

`CausalUniverseBacktestEngine` now defines `CAUSAL_UNIVERSE_MINIMUM_HISTORY_BARS = 252`.

- Historical candidates cannot be scored before 252 bars exist.
- The causal warm-up cannot be forced below 252 even if a caller supplies a smaller `warmupBars` value.
- This aligns historical causal eligibility with the scanner's current 252-bar minimum.
- Regression tests cover minimum history, forced-short warmup, lookahead mutation invariance and accounting.

Residual limitation remains: causal reselection occurs inside the currently available/validated catalog, so delisted/no-longer-queryable historical instruments are absent.

## Decision engine

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- Regime overlay may increase cash defensively.
- Confidence means evidence/data quality, **not** probability of profit.
- Current confidence cap remains 85 unless later evidence policy changes.
- UI must describe daily data as latest available close/daily data, not real time.

## Broker / MyInvestor execution

Current model:

- no fractional ETF shares;
- ETF commission 0.12%;
- minimum 1 EUR/order;
- maximum 25 EUR/order;
- exact selected ticker/ISIN availability still requires MyInvestor/Inversis verification.

Theoretical allocation and executable portfolio are separate concepts.

For the previously reported 100 EUR MEDIUM case, whole-share execution collapses to one position; therefore affordability is not sufficient for MEDIUM diversification quality. The code now estimates minimum capital satisfying explicit diversification/concentration/fee criteria.

## 2026-08-28 broker-aware backtest integrity

New module: `src/investment/decision/brokerBacktestFeasibility.ts`.

Purpose: prevent percentage-only research backtests from being interpreted as executable MyInvestor economics when the broker charges a fixed minimum per order.

The diagnostic reports:

- mathematical minimum commission lower bound = `totalTrades × broker minimum commission`;
- lower-bound trading costs;
- minimum commission drag as % of initial capital;
- modeled commission understatement in EUR and factor;
- whether the percentage-only commission result is compatible with the broker minimum;
- minimum capital required to keep the lower-bound commission drag below an explicit target;
- explicit warnings when broker minimum fees invalidate the simplified cost interpretation.

Deterministic test: `tests/brokerBacktestFeasibility.unit.ts`.

Command: `npm run test:broker-backtest-feasibility`.

`validate:aistudio` now includes this integrity test as a release gate.

Durable policy recorded in `docs/DECISIONS.md` D20: strategy backtest costs and broker-executable costs are separate evidence.

## Important validation commands

- `npm run lint`
- `npm run build`
- `npm run test:decision`
- `npm run test:decision-backtest`
- `npm run test:causal-universe-backtest`
- `npm run test:broker-execution`
- `npm run test:broker-backtest-feasibility`
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

## Validation status

Verified live/provider-dependent:

- `test:eodhd-shortlist`: **PASS**;
- 6/6 listed ETFs matched EODHD;
- 2/2 mutual funds routed correctly;
- immediate rerun 0 upstream / 8 cache hits;
- `validationPassed: true`.

Previous deterministic suite before the newest broker-aware/history-hardening commits had reported:

- lint PASS;
- decision tests PASS;
- decision-backtest PASS;
- causal-universe PASS;
- broker-execution PASS;
- multi-asset PASS;
- portfolio analytics PASS;
- regime analytics PASS;
- build PASS;
- `technicalBlockers: []`;
- `researchReady: true`;
- `readyForManualPilot: false`.

**Important:** the complete deterministic suite has not yet been executed after the newest broker-aware and 252-bar causal-history commits. Do not claim the present HEAD fully validated until `npm run validate:aistudio` is rerun in the configured environment.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of the ultimately recommended ticker/ISIN set remains unverified.
- 100 EUR is structurally too small to reproduce many diversified ETF allocations with whole shares and 1 EUR minimum commissions.
- Percentage-only strategy backtests remain research evidence; broker-aware diagnostics must accompany execution-readiness interpretation.
- Historical universe still has survivorship/catalog-availability bias.
- Yahoo remains an unofficial primary source despite successful EODHD cross-validation of the current listed-ETF shortlist.
- Catalog breadth remains modest.
- Cross-process cache persistence is not guaranteed by the current in-memory cache design.

## Immediate next step

Run on the current HEAD:

`npm run validate:aistudio`

This now validates the newly added broker-backtest-feasibility regression in addition to the existing deterministic suite.

Record especially:

1. threshold research and walk-forward tests;
2. fund portfolio and unified universe tests;
3. portfolio decision tests;
4. broker-backtest-feasibility test;
5. causal-universe test with the new 252-bar policy;
6. lint/build and AI Studio deterministic report;
7. `technicalBlockers`;
8. `researchReady`;
9. `readyForManualPilot` and all blockers;
10. updated causal result because the 252-bar eligibility policy may change historical selection windows/performance.

If green, continue with the highest-impact remaining blocker: broker/manual-pilot viability and exact instrument availability, while keeping strategy research separate from execution economics.

## Working protocol for future chats

1. Read this file from `fmaranis/Trading/main`.
2. Read `docs/DECISIONS.md` when architecture/policy matters.
3. Inspect current `main` HEAD and intervening commits before assuming this state is current.
4. Continue from **Immediate next step** unless priority is explicitly changed.
5. After meaningful work, update this file again.
