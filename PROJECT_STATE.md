# Trading — Canonical Project State

> Operational memory. Repository `fmaranis/Trading/main` is canonical. **Do not add or depend on GitHub Actions.** ChatGPT develops/fixes directly in GitHub. AI Studio is test-only: sync current `main` and run deterministic local validation; it must not edit source.

## Current status — 2026-08-29

React + TypeScript + Vite decision-support app using REAL market data. Latest recorded AI Studio validation before the current research-workspace refactor: **2026-08-29 18:55:33 UTC**, green (`exitCode: 0`, `ok: true`, all 3 expected markers detected). Current HEAD contains substantial later UI/research changes and must receive one fresh `npm run validate:aistudio` before being called validated.

## Non-negotiable product architecture

The application has **two clearly separated primary workspaces**. Do not merge them back into one long vertical data stream.

### 1. Mi cartera real

Purpose: factual state and actions on the user's actual money only.

Contains:
- real positions and real liquidity;
- `Qué haría hoy` as the only operational recommendation surface;
- applying an operation changes the canonical portfolio and liquidity immediately;
- concise explanation (`Por qué recomienda eso`);
- portfolio alerts/snapshots/history only as collapsed secondary material.

It must not contain arbitrary-ticker research, general historical robustness charts or market-screening tables as primary content.

### 2. Estudio y señales

Purpose: research without mutating the real portfolio.

Contains:
- current radar/rankings;
- expanded catalog browsing;
- arbitrary listed ticker analysis;
- fund analysis by ISIN when EODHD NAV data is available;
- selectable historical start date and monthly/quarterly review frequency;
- price/NAV chart with causal BUY / ADD / SELL markers;
- general external/negative-path robustness as secondary evidence.

Research does **not** become a real portfolio operation until broker/currency/cost/portfolio gates are separately satisfied.

## User real portfolio baseline — never relabel as demo/example

These are user-provided real starting positions:

- Vanguard Global Stock Index Fund EUR Acc — ISIN `IE00B03HD191` — invested **12,600 EUR** — acquisition **2026-08-11** — recorded units **196.59** — MyInvestor — transferable;
- Vanguard Emerging Markets Stock Index Fund EUR Acc — ISIN `IE0031786696` — invested **1,400 EUR** — acquisition **2026-08-12** — recorded units **4.61** — MyInvestor — transferable;
- capital pending to invest: **13,000 EUR**, horizon 12 months.

Canonical constants: `USER_REAL_FUND_POSITIONS` and `USER_REAL_STAGED_CAPITAL_PLAN`.

Persistence rule:

> A UI/code refactor must never silently erase or replace the real portfolio.

`UserPortfolioService` uses `portfolioDataVersion = 2`; pre-v2 accidentally empty state is migrated once to the real baseline. Once migrated, intentional later sales/transfers/empty state are respected.

## Canonical transaction invariant

Canonical client portfolio state: `UserPortfolioService` (`custodia_user_portfolio_v1`).

> An operation cannot be considered executed unless it consistently changes canonical holdings/funds/liquidity.

`portfolioStateExecution.ts` transactionally applies:
- `BUY_ETF`: consumes liquidity + fee, adds shares;
- `SELL_ETF`: removes shares, credits net proceeds;
- `SUBSCRIBE_FUND`: consumes liquidity, creates/increments fund;
- `REDEEM_FUND`: reduces fund, credits cash;
- `TRANSFER_FUND`: moves value source → destination without fabricating cash;
- invalid/review/insufficient-liquidity operations fail without changing state.

`PortfolioExecutionPlanPanel` uses **Aplicar a mi cartera**, never a cosmetic `Marcar hecha`.

`InteractiveInvestmentDecisionCenter` now listens to `USER_PORTFOLIO_UPDATED_EVENT` (`custodia:user-portfolio-updated`) so deployable capital recalculates after real portfolio changes.

## Arbitrary single-asset research

Engine: `src/investment/decision/singleAssetResearch.ts`.

UI: `src/components/SingleAssetResearchPanel.tsx`.

The user can type a listed-market ticker such as:
- `AAPL`
- `NVDA`
- `ASML.AS`
- `SAN.MC`
- `SAP.DE`

or a 12-character ISIN such as `IE00B03HD191` for direct fund NAV research through EODHD when quota/data are available.

Historical behavior:
- user selects any start date;
- engine fetches additional pre-start warmup history so the first displayed decision can still use causal 252-session context;
- review frequency is monthly or quarterly;
- every review uses only data known up to that review date;
- the same `StrategyConsensusEngine` assesses long trend, 120-session momentum, mean reversion/buy-the-dip, risk and cash hurdle;
- when outside: a `BUY` marker appears only when new-money consensus says BUY;
- when inside: structural deterioration with required adverse votes creates a `SELL` marker;
- first ADD in a favorable add regime can be shown as an informational `ADD` marker;
- markers execute strictly on the **next available observation** after the signal;
- listed instruments use next-bar opening price;
- funds use next available NAV observation;
- future prices cannot change earlier signals.

