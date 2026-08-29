# Trading — Canonical Project State

> Operational memory. Repository `fmaranis/Trading/main` is canonical. **Never add or depend on GitHub Actions.** ChatGPT develops/fixes directly in GitHub. AI Studio is test-only: sync current `main`, restart the local server if needed, run deterministic local validation, and do not edit source or use Gemini/LLM diagnosis.

## Current status — 2026-08-29

React 19 + TypeScript + Vite + Tailwind + Recharts + Motion decision-support SPA using REAL market data. Current HEAD contains the expanded production discovery, cash-first candidate gate, independent position health, interactive portfolio/research navigation, weekly research signals, current high-conviction entry alerts and Spanish tax-aware rotation logic.

**Current HEAD is not validated until a fresh `npm run validate:aistudio` finishes green after these changes.** Do not reuse an older green result.

## Non-negotiable product architecture

Exactly two primary workspaces:

### 1. Mi cartera real

Purpose: actual positions, actual liquidity and actionable decisions.

Primary surfaces, in order:
1. **Alertas importantes de entrada ahora** — current opportunities only.
2. **Mi cartera real** — positions, valuation and independent health.
3. **Qué haría hoy** — operational execution plan.
4. Collapsed explanation of consensus.

The old historical/snapshot alert list is **not** a primary portfolio surface anymore. Historical BUY/ADD/SELL behavior is inspected directly on each asset chart and in secondary robustness tests.

### 2. Estudio y señales

Purpose: research without mutating the real portfolio.

Contains expanded radar, catalog browsing, arbitrary ticker/ISIN analysis, weekly/monthly/quarterly causal reviews, price/NAV chart with BUY/ADD/SELL markers and secondary historical robustness.

Research ideas do not become real operations until portfolio/cash/consensus/cost/tax/currency gates are satisfied.

## User real portfolio baseline — never relabel as demo/example

- Vanguard Global Stock Index Fund EUR Acc — ISIN `IE00B03HD191` — invested **12,600 EUR** — acquisition **2026-08-11** — units **196.59** — MyInvestor — transferable.
- Vanguard Emerging Markets Stock Index Fund EUR Acc — ISIN `IE0031786696` — invested **1,400 EUR** — acquisition **2026-08-12** — units **4.61** — MyInvestor — transferable.
- Pending capital: **13,000 EUR**, horizon 12 months.
- Cash alternative / hurdle: **2.5% annual** unless changed explicitly.

Canonical constants: `USER_REAL_FUND_POSITIONS`, `USER_REAL_STAGED_CAPITAL_PLAN`.

Persistence invariant: UI/code refactors must never silently erase or replace the real portfolio. Intentional later executions are respected.

## Production discovery and new-money decision pipeline

Production universe: `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` — materially broader EUR-quoted universe including funds, ETFs/ETCs and European equities.

`EUR_VALIDATION_HOLDOUT_UNIVERSE` remains completely outside production decisions. It may appear in research/validation only.

Canonical new-money chain:

**REAL discovery → cash hurdle → StrategyConsensus BUY → no structural downtrend → diversified eligible shortlist → allocator → execution costs / whole shares / broker → tax-aware execution where rotation is involved**

`PortfolioCandidateGate` requires every new-money candidate to beat the configured cash benchmark and obtain BUY-grade consensus before it can reach Risk Parity / Inverse Volatility / Relative Momentum.

If no candidate passes, 100% cash is a valid result. Never force an investment merely to produce an answer.

## Current opportunity alerts

Engine: `src/investment/decision/currentOpportunityAlerts.ts`.
UI: `src/components/CurrentOpportunityAlertsPanel.tsx`.

Every emitted current-entry alert already passed the canonical new-money gate.

Levels:

