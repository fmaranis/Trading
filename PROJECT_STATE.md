# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions. AI Studio is test-only: development and corrections are made directly in GitHub; AI Studio only syncs and runs deterministic local validation.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks, backtests, explains signals, reconstructs historical recommendations and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation remains **2026-08-29 09:23:56 UTC**, green (`exitCode: 0`, `ok: true`, `spawnError: null`). A UI/validation integration refactor was made after that run and therefore needs one fresh local `npm run validate:aistudio` before the current HEAD is called fully validated.

## Non-negotiable product architecture

The app must answer user questions, not expose the internal engine graph.

**Durable UX rule:** one user question = one visible surface. Internal engines may remain modular for correctness/testability, but a new engine or diagnostic must be integrated into an existing user-facing flow whenever it answers the same question. Do not create a new primary card, page, command or result artifact merely because a new calculation module exists.

Current primary flow:

1. automatic REAL market refresh;
2. **Qué haría hoy** — one actionable recommendation;
3. optional **Por qué** — consensus/evidence explaining that recommendation, not a second decision surface;
4. **Tu cartera** — current holdings and theoretical distribution;
5. **Cómo habría funcionado esta decisión en el pasado** — one integrated historical analysis;
6. optional **Seguimiento y memoria** — alerts, saved snapshots and audit trail;
7. research/provider detail remains secondary/lazy.

Core usefulness must not require a new paid external subscription.

## Actionable decision and sell protection

Allocation drift alone is not a sell signal.

`PortfolioExecutionPlanPanel` is the single primary actionable surface. It combines the portfolio decision, cash benchmark, costs, broker constraints and strategy consensus. BUY/SUBSCRIBE/TRANSFER proposals are vetoed when consensus does not authorise new money. Existing holdings require stronger evidence: `REDUCE_REVIEW` needs structural downtrend plus several adverse votes; an overweight category alone never authorises a sale.

The separate `StrategyConsensusPanel` remains available only inside the collapsed **Por qué llega a esa conclusión** explanation. It is not rendered as another top-level decision module.

## Explainable strategy consensus

Engine: `src/investment/decision/strategyConsensusEngine.ts`.

Five votes from already-loaded data:

- long trend: ~12-month return + distance to SMA200;
- 120-session momentum, with 60/20 context;
- mean reversion / buy-the-dip: RSI14 + current drawdown + long-trend integrity;
- risk: annualized volatility + drawdown;
- cash hurdle: annualized 120-session proxy vs configured remunerated cash.

Asymmetry is intentional:

- weak/negative consensus can reject new money;
- one weak window does not sell an existing holding;
- `REDUCE_REVIEW` requires structural deterioration plus multiple adverse votes.

Consensus does not yet replace the production allocators: LOW=Inverse Volatility, MEDIUM=Risk Parity ERC, HIGH=Relative Momentum.

## Integrated historical analysis

User-facing component: `src/components/HistoricalDecisionReplayPanel.tsx`.

There is now **one** historical surface. The former standalone `DynamicHistoricalReplayPanel.tsx` was removed.

Pressing **Analizar histórico** runs both layers needed to answer the user's real question:

1. dynamic chronological replay from the chosen start date, revisiting the portfolio monthly or quarterly and following BUY / ADD / HOLD / AVOID / REDUCE / EXIT signals;
2. robustness check across several historical annual start dates using the static dated-decision replay.

The primary result compares, on the same evidence:

- following successive historical signals;
- buying the initial recommendation and holding it;
- leaving the same capital in remunerated cash.

The same surface shows the chronological alerts/operations, fees, cash interest, observed drawdown and a collapsed **¿Depende demasiado de la fecha de inicio?** robustness section.

The historical engines remain separate internally because they answer different calculation subproblems and have independent causal tests:

- `historicalDecisionReplay.ts` reconstructs the initial recommendation at historical dates;
- `dynamicHistoricalReplay.ts` maintains evolving cash/holdings and follows later signals.

That internal modularity must not reappear as duplicated UI.

### Dynamic replay execution protections

At each checkpoint the engine rebuilds the causal shortlist, reruns `InvestmentDecisionEngine`, builds historical `StrategyConsensusEngine` assessments and updates the simulated portfolio.

