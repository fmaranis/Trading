# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-28

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-28 21:33 UTC**, green: global recorded run `exitCode: 0`, `ok: true`; lint/build PASS and recorded deterministic suites green. `researchReady: true`; `readyForManualPilot: false` remains intentionally separate.

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

Module: `src/investment/decision/brokerAvailability.ts`. Durable rule: `docs/DECISIONS.md` D25.

Availability is separate from REAL market-data validity. Public evidence and user confirmations are preserved as different evidence sources.

Effective states:

- `CONFIRMED_MYINVESTOR`: either current first-party MyInvestor evidence or a persisted user confirmation;
- `REQUIRES_INVERSIS_LOOKUP`: current availability still needs checking;
- `USER_CONFIRMED_UNAVAILABLE`: user checked and did not find the instrument at that time;
- `UNVERIFIED`: reserved fallback state.

Evidence identifies whether confirmation came from `MYINVESTOR_OFFICIAL_CURRENT`, `MYINVESTOR_OFFICIAL_HISTORICAL`, `USER_CONFIRMED_MYINVESTOR`, or none.

### Manual confirmation workflow — implemented, pending fresh validation

`ManualMyInvestorAvailabilityService` persists confirmations in browser localStorage key `custodia_myinvestor_manual_availability_v1`, normalized by ISIN/ticker.

In **Operaciones pendientes**, target BUY/SUBSCRIBE/TRANSFER lines now show broker availability and allow:

- **Sí, está en MyInvestor** → persist `AVAILABLE` and render `Confirmado por ti en MyInvestor` on future recommendations;
- **No lo encuentro** → persist `UNAVAILABLE` without pretending this is an official broker delisting;
- **Borrar mi confirmación** → restore the underlying public/evidence state.

Manual evidence takes precedence in the effective UI state but never mutates or overwrites the separate public evidence registry. This means a user can report that an officially documented instrument is currently unavailable, while the app still retains the original public evidence for auditability.

New deterministic regression: `tests/brokerAvailability.unit.ts`; command `npm run test:broker-availability`; included in `validate:aistudio:raw`. It checks persistence, manual available/unavailable overrides, restoration after deletion, and separation between manual and official evidence.

First public-evidence pass on 2026-08-28:

- **IE0032126645 — Vanguard U.S. 500 Stock Index Fund:** `CONFIRMED_MYINVESTOR` from current public MyInvestor evidence.
- **IE00B03HD191 — Vanguard Global Stock Index Fund:** `CONFIRMED_MYINVESTOR` from current public MyInvestor evidence.
- **IE0031786696 — Vanguard Emerging Markets Stock Index Fund:** `CONFIRMED_MYINVESTOR` from current public MyInvestor evidence.
- **IE00B5456744 — Vanguard ESG Developed World:** `REQUIRES_INVERSIS_LOOKUP`; historical evidence does not prove current standalone availability.
- **Active shortlisted ETFs:** remain `REQUIRES_INVERSIS_LOOKUP` until confirmed manually or by first-party evidence.

Important: absence from public MyInvestor pages is not encoded as broker unavailability because additional instruments may be available through Inversis. Manual `UNAVAILABLE` means only that the user did not find the instrument in their broker search at the recorded time.

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
- Broker availability evidence does not alter research scores.

## Capital-adaptive execution

`adaptiveExecutionPolicy.ts` changes execution gates, never research targets:

- MICRO `<300`: 12 pp drift / 100 EUR min ETF order / 1.25% max order fee drag / 0.50% window fee budget.
- SMALL `300–999`: 8 pp / 80 EUR / 1.50% / 0.75%.
- MEDIUM `1,000–4,999`: 6 pp / 75 EUR / 1.50% / 0.75%.
- LARGE `5,000–24,999`: 4 pp / 100 EUR / 1.25% / 0.60%.
- INSTITUTIONAL `>=25,000`: 3 pp / 150 EUR / 1.00% / 0.50%.

## Known blockers / limitations

- Manual broker confirmations are currently local to the browser/device; no authenticated cloud sync exists yet.
- Exact Inversis lookup remains pending for active shortlisted ETFs and several funds until user/public evidence is captured.
- Fund settlement/tax/transfer timing is not yet simulated.
- Historical universe retains current-catalog survivorship bias.
- Yahoo remains unofficial/non-contractual.

## Immediate next step

1. Run `npm run validate:aistudio` and verify the new broker-availability persistence regression plus TypeScript/build.
2. Use the new controls during real recommendations to confirm exact MyInvestor availability by ISIN/ticker.
3. Once enough confirmations exist, optionally add authenticated/cloud persistence so confirmations follow the user across devices instead of remaining browser-local.
4. Continue fund settlement/transfer modeling only after broker-specific operational rules are verified.
