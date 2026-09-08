# Opportunity Ranking Reach Audit V1

Status date: 2026-09-08.

## Why this audit exists

The completed `OPPORTUNITY_RANKING_CAUSAL_COMPARISON_V1` showed that `QUALITY_V1` and `SLOPE_V1` usually produced the same final portfolio as `LEGACY`.

Observed historical comparison outcome:
- LONG_10Y: QUALITY and SLOPE identical to LEGACY;
- MEDIUM_6Y: QUALITY and SLOPE identical to LEGACY;
- RECENT_3Y: QUALITY +291.24 EUR vs LEGACY, SLOPE -275.80 EUR vs LEGACY;
- median final delta across the three windows: 0 EUR for both variants;
- median drawdown improvement: 0 pp for both variants;
- production remains `LEGACY`;
- no coefficient or threshold tuning is allowed on these consumed windows.

This suggested an architectural question rather than a parameter question: **does ranking information actually reach the downstream portfolio decision?**

## Existing architecture audited

No new product screen or production engine was created.

The existing chain remained:

`historical REAL prefix -> PortfolioCandidateGate -> selected candidate set -> InvestmentDecisionEngine -> PortfolioDecisionEngine / CORE_ARCHITECTURE_V1 -> execution`.

`QUALITY_V1` and `SLOPE_V1` are ranking-only policies inside `PortfolioCandidateGate`. They were not allowed to change the hard eligibility rules.

The audit measured four successive levels of reach:
1. rank reach;
2. selection reach;
3. planning reach;
4. execution reach.

## Frozen audit protocol

Version: `OPPORTUNITY_RANKING_REACH_AUDIT_V1`.

Common configuration:
- REAL data only;
- data request from 2014-09-01;
- fixed end 2026-09-01;
- current Yahoo discovery disabled historically;
- minimum 30 accepted REAL assets;
- minimum 252 bars;
- monthly decisions;
- initial capital 13,000 EUR;
- MEDIUM risk;
- 3-year horizon;
- `CUSTODIA_ENGINE`;
- historical ECB DFR cash benchmark, floor 0%;
- current replay tax semantics;
- production architecture `CORE_ARCHITECTURE_V1`.

Windows:
1. 2016-09-01 -> 2026-09-01;
2. 2020-09-01 -> 2026-09-01;
3. 2023-09-01 -> 2026-09-01.

Policies:
- `LEGACY`;
- `QUALITY_V1`;
- `SLOPE_V1`.

No new thresholds were introduced.

## Observed result

Local job completed technically with:
`PASS_REACH_DIAGNOSTIC_ONLY`.

Data quality:
- canonical catalogue: 64;
- scanned: 64;
- accepted REAL: 60;
- rejected: 4;
- accepted provenance REAL: 60/60;
- current Yahoo discovery used historically: false;
- current discovery leak count: 0.

### LEGACY competition

Across the three overlapping windows:
- decision-gate observations: **456**;
- gates with selection competition: **292 / 456 = 64.04%**;
- gates with category competition: **292**;
- total excluded eligible slots: **1,695**.

By window:
- LONG_10Y: 144/240 gates with competition = 60.0%; mean 10.0 eligible, mean 6.58 selected, max eligible 31;
- MEDIUM_6Y: 94/144 = 65.28%; mean 11.39 eligible, mean 7.55 selected, max eligible 29;
- RECENT_3Y: 54/72 = 75.0%; mean 12.97 eligible, mean 8.50 selected, max eligible 29.

Therefore ranking did have substantial opportunity to affect the selected candidate set. The low economic effect was **not** caused by a universal absence of candidate competition.

### QUALITY_V1 reach

Across the three windows:
- eligibility parity violations: **0**;
- rank-order changed gates: **282 / 456**;
- selected-set changed gates: **70 / 456**;
- rank changed while selected set stayed identical: **212**;
- planned acquisition decision dates changed: **4**;
- executed acquisition decision dates changed: **2**;
- median final-value delta vs LEGACY: **0 EUR**;
- worst final-value delta vs LEGACY: **0 EUR**;
- median drawdown improvement: **0 pp**.

