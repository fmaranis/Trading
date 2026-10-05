# TimesFM Allocation Bridge V1 — post-hoc architecture diagnostic

Date: 2026-10-05  
Status: **POST-HOC / CONSUMED SAMPLE / NO PROMOTION AUTHORITY**

## Why this exists

`TIMESFM_RELATIVE_RANK_V1` produced `NO_ECONOMIC_REACH` on the already-consumed Stage B historical sample: 15/15 scenarios had identical executed-trade signatures and zero final-value difference versus LEGACY.

Code review found an architectural reason:
- the CandidateGate often retained the full 9-instrument Stage B panel;
- CurrentOpportunityAlertEngine sorts level/timing before ranking;
- PortfolioDecisionEngine's economic priority remained LEGACY;
- therefore TimesFM ranking had almost no authority over which row consumed scarce slots or deployable cash.

This bridge is a **materially different architecture hypothesis**, not a parameter retune.

## Frozen intervention

Candidate arm:
- CandidateGate eligibility: unchanged;
- CandidateGate ranking metadata: `TIMESFM_RELATIVE_RANK_V1`;
- allocator queue: `TIMESFM_ALLOCATION_BRIDGE_V1`.

TimesFM rank decides only **queue order** among already-eligible opportunities:
1. rotation pairing keeps first priority where already required by canonical replay;
2. then lower `timesFmRelativeRankPosition` first;
3. then existing ranking score;
4. then stable assetId.

The existing LEGACY opportunity-priority formula still computes priority magnitudes and target sizing. This bridge does not introduce a multiplier, threshold, fitted coefficient or return cut-off.

## Unchanged controls

No change to:
- eligibility gates;
- BUY consensus;
- EntryTiming;
- target cash;
- starter/build fractions;
- asset/category caps;
- number-of-position limits;
- minimum notional / whole-share feasibility;
- commissions;
- tax;
- rotations' health/persistence rules;
- NEXT_OPEN;
- external-flow accounting.

## Historical diagnostic

Same 31 Stage B information dates and same 15 capital/risk scenarios as the closed V1 economic diagnostic.

Because the bridge was designed **after observing NO_ECONOMIC_REACH on this same sample**, every result is post-hoc architecture evidence only. Even a very positive result cannot validate or promote the policy.

The purpose is narrower:
- does the signal reach execution when given explicit queue-order authority?
- what historical money/drawdown trade-off would that create?
- is it worth carrying this architecture into the fresh prospective sample?

Production remains LEGACY.
