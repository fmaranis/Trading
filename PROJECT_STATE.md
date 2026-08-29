# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation remains **2026-08-28 23:10 UTC**, green (`exitCode: 0`, `ok: true`). Changes below were implemented after that run and require one fresh `npm run validate:aistudio` before they are considered validated.

## Primary user flow

1. app shell opens without automatic heavy market work;
2. user loads REAL market data explicitly;
3. current market decision;
4. visible cash-vs-investment guardrails and MyInvestor availability;
5. optional historical strategy-vs-remunerated-cash comparison;
6. optional portfolio/operations/alerts;
7. optional historical charts/provider validation.

## Cash benchmark / opportunity-cost hurdle

Durable rule: `docs/DECISIONS.md` D27. Default reference is **2.5% annual**, persisted with `CashBenchmarkService`. The current execution plan suppresses BUY/SUBSCRIBE/TRANSFER targets that do not beat the configured cash hurdle after modeled initial ETF cost.

The current 120-session annualized proxy remains historical decision evidence, not a forecast.

## Historical remunerated-cash comparison — implemented, pending validation

New helper: `src/investment/decision/remuneratedCash.ts`.

`MixedInstrumentCausalReplayEngine` now accepts `cashBenchmarkAnnualPct` and models two things over identical replay dates:

- **strategy cash:** only the residual/uninvested cash balance earns the configured annual rate;
- **all-cash benchmark:** the complete initial capital remains in remunerated cash for the entire replay period.

Interest accrues causally using actual **calendar-day gaps / 365**. Invested ETF/fund value does not earn cash interest. Output now includes:

- `cashBenchmarkAnnualPct`;
- `cashInterestEarnedEur`;
- `allCashFinalEur` / `allCashReturnPct`;
- `excessFinalEurVsCash`;
- `excessReturnVsCashPctPoints`;
- `beatsAllCashBenchmark`.

Regression rules added to `tests/mixedInstrumentCausalReplay.unit.ts`:

- no-trade replay must exactly equal the all-cash benchmark;
- 0% benchmark must preserve the legacy no-trade result;
- cash never becomes negative;
- residual cash interest is explicit.

`scripts/brokerAwareExecutionSweepLive.ts` now reports the same remunerated-cash fields for every mixed capital scenario (100, 334, 500, 1,000, 5,000, 25,000 EUR).

## Visible app integration — implemented, pending validation

`DecisionGuardrailsPanel` now receives the current capital, risk profile and horizon directly from the main screen. The green primary block includes **Estrategia histórica vs todo en efectivo remunerado**.

The historical comparison is deliberately **on demand** through `Calcular comparación`; it does not run at page startup. Results shown in the app:

- final strategy value and return;
- final all-cash value and return at the configured cash rate;
- difference in EUR;
- difference in percentage points;
- interest earned by residual cash inside the strategy;
- explicit conclusion `ESTRATEGIA > EFECTIVO` or `EFECTIVO > ESTRATEGIA`.

Changing the cash benchmark clears the historical result so the user cannot mistake a stale comparison for the new rate.

## Broker / MyInvestor availability evidence

Availability remains separate from REAL market-data validity. Current public evidence supports Vanguard Global Stock Index `IE00B03HD191`, Vanguard Emerging Markets Stock Index `IE0031786696`, and Vanguard U.S. 500 Stock Index `IE0032126645`. Other targets remain lookup-required unless confirmed manually or by first-party evidence.

Manual broker confirmations and the cash benchmark remain browser/device-local.

## Execution economics

- LOW → Inverse Volatility.
- MEDIUM → Risk Parity ERC.
- HIGH → Relative Momentum.
- MyInvestor ETF model: whole shares, 0.12%, min 1 EUR/order, max 25 EUR/order.
- At 100 EUR, the adaptive execution policy can correctly choose zero ETF orders instead of paying destructive minimum fees.
- Fund subscriptions/redemptions in replay remain modeled without explicit broker fund commission until those fees are verified.

## Fund-history limitation

Current EODHD history still yields 8 accepted funds and 2 current shortlist funds, but all first reached the required 252-bar causal history threshold on **2026-08-19**, after the last monthly research information date **2026-07-31**. Zero historical fund operations in the live sweep therefore remains a history-window limitation, not an engine failure.

## Known limitations

- Historical universe retains current-catalog survivorship bias.
- Fund settlement, tax and transfer timing are not simulated.
- Exact Inversis lookup remains pending for several active targets.
- Yahoo remains unofficial/non-contractual.
- The 2.5% cash reference is a user-configured benchmark, not a guarantee that the broker rate will remain unchanged.

## Immediate next step

1. Run `npm run validate:aistudio` once for the complete remunerated-cash block.
2. Read `validation-results/latest-aistudio-run.json` and `latest-aistudio.json` directly from GitHub after completion.
3. Confirm the mixed replay tests, TypeScript/build and live sweep are green and inspect the new `allCash*`, `cashInterestEarnedEur` and excess-return fields.
4. Open the app, load REAL data and press **Calcular comparación** to verify the result is visible and the UI remains responsive.
5. Only after that gate is green, continue with exact broker availability/ISIN cleanup or further execution refinements.
