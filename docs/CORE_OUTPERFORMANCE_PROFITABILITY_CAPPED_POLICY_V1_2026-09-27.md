# CORE_OUTPERFORMANCE_PROFITABILITY_CAPPED_POLICY_V1

Date: 2026-09-27

Status: **PREREGISTERED PRE-OUTCOME / SAME SIGNAL / POLICY TRANSLATION ONLY / NO PRODUCTION AUTHORITY**

Production remains `LEGACY`.

## Why this policy exists

`CORE_OUTPERFORMANCE_PROFITABILITY_V1` passed its external diagnostic and temporal confirmation, but the exact future-forward value-weighted implementation is highly concentrated:

- NVDA 34.27%;
- AAPL 31.42%;
- top 5 78.81%;
- effective N about 4.44.

When combined with the structural core, that concentration materially limits the economically usable sleeve. On the already-consumed confirmation sample, the resulting MEDIUM sleeve only had roughly 5–7 bps/year gross portfolio-level margin before costs.

This is a **policy problem**, not a signal failure.

## Frozen change

Signal membership is unchanged:

- same 46 securities;
- same profitability formula;
- same ranking;
- same snapshot date;
- no security is added or removed.

Only portfolio weighting changes.

### 5% issuer cap

Starting from the frozen market-cap weights:

1. any security above 5% is set to 5%;
2. its excess weight is redistributed pro rata to the remaining uncapped securities using their frozen base weights;
3. repeat until no security exceeds 5%.

This cap was selected **before future outcomes** because the published MSCI Quality methodology caps issuers at 5% for Quality indexes based on broad parent indexes specifically to mitigate concentration risk. It is used here only as an external concentration-governance precedent; this policy is not claimed to replicate the MSCI Quality signal or weighting formula.

Reference:
https://www.msci.com/indexes/documents/methodology/2_MSCI_Quality_Indexes_Methodology_20220519.pdf

## Frozen concentration result

- selected: 46;
- capped names: 9;
- maximum policy weight: 5.00%;
- top 5: 25.00%;
- top 10: 49.39%;
- HHI: 0.034721;
- effective number of positions: 28.80.

The already-audited broad global cores have maximum single-name weights below about 5.7%. Therefore a convex combination of such a core and a sleeve whose every issuer is <=5% cannot increase any overlapping issuer above the maximum of the two components. This removes the specific NVDA/AAPL look-through capacity bottleneck relative to Custodia's existing 6% LOW / 8% MEDIUM / 12% HIGH BUILD caps.

This does **not** authorize any production allocation. Other policy constraints, costs, taxes, broker execution and future evidence remain required.

## Outcome protocol

This arm reuses the exact same price observations as `CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1`.

- start: same first common tradable session;
- 3m: descriptive only;
- 6m: descriptive only;
- 12m: primary;
- primary PASS: capped basket > SPY and > URTH;
- selected outcome coverage must be 100%;
- no survivor renormalization;
- no change to weights after the snapshot.

The raw value-weighted V1 remains unchanged and will be reported alongside this policy arm. The two answer different questions:

- raw V1: does the frozen signal replica work?
- capped policy V1: can the same signal be implemented with materially better diversification?

No production authority.
