# Trading — Canonical Project State

> Operational memory. Repository `fmaranis/Trading/main` is canonical. **Do not add or depend on GitHub Actions.** ChatGPT develops/fixes directly in GitHub. AI Studio is test-only: sync current `main` and run deterministic local validation; it must not edit source.

## Current status — 2026-08-29

React + TypeScript + Vite decision-support app using REAL market data. Latest recorded AI Studio validation before the current portfolio-discovery/position-health refactor: **2026-08-29 18:55:33 UTC**, green (`exitCode: 0`, `ok: true`, all 3 expected markers detected). Current HEAD contains later research UX plus the new cash-first portfolio discovery and independent position-health logic and therefore requires one fresh `npm run validate:aistudio` before being called validated.

## Non-negotiable product architecture

The application has exactly **two clearly separated primary workspaces**. Do not merge them back into one long vertical data stream.

### 1. Mi cartera real

Purpose: factual state and actions on the user's actual money only.

Contains:
- real positions and real liquidity;
- `Qué haría hoy` as the only operational recommendation surface;
- transactional application of confirmed manual operations;
- independent health of every current position;
- concise explanation and collapsed alerts/history.

It must not contain arbitrary-ticker research, general robustness charts or screening tables as primary content.

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

Research does **not** become a real portfolio operation until portfolio/cash/consensus/cost/broker/currency gates are satisfied.

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

`InteractiveInvestmentDecisionCenter` listens to `USER_PORTFOLIO_UPDATED_EVENT` (`custodia:user-portfolio-updated`) so deployable capital and position health recalculate after portfolio changes.

## New-money portfolio decision pipeline — cash and consensus BEFORE allocator

The old behavior allowed Risk Parity / Inverse Volatility to construct a target first and only compared its proposed purchases with the 2.5% cash account later. This created contradictory-looking weak recommendations.

The canonical new-money pipeline is now:

**REAL discovery → cash hurdle → strategy consensus → diversified candidate shortlist → allocator → execution costs / whole shares / broker**

Files:
- `src/investment/decision/portfolioDiscoveryUniverse.ts`
- `src/investment/decision/portfolioCandidateGate.ts`
- `src/components/InteractiveInvestmentDecisionCenter.tsx`

### Production discovery universe

`EUR_PORTFOLIO_DISCOVERY_UNIVERSE` = original `EUR_ASSET_UNIVERSE` + a separate EUR-quoted equity expansion including names such as ASML, SAP, Siemens, Allianz, Airbus, LVMH, Schneider Electric, TotalEnergies, Santander, BBVA, Inditex, Iberdrola, Repsol, Enel, UniCredit, etc.

Critical validation invariant:

> `EUR_VALIDATION_HOLDOUT_UNIVERSE` remains completely outside production portfolio discovery.

The holdout is still independent evidence. It must **never** be merged into `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` merely to increase the number of portfolio candidates.

### Candidate gate

`PortfolioCandidateGate.apply(...)` requires a new-money candidate to:
1. have accepted REAL data;
2. beat the configured cash benchmark (`CashBenchmarkService`, default **2.5% annual**), using the existing explicit historical proxy;
3. obtain `StrategyConsensusEngine.newMoneyAction === BUY`;
4. not be in structural downtrend.

Only after these gates does the app rank/diversify candidates and pass up to 12 candidates (maximum 2 per category) to the allocator.

MEDIUM risk still uses **Risk Parity ERC**, but now it can allocate only among assets that already earned eligibility through cash + consensus. LOW remains Inverse Volatility; HIGH remains Relative Momentum.

If **no candidate** passes the pre-allocation gates, the correct portfolio recommendation is explicit **100% cash**. The app must not force a weak asset into the portfolio merely to produce a recommendation.

`CashBenchmarkService.set/reset` emits `CASH_BENCHMARK_UPDATED_EVENT`; changing the account yield re-runs the candidate gate without requiring a fresh market download.

## Existing-position health — being owned does not grant immunity

Engine/service:
`src/investment/decision/portfolioPositionHealth.ts`

Every real position is evaluated independently from allocation drift. Visible states are:
- **AÑADIR**
- **MANTENER**
- **VIGILAR**
- **REDUCIR**
- **SALIR**
- **DATOS PENDIENTES**

Core asymmetry:

> A position is never sold merely because it is overweight or merely because its recent proxy is below the 2.5% cash account.

Rules:
- `ADD`: favorable existing-position consensus and positive excess vs cash;
- `HOLD`: no material deterioration and no strong add signal;
- `WATCH`: weak/AVOID or below-cash evidence without the structural sell threshold;
- `REDUCE`: existing-position consensus reaches `REDUCE_REVIEW` / confirmed structural deterioration; default review size 50%;
- `EXIT`: stronger threshold — structural downtrend + at least 4 unfavorable votes + consensus <= -3; suggested reduction 100%;
- `DATA_MISSING`: insufficient REAL evidence/valuation.

Thus **cash underperformance alone => WATCH, never REDUCE/EXIT**.

`PortfolioDecisionEngine` gives independent position health precedence over theoretical allocation drift. Allocation overweight alone remains HOLD. REDUCE/EXIT come only from position health.

## Arbitrary holdings inside the real portfolio

A manually entered holding is no longer automatically `UNKNOWN`/ignored simply because it is not in the configured portfolio catalogue.

`PortfolioPositionHealthService`:
- uses the loaded scan for known positions;
- for an arbitrary listed ticker, requests its REAL history through `HistoricalMarketDataService` and evaluates it with the same `SingleAssetResearchEngine` / consensus logic;
- for an arbitrary 12-character ISIN, attempts direct EODHD NAV history;
- can value an arbitrary EUR-listed holding from REAL unit price × shares;
- does **not** invent EUR valuation for a non-EUR position. Such positions surface `FX_REQUIRED` until FX valuation is implemented.

