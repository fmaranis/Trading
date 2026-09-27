# CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1

Date: 2026-09-27

Status: **PREREGISTERED BEFORE PRICE OUTCOMES / IMPLEMENTATION DIAGNOSTIC ONLY / NO PRODUCTION AUTHORITY**

Starting HEAD: `5a8f1f163ef1681b6520983948a49a584eaab5c4`.

Production remains `LEGACY`.

## Purpose

Test whether the already-supported long-only operating-profitability signal survives a causal stock-level translation on a fully inspectable secondary fundamentals source while the stricter SEC CompanyFacts Stage C1 remains blocked by runtime access.

This study is **not** a replacement for `CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1` and cannot promote production. Its market window is consumed for research and its purpose is implementation diagnosis.

## Frozen sources

Historical membership:

- repository: `chinobing/historical_sp500_constituents`;
- commit: `019beba2644764db88219cee6a8c43b8aae4904e`;
- current constituents blob: `1431476ddf0f0389afa175d010116d96c8371975`;
- changes blob: `ccdcb9d50c588a198c2eecdf0f7c38a7f205c75e`;
- provenance: `STATIC_REFERENCE`.

Fundamentals:

- repository: `rikkyrocky/SIGML`;
- income quarterly blob: `117ac76ff7cf2fb83a7db85054a7b0b8ad3d9198`;
- balance quarterly blob: `035c230e907cc4e55cad4d913a0b0fc2736110c8`;
- observed report-date range: 2019-06-30 through 2024-04-30;
- provenance: `STATIC_REFERENCE`;
- causal fields used: `Publish Date` and `Report Date`.

Prices:

- source: REAL listed-market history;
- signal date = last real session <= June 30 anchor;
- execution date = first real session after signal date;
- selected-position returns use adjusted-open to next adjusted-open;
- raw signal-date close is used only for causal market-cap weighting.

No synthetic fallback.

## Frozen diagnostic window

Anchors:

- 2020-06-30
- 2021-06-30
- 2022-06-30
- 2023-06-30
- 2024-06-30

Return periods:

- 2020 -> 2021
- 2021 -> 2022
- 2022 -> 2023
- 2023 -> 2024

Role: `IMPLEMENTATION_TRANSLATION_DIAGNOSTIC_CONSUMED_WINDOW`.

No claim of fresh/blind/OOS alpha is allowed from this bridge.

## Frozen signal

For every reconstructed historical S&P 500 member at an anchor:

1. use only income rows with `Publish Date <= anchor`;
2. take the latest four distinct quarterly `Report Date` rows;
3. require all four rows to contain Revenue, Cost of Revenue, Selling General & Administrative, and Interest Expense Net;
4. require a balance row at the latest of those four report dates with `Publish Date <= anchor`, positive Total Equity and positive Shares Basic.

This SimFin snapshot stores expenses as negative values.

Frozen numerator:

`TTM_OP = Σ(Revenue + CostOfRevenue + SG&A + InterestExpenseNet)`

Frozen score:

`OP_SIMFIN_TTM = TTM_OP / TotalEquity`

Rules:

- no Operating Income fallback;
- no zero-imputation of missing expense fields;
- no rows published after the anchor;
- negative profitability remains eligible and ranks naturally;
- ticker normalization only removes punctuation/case for source joins.

## Selection and weighting

- descending `OP_SIMFIN_TTM`;
- normalized ticker ascending as deterministic tie-break;
- top decile = `ceil(evaluable / 10)`;
- value-weight inside the selected decile;
- causal market-cap proxy = signal-date raw close × same-period balance `Shares (Basic)`;
- no equal-weight fallback;
- any missing selected market-cap input => period inconclusive.

## Coverage gates inherited from Stage C1

Thresholds are not reduced:

- historical members >= 450;
- source-matched members >= 350;
- evaluable profitability rows >= 250;
- selected positions >= 25;
- selected market-cap coverage = 100%;
- selected outcome coverage = 100%.

Pre-outcome audit:

| Anchor | Members | Matched | Evaluable | Selected |
| --- | ---: | ---: | ---: | ---: |
| 2020-06-30 | 501 | 385 | 266 | 27 |
| 2021-06-30 | 501 | 386 | 284 | 29 |
| 2022-06-30 | 498 | 394 | 271 | 28 |
| 2023-06-30 | 503 | 403 | 270 | 27 |
| 2024-06-30 | 503 | 412 | 292 | 30 |

All inherited pre-price coverage gates pass. All selected rows have positive causal Shares Basic before price access.

## Benchmarks

For identical execution intervals:

- SPY;
- URTH.

## Outcome rule

Gross annual-period returns are chained across the four completed periods.

Bridge PASS requires all of:

- four periods evaluable;
- candidate gross CAGR > SPY gross CAGR;
- candidate gross CAGR > URTH gross CAGR.

States:

- `PASS_SIMFIN_BRIDGE_GROSS_ONLY`;
- `FAIL_SIMFIN_BRIDGE`;
- `INCONCLUSIVE_PRICE_OR_COVERAGE`.

A PASS only shows this secondary causal implementation retained the signal. It does not unlock production promotion by itself.

A FAIL does not invalidate the external French signal; it rejects this specific stock-level translation/source.

## Anti-retuning

After this file is committed:

- do not change anchors;
- do not change four-quarter TTM;
- do not fill missing interest with zero;
- do not switch to Operating Income;
- do not change the top decile;
- do not switch to equal weight;
- do not remove sectors or selected losers/delistings;
- do not add valuation, momentum, trend, Forward Risk or timing;
- do not use this consumed sample to tune a replacement bridge.

Strict SEC PIT remains separately frozen and blocked, not superseded.
