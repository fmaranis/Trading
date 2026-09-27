# CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1 — snapshot

Date: 2026-09-27

Status: **SNAPSHOT FROZEN / PASS PRE-OUTCOME GUARDS / FUTURE OUTCOMES UNOPENED / NO PRODUCTION AUTHORITY**

Preregistration:
- `docs/CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1_2026-09-27.md`

Frozen snapshot:
- `validation-runs/preregistration/core-outperformance-profitability-future-forward-v1-snapshot.json`

Seal:
- `validation-runs/preregistration/core-outperformance-profitability-future-forward-v1-seal.json`

Verification:
- `validation-runs/diagnostics/core-outperformance-profitability-future-forward-v1-verification-2026-09-27.json`

## Frozen cross-section

- S&P 500 current members from Wolfram: **500**
- mapped to Company entities: **500**
- evaluable under the frozen profitability proxy: **451**
- selected top decile: **46**
- weighting: market-cap value-weighted
- future price outcomes opened: **0**

Frozen proxy:

`TotalRevenue × OperatingMargin / StockholdersEquity`

with positive revenue, positive equity and positive market cap.

## Concentration audit before outcomes

The exact academic-style value-weighted translation is internally concentrated:

- NVDA: **34.27%** of the alpha basket;
- AAPL: **31.42%**;
- LLY: **7.03%**;
- top 5 by basket weight: **78.81%**;
- top 10: **87.22%**;
- HHI: **0.2252**;
- effective number of positions: **4.44**.

This does not change V1. The snapshot remains frozen exactly as selected. The concentration result is treated as implementation risk evidence, not as permission to retune weights before outcomes.

If the basket were eventually used only as a bounded non-core sleeve under the existing `CORE_ARCHITECTURE_V1` maximum non-core budgets, its direct incremental weights would scale down. For example, NVDA/AAPL direct incremental exposure would be approximately:

- LOW 18% sleeve: **6.17% / 5.66%** of total portfolio;
- MEDIUM 25% sleeve: **8.57% / 7.86%**;
- HIGH 35% sleeve: **12.00% / 11.00%**.

These figures do **not** include look-through exposure to NVDA/AAPL already held inside the structural core. A look-through overlap guard is therefore required before any Custodia integration.

Risk audit:
- `validation-runs/diagnostics/core-outperformance-profitability-future-forward-v1-risk-audit.json`

## Live implementation reality check

External live products confirm that profitability can be implemented, but also show why the academic premium cannot simply be assumed to survive costs and real portfolio construction.

Dimensional U.S. High Relative Profitability Portfolio (DURPX), inception 2017-05-16, reported through 2025-12-31:

- since-inception before-tax annualized return: **14.48%**;
- Russell 1000: **14.55%**;
- excess: **-0.07 pp/year**;
- most recently reported portfolio turnover: **11%**.

Dimensional US High Profitability ETF (DUHP), inception 2022-02-23, reported through 2025-12-31:

- since-inception before-tax annualized return: **13.49%**;
- Russell 1000: **14.63%**;
- excess: **-1.14 pp/year**;
- expense ratio: **0.20%**.

These funds are not exact replicas of French `Hi 10` or our frozen Custodia translation. Their outcomes are descriptive implementation evidence, not a FAIL of our signal.

Sources and machine-readable detail:
- `validation-runs/diagnostics/core-outperformance-profitability-live-implementation-evidence-2026-09-27.json`

## Next event

The basket is frozen on Sunday 2026-09-27. The start rule remains:

**first common tradable session after the snapshot**.

The next step is to lock adjusted start prices for all 46 selected securities plus SPY and URTH on that first common session. After that:

- ~3 months: descriptive checkpoint only;
- ~6 months: descriptive checkpoint only;
- 12 months: primary PASS/FAIL against both SPY and URTH.

No 3m/6m result can promote or terminate the study.

Production remains `LEGACY`.
