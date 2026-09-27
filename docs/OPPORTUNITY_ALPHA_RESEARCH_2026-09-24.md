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

## 15. FUNDAMENTAL_QUALITY_ALPHA — external factor evidence (2026-09-26)

No production code was changed.

A materially different quality concept was separated from the project's historical `QUALITY_V1`. The archived project bridge used internal `reliability` and `opportunity` scores. The new research family is **corporate fundamental quality**.

Reference methodology:

- MSCI World Quality ranks securities using high ROE, low Debt/Equity and low five-year year-over-year EPS-growth variability;
- AQR QMJ uses a broader quality family based on profitability, growth, safety and payout.

External benchmark evidence:

- MSCI World Quality annualized gross return since 1994 through 2026: about **12.02%** versus **9.01%** for MSCI World, approximately **+3.01 pp/year**;
- 10-year annualized return: **14.74%** vs **13.29%**;
- 10-year Sharpe: **0.83** vs **0.76**;
- historical maximum drawdown: **48.01%** vs **57.46%** for MSCI World;
- in published annual returns 2012-2025, Quality beat World in **9/14** calendar years with mean annual excess about **+1.92 pp**;
- using only full post-launch calendar years 2014-2025, Quality compounded at about **13.11% CAGR** versus **10.97%** for World.

Momentum cross-check:

- MSCI World Momentum annualized since 1994: about **11.92%** versus **9.01%** for World;
- 10-year annualized: **15.16%** vs **13.29%**;
- however, project diagnostics showed simple momentum/trend filters did not robustly improve opportunity selection, so momentum should remain an entry/timing or secondary ranking input rather than the primary alpha source.

Simple external Quality+Momentum diversification check:

- a deterministic 50/50 annual-rebalanced blend of published MSCI World Quality and MSCI World Momentum annual calendar returns for 2014-2025 compounds at about **13.03% CAGR** versus **10.97%** for MSCI World;
- 10,000 units would grow to roughly **43,478** versus **34,888** for World before fees/tax;
- the blend does not dominate every subperiod: 2021-2024 it slightly lagged World, while Quality alone still beat World over those calendar years.

Multi-factor caution:

- adding factors indiscriminately is not enough: the S&P 500 Quality/Value/Momentum Top-90% index shows only a small 10-year price-return edge (13.65% annualized vs 13.48% for S&P 500 as of 2026-08-31);
- therefore the next project hypothesis should not be 'add value/momentum coefficients until performance improves'.

Retained hypothesis:

**FUNDAMENTAL_QUALITY_SCORE_RESEARCH_V1 = PROMISING EXTERNAL ALPHA FAMILY / NOT YET PROJECT-VALIDATED.**

Proposed offline project translation:

1. keep the already promising positive-operating-profitability guard;
2. among profitable candidates, rank **corporate quality** using causal fundamentals patterned after MSCI: ROE high, Debt/Equity low, earnings variability low;
3. use the existing price/timing engine only for entry timing and execution, not as the source of quality alpha;
4. compare each candidate's subsequent return directly against the structural core;
5. do not tune weights on the consumed 2021-2024 basket; first use literature-defined equal standardized descriptors or an externally defined methodology;
6. only after offline separation is demonstrated freeze a research-only version for fresh/blind confirmation.


## 16. FUNDAMENTAL_QUALITY_SCORE_RESEARCH_V1 — broad external live validation (2026-09-26)

No production code was changed.

The broad-validation question was deliberately narrower than a product backtest:

> Does the same three-descriptor corporate-quality family (high ROE, low leverage, low earnings variability) show a repeatable post-launch advantage across broad live equity universes, or was the encouraging small-sample result likely an isolated accident?

Methodology discipline:

- no score weights or thresholds were changed after observing project samples;
- only full calendar years after each index launch were used for the primary comparison, avoiding pre-launch back-tested history;
- parent-index returns from the same MSCI factsheet were used as the contemporaneous market comparison;
- the attempt to reconstruct a large 2021 point-in-time stock-level panel was not accepted when candidate public fundamental sources could contain later restatements/reported comparatives; coverage was sacrificed rather than introduce lookahead;
- AQR QMJ is used only as independent evidence for the broader quality family, because its definition is broader than the exact MSCI three-descriptor score.

Live/post-launch broad results from published annual returns:

| Universe | Actual calendar years used | Quality CAGR | Parent CAGR | CAGR delta | Years Quality beat parent |
| --- | ---: | ---: | ---: | ---: | ---: |
| MSCI USA Quality | 2013-2025 | 16.17% | 14.85% | +1.31 pp/yr | 8/13 |
| MSCI World Quality | 2013-2025 | 14.17% | 12.16% | +2.02 pp/yr | 9/13 |
| MSCI Europe Quality | 2013-2025 | 8.62% | 8.23% | +0.39 pp/yr | 7/13 |
| MSCI World ex USA Quality | 2015-2025 | 7.62% | 7.44% | +0.18 pp/yr | 7/11 |
| MSCI USA Sector Neutral Quality | 2015-2025 | 12.97% | 13.50% | -0.52 pp/yr | 5/11 |

The 2021-2024 subperiod is also non-uniform:

- USA Quality: about +0.73 pp/year CAGR versus parent;
- World Quality: about +1.16 pp/year;
- Europe Quality: about -2.31 pp/year;
- World ex USA Quality: about -2.25 pp/year;
- USA Sector Neutral Quality: approximately flat versus parent (+0.03 pp/year).

Independent literature cross-check:

- AQR's Quality Minus Junk evidence reports significant historical risk-adjusted returns in the U.S. and internationally, but its score combines profitability, growth, safety and payout and therefore does not validate the exact project formula by itself.

Interpretation:

1. the encouraging project-small-sample result is **not isolated from the broader empirical quality family**;
2. the exact MSCI-style three-descriptor family has meaningful live evidence in USA and World after launch;
3. the effect is **not universal**: recent Europe/ex-USA edges are small or negative over relevant subperiods;
4. the USA sector-neutral version lagged its parent over 2015-2025, so the observed broad-index alpha cannot be assumed to be pure within-sector stock-ranking alpha; sector and concentration exposures may contribute materially;
5. therefore the correct retained claim is not "QUALITY always generates alpha", but that fundamental quality is a credible, externally supported candidate discriminator that still needs project-specific causal validation against the structural core.

Status:

**BROAD EXTERNAL VALIDATION SUPPORTS THE QUALITY FAMILY / PROJECT-SPECIFIC CAUSAL VALIDATION STILL REQUIRED / NO PRODUCTION AUTHORITY.**

Research consequence:

- retain the frozen profitability + ROE / D-E / earnings-variability hypothesis;
- do not tune weights from these results;
- preserve momentum as timing rather than fundamental-quality alpha;
- before any promotion, test the frozen score causally inside the project's opportunity population against the structural core;
- treat raw cross-sectional quality and sector-relative quality as separate research hypotheses if both are studied; do not choose between them retrospectively on the same consumed project sample;
- production remains LEGACY.

## 17. VALUATION_AWARE_QUALITY_RECONSTRUCTION — QARP interaction diagnostic (2026-09-27)

No production code was changed.

This section reconstructs and durably records a promising diagnostic that had been explored in chat but had not been committed: the interaction between the frozen fundamental-quality signal and the valuation paid for that quality.

### 17.1 Fixed external leader sample

Source population:

- Nasdaq's published Top 20 Nasdaq-100 price performers for calendar 2020;
- profitability guard retained from the prior diagnostic: latest published operating result positive;
- 13 profitable names: TSLA, ZM, MELI, JD, NVDA, PYPL, AMD, CDNS, ALGN, IDXX, SNPS, AAPL and AMZN;
- information / valuation date: **2021-05-03**;
- outcome date: **2022-05-03**;
- QQQ total-return proxy over the same dates: approximately **-4.71%**.

Quality reconstruction:

- ROE high is positive;
- Debt/Equity low is positive;
- five-year EPS-growth variability low is positive;
- descriptors are winsorized at 5/95 and standardized by cross-sectional z-score;
- composite uses equal descriptor weight;
- under the contemporaneous MSCI missing-data rule, if EVAR is missing but ROE and D/E are available, the composite is calculated from those two descriptors;
- `HIGH_QUALITY` is the upper half of the reconstructed Quality Z-score distribution;
- no score coefficient or threshold was fitted to subsequent return.

Valuation reconstruction:

- valuation descriptor = historical **earnings yield** available on 2021-05-03;
- after selecting `HIGH_QUALITY`, `CHEAP_OR_REASONABLE` means earnings yield at or above the median earnings yield of that high-quality subgroup;
- `EXPENSIVE` means below that median;
- this median split is deterministic and was declared before recalculating the outcomes in this reconstruction.

Results inside the `HIGH_QUALITY` subgroup:

| Valuation branch | Names | N | Mean 12m return | Mean excess vs QQQ | Median 12m return | Median excess vs QQQ | Beat QQQ |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CHEAP_OR_REASONABLE | PYPL, CDNS, SNPS, AAPL | 4 | **-1.67%** | **+3.04 pp** | **+18.64%** | **+23.35 pp** | **3/4** |
| EXPENSIVE | ZM, ALGN, IDXX | 3 | **-45.85%** | **-41.14 pp** | **-49.81%** | **-45.10 pp** | **0/3** |

Important negative control:

- valuation by itself is not enough;
- across all 13 profitable names, the cheap half was only about **-0.51 pp** versus QQQ on mean excess;
- several lower-quality expensive names (notably TSLA and NVDA) still performed strongly;
- therefore the retained hypothesis is **an interaction between quality and valuation**, not a universal cheap-stock rule.

Interpretation:

- the prior failure of pure Quality ranking is materially explained by expensive high-quality names;
- the observed separation is consistent with a QARP / valuation-aware-quality hypothesis: good business quality can fail economically when too much of that quality is already embedded in price;
- this sample is fully consumed for promotion and is only diagnostic.

### 17.2 Independent fixed-size cross-check

A second sample was selected independently of 2020 winner performance: the largest distinct Nasdaq-100 issuers by index weight reported on **2020-12-14**.

Distinct issuers evaluated:

AAPL, MSFT, AMZN, TSLA, META/FB, GOOGL, NVDA, PYPL and ADBE.

The same 2021-05-03 information date, 2022-05-03 outcome date, Quality construction and within-high-quality median earnings-yield split were used.

Results:

| Valuation branch | Names | N | Mean 12m return | Mean excess vs QQQ | Median excess vs QQQ | Beat QQQ |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| CHEAP_OR_REASONABLE high Quality | AAPL, META, GOOGL | 3 | **-4.36%** | **+0.35 pp** | **+4.86 pp** | **2/3** |
| EXPENSIVE high Quality | PYPL, ADBE | 2 | **-42.02%** | **-37.31 pp** | **-37.31 pp** | **0/2** |

Interpretation of the cross-check:

- the second sample reproduces the **directional penalty of expensive Quality**;
- it does **not** demonstrate a robust positive alpha for cheap Quality: the mean edge is only about +0.35 pp in this tiny independent sample;
- therefore the correct status is promising interaction evidence, not validation or promotion.

Status:

**VALUATION_AWARE_QUALITY / PROMISING DIAGNOSTIC INTERACTION / BROAD POINT-IN-TIME STOCK-LEVEL CONFIRMATION REQUIRED / NO PRODUCTION AUTHORITY.**

Next required test:

