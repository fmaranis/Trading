# TimesFM Direct Selector V1 — historical diagnostic and prospective shadow

Date: 2026-10-05  
Status: **DIRECT SELECTOR FROZEN BEFORE FIRST PROSPECTIVE ANCHOR / HISTORICAL TEST POST-HOC ONLY**

## Why

The Stage B predictive signal passed, but both `TIMESFM_RELATIVE_RANK_V1` and `TIMESFM_ALLOCATION_BRIDGE_V1` produced zero economic reach. The reason is architectural: TimesFM remained subordinate to the existing app decision chain and therefore did not actually decide the portfolio.

This experiment answers a simpler question:

> If TimesFM itself chooses the asset, does that choice produce a better portfolio than the existing app and the structural core?

## Direct selection rule

Policy: `TIMESFM_DIRECT_SELECTOR_V1`.

At every information date:

1. candidate pool = the eight frozen Stage B assets plus structural core `EUNL`;
2. each Stage B candidate uses its causal TimesFM forecast relative to EUNL at 20 and 60 sessions;
3. EUNL has relative forecast `0% / 0%` by definition;
4. rank all nine instruments independently at 20 and 60 sessions;
5. compute the mean ordinal rank;
6. lowest mean ordinal rank wins;
7. exact rank ties use the higher arithmetic mean of the two TimesFM relative forecasts;
8. final deterministic tie uses assetId.

No LEGACY score, consensus, momentum threshold, cash hurdle or EntryTiming is allowed to choose the asset in this arm.

## Portfolio semantics

The selected winner targets 100% of executable shadow equity.

When the winner changes:
- the canonical replay exits the previous winner;
- buys the new winner;
- execution remains after signal / NEXT_OPEN;
- whole-share feasibility remains;
- broker commissions remain;
- Spanish tax reserve remains;
- residual cash remains and continues its causal cash remuneration.

When the winner is unchanged, the replay keeps it and may deploy executable residual cash.

This is implemented as a **research-only option inside the canonical DynamicHistoricalReplayEngine**, not as a parallel engine.

## Three arms

1. **LEGACY app** — unchanged `CORE_ARCHITECTURE_V1`.
2. **TimesFM direct** — `TIMESFM_DIRECT_SELECTOR_V1`.
3. **Core direct** — always choose EUNL using the same direct execution path.

The comparison therefore separates:
- the app's existing decision quality;
- TimesFM's own selection quality;
- passive structural core.

## Historical diagnostic

Historical dates are the already-consumed 31 Stage B information dates from 2018-Q1 to 2025-Q3. This result cannot promote anything.

The diagnostic reports:
- exact TimesFM selected asset for every date;
- selection counts and number of winner changes;
- final value and return;
- drawdown;
- fees and estimated tax;
- TimesFM excess versus LEGACY;
- TimesFM excess versus direct EUNL core;
- scenario counts across the same 5 capital bands × 3 risk profiles.

## Prospective use

The same selector is frozen now, before the first prospective anchor.

Every future weekly TimesFM anchor will persist the selected asset before outcomes exist. This creates a genuine blind shadow portfolio that can later be compared against:
- the app's live/shadow LEGACY decisions;
- EUNL core.

Production remains LEGACY. TimesFM direct has no order-placement authority.
