# Opportunity Quality Allocation Bridge V1

Status date: 2026-09-08.

## Purpose

`OPPORTUNITY_RANKING_REACH_AUDIT_V1` showed that QUALITY information frequently changes ranking and sometimes changes the selected candidate set, but almost never changes executed acquisitions.

Observed QUALITY reach across the three consumed windows:
- 456 gate observations;
- rank order changed in 282;
- selected set changed in 70;
- planned acquisitions changed on 4 dates;
- executed acquisitions changed on only 2 dates;
- eligibility parity violations: 0.

Therefore the next question is not whether to increase ranking coefficients. It is whether the already-frozen QUALITY information can reach **capital allocation** inside the existing portfolio engine.

## Architecture

No new product screen or production engine is created.

The production chain remains:

`AssetUniverseScanner -> PortfolioCandidateGate -> CurrentOpportunityAlertEngine -> PortfolioDecisionEngine -> CORE_ARCHITECTURE_V1 -> execution`.

`PortfolioDecisionEngine` now accepts an optional internal allocation policy:
- `LEGACY` — default and production;
- `QUALITY_ALLOCATION_BRIDGE_V1` — research-only.

All normal callers omit the option and therefore remain `LEGACY`.

The historical diagnostic runner temporarily injects the research policy into the existing engine and restores the original method in `finally` after each run.

## Frozen bridge formula

The bridge reuses the already-existing and already-consumed QUALITY_V1 adjustment:

`candidateQualityAdjustment = (reliability - 50) * 0.10 + (opportunity - 50) * 0.20`

No coefficient is refit.

With reliability/opportunity scores bounded 0..100, the theoretical adjustment range is -15..+15.

The bridge interprets this directly as a percentage modulation of the **existing** opportunity-priority score:

`qualityMultiplier = clamp(1 + candidateQualityAdjustment / 100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

Therefore:
- neutral QUALITY 50/50 -> 1.00x;
- theoretical minimum -> 0.85x;
- theoretical maximum -> 1.15x.

This is intentionally bounded. It does not replace the allocator or create a second sizing engine.

## What remains unchanged

The bridge cannot change:
- REAL-data requirement;
- cash hurdle;
- consensus BUY requirement;
- structural-downtrend rejection;
- Entry Timing WAIT rejection;
- current gate selection policy in this diagnostic (`LEGACY`);
- target cash;
- starter/build semantics;
- timing fractions;
- max asset share;
- max category share;
- portfolio slots;
- minimum meaningful order;
- broker-cost checks;
- rotation persistence/rules;
- tax model;
- `CORE_ARCHITECTURE_V1`.

The only allowed difference is the relative priority used to distribute capital among current opportunities that already pass the existing rules.

## Historical diagnostic protocol

Version:
`OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1`.

Data and replay configuration intentionally match the consumed ranking diagnostics:
- REAL only;
- data request from 2014-09-01;
- fixed end 2026-09-01;
- current Yahoo open discovery disabled historically;
- minimum 30 accepted REAL assets;
- minimum 252 bars;
- monthly decisions;
- 13,000 EUR initial capital;
- MEDIUM risk;
- 3-year horizon;
- `CUSTODIA_ENGINE`;
- historical ECB DFR cash benchmark with floor 0%;
- existing tax semantics;
- `CORE_ARCHITECTURE_V1`.

Windows:
1. LONG_10Y: 2016-09-01 -> 2026-09-01;
2. MEDIUM_6Y: 2020-09-01 -> 2026-09-01;
3. RECENT_3Y: 2023-09-01 -> 2026-09-01.

Arms:
- `LEGACY`;
- `QUALITY_ALLOCATION_BRIDGE_V1`.

Total: 6 local replays.

## Metrics

The diagnostic reports, per window:
- final value / total return / max drawdown;
- fees / tax / cash interest;
- BUY / ADD / REDUCE / EXIT counts;
- structural-core benchmark relation;
- bridge multiplier observations, mean/median/min/max;
- pre-core contribution-plan decision gates changed;
- plan asset-set changes vs amount-only changes;
- planned acquisition dates changed;
- executed acquisition dates changed;
- total absolute executed-notional difference;
- final-value / return / drawdown / fee / tax delta vs LEGACY.

Aggregate reports:
- how often the bridge changes allocation plans;
- how often it changes executed acquisition dates;
- total executed-notional difference;
- final-value wins/losses over the three windows;
- median/worst/best final delta;
- median drawdown change;
- decision-count parity violations.

## Interpretation contract

These historical windows are already consumed. This run is therefore an **architecture/reach diagnostic only**.

It cannot authorize production promotion even if the bridge wins historically.

Rules after reading the result:
- no changing the 0.10 / 0.20 QUALITY coefficients;
- no changing 0.85 / 1.15 bounds to improve these windows;
- no changing cadence, caps or gates in response to these outcomes;
- production remains `LEGACY`;
- a bridge that demonstrates meaningful reach without obvious structural damage may proceed to a fresh future-forward confirmation;
- a bridge that still barely reaches executed capital should be treated as insufficient rather than amplified until it works.

Forward Risk V8 is not used in this bridge. Its retained predictive downside information stays available for a later, separately preregistered hypothesis.
