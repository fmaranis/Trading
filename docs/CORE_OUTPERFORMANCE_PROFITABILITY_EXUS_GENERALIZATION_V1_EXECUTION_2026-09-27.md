# CORE_OUTPERFORMANCE_PROFITABILITY_EXUS_GENERALIZATION_V1 — execution

Date: 2026-09-27

Status: **FAIL_GEOGRAPHIC_GENERALIZATION / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Preregistration commit: `3043670bb7cacc073053a6c77c4c1beddede6446`.

The candidate and both windows were frozen before these return rows were opened.

## Result

| Window | Big / Robust OP CAGR | Developed ex-US market CAGR | Excess |
| --- | ---: | ---: | ---: |
| 2009-01 → 2014-12 | **9.69%** | **10.27%** | **-0.59 pp/y** |
| 2016-01 → 2021-12 | **10.69%** | **9.33%** | **+1.37 pp/y** |

Preregistered gate required positive excess CAGR in **both** complete 72-month windows.

Verdict: **FAIL_GEOGRAPHIC_GENERALIZATION**.

Monthly-path diagnostics are directionally favorable despite the failed return gate:

- 2009–2014 volatility: candidate 16.90% vs market 18.12%;
- 2009–2014 max monthly-path drawdown: -19.82% vs -22.49%;
- 2016–2021 volatility: candidate 13.39% vs market 14.41%;
- 2016–2021 max monthly-path drawdown: -20.37% vs -23.08%.

## Interpretation

This exact Big/Robust Developed ex-US portfolio does **not** establish geographic generalization across both matched windows. The 2016–2021 window is positive, but the earlier confirmation-style window is not.

This does not overturn the U.S. Operating Profitability signal evidence. It narrows the claim: the observed long-only excess is not proven to be stable across Developed ex-US under this frozen construction.

Per preregistration, no Europe/Japan/Asia-Pacific rescue, no Small+Big blend, no bucket change and no window change are allowed.

Production remains `LEGACY`.

## Reproducibility

- input: `validation-runs/diagnostics/core-outperformance-profitability-exus-generalization-v1-input.json`;
- result: `validation-runs/diagnostics/core-outperformance-profitability-exus-generalization-v1-result.json`;
- runner: `scripts/coreOutperformanceProfitabilityExUsGeneralizationV1.mjs`.
