# Opportunity alpha research — diagnostic closure and next directions

Date: **2026-09-24**

Status: **DIAGNOSTIC ONLY / NO PRODUCTION CHANGE / NO IMPLEMENTATION**

## 1. Why this note exists

The 2021-01-04 -> 2024-01-03 mixed-stock replay exposed a structural concern: non-core REDUCE/EXIT proceeds are normally routed back to the healthy strategic core, while many valid opportunities continue to exist in the scanner.

Before changing production, several counterfactual ideas were tested outside the product using the exported replay, its causal signals, stored historical replay data, and historical price series. No application code or production rule was changed.

## 2. Baseline replay

Mixed initial portfolio:

- initial capital: 23,000 EUR;
- 10 manual non-core positions of 1,000 EUR each;
- 13,000 EUR initial cash;
- 36-month DAILY Custodia replay;
- end date 2024-01-03.

Observed:

- engine final: 27,886.51 EUR;
- engine return: +21.25%;
- engine max drawdown: 25.81%;
- exact hold final: 26,712.01 EUR;
- exact hold return: +16.14%;
- structural global-core benchmark final: 31,585.57 EUR;
- structural global-core return: +37.33%;
- structural global-core max drawdown: 16.90%.

Interpretation:

- the exit/deterioration logic added value versus holding the poor initial basket;
- however, the resulting portfolio did not beat simply allocating the same starting capital to the structural core;
- therefore new opportunity policies must be judged against the core, not merely against cash or the initial basket.

## 3. Counterfactual variants tested and archived

### 3.1 Immediate EXIT/REDUCE -> best currently eligible opportunity

Question:

> When a non-core position releases capital, would routing those proceeds immediately to the best currently valid opportunity improve on routing them to the core?

Diagnostic sample:

- 19 non-core REDUCE/EXIT events;
- 15 events had an evaluable alternative candidate with subsequent historical data;
- candidate chosen using only signal-date information already present in the replay;
- comparison horizon approximately six months;
- comparison benchmark: contemporaneous structural core.

Result:

- 9/15 alternatives beat the contemporaneous core over the diagnostic horizon;
- 6/15 underperformed;
- weighted estimated excess was only about +38.5 EUR on about 7,515 EUR of routed notional;
- approximate weighted advantage: +0.51% before incremental fees/tax;
- dispersion was large: individual cases included substantial wins and substantial underperformance.

Decision:

**ARCHIVED / NO IMPLEMENTATION.**

Reason: the simple routing rule has insufficient and unstable economic edge to justify replacing RETURN_TO_CORE.

### 3.2 Simple same-asset re-entry after a later ENTRY_READY

Question:

> After a full EXIT, should an asset simply be repurchased when it later becomes ENTRY_READY again?

Observed examples were mixed: some later re-entry points worked, others subsequently underperformed materially.

Decision:

**ARCHIVED / NO IMPLEMENTATION.**

Reason: ENTRY_READY by itself is not enough evidence that a previously exited asset will beat the core.

### 3.3 Regime-based retrospective filter

A regime split appeared attractive inside the consumed 2021-2024 diagnostic sample, but contradicted an independent 2024-2025 replay.

Decision:

**ARCHIVED / NO IMPLEMENTATION.**

Reason: clear overfitting risk. Do not create a regime gate from these observed outcomes.

## 4. Main retained conclusion

The next research question is **not**:

> how can more capital be released from the core?

The next research question is:

> what causal evidence distinguishes an opportunity that has a reasonable chance of outperforming the structural core from one that merely looks technically strong versus cash?

This is materially different from QUALITY_V1, SLOPE_V1, CORE_ALPHA_V2 and the immediate-routing counterfactual above.

The structural core remains the hurdle rate.

## 5. New research direction A — CORE_RELATIVE_LEADERSHIP_RESEARCH_V1

This is a research hypothesis, not a policy.

Conceptual basis:

1. cross-sectional momentum / relative strength;
2. long-term trend quality;
3. proximity to historical highs and avoidance of broken long-term structures;
4. optional fundamental acceleration;
5. opportunity measured relative to the structural core, not only relative to cash.

Candidate causal features to investigate:

- 12-1 month return relative to core;
- 6-month return relative to core;
- rolling asset/core relative-strength ratio and its slope;
- price above rising long-term trend;
- medium-term moving-average alignment;
- distance from 52-week high and low;
- volatility-adjusted momentum;
- drawdown/recovery structure;
- revenue/EPS/FCF acceleration when point-in-time fundamentals are available;
- revisions/surprise data only if a causal historical source exists.

