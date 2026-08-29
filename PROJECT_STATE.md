# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions. AI Studio is test-only: development and corrections are made directly in GitHub; AI Studio only syncs and runs deterministic local validation.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks, backtests, explains signals, simulates historical recommendations and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-29 09:23:56 UTC**, green (`exitCode: 0`, `ok: true`, `spawnError: null`). The full validation includes Strategy Consensus, buy-the-dip vs structural fall, sell-protection on overweight, consensus veto on execution proposals, causal static historical decision replay, the new dynamic historical signal replay, mixed-instrument remunerated-cash replay, broker availability/execution sweeps and the remaining `validate:aistudio:raw` gates.

## Product direction

The app must answer investment questions, not behave like a static analytics dashboard.

Normal flow:

1. automatic REAL market refresh after first paint;
2. current market/risk context and cash benchmark;
3. explainable multi-signal consensus;
4. explicit actionable plan or **HOY: MANTENER / NO FORZAR OPERACIONES**;
5. real portfolio;
6. historical dated-decision replay;
7. dynamic historical signal replay;
8. saved-recommendation simulation;
9. alerts;
10. research/provider detail secondary/lazy.

Core usefulness must not require a new paid external subscription. See `docs/DECISIONS.md` D30.

## Sell-protection / theoretical allocation separation

Current rule (D31): **allocation drift alone is not a sell signal**.

`PortfolioDecisionEngine` keeps an overweight existing position as `HOLD` unless independent deterioration evidence authorises a reduction. `UserPortfolioPanel` describes target gaps as theoretical distribution, not executable orders.

## Explainable strategy consensus

Engine: `src/investment/decision/strategyConsensusEngine.ts`.

Five current votes using already-loaded data:

- long trend: ~12-month return + distance to SMA200;
- 120-session momentum, with 60/20-session context;
- mean reversion / buy-the-dip: RSI14 + current 252-session drawdown + long-trend integrity;
- risk: annualized volatility + drawdown;
- cash hurdle: annualized 120-session proxy versus configured remunerated-cash benchmark.

Important asymmetry:

- weak/negative consensus can reject new money;
- an existing position is not reduced because of one weak window or overweight alone;
- `REDUCE_REVIEW` requires structural downtrend plus at least three adverse votes.

The consensus also vetoes executable BUY / SUBSCRIBE / TRANSFER proposals when the target is not `BUY` under the consensus.

The consensus does **not** yet replace LOW=Inverse Volatility, MEDIUM=Risk Parity ERC, HIGH=Relative Momentum as production allocators. Promotion requires comparative causal/OOS evidence.

## Historical dated-decision replay — validated

Files:

- `src/investment/decision/historicalShortlist.ts`
- `src/investment/decision/historicalDecisionReplay.ts`
- `src/components/HistoricalDecisionReplayPanel.tsx`
- `tests/historicalDecisionReplay.unit.ts`

Annual or quarterly historical start-date tests reconstruct the causal shortlist, run `InvestmentDecisionEngine`, execute the initial recommendation on the first later bar, model whole ETF shares / MyInvestor commission and fractional fund units, remunerate target/residual cash, and compare the final result with all-cash.

Causal invariant: changing only prices after the historical decision date may alter the eventual outcome but must not alter the reconstructed historical regime, method or target weights.

This remains a current-catalog replay and therefore retains explicit survivorship/catalog bias.

## Dynamic historical signal replay — validated

Files:

- `src/investment/decision/dynamicHistoricalReplay.ts`
- `src/components/DynamicHistoricalReplayPanel.tsx`
- `tests/dynamicHistoricalReplay.unit.ts`
- `docs/DYNAMIC_HISTORICAL_REPLAY.md`

The dynamic replay follows successive monthly or quarterly historical decisions rather than freezing the initial recommendation until the end.

At each chronological checkpoint it:

