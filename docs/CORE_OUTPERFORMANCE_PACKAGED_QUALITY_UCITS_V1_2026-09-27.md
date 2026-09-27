# CORE_OUTPERFORMANCE_PACKAGED_QUALITY_UCITS_V1 — preregistration

Date: 2026-09-27

Status: **FROZEN IMPLEMENTATION CANDIDATE / HISTORICAL DIAGNOSTIC NOT BLIND / FUTURE OUTCOMES UNOPENED / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Starting HEAD: `0762c3fbb5fc434634416fb7890312ec9b76b8ac`.

Production remains `LEGACY`.

## Why this branch exists

The external U.S. Operating Profitability family passed its academic diagnostic and temporal confirmation, but:

- the raw 46-stock implementation did not preserve the gross edge in the consumed SimFin bridge;
- the raw market-cap weighting was highly concentrated;
- a 5% issuer cap materially improved the consumed diagnostic but still did not beat SPY;
- whole-share execution of the exact 46-name basket is impractical at normal Custodia sleeve sizes;
- the exact Developed ex-US Big/Robust profitability generalization failed its preregistered both-window gate.

Therefore the next implementation hypothesis is **packaging the related quality/profitability exposure in an existing diversified UCITS ETF** rather than recreating dozens of U.S. stocks directly.

This is a different implementation-policy hypothesis. It does not rewrite the frozen profitability signal studies.

## Ex-ante vehicle-selection criteria

The primary vehicle is selected by methodology and implementation fit, not by retrospective return ranking.

Required:

1. UCITS / PRIIPs-compatible and registered for Spain/EEA retail distribution;
2. explicit U.S. quality/profitability methodology with profitability as a core descriptor;
3. diversified portfolio, not a single-stock or narrow intersection;
4. accumulating share class preferred;
5. physical replication preferred;
6. Ireland/Luxembourg domicile acceptable;
7. EUR trading line preferred to avoid MyInvestor FX conversion commission on the order;
8. TER <= 0.30%;
9. sufficiently established fund/listing and AUM for normal ETF implementation;
10. one-order implementation possible with whole shares.

No past-return ranking across candidate ETFs is permitted to choose the primary vehicle.

## Frozen primary vehicle

**iShares Edge MSCI USA Quality Factor UCITS ETF USD (Acc)**

- ISIN: `IE00BD1F4L37`;
- fund/share-class launch: 2016-10-13;
- UCITS: yes;
- domicile: Ireland;
- income: accumulating;
- replication: physical / replicated;
- TER: 0.20%;
- benchmark: MSCI USA Sector Neutral Quality Net Index;
- holdings: approximately 118 at freeze date;
- registered in Spain;
- preferred execution line: **QDVB / Xetra / EUR**;
- listing date: 2016-10-24.

Methodological reason:

The underlying MSCI USA Sector Neutral Quality Index scores U.S. large/mid-cap securities using:

- high Return on Equity;
- low leverage;
- low earnings variability;

within sector-relative quality selection. Profitability/ROE is therefore a direct core descriptor, while leverage and earnings stability add implementation/risk discipline.

This is not byte-identical to Kenneth French Operating Profitability. It is a **packaged quality/profitability implementation hypothesis**.

## Trading-line fail-closed rule

BlackRock currently states that one listing line of the fund is scheduled for delisting on 2026-12-15 but the public product page does not identify that line in machine-readable text available to this study.

Therefore:

- V1 is frozen to `IE00BD1F4L37` executed through `QDVB` on Xetra in EUR;
- before any real Custodia use, QDVB must be verified active and available through MyInvestor;
- if QDVB is unavailable/delisted, state = `BLOCKED_LISTING_ACCESS`;
- do not silently substitute IUQA USD, IUQF GBP or another exchange after observing outcomes;
- a replacement listing would require a separately documented implementation revision.

Trading in EUR avoids broker FX conversion on the ETF order itself. It does **not** hedge or remove the underlying USD equity currency exposure.

## Historical diagnostic

Historical fund performance has already been incidentally exposed while verifying current product documentation. Consequently any retrospective packaged-vehicle comparison is explicitly:

**POST-SELECTION IMPLEMENTATION_DIAGNOSTIC_ONLY / NOT BLIND / NO PROMOTION AUTHORITY**.

Frozen diagnostic:

- full calendar years 2017-01 through 2025-12;
- vehicle return: official BlackRock NAV total returns for the accumulating share class;
- parent hurdle: SPY total return over the same calendar period;
- global hurdle: URTH total return over the same calendar period;
- report CAGR, total return, annualized volatility where monthly/daily series are reproducible, and drawdown;
- include current TER already embedded in fund NAV;
- do not change start/end dates to improve the result.

A historical PASS cannot promote production because selection/performance information is no longer blind.

## Prospective implementation evidence

Primary clean evidence begins only after this preregistration.

The packaged vehicle can be tracked from the first common tradable session after its executable QDVB line and benchmark start are locked.

Primary endpoint:

- 12 months;
- QDVB/ISIN total return after explicit broker entry/exit commissions;
- compare with the same-cost broad U.S. parent implementation and the structural-core comparator where feasible;
- also report SPY/URTH research benchmarks for continuity.

The study must separate:

1. **factor/signal quality**;
2. **fund tracking/index implementation**;
3. **broker execution economics**;
4. **portfolio sleeve sizing / look-through concentration**.

No automatic promotion to production. `LEGACY` stays default.

## Cost model

For MyInvestor ETF execution use the current ETF schedule, not the U.S.-stock schedule:

- trading commission: 0.12%;
- minimum: EUR 1;
- maximum: EUR 25;
- QDVB EUR line: no broker currency-conversion commission expected for the order;
- spread and exchange/market charges must be reported separately if available.

Do not reuse the stock minimum of EUR 3 for this ETF.

## Prohibited

After outcome access do not:

- switch to another quality ETF because it performed better;
- switch listing currency to improve the observed result;
- change the quality index family;
- add momentum/value filters;
- change the 12-month primary endpoint;
- use the historical implementation diagnostic as fresh evidence;
- modify production from `LEGACY`.

## Source snapshot used for selection

Selection used current product/methodology facts only. Some current and historical performance values were visible incidentally on issuer/search pages during verification; therefore the retrospective arm is deliberately classified non-blind.

- BlackRock/iShares product page for ISIN IE00BD1F4L37.
- MSCI USA Sector Neutral Quality Index methodology/profile.
- MyInvestor current broker tariff.