No thresholds are frozen in this note. Literature-derived definitions must be separated from parameters inferred from consumed project samples.

## 6. Literature families worth reproducing as research features

### William O'Neil / CAN SLIM

Useful idea: combine fundamental growth, technical strength, general-market context and disciplined risk management rather than using chart momentum alone.

Potential machine-readable components:

- earnings/sales growth;
- relative price strength;
- price/volume accumulation;
- proximity to breakouts/highs;
- broader market confirmation.

### Mark Minervini / SEPA / Trend Template / VCP

Useful idea: only study securities already exhibiting established leadership/trend quality before searching for an entry.

Potential machine-readable components:

- price versus 50/150/200-day averages;
- alignment and slope of long-term averages;
- distance from 52-week high/low;
- relative-strength rank;
- volatility contraction and volume contraction/expansion if a robust quantitative definition can be preregistered.

### Stan Weinstein / Stage Analysis

Useful idea: classify the structural phase before deciding whether a stock is investable.

Potential machine-readable components:

- weekly price relative to 30-week trend;
- slope of the 30-week trend;
- Stage 1/2/3/4 classification;
- Stage 2 leadership and Stage 3/4 deterioration.

### Academic momentum / trend following

Use as the strongest empirical anchor because it is independently testable:

- Jegadeesh & Titman: past winners versus past losers over 3-12 month horizons;
- time-series momentum literature: persistence over roughly 1-12 month horizons;
- long-horizon trend-following evidence across many markets.

These findings support researching robust relative-strength/trend features, but do not prove that any specific stock-selection implementation in Custodia will beat its core.

## 7. New research direction B — OWNERSHIP_CONFIRMATION_RESEARCH_V1

This is also a context hypothesis, not a direct buy/sell policy.

Possible sources:

### SEC Form 13F

Useful for detecting slow institutional sponsorship / accumulation by large US managers.

Limitations:

- holdings are quarterly;
- filings can arrive up to 45 days after quarter end;
- long holdings do not reveal the manager's complete economic exposure, shorts, hedges or exact transaction date;
- therefore 13F is unsuitable as a fast timing trigger.

Potential use:

- candidate discovery;
- slow sponsorship score;
- multi-manager accumulation breadth;
- persistence of ownership over several quarters.

### SEC Form 4 / insider transactions

Potentially more useful for timely confirmation:

- officers/directors/10% owners report most transactions;
- Form 4 is generally due within two business days;
- distinguish open-market purchase code P from grants/options/administrative transactions;
- cluster purchases by several insiders may be more informative than one isolated transaction.

### EU MAR / PDMR transactions

For European issuers, Article 19 notifications by persons discharging managerial responsibilities / closely associated persons are generally due within three working days.

Potential use:

- insider/PDMR open-market purchase confirmation;
- mapping issuer identity to the EUR-listed instrument through the canonical instrument/ISIN layer.

## 8. Data-source hierarchy for ownership research

Preferred authoritative sources:

1. SEC EDGAR structured 13F data sets;
2. SEC structured insider transaction data sets / original Form 4 filings;
3. EU national competent-authority/PDMR disclosures under MAR;
4. aggregators such as DATAROMA or WhaleWisdom only as convenience/discovery layers, never the canonical source if primary filings can be retrieved.

## 9. Proposed research order

Do **not** implement a new allocator first.

1. Build an offline diagnostic table for historical candidates containing core-relative leadership features.
2. Test whether those features separate future core-outperformers from core-underperformers on already-consumed samples; this is feature diagnosis only.
3. Separately test insider/institutional confirmation where historical filing timestamps are available.
4. Freeze a small, interpretable candidate feature set **before** opening any fresh promotion sample.
5. Validate on fresh/blind data.
6. Only if reach and economic edge survive independent confirmation consider integration as a research mode inside the existing PortfolioCandidateGate/PortfolioDecisionEngine chain.
7. Production remains LEGACY until explicit promotion.

## 10. Explicitly not to do

- do not relax CORE_ALPHA_V2 gates retrospectively;
- do not route more core capital into stocks merely because more candidates exist;
- do not use 13F as if it were real-time;
- do not copy famous investors blindly;
- do not tune moving-average lengths or stop percentages on the 2021-2024 replay;
- do not promote chart-pattern rules because they worked on known winners;
- do not create a parallel recommendation engine.