1. rebuilds the causal historical shortlist using only data available then;
2. reruns `InvestmentDecisionEngine`;
3. rebuilds `StrategyConsensusEngine` assessments for selected and already-held assets;
4. records `BUY`, `ADD`, `HOLD`, `AVOID`, `REDUCE` and `EXIT` signals;
5. executes eligible trades strictly after the information date;
6. values the evolving portfolio and remunerates residual cash.

Execution protections:

- new positions require consensus `BUY`;
- increases require `ADD`;
- allocation drift alone never authorises a sale;
- `REDUCE` / `EXIT` requires historical `REDUCE_REVIEW` plus a materially lower allocator target on that same date;
- sells execute before buys;
- ETFs use whole shares and modeled MyInvestor commission;
- funds use fractional units.

The UI compares three outcomes over the same historical evidence:

1. following successive dynamic signals;
2. initial recommendation + hold via `HistoricalDecisionReplayEngine`;
3. all-cash remunerated benchmark.

It exposes a chronological signal timeline with consensus votes, structural-downtrend / buy-the-dip context, execution date, units, notional and fees. HOLD / AVOID are available for audit but hidden by default.

`tests/dynamicHistoricalReplay.unit.ts` validates repeated chronological decisions, executable buy/add and reduce/exit paths, structural sell gating, next-bar execution and future-price isolation of earlier signals. This gate passed in the 2026-08-29 09:23:56 UTC full validation.

## Existing saved-recommendation simulator

`RecommendationSimulationPanel` remains separate:

- saved-snapshot simulator: what an actually stored recommendation would be worth today;
- dated static replay: what the current engine would have recommended at a chosen historical date;
- dynamic replay: whether following later historical signals would improve or worsen that initial decision.

All are historical diagnostics, not forecasts.

## Cash benchmark / execution economics

Default configurable reference: **2.5% annual**.

- BUY/SUBSCRIBE/TRANSFER must beat the cash hurdle after modeled ETF entry fee where applicable;
- ETFs use whole shares, MyInvestor 0.12%, min 1 EUR/order, max 25 EUR/order;
- capital-adaptive execution suppresses uneconomic small orders;
- residual cash accrues over calendar days/365;
- fund explicit subscription/redemption commission remains unmodeled until verified.

## Free-data rule

No strategy or primary feature may require a new paid market-data, news or fundamentals subscription. Existing free/zero-incremental-cost sources may be used with explicit provenance and graceful failure. Paid evidence may only be optional in the future.

## Validation gates

Relevant package scripts include:

- `npm run test:strategy-consensus`
- `npm run test:historical-decision-replay`
- `npm run test:dynamic-historical-replay`

All are included in `validate:aistudio:raw`. Latest recorded full validation is green at **2026-08-29 09:23:56 UTC**.

## Known limitations / research cautions

- Present-catalog survivorship bias remains in historical replays.
- Exact MyInvestor/Inversis availability remains pending for several active targets.
- Fund settlement/tax timing is not simulated.
- Historical broker availability changes are not reconstructed.
- Dynamic replay drawdown is currently measured on decision/execution path points rather than every daily session and can understate intraperiod drawdown.
- Yahoo remains unofficial/non-contractual.
- Consensus thresholds are deterministic first-pass thresholds; do not optimize them on the full sample and then claim predictive power.
- Mean reversion is currently an explainable signal/veto, not yet a production allocator.

## Immediate next step

1. Treat static and dynamic historical replay as implemented and validated; do not rebuild them.
2. Manually inspect the primary UI when convenient: automatic refresh, consensus panel, no sell-from-overweight contradiction, static replay, dynamic signal timeline and the dynamic-vs-static-vs-cash comparison.
3. Next implementation block: build a **comparative causal strategy lab** for **Inverse Volatility vs Risk Parity ERC vs Relative Momentum vs Mean Reversion vs Ensemble**.
4. Reuse the dynamic replay as an evaluation surface so each strategy is judged not only by CAGR/Sharpe but by whether its successive BUY/ADD/REDUCE/EXIT actions add or destroy value versus its own static buy-and-hold baseline and remunerated cash.
5. Do not promote Mean Reversion or Ensemble into the production allocator until comparative causal/OOS evidence supports it.
