# Opportunity Ranking — Causal Comparison V1

Status date: 2026-09-08.

## Purpose

Compare **what to buy** among candidates that are already allowed to buy, without modifying the current production architecture or inventing another decision engine.

The compared policies already exist inside `PortfolioCandidateGate`:
- `LEGACY`;
- `QUALITY_V1`;
- `SLOPE_V1`.

All hard eligibility rules remain identical. The experimental policies may only alter relative ranking among candidates already passing:

`REAL data -> beats cash -> consensus BUY -> no structural downtrend -> EntryTiming != WAIT`.

## Architecture parity

Current replay baseline is `CORE_ARCHITECTURE_V1`.

`replaySelectionQualityExperiment.ts` and `replaySlopeSelectionExperiment.ts` were aligned to that same architecture before running this comparison. They no longer use the older `STRATEGIC_CORE_HOLD_V1` wrapper as their replay baseline.

Therefore the comparison contract is:

`same data + same PortfolioCandidateGate hard gates + same CORE_ARCHITECTURE_V1 + same sizing + same execution + same tax/cash -> ranking policy only`.

No new app screen is created. The job runs in the existing `ResearchValidationCenter`.

## Frozen protocol before results

Version: `OPPORTUNITY_RANKING_CAUSAL_COMPARISON_V1`.

Data request:
- REAL historical data only;
- data load start: 2014-09-01;
- fixed comparison end: 2026-09-01;
- current Yahoo open-market discovery: **disabled** during historical comparison;
- minimum accepted REAL assets: 30;
- minimum bars at replay decision: 252.

Replay windows:
1. `LONG_10Y`: 2016-09-01 -> 2026-09-01;
2. `MEDIUM_6Y`: 2020-09-01 -> 2026-09-01;
3. `RECENT_3Y`: 2023-09-01 -> 2026-09-01.

Common settings:
- monthly decisions;
- initial capital 13,000 EUR;
- risk profile MEDIUM;
- horizon 3 years;
- simulation mode `CUSTODIA_ENGINE`;
- historical ECB deposit-facility cash benchmark with nominal floor 0%;
- fixed-rate fallback 2.5% only where required by the existing interface;
- tax settings: prior savings taxable base 0, context not confirmed;
- production architecture `CORE_ARCHITECTURE_V1`.

Arms:
- `LEGACY`;
- `QUALITY_V1`;
- `SLOPE_V1`.

## Metrics

For each policy/window:
- final value;
- total return;
- CAGR;
- max drawdown;
- fees;
- estimated tax;
- cash interest;
- executed BUY / ADD / REDUCE / EXIT counts;
- material signals;
- structural-core benchmark and excess final value;
- whether structural core was beaten.

Against LEGACY, each experimental arm also reports:
- final-value delta;
- return delta;
- drawdown improvement in percentage points;
- fee delta;
- tax delta;
- symmetric difference in executed BUY/ADD signatures.

Aggregate across the three fixed windows:
- final-value wins vs LEGACY;
- drawdown wins vs LEGACY;
- median final-value delta;
- worst final-value delta;
- median drawdown improvement;
- total acquisition-decision difference.

## Interpretation contract

This is **historical diagnostic evidence**, not a blind promotion gate.

These windows may overlap evidence seen during prior development and the catalogue is the known current catalogue. Therefore:
- no policy may be promoted to production from this result alone;
- production remains `LEGACY` regardless of the historical winner;
- no thresholds may be retuned after reading these results;
- a useful candidate must receive future-forward confirmation before any production proposal;
- current Yahoo discovery cannot be used retrospectively;
- survivorship bias is not fully removed until a point-in-time instrument master includes listings and delistings.

## Forward Risk V8 continuity

V8 is deliberately **not** used in this first ranking comparison. Its retained predictive finding remains important: V8 showed useful ability to anticipate future falls, while V8-V11 economic policies failed to translate that information efficiently.

After the baseline ranking comparison is understood, a separate shadow diagnostic may test whether V8 risk context helps discriminate downside among otherwise eligible/ranked candidates. That would be a new hypothesis and must not silently change the production gate or ranking.
