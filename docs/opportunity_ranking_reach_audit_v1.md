# Opportunity Ranking Reach Audit V1

Status date: 2026-09-08.

## Why this audit exists

The completed `OPPORTUNITY_RANKING_CAUSAL_COMPARISON_V1` showed that `QUALITY_V1` and `SLOPE_V1` usually produced the same final portfolio as `LEGACY`.

Observed historical diagnostic outcome:
- LONG_10Y: QUALITY and SLOPE identical to LEGACY;
- MEDIUM_6Y: QUALITY and SLOPE identical to LEGACY;
- RECENT_3Y: QUALITY +291.24 EUR vs LEGACY, SLOPE -275.80 EUR vs LEGACY;
- median final delta across the three windows: 0 EUR for both variants;
- median drawdown improvement: 0 pp for both variants;
- production remains `LEGACY`;
- no coefficient or threshold tuning is allowed on these consumed windows.

This result suggests an architectural question rather than a parameter question: **does ranking information actually reach the downstream portfolio decision?**

## Existing architecture being audited

No new product screen or production engine is created.

The existing chain remains:

`historical REAL prefix -> PortfolioCandidateGate -> selected candidate set -> InvestmentDecisionEngine -> PortfolioDecisionEngine / CORE_ARCHITECTURE_V1 -> execution`.

`QUALITY_V1` and `SLOPE_V1` are ranking-only policies inside `PortfolioCandidateGate`. They are not allowed to change the hard eligibility rules.

The audit therefore measures four successive levels of reach:

1. **Rank reach** — did the relative order of already-ELIGIBLE candidates change?
2. **Selection reach** — did that order change which assets survived the gate's max-selected/category constraints?
3. **Planning reach** — did the downstream engine emit a different BUY/ADD plan?
4. **Execution reach** — did the executed BUY/ADD decisions actually change?

## Frozen audit protocol

Version: `OPPORTUNITY_RANKING_REACH_AUDIT_V1`.

Common configuration is intentionally identical to the consumed ranking comparison:
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

No new thresholds are introduced.

## Critical invariants

### Eligibility parity

Because QUALITY and SLOPE are supposed to be ranking-only, the set of `ELIGIBLE` candidates must be exactly the same as LEGACY at every decision gate.

Any non-zero `eligibleSetParityViolations` invalidates the interpretation and must be treated as an architecture bug.

### Selection competition

A ranking can only change the downstream candidate set when some eligible candidate is excluded by:
- `maxSelected = 12`; or
- the existing per-category cap.

The audit reports `selectionCompetitionDecisionGates` where `eligibleCount > selectedCount`.

If this is rare, a ranking-only adjustment naturally has little economic leverage even when its scores change substantially.

## Reported metrics

Per historical window, LEGACY reports:
- number of gate decisions;
- mean/median eligible candidates;
- mean selected candidates;
- number and percentage of gates with selection competition;
- category-competition gates;
- total eligible candidates excluded by gate selection;
- maximum eligible count.

Each variant vs LEGACY reports:
- eligible-set parity violations;
- decisions where eligible rank order changed;
- decisions where selected order changed;
- decisions where the selected **set** changed;
- rank changes that died before selection because the selected set stayed identical;
- symmetric-difference size of selected sets;
- mean/max absolute rank shift;
- planned BUY/ADD decision dates changed;
- executed BUY/ADD decision dates changed;
- final-value delta;
- return delta;
- drawdown delta;
- samples of selection and acquisition dates that changed.

## Interpretation contract

This is an **architecture reach diagnostic**, not another performance optimization run.

The known comparison outcome is already consumed:
- `QUALITY_V1` remains research-only and informationally interesting but insufficient;
- `SLOPE_V1` is not a promotion candidate in its current form;
- `LEGACY` remains production.

The audit may justify a new architecture hypothesis, but it cannot justify tuning QUALITY/SLOPE coefficients on these same windows.

If the audit confirms that rank changes rarely reach selection or purchases, the next research question should be how an opportunity signal can influence capital **within the existing architecture and under a preregistered rule**, rather than increasing ranking coefficients until historical results improve.

Forward Risk V8 remains separate. Its retained predictive downside information is not used in this audit.
