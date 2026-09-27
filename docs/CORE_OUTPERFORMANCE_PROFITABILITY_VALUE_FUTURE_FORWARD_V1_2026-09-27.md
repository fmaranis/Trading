# CORE_OUTPERFORMANCE_PROFITABILITY_VALUE_FUTURE_FORWARD_V1

Date: 2026-09-27

Status: **PREREGISTERED BEFORE FULL V2 CROSS-SECTION / FUTURE OUTCOMES UNOPENED / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Starting HEAD: `3fa33dd052348eb3123e978420aa067fb230b182`.

Production remains `LEGACY`.

## Why this hypothesis is allowed

The concept was frozen **before Candidate A outcomes were opened** in:

`docs/CORE_OUTPERFORMANCE_FACTOR_QUEUE_V1_2026-09-27.md`

as Candidate B:

`HIGH_BM_HIGH_OP_5X5_VW`.

Candidate B historical returns were never opened because the queue stopped when Candidate A passed. This study therefore does **not** open those consumed historical outcomes and does not retune the failed direct stock-level implementation.

The new test is prospective only.

## Question

Can a profitability + valuation intersection retain the already-supported profitability information while avoiding the megacap concentration that damaged the direct value-weighted profitability translation?

## Universe and source

Snapshot date: 2026-09-27.

Universe:

- `FinancialData["^GSPC","Members"]`;
- current S&P 500 membership frozen at snapshot;
- no later constituent substitution in V1.

For each member use current Wolfram Company values:

- `TotalRevenue`;
- `OperatingMargin`;
- `StockholdersEquity`;
- listed-security `MarketCap`.

Provenance: current REAL/externally sourced market/fundamental snapshot for prospective research only.

## Frozen eligibility

A row is evaluable only when:

- Company entity maps;
- TotalRevenue > 0;
- OperatingMargin is finite;
- StockholdersEquity > 0;
- MarketCap > 0.

No missing-value imputation.
No sector exclusions.
No special treatment for financials after snapshot.

## Frozen signals

Operating-profitability proxy:

`OP_PROXY = TotalRevenue * (OperatingMargin / 100) / StockholdersEquity`

Book-to-market proxy:

`BM_PROXY = StockholdersEquity / MarketCap`

Higher is better for both.

These are current implementation proxies; they are not claimed to be byte-identical to Kenneth French accounting definitions.

## Frozen selection — prior Candidate B translation

On the same evaluable universe:

1. rank descending by `OP_PROXY`, ticker ascending for ties;
2. define OP top quintile as first `ceil(N/5)` rows;
3. rank descending by `BM_PROXY`, ticker ascending for ties;
4. define BM top quintile as first `ceil(N/5)` rows;
5. selected set = exact intersection of both top quintiles.

No neighboring quintiles.
No rank-sum rescue.
No threshold relaxation if the intersection is small.

Weighting:

- market-cap value-weighted inside the selected intersection;
- no equal-weight fallback;
- no per-name cap added to the signal replica.

The exact V2 signal replica remains separate from any future Custodia sizing policy.

## Pre-outcome implementation audit

Before opening any future return:

- record selected count;
- max internal weight;
- top-5 weight;
- HHI / effective number of positions;
- compare those descriptively with frozen direct-profitability V1:
  - V1 max weight ≈ 34.275%;
  - V1 top-5 ≈ 78.815%;
  - V1 HHI ≈ 0.225196;
  - V1 effective N ≈ 4.44.

No V2 weight is changed because of this audit.

If the intersection is empty, status = `INCONCLUSIVE_EMPTY_INTERSECTION`.
Otherwise the snapshot is retained even if concentration remains high; concentration affects later implementability, not the signal definition.

## Outcome protocol

Start rule:

**first common tradable session after 2026-09-27**, identical prospective start convention to direct profitability V1.

Frozen checkpoints:

- approximately 3 months: descriptive only;
- approximately 6 months: descriptive only;
- 12 months: primary.

Primary benchmarks:

- SPY;
- URTH.

Primary PASS:

- 100% selected-symbol outcome coverage;
- V2 basket 12-month total return > SPY;
- V2 basket 12-month total return > URTH.

Paired comparison versus direct Profitability Future-Forward V1 is **secondary diagnostic only**. It is not allowed to convert a benchmark FAIL into PASS.

## Corporate actions

A selected security that ceases trading before the primary endpoint makes V1 `INCONCLUSIVE_CORPORATE_ACTION_ACCOUNTING` unless a corporate-action accounting rule has been separately frozen **before that event is known**.

No survivor renormalization and no post-hoc terminal-value insertion.

## Interpretation

A 12m PASS is still only `PASS_PRIMARY_12M_SIGNAL_ONLY`.

Promotion would still require:

- a causal Custodia integration;
- costs;
- Spanish taxation;
- daily risk/drawdown;
- look-through concentration;
- repeated independent evidence.

## Anti-retuning

After snapshot commit, do not:

- change quintiles;
- switch to neighboring cells;
- change OP/BM formulas;
- rank-sum or blend after outcomes;
- equal-weight after outcomes;
- add sector, momentum, trend, Forward Risk or quality filters;
- exclude a later loser/delisting;
- resize the V2 signal replica to manufacture benchmark outperformance.

Any successor policy requires a new preregistration and new prospective evidence.
