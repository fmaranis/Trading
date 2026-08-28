# Trading — Canonical Project State

> **Purpose:** this file is the operational memory of the project. New chats must read this file before continuing work.
>
> **Continuation instruction:** `Continúa Trading desde PROJECT_STATE.md`.
>
> **Maintenance rule:** after any meaningful change to architecture, data providers, validation, decision logic, execution logic, tests, blockers, or next steps, update this file in the same work block.

## Current reference

- Repository: `fmaranis/Trading`
- Canonical branch: `main`
- State updated: **2026-08-28**
- Latest validated code block includes shortlist-wide EODHD validation support through commit `e25a06f92bcc099f075cabfd7e1265a5c9987918` and subsequent state updates.
- This repository, not chat memory, is the source of truth.

## Current product shape

React + TypeScript + Vite research/decision-support application for investment analysis. It does **not** execute trades. Main areas currently present in the repository include:

- historical market-data ingestion and provenance;
- single-asset and multi-asset backtesting;
- portfolio analytics and regime analysis;
- decision engine by risk profile and horizon;
- broad ETF/ETC asset-universe scanner;
- causal historical universe reselection backtest;
- broker whole-share execution modelling;
- opportunity alerts, outcome backtests and threshold research / walk-forward tests;
- user-portfolio modelling;
- fund portfolio support;
- unified ETF + fund investment universe;
- portfolio decision engine;
- Python/vectorbt comparison backend retained as research infrastructure.

## Data providers

### Primary market data

- Yahoo Finance remains the primary daily historical market-data source through the server proxy.
- REAL data must never silently fall back to synthetic data.
- Market-data provenance and dataset fingerprints remain mandatory.
- Yahoo is an unofficial/non-contractual endpoint; it is research-grade, not exchange-grade real-time data.

### EODHD

- EODHD integration is implemented server-side and the API key is not exposed to the client.
- Role: secondary cross-validation plus fund NAV/history support.
- ETF cross-check is **non-blocking**: failure/quota exhaustion must not disable the Yahoo primary path.
- Yahoo `.DE` symbols are mapped to EODHD `.XETRA` for cross-checking.
- Cross-check tolerance currently used by the route: **1%**.
- Cross-check cache TTL: **24 h**.
- Fund-history cache TTL: **6 h**.
- One-symbol smoke command remains: `npm run test:eodhd`.
- Shortlist-wide command is implemented and verified: `npm run test:eodhd-shortlist`.
- Script: `scripts/eodhdShortlistSmoke.ts`.

### Verified shortlist-wide EODHD result — 2026-08-28

`npm run test:eodhd-shortlist` executed successfully in the configured user environment.

Selected shortlist (8 assets):

- `XEON.DE`
- `ISPA.DE`
- `EUN6.DE`
- `ZPRV.DE`
- `EXSA.DE`
- `IE00B5456744`
- `XDWH.DE`
- `IE0032126645`

Cross-validation result:

- Listed ETFs: **6/6 checked, 6/6 matched** against EODHD XETRA data.
- Observed listed-ETF price difference: **0.00%** for all six checked ETFs.
- Mutual funds: **2/2** correctly handled through the separate fund NAV pipeline rather than the listed-ETF XETRA comparison path.
- First pass: **8 upstream requests, 0 cache hits**; summary state `PARTIAL`, with 75% listed-ETF cross-check coverage because two shortlist assets are mutual funds handled separately.
- Immediate rerun: **0 upstream calls, 8 cache hits**.
- Cache reuse: **100%** for unchanged inputs, consistent with the 24 h cross-check TTL.
- `validationPassed: true`.
- EODHD remains secondary/non-blocking; Yahoo remains the primary historical market-data path.

This closes the previous blocker: shortlist-wide EODHD cross-validation and same-process cache reuse are now empirically demonstrated.

## Asset universe and selection

- Discovery catalog currently contains 30 EUR candidates.
- Runtime validation rejects unavailable/non-EUR/stale/insufficient-history instruments.
- The last reported broad scan accepted 22/30 and rejected 8 as `MarketDataSymbolNotFoundError`.
- Current shortlist selection is diversified by category: maximum one selected exposure per category, with defensive inclusion when available.
- Scanner score uses momentum 20/60/120, 60-return annualised volatility, 252-bar max drawdown and defensive bonus.
- No correlation penalty or exposure/ISIN deduplication should be assumed unless explicitly added later.

## Causal validation

Implemented and previously validated:

- decision backtest uses information through `Close(t-1)` and execution at `Open(t)`;
- universe-selection backtest re-ranks and re-selects assets using only information available at each historical decision date;
- future-price mutation tests verify that future data do not alter earlier selections/equity;
- residual limitation remains: causal reselection operates inside the **currently available/validated catalog**, so historical delisted/no-longer-queryable instruments are not represented.

