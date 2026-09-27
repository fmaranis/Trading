# FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1

Date: 2026-09-27

Status: **PREREGISTERED BEFORE FULL CROSS-SECTION / FUTURE OUTCOMES UNOPENED / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Starting HEAD: `82136703c91d32b47eecc691fe0374b68435dc6e`.

Production remains `LEGACY`.

## Purpose

Test prospectively whether the externally supported corporate-quality family can outperform the broad U.S. parent and the structural global-core proxy using a diversified, directly auditable S&P 500 implementation.

This is **not** the project's historical `QUALITY_V1` / `QUALITY_ALLOCATION_BRIDGE_V1`. Those use internal reliability/opportunity scores. This study uses corporate fundamentals only.

## External methodology anchor

The construction is patterned after the published MSCI Quality methodology:

- high Return on Equity;
- low Debt to Equity;
- low Earnings Variability;
- 5th/95th percentile winsorization;
- cross-sectional Z-scores;
- equal combination of the three descriptors;
- Quality Score × market-cap weighting;
- 5% issuer cap.

MSCI describes Earnings Variability as the standard deviation of year-over-year EPS growth over the prior five years.

References:

- https://www.msci.com/eqb/methodology/meth_docs/MSCI_Quality_Indices_Methodology.pdf
- https://www.msci.com/indexes/index/702787/msci-world-quality-index

The S&P 500 translation below is explicit and not claimed to be byte-identical to MSCI's vendor fundamentals or constituent-count rules.

## Universe

Snapshot date: **2026-09-27**.

- current `FinancialData["^GSPC","Members"]`;
- expected 500 listed members;
- no later constituent substitution in V1;
- current prospective snapshot only; no historical-universe reconstruction claim.

## Fundamental inputs

For each listed security / mapped Wolfram Company entity:

Current Company values:

- `NetIncome`;
- `TotalDebt`;
- `StockholdersEquity`;
- listed-security `MarketCap`.

Historical listed-security values:

- `FinancialData[ticker,"EarningsPerShare"]`.

All inputs are frozen before future price outcomes.

## Descriptor formulas

Eligibility requires:

- mapped Company entity;
- finite NetIncome;
- `StockholdersEquity > 0`;
- finite `TotalDebt >= 0`;
- `MarketCap > 0`;
- six annual EPS anchor observations, all strictly positive.

### ROE

`ROE = NetIncome / StockholdersEquity`

Higher is better.

### Debt to Equity

`DE = TotalDebt / StockholdersEquity`

Lower is better.

### Earnings Variability

Annual EPS anchor for year Y:

> the latest observed trailing EPS value with observation date <= June 30 of Y.

Required years:

- 2021;
- 2022;
- 2023;
- 2024;
- 2025;
- 2026.

Five year-over-year growth observations:

`g[Y] = EPS[Y] / EPS[Y-1] - 1`

`EVAR = sample standard deviation(g[2022..2026])`

All six annual EPS anchors must be positive. No zero floor, sign repair, interpolation or later imputation is allowed.

## Cross-sectional standardization

For each of ROE, DE and EVAR:

1. exclude ineligible/missing rows;
2. winsorize at the 5th and 95th percentile ranks;
3. calculate population cross-sectional mean and standard deviation;
4. compute standardized z-score.

Directional descriptor scores:

- `Z_ROE = z(ROE)`;
- `Z_DE = -z(DE)`;
- `Z_EVAR = -z(EVAR)`.

Composite:

`QUALITY_Z = (Z_ROE + Z_DE + Z_EVAR) / 3`

Frozen monotonic Quality Score:

- if `QUALITY_Z > 0`: `QUALITY_SCORE = 1 + QUALITY_Z`;
- otherwise: `QUALITY_SCORE = 1 / (1 - QUALITY_Z)`.

This follows the published MSCI score transformation.

## Selection

Fixed count:

- select the **100 highest Quality Scores**;
- require at least 100 fully evaluable rows or status = `INCONCLUSIVE_COVERAGE`;
- ties: higher current market cap first, then ticker ascending.

The count of 100 is frozen before the full cross-section and is intended to retain a broad, investable top-quality subset of the 500-stock parent. It is not changed after seeing concentration or outcomes.

No:

- sector-neutralization;
- value filter;
- momentum;
- trend;
- Forward Risk;
- dividend filter;
- profitability threshold beyond the stated data/positive-EPS eligibility;
- hand removal of financials or later losers.

## Weighting

Raw weight:

`RAW_WEIGHT = QUALITY_SCORE × MarketCap`

Then apply a **5% per-issuer cap**:

1. set every tentative weight above 5% to 5%;
2. redistribute excess pro rata among remaining uncapped raw weights;
3. repeat until all weights <=5%.

No equal-weight fallback.

The 5% cap is frozen before the full cross-section and is directly anchored to the published MSCI Quality concentration rule, not chosen from project outcomes.

## Pre-outcome audit

Before future returns:

- members / mapped / evaluable / selected;
- descriptor 5/95 cutoffs;
- score distribution;
- max issuer weight;
- top-5 / top-10;
- HHI / effective number of positions;
- sector labels only if available without changing selection.

The snapshot is retained even if concentration is imperfect. If 100 evaluable securities are unavailable, V1 is inconclusive and no threshold is relaxed.

## Outcome protocol

Start:

**first common tradable session after 2026-09-27**.

Price semantics:

- adjusted open at the common start;
- adjusted/total-return-compatible future marks;
- 100% selected-symbol coverage;
- no survivor renormalization.

Checkpoints:

- ~3 months: descriptive only;
- ~6 months: descriptive only;
- 12 months: primary.

Benchmarks:

- SPY;
- URTH.

Primary 12m signal PASS:

- Quality basket total return > SPY;
- Quality basket total return > URTH;
- 100% selected outcome coverage.

Risk diagnostics at 12m:

- daily annualized volatility;
- daily max drawdown;
- Sharpe under the same risk-free convention for candidate and benchmarks.

A return PASS is still only `PASS_PRIMARY_12M_SIGNAL_ONLY`. Any Custodia promotion requires costs, Spanish tax, look-through concentration, execution and repeated independent evidence.

## Corporate actions

A selected security that ceases trading must be handled only by a **corporate-action accounting rule frozen before the event becomes known**. V1 does not allow post-hoc terminal-value insertion or survivor renormalization.

Until a generic causal corporate-action handler is separately frozen, an unresolved selected corporate action makes the relevant endpoint inconclusive.

## Anti-retuning

After the snapshot is committed, do not:

- change 100 constituents;
- change descriptor formulas;
- change June EPS anchors;
- change 5/95 winsorization;
- change descriptor weights;
- change 5% issuer cap;
- sector-neutralize;
- add value/momentum/regime filters;
- remove a later loser/delisting;
- choose a different benchmark or endpoint because of results.

Any successor requires a separate preregistration and new future evidence.
