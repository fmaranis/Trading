# Trading — Canonical Project State

> Operational memory. Repository `fmaranis/Trading/main` is canonical. **Do not add or depend on GitHub Actions.** ChatGPT develops/fixes directly in GitHub. AI Studio is test-only: sync current `main` and run deterministic local validation; it must not edit source.

## Current status — 2026-08-29

React + TypeScript + Vite decision-support app using REAL market data. It ranks instruments, explains decisions, reconstructs causal historical recommendations and proposes manual broker actions; it does not submit broker orders.

Latest recorded validation before the current interaction/UX and real-portfolio recovery changes: **2026-08-29 18:10:02 UTC**, green (`exitCode: 0`, `ok: true`, all 3 markers detected). Current HEAD contains subsequent transactional portfolio-state, UX and versioned real-portfolio migration changes and therefore requires a fresh `npm run validate:aistudio`.

## Non-negotiable architecture

**One user question = one visible surface.** Internal engines may remain modular, but calculation modules/tests must not become competing cards/pages/results when they answer the same user question.

**State → Action → Evidence** is the required visible flow:

1. **Mi cartera real** — one factual current state;
2. **Qué haría hoy** — the only operational surface;
3. optional **Por qué recomienda eso** — explanatory evidence only;
4. **¿Funciona también fuera de los casos cómodos?** — historical/generalization evidence;
5. optional **Seguimiento y memoria** — audit/alerts/snapshots.

Do not reintroduce long sequences of intermediate theoretical outputs as primary UI.

## User real portfolio baseline — do not relabel as example

These positions were explicitly provided by the user and are the real starting portfolio for the study. They are **not demo/example data**:

- Vanguard Global Stock Index Fund EUR Acc — ISIN `IE00B03HD191` — invested **12,600 EUR** — acquisition **2026-08-11** — units recorded **196.59** — MyInvestor — transferable;
- Vanguard Emerging Markets Stock Index Fund EUR Acc — ISIN `IE0031786696` — invested **1,400 EUR** — acquisition **2026-08-12** — units recorded **4.61** — MyInvestor — transferable;
- capital pending to invest: **13,000 EUR**, planning horizon 12 months.

Canonical constants are `USER_REAL_FUND_POSITIONS` and `USER_REAL_STAGED_CAPITAL_PLAN` in `fundPortfolio.ts`.

Critical persistence rule:

> **A UI/code refactor must never silently replace or erase the user-provided real portfolio.**

`UserPortfolioService` now uses `portfolioDataVersion = 2`. A one-time migration restores the two real funds and the 13,000 EUR pending capital when loading pre-v2/legacy state that was accidentally emptied by the previous model. Once migrated to v2, an intentional future sale, transfer or explicit empty state is respected and the baseline positions are not silently reinserted.

The UI action is named **Restaurar cartera real registrada**, never “Restaurar ejemplo”. The broad one-click “Vaciar todo” control was removed from the normal portfolio editor; individual positions can still be reconciled manually.

## Single portfolio source of truth and transaction invariant

Canonical client portfolio state is `UserPortfolioService` (`custodia_user_portfolio_v1`).

Critical invariant:

> **An operation cannot be considered executed unless it changes the canonical portfolio state consistently.**

The former `Marcar hecha` behavior was invalid because it only set an execution-plan line to `DONE`; it did not change holdings or liquidity. That design has been removed from the operational flow.

`src/investment/decision/portfolioStateExecution.ts` applies manual executions transactionally:

- `BUY_ETF`: consumes available liquidity including modeled fee and adds/increments shares;
- `SELL_ETF`: removes shares and credits net proceeds to cash;
- `SUBSCRIBE_FUND`: consumes liquidity and creates/increments the fund position;
- `REDEEM_FUND`: reduces the source fund and credits cash;
- `TRANSFER_FUND`: moves value from source to destination fund without fabricating cash;
- `REVIEW`: cannot be executed;
- insufficient liquidity, insufficient shares or invalid quantities reject the operation and leave state unchanged.

For backward compatibility the stored state still contains `cashEur` and `stagedCapitalPlan.availableEur`. The primary UI exposes their sum as **Liquidez disponible**, so there is one visible liquidity number. Purchases consume the staged/pending bucket first and then cash; sells/reimbursements credit cash.

`UserPortfolioService.save/restoreRealBaseline/clear` emit `custodia:user-portfolio-updated`. Components subscribe to this event instead of holding isolated stale copies.

`PortfolioExecutionPlanPanel` uses **Aplicar a mi cartera**. A successful operation:

1. applies the transaction;
2. persists the new portfolio;
3. emits the portfolio update;
4. refreshes the visible portfolio;
5. regenerates `Qué haría hoy` from the new state;
6. shows a receipt with liquidity before → after.

A failed operation is not marked executed.

## Portfolio UI

`UserPortfolioPanel` is a concise factual state view. Default visible values are only:

- **Invertido ahora**;
- **Liquidez disponible**;
- **Capital total controlado**;
- compact current-position list including invested amount and acquisition date for funds.

Manual editing is collapsed under **Editar cartera y liquidez**.

Theoretical exposure/gap calculations remain available only under **Ver diagnóstico teórico** and are explicitly non-operational. The final actionable recommendation remains exclusively in `Qué haría hoy`.

