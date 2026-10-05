# TimesFM Multivariate Context V1 — native full-panel diagnostic

Date: 2026-10-05
Status: **PREREGISTERED / CONSUMED HISTORICAL DIAGNOSTIC ONLY / FRESH ARMS FROZEN BEFORE FIRST PROSPECTIVE ANCHOR**

## Question

The previous Stage B diagnostic used TimesFM 3 in a two-variate configuration: one candidate plus EUNL. It showed predictive information, but the subsequent direct-selector economic translation lost badly versus both LEGACY and EUNL.

This study asks a different model question before attempting another trading policy:

> Does TimesFM 3 gain materially useful signal when it sees the complete nine-series market panel simultaneously, and does adding causal OHLCV-derived context improve that signal further?

No trading policy is evaluated here.

## Frozen targets

One native multivariate forecast contains all nine targets simultaneously:

1. EUNL.DE — structural core
2. SXR8.DE
3. EQQQ.DE
4. EXSA.DE
5. IS3N.DE
6. ZPRV.DE
7. EXH1.DE
8. IBCI.DE
9. 4GLD.DE

TimesFM 3 variate attention can therefore see cross-series relationships in one forward pass instead of eight independent candidate/core pairs.

## Arm A — FULL_PANEL_TARGETS_ONLY

- 9 target close series;
- 512 common sessions;
- TimesFM 3 evaluator default normalization semantics, identical across both arms;
- 60-session horizon;
- quantiles enabled;
- no covariates.

This isolates the value of full-panel multivariate attention.

## Arm B — FULL_PANEL_PLUS_CAUSAL_COVARIATES

Same 9 targets plus exactly 23 past-only covariates, reaching the frozen TimesFM 3 limit of 32 variates.

Per target, 18 total:
- log1p(volume), z-scored over the 512-session context;
- intraday range (high-low)/close.

Shared, 5 total:
- EUNL realized volatility over 20 sessions;
- EUNL drawdown from rolling 60-session peak;
- cross-sectional one-day return dispersion across the nine targets;
- cross-sectional mean overnight gap (open versus previous close);
- cross-sectional overnight-gap dispersion.

Every covariate at every point is derived only from information at or before that point. No future covariates are used in V1.

## Why no VIX/rates/macro yet

Those series may be valuable, but adding them now would confound two questions:
- whether native full-panel TimesFM 3 is better than pairwise TimesFM;
- whether a new external macro data source is useful.

V1 isolates the model architecture and causal OHLCV context first. External macro can only be a separate, preregistered follow-up.

## Historical diagnostic

The historical dates remain the already-consumed Stage B quarter anchors:
- 2018-Q1 through 2025-Q3;
- expected 31 anchors;
- minimum 27 usable anchors;
- Yahoo Finance REAL OHLCV;
- no synthetic fallback.

Because outcomes from this period have already been examined in prior work, this diagnostic has **zero promotion authority**.

Primary horizons: 20 and 60 sessions.

Reported for both arms:
- cross-sectional rank IC versus realised candidate return relative to EUNL;
- relative directional accuracy;
- relative MAE;
- P10-P90 terminal coverage;
- temporal IC per candidate.

Descriptive interpretation thresholds are frozen before this runner opens its result:
- mean rank IC 20/60 >= 0.05;
- pooled directional accuracy 20/60 >= 52%;
- at least 5 candidates with positive temporal IC;
- P10-P90 coverage between 60% and 95%;
- to claim that covariates add signal, covariate rank-IC lift versus targets-only must be >= +0.02.

Possible diagnostic labels:
- POSTHOC_COVARIATES_ADD_SIGNAL;
- POSTHOC_PANEL_SIGNAL_NO_COVARIATE_LIFT;
- POSTHOC_NO_USEFUL_MULTIVARIATE_INCREMENT;
- INCONCLUSIVE_COVERAGE.

None can promote production.

## Fresh prospective protection

Both arms are frozen before the first fresh TimesFM week.

- start after: 2026-10-05;
- first eligible ISO week: 2026-W42;
- minimum 26 matured anchors;
- no retuning after collection opens;
- no winner may be chosen retrospectively from the historical diagnostic.

The existing prospective sample remains unopened/outcomes unopened while this infrastructure is prepared.

## Runner

Canonical Space source:
- runner/timesfm/hf-space/app.py

The existing Stage A and Stage B endpoints remain in that same file. V1 adds:
- multivariate_context_predict

The ChatGPT Hugging Face connector currently has read-only repository scope, so canonical code is committed in fmaranis/Trading/main; deployment to the existing Space must not change this repository's source-of-truth role.

## Production

productionDefault = LEGACY
productionAuthority = false

TimesFM 3 pretrained weights remain research-only/non-production under their current license.
