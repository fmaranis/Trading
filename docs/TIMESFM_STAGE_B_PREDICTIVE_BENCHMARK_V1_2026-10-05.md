# TimesFM Stage B — predictive benchmark V1

Date: 2026-10-05  
Status: **PREREGISTERED DESIGN / RESEARCH-ONLY / NO PRODUCTION AUTHORITY**

## Objective

Test whether TimesFM 3.0 contains causal predictive information that helps distinguish assets likely to outperform the structural core. This is a **signal-quality** experiment, not an economic trading policy. Production remains `LEGACY`.

Stage A already produced a real `PASS_STAGE_A_TECHNICAL_SMOKE` on Hugging Face ZeroGPU with the frozen TimesFM 3.0 checkpoint. Stage B therefore opens predictive outcomes, but it must not tune a portfolio policy from the same sample.

## Why this design

TimesFM 3.0 is natively multivariate. The primary hypothesis is deliberately small: forecast the candidate asset jointly with the structural core, rather than adding many technical indicators. The secondary univariate arm measures whether cross-series core context adds information; it cannot rescue a failure of the primary arm.

Recent financial TSFM research is mixed: related multivariate series can improve forecasts, but off-the-shelf zero-shot models can also underperform simple financial baselines. The protocol therefore requires direct comparison with naive, momentum and current LEGACY ranking baselines.

References read before outcomes:
- Google Research, TimesFM-3 multivariate release: https://research.google/blog/timesfm-3-a-zero-shot-foundation-model-for-multivariate-forecasting/
- Google TimesFM repository/API examples: https://github.com/google-research/timesfm
- Das, Goyal & Yadav (2026), multivariate financial TSFM forecasting: https://arxiv.org/abs/2605.21504
- Rahimikia, Ni & Wang (2025), TSFMs in finance: https://ssrn.com/abstract=5770562
- Goel, Pasricha & Kanniainen (2024), TimesFM for VaR: https://arxiv.org/abs/2410.11773

## Frozen model

- package: `timesfm==3.0.2`
- checkpoint: `google/timesfm-3.0-pytorch`
- revision: `24701cec1b1ea47232c0766e888855c9976ef62b`
- expected `model.safetensors` SHA-256: `a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da`
- TimesFM 3.0 remains research-only because the current weights are non-production/non-commercial. Any later production candidate must be replicated with a compatible model/license, initially TimesFM 2.5.

## Frozen data and panel

Provider: Yahoo Finance REAL daily listed-market history through the existing project semantics. No synthetic fallback.

Structural core reference:
- `EUNL.DE` — iShares Core MSCI World UCITS ETF.

Candidate panel, frozen before outcomes:
- `SXR8.DE` — US equity;
- `EQQQ.DE` — technology;
- `EXSA.DE` — Europe;
- `IS3N.DE` — emerging markets;
- `ZPRV.DE` — US small-cap value;
- `EXH1.DE` — energy;
- `IBCI.DE` — euro inflation-linked government bonds;
- `4GLD.DE` — gold.

This is a diagnostic panel of currently known instruments and therefore is not a point-in-time investable-universe reconstruction. No promotion claim may be based on this historical panel.

## Frozen diagnostic sample

- raw download start: 2015-01-01;
- first signal anchor: quarter ending 2018-03-31;
- last signal anchor: quarter ending 2025-09-30;
- outcomes end no later than 2025-12-31;
- quarter anchor = last available common asset/core trading session on or before the calendar quarter-end;
- context: exactly 512 common sessions ending at the information date;
- horizon: one 60-session forecast, evaluated at 1, 5, 20 and 60 sessions;
- expected maximum: 31 anchors × 8 candidates = 248 forecast cases;
- minimum six candidates required for a cross-sectional anchor;
- data availability may remove a case but may never be repaired based on its future return.

The historical window overlaps previously consumed project periods. It is therefore **diagnostic only**. A PASS starts the already-frozen prospective confirmation; it does not open Stage C.

## Inputs

Each case is transformed causally using only prices through the information date.

Primary `TIMESFM3_MV_ASSET_PLUS_CORE`:
- variate 1 = candidate close path;
- variate 2 = core close path.

Secondary `TIMESFM3_UV_ASSET_ONLY`:
- candidate close path only.

Each context is rebased to 100 at its first observation. No future covariates. No fundamentals. No Forward Risk. No hidden production signals.

Only context arrays are sent to ZeroGPU. Future prices/outcomes remain in the local validation runner and are evaluated only after the remote forecast has returned.

## Baselines

1. `ZERO_RETURN`: predicts 0% return.
2. `ALWAYS_POSITIVE_DIRECTION`: buy-and-hold directional baseline.
3. `TRAILING_60_SESSION_LOG_DRIFT`: extrapolates the trailing 60-session log drift to each horizon.
4. `MARKET_SHORTLIST_LEGACY_SCORE_V1`: exact current scanner score family: 20/60/120 momentum minus volatility/drawdown penalty plus the existing defensive bonus. It is used as a **ranking baseline**, not retrofitted into a return forecast.

## Metrics

For 1/5/20/60 sessions:
- absolute and core-relative directional accuracy;
- candidate and relative MAE/RMSE where meaningful;
- cross-sectional Spearman rank IC of predicted relative return vs realised relative return;
- LEGACY rank IC on the identical anchor/candidate rows;
- multivariate vs univariate TimesFM comparison;
- P10–P90 terminal coverage and pinball-style calibration evidence;
- descriptive point-path maximum-drawdown error over 60 sessions.

Quantile outputs are marginal forecasts. They are **not** interpreted as a joint path distribution or as a probability of future max drawdown.

Primary economic relevance is 20 and 60 sessions because the project is deciding whether an opportunity can beat the core over investable horizons. 1/5 sessions remain diagnostics.

## Frozen diagnostic continuation gate

All conditions must pass:

1. usable-case coverage >= 85% of the frozen 248-case maximum;
2. mean cross-sectional rank IC across 20/60 >= 0.05;
3. mean 20/60 rank-IC lift vs LEGACY >= +0.02;
4. pooled 20/60 core-relative directional accuracy >= 52%;
5. at least 5 of 8 assets have positive temporal relative-return IC across the primary horizons;
6. empirical P10–P90 coverage across primary horizons remains between 60% and 95%.

A primary multivariate FAIL cannot be rescued by changing context length, panel, horizons, transformations, thresholds or by promoting the univariate arm on this same sample.

Allowed outcomes:
- `INCONCLUSIVE_COVERAGE`;
- `FAIL_SIGNAL_DIAGNOSTIC`;
- `PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION`.

## Prospective confirmation frozen before diagnostic outcomes

If and only if the diagnostic passes, use the same panel, core, 512-session context, transformations, model and horizons starting after 2026-10-05.

- cadence: first common trading session of each new ISO week;
- no parameter changes after diagnostic outcomes;
- minimum 26 matured weekly anchors;
- primary confirmation requires the 60-session outcomes to have matured;
- the same signal gates are evaluated without loosening;
- no Stage C economic policy is opened until this fresh confirmation passes.

## Infrastructure / cost

One ZeroGPU call batches the whole diagnostic to avoid repeated quota consumption. Free/anonymous ZeroGPU only. No PRO, paid credits, upgraded hardware, Jobs or other billable compute.

## Production

`productionDefault = LEGACY`  
`productionAuthority = false`

No Stage B output can place orders, alter candidate eligibility, alter allocation, or alter production ranking.
