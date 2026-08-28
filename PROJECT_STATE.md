# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-28 22:58 UTC**, green: global recorded run `exitCode: 0`, `ok: true`; lint/build PASS and recorded deterministic suites (including broker availability, visible guardrails, and cash-hurdle execution tests) green. `researchReady: true`; `readyForManualPilot: false` remains intentionally separate.

## Primary user flow

1. current market decision;
2. **visible execution guardrails: cash benchmark + current shortlist + MyInvestor state**;
3. lightweight research launcher;
4. Mi cartera real;
5. Operaciones pendientes;
6. alerts/changes;
7. collapsed technical/history detail.

The main page must not hide important execution rules only inside the calculation engine.

## Visible execution guardrails

Component: `src/components/DecisionGuardrailsPanel.tsx`, rendered directly below the current market-decision summary.

The primary screen visibly shows, for every current shortlisted instrument:

- ticker/product type/category;
- REAL 120-session momentum;
- annualized historical proxy used by the cash hurdle;
- excess/deficit in percentage points versus the configured cash remuneration;
- explicit `SUPERA EFECTIVO` versus `MANTENER EN CUENTA` state;
- effective MyInvestor availability state (`confirmed`, user-confirmed, unavailable by user check, or pending lookup).

The MyInvestor cash reference is editable on this primary panel, defaults to 2.5% annually, and persists through `CashBenchmarkService` in browser localStorage.

`PortfolioExecutionPlanPanel` does not keep an independent benchmark setting. Every time the user presses **Preparar/Actualizar plan**, it reloads the single persisted benchmark. This prevents the visible value and the execution value from diverging.

Important: the primary guardrail table compares the annualized 120-session proxy before order-specific ETF commission because no exact order exists yet. `Operaciones pendientes` applies the stronger final gate using the actual proposed notional and modeled entry commission. Passing the upper table therefore does not guarantee an executable buy.

## Startup responsiveness / heavy research rendering

A green deterministic validation is not sufficient if the browser UI becomes unresponsive.

`InteractiveInvestmentDecisionCenter.tsx` now:

- lets the first UI paint occur before starting the REAL universe scan by scheduling initial refresh through `requestIdleCallback` (fallback short timer);
- shows a lightweight loading message while REAL data is fetched;
- does **not** mount `RecommendationEvidencePanel` at startup;
- exposes **Ver histórico y ranking completo** to mount the heavy Recharts multi-asset history only on demand;
- keeps the visible cash-vs-investment guardrails and actionable portfolio flow outside that heavy research panel.

Reason: the previous page simultaneously scanned 38 instruments with multi-year history and immediately constructed the full multi-asset chart. This was valid computationally but could make the development/browser environment appear hung, especially while validation was also consuming resources.

Commit implementing this startup hardening: `271bbee6856eb72d90acabbb862050204c519006`.

A fresh validation is required after this performance change. In addition, the app must be manually opened with no test running to verify perceived responsiveness; compile/build success alone is not considered sufficient evidence of UI usability.

## Broker / MyInvestor availability evidence

Module: `src/investment/decision/brokerAvailability.ts`. Durable rules: `docs/DECISIONS.md` D25–D26.

Availability is separate from REAL market-data validity. Public evidence and user confirmations remain distinct. `ManualMyInvestorAvailabilityService` persists user confirmations by normalized ISIN/ticker in browser localStorage.

Current public-evidence state includes current MyInvestor evidence for Vanguard Global Stock Index `IE00B03HD191`, Vanguard Emerging Markets Stock Index `IE0031786696`, and Vanguard U.S. 500 Stock Index `IE0032126645`. Other targets remain lookup-required unless the user confirms them in their account.

## Cash benchmark / opportunity-cost hurdle

Durable rule: `docs/DECISIONS.md` D27. Module: `src/investment/decision/cashBenchmark.ts`.

Default reference: **2.5% annual**. Research scores/targets remain independent. Before new cash becomes a BUY/SUBSCRIBE action, execution compares the current REAL 120-session annualized proxy with the configured cash benchmark; ETF entry commission drag is subtracted in the final execution plan. If the benchmark is not beaten, or evidence is insufficient, the action becomes `REVIEW` with `Mantener en cuenta / no invertir todavía` wording.

The proxy is historical/diagnostic, never a forecast or guarantee.

## Latest execution/fund findings

Adaptive execution remains capital-dependent. At 100 EUR the policy correctly executes no ETF orders instead of paying destructive minimum fees. The latest REAL sweep has 73 causal rebalance windows.

Fund diagnosis remains conclusive for the current EODHD history: 8 funds accepted, 2 currently shortlisted, but all 8 first reached the mandatory 252-bar causal-history threshold on **2026-08-19**, after the last monthly research information date **2026-07-31**. Therefore zero historical fund operations is a history-window limitation, not an engine failure.

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
- Broker availability and the cash hurdle do not alter research scores; they alter actionability/execution.

## Capital-adaptive execution

- MICRO `<300`: 12 pp drift / 100 EUR min ETF order / 1.25% max order fee drag / 0.50% window fee budget.
- SMALL `300–999`: 8 pp / 80 EUR / 1.50% / 0.75%.
- MEDIUM `1,000–4,999`: 6 pp / 75 EUR / 1.50% / 0.75%.
- LARGE `5,000–24,999`: 4 pp / 100 EUR / 1.25% / 0.60%.
- INSTITUTIONAL `>=25,000`: 3 pp / 150 EUR / 1.00% / 0.50%.

## Known blockers / limitations

- Manual broker confirmations and cash-benchmark setting remain browser/device-local.
- Exact Inversis lookup remains pending for active shortlisted ETFs and several funds until user/public evidence is captured.
- Fund settlement/tax/transfer timing is not yet simulated.
- Fund transaction costs remain zero in the hurdle until broker-specific fund fees are verified.
- Historical 120-session annualized return is only an execution proxy, not expected-return forecasting.
- Historical universe retains current-catalog survivorship bias.
- Yahoo remains unofficial/non-contractual.

## Immediate next step

1. Run `npm run validate:aistudio` after commit `271bbee...` and inspect the recorded result from GitHub.
2. Open the primary app **with validation stopped** and verify that the header/controls render immediately, then REAL data fills in without freezing the page.
3. Confirm the green **¿Compensa invertir frente a dejar el dinero en MyInvestor?** panel is visible after data load and the heavy history chart appears only after pressing **Ver histórico y ranking completo**.
4. Once startup responsiveness is confirmed, extend historical replay/backtest reporting with an explicit remunerated-cash benchmark so strategy value-add versus doing nothing is visible historically as well.
