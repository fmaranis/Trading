# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks, backtests, explains signals, simulates historical recommendations and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation remains **2026-08-29 06:33 UTC**, green (`exitCode: 0`, `ok: true`, `spawnError: null`). All product/strategy changes listed below were made **after** that run and therefore require one fresh local `npm run validate:aistudio` before being called validated.

## Product direction

The app must answer investment questions, not behave like a static analytics dashboard.

Normal flow:

1. automatic REAL market refresh after first paint;
2. current market/risk context and cash benchmark;
3. explainable multi-signal consensus;
4. explicit actionable plan or **HOY: MANTENER / NO FORZAR OPERACIONES**;
5. real portfolio;
6. historical dated-decision replay;
7. saved-recommendation simulation;
8. alerts;
9. research/provider detail secondary/lazy.

Core usefulness must not require a new paid external subscription. See `docs/DECISIONS.md` D30.

## Sell-protection / theoretical allocation separation

Previous issue: `PortfolioDecisionEngine` treated >5 pp category overweights as `REDUCE` / `REVIEW_TRANSFER`; `PortfolioExecutionPlan` could then turn that allocation drift into an actual sell/redeem instruction even while the top-level cash gate said not to operate.

Current rule (D31): **allocation drift alone is not a sell signal**.

`PortfolioDecisionEngine` now keeps an overweight existing position as `HOLD` and explains the theoretical deviation. A reduction must eventually be authorised by independent deterioration/consensus evidence.

`UserPortfolioPanel` was relabeled from **Qué hacer con tu cartera y el dinero nuevo** to **Distribución teórica de tu cartera**. It explicitly states that target gaps are diagnostic and that new-capital amounts are pre-gate theoretical targets, not orders.

## Explainable strategy consensus

New engine: `src/investment/decision/strategyConsensusEngine.ts`.

Uses only data already loaded by the app; no paid dependency. Five current votes:

- long trend: ~12-month return + distance to SMA200;
- 120-session momentum, with 60/20-session context;
- mean reversion / buy-the-dip: RSI14 + current 252-session drawdown + long-trend integrity;
- risk: annualized volatility + drawdown;
- cash hurdle: annualized 120-session proxy versus configured remunerated-cash benchmark.

Important asymmetry:

- rejecting new money can happen with weak/negative consensus;
- an existing position is not reduced because of one weak window or an overweight category;
- `REDUCE_REVIEW` requires structural downtrend plus at least three adverse votes.

`StrategyConsensusPanel` is in the primary flow and shows, for each shortlisted or already-owned instrument, the votes, whether a decline looks like a possible buy-the-dip or a structural fall, the new-money action and the existing-position action.

The consensus now also acts as a **veto on executable new-money actions** in `PortfolioExecutionPlanPanel`: BUY / SUBSCRIBE / TRANSFER proposals are converted to `REVIEW / NO OPERAR` when the target is not `BUY` under the consensus. This closes the prior possibility of the top-level message saying maintain while a lower plan still proposed buying due to allocation/cash logic alone.

The consensus does **not yet replace** LOW=Inverse Volatility, MEDIUM=Risk Parity ERC, HIGH=Relative Momentum as production allocators. Promotion requires comparative causal/OOS evidence.

## Historical dated-decision replay

New files:

- `src/investment/decision/historicalShortlist.ts`
- `src/investment/decision/historicalDecisionReplay.ts`
- `src/components/HistoricalDecisionReplayPanel.tsx`
- `tests/historicalDecisionReplay.unit.ts`

The user can run annual (1 January) or quarterly historical start-date tests from the primary flow.

For each requested date the replay:

1. keeps only bars available on/before that date;
2. requires the same 252-bar minimum history;
3. rebuilds the shortlist with the same scanner momentum/risk score, one-per-category diversification and defensive preference;
4. runs the normal `InvestmentDecisionEngine` on that historical shortlist;
5. executes the resulting static recommendation on the first later market bar;
6. uses whole ETF shares + modeled MyInvestor commission and fractional fund units;
7. remunerates target/residual cash at the configured benchmark;
8. values positions at the latest REAL bar;
9. compares with keeping the same starting capital entirely in remunerated cash.

Batch output includes:

- successful historical dates;
- number/% beating all-cash;
- median return;
- median excess percentage points vs cash;
- best/worst start dates;
- per-date regime, method, cash target and full allocation drilldown.

Causal invariant: changing only prices **after** the historical decision date may change final outcome but must not change the reconstructed historical regime, method or target weights.

Remaining limitation: this still uses the present queryable catalog, so survivorship/catalog bias remains explicit. It reconstructs historical shortlist decisions within that catalog but does not reconstruct delisted/unavailable historical constituents.

## Existing saved-recommendation simulator

`RecommendationSimulationPanel` remains separate from the new dated replay:

- saved-snapshot simulator asks what a recommendation actually stored by the app would be worth today;
- dated-decision replay reconstructs what the current engine would have recommended on chosen historical dates even if no snapshot was saved then.

Both compare against remunerated cash and remain historical diagnostics, not forecasts.

## Cash benchmark / execution economics

Default configurable reference: **2.5% annual**.

- BUY/SUBSCRIBE/TRANSFER must beat the cash hurdle after modeled ETF entry fee where applicable.
- ETFs use whole shares, MyInvestor 0.12%, min 1 EUR/order, max 25 EUR/order.
- capital-adaptive execution suppresses uneconomic small orders.
- mixed historical replay accrues residual cash over calendar days/365.
- fund explicit subscription/redemption commission remains unmodeled until verified.

## Free-data rule

No strategy or primary feature may require a new paid market-data, news or fundamentals subscription. Existing free/zero-incremental-cost sources may be used with explicit provenance and graceful failure. Paid evidence may only be optional in the future.

## Validation gates added in this block

New package scripts:

- `npm run test:strategy-consensus`
- `npm run test:historical-decision-replay`

Both are now part of `validate:aistudio:raw`.

`tests/strategyConsensus.unit.ts` checks that a healthy long-term trend with a controlled oversold drawdown can be identified as buy-the-dip and that one weak recent window does not trigger a sell; a true structural fall with several adverse signals can trigger `REDUCE_REVIEW`.

`tests/historicalDecisionReplay.unit.ts` checks historical-date causality, next-bar execution and future-price isolation of historical decisions.

## Known limitations / next research block

- Present-catalog survivorship bias remains in historical replays.
- Exact MyInvestor/Inversis availability remains pending for several active targets.
- Fund settlement/tax timing is not simulated.
- Yahoo remains unofficial/non-contractual.
- The consensus signal thresholds are deterministic first-pass thresholds; they must not be optimized on the full sample and then claimed as predictive.
- Mean reversion is implemented as an explainable signal/veto, not yet as a production allocator.

## Immediate next step

1. Run **one** `npm run validate:aistudio` for the complete post-06:33 block.
2. Read `validation-results/latest-aistudio-run.json` and related result files directly from GitHub; do not ask the user to paste output.
3. Fix any TypeScript/test/runtime failure directly on `main`.
4. After green validation, manually verify primary UI: automatic refresh, consensus panel, no sell-from-overweight contradiction, historical replay annual/quarterly drilldown.
5. Next implementation block: comparative causal strategy lab for **Inverse Volatility vs Risk Parity ERC vs Relative Momentum vs Mean Reversion vs Ensemble**, then dynamic replay that follows every successive recommendation to measure whether rebalancing adds or destroys value versus buy-and-hold and cash.