- **HIGH_CONVICTION / ENTRADA DE ALTA CONVICCIÓN**: favorableVotes >= 4/5, consensusScore >= +3, excess vs cash >= +5 pp, healthy long trend and SMA200, aligned 20/60/120-session momentum, annualized volatility <= 30%, current drawdown no worse than -20%.
- **GOOD_ENTRY / BUENA OPORTUNIDAD**: favorableVotes >= 3, consensusScore >= +2, excess vs cash >= +2 pp, positive 120-session momentum and volatility <= 35%.
- **VALID_ENTRY / ENTRADA VÁLIDA**: passes cash + consensus but does not meet the stronger alert thresholds.

A large score or momentum ratio alone can never create HIGH_CONVICTION.

“High conviction” means strong agreement among model signals, **not** a guaranteed return or probability of profit.

Autonomous scheduler:
- scans `EUR_PORTFOLIO_DISCOVERY_UNIVERSE`;
- excludes validation holdout;
- webhook kind `CURRENT_ENTRY_OPPORTUNITIES`;
- notifies only HIGH_CONVICTION or GOOD_ENTRY;
- no longer generates operational notifications from historical Top-3 transitions.

## MyInvestor availability policy

Operational default:

> **Assume an instrument is available in MyInvestor unless the user explicitly marks it unavailable.**

This is a user-directed operational assumption and must remain distinct from official/public broker evidence. It must never be presented as official MyInvestor confirmation.

A user-confirmed `UNAVAILABLE` value blocks application of the corresponding buy operation until reset.

## Existing-position health

Every current position is evaluated independently:
- AÑADIR
- MANTENER
- VIGILAR
- REDUCIR
- SALIR
- DATOS PENDIENTES

Cash underperformance alone => WATCH, never REDUCE/EXIT.
Allocation overweight alone => HOLD, never sell.
Structural deterioration can cause REDUCE/EXIT.

Arbitrary EUR tickers with valid REAL data can be monitored even if not pre-catalogued. Non-EUR positions still require an FX layer before entering EUR portfolio accounting.

## Spanish tax-aware rotation logic

Files:
- `src/investment/decision/spanishTaxModel.ts`
- `src/investment/decision/taxAwareExecutionOverlay.ts`
- tax UI inside `PortfolioExecutionPlanPanel.tsx`

Savings-base scale implemented:
- 0–6,000 EUR: 19%
- 6,000–50,000 EUR: 21%
- 50,000–200,000 EUR: 23%
- 200,000–300,000 EUR: 27%
- above 300,000 EUR: 30%

The user may configure positive savings taxable base already accumulated during the year. If not confirmed, the model reserves a conservative **30% of estimated positive realized gain** rather than inventing the user's marginal bracket.

### Rotation rule

For a partial REDUCE / rotation with positive realized gain:

**expected advantage over the selected horizon > estimated tax on realized gain + transaction fee**

If the improvement cannot demonstrably compensate the friction, the proposed sale becomes **REVIEW / NO OPERAR**.

A structural EXIT is a risk-control decision: estimated tax is shown, but tax does not trap the portfolio in a severely deteriorating position.

### Mutual funds

When a transferable fund has an eligible destination, fund-to-fund transfer is preferred where operationally appropriate. Immediate tax estimate is 0 under the tax-deferral assumption, subject to legal/operational eligibility.

For direct redemption, realized gain is estimated from registered invested cost and current value. The two real Vanguard baseline positions have acquisition amount/date/units registered.

### Listed shares / ETFs

Purchases executed through the app create a separate tax-lot ledger in `custodia_spanish_tax_lots_v1`.
Future sales use FIFO tracked lots to estimate acquisition cost.
Existing/manual holdings without sufficient lot history => `UNKNOWN_COST_BASIS`; a non-structural tax-sensitive rotation cannot be approved by inventing a cost basis.

Estimated income tax is **not subtracted from canonical broker cash** when an execution is applied. The portfolio records the broker cash movement; tax is modeled separately as decision friction/reserve.

Tax output is decision-support only. It does not automatically model every loss-compensation rule, carried losses, taxpayer-specific circumstances or the final tax return.

