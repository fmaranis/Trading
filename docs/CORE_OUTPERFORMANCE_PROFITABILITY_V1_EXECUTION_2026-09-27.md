# Core outperformance — Operating Profitability V1

Date: 2026-09-27

Status: **PASS_CONFIRMATION_SIGNAL_ONLY / ACTIONABLE PIT TRANSLATION NEXT / NO PRODUCTION AUTHORITY**

Preregistration: `docs/CORE_OUTPERFORMANCE_FACTOR_QUEUE_V1_2026-09-27.md`.

## Frozen candidate

`OPERATING_PROFITABILITY_DECILE_10_VW`:

- Kenneth French operating-profitability sort;
- highest decile (`Hi 10`);
- value-weighted;
- long-only;
- no leverage or short leg;
- no post-outcome change to decile, weighting or window.

## Diagnostic — 2016-01 -> 2021-12

| Series | Total return | CAGR |
| --- | ---: | ---: |
| Operating Profitability Hi 10 | +210.74% | **20.80%** |
| US parent | +163.38% | **17.52%** |
| URTH proxy | +122.06% | **14.22%** |

Excess CAGR:

- vs US parent: **+3.28 pp/year**;
- vs URTH: **+6.58 pp/year**.

Monthly-path diagnostics:

- candidate annualized vol: 15.82%;
- US parent annualized vol: 15.30%;
- candidate max monthly-path drawdown: -19.47%;
- US parent max monthly-path drawdown: -20.21%;
- candidate return/vol ratio: 1.315;
- US parent return/vol ratio: 1.145.

Diagnostic gate: **PASS**.

## Independent temporal confirmation — 2009-01 -> 2014-12

The confirmation window and sources were frozen in Git before opening these Candidate A rows.

| Series | Total return | CAGR |
| --- | ---: | ---: |
| Operating Profitability Hi 10 | +173.22% | **18.24%** |
| US parent | +166.09% | **17.72%** |
| Developed global market | +117.42% | **13.82%** |

Excess CAGR:

- vs US parent: **+0.52 pp/year**;
- vs developed global market: **+4.42 pp/year**.

Monthly-path diagnostics:

- candidate annualized vol: 14.12%;
- US parent annualized vol: 15.16%;
- developed global annualized vol: 16.35%;
- candidate max monthly-path drawdown: -13.19%;
- US parent max monthly-path drawdown: -17.70%;
- developed global max monthly-path drawdown: -20.41%.

Confirmation gate: **PASS**.

## Interpretation

This is the first candidate in the new queue to clear the external return hurdle in the diagnostic and then repeat it in the preregistered temporal confirmation.

It is **not yet an investable Custodia proof**:

- academic portfolio returns are gross and do not reproduce Spanish taxes/fees;
- monthly drawdown is not the daily drawdown required by the project promotion gate;
- the French construction is a broad US stock portfolio, not the exact Custodia opportunity universe;
- two successful historical windows do not remove selection/multiple-testing or implementation risk.

Therefore Candidates B/C remain unopened and are not needed to rescue Candidate A. The next step is a single frozen stock-level PIT translation of operating profitability, followed by a research-only Custodia comparison. Production remains `LEGACY`.

## Reproducibility

- runner: `scripts/coreOutperformanceProfitabilityV1.mjs`;
- cached input: `validation-runs/diagnostics/core-outperformance-profitability-v1-input.json`;
- result: `validation-runs/diagnostics/core-outperformance-profitability-v1-result.json`.
