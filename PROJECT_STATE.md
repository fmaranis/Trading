# Trading — Canonical Project State

> Operational memory. Repository `fmaranis/Trading/main` is canonical. **Do not add or depend on GitHub Actions.** ChatGPT develops/fixes directly in GitHub. AI Studio is test-only: sync current `main` and run deterministic local validation; it must not edit source.

## Current status — 2026-08-29

React + TypeScript + Vite research/decision-support app. It ranks REAL instruments, explains decisions, reconstructs causal historical recommendations and proposes manual execution plans; it does not submit broker trades.

Last fully recorded validation before the newest loss-window changes: **2026-08-29 15:59:41 UTC**, green (`exitCode: 0`, `ok: true`, all 3 expected markers detected). That run validated the integrated production + external holdout flow. The current HEAD contains additional fund-diagnostic and historical-loss-window stress logic added afterward, so it needs one fresh `npm run validate:aistudio` before being called fully validated.

## Product architecture rule

**One user question = one visible surface.** Internal calculation engines may remain modular for correctness/testability, but a new engine or diagnostic must be integrated into an existing user-facing flow/result whenever it answers the same question. Do not create another top-level panel, command or JSON just because another calculation exists.

Current visible flow:

1. REAL market refresh;
2. **Qué haría hoy** — single actionable recommendation;
3. optional **Por qué** — consensus/evidence explanation;
4. **Tu cartera**;
5. **Cómo habría funcionado esta decisión en el pasado** — one integrated historical surface;
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

Production allocators remain:
- LOW = Inverse Volatility
- MEDIUM = Risk Parity ERC
- HIGH = Relative Momentum

Mean Reversion remains an explainable signal/veto, not a promoted allocator.

## Integrated historical analysis

User-facing component: `src/components/HistoricalDecisionReplayPanel.tsx`.

One button/surface runs:
- dynamic chronological replay with BUY/ADD/HOLD/AVOID/REDUCE/EXIT;
- comparison with initial recommendation + hold;
- comparison with remunerated cash;
- robustness across historical start dates.

Internal engines remain separate only for calculation quality:
- `historicalDecisionReplay.ts`
- `dynamicHistoricalReplay.ts`

## Integrated REAL live validation

Primary script: `scripts/brokerAwareExecutionSweepLive.ts`.

It emits the existing `BROKER_AWARE_EXECUTION_SWEEP_RESULT`; no separate holdout/live-loss artifact exists.

The integrated result covers:
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

## External holdout robustness

`EUR_VALIDATION_HOLDOUT_UNIVERSE` is separate from `EUR_ASSET_UNIVERSE`; deterministic tests assert no ticker/asset-id overlap. It cannot influence production recommendations.

### Last validated holdout findings — 15:59 UTC run

- requested: 19 external instruments;
- accepted: 16;
- rejected: 3;
- effective accepted set was ETFs/ETCs only because the 3 external mutual funds failed to load in that run;
- seeded random sample used 8 external tickers;
- random sample replay: 3 scenarios, beat static in 2/3 and cash in 3/3; 23 buys, 10 adds, 0 reductions, 0 exits;
- adverse-path replay: 3 scenarios, beat static in 2/3 and cash in 3/3; 19 buys, 5 adds, 1 reduction, 3 exits;
- observed exits such as `XUEN.DE` and `QDVF.DE` passed the intended defensive gates (structural downtrend, consensus -5, 5 adverse votes), not simple overweight logic;
- holdout contained severe historical drawdowns (e.g. `G1CE.DE` ~74.9%, `QDVF.DE` ~58.8%, `XUEN.DE` ~58.7%, `EXI5.DE` ~48.1%).

Important limitation discovered: there were **0 currently negative trailing-1y assets** in that accepted holdout. Therefore the existing `losingCases` were only the lowest positive trailing-1y returns, not true current losers.

## New historical negative-window stress — pending fresh validation

The same integrated live script now searches each accepted holdout series for its worst REAL:
- 6-month (~126-session) loss window;
- 12-month (~252-session) loss window.

A candidate episode is only eligible when at least **252 prior observations already exist at the episode start**. The dynamic engine therefore starts at the beginning of the losing window without seeing the later loss.

The result records:
- worst 6M and 12M negative episodes;
- episode start/end and realized loss;
- drawdown inside the episode;
- signals for the focus asset during that loss window;
- whether the engine bought/added, avoided, reduced or exited;
- dates/gates of executed operations;
- portfolio result from that episode start versus static and cash.

These episodes are selected ex-post **only as behavioral stress tests**. They are not unbiased OOS evidence and must never be used to tune thresholds and then claimed as independent validation.

## Fund-data diagnostics — pending fresh validation

The 15:59 run exposed a diagnostic bug: provider failures were collapsed to generic `Error`, so all production mutual funds and the 3 external mutual funds appeared rejected without an actionable reason.

`assetUniverseScanner.ts` now preserves the real error message first (for example `EODHD_API_KEY_NOT_CONFIGURED`, `FUND_NOT_FOUND`, `TIMEOUT`, etc.) rather than generic `Error`.

The integrated live result also records `/api/eodhd/status` as `fundProviderStatus` plus per-instrument rejected reasons. The next run must determine whether the failure is configuration/quota/provider-symbol/history rather than guessing.

## Research discipline

- random holdout = relevant out-of-production-catalog generalization check;
- current adverse cohorts and historical loss windows = ex-post behavioral stress only;
- no threshold/allocator/execution-rule tuning from stress cohorts without defining a new untouched validation split;
- current-catalog survivorship bias remains;
- dynamic replay drawdown is still measured on decision/execution path points and can understate intraperiod drawdown;
- Yahoo remains unofficial/non-contractual;
- primary functionality must not require a new paid external subscription.

## Immediate next step

1. Sync current `fmaranis/Trading/main` into AI Studio.
2. Run **one** local `npm run validate:aistudio`; AI Studio must not modify code.
3. Inspect existing `validation-results/latest-aistudio-run.json` and `latest-broker-aware-execution-sweep.json` directly from GitHub.
4. Verify:
   - green validation;
   - `fundProviderStatus` and exact mutual-fund rejection reasons;
   - accepted external mutual funds if provider/config permits;
   - `historicalNegativeWindowStress` has evaluated real negative 6M/12M episodes;
   - behavior during those loss windows respects causal buy/sell gates.
5. Fix failures directly in GitHub and rerun the same single validation.
6. Only after this is satisfactory proceed to the comparative causal strategy lab (Inverse Volatility vs Risk Parity ERC vs Relative Momentum vs Mean Reversion vs Ensemble), integrated into the same evidence/historical flow rather than another top-level module.
