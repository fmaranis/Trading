# Trading — Canonical Project State

> Operational memory. Continue from this file. Repository `fmaranis/Trading/main` is canonical. Do not add or depend on GitHub Actions.

## Current status — 2026-08-28

React + TypeScript + Vite research/decision-support app. It ranks, backtests, alerts and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation before the newest UI/fund-diagnostic cleanup: **2026-08-28 19:16 UTC**, green with `technicalBlockers: []`, `researchReady: true`, `readyForManualPilot: false`, lint/build PASS and all recorded suites green.

### Recorded adaptive ETF execution sweep (19:16 UTC)

Research reference: about 483 trades / 73 rebalance windows / +12.53% research return.

- **100 EUR (MICRO):** 0 orders, 100 EUR cash, 0 fees.
- **334 EUR (SMALL):** 16 orders, +0.61%, 16 EUR fees.
- **500 EUR (SMALL):** 18 orders, +5.38%, 18 EUR fees.
- **1,000 EUR (MEDIUM):** 31 orders, +12.88%, 31 EUR fees.
- **5,000 EUR (LARGE):** 114 orders, +18.58%, 140.83 EUR fees.
- **25,000 EUR (INSTITUTIONAL):** 141 orders, +15.62%, 460.22 EUR fees.

Historical diagnostics only, not forecasts.

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
- MyInvestor ETF model: whole shares, 0.12%, min 1 EUR/order, max 25 EUR/order.
- Exact ticker/ISIN availability still requires MyInvestor/Inversis verification.

## Actionable workflow

Primary user flow is now intentionally:

1. current market decision;
2. **Mi cartera real**;
3. **Operaciones pendientes**;
4. alerts/changes;
5. collapsed technical/history detail.

`portfolioExecutionPlan.ts` + `PortfolioExecutionPlanPanel.tsx` produce `BUY_ETF`, `SELL_ETF`, `SUBSCRIBE_FUND`, `TRANSFER_FUND`, `REDEEM_FUND`, `REVIEW` with ticker/ISIN, orientative amount/shares, estimated ETF fee, rationale and completion status.

## Capital-adaptive execution

`adaptiveExecutionPolicy.ts` changes only execution gates, never research targets:

- MICRO `<300`: 12 pp drift / 100 EUR min ETF order / 1.25% max order fee drag / 0.50% window fee budget.
- SMALL `300–999`: 8 pp / 80 EUR / 1.50% / 0.75%.
- MEDIUM `1,000–4,999`: 6 pp / 75 EUR / 1.50% / 0.75%.
- LARGE `5,000–24,999`: 4 pp / 100 EUR / 1.25% / 0.60%.
- INSTITUTIONAL `>=25,000`: 3 pp / 150 EUR / 1.00% / 0.50%.

## Mixed ETF + fund replay

`mixedInstrumentCausalReplay.ts`:

- ETFs: whole-share broker execution;
- funds: EUR/NAV with fractional units;
- possible fund operations: `SUBSCRIBE`, `REDEEM`, `TRANSFER_REVIEW`;
- ETF targets are measured against total equity including fund value;
- no negative cash;
- no claim of transfer tax eligibility;
- settlement/tax/transfer timing remains unmodeled.

The 19:16 live mixed sweep produced **0 fund operations at all six capital levels**. This is not being treated as an engine failure or “fixed” by forcing funds into the portfolio.

## New fund-selection diagnosis — implemented, pending fresh validation

`scripts/brokerAwareExecutionSweepLive.ts` now records per mutual fund:

- scanner acceptance/rejection;
- bar count and current score;
- current-shortlist presence;
- first date on which 252 historical fund bars exist;
- last causal monthly information date;
- historical causal selection appearances;
- diagnosis:
  - `NO_MONTHLY_CAUSAL_WINDOW_AFTER_252_BAR_ELIGIBILITY`,
  - `ELIGIBLE_BUT_OUTRANKED_OR_CATEGORY_DEDUPED`,
  - `SELECTED_CAUSALLY`, or rejection reason.

This should determine whether the live zero-fund result is simply caused by insufficient historical NAV depth before the last monthly decision. Current evidence strongly points that way because accepted funds had only ~258 observations.

New deterministic regression:

- `tests/mixedInstrumentCausalReplay.unit.ts`
- command: `npm run test:mixed-instrument-replay`
- included in `validate:aistudio:raw`.

It creates a causal mixed dataset where a fund genuinely enters and later leaves the selected universe, and requires the engine to produce a fund subscription followed by release/review while keeping cash non-negative. This separates **engine capability** from **live selection evidence**.

## UI de-duplication — implemented, pending fresh validation

Durable policy: `docs/DECISIONS.md` D24.

Removed from the primary decision flow:

- old/simple `DecisionBacktestEngine` card shown beside the modern causal/execution evidence;
- duplicate static `Ejecución ETF/ETC · MyInvestor` summary, because `Operaciones pendientes` is now the authoritative actionable surface;
- duplicate always-visible provider status at page top.

Collapsed by default:

- provider/coverage technical detail;
- decision history.

Navigation cleanup:

- `/portfolio.html` is now labeled **Laboratorio cuantitativo**, not “Cartera”; it uses SPY/GLD/QQQ/TLT research data and simulated capital, so it must not be confused with the real portfolio.
- `/legacy.html` is explicitly **Legacy** / historical experimental UI.

No research engines were deleted merely because their presentation was removed. The goal is less duplication without losing validation capability.

## Validation recording

`npm run validate:aistudio` records:

- `validation-results/latest-aistudio-run.json` even on early failure;
- `latest-aistudio.json`;
- `latest-broker-backtest-feasibility.json`;
- `latest-broker-aware-execution-sweep.json`.

Do not ask the user to paste normal output. Read `main`, then branch `validation-results` as fallback.

## Known blockers / limitations

- Exact MyInvestor/Inversis availability of selected ticker/ISIN remains unverified.
- Fund settlement/tax/transfer timing is not yet simulated.
- Historical universe retains current-catalog survivorship bias.
- Yahoo remains unofficial/non-contractual.
- New UI cleanup + fund eligibility diagnostic + mixed lifecycle regression require a fresh recorded validation before being called green.

## Immediate next step

Run:

`npm run validate:aistudio`

Then retrieve the recorded results automatically and confirm:

1. lint/build remain green after UI simplification;
2. `test:mixed-instrument-replay` passes;
3. fund eligibility diagnostics explain the live zero-fund operations without forcing funds into the shortlist;
4. previous causal/broker/adaptive suites remain green.

If green, next priority is exact MyInvestor/Inversis instrument availability plus deciding whether further legacy/dead UI code should be removed physically or simply remain isolated from the product path.
