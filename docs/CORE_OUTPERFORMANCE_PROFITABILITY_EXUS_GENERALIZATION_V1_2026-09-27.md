# CORE_OUTPERFORMANCE_PROFITABILITY_EXUS_GENERALIZATION_V1

Date: 2026-09-27

Status: **PREREGISTERED BEFORE RETURN ACCESS / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Starting HEAD: `91408073b2b1e451ae6bcc7610b760dce2def074`.

Production remains `LEGACY`.

## Objective

Test whether the already-selected Operating Profitability family generalizes outside the United States without changing the signal after observing the positive U.S. result.

This is an external geographic generalization test, not a replacement for the blocked stock-level SEC PIT translation and not a production promotion test.

## Frozen source family

Kenneth R. French Data Library:

- 6 Developed ex US Portfolios Formed on Size and Operating Profitability (2 x 3);
- Developed ex US Fama/French market factor for the benchmark.

Methodology was inspected before freeze; portfolio return rows for the target windows were not opened before this file is committed.

## Frozen candidate

`DEVELOPED_EX_US_BIG_ROBUST_OP_VW`

Exact construction:

- Developed ex US universe under the French regional eligibility rules;
- independent 2 x 3 sort on size and operating profitability;
- **Big / Robust** cell only;
- Big = top 90% of regional June market capitalization;
- Robust = top operating-profitability group using the published regional breakpoints;
- value-weighted;
- long-only;
- USD total returns including dividends and capital gains;
- no leverage, no short leg, no timing filter;
- no combination with Small Robust after outcomes.

Reason for freezing Big Robust rather than a synthetic aggregation: it is a directly published, investable-style large-stock portfolio and avoids reconstructing cross-cell weights after seeing returns.

## Frozen benchmark

Developed ex US total market return:

`MKT_EXUS = Mkt-RF + RF`

from the Kenneth French Developed ex US factor dataset, same USD return convention.

## Frozen windows

Two windows, chosen before return access to match the prior U.S. profitability evidence:

1. 2009-01 through 2014-12 — 72 months;
2. 2016-01 through 2021-12 — 72 months;
3. calendar year 2015 remains excluded as the separation year.

These dates are not fresh market-regime holdouts because the same calendar periods were used in U.S. work. They are a **geographic holdout**: the securities and regional market are non-U.S.

## Gate

For each window independently:

- exactly 72 valid candidate months;
- exactly 72 valid benchmark months;
- candidate gross CAGR > Developed ex US market gross CAGR.

Overall result:

- `PASS_GEOGRAPHIC_GENERALIZATION` only if **both** windows pass;
- `FAIL_GEOGRAPHIC_GENERALIZATION` if either complete window has non-positive excess CAGR;
- `INCONCLUSIVE_COVERAGE` for missing months.

No risk promotion claim is allowed from monthly portfolios alone.

## Anti-retuning

After target returns are opened, do not:

- switch from Big Robust to Small Robust;
- average Big and Small Robust;
- change from top 30% Robust to another profitability bucket;
- open Europe/Japan/Asia-Pacific variants as a rescue;
- change windows;
- add value, investment, momentum or sector filters.

A failure means only that this exact geographic generalization did not reproduce the U.S. long-only advantage.

## Consequence of PASS

A PASS increases confidence that high operating profitability is not purely a U.S.-specific historical artifact, but it does not authorize production.

The next proof requirements remain:

1. strict stock-level PIT/actionability;
2. execution costs and Spanish tax comparability;
3. daily risk guardrails;
4. the already frozen future-forward V1.

Production remains `LEGACY`.
