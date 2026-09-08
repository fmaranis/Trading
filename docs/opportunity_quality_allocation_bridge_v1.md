# Opportunity Quality Allocation Bridge V1

Status date: 2026-09-08.

## Purpose and architecture

`OPPORTUNITY_RANKING_REACH_AUDIT_V1` showed that QUALITY information often changes ranking and sometimes the selected set, but almost never reaches executed acquisitions.

The bridge therefore tested a different hypothesis **inside the existing `PortfolioDecisionEngine`**. No new product screen or production engine was created.

Production remains:

`AssetUniverseScanner -> PortfolioCandidateGate -> CurrentOpportunityAlertEngine -> PortfolioDecisionEngine -> CORE_ARCHITECTURE_V1 -> execution`.

Allocation policies:
- `LEGACY` — default and production;
- `QUALITY_ALLOCATION_BRIDGE_V1` — research-only.

All normal callers omit the research option and remain `LEGACY`.

## Frozen formula

The bridge reused, without retuning, the already-consumed QUALITY adjustment:

`candidateQualityAdjustment = (reliability - 50) * 0.10 + (opportunity - 50) * 0.20`

and translated it into a bounded capital-priority multiplier:

`qualityMultiplier = clamp(1 + candidateQualityAdjustment / 100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

The bridge could not change hard gates, cash target, consensus, Entry Timing, starter/build caps, asset/category caps, slots, order minimums, rotation rules, tax semantics or `CORE_ARCHITECTURE_V1`.

## Historical diagnostic protocol consumed

Version:
`OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1`.

Configuration:
- REAL only;
- data request from 2014-09-01;
- end fixed at 2026-09-01;
- Yahoo current discovery OFF historically;
- three windows: 10y / 6y / 3y;
- monthly **decision cadence**;
- initial capital 13,000 EUR;
- MEDIUM risk;
- 3-year horizon;
- `CUSTODIA_ENGINE`;
- historical ECB DFR cash;
- current replay tax semantics;
- `CORE_ARCHITECTURE_V1`.

Important semantic correction discovered after the run:
**MONTHLY means monthly decision cadence, not a recurring monthly external contribution.**
The historical portfolio builder currently sets:
`stagedCapitalPlan.availableEur = 0`.
Therefore `pendingCapitalEur` is normally zero in these replays unless another input path explicitly supplies external capital.

## Consumed result

Technical result:
`PASS_HISTORICAL_ARCHITECTURE_DIAGNOSTIC_ONLY`.

Data quality:
- catalogue 64;
- scanned 64;
- accepted REAL 60;
- rejected 4;
- provenance REAL-only;
- Yahoo current discovery historical leak: 0;
- decision-count parity violations: 0.

### LONG_10Y
- LEGACY and bridge economically identical;
- final value: **40,365.34 EUR**;
- return: **210.50%**;
- DD: **31.83%**;
- changed allocation gates: 0;
- planned acquisition dates changed: 0;
- executed acquisition dates changed: 0;
- final delta: **0 EUR**.

### MEDIUM_6Y
- LEGACY final: **26,992.46 EUR**;
- bridge final: **26,991.42 EUR**;
- changed allocation gates: 1, amount-only;
- planned acquisition dates changed: 2;
- executed acquisition dates changed: 2;
- total absolute executed-notional difference: **25.61 EUR**;
- final delta: **-1.04 EUR**;
- return delta: **-0.0080 pp**;
- DD change: effectively zero/slightly worse.

### RECENT_3Y
- LEGACY final: **20,779.26 EUR**;
- bridge final: **20,776.92 EUR**;
- changed allocation gates: 1, amount-only;
- planned acquisition dates changed: 4;
- executed acquisition dates changed: 1;
- total absolute executed-notional difference: **4.28 EUR**;
- final delta: **-2.35 EUR**;
- return delta: **-0.0180 pp**;
- DD improvement: only **+0.0036 pp**.

## Aggregate conclusion

Across the three windows:
- allocation-plan decision gates changed: **2**;
- asset-set changes: **0**;
- amount-only changes: **2**;
- planned acquisition dates changed: **6**;
- executed acquisition dates changed: **3**;
- total absolute executed-notional difference: **29.89 EUR**;
- final-value wins: **0/3**;
- losses: **2/3**;
- ties: **1/3**;
- median final delta: **-1.04 EUR**;
- worst final delta: **-2.35 EUR**;
- median DD improvement: **0 pp**.

Closed verdict:
**TECHNICAL_PASS / REACH_INSUFFICIENT / NO_PROMOTION**.

The bridge demonstrably reaches the allocator, but its economic leverage in these replays is negligible. It must **not** be amplified by widening 0.85x–1.15x or changing QUALITY coefficients after seeing these outcomes.

## Structural interpretation

Two separate compression mechanisms are now known:

1. `CurrentOpportunityAlertEngine` re-gates the full `scan.candidates` set with `maxSelected=1000` and LEGACY, so upstream top-12 ordering does not directly determine the allocator universe.
2. Even after QUALITY reaches the allocator, the historical replay provides no recurring external monthly capital (`stagedCapitalPlan.availableEur = 0`) and the final contribution is further constrained by timing, starter/build stage caps, current position gap, category capacity, cash availability, order minimums and whole-share execution.

Therefore the next step is **not another QUALITY parameter variant**. It is an allocation-constraint audit that measures where capital is actually being compressed.

## Next diagnostic

`ALLOCATION_CONSTRAINT_AUDIT_V1` reuses the same validation button and the same frozen bridge; no new UI or productive engine is created.

It separately reports:
- whether the executable target is limited by `TIMING_CAP` or `STAGE_CAP`;
- whether the final amount reaches the target gap or is limited downstream by capital/category constraints;
- decision gates with deployable cash;
- decision gates with positive `pendingCapitalEur`;
- opportunities present vs actual contribution plans;
- deployable-capital utilization;
- QUALITY-induced opportunity-order changes;
- plan-to-execution compression.

This audit changes no production policy and cannot authorize promotion.

Forward Risk V8 remains separate and its retained predictive downside information is not used here.