1. keep the fundamental Quality construction fixed;
2. keep valuation as a separate orthogonal descriptor rather than retuning Quality weights;
3. use a broad point-in-time stock population with filing-date-safe fundamentals;
4. measure high-Quality cheap/reasonable vs high-Quality expensive directly against the contemporaneous structural core;
5. do not choose the valuation metric or cut after opening the new outcomes;
6. only after a broad offline separation is demonstrated freeze a research-only candidate for fresh/blind confirmation.

### 17.3 Research continuity safeguard

From this point forward, any research result that creates a materially new retained hypothesis or a promising directional separation must be committed **before moving to the next test**.

The durable record must contain, at minimum:

- hypothesis / signal name;
- exact frozen definition used in that test;
- causal information date and outcome horizon;
- sample definition and exclusions;
- raw or sufficiently reconstructible group membership;
- aggregate result versus structural core;
- consumed/fresh status;
- what the result does and does not establish;
- exact next test.

A promising but incomplete result must be marked explicitly as `PROMISING_DIAGNOSTIC_UNCONFIRMED`; it must not remain only in chat memory.


## 18. BROAD_PIT_QUALITY_X_VALUATION_V1 — frozen execution protocol (2026-09-27)

The broad stock-level confirmation job is now integrated and preregistered.

- job: `fundamental-quality-valuation-broad-pit-v1`;
- UI label: `Fundamental Quality × valoración · validación PIT amplia`;
- protocol: `scripts/fundamentalQualityValuationBroadPitV1Protocol.ts`;
- runner: `scripts/fundamentalQualityValuationBroadPitV1Live.ts`;
- guard: `tests/fundamentalQualityValuationBroadPitV1.unit.ts`;
- pre-run seal: `validation-runs/preregistration/fundamental-quality-valuation-broad-pit-v1-seal.json`.

Frozen data architecture:

1. historical S&P 500 membership on 2021-05-03 from EODHD historical index components;
2. CIK mapping from SEC;
3. SEC EDGAR companyfacts constrained to `filed <= 2021-05-03`;
4. positive causal annual operating income guard;
5. Quality = high ROE + low D/E + low five-year EPS-growth variability, equal standardized descriptors and 5/95 winsorization;
6. high Quality = upper half of the evaluable profitable cross-section;
7. valuation = causal annual earnings yield from published annual net income / causal market capitalization on 2021-05-03;
8. cheap/reasonable vs expensive = within-high-Quality median earnings yield;
9. adjusted Yahoo REAL return to 2022-05-03;
10. frozen benchmarks = SPY plus URTH/MSCI World USD proxy.

Coverage gates were frozen before opening the new broad sample: >=400 historical members, >=350 CIK mappings, >=250 profitable/evaluable rows, >=100 high-Quality rows and >=40 rows per valuation branch. Failure of any gate returns `INCONCLUSIVE_*`; there is no synthetic or current-discovery fallback.

The SEC implementation is intentionally treated as a **provider-independent causal translation**, not a byte-identical reproduction of the earlier Wolfram descriptors.

The diagnostic verdict can support or reject the interaction hypothesis, but **cannot authorize production promotion**. A positive result would justify freezing a research-only project translation for later fresh/blind confirmation; a negative result must not be retuned on this sample.

Current state: **SEALED / LOCAL GUARDS AND TYPESCRIPT PASS / LIVE ATTEMPT BLOCKED BEFORE DATA BY MISSING EODHD_API_KEY**. See section 20 for the controlling completion audit and other absent prerequisites.


## 19. FUNDAMENTAL_QUALITY × VALUATION — broad external replication R1 (2021-05-03 -> 2022-05-03)

No production code was changed.

A broad external replication was reported outside the app runtime. **Audit qualification: its row-level fundamental/filing and branch-membership evidence is incomplete, so it is not verified strict PIT confirmation; section 20 governs interpretation.**

Frozen translation used before opening outcomes:

- historical S&P 500 population from the May-2021 constituent snapshot: 506 names;
- conservative FY2020-only fundamentals;
- operating income > 0 guard;
- Quality = high ROE + low D/E + low five-year EPS-growth variability;
- 5/95 winsorization and equal cross-sectional z-score descriptors;
- high Quality = score >= median;
- valuation = FY2020 diluted EPS / raw close on 2021-05-03;
- cheap/reasonable vs expensive = median earnings yield within high Quality;
- adjusted outcomes to 2022-05-03;
- benchmarks frozen in advance: SPY and URTH.

Coverage:

- 379 profitable/evaluable names;
- 323 with all three Quality descriptors;
- 190 high-Quality names;
- 185 with usable valuation/outcome data.

Results:

| Branch | N | Mean return | Median return | Mean excess vs SPY | Beat SPY | Mean excess vs URTH | Beat URTH |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| High Quality + cheap/reasonable | 93 | +0.47% | +4.01% | **-0.41 pp** | 54.8% | **+3.63 pp** | 60.2% |
| High Quality + expensive | 92 | -2.71% | -5.41% | **-3.59 pp** | 39.1% | **+0.45 pp** | 46.7% |

Interaction:

- cheap/reasonable minus expensive mean return = **+3.18 pp**;
- Spearman earnings-yield vs subsequent return = **+0.119**;
- approximate Welch t = **1.02**;
- Cohen d = **0.15**.

Predeclared valuation quartile control:

- most-expensive quartile: mean return **-7.61%**, **-8.49 pp vs SPY**, **-4.45 pp vs URTH**;
- Q2: +2.19%;
- Q3: -0.08%;
- cheapest quartile: +1.02%.

Interpretation:

- the broad sample reproduces the directional advantage of cheaper high-Quality over expensive high-Quality;
- it does **not** pass the full alpha gate because cheap/reasonable does not have positive mean excess versus SPY;
- the strongest retained finding is the concentrated penalty in the **most-expensive high-Quality quartile**;
- this is evidence for a possible valuation guard, not a validated alpha engine;
- the 2021-2022 sample is consumed and must not be used to choose/tune a production threshold.

