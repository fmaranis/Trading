# Core outperformance factor queue V1 — preregistration

Date: 2026-09-27

Status: **PREREGISTERED / OUTCOMES NOT OPENED / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Repository: `fmaranis/Trading`, branch `main`.
Starting HEAD: `633cef61b10f8ba0b1940cac039e7a2068be843f`.

## Objective

Continue the search for a defensible long-only source of excess return over the structural core without retuning the failed momentum family.

This document freezes a short queue of economically distinct, literature-backed accounting-factor constructions **before opening their return series**. The queue is screening evidence only. Passing it cannot promote production and does not establish alpha after costs.

Production remains `LEGACY`.

## Common diagnostic window and benchmarks

Diagnostic window for every candidate:

- 2016-01 through 2021-12;
- exactly 72 monthly observations;
- role: `DIAGNOSTIC_CONSUMED_MARKET_WINDOW`;
- this period is intentionally not called fresh because benchmark outcomes were already used by the momentum study.

Benchmarks are fixed before candidate outcomes:

1. US parent: the same French/CRSP US market monthly series already cached in `validation-runs/diagnostics/core-outperformance-momentum-v1-input.json`.
2. Global proxy: the same URTH adjusted-close endpoints already frozen there for 2016-01-04 through 2021-12-31.

Common Stage B gate:

- candidate gross CAGR > US parent gross CAGR; **and**
- candidate gross CAGR > URTH gross CAGR.

Coverage gate:

- exactly 72 valid monthly candidate returns;
- any missing month => `INCONCLUSIVE_COVERAGE`, not imputation.

A PASS means only `PASS_EXTERNAL_DIAGNOSTIC_CANDIDATE`.
A FAIL moves to the next already-preregistered candidate.
No parameter variants are allowed inside a failed candidate.

## Frozen queue

### Candidate A — OPERATING_PROFITABILITY_DECILE_10_VW

Source family: Kenneth R. French, Portfolios Formed on Operating Profitability.

Frozen construction:

- US NYSE/AMEX/NASDAQ universe under the French dataset eligibility rules;
- annual operating profitability formed each June from fiscal-year t-1 accounting data;
- NYSE breakpoints;
- highest operating-profitability decile only;
- value-weighted return series;
- long-only;
- no leverage, no short leg, no timing filter.

Rationale: profitability has direct published cross-sectional return evidence and is the cleanest next test after the project's profitability/Quality diagnostics.

### Candidate B — HIGH_BM_HIGH_OP_5X5_VW

Source family: Kenneth R. French, 25 Portfolios Formed on Book-to-Market and Operating Profitability.

Frozen construction:

- intersection of the **highest book-to-market quintile** and **highest operating-profitability quintile**;
- NYSE quintile breakpoints;
- value-weighted portfolio return;
- long-only;
- no averaging with neighboring cells;
- no alternative value metric after opening outcomes.

This is the primary direct Quality/profitability × valuation interaction test.

### Candidate C — HIGH_OP_LOW_INV_5X5_VW

Source family: Kenneth R. French, 25 Portfolios Formed on Operating Profitability and Investment.

Frozen construction:

- intersection of the **highest operating-profitability quintile** and **lowest investment-growth quintile**;
- NYSE quintile breakpoints;
- value-weighted portfolio return;
- long-only;
- no neighboring-cell blend or parameter search.

This tests a profitability + conservative-investment construction distinct from valuation.

## Sequential rule

Run A first.

- If A passes the common gate, stop the queue and proceed to an actionable causal-replica design. B and C stay unopened by this study.
- If A fails, record it and run B exactly as frozen.
- If B passes, stop and proceed to actionable causal-replica design. C stays unopened.
- If B fails, run C exactly as frozen.
- If all three fail, close this queue. Do not change quintiles, weighting, window, or combine the failed candidates to manufacture a winner.

Because the queue contains three predeclared hypotheses, any PASS remains exploratory and requires independent confirmation. It is not a multiple-testing-adjusted proof of alpha.

## Actionable follow-up after a PASS

Only after a PASS:

1. freeze a stock-level PIT translation before opening new stock outcomes;
2. use causal accounting publication dates, historical membership/delistings, and NEXT_OPEN execution where applicable;
3. compare net of costs and comparable taxation with `CORE_HOLD`;
4. require drawdown and Sharpe guardrails from the existing core-outperformance plan;
5. use independent confirmation or future-forward evidence before any promotion review.

If required PIT data are unavailable, record `BLOCKED_DATA_ACCESS`. Do not substitute current constituents or current fundamentals.

## Sources read before freeze

Methodology only; return outcomes were not opened before this file was committed:

- Kenneth French Data Library — Portfolios Formed on Operating Profitability
  https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/Data_Library/det_port_form_op.html
- Kenneth French Data Library — 25 Portfolios Formed on Book-to-Market and Operating Profitability
  https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/Data_Library/tw_5_ports_beme_op.html
- Kenneth French Data Library — 25 Portfolios Formed on Operating Profitability and Investment
  https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/Data_Library/tw_5_ports_op_inv.html
- Novy-Marx, *The Other Side of Value: Good Growth and the Gross Profitability Premium*
  https://www.nber.org/papers/w15940
- Novy-Marx & Medhat, *Profitability Retrospective: What Have We Learned?*
  https://www.nber.org/papers/w33601

## Prohibited after outcome access

- changing 2016-2021;
- trying adjacent deciles/quintiles to rescue a FAIL;
- switching equal/value weighting;
- using factor long-short returns as if they were the investable long-only branch;
- blending A/B/C after seeing returns;
- opening later queue candidates after the first PASS;
- changing production from `LEGACY`.
