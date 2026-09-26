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


## 11. CORE_RELATIVE_LEADERSHIP_RESEARCH_V1 — offline diagnostic result (2026-09-25)

No production code was changed.

Simple literature-inspired trend/leadership proxies were evaluated offline against the already-consumed opportunity-routing diagnostic set.

Diagnostic set:

- 15 evaluable opportunity-routing episodes with six-month excess return versus the contemporaneous structural core;
- baseline mean excess of the whole evaluable set: approximately +1.43 pp;
- baseline routing itself was previously rejected because weighted economic improvement was only about +0.51% before incremental costs/tax and dispersion was large.

Results:

- positive 20d + positive 60d trend slopes: 8 observations, mean excess -3.11 pp, median -3.76 pp, only 37.5% beat the core;
- HEALTHY_UPTREND plus positive 20d/60d slopes: same effective subset and same negative result;
- ENTRY_STRONG plus positive 20d/60d slopes: 4 observations, mean excess -4.50 pp, only 25% beat the core;
- positive 20d + positive 60d + positive acceleration (simple strict-trend proxy): 4 observations, mean excess +1.53 pp, median +6.04 pp, 75% beat the core, but this improves the full-set mean by only about +0.10 pp and still contains an approximately -20.92 pp loser.

Independent stored replay cross-checks did not justify promotion either. Strong/trend-selected initial non-core positions were somewhat positive in 2019-2020 and 2024-2025, but samples were tiny and the rule did not consistently improve selection within the 2021-2022 rotation episodes.

Decision:

**ARCHIVED / NO IMPLEMENTATION.**

Interpretation:

- simple absolute trend quality, Stage-2-like structure, or stronger timing labels do not robustly identify candidates that will beat the structural core;
- do not retune moving-average/trend thresholds on these consumed observations;
- the next materially different research direction is an orthogonal information source: fundamentals and/or timestamped ownership/insider evidence, evaluated offline before any product integration.

## 12. OWNERSHIP / INSIDER diagnostic — first offline result (2026-09-25)

No production code was changed.

SEC Form 4 evidence was checked for the U.S. names in/around the consumed sample.

Key findings:

- NVIDIA 2021 CEO filing inspected: acquisition shown was an award/RSU-style transaction, not an open-market purchase;
- AMD 2021 CEO filing inspected: option exercise plus open-market sales under a 10b5-1 plan, not discretionary open-market buying;
- Tesla 2021 CEO filing inspected: option exercise plus sales, not discretionary open-market buying;
- Carvana produced genuine open-market insider purchases (code P) during the 2022 collapse, including 300,000 shares by the CEO at $80 plus an additional 850,000 shares through a trust, later purchases around $21.85, $10 and $7.62.

Interpretation:

- open-market insider buying cannot be a hard opportunity gate: it would miss strong winners that do not show discretionary insider buying, while Carvana demonstrates that insiders can buy materially too early during a severe decline;
- ownership/insider data may remain useful as contextual/contrarian evidence or as a cluster-strength feature, but not as a direct BUY authorization.

Decision:

**HARD INSIDER-BUY GATE ARCHIVED / NO IMPLEMENTATION.**

## 13. FUNDAMENTAL_PROFITABILITY_GUARD — promising diagnostic, not validated

A simple pre-entry profitability split was evaluated on the consumed 2021-2024 mixed-stock basket using only financial information available before entry.

Clearly loss-making / negative operating-profitability names at the start included:

- Carvana: 2020 net loss before tax about $462.5m;
- Delivery Hero: 2020 adjusted EBITDA negative (segments about -EUR567.7m);
- Siemens Energy: FY2020 adjusted EBITA before special items about -EUR17m and adjusted EBITA about -EUR1.543bn.

Those three 1,000 EUR starting positions produced approximately **-550.5 EUR net** combined in the replay.

The remaining seven individual-stock positions, all with positive operating profitability / EBITDA-type measures before entry, produced approximately **+1,438.6 EUR net** combined.

A rough counterfactual that reallocates only those excluded 3,000 EUR to the structural core for the same full window would improve terminal wealth by about **+1,670 EUR**, lifting the replay's approximate terminal return from +21.25% to about **+28.5%**. This is diagnostic only: it does not rerun all portfolio interactions, taxes and later sizing decisions.

Additional observations:

- requiring high revenue growth would not help: it would remove Rheinmetall, the best winner, while retaining several later losers;
- among already-profitable mature candidates, profitability alone does not identify the future winner; its apparent value is mainly **tail-risk exclusion**, not ranking;
- this direction is consistent with the established academic profitability premium (e.g. Novy-Marx; Fama/French RMW), but project-level promotion still requires broader causal validation.

Status:

**PROMISING_DIAGNOSTIC / NO IMPLEMENTATION YET.**

Next test:

- broaden the sample beyond the known 10-stock basket;
- keep the rule literature-derived and simple (positive operating profitability / robust profitability), not tuned to this basket;
- compare filtered vs unfiltered opportunity outcomes against the structural core;
- if the effect survives, freeze a research-only guard before any fresh/blind validation.

## 14. FUNDAMENTAL_PROFITABILITY_GUARD — external fixed-sample validation (2026-09-26)

No production code was changed.

To reduce cherry-picking risk, the profitability hypothesis was tested on an external fixed sample: Nasdaq's published top 20 Nasdaq-100 price performers for calendar 2020 (source list fixed as of 2020-12-31). The test date was 2021-05-03, after the relevant FY2020/FY2021 annual reports were publicly available, with outcome measured to 2022-05-03. QQQ over the same dates was used as market/core proxy for this external diagnostic.

Exact price pairs were obtained for 17 of the 20 names. Three names (PDD, OKTA, TEAM) were excluded from the numerical aggregate because an exact matched price pair was not available from the chosen price source during this run; they were not removed based on outcome.

Profitability definition:

- simple, literature-derived guard: latest published full-year operating income > 0 using GAAP/IFRS reported operating result;
- no margin threshold, growth threshold, or retrospective tuning.

Results for the 17 exactly evaluable names:

- profitable group: 13 names; mean 12-month return **-11.27%**; median **-19.28%**; mean excess vs QQQ **-6.11 pp**; 46.2% beat QQQ;
- unprofitable group: 4 names; mean 12-month return **-31.69%**; median **-41.10%**; mean excess vs QQQ **-26.52 pp**; 25% beat QQQ;
- all 17 names equal-weighted: mean return **-16.08%**;
- applying the simple profitability guard raises the equal-weight mean by about **+4.80 pp** (-16.08% -> -11.27%);
- QQQ itself returned approximately **-5.17%**, so the filtered profitable basket still underperformed the market/core proxy by about **-6.11 pp** on average.

Interpretation:

- the result supports the earlier finding that operating profitability is useful primarily as a **tail-risk / quality guard**;
- it materially separates the loss-making group from the profitable group in this external, non-hand-picked leader sample;
- however, it does **not** create positive alpha versus the core: profitable leaders still underperformed QQQ on average;
- therefore positive operating profitability is not sufficient as an opportunity-selection strategy or core-replacement rule.

Status:

**RETAIN AS PROMISING QUALITY GUARD / NOT SUFFICIENT FOR IMPLEMENTATION OR PROMOTION.**

Next research question:

- combine the profitability guard with a genuinely orthogonal ranking feature that can discriminate among already-profitable companies (for example robust profitability/quality, cash-flow quality, valuation-aware quality, or fundamental acceleration), while continuing to compare every candidate against the structural core;
- do not add arbitrary thresholds based on this consumed sample.
