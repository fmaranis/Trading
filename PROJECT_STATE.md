# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-29 06:33 UTC**, green (`exitCode: 0`, `ok: true`, `spawnError: null`). This validation includes the remunerated-cash replay and all prior deterministic suites. Product-flow/UI changes listed below were made **after** that validation and require one fresh local `npm run validate:aistudio` before being called validated.

## Product direction — decision/action first

The application must behave like an investment decision tool, not a collection of unrelated analytics cards.

Primary flow now is:

1. market data refreshes automatically on entry using the REAL universe;
2. current market/risk context;
3. visible cash-vs-investment guardrails;
4. **Qué haría hoy · Recomendación accionable** generated automatically from the current portfolio + market decision + execution gates;
5. **Mi cartera real**;
6. **Si hubiera seguido una recomendación anterior…** historical simulator linked to saved daily recommendation snapshots;
7. alerts and change tracking;
8. research charts/provider diagnostics collapsed or explicitly secondary.

Important product rule: important recommendations must not exist only inside research/backtest modules. They must be translated into a visible action or an explicit “mantener/no operar” conclusion.

## Automatic refresh / responsiveness

The previous fully-manual market-loading experiment was rejected as poor UX. `InteractiveInvestmentDecisionCenter.tsx` again starts the REAL universe scan automatically after first paint using `requestIdleCallback` (short timer fallback), while keeping the heavy multi-asset research chart lazy.

The earlier app freeze was traced more plausibly to stale persisted execution-plan data than to the market scan itself; defensive fallbacks remain in place for old stored plans.

Manual **Actualizar ahora** remains available but is not required for normal entry.

## Actionable recommendation

`PortfolioExecutionPlanPanel` now generates the execution plan automatically when `scan` / `decision` changes. The previous mandatory **Preparar operaciones** step is removed.

The top of that panel states one explicit conclusion:

- one or more concrete BUY / SELL / SUBSCRIBE / TRANSFER / REDEEM actions, including target and amount; or
- **HOY: MANTENER / NO FORZAR OPERACIONES** when no target clears all gates.

The detailed lines remain below for auditability, broker availability confirmation and manual completion status.

Execution still respects:

- cash benchmark/opportunity cost;
- whole ETF shares;
- MyInvestor modeled commissions;
- capital-adaptive cost gates;
- broker availability evidence;
- fund-vs-ETF semantics.

## Recommendation-history simulator

New component: `src/components/RecommendationSimulationPanel.tsx`.

It consumes the same `MarketSnapshotHistoryService` snapshots already saved by the app and is mounted directly in the portfolio/action flow.

The user can choose a saved recommendation and a simulated capital amount. For each allocation it calculates:

- first executable market bar after the recommendation date;
- entry price;
- current/latest REAL price from the same accepted dataset;
- ETF whole-share quantity and modeled MyInvestor commission;
- fund fractional units/NAV semantics;
- residual cash remuneration at the configured cash benchmark;
- current simulated value and return.

It also compares the complete recommendation with leaving the same capital in remunerated cash over the identical period and reports:

- value today;
- return;
- all-cash value/return;
- excess EUR;
- excess percentage points;
- explicit **MEJOR QUE EFECTIVO / PEOR QUE EFECTIVO** conclusion.

The daily snapshot saved during the current session is passed directly into the simulator, so no reload is required for it to appear.

This simulator is historical diagnostic evidence, not a profitability forecast. It does not yet model tax, spread or fund settlement.

## Cash benchmark / opportunity-cost hurdle

Durable rule: `docs/DECISIONS.md` D27–D28. Default reference is **2.5% annual**, persisted with `CashBenchmarkService`.

The current execution plan suppresses BUY/SUBSCRIBE/TRANSFER targets that do not beat the configured cash hurdle after modeled initial ETF cost. `MixedInstrumentCausalReplayEngine` also accrues interest on residual cash using calendar days/365 and compares the strategy with an all-cash benchmark over identical dates.

Latest validated examples from the 06:33 UTC run:

- 100 EUR mixed replay: no operations; strategy = all-cash, final about 118.87 EUR over the replay span;
- 334 EUR mixed replay: strategy about 366.60 EUR versus all-cash about 397.02 EUR, therefore cash wins historically for that scenario.

These are historical diagnostics over the replay period, not forecasts.

## Broker / MyInvestor availability

Availability remains separate from REAL market-data validity. Manual user confirmations and the cash benchmark remain browser/device-local.

Current first-party evidence supports Vanguard Global Stock Index `IE00B03HD191`, Vanguard Emerging Markets Stock Index `IE0031786696`, and Vanguard U.S. 500 Stock Index `IE0032126645`. Other targets remain lookup-required unless confirmed.

## Data / causal integrity

- Yahoo primary daily history; EODHD secondary ETF cross-check and mutual-fund NAV/history.
- REAL never silently falls back to synthetic.
- Scanner and causal selection require at least 252 bars.
- Historical selection uses only information available at each decision date.
- Current-catalog survivorship/availability bias remains explicit.

## Execution economics

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- MyInvestor ETF model: whole shares, 0.12%, min 1 EUR/order, max 25 EUR/order.
- Capital-adaptive execution continues to suppress uneconomic small orders.
- Fund subscriptions/redemptions remain modeled without explicit broker fund commission until verified.

## Known limitations

- Historical snapshots are currently browser/device-local.
- Historical universe retains current-catalog survivorship bias.
- Fund settlement, tax and transfer timing are not simulated.
- Exact Inversis lookup remains pending for several active targets.
- Yahoo remains unofficial/non-contractual.
- The 2.5% cash reference is configurable and not a guarantee of future broker remuneration.
- The recommendation simulator currently models stored allocation snapshots, not a separately versioned record of every manual chat recommendation made outside the app.

## Immediate next step

1. Run `npm run validate:aistudio` once after commits `1d13146...`, `868fa43...`, `7883929...`, `0d3f7da...`, `8c5fe0d...`, `78cb56f...` and inspect the recorded files from GitHub.
2. Manually open the app and verify: automatic refresh starts; actionable recommendation appears without a preparation button; portfolio is visible; simulator lists saved recommendations and updates value interactively.
3. Fix any UI/runtime issue found before adding more analytics.
4. Next product enhancement after stability: allow a simulated recommendation to be promoted into a separate paper/virtual portfolio timeline without modifying the real portfolio.