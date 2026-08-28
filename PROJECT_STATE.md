# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-28

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-28 21:33 UTC**, green: global recorded run `exitCode: 0`, `ok: true`; lint/build PASS and recorded deterministic suites green. `researchReady: true`; `readyForManualPilot: false` remains intentionally separate.

## Latest execution/fund findings

Adaptive execution remains capital-dependent. At 100 EUR the policy correctly executes no ETF orders instead of paying destructive minimum fees. The latest REAL sweep has 73 causal rebalance windows.

Fund diagnosis is now conclusive for the current EODHD history: 8 funds accepted, 2 currently shortlisted, but all 8 first reached the mandatory 252-bar causal-history threshold on **2026-08-19**, after the last monthly research information date **2026-07-31**. Therefore `fundOperations = 0` in the live historical sweep is a history-window limitation, not an engine failure. The independent mixed replay regression proves subscriptions/releases work when a causal fund selection actually exists.

## Primary user flow

1. current market decision;
2. Mi cartera real;
3. Operaciones pendientes;
4. alerts/changes;
5. collapsed technical/history detail.

The old simple decision backtest and duplicate ETF execution card are no longer shown in the primary flow. `/portfolio.html` is explicitly Laboratorio cuantitativo; `/legacy.html` is historical/experimental.

## Broker / MyInvestor availability evidence — NEW

New module: `src/investment/decision/brokerAvailability.ts`. Durable rule: `docs/DECISIONS.md` D25.

Availability is now an evidence state separate from REAL market-data validity:

- `CONFIRMED_MYINVESTOR`: current first-party MyInvestor evidence captured;
- `REQUIRES_INVERSIS_LOOKUP`: not disproven, but exact current availability still needs the MyInvestor/Inversis value finder;
- `UNVERIFIED`: reserved for cases with no usable broker evidence/state.

First public-evidence pass on 2026-08-28:

- **IE0032126645 — Vanguard U.S. 500 Stock Index Fund:** `CONFIRMED_MYINVESTOR`. Current MyInvestor content names the fund/ISIN.
- **IE00B03HD191 — Vanguard Global Stock Index Fund:** `CONFIRMED_MYINVESTOR`. Current MyInvestor content names it among funds used by MyInvestor investors.
- **IE0031786696 — Vanguard Emerging Markets Stock Index Fund:** `CONFIRMED_MYINVESTOR`. Current MyInvestor content names it among index-fund options used by MyInvestor investors.
- **IE00B5456744 — Vanguard ESG Developed World:** `REQUIRES_INVERSIS_LOOKUP`. MyInvestor has first-party historical evidence but documents replacement/removal from an indexed portfolio in 2021; this does not prove current standalone availability.
- **Active shortlisted ETFs (XEON.DE, ISPA.DE, EUN6.DE, ZPRV.DE, EXSA.DE, XDWH.DE):** `REQUIRES_INVERSIS_LOOKUP`. Their exchange listings/REAL data are valid evidence of the instruments, but no captured first-party MyInvestor result yet proves exact broker availability.

Important MyInvestor rule confirmed from its current official broker/help pages: instruments absent from MyInvestor web/app may still be available through the Inversis-MyInvestor platform. Therefore a failed public-web search must never be encoded as `UNAVAILABLE`. Exact lookup by ISIN/ticker in Inversis is the correct final gate.

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

- Exact Inversis lookup remains pending for active shortlisted ETFs and several funds.
- Fund settlement/tax/transfer timing is not yet simulated.
- Historical universe retains current-catalog survivorship bias.
- Yahoo remains unofficial/non-contractual.
- Public MyInvestor pages cannot be treated as an exhaustive instrument catalogue.

## Immediate next step

1. Propagate `brokerAvailability.ts` into the actionable recommendation/execution-plan UI so every proposed instrument explicitly says broker-confirmed vs Inversis lookup required.
2. Add deterministic tests preventing an unconfirmed instrument from being labeled broker-confirmed/executable.
3. When exact Inversis lookup evidence is available, update the registry by ISIN/ticker rather than inferring availability from third-party listings.
4. Re-run `npm run validate:aistudio` after the UI/test integration.
