# Dynamic Core Selector V1

## Purpose

`DYNAMIC_CORE_SELECTOR_V1` removes fixed product preference from the production core-allocation path. Vanguard, EUNL, IWDA, VWCE or another explicitly admitted broad global core must not receive capital merely because its identifier appears first in a hard-coded list.

The selector is causal: it uses only the portfolio and universe scan supplied for the current decision date. Future replay returns are never inspected.

## Eligible core universe

A product may compete for the structural core only when:

1. it is explicitly classified as `STRATEGIC_GROWTH_CORE`;
2. it is `ACCEPTED` by the current causal universe scan;
3. a finite current score and consensus assessment are available.

Regional, sector, thematic and single-stock assets cannot become the structural core through relative-strength ranking.

## Candidate health gate

For each eligible core the selector calculates the existing causal composite used by the portfolio engine:

`composite = candidateScore + 5 × consensusScore + 0.5 × clamp(excessVsCashPctPoints, -20, +20)`

A candidate is considered healthy only when all of the following are true:

- finite composite score;
- no structural downtrend;
- consensus score >= 0;
- current 120-session evidence passes the cash benchmark gate.

## Exact decision tree

```text
Are one or more structural cores already held?
|
+-- NO --> Are healthy core candidates available now?
|          |
|          +-- NO --> select NONE; do not force new capital into a default product
|          |
|          +-- YES -> choose the healthy core with the best causal composite score
|
+-- YES --> Is at least one currently-held core healthy?
           |
           +-- YES -> keep the largest healthy incumbent as core
           |          (inertia; do not chase a temporary better score)
           |
           +-- NO --> Is a healthy alternative available now?
                      |
                      +-- NO --> no forced replacement; no new default-core top-up
                      |
                      +-- YES -> replace the largest unhealthy incumbent with
                                 the best healthy broad-global alternative
```

## Structural transfer

A core-to-core replacement is distinct from tactical rotation. It is created explicitly as:

`[DYNAMIC_CORE_SELECTOR_V1:STRUCTURAL_TRANSFER]`

The existing structural-core protection layer does not cancel this transfer. Ordinary short-term REDUCE/EXIT signals remain blocked for a healthy core.

## New cash and proceeds

- Non-core sales return to the healthy core selected for that decision date.
- Residual investable cash above the profile's operational cash reserve is sent only to that healthy selected core.
- If no healthy core is available, the architecture does not force Vanguard, EUNL or any other product merely to reduce cash.

## Fixed priority array

`STRATEGIC_GROWTH_CORE_PRIORITY` remains only as a deterministic reference fallback for research/diagnostic modules that need one broad-market series when no portfolio decision state exists. It is explicitly deprecated for production allocation.

The productive path is:

`PortfolioDecisionEngine -> CORE_GATE_V1 -> DYNAMIC_CORE_SELECTOR_V1 -> CORE_ARCHITECTURE_V1`

## Known limitations of V1

The current selector compares market evidence, consensus and excess return versus cash. It does not yet include product metadata such as TER, tracking difference, bid/ask liquidity, fund transferability or tax cost as independent scored inputs because those fields are not yet available consistently in the unified catalogue.

Those product-quality dimensions should be added transparently when reliable data are available; they must not be represented by a hidden product priority.