Verdict:

**FAIL_FULL_ALPHA_GATE / PARTIAL_SUPPORT_EXPENSIVE_QUALITY_PENALTY / NO PRODUCTION AUTHORITY.**

Durable evidence:

- `validation-runs/diagnostics/fundamental-quality-valuation-external-2021-result.json`;
- four raw outcome chunks under `validation-runs/diagnostics/fundamental-quality-valuation-external-2021-chunk-0*.json`.

### 19.1 R2 temporal confirmation preregistered before outcomes

R2 was sealed before opening any 2022-2023 outcomes:

- information date: 2022-05-03;
- outcome date: 2023-05-03;
- historical S&P 500 May-2022 population;
- FY2021 fundamentals only;
- identical Quality construction;
- identical median valuation split;
- primary gate unchanged;
- secondary, explicitly frozen diagnostic: whether the most-expensive high-Quality quartile again underperforms the remaining 75% and both SPY and URTH.

Seal:

`validation-runs/preregistration/fundamental-quality-valuation-external-r2-seal.json`

State corrected by repository audit on 2026-09-27: **PARTIALLY_OPENED / CONSUMED_FOR_BLIND_CLAIMS / INCOMPLETE_EVIDENCE**. Three committed R2 outcome chunks already contain 150 rows of the declared 198. The pre-open seal remains unchanged as a historical record, but R2 cannot now be represented as unopened. This audit does not fetch or calculate further R2 outcomes.

## 20. Strict PIT completion audit — 2026-09-27

**Controlling status: STRICT PIT VALIDATION INCOMPLETE. External R1 reports FAIL; it is not a completed run of FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1.**

Audited main: `6075b5eb43fe909d1fdf68945262829fd6e2e8da`. The following qualifications govern the external claims in section 19. Original evidence is retained without alteration. No production code, sealed protocol, weights, thresholds, dates, or source definitions changed.

### Coverage before interpretation

| Stage | Count | Audit status |
| --- | ---: | --- |
| Historical members | 506 | Reported; original membership snapshot not preserved in these evidence files |
| Profitable/evaluable | 379 | Reported; underlying fundamentals and filing dates absent |
| HIGH_QUALITY | 190 | Reported classification; 190 distinct tickers verified in raw chunks |
| Usable endpoint pairs | 185 | Recomputed; 97.368421% of the 190 stored tickers |
| Cheap/reasonable with outcomes | 93 | Reported; per-ticker frozen branch labels absent |
| Expensive with outcomes | 92 | Reported; per-ticker frozen branch labels absent |

No duplicate tickers. Missing pairs are APTV, BLK, INFO, KSU and LH. Missing outcomes are not zero returns. A high completion rate alone does not establish unbiased coverage of delistings or correct corporate-action treatment.

### Exact reported branch results and independent arithmetic checks

These values are preserved from the external result JSON. Benchmark subtraction and the pooled mean/hit counts reconcile with stored endpoint returns; branch membership, branch medians and PIT fundamentals cannot be independently reconstructed from the committed evidence.

| Metric | Cheap/reasonable | Expensive |
| --- | ---: | ---: |
| N | 93 | 92 |
| Mean return, % | 0.4727960314 | -2.7078741275 |
| Median return, % | 4.0132845904 | -5.4091725465 |
| Mean excess vs SPY, pp | -0.4110522769 | -3.5917224358 |
| Median excess vs SPY, pp | 3.1294362821 | -6.2930208548 |
| Mean excess vs URTH, pp | 3.6314514434 | 0.4507812845 |
| Median excess vs URTH, pp | 7.1719400024 | -2.2505171345 |
| Hit rate vs SPY, % | 54.8387096774 | 39.1304347826 |
| Hit rate vs URTH, % | 60.2150537634 | 46.7391304348 |

Reported SPY return is 0.8838483083%; reported URTH return is -3.1586554120%. Their original endpoint pairs are not in the four stock chunks. Excess return here is an arithmetic benchmark difference, not a risk-adjusted alpha estimate.

The reported full directional gate fails **two** conditions: cheap/reasonable does not beat SPY on average, and expensive is not negative versus URTH. The within-HIGH_QUALITY spread is 3.1806701589 pp; it does not establish incremental QUALITY × valuation interaction by itself.

Across all 185 stored endpoint pairs, independently recomputed mean return is -1.1089426422%, median -0.7375249299%, sample standard deviation 21.1655058673 pp, tenth percentile -26.7683072004%, worst -64.9889998199%, and 94/185 (50.8108108108%) have negative endpoint returns. These are pooled endpoint diagnostics, not branch-specific dispersion, annualized volatility or path drawdown. Daily paths and branch labels are missing, so those requested risk measures remain unavailable.

### Causality and negative controls

- **Strict PIT:** a FY2020 label does not prove publication by 2021-05-03 or exclude later restatements. The external result describes SimFin-derived data from different snapshots but preserves no row-level publication/revision evidence. Causality is unverified, not proven false.
- **Frozen implementation:** external diluted EPS/raw close differs from the sealed SEC net-income/(raw close × causal shares) definition. Wolfram external prices are not a completed run through the sealed Yahoo REAL path. Do not silently substitute either.
- **QUALITY alone:** no lower-quality comparison panel is preserved. A pooled high-quality return alone cannot estimate the quality effect.
- **Value alone:** no full-universe earnings-yield/outcome panel is preserved. The small Nasdaq control cannot establish this control for the broad S&P sample.
- **Interaction:** cheap minus expensive within HIGH_QUALITY is a conditional valuation spread. Separating incremental interaction requires the lower-quality valuation cells on a comparable valuation definition, without changing the frozen primary split or retrospectively selecting a favorable control.
- **Runner scope:** the sealed runner fetches valuation/outcomes only for HIGH_QUALITY. Even a successful run would need a separate, explicitly diagnostic lower-quality control dataset to answer the requested value-alone question. The sealed runner is left intact.