The key conversion ratios are:
- selected-set reach after a rank change: 70/282 = **24.82%**;
- executed-acquisition reach after a selected-set change: 2/70 = **2.86%**;
- executed-acquisition reach across all audited gate observations: 2/456 = **0.44%**.

In LONG_10Y and MEDIUM_6Y, QUALITY changed rank and selected sets repeatedly but changed **zero** planned or executed acquisition dates and produced exactly the same economic result as LEGACY.

Only RECENT_3Y reached execution:
- rank changes: 56;
- selected-set changes: 11;
- planned acquisition dates changed: 4;
- executed acquisition dates changed: 2;
- final delta vs LEGACY: +291.24 EUR;
- drawdown change: -0.0578 pp (slightly worse).

### SLOPE_V1 reach

Across the three windows:
- eligibility parity violations: **0**;
- rank-order changed gates: **316 / 456**;
- selected-set changed gates: **98 / 456**;
- rank changed while selected set stayed identical: **218**;
- planned acquisition decision dates changed: **6**;
- executed acquisition decision dates changed: **3**;
- median final-value delta vs LEGACY: **0 EUR**;
- worst final-value delta vs LEGACY: **-275.80 EUR**;
- median drawdown improvement: **0 pp**.

SLOPE reaches the selected set somewhat more often than QUALITY but still almost never reaches actual executed acquisitions. When it did in RECENT_3Y, the economic result was worse than LEGACY.

## Architectural finding

The audit confirms that the main bottleneck is **downstream of candidate selection**.

`PortfolioCandidateGate` can substantially reorder and even change the selected set, but `PortfolioDecisionEngine` subsequently constructs current opportunities and allocates capital using its own opportunity-priority function based on:
- opportunity level;
- consensus score;
- excess return vs cash;
- volatility;
- starter/build rules;
- timing fraction;
- category/asset caps;
- portfolio slots;
- execution minimums;
- rotation constraints.

The frozen QUALITY reliability/opportunity information is carried in `CurrentOpportunityAlert`, but the legacy capital-priority formula does not use those fields directly.

### Exact downstream re-gating mechanism

A code-path review after the reach audit identified the specific reason upstream selected-set changes have so little effect:

1. `PortfolioCandidateGate.apply` creates `gatedScan` by replacing `selected` and `dataset`, but retains the original `scan.candidates` array.
2. `PortfolioDecisionEngine` receives that gated scan.
3. It then calls `CurrentOpportunityAlertEngine.evaluate(scan, cashBenchmarkAnnualPct)`.
4. `CurrentOpportunityAlertEngine.evaluate` calls `PortfolioCandidateGate.apply(scan, cashBenchmarkAnnualPct, 1000, selectionPolicy)`; the default `selectionPolicy` is `LEGACY`.
5. Because the downstream call works again from `scan.candidates` with `maxSelected=1000`, the opportunity allocator can again see essentially all candidates that pass the hard gates, rather than being limited to the upstream top-12 selected set.

This is not a hard-gate bypass: cash, consensus and timing are re-applied. But it means that an upstream ranking-only change to the top-12 set is largely **not the final economic priority surface** used for capital allocation.

That mechanism explains why QUALITY could change 70 selected sets while changing only two executed-acquisition dates.

Therefore increasing the ranking coefficient would be the wrong response. The evidence supports testing whether the already-frozen QUALITY signal can influence **capital priority among already-eligible opportunities**, under a bounded preregistered rule inside the existing allocator.

## Closed interpretation

- `LEGACY` remains production.
- `QUALITY_V1` remains research-only; no QUALITY_V1.1 or coefficient tuning on these windows.
- `SLOPE_V1` is not a promotion candidate in its current form; no SLOPE_V1.1 tuning on these windows.
- The next architecture hypothesis is `QUALITY_ALLOCATION_BRIDGE_V1` inside the existing `PortfolioDecisionEngine`.
- The bridge must not change hard gates, cash, consensus, timing, slots, starter/build caps or rotation policy.
- Historical runs on these same windows are architecture diagnostics only and cannot authorize production promotion.
- Any promotion requires fresh future-forward evidence.

Forward Risk V8 remains separate. Its retained predictive downside information is not used in this allocation bridge phase.