Visual chart semantics:
- ▲ green = BUY;
- ◆ cyan = ADD;
- ▼ red = SELL / REDUCE;
- tooltip shows signal date → execution date, execution price/NAV, consensus and votes.

The chart also compares normalized follow-signals performance vs buy-and-hold and shows asset drawdown. This is research-only and is not a broker execution simulation.

## Research universe and the former “30 assets” limitation

The fixed production list was never a provider/API limit. `marketDataRoutes.ts` already accepts arbitrary ticker symbols for history.

Current configured catalog:
- `EUR_ASSET_UNIVERSE`: production portfolio discovery list;
- `EUR_VALIDATION_HOLDOUT_UNIVERSE`: separate robustness/holdout list.

`InvestmentResearchLab` merges both for browsing suggestions (currently **57 cataloged instruments**, subject to deduplication) and the arbitrary ticker/ISIN field is not limited to that catalog.

Important distinction:
- **portfolio allocator shortlist** remains deliberately small/diversified (max ~8 selected exposures) because it constructs a portfolio;
- **research** must never be limited by that shortlist;
- the current radar ranks all instruments already accepted in the current market scan, not only the selected 8;
- the arbitrary analyzer can inspect symbols outside the loaded radar/catalog entirely.

Future radar expansion should use dynamic/preset research universes and caching/batching. Do not equate “all possible symbols” with firing thousands of Yahoo requests on every page load; Yahoo is an unofficial provider and rate/resource limits must be respected.

## Radar modes

`InvestmentResearchLab` currently supports:
- **Mejor equilibrio actual** — existing scanner score;
- **Más fuertes ahora** — 120-session momentum;
- **Más estables / seguros** — lower volatility/drawdown composite;
- **Más castigados** — largest observed drawdown.

These labels describe observed metrics, not guaranteed future return.

The user can click any radar row or select any item in the expanded catalog to auto-open/analyze its individual chart.

## External robustness evidence

`HistoricalDecisionReplayPanel` remains available only as secondary evidence under **Estudio y señales → Validación general del motor y casos externos**.

Latest recorded REAL external evidence includes:
- 19 requested holdout candidates;
- 16 accepted ETFs/ETCs;
- 3 external mutual funds rejected due EODHD `QUOTA_EXHAUSTED`;
- worst real loss windows including EXI5.DE 12M -45.36%, EXI5.DE 6M -41.73%, G1CE.DE 12M -35.36%;
- causal defensive behavior/AVOID/REDUCE evidence.

Adverse/worst-window cohorts are ex-post behavioral stress tests only, not unbiased OOS parameter-tuning evidence.

## Validation gates

`validate:aistudio:raw` includes:
- real portfolio persistence/migration tests;
- transactional portfolio execution tests;
- consensus tests;
- `tests/singleAssetResearch.unit.ts`;
- existing historical/dynamic/holdout/live validation gates.

`singleAssetResearch.unit.ts` asserts:
- selected period is charted;
- monthly reviews occur;
- rising regime can produce BUY;
- structural falling regime can produce SELL;
- every execution date is strictly later than its signal date;
- every marker has a valid execution price;
- modifying later/future prices does not change earlier signals.

No new GitHub Actions workflow and no standalone validation artifact/marker was added.

## Known limitations / next research expansion

- radar current metrics still require a loaded comparison universe; arbitrary single-symbol research does not;
- broad market discovery (“scan all S&P 500 / Nasdaq / EuroStoxx / IBEX / etc.”) should be the next research-universe layer, implemented with explicit market presets/dynamic discovery + caching/batching, not by enlarging the portfolio allocator;
- EODHD mutual-fund research depends on available provider quota;
- Yahoo is unofficial/non-contractual;
- current catalog historical analysis still has survivorship bias;
- research single-asset performance is a normalized in/out illustration, not a fully costed real-broker portfolio backtest;
- broker/currency/tax availability is checked only when moving a research idea toward the real portfolio.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio.
2. AI Studio must not edit source.
3. Run exactly `npm run validate:aistudio`.
4. Confirm TypeScript/build plus `Single Asset Research` and portfolio persistence/transaction tests are green.
5. Visual check:
   - two primary tabs are clearly visible: **Mi cartera real** / **Estudio y señales**;
   - real Vanguard positions remain present;
   - research tab shows radar and expanded catalog;
   - clicking a radar/catalog symbol loads its individual graph;
   - arbitrary ticker such as `NVDA` works;
   - graph visibly contains ▲ BUY and ▼ SELL markers when the historical engine produces them;
   - marker tooltip shows signal date, later execution date and execution price;
   - changing start date reruns the study without changing the real portfolio.
6. Fix any failure directly in GitHub and rerun the same local validation. Do not use GitHub Actions.