### Execution and concrete blocker

Executed on the audited HEAD:

- frozen Quality × valuation guard and Git-blob seal: PASS;
- core architecture guard: PASS;
- historical instrument master guard: PASS;
- validation runtime guard: PASS;
- full `npm run lint` / `tsc --noEmit`: PASS;
- stored-evidence audit and arithmetic reconciliation: PASS.

The guards used `node --import tsx` because the tsx CLI's IPC socket was unavailable in this runtime. Dependencies installed locally with `npm install --package-lock=false --ignore-scripts --no-audit --no-fund` after `npm ci` rejected missing optional-platform entries in the existing lockfile; no manifests/lockfiles changed.

After guards and TypeScript, the **unmodified** live runner was invoked and stopped before any experiment data call with `FUNDAMENTAL_QUALITY_VALUATION_EODHD_API_KEY_REQUIRED`. Environment presence checks also found `SEC_EDGAR_USER_AGENT` and `GITHUB_REPLAY_SYNC_TOKEN` absent. No secrets were printed, no placeholders substituted, and no fail-closed prerequisite bypassed. The replay-results branch was inspected and contained no Quality × valuation result to recover.

Next necessary action is to make the existing runner's three prerequisites available securely to the execution runtime, or recover an authentic complete already-run evidence package. This is an access/evidence blocker, not a request for the user to run the validation center. Completion requires preserving historical membership, causal fundamentals with publication/accession lineage, frozen scores and valuation labels **before** outcomes, exact benchmark/stock price dates and missingness, and the lower-quality diagnostic controls. R1 remains consumed; any completed rerun is a reconstruction, not fresh confirmation. Do not label the already partially opened R2 as blind. No new test/window or V2 is selected from these outcomes.

Reproducible audit: `python scripts/auditFundamentalQualityValuationEvidence.py`.

Machine-readable result: `validation-runs/diagnostics/fundamental-quality-valuation-evidence-audit-2026-09-27.json` (source SHA-256, seal fingerprints, exact metrics and unavailable controls).

**Conclusion:** the preserved external result reports FAIL of the full alpha gate; strict PIT confirmation remains incomplete and cannot authorize improved alpha or production promotion. LEGACY remains the default.


## 21. Siguiente implementación autorizada — momentum relativo (2026-09-27)

Plan: `docs/CORE_OUTPERFORMANCE_RESEARCH_PLAN_2026-09-27.md`. Estado: PLAN / NO RESULTS / NO PRODUCTION CHANGE.

Investigar una réplica compradora del momentum académico meses 2–12, mensual, separando señal y traducción económica en Custodia. Primero inventario y sello, después diagnóstico externo de bajo coste, luego réplica accionable y confirmación sólo si los gates previos justifican continuar. No reinterpretar los 15 episodios de pendientes 20/60d como rechazo de toda esta familia.

El usuario prioriza pocos tokens: scripts deterministas, caché/checkpoints, resultados agregados, sin subagentes/Actions ni rejillas de parámetros. El plan fija paradas por FAIL o bloqueo y exige comparación neta/riesgo contra core y parent, stress de costes e incertidumbre. No se ha ejecutado ninguna prueba de rentabilidad al crear este documento. Las fechas y fuentes operativas deberán sellarse antes de outcomes; no se ha declarado ninguna muestra fresh sin auditar consumo.

La investigación Quality × valoración mantiene el estado de §20. No cambiar su protocolo ni producción para implementar esta línea.


## 22. CORE_OUTPERFORMANCE_MOMENTUM_REFERENCE_V1 — Stage B outcome (2026-09-27)

No production code was changed.

Primary hypothesis executed:

- long-only winner decile;
- monthly prior 12-2 momentum;
- value-weighted;
- no alternative lookback, decile, timing filter or regime variant after opening the result.

Diagnostic window:

- 2016-01 -> 2021-12;
- 72 months;
- role: diagnostic / consumed.

Reserved confirmation:

- 2009-01 -> 2014-12;
- 2015 full separation year;
- **not opened** because the diagnostic failed.

Result:

| Series | Total return | CAGR |
| --- | ---: | ---: |
| Winner momentum decile | +152.33% | **16.68%** |
| French/CRSP US market | +163.38% | **17.52%** |
| URTH global proxy | +122.06% | **14.22%** |
| SPY cross-check | +163.85% | **17.55%** |

Primary Stage B gate:

- excess CAGR vs US parent = **-0.84 pp/year**;
- excess CAGR vs URTH = **+2.46 pp/year**;
- required: positive versus both;
- verdict: **FAIL_DIAGNOSTIC**.

Interpretation:

- the published winner momentum decile did beat the global URTH proxy over this diagnostic window;
- it did **not** beat its US parent market, which is the stronger like-for-like hurdle for this external replication;
- therefore this exact primary replica does not justify proceeding to the actionable Custodia implementation under the frozen plan;
- this does not erase the broader academic momentum premium, but it rejects the specific claim needed here: that this frozen long-only winner-decile construction clears both core hurdles in the selected diagnostic window.

Stop decision:

**STOP_PRIMARY_REPLICA_NO_VARIANTS / NO ETAPA C / NO CONFIRMATION OPEN / NO PRODUCTION CHANGE.**

Evidence:

- `docs/CORE_OUTPERFORMANCE_MOMENTUM_V1_EXECUTION_2026-09-27.md`;
- `docs/CORE_OUTPERFORMANCE_SAMPLE_REGISTRY_2026-09-27.md`;
- `scripts/coreOutperformanceMomentumDiagnosticV1.mjs`;
- `validation-runs/diagnostics/core-outperformance-momentum-v1-input.json`;
- `validation-runs/diagnostics/core-outperformance-momentum-v1-result.json`.

