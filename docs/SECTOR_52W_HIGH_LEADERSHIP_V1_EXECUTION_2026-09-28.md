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
