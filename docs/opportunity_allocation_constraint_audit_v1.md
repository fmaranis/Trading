# Opportunity Allocation Constraint Audit V1

Status date: 2026-09-08.

## Purpose

`QUALITY_ALLOCATION_BRIDGE_V1` technically reached the existing allocator, but across the consumed 10y/6y/3y windows it changed only 2 allocation decisions, 3 executed acquisition dates and 29.89 EUR of absolute executed notional, with 0/3 final-value wins.

The next question is therefore not how to amplify QUALITY. It is:

**Which existing allocator constraints prevent a bounded opportunity-priority difference from reaching actual invested euros?**

This is a diagnostic-only audit. It does not modify production and it does not introduce a new product screen or a parallel engine.

## Existing architecture

The audit reuses:

`AssetUniverseScanner -> PortfolioCandidateGate -> CurrentOpportunityAlertEngine -> PortfolioDecisionEngine -> CORE_ARCHITECTURE_V1 -> execution`.

Production remains `LEGACY`.

The previously frozen bridge remains unchanged:

`qualityMultiplier = clamp(1 + candidateQualityAdjustment(reliability, opportunity)/100, 0.85, 1.15)`.

No coefficient, threshold, cap or gate may be changed as part of this audit.

## Critical replay semantic finding

The historical replay uses `frequency: MONTHLY` as a **decision cadence**.

It is not a recurring-contribution instruction.

At each historical portfolio reconstruction, the current core sets:

`stagedCapitalPlan.availableEur = 0`.

Therefore the allocator does not receive a new monthly external contribution in these runs. `pendingCapitalEur` is normally zero unless an explicit input path supplies additional capital.

This matters because a bounded allocation priority can only affect actual euros when there is deployable capital or rotation proceeds available.

## Frozen protocol

Diagnostic stage:
`ALLOCATION_CONSTRAINT_AUDIT_V1`.

The existing validation result envelope remains:
`OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1`, so the same existing validation button and result UI can be reused.

Historical configuration remains unchanged:
- REAL data only;
- data request from 2014-09-01;
- end fixed at 2026-09-01;
- Yahoo current discovery OFF historically;
- windows 2016-09-01 / 2020-09-01 / 2023-09-01 through 2026-09-01;
- monthly decision cadence;
- initial capital 13,000 EUR;
- MEDIUM risk;
- 3-year horizon;
- `CUSTODIA_ENGINE`;
- historical ECB DFR cash benchmark;
- current replay tax semantics;
- `CORE_ARCHITECTURE_V1`.

Two arms are re-observed only for diagnostic parity:
- `LEGACY`;
- frozen `QUALITY_ALLOCATION_BRIDGE_V1`.

These are already-consumed historical windows. Their economic output cannot promote the bridge and cannot be used for parameter tuning.

## Telemetry layers

The audit separates the allocation chain into distinct constraints.

### 1. Capital availability
Per decision:
- current cash;
- pending external capital;
- target cash;
- deployable-to-assets capital;
- residual planned cash;
- available portfolio slots.

Reported counts include:
- decision gates with `pendingCapitalEur > 0`;
- gates with deployable capital;
- gates with an opportunity;
- gates that have both deployable capital and opportunity but still create no contribution.

### 2. Opportunity-priority reach
The audit recomputes, for telemetry only, the existing LEGACY opportunity priority and the frozen QUALITY-modulated priority.

It reports:
- opportunity observations;
- observations whose multiplier differs from 1;
- decision gates where QUALITY changes relative opportunity order;
- top opportunity under LEGACY vs QUALITY.

This diagnostic computation does not feed the productive decision path.

### 3. Executable-target constraint
For each actual contribution recommendation, the audit distinguishes:
- `TIMING_CAP` — target × Entry Timing fraction is the tighter executable-target limit;
- `STAGE_CAP` — starter/build portfolio-share cap is tighter;
- `TIMING_AND_STAGE_EQUAL`;
- `UNCLASSIFIED`.

This layer answers what constrains the **executable target value**.

### 4. Final-amount constraint
Separately, after executable target is known:
- `TARGET_GAP` — final order reaches the remaining executable target gap;
- `DOWNSTREAM_CAPITAL_OR_CATEGORY_LIMIT` — final order is smaller than that gap because later constraints bind;
- `UNCLASSIFIED`.

This layer answers what constrains the **actual recommended amount** and is deliberately not conflated with timing/stage.

### 5. Plan-to-execution reach
The audit also compares LEGACY vs the frozen bridge for:
- contribution-plan dates changed;
- amount-only vs asset-set changes;
- planned acquisition dates changed;
- executed acquisition dates changed;
- total absolute executed-notional difference;
- decision parity.

## Interpretation contract

This audit can support conclusions such as:
- the main bottleneck is lack of deployable capital;
- timing is the dominant target constraint;
- starter/build stage caps dominate;
- downstream capital/category capacity dominates;
- opportunities exist but minimum/portfolio constraints prevent contributions;
- QUALITY frequently changes opportunity order but execution quantization removes the difference.

It cannot support:
- widening the QUALITY multiplier;
- changing the 0.10/0.20 QUALITY coefficients;
- loosening gates/caps merely to improve the consumed backtest;
- promoting the bridge to production.

If the audit proves that recurring-capital absence is the dominant limitation, the next methodological question must be whether the product/replay should support an **explicit recurring contribution scenario as a replay input**, distinct from decision frequency. That would be a replay capability, not a hidden assumption.

Forward Risk V8 remains separate and is not used in this audit.
