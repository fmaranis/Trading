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
- Latest code HEAD before this state-file update: `e25a06f92bcc099f075cabfd7e1265a5c9987918`
- Latest code HEAD message: `Expose shortlist-wide EODHD validation command`
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
- The last observed runtime cache check before shortlist-wide validation showed reuse of cached cross-check data (`upstreamCalls: 0`, `cacheHits: 1`).
- Existing one-symbol smoke command remains: `npm run test:eodhd`.
- New shortlist-wide command is implemented: `npm run test:eodhd-shortlist`.
- New script: `scripts/eodhdShortlistSmoke.ts`.
- The shortlist-wide script obtains the live scanner-selected shortlist (up to 8 assets), posts all selected tickers to `/api/eodhd/cross-check` in one request, reports Yahoo/EODHD dates and closes, difference %, status and cache state, then immediately repeats the same request to prove 24 h cache reuse.
- The shortlist-wide script also reports aggregate requested/checked/matched/divergent/coverage/upstreamCalls/cacheHits and preserves EODHD as secondary/non-blocking.
- Runtime execution of `test:eodhd-shortlist` on the user's configured environment is **pending**; do not claim shortlist-wide EODHD validation has passed until its output is recorded here.

## Asset universe and selection

- Discovery catalog currently contains 30 EUR candidates.
- Runtime validation rejects unavailable/non-EUR/stale/insufficient-history instruments.
- The last reported scan accepted 22/30 and rejected 8 as `MarketDataSymbolNotFoundError`.
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

`validate:aistudio` currently chains threshold research, threshold walk-forward, fund portfolio, unified universe, portfolio decision, and the deterministic AI Studio validator. The live EODHD shortlist test remains a separate provider-dependent smoke test and is not added as a blocking dependency of deterministic validation.

## Last known validation status

The last full validation output supplied by the user before the newest shortlist-test commits reported:

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

Do **not** assume that this exact validation result covers the new `scripts/eodhdShortlistSmoke.ts` and package command. The current suite must be rerun after the live shortlist smoke is executed.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of the ultimately recommended ticker/ISIN set is not yet verified.
- 100 EUR is generally too small to reproduce diversified theoretical ETF portfolios with whole shares and 1 EUR minimum commissions.
- Historical universe still has survivorship/catalog-availability bias because delisted historical instruments are absent.
- Yahoo remains an unofficial primary provider.
- EODHD shortlist-wide cross-validation code is implemented but its live runtime result has not yet been recorded.
- The catalog is still modest (30 discovery candidates), with 8 last reported as unavailable through Yahoo.
- Persistent cross-process market-data/cache behaviour should not be assumed beyond what each server implementation explicitly provides.
- Do not add or depend on GitHub Actions for this project.

## Immediate next step

**Run the newly implemented shortlist-wide EODHD validation in the configured local environment:**

`npm run test:eodhd-shortlist`

Expected output marker: `EODHD_SHORTLIST_VALIDATION_RESULT`.

Review and record:

1. current selected tickers (up to 8);
2. per ticker Yahoo date/close, EODHD symbol/date/close, difference %, status and cache hit;
3. aggregate `checked`, `matched`, `divergent`, `coveragePct`, `upstreamCalls`, `cacheHits`;
4. any quota/auth/network/no-data states;
5. immediate rerun showing 24 h cache reuse, ideally `upstreamCalls: 0` and cache hits for every cacheable result;
6. `validationPassed`.

If the shortlist-wide test passes, rerun:

`npm run validate:aistudio`

Then record whether all newer fund/unified-universe/portfolio-decision and core quant changes remain green, and update this file with both outputs.

## Working protocol for future chats

At the beginning of any new chat about this project:

1. Read `PROJECT_STATE.md` from `fmaranis/Trading/main`.
2. Read `docs/DECISIONS.md` if architecture/policy decisions matter.
3. Fetch current `main` HEAD and compare it with the HEAD recorded here.
4. If HEAD changed, inspect the intervening code before assuming this state is current.
5. Continue from **Immediate next step**, unless the user explicitly changes priority.
6. At the end of meaningful work, update this file.
