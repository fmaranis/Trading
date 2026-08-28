# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-28

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-28 22:40 UTC**, green: global recorded run `exitCode: 0`, `ok: true`; lint/build PASS and recorded deterministic suites (including `test:broker-availability` and `test:portfolio-execution-plan` cash hurdle) green. `researchReady: true`; `readyForManualPilot: false` remains intentionally separate.

## Latest execution/fund findings

Adaptive execution remains capital-dependent. At 100 EUR the policy correctly executes no ETF orders instead of paying destructive minimum fees. The latest REAL sweep has 73 causal rebalance windows.

Fund diagnosis is conclusive for the current EODHD history: 8 funds accepted, 2 currently shortlisted, but all 8 first reached the mandatory 252-bar causal-history threshold on **2026-08-19**, after the last monthly research information date **2026-07-31**. Therefore `fundOperations = 0` in the live historical sweep is a history-window limitation, not an engine failure. The independent mixed replay regression proves subscriptions/releases work when a causal fund selection actually exists.

## Primary user flow

1. current market decision;
2. Mi cartera real;
3. Operaciones pendientes;
4. alerts/changes;
5. collapsed technical/history detail.

The old simple decision backtest and duplicate ETF execution card are no longer shown in the primary flow. `/portfolio.html` is explicitly Laboratorio cuantitativo; `/legacy.html` is historical/experimental.

## Broker / MyInvestor availability evidence

Module: `src/investment/decision/brokerAvailability.ts`. Durable rules: `docs/DECISIONS.md` D25–D26.

Availability is separate from REAL market-data validity. Public evidence and user confirmations are preserved as different evidence sources.

Effective states:

- `CONFIRMED_MYINVESTOR`: either current first-party MyInvestor evidence or a persisted user confirmation;
- `REQUIRES_INVERSIS_LOOKUP`: current availability still needs checking;
- `USER_CONFIRMED_UNAVAILABLE`: user checked and did not find the instrument at that time;
- `UNVERIFIED`: reserved fallback state.

`ManualMyInvestorAvailabilityService` persists confirmations in browser localStorage key `custodia_myinvestor_manual_availability_v1`, normalized by ISIN/ticker. In **Operaciones pendientes** the user can mark a target as available, unavailable, or remove their confirmation. Manual evidence takes UI precedence but never mutates the separate public evidence registry.

First public-evidence pass on 2026-08-28:

- **IE0032126645 — Vanguard U.S. 500 Stock Index Fund:** `CONFIRMED_MYINVESTOR` from current public MyInvestor evidence.
- **IE00B03HD191 — Vanguard Global Stock Index Fund:** `CONFIRMED_MYINVESTOR` from current public MyInvestor evidence.
- **IE0031786696 — Vanguard Emerging Markets Stock Index Fund:** `CONFIRMED_MYINVESTOR` from current public MyInvestor evidence.
- **IE00B5456744 — Vanguard ESG Developed World:** `REQUIRES_INVERSIS_LOOKUP`; historical evidence does not prove current standalone availability.
- **Active shortlisted ETFs:** remain `REQUIRES_INVERSIS_LOOKUP` until confirmed manually or by first-party evidence.

## Cash benchmark / opportunity-cost hurdle (2.5% default)

Durable rule: `docs/DECISIONS.md` D27. New module: `src/investment/decision/cashBenchmark.ts`.

The user's MyInvestor account currently provides a **2.5% annual cash-remuneration reference**. This is now the default configurable execution hurdle, not a research-ranking input.

Execution semantics:

- research scores/targets remain unchanged;
- before a new ETF purchase or fund subscription becomes actionable, the plan compares it with the configured cash benchmark;
- current proxy = REAL 120-session momentum annualized to 252 sessions;
- ETF first-year proxy subtracts modeled entry commission drag;
- if net proxy `<= 2.5%`, or cannot be calculated, the line becomes `REVIEW` with **“Mantener en cuenta / no invertir todavía”** wording;
- actionable BUY/SUBSCRIBE lines expose proxy annual return, cash benchmark and excess return vs cash;
- a proposed destination fund must also pass the benchmark before the UI suggests a transfer;
- the proxy is explicitly historical/diagnostic, never a forecast or guarantee.

The benchmark is editable in **Operaciones pendientes** and persisted in browser localStorage under `custodia_cash_benchmark_annual_pct_v1`, so future changes to the account rate do not require code changes.

`tests/portfolioExecutionPlan.unit.ts` now includes positive benchmark cases and a weak-return case that must remain in cash. Fresh validation is required after this implementation.

## Data / causal integrity

- Yahoo primary daily history; EODHD secondary ETF cross-check and mutual-fund NAV/history.
- REAL never silently falls back to synthetic.
- Scanner and causal selection require at least 252 bars.
- Historical selection uses only information available at each decision date.
- Current-catalog survivorship/availability bias remains explicit.

## Decision / broker model

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- Confidence means evidence quality, not probability of profit.
- MyInvestor ETF cost model: whole shares, 0.12%, min 1 EUR/order, max 25 EUR/order.
- Broker availability evidence and the 2.5% cash hurdle do not alter research scores; they alter only actionability/execution.

## Capital-adaptive execution

`adaptiveExecutionPolicy.ts` changes execution gates, never research targets:

- MICRO `<300`: 12 pp drift / 100 EUR min ETF order / 1.25% max order fee drag / 0.50% window fee budget.
- SMALL `300–999`: 8 pp / 80 EUR / 1.50% / 0.75%.
- MEDIUM `1,000–4,999`: 6 pp / 75 EUR / 1.50% / 0.75%.
- LARGE `5,000–24,999`: 4 pp / 100 EUR / 1.25% / 0.60%.
- INSTITUTIONAL `>=25,000`: 3 pp / 150 EUR / 1.00% / 0.50%.

## Known blockers / limitations

- Manual broker confirmations and cash-benchmark setting are currently local to the browser/device; no authenticated cloud sync exists yet.
- Exact Inversis lookup remains pending for active shortlisted ETFs and several funds until user/public evidence is captured.
- Fund settlement/tax/transfer timing is not yet simulated.
- Fund transaction costs remain zero in the hurdle until broker-specific fund fees are verified.
- Historical 120-session annualized return is only an execution proxy, not expected-return forecasting.
- Historical universe retains current-catalog survivorship bias.
- Yahoo remains unofficial/non-contractual.

## Immediate next step

1. Inspect the current real recommendation to check which proposed assets clear the 2.5% cash hurdle net of modeled ETF entry fees.
2. Use the manual controls in "Operaciones pendientes" to confirm exact MyInvestor availability by ISIN/ticker for any remaining actionable targets.
3. Continue fund settlement/transfer modeling only after broker-specific operational rules are verified.