Last reported causal-universe result for the 100 EUR MEDIUM example:

- initial capital: 100 EUR;
- final equity: approximately 111.47 EUR;
- total return: approximately +11.47%;
- max drawdown: approximately 2.70%;
- 56 historical selection windows;
- approximately 397 trades;
- approximately 1.09 EUR modelled trading costs.

Treat this as historical research evidence, **not** a forecast or probability of profit.

## Decision engine

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- Regime overlay can increase cash defensively.
- Confidence score is capped at 85 while evidence remains dependent on limited providers / validation scope.
- Confidence means **quality of evidence/data**, not probability of profitability.
- Decision UI must describe daily data as latest available close / latest daily data, not real-time market prices.

## Broker / MyInvestor execution model

- Whole-share execution modelling exists.
- Current MyInvestor model assumes no fractional ETF shares.
- Modelled ETF commission: 0.12%, minimum 1 EUR, maximum 25 EUR per order.
- Exact availability of each selected ticker/ISIN in MyInvestor/Inversis still requires verification; do not invent availability.
- A theoretical allocation requiring fractions must not be presented as directly executable.
- With the reported 100 EUR MEDIUM case, the whole-share fallback collapsed to one `EUN6.DE` position. Therefore `executable = true` must not be interpreted as a sufficiently diversified MEDIUM portfolio.
- Execution quality should distinguish:
  1. at least one order is affordable;
  2. the executable portfolio preserves minimum diversification/concentration/cost criteria.

## Validation commands currently in package.json

Important local commands include:

- `npm run lint`
- `npm run build`
- `npm run test:decision`
- `npm run test:decision-backtest`
- `npm run test:causal-universe-backtest`
- `npm run test:broker-execution`
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

`validate:aistudio` currently chains threshold research, threshold walk-forward, fund portfolio, unified universe, portfolio decision, and the deterministic AI Studio validator. The live EODHD shortlist test remains a separate provider-dependent smoke test and is not a blocking dependency of deterministic validation.

## Last known validation status

Most recent provider-dependent validation:

- `test:eodhd-shortlist`: **PASS**.
- Listed ETFs: 6/6 matched.
- Mutual funds: 2/2 routed through fund NAV handling.
- Immediate second pass: 0 upstream calls / 8 cache hits.
- `validationPassed: true`.

The last full deterministic validation supplied before the shortlist-wide EODHD test reported:

- TypeScript/lint PASS;
- decision tests PASS;
- decision-backtest tests PASS;
- causal-universe-backtest tests PASS;
- broker-execution tests PASS;
- multi-asset tests PASS;
- portfolio analytics PASS;
- regime analytics PASS;
- build PASS;
- `technicalBlockers: []`;
- `researchReady: true`;
- `readyForManualPilot: false`.

The deterministic validation suite must now be rerun on the current HEAD before declaring the entire present repository state fully validated.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of the ultimately recommended ticker/ISIN set is not yet verified.
- 100 EUR is generally too small to reproduce diversified theoretical ETF portfolios with whole shares and 1 EUR minimum commissions.
- Historical universe still has survivorship/catalog-availability bias because delisted historical instruments are absent.
- Yahoo remains an unofficial primary provider, although the current listed-ETF shortlist has now been successfully cross-validated against EODHD.
- The catalog is still modest (30 discovery candidates), with 8 last reported as unavailable through Yahoo.
- Cross-process/cache persistence should not be assumed beyond what the server implementation explicitly guarantees; the verified cache result is same-process immediate reuse.
- Do not add or depend on GitHub Actions for this project.

## Immediate next step

Run the deterministic/current-state validation on the current repository:

`npm run validate:aistudio`

Record the complete result, especially:

1. threshold research tests;
2. threshold walk-forward tests;
3. fund portfolio tests;
4. unified investment universe tests;
5. portfolio decision engine tests;
6. AI Studio deterministic validator output;
7. `technicalBlockers`;
8. `researchReady`;
9. `readyForManualPilot` and its blockers.

If this passes, update this file with the exact current validation result and then continue with the highest-impact remaining blocker rather than reopening EODHD shortlist validation.

## Working protocol for future chats

At the beginning of any new chat about this project:

1. Read `PROJECT_STATE.md` from `fmaranis/Trading/main`.
2. Read `docs/DECISIONS.md` if architecture/policy decisions matter.
3. Fetch current `main` HEAD and compare it with the HEAD recorded here.
4. If HEAD changed, inspect the intervening code before assuming this state is current.
5. Continue from **Immediate next step**, unless the user explicitly changes priority.
6. At the end of meaningful work, update this file.