Sequencing caveat:

- window choices were explicitly stated before outcome calculation in the working chat;
- however, the repository-level preregistration seal was not committed before outcome access;
- therefore this is **not claimed as a valid pre-open preregistered confirmation**;
- because the diagnostic gate already failed, opening another window to recover a PASS would contradict the anti-retuning/stop rule.

Production remains `LEGACY`.


## 23. CORE_OUTPERFORMANCE_PROFITABILITY_V1 — external signal PASS + PIT translation frozen (2026-09-27)

No production code was changed. Production remains `LEGACY`.

A finite factor queue was preregistered before opening candidate returns:

1. Operating Profitability top decile, value-weighted;
2. high book-to-market × high operating profitability;
3. high operating profitability × low investment.

The sequential rule required stopping the queue at the first PASS. Candidate A passed, so Candidates B/C remain unopened and were not used to improve the observed result.

### External diagnostic — 2016-01 -> 2021-12

Frozen construction: Kenneth French Operating Profitability `Hi 10`, value-weighted, long-only.

| Series | Total return | CAGR |
| --- | ---: | ---: |
| Operating Profitability Hi 10 | +210.74% | **20.80%** |
| US parent | +163.38% | **17.52%** |
| URTH proxy | +122.06% | **14.22%** |

Excess CAGR:

- vs US parent: **+3.28 pp/year**;
- vs URTH: **+6.58 pp/year**.

Monthly-path diagnostics were not worse in drawdown: candidate -19.47% vs US parent -20.21%, with return/vol ratio 1.315 vs 1.145. These are monthly diagnostics, not the project's required daily-risk promotion gate.

Verdict: **PASS_EXTERNAL_DIAGNOSTIC_CANDIDATE**.

### Preregistered temporal confirmation — 2009-01 -> 2014-12

The exact same candidate and weighting were retained. The window, sources and gate were committed before opening Candidate A returns for this period.

| Series | Total return | CAGR |
| --- | ---: | ---: |
| Operating Profitability Hi 10 | +173.22% | **18.24%** |
| US parent | +166.09% | **17.72%** |
| Developed-global market | +117.42% | **13.82%** |

Excess CAGR:

- vs US parent: **+0.52 pp/year**;
- vs developed global market: **+4.42 pp/year**.

Candidate monthly-path max drawdown was -13.19% vs -17.70% for US parent and -20.41% for developed global.

Verdict: **PASS_CONFIRMATION_SIGNAL_ONLY**.

This is evidence that the long-only high-operating-profitability family deserves an actionable translation. It is not yet evidence that Custodia can capture the same edge after execution frictions and Spanish taxation.

### Stock-level actionable translation — Stage C1

Frozen protocol:

- `docs/CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1_PREREGISTRATION_2026-09-27.md`;
- `scripts/coreOutperformanceProfitabilityPitV1Protocol.mjs`;
- `scripts/coreOutperformanceProfitabilityPitV1Live.mjs`;
- `tests/coreOutperformanceProfitabilityPitV1.unit.mjs`;
- seal: `validation-runs/preregistration/core-outperformance-profitability-pit-v1-seal.json`.

Key semantics:

- reconstructed historical S&P 500 membership from a pinned/versioned static source;
- SEC CompanyFacts with `filed <= signalDate`;
- strict causal operating-profitability translation `(Revenue - COGS - SG&A - Interest) / positive BookEquity`;
- top decile, value-weighted by causal market cap;
- annual June formation and `NEXT_OPEN`;
- SPY + URTH hurdles;
- selected missing/delisted outcome => inconclusive, never survivor renormalization;
- no momentum, value, sector, regime or stop overlay;
- no synthetic fallback.

Pre-outcome technical correction: share-class Yahoo aliases (`BRK.B`, `BF.B`) were frozen and the Git-blob seal was regenerated before any stock outcome access. No methodology or threshold changed.

Current execution status: **BLOCKED_DATA_ACCESS / STOCK OUTCOMES NOT OPENED** because `SEC_EDGAR_USER_AGENT` is absent in the available runtime. This runner no longer requires EODHD or a GitHub replay token: historical membership uses the pinned public static reconstruction. The blocker is therefore narrower than the older Quality × valuation runner.

Machine-readable preflight:

- `validation-runs/diagnostics/core-outperformance-profitability-pit-v1-preflight-2026-09-27.json`.

Next allowed action: run the **unchanged sealed Stage C1** once a valid SEC EDGAR User-Agent is available to the execution runtime. A Stage C1 PASS would allow the existing Custodia costs/tax harness; a FAIL closes this translation without retuning. No production authority.


## 24. Profitability future-forward V1 — fresh prospective implementation sample (2026-09-27)

The strict historical stock-level translation in §23 remains blocked before outcomes by the missing SEC EDGAR User-Agent in this execution runtime. That block is preserved; no provider without filing-date causality is substituted into the sealed PIT study.

To obtain independent evidence without consuming another retrospective window, a separate prospective study was frozen **before its future price outcomes**:

`CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1`.

### Frozen snapshot

- date: 2026-09-27;
- current S&P 500 members from Wolfram: **500**;
- Company entities mapped: **500**;
- evaluable rows: **451**;
- selected top decile: **46**;
- frozen proxy: `TotalRevenue × OperatingMargin / positive StockholdersEquity`;
- value-weighted by current market capitalization;
- no sector neutralization, value overlay, momentum, trend, Forward Risk or timing filter;
- future price outcomes: **UNOPENED**.

The proxy is deliberately labeled an implementation proxy. It is not byte-identical to the Kenneth French operating-profitability definition and does not replace the pending SEC filing-date PIT reconstruction.