## Current decision protections

- allocation drift/overweight alone is **not** a sell signal;
- new money requires strategy consensus plus cash/cost/execution gates;
- existing positions require stronger evidence to reduce;
- historical `REDUCE/EXIT` requires structural deterioration plus multiple adverse votes and a lower causal allocator target;
- historical trades execute after the information date;
- ETFs use whole shares and modeled MyInvestor commission;
- funds use fractional units where historical simulation requires them;
- residual cash earns the configured benchmark (default 2.5%).

Production allocators remain LOW=Inverse Volatility, MEDIUM=Risk Parity ERC, HIGH=Relative Momentum. Mean Reversion remains a signal/veto, not a promoted allocator.

## Historical and external evidence

User-facing component: `src/components/HistoricalDecisionReplayPanel.tsx`.

External validation is fetched **on component mount**, not only after opening a robustness disclosure. Therefore the user immediately sees a compact section:

**Pruebas con activos que NO son los de siempre**

It shows:

- number of accepted external REAL instruments;
- seeded random-sample size and success counts;
- the worst visible REAL 6M/12M loss episodes;
- the engine response in those episodes (`NO COMPRAR`, `REDUCIR`, `SALIR`, etc.).

Full random-sample and negative-window charts are behind one disclosure, preserving the one-surface/no-data-dump rule.

A user-selected historical replay remains available with:

- follow-signals vs initial-buy-and-hold vs remunerated cash;
- equity-path chart;
- historical signal audit collapsed;
- start-date robustness collapsed.

The external evidence comes from the existing read-only endpoint `/api/validation/latest-broker-aware`, which reads the existing `validation-results/latest-broker-aware-execution-sweep.json`. It does not create another validation artifact or rerun market providers from the browser.

## External holdout and negative-window validation

`EUR_VALIDATION_HOLDOUT_UNIVERSE` is separate from production and cannot influence live recommendations. Deterministic tests assert no ticker/asset-id overlap.

Last validated external run:

- 19 requested external candidates;
- 16 accepted ETFs/ETCs;
- 3 external mutual funds rejected because EODHD returned `QUOTA_EXHAUSTED`;
- EODHD itself was configured correctly;
- seeded random sample used 8 external instruments;
- real adverse paths produced REDUCE/EXIT only when structural sell gates were met.

Historical negative-window examples from the recorded REAL run:

- `EXI5.DE` 12M: -45.36%, max DD 48.06%; initially BUY/ADD while evidence was positive, later REDUCE with structural downtrend and consensus -4 / 4 adverse votes;
- `EXI5.DE` worst 6M: -41.73%; AVOID in all six observed reviews, no buy/add;
- `G1CE.DE` worst 12M: -35.36%; AVOID during observed loss-window reviews.

Random holdout is the relevant out-of-production-catalog generalization check. Adverse cohorts and worst historical loss windows are **ex-post behavioral stress tests only**, never unbiased OOS evidence for parameter tuning.

## Validation gates

Existing `validate:aistudio:raw` includes the relevant deterministic portfolio tests.

`tests/portfolioExecutionPlan.unit.ts` verifies transactional state application:

- ETF buy adds shares and consumes liquidity + fee;
- insufficient liquidity rejects the buy;
- ETF sale removes shares and credits net cash;
- fund subscription creates a real fund position and consumes liquidity;
- fund transfer changes holdings without changing liquidity;
- REVIEW cannot be executed.

`tests/userPortfolio.unit.ts` now additionally verifies the real-portfolio persistence contract:

- baseline contains the two user-provided Vanguard positions with exact ISIN/amount/acquisition date;
- baseline contains 13,000 EUR pending capital;
- a pre-v2 accidentally empty state restores both real funds exactly once;
- migration does not duplicate a fund already present by ISIN;
- after migration to v2, an intentional empty state remains empty and is not silently repopulated.

No standalone portfolio-validation command/result/marker was created.

## Known limitations

- two internal liquidity buckets remain for backward compatibility although one combined number is exposed to users;
- mutual-fund live validation is currently limited by EODHD quota;
- current-catalog survivorship bias remains;
- dynamic replay drawdown is sampled at decision/execution points and can understate intraperiod drawdown;
- Yahoo is unofficial/non-contractual;
- broker availability still requires verified/manual evidence where automatic availability is unknown;
- primary functionality must not require a new paid data subscription.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio.
2. Run exactly one local `npm run validate:aistudio`; AI Studio must not modify source.
3. Inspect the existing result JSONs directly from GitHub.
4. Verify TypeScript plus the portfolio transaction and real-portfolio migration invariants are green.
5. Visual sanity check in the normal app:
   - `Mi cartera real` shows Vanguard Global 12,600 EUR and Vanguard Emerging 1,400 EUR before any new operation;
   - pending capital shows 13,000 EUR;
   - applying a proposed operation updates holdings/liquidity immediately;
   - `Qué haría hoy` recalculates after that change;
   - external/bad cases are visible without first running the normal historical replay;
   - theoretical diagnostics remain collapsed by default.
6. Fix any failure directly in GitHub and rerun the same validation. Do not proceed to the comparative strategy lab until this interaction flow is coherent and green.