## Transaction invariant

`PortfolioStateExecutionService` applies BUY/SELL/SUBSCRIBE/REDEEM/TRANSFER to canonical portfolio state. Invalid or REVIEW lines cannot execute.

`Aplicar a mi cartera` must change holdings/funds/liquidity transactionally. No cosmetic “Marcar hecha”.

## Research signals

`SingleAssetResearchEngine` supports:
- WEEKLY — default
- MONTHLY
- QUARTERLY

All modes use daily REAL data, causal snapshots and next-observation execution. Future data cannot alter prior signals.

Charts:
- ▲ BUY
- ◆ ADD
- ▼ SELL / REDUCE

Positions, opportunities and current alerts can open the same individual research chart via ticker/ISIN.

## Validation gates

`npm run validate:aistudio` remains the only requested full local gate.

`validate:aistudio:raw` now includes, among all previous deterministic/live gates:
- `tests/portfolioCandidateGate.unit.ts`
- `tests/currentOpportunityAlerts.unit.ts`
- `tests/portfolioPositionHealth.unit.ts`
- `tests/portfolioDecisionEngine.unit.ts`
- `tests/portfolioExecutionPlan.unit.ts`
- `tests/portfolioHealthExecutionPlan.unit.ts`
- `tests/spanishTaxModel.unit.ts`
- `tests/taxAwareExecutionOverlay.unit.ts`
- `tests/strategyConsensus.unit.ts`
- `tests/singleAssetResearch.unit.ts`
- historical/dynamic replay tests
- broker/cost/availability tests
- `scripts/aiStudioValidateCurrent.ts`
- existing live broker feasibility and broker-aware execution sweeps.

The central validator now checks the expanded production universe and current opportunity alert counts and reports broker policy `ASSUME_AVAILABLE_UNLESS_USER_MARKS_UNAVAILABLE`.

Expected existing markers remain exactly:
1. `AI_STUDIO_VALIDATION_RESULT`
2. `BROKER_BACKTEST_FEASIBILITY_RESULT`
3. `BROKER_AWARE_EXECUTION_SWEEP_RESULT`

Do not add GitHub Actions or new standalone validation markers/files just for this feature.

## Known limitations / next expansion

- Production discovery is broader but still curated, not literally the entire world market. Broader IBEX/EuroStoxx/S&P/Nasdaq presets should use cached/batched discovery, not thousands of Yahoo calls on page load.
- Non-EUR portfolio recommendations still need a proper FX valuation/cost layer.
- EODHD fund availability depends on provider quota.
- Yahoo endpoint is unofficial/non-contractual.
- Historical catalogs carry survivorship bias.
- High-conviction thresholds require validation over time; they are not a profitability guarantee.
- Tax estimation does not replace Spanish tax filing or automatically know unrelated gains/losses.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio.
2. AI Studio must not modify source.
3. Restart the local server with current code.
4. Run exactly `npm run validate:aistudio` until it finishes completely.
5. Confirm `exitCode = 0`, `ok = true`, all three expected markers, and a recorded timestamp newer than this implementation.
6. Visual checks:
   - exactly two primary tabs remain;
   - `Alertas importantes de entrada ahora` appears above portfolio state;
   - HIGH_CONVICTION/GOOD_ENTRY cards open their graphs;
   - old historical alert/snapshot block is absent from `Mi cartera real`;
   - real Vanguard positions and units/dates remain intact;
   - `Qué haría hoy` shows tax context and tax/friction notes;
   - partial profitable rotations can become REVIEW when tax+fees are not justified;
   - structural EXIT remains possible while displaying tax estimate;
   - transferable fund transfer shows deferred-tax treatment;
   - MyInvestor is assumed available unless explicitly marked unavailable;
   - weekly chart mode remains default and functional.
7. Any failure is fixed directly in GitHub and the same local validation is rerun. Never use GitHub Actions.
