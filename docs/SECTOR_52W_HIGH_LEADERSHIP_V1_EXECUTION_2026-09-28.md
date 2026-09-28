# SECTOR_52W_HIGH_LEADERSHIP_V1 — implementation/preflight closure

Date: 2026-09-28

Status: **INCONCLUSIVE_DATA_RECONCILIATION / ECONOMIC NOT RUN / RESEARCH ONLY**

The frozen design and implementation were completed before candidate economic outcomes.

## Implementation completed

- protocol: `scripts/sector52WeekHighLeadershipV1Protocol.mjs`;
- economic runner: `scripts/sector52WeekHighLeadershipV1Live.mjs`;
- deterministic unit/causality guards;
- 52-week-high score, top-3 deterministic selection, six monthly votes/18;
- monthly NEXT_OPEN;
- equal-weight nine-sector control;
- same-universe 12-2 ablation frozen as `close[t-2]/close[t-12]-1`;
- fractional research accounting;
- entry/rebalance/exit transaction-cost stress;
- daily CAGR/vol/drawdown/Sharpe;
- 12m hit-rate reporting and paired circular-block bootstrap;
- diagnostic stop rule prevents replication calculation on gate failure.

Production remains `LEGACY`; no production files were intentionally changed.

## Test status

The exact committed protocol was evaluated in the available JavaScript isolate:

- **13 checks PASS**;
- marker: `SECTOR_52W_HIGH_LEADERSHIP_V1_PROTOCOL_RUNTIME_PASS`;
- prefix invariance, tie rule, 252-session score, six-vote weights, NEXT_OPEN, cost arithmetic and bootstrap were included.

A test-fixture bug was discovered before price outcomes: the prefix fixture originally truncated inside a calendar month and therefore created a synthetic month-end. The fixture was corrected to an actual signal month-end. The protocol itself was not changed.

**No shell/Codespace is exposed in this chat**, so Node CLI, npm and TypeScript commands were not executed here and are not reported as PASS.

## REAL source preflight

Primary source remains the application's Yahoo chart provider. It is inaccessible from the current chat runtime.

The pre-outcome frozen secondary source was Wolfram FinancialData. A small 2024 interval passed:

- 11/11 symbols;
- identical nine-session calendar;
- NYSE identity;
- adjusted-open reconstructed from raw open × adjusted close / raw close agreed with provider adjusted-open to floating-point precision.

Before any candidate return calculation, a fixed reconciliation hurdle was frozen:

> Wolfram 10-year annualized AdjustedClose total return must differ by no more than 0.20 pp/year from **both** State Street official NAV and Market Value 10-year returns for every one of the nine sector ETFs.

Using State Street's 31-Aug-2026 performance table, the result is:

| ETF | Wolfram CAGR | Official NAV | Official MKT | Max abs diff | Pass |
|---|---:|---:|---:|---:|---|
| XLB | 12.25% | 10.21% | 10.21% | 2.04 pp | FAIL |
| XLE | 15.00% | 10.79% | 10.79% | 4.21 pp | FAIL |
| XLF | 13.27% | 13.28% | 13.28% | 0.01 pp | PASS |
| XLI | 13.47% | 13.48% | 13.49% | 0.02 pp | PASS |
| XLK | 25.56% | 24.30% | 24.30% | 1.26 pp | FAIL |
| XLP | 7.32% | 7.39% | 7.40% | 0.08 pp | PASS |
| XLU | 12.08% | 8.92% | 8.92% | 3.16 pp | FAIL |
| XLV | 10.76% | 10.72% | 10.72% | 0.04 pp | PASS |
| XLY | 13.46% | 12.36% | 12.36% | 1.10 pp | FAIL |

Only XLF, XLI, XLP and XLV pass. Therefore the fallback is rejected.

The five failures are exactly `XLB, XLE, XLK, XLU, XLY`, the five funds State Street documents as receiving 2:1 share splits effective for trading on 05-Dec-2025. This coincidence is recorded as an unresolved adjustment incompatibility. V1 does **not** repair, rebase or replace the provider after seeing the reconciliation.

## Economic study state

- diagnostic 2013–2018: **NOT OPENED / NOT CALCULATED**;
- replication 2019–2025: **NOT OPENED / NOT CALCULATED**;
- hit-rate: not calculated;
- economic gate: not evaluated;
- status is **INCONCLUSIVE_DATA_RECONCILIATION**, not FAIL_DIAGNOSTIC.

The correct next step is to run the already-sealed implementation unchanged in a runtime where the primary Yahoo provider is operational. No signal parameter, date, benchmark, cost or fallback definition may be changed to obtain a result.

Quality/Profitability evidence remains preserved. Production remains `LEGACY`.


## Local ResearchValidationCenter integration

The earlier `INCONCLUSIVE_DATA_RECONCILIATION` refers specifically to the inability of the **chat runtime** to use the primary Yahoo provider and the rejection of Wolfram as an economic fallback. It is not a permanent application blocker.

The frozen candidate is now integrated into the application's local validation backend.

Job:

- id: `sector-52w-high-leadership-v1`;
- surface: `ResearchValidationCenter`;
- button: **Ejecutar diagnóstico 52W**;
- execution: `LOCAL_APP_BACKEND`;
- AI tokens: none;
- GitHub Actions: none.

Ordered execution:

