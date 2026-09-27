# Core outperformance momentum V1 — execution record

Date: 2026-09-27

Status: **FAIL_DIAGNOSTIC / STOPPED AT STAGE B / NO PRODUCTION CHANGE**

Plan: `docs/CORE_OUTPERFORMANCE_RESEARCH_PLAN_2026-09-27.md`

## Scope executed

The primary family was the frozen long-only momentum adaptation:

- monthly ranking by prior 12-2 return;
- winner decile only;
- value-weighted;
- gross external diagnostic first;
- no alternative lookback, decile, regime filter, stop, RSI, moving-average or ML variant after observing the result.

Diagnostic window was chosen before opening outcomes:

- 2016-01 -> 2021-12;
- 72 months;
- deliberately diagnostic/consumed because parts of this period had already appeared elsewhere in project research.

Reserved confirmation window:

- 2009-01 -> 2014-12;
- 72 months;
- 2015 left as a full separation year;
- **not opened**, because the diagnostic gate failed.

## Data

Momentum and US-market monthly returns come from Kenneth French methodology/data mirrored in a fixed public Git blob.

French methodology confirms that the 10 momentum portfolios are formed monthly using NYSE prior 2-12 return decile breakpoints and are value weighted.

Global-core proxy:

- URTH adjusted-close total-return proxy;
- 2016-01-04 -> 2021-12-31.

SPY adjusted return was computed only as a US cross-check.

Cached inputs:

- `validation-runs/diagnostics/core-outperformance-momentum-v1-input.json`.

Reproducible runner:

- `node scripts/coreOutperformanceMomentumDiagnosticV1.mjs validation-runs/diagnostics/core-outperformance-momentum-v1-input.json`.

## Result

| Series | Total return | CAGR |
| --- | ---: | ---: |
| Winner momentum decile 12-2, value-weighted | 152.33% | **16.68%** |
| French/CRSP US market | 163.38% | **17.52%** |
| URTH global proxy | 122.06% | **14.22%** |
| SPY cross-check | 163.85% | 17.55% |

Primary gate:

- excess CAGR vs US parent: **-0.84 pp/year**;
- excess CAGR vs URTH: **+2.46 pp/year**;
- required: both > 0;
- verdict: **FAIL_DIAGNOSTIC**.

The strategy beat the global proxy in this window but failed the stronger US-parent hurdle. Under the frozen plan this is sufficient to stop the primary replica.

## Mandatory stop

Therefore:

- do not open the 2009-2014 confirmation reserve;
- do not build the actionable Custodia replica;
- do not test alternative deciles/lookbacks or add filters to rescue the result;
- do not change production;
- `LEGACY` remains the production default.

## Sequencing caveat

The diagnostic and confirmation windows were explicitly declared in chat before the outcome was calculated, but the repository seal was **not committed before outcome access**.

This record therefore does **not** claim a valid repository-level pre-open preregistration. The result remains usable as a diagnostic FAIL. Because the economic gate already failed, repeating the same family on another window merely to obtain a formal PASS would violate the plan's anti-retuning rule.

Result JSON:

- `validation-runs/diagnostics/core-outperformance-momentum-v1-result.json`.
