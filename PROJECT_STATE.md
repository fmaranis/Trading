# Trading — Canonical Project State

> Operational memory. Repository `fmaranis/Trading/main` is canonical. **Do not add or depend on GitHub Actions.** ChatGPT develops/fixes directly in GitHub. AI Studio is test-only: sync current `main` and run deterministic local validation; it must not edit source.

## Current status — 2026-08-29

React + TypeScript + Vite decision-support app using REAL market data. Latest recorded AI Studio validation before the current research-workspace refactor: **2026-08-29 18:55:33 UTC**, green (`exitCode: 0`, `ok: true`, all 3 expected markers detected). Current HEAD contains later portfolio/research UI and arbitrary-symbol research changes and requires one fresh `npm run validate:aistudio`.

## Non-negotiable product architecture

The application has exactly **two clearly separated primary workspaces**. Do not merge them back into one long vertical data stream.

### 1. Mi cartera real

Purpose: factual state and actions on the user's actual money only.

Contains real positions, real liquidity, `Qué haría hoy`, transactional application of an operation, concise explanation and collapsed portfolio alerts/history. It must not contain arbitrary-ticker research, general robustness charts or screening tables as primary content.

### 2. Estudio y señales

Purpose: research without mutating the real portfolio.

Contains:
- expanded current radar/rankings;
- catalog browsing;
- arbitrary listed ticker analysis;
- fund analysis by ISIN when EODHD NAV data is available;
- selectable historical start date;
- monthly/quarterly causal review;
- price/NAV chart with BUY / ADD / SELL markers;
- general external/negative-path robustness as secondary evidence.

Research does **not** become a real portfolio operation until broker/currency/cost/portfolio gates are separately satisfied.

## User real portfolio baseline — never relabel as demo/example

User-provided real starting positions:
- Vanguard Global Stock Index Fund EUR Acc — ISIN `IE00B03HD191` — invested **12,600 EUR** — acquisition **2026-08-11** — units **196.59** — MyInvestor — transferable;
- Vanguard Emerging Markets Stock Index Fund EUR Acc — ISIN `IE0031786696` — invested **1,400 EUR** — acquisition **2026-08-12** — units **4.61** — MyInvestor — transferable;
- capital pending to invest: **13,000 EUR**, horizon 12 months.

Canonical constants: `USER_REAL_FUND_POSITIONS` and `USER_REAL_STAGED_CAPITAL_PLAN`.

Persistence invariant:
> A UI/code refactor must never silently erase or replace the real portfolio.

`UserPortfolioService` uses `portfolioDataVersion = 2`; pre-v2 accidentally empty state is migrated once to the real baseline. Once migrated, intentional later sales/transfers/empty state are respected.

## Canonical transaction invariant

Canonical client portfolio state: `UserPortfolioService` (`custodia_user_portfolio_v1`).

> An operation cannot be considered executed unless it consistently changes canonical holdings/funds/liquidity.

`portfolioStateExecution.ts` applies real local state changes for BUY/SELL/SUBSCRIBE/REDEEM/TRANSFER; invalid/review/insufficient-liquidity operations fail without state mutation. `PortfolioExecutionPlanPanel` uses **Aplicar a mi cartera**, never a cosmetic `Marcar hecha`.

`InteractiveInvestmentDecisionCenter` listens to `USER_PORTFOLIO_UPDATED_EVENT` (`custodia:user-portfolio-updated`) so deployable capital recalculates after portfolio changes.

## Arbitrary single-asset research

Engine: `src/investment/decision/singleAssetResearch.ts`.
UI: `src/components/SingleAssetResearchPanel.tsx`.

Accepted study inputs:
- arbitrary listed ticker accepted by the REAL provider, e.g. `AAPL`, `NVDA`, `ASML.AS`, `SAN.MC`, `SAP.DE`;
- 12-character ISIN, e.g. `IE00B03HD191`, loaded as fund NAV through EODHD when available.

Historical behavior:
- user chooses any display start date;
- engine fetches ~2 years of pre-start warmup so the first displayed decision can use causal history;
- monthly or quarterly checkpoints;
- each checkpoint sees only data available then;
- same `StrategyConsensusEngine` logic: long trend, 120-session momentum, mean reversion/buy-the-dip, risk, cash hurdle;
- outside position + BUY consensus => BUY marker;
- inside position + required structural deterioration/adverse votes => SELL marker;
- first ADD regime may show ADD marker;
- execution is strictly on the next available observation after the signal;
- listed instruments use next-bar open; funds use next available NAV;
- future prices cannot change earlier signals.

Chart semantics:
- ▲ green = BUY;
- ◆ cyan = ADD;
- ▼ red = SELL / REDUCE;
- tooltip shows signal date → execution date, execution price/NAV, consensus and votes.