An arbitrary EUR holding with valid REAL data can therefore become HOLD/WATCH/REDUCE/EXIT instead of being automatically protected or automatically blocking the model because it was not pre-catalogued.

No fake allocation category is invented for an arbitrary holding. It contributes to total invested capital when its EUR valuation is known, while its own health determines sell/watch behavior.

## Health-driven execution

`portfolioExecutionPlan.ts` now consumes `PortfolioPositionDecision.action` from independent health:
- `REDUCE` → partial sale/reimbursement using `suggestedReductionPct`;
- `EXIT` → full sale/reimbursement;
- `WATCH` / `HOLD` → no sell instruction;
- ETF/stock sell cost gates remain active;
- for transferable funds, if an eligible destination fund exists and passes the cash hurdle, traspaso is preferred before taxable reimbursement where applicable;
- arbitrary listed positions can use their monitored REAL portfolio value to derive a unit price for a sell plan when they are outside the configured scan.

This remains **manual execution guidance**, never automatic broker order submission.

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
- same `StrategyConsensusEngine`: long trend, 120-session momentum, mean reversion/buy-the-dip, risk, cash hurdle;
- outside position + BUY consensus => BUY marker;
- inside position + required structural deterioration/adverse votes => SELL marker;
- first ADD regime may show ADD marker;
- execution strictly on the next available observation after the signal;
- listed instruments use next-bar open; funds use next available NAV;
- future prices cannot change earlier signals.

Chart semantics:
- ▲ green = BUY;
- ◆ cyan = ADD;
- ▼ red = SELL / REDUCE;
- tooltip shows signal date → execution date, execution price/NAV, consensus and votes.

The chart compares normalized follow-signals performance vs buy-and-hold and shows asset drawdown. It is research-only, not a costed broker simulation.

## Research universe vs production universe

The research workspace remains broader than production decisions.

`InvestmentResearchLab`:
- merges production/catalog data with `EUR_VALIDATION_HOLDOUT_UNIVERSE` for **research viewing only**;
- automatically scans the external holdout when research opens;
- combines accepted candidates in `Radar actual ampliado`;
- arbitrary ticker/ISIN research remains available outside either catalogue.

Important distinction:
- holdout may be visible in research because research is non-operational;
- holdout may **not** feed production portfolio recommendations;
- production allocator uses `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` after cash+consensus gating;
- arbitrary research remains uncapped by the portfolio shortlist.

Do not interpret “all possible symbols” as sending thousands of Yahoo requests on page load. Broader market-wide discovery should use explicit market presets/dynamic discovery with caching/batching.

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

`validate:aistudio:raw` includes all previous deterministic/live gates plus:
- `tests/portfolioCandidateGate.unit.ts`
- `tests/portfolioPositionHealth.unit.ts`
- expanded `tests/portfolioDecisionEngine.unit.ts`
- `tests/portfolioHealthExecutionPlan.unit.ts`

New regression invariants include:
- strong candidates can survive the pre-allocation gate;
- a candidate that does not beat cash is excluded **before** allocator;
- structural downtrend is excluded from new money;
- portfolio discovery remains disjoint from validation holdout;
- position cash-underperformance alone => WATCH;
- strong structural deterioration => EXIT;
- REDUCE remains partial;
- arbitrary EUR holdings with REAL monitored values count in portfolio value and are not automatically `DATA_MISSING`;
- health REDUCE/EXIT overrides protective allocation-drift HOLD logic;
- EXIT produces a full executable sale, REDUCE a partial sale;
- WATCH never becomes a sell instruction.

Existing gates remain for:
- user real-portfolio persistence/migration;
- transactional execution;
- strategy consensus;
- single-asset causal graph;
- historical/dynamic replay;
- holdout/live robustness.

No GitHub Actions workflow and no standalone validation artifact/marker was added.

## Known limitations / next expansion

- production discovery is now materially broader but is still a curated EUR list; true market-wide presets (complete IBEX / EuroStoxx / S&P 500 / Nasdaq, etc.) should use cached/batched universe discovery rather than thousands of requests on each page load;
- non-EUR arbitrary holdings can be analyzed but need a proper FX valuation layer before their market value can safely feed EUR portfolio accounting;
- EODHD fund research/valuation depends on provider quota;
- Yahoo is unofficial/non-contractual;
- current catalogue historical analysis has survivorship bias;
- single-asset follow-signals return is normalized research, not a costed broker backtest;
- broker/currency/tax checks still apply before a research idea becomes a real manual operation.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio.
2. AI Studio must not modify source.
3. Run exactly `npm run validate:aistudio`.
4. Confirm TypeScript/build plus all new candidate-gate/position-health tests and previous portfolio/research gates are green.
5. Visual sanity check:
   - exactly two primary tabs remain: **Mi cartera real** / **Estudio y señales**;
   - real Vanguard positions remain present;
   - portfolio header reports discovery count → cash+consensus eligible count → allocator count;
   - weak below-cash candidates are absent from new-money recommendations;
   - stronger candidates from the expanded production universe can compete for portfolio allocation;
   - each existing position visibly shows AÑADIR / MANTENER / VIGILAR / REDUCIR / SALIR;
   - manually adding an arbitrary EUR ticker with valid Yahoo data produces a health state instead of automatic UNKNOWN/HOLD immunity;
   - cash underperformance alone shows VIGILAR, not a sell;
   - structural deterioration can create REDUCIR/SALIR;
   - `Aplicar a mi cartera` still mutates holdings/liquidity transactionally;
   - research graph and its ▲/◆/▼ markers remain unchanged.
6. Fix any failure directly in GitHub and rerun the same local validation. Never use GitHub Actions.