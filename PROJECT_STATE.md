# Trading — Canonical Project State

> Operational memory. Repository `fmaranis/Trading/main` is canonical. **Do not add or depend on GitHub Actions.** ChatGPT develops/fixes directly in GitHub. AI Studio is test-only: sync current `main` and run deterministic local validation; it must not edit source.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks REAL instruments, explains decisions, reconstructs causal historical recommendations and proposes manual execution plans; it does not submit broker trades.

Latest fully recorded validation: **2026-08-29 17:51:02 UTC**, green (`exitCode: 0`, `ok: true`, all 3 expected markers detected). That run validated the integrated production + random holdout + adverse paths + historical negative-window stress. The current HEAD contains a subsequent UI visualization change and a read-only validation-result endpoint, so one fresh `npm run validate:aistudio` is required before the newest HEAD is called fully validated.

## Product architecture rule

**One user question = one visible surface.** Internal engines may remain modular for correctness/testability, but a new engine, test or diagnostic must be integrated into an existing user-facing flow/result whenever it answers the same question. Do not create another top-level panel, command or JSON merely because another calculation exists.

Current visible flow:

1. REAL market refresh;
2. **Qué haría hoy** — single actionable recommendation;
3. optional **Por qué** — consensus/evidence explanation;
4. **Tu cartera**;
5. **Cómo habría funcionado esta decisión en el pasado** — one integrated historical/robustness surface;
6. optional **Seguimiento y memoria** — alerts/snapshots/audit.

## Core decision protections

- allocation drift/overweight alone is **not** a sell signal;
- new money requires adequate strategy consensus;
- existing positions require stronger evidence to reduce;
- `REDUCE_REVIEW` requires structural deterioration plus several adverse votes;
- historical trades execute after the information date;
- ETFs use whole shares and modeled MyInvestor commission;
- funds use fractional units;
- residual cash earns the configured benchmark (default 2.5%).

Production allocators remain LOW=Inverse Volatility, MEDIUM=Risk Parity ERC, HIGH=Relative Momentum. Mean Reversion remains an explainable signal/veto, not a promoted allocator.

## Integrated historical analysis and visible charts

User-facing component: `src/components/HistoricalDecisionReplayPanel.tsx`.

One button/surface runs:
- dynamic chronological replay with BUY/ADD/HOLD/AVOID/REDUCE/EXIT;
- comparison with initial recommendation + hold;
- comparison with remunerated cash;
- robustness across historical start dates.

The same surface now also visualizes results instead of leaving them only in cards/JSON:
- equity-path line chart for the selected historical replay;
- inside the existing collapsed robustness section, a grouped bar chart for the seeded external random sample (`seguir avisos` vs `comprar y mantener` vs `cash`);
- a horizontal bar chart for the worst REAL 6M/12M loss episodes, showing realized window loss and max drawdown;
- per-episode behavioral summaries showing whether the engine avoided, bought/added, reduced or exited during the losing window.

The external charts read the latest existing `validation-results/latest-broker-aware-execution-sweep.json` through read-only endpoint `/api/validation/latest-broker-aware`. This does not create another validation artifact and does not rerun Yahoo/EODHD from the browser.

Internal engines remain separate only for calculation quality:
- `historicalDecisionReplay.ts`
- `dynamicHistoricalReplay.ts`

## Integrated REAL live validation

Primary script: `scripts/brokerAwareExecutionSweepLive.ts`.

It emits the existing `BROKER_AWARE_EXECUTION_SWEEP_RESULT`; no separate holdout/live-loss artifact exists. The integrated result covers:
- REAL provider provenance/fingerprints;
- production research reference;
- adaptive ETF execution sweep;
- mixed ETF/fund execution sweep;
- fund eligibility diagnostics;
- production dynamic historical replay;
- external random holdout;
- adverse-path stress;
- historical negative-window stress.

Synthetic fallback is forbidden for accepted REAL validation series.

## External holdout robustness — validated 17:51 UTC

`EUR_VALIDATION_HOLDOUT_UNIVERSE` is separate from `EUR_ASSET_UNIVERSE`; deterministic tests assert no ticker/asset-id overlap. It cannot influence production recommendations.

Latest effective holdout:
- requested: 19 external instruments;
- accepted: 16 ETFs/ETCs;
- rejected: 3 external mutual funds;
- seeded random sample: 8 external tickers;
- random sample replay previously showed generalization outside the production catalogue;
- adverse-path replay produced genuine REDUCE/EXIT behavior only when structural sell gates were satisfied.

## Historical negative-window stress — validated 17:51 UTC

The integrated live script searches each accepted holdout series for its worst REAL:
- 6-month (~126-session) negative window;
- 12-month (~252-session) negative window.

A candidate episode is eligible only when at least **252 prior observations already exist at the episode start**, so the engine starts without seeing the subsequent loss.

Latest run evaluated 4/4 selected episodes. Examples found:
- `EXI5.DE`: 12M return -45.36%, max DD 48.06%; engine initially bought/added while evidence was favorable, later issued `REDUCE` on 2022-07-01 with structural downtrend and consensus -4 / 4 adverse votes;
- `EXI5.DE`: worst 6M window -41.73%; engine emitted `AVOID` in all 6 observed reviews and never bought/added during the loss window;
- `G1CE.DE`: worst 12M window -35.36%; engine emitted `AVOID` during the observed loss-window reviews and did not buy/add.

These episodes are ex-post **behavioral stress tests**, not unbiased OOS evidence. They must never be used to tune thresholds and then claimed as independent validation.

## Fund-data diagnostics — resolved cause in 17:51 run

The diagnostic bug that collapsed provider failures to generic `Error` is fixed. `assetUniverseScanner.ts` preserves the actual provider message.

The latest run showed:
- EODHD endpoint configured successfully (`configured: true`);
- production mutual funds rejected with `QUOTA_EXHAUSTED`;
- the 3 external mutual funds also rejected with `QUOTA_EXHAUSTED`.

Therefore the current inability to include mutual-fund NAV series in the live validation is a provider quota limitation, not a calculation-engine or ISIN failure. Primary ETF/Yahoo functionality remains available and non-blocking.

## Research discipline

- random holdout = relevant out-of-production-catalog generalization check;
- adverse cohorts and historical loss windows = ex-post behavioral stress only;
- no threshold/allocator/execution-rule tuning from stress cohorts without defining a new untouched validation split;
- current-catalog survivorship bias remains;
- dynamic replay drawdown is measured on decision/execution path points and can understate intraperiod drawdown;
- Yahoo remains unofficial/non-contractual;
- primary functionality must not require a new paid external subscription.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio.
2. Run **one** local `npm run validate:aistudio`; AI Studio must not modify code.
3. Confirm TypeScript/build/runtime remain green after adding Recharts visualization and `/api/validation/latest-broker-aware`.
4. Open the normal app, run **Analizar histórico**, expand **¿Depende demasiado de la fecha o de los activos elegidos?**, and verify the three integrated visual areas render: equity path, external random comparison, and negative-window stress chart/cards.
5. Fix any failure directly in GitHub and rerun the same single validation.
6. Only after this is green proceed to the comparative causal strategy lab (Inverse Volatility vs Risk Parity ERC vs Relative Momentum vs Mean Reversion vs Ensemble), integrated into the same evidence/historical flow rather than another top-level module.