- new positions require consensus `BUY`;
- increases require `ADD`;
- allocation drift alone never sells;
- `REDUCE` / `EXIT` requires historical `REDUCE_REVIEW` plus a materially lower allocator target on the same date;
- trades execute after the information date;
- sells execute before buys;
- ETFs use whole shares and modeled MyInvestor commission;
- funds use fractional units;
- residual cash earns the configured cash rate.

`tests/historicalDecisionReplay.unit.ts` and `tests/dynamicHistoricalReplay.unit.ts` preserve causality, next-bar execution, structural sell gating and future-data isolation.

## REAL data and integrated live validation

The production scanner uses REAL market series. REAL requests must never silently fall back to synthetic data.

The previous standalone `scripts/dynamicHistoricalReplayLive.ts`, standalone command and standalone `latest-dynamic-historical-replay-live.json` design were removed because they fragmented evidence.

REAL dynamic historical evidence is now integrated into the existing `scripts/brokerAwareExecutionSweepLive.ts` and therefore into the existing `BROKER_AWARE_EXECUTION_SWEEP_RESULT` / `validation-results/latest-broker-aware-execution-sweep.json`.

One REAL scan now feeds:

- research reference;
- adaptive ETF execution sweep;
- mixed ETF/fund execution sweep;
- fund eligibility diagnostics;
- provider provenance/fingerprints;
- dynamic historical replay over several recent annual starts;
- dynamic vs initial-buy-and-hold comparison;
- dynamic vs remunerated-cash comparison;
- executed historical BUY/ADD/REDUCE/EXIT timeline.

The integrated live script explicitly fails if any accepted series is not `REAL`.

## Saved recommendations and alerts

`RecommendationSimulationPanel`, active alerts, automation status and snapshot table remain useful audit/history features, but they are now grouped under one collapsed **Seguimiento y memoria de recomendaciones** surface. They must not compete visually with the current actionable decision or integrated historical analysis.

## Cash / execution economics

Default configurable cash reference: **2.5% annual**.

- BUY/SUBSCRIBE/TRANSFER must beat the cash hurdle after modeled ETF entry fee where applicable;
- ETFs: whole shares, MyInvestor 0.12%, min 1 EUR/order, max 25 EUR/order;
- adaptive execution suppresses uneconomic small orders;
- residual cash accrues over calendar days/365;
- explicit fund subscription/redemption commission remains unmodeled pending verification.

## Validation

Relevant deterministic gates include:

- `npm run test:strategy-consensus`
- `npm run test:historical-decision-replay`
- `npm run test:dynamic-historical-replay`
- portfolio/execution/cash/broker gates already present in `validate:aistudio:raw`.

`validate:aistudio:raw` now runs the integrated `brokerAwareExecutionSweepLive.ts`; there is no separate dynamic-live command or fourth validation marker.

Latest recorded green run predates this integration refactor. A fresh `npm run validate:aistudio` is required for current HEAD.

## Known limitations / research cautions

- historical replays use the current queryable catalog and therefore retain survivorship/catalog bias;
- exact MyInvestor/Inversis availability remains pending for several targets;
- fund settlement/tax timing is not simulated;
- historical broker availability changes are not reconstructed;
- dynamic drawdown currently uses decision/execution path points rather than every daily session and may understate intraperiod drawdown;
- Yahoo remains unofficial/non-contractual;
- consensus thresholds are deterministic first-pass rules and must not be optimized on the full sample then described as predictive;
- Mean Reversion is an explainable signal/veto, not yet a production allocator.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio and run **one** local `npm run validate:aistudio`; AI Studio must not edit code.
2. Inspect the existing `validation-results/latest-aistudio-run.json` and `latest-broker-aware-execution-sweep.json` directly from GitHub.
3. The broker-aware result should now contain the integrated `dynamicHistoricalReplay` section using the same REAL dataset/provenance as the other execution evidence.
4. Fix any failure directly on GitHub and rerun the same single validation.
5. Only after this integrated flow is green, continue to the comparative causal strategy lab: Inverse Volatility vs Risk Parity ERC vs Relative Momentum vs Mean Reversion vs Ensemble.
6. That strategy comparison must plug into the existing integrated historical surface/evidence result rather than creating another top-level module.