1. protocol unit guard;
2. causal/prefix guard;
3. Yahoo input parser/identity guard;
4. research-validation runtime guard;
5. `CORE_ARCHITECTURE_V1` guard;
6. `npm run lint` / TypeScript;
7. Yahoo REAL download/cache/freeze;
8. economic runner.

The Yahoo step freezes the first successful dataset in:

`validation-runs/diagnostics/sector-52w-high-leadership-v1-input.json`

and caches raw provider responses under:

`.runtime/sector-52w-high-leadership-v1/yahoo`

Subsequent executions reuse the frozen input rather than refreshing the historical sample.

The economic runner computes both 10 and 20 bps/side results. The **continuation gate uses 20 bps/side only**. Replication 2019–2025 is computed only if the 2013–2018 diagnostic passes that gate. A pre-existing result is reused rather than recomputed.

The execution seal was regenerated after this integration and fingerprints the protocol, runner, Yahoo adapter, tests, backend route and validation UI.

### Current state

- implementation: **READY_LOCAL_APP_EXECUTION**;
- local job economic result: **NOT_RUN**;
- diagnostic outcome: **UNOPENED in this repository state**;
- replication outcome: **UNOPENED**;
- production: **LEGACY**.

Machine-readable integration evidence:

`validation-runs/preregistration/sector-52w-high-leadership-v1-local-job.json`.


## First local run — technical invalidation

The first local run completed on 2026-09-28, but its reported `FAIL_DIAGNOSTIC` is **not an economic verdict**.

Observed pattern:

- 52W candidate metrics: null;
- 12-2 control metrics: null;
- candidate cost/turnover/HAC: null;
- SPY, URTH and equal-weight-nine metrics: finite;
- replication: not opened.

Root cause:

At a monthly rotation the runner requested opening prices only for the **new target set**. Any currently-held sector removed from the new target set therefore had no opening price when `rebalanceAtOpen` tried to value/sell it. JavaScript propagated `NaN`; JSON serialization converted those values to `null`. The equal-weight-nine control did not trigger the defect because it always retained all nine sectors.

Repair:

- opening-price request is now `union(current holdings, new targets)`;
- missing/non-finite opening prices hard-fail;
- non-finite costs/equity/metrics hard-fail before economic gates;
- an existing technically-invalid result is archived to `*-invalid-technical-v1.json` and recomputed from the **same frozen Yahoo input**;
- no signal, threshold, date, weight, cost assumption or gate was changed.

Methodological status:

- first run = `TECHNICAL_INVALID_NO_ECONOMIC_VERDICT`;
- diagnostic data are now opened/consumed for diagnostic purposes;
- replication remains unopened;
- production remains `LEGACY`.

Evidence:

`validation-runs/diagnostics/sector-52w-high-leadership-v1-first-run-technical-invalid-2026-09-28.json`.


## Technical R3 closure after two invalid exports

Both local exports generated on 2026-09-28 at 19:25 and 19:33 are **technically invalid** and must not be interpreted as `FAIL_DIAGNOSTIC`.

Common evidence:

- same frozen Yahoo input hash: `35d30e16609099e0d852e744753fd74edd0989126931174608113f6b242b825f`;
- candidate economics = null;
- 12-2 control economics = null;
- SPY / URTH / equal9 finite;
- no implementation revision fingerprint;
- replication unopened.

Canonical status: **BOTH_RUNS_TECHNICAL_INVALID_NO_ECONOMIC_VERDICT**.

Current technical revision:

`SECTOR_52W_HIGH_LEADERSHIP_V1_VALIDATED_R3_2026_09_28`.

The local job now refuses a missing/wrong revision and runs a full synthetic E2E **before Yahoo**. The E2E covers both a rotation-heavy portfolio and a deliberately strong scenario that must pass diagnostic, open replication and execute bootstrap/frequency classification. Real-data execution is additionally blocked unless the Yahoo raw corporate-action audit and the 9/9 State Street NAV reconciliation pass.

No signal, date, top-3, six-vote rule, transaction cost or economic gate was retuned after outcomes.

Production remains `LEGACY`.


## Valid economic diagnostic — final V1 decision

The R3 local run produced the first technically valid economic result.

Status: **FAIL_DIAGNOSTIC**.

At the frozen 20 bps/side hurdle:

| Metric | 52W V1 | Comparator |
|---|---:|---:|
| CAGR | 10.1157% | SPY 11.3116% |
| CAGR | 10.1157% | URTH 7.1922% |
| CAGR | 10.1157% | equal-weight 9-sector basket 10.2581% |
| CAGR | 10.1157% | 12-2 sector control 9.4761% |
| Max drawdown | -20.5044% | URTH -18.8925% |
| Sharpe | 0.8181 | URTH 0.5329 |
| Joint 12m hit rate vs SPY+URTH | 33.33% | target reported separately |

Frozen gates: FAIL vs SPY, PASS vs URTH, FAIL vs equal9, FAIL drawdown, PASS Sharpe. Therefore the joint diagnostic gate fails.

Replication 2019–2025 remains **UNOPENED** by construction.

The 52-week-high selector modestly outperformed the same-universe 12-2 control in this diagnostic, but did not outperform the equal-weight sector basket and its incremental selector HAC12 alpha is negative with t-stat approximately -0.61. This does not justify parameter rescue.

Decision: **close V1; no retrospective change to top-count, six-month voting, lookback, costs or dates; no parametric V2 on this consumed diagnostic.**