### Frozen outcome protocol

Start = first common tradable session after 2026-09-27.

- ~3 months: descriptive only;
- ~6 months: descriptive only;
- 12 months: primary endpoint;
- primary PASS requires basket total return > SPY **and** > URTH;
- 100% selected-symbol outcome coverage required; missing/delisted securities make the endpoint inconclusive rather than silently renormalizing survivors.

Pre-outcome evaluator, test and Git-blob seal are committed. Verification status: **PASS_PRE_OUTCOME_GUARDS**.

### Concentration discovered before outcomes

The exact market-cap-weighted top-decile replication is internally concentrated:

| Item | Weight |
| --- | ---: |
| NVDA | 34.27% |
| AAPL | 31.42% |
| LLY | 7.03% |
| Top 5 | 78.81% |
| Top 10 | 87.22% |

HHI = 0.2252; effective number of positions ≈ 4.44.

This observation does not authorize changing V1. The exact snapshot remains frozen so the prospective test is not retrofitted. Before any future Custodia integration, a separate implementation guard must quantify look-through overlap with the structural core, because the core itself already embeds major US megacaps.

### External live implementation evidence

High-profitability products provide a useful reality check but are not exact strategy replicas.

- Dimensional U.S. High Relative Profitability Portfolio (DURPX), inception 2017-05-16: through 2025-12-31, since-inception before-tax annualized return **14.48%** versus **14.55%** for Russell 1000.
- Dimensional US High Profitability ETF (DUHP), inception 2022-02-23: through 2025-12-31, since-inception before-tax annualized return **13.49%** versus **14.63%** for Russell 1000.

The implementation evidence therefore argues against assuming that the academic profitability premium transfers automatically through real portfolio construction, expenses, turnover and tax. It does **not** reject the frozen French Hi-10 result or the future-forward Custodia hypothesis because those constructions differ.

Machine-readable evidence:

- `validation-runs/diagnostics/core-outperformance-profitability-live-implementation-evidence-2026-09-27.json`;
- `validation-runs/diagnostics/core-outperformance-profitability-future-forward-v1-risk-audit.json`;
- `validation-runs/diagnostics/core-outperformance-profitability-future-forward-v1-verification-2026-09-27.json`.

Production remains `LEGACY`. No production authority is created by this prospective snapshot.


### Pre-integration look-through audit

Before any future outcome and without changing the frozen V1 weights, current official holdings of the structural-core candidates were compared with the frozen profitability basket.

The profitability basket has NVDA at 34.275% and AAPL at 31.424%. Current core candidates carry roughly 4.77–5.66% NVDA and 4.24–5.41% AAPL. If the entire existing non-core budget were filled by profitability, a simplified core+sleeve scenario would put NVDA+AAPL together at roughly 19–21% of total capital for LOW, 23–25% for MEDIUM and 29–30% for HIGH.

As a non-retrospective implementation reference, the already-existing Custodia BUILD caps are 6% / 8% / 12% per direct asset for LOW / MEDIUM / HIGH. Reusing those existing limits as a look-through reference makes NVDA the binding exposure. Depending on which structural core is selected, the implied upper bound for the profitability sleeve is approximately:

- LOW: **1.19–4.18%**;
- MEDIUM: **8.18–10.96%**;
- HIGH: **22.16–24.51%**.

These are not new optimized weights and do not modify the future-forward basket. They are risk-capacity diagnostics. Full integration must still resolve all selected-name overlaps and any other sleeves/holdings.

Evidence: `validation-runs/diagnostics/core-outperformance-profitability-look-through-audit-2026-09-27.json`.

Decision: the existing 18%/25%/35% maximum non-core budget must **not** be interpreted as an authorized profitability allocation. Signal validation and portfolio sizing remain separate. Production stays `LEGACY`.


### Start-capture readiness and secondary PIT source audit

The first expected U.S. session after the Sunday 2026-09-27 snapshot is Monday 2026-09-28. The official NYSE 2026 holiday calendar shows no closure on that date. The start capturer does not rely on the calendar assumption alone: it searches for the first date on or after 2026-09-28 with a valid adjusted open for all 46 frozen names plus SPY and URTH.

Frozen start semantics:

- completed session only;
- adjusted open = raw open × adjusted close / raw close on the same session;
- 100% selected-symbol + benchmark coverage;
- no survivor renormalization;
- no fallback symbol or later hand-picked date.

Artifacts:

- `scripts/coreOutperformanceProfitabilityFutureForwardV1Start.mjs`;
- `tests/coreOutperformanceProfitabilityFutureForwardV1Start.unit.mjs`;
- `validation-runs/preregistration/core-outperformance-profitability-future-forward-v1-start-seal.json`;
- `validation-runs/diagnostics/core-outperformance-profitability-future-forward-v1-start-verification-2026-09-27.json`.

Local unit guard and Git-blob fingerprint verification both pass. Future prices remain unopened.

A secondary historical-source audit also searched for a causal alternative to SEC. A versioned modern SimFin mirror exposes 3,863 tickers and the required income/balance fields with publication dates but only spans report dates 2019-06-30 through 2024-04-30. An older SimFin research snapshot demonstrably contains 45,645 merged rows, 69 columns, publication dates, Total Equity and observations back to 2009, but the full rows are committed only as a pandas pickle that this runtime cannot materialize. The frozen Stage C1 window is therefore **not shortened or stitched across heterogeneous snapshots**.

Evidence: `validation-runs/diagnostics/core-outperformance-profitability-pit-secondary-source-audit-2026-09-27.json`.

Strict SEC PIT remains `BLOCKED_DATA_ACCESS`; this is not an economic FAIL. Production remains `LEGACY`.


### SimFin causal stock-level bridge V1