The chart compares normalized follow-signals performance vs buy-and-hold and shows asset drawdown. It is research-only, not a costed broker simulation.

## Research universe and removal of the former “30 assets” limitation

The old ~30 visible ETF limit was a catalogue/workflow artifact, not a market-data provider limit. `/api/market-data/history` accepts arbitrary ticker symbols.

Configured catalogues:
- `EUR_ASSET_UNIVERSE`: production portfolio discovery;
- `EUR_VALIDATION_HOLDOUT_UNIVERSE`: separate robustness/external universe.

`InvestmentResearchLab`:
- merges both catalogues for browsing suggestions (currently **57 catalogued instruments**, before provider acceptance/deduplication);
- automatically scans the external holdout when the research workspace opens;
- combines accepted production + accepted external candidates in **Radar actual ampliado**;
- therefore the visible radar is no longer restricted to the portfolio universe or its max-8 shortlist;
- based on recent provider behavior, roughly 30 production ETFs/ETCs + ~16 external ETFs/ETCs may be visible when data are available, while mutual funds may be rejected by EODHD quota;
- arbitrary ticker/ISIN research remains available even when a symbol is not in either catalogue.

Important distinction:
- **portfolio allocator shortlist** remains deliberately small/diversified (max ~8 selected exposures) because it builds a portfolio;
- **research** must never inherit that cap.

Do not interpret “all possible symbols” as sending thousands of Yahoo requests on page load. Broader market-wide discovery should use explicit market presets/dynamic discovery with caching and batching.

## Radar modes

Current modes:
- **Mejor equilibrio actual** — scanner score;
- **Más fuertes ahora** — 120-session momentum;
- **Más estables / seguros** — lower volatility/drawdown composite;
- **Más castigados** — largest observed drawdown.

These describe observed metrics, not guaranteed future return.

Clicking a radar row or catalog item automatically opens and runs its individual historical chart.

## External robustness evidence

`HistoricalDecisionReplayPanel` is secondary evidence only under **Estudio y señales → Validación general del motor y casos externos**.

Latest recorded REAL external evidence includes:
- 19 requested holdout candidates;
- 16 accepted ETFs/ETCs;
- 3 external mutual funds rejected due EODHD `QUOTA_EXHAUSTED`;
- worst real loss windows including EXI5.DE 12M -45.36%, EXI5.DE 6M -41.73%, G1CE.DE 12M -35.36%;
- causal AVOID/REDUCE behavior.

Adverse/worst-window cohorts are ex-post behavioral stress tests only, not unbiased OOS tuning evidence.

## Validation gates

`validate:aistudio:raw` includes:
- user real-portfolio persistence/migration tests;
- transactional execution tests;
- consensus tests;
- `tests/singleAssetResearch.unit.ts`;
- existing historical/dynamic/holdout/live validation gates.

`singleAssetResearch.unit.ts` asserts chart period, monthly reviews, BUY and SELL behavior, NEXT observation execution, valid execution prices and future-price isolation.

No GitHub Actions workflow and no standalone validation artifact/marker was added.

## Known limitations / next research expansion

- expanded radar currently compares production + external holdout catalogues; arbitrary single-symbol research is broader than the radar;
- true market-wide discovery (e.g. complete S&P 500 / Nasdaq / EuroStoxx / IBEX presets) should be implemented as a research-universe layer with caching/batching, not by enlarging the portfolio allocator;
- EODHD fund research depends on quota;
- Yahoo is unofficial/non-contractual;
- current catalogue historical analysis has survivorship bias;
- single-asset follow-signals return is normalized research, not a costed broker backtest;
- broker/currency/tax checks apply only when turning a research idea into a real portfolio operation.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio.
2. AI Studio must not modify source.
3. Run exactly `npm run validate:aistudio`.
4. Confirm TypeScript/build, portfolio persistence/transactions and `Single Asset Research` are green.
5. Visual check:
   - exactly two primary tabs: **Mi cartera real** / **Estudio y señales**;
   - real Vanguard positions remain present;
   - `Radar actual ampliado` shows production + external instruments when provider data loads;
   - expanded catalogue has 57 suggestions;
   - clicking radar/catalog symbol auto-loads graph;
   - arbitrary `NVDA` works;
   - `IE00B03HD191` attempts fund NAV research;
   - graph shows ▲ BUY / ◆ ADD / ▼ SELL when produced;
   - tooltip shows signal date, later execution date and execution price/NAV;
   - changing the research date never mutates the real portfolio.
6. Fix failures directly in GitHub and rerun the same validation. Never use GitHub Actions.