A secondary causal stock-level translation was preregistered before opening price outcomes:

`CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1`.

It used reconstructed historical S&P 500 membership, versioned SimFin quarterly statements with publication dates, a strict four-quarter profitability numerator, positive equity, top-decile selection, causal market-cap weighting and NEXT_OPEN-style adjusted-open endpoints. No zero-imputation, Operating Income fallback, equal weighting or sector exclusion was permitted.

Coverage inherited from Stage C1 passed before prices. The 2020 and 2021 periods had 100% selected-price coverage. The 2022 formation selected CTXS, but Citrix became private after its 30-09-2022 acquisition. A listed adjusted-open therefore does not exist for the required 03-07-2023 endpoint.

Because V1 had frozen a 100% listed-price endpoint rule, the correct status is:

**INCONCLUSIVE_PRICE_OR_COVERAGE**

—not FAIL and not PASS.

The known $104/share cash merger consideration is not inserted retrospectively into V1. A corporate-action-aware replay can be designed as infrastructure, but this already-opened window cannot validate or promote that amended accounting policy.

Artifacts:

- `docs/CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1_2026-09-27.md`;
- `validation-runs/preregistration/core-outperformance-profitability-simfin-bridge-v1-input.json`;
- `validation-runs/preregistration/core-outperformance-profitability-simfin-bridge-v1-seal.json`;
- `validation-runs/diagnostics/core-outperformance-profitability-simfin-bridge-v1-prices.json`;
- `validation-runs/diagnostics/core-outperformance-profitability-simfin-bridge-v1-result.json`.

The strict SEC PIT remains blocked but unopened. The fresh prospective future-forward V1 remains the independent path. Production stays `LEGACY`.


### Post-hoc delisting-aware diagnostic — direct profitability translation

After `CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1` was already closed INCONCLUSIVE because CTXS had no listed 2023 endpoint, a **non-promotable architecture diagnostic** inserted the subsequently known USD 104/share merger cash consideration for CTXS. No reinvestment or cash interest was credited.

This accounting rule was defined after the CTXS outcome became known. Therefore the result is consumed-sample diagnosis only.

| 2020-07-01 -> 2024-07-01 | Total return | CAGR |
| --- | ---: | ---: |
| Direct profitability stock basket | +68.53% | **13.94%** |
| SPY | +87.03% | **16.94%** |
| URTH | +71.18% | **14.38%** |

Post-hoc excess CAGR:

- vs SPY: **-3.01 pp/year**;
- vs URTH: **-0.44 pp/year**.

The direct value-weighted implementation was also highly concentrated. AMZN carried roughly 50.3%, 45.9%, 42.0% and 36.7% of the candidate portfolio in the four annual periods.

Interpretation:

- retain the distinction between **signal quality** and **policy quality**;
- the external French Operating Profitability signal remains a positive signal result;
- this direct S&P 500 / strict TTM / top-decile / value-weight stock construction did **not** preserve the gross edge in this consumed implementation window;
- do not rescue it with new equity floors, caps, deciles, sector exclusions or alternative formulas on 2020-2024.

Evidence:
`validation-runs/diagnostics/core-outperformance-profitability-simfin-bridge-v1-posthoc-result.json`.

A new policy must be frozen before new outcomes. Production remains `LEGACY`.


### Capped profitability policy V1 — pre-outcome policy arm

The exact 46-name `CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1` signal was retained unchanged while a separate policy arm froze an externally grounded **5% issuer cap** before future outcomes.

The cap redistributes excess weight pro rata among the remaining frozen base weights. It does not change membership, score, ranking or signal.

Pre-outcome concentration changed from effective N ≈ 4.44 in the raw value-weighted basket to **28.80**, with max issuer weight 5%, top-5 25% and top-10 ≈49.39%.

A cross-application on the already-consumed SimFin 2020-2024 bridge is architecture diagnosis only:

| 2020-07 -> 2024-07 | CAGR |
| --- | ---: |
| Raw direct profitability | 13.94% |
| 5% capped policy | **16.47%** |
| SPY | **16.94%** |
| URTH | 14.38% |

The cap improved the raw translation by **+2.53 pp/year** and exceeded URTH by **+2.08 pp/year**, but remained **-0.48 pp/year versus SPY**. No cap, score, decile or membership is retuned on this consumed sample.

Evidence:
`validation-runs/diagnostics/core-outperformance-profitability-capped-policy-historical-cross-diagnostic-2026-09-27.json`.

The clean test remains the sealed future-forward capped arm with outcomes unopened.

### Profitability × value future-forward V1 — exact Candidate B translation

Candidate B had been frozen before Candidate A outcomes as a high-profitability × high-book-to-market 5×5 intersection. Its historical Candidate B returns remain unopened. A prospective translation was therefore allowed without rescuing Candidate A retrospectively.

Snapshot 2026-09-27:

- 500 S&P 500 members;
- 451 evaluable;
- OP top quintile = 91;
- BM top quintile = 91;
- exact intersection = **1 security: CHTR**;
- CHTR OP rank 41, BM rank 10;
- signal-replica weight = **100%**;
- effective N = 1.

The protocol explicitly forbids widening quintiles, neighboring-cell blends or rank-sum rescue after observing the cross-section. Therefore the signal snapshot is retained, but it is **not diversified enough for a Custodia policy**. Even a future 12m benchmark PASS cannot remove the concentration block by itself.

Artifacts:
- `docs/CORE_OUTPERFORMANCE_PROFITABILITY_VALUE_FUTURE_FORWARD_V1_2026-09-27.md`;
- `validation-runs/preregistration/core-outperformance-profitability-value-future-forward-v1-snapshot.json`;
- `validation-runs/preregistration/core-outperformance-profitability-value-future-forward-v1-seal.json`.

Production remains `LEGACY`.
