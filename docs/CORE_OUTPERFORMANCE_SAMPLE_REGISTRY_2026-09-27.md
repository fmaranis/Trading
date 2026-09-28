# Core outperformance research — sample registry

Date: 2026-09-27

Purpose: prevent old windows from being relabeled as fresh and preserve unopened reserves.

## Previously consumed / outcome-accessed windows visible in canonical project state

- 2001-2003 — Phase 5 first blind.
- 2005-2007 — Phase 5 confirmation.
- 2019-2020 — stored replay cross-check used in leadership diagnostics.
- 2021-2024 — Opportunity Alpha mixed-stock replay and routing diagnostics.
- 2021-05-03 -> 2022-05-03 — profitability / fundamental Quality / valuation diagnostics.
- 2024-2025 — stored replay cross-check used in leadership diagnostics.
- 2026 onward — prospective F6/F7 collectors according to their own frozen protocols.

These windows remain consumed for the questions already asked on them.

## CORE_OUTPERFORMANCE_MOMENTUM_REFERENCE_V1

### Diagnostic

- 2016-01 -> 2021-12.
- 72 monthly observations.
- role: **DIAGNOSTIC_CONSUMED**.
- opened on 2026-09-27.
- family: winner decile formed on prior 12-2 return, value-weighted.
- result: **FAIL_DIAGNOSTIC**.

### Confirmation reserve

- 2009-01 -> 2014-12.
- 72 months.
- 2015 is the separation year.
- role: **RESERVED_UNOPENED** at closure of the study.
- no returns from this reserve were opened for this study because the diagnostic gate failed.

No claim is made that this reserve is globally pristine for every conceivable future research question; the statement is narrower: no explicit prior use was found in the canonical state/docs reviewed for this exact momentum confirmation before the diagnostic, and it remained unopened by this study.

## Rule

A failed diagnostic cannot be rescued by opening the reserve, changing dates, trying another decile, another lookback or adding filters. A materially different future hypothesis requires a new documented design and independent evidence.


## CORE_OUTPERFORMANCE_PROFITABILITY_V1

### Diagnostic

- 2016-01 -> 2021-12.
- 72 monthly observations from the frozen French Operating Profitability `Hi 10` value-weighted portfolio.
- role: **DIAGNOSTIC_CONSUMED**.
- result: **PASS_EXTERNAL_DIAGNOSTIC_CANDIDATE**.
- CAGR 20.799498% vs US parent 17.516112% and URTH 14.220895%.

### Temporal confirmation

- 2009-01 -> 2014-12.
- 72 monthly observations.
- 2015 kept as the full separation year.
- role: **CONFIRMATION_OPENED_CONSUMED**.
- opened only after the diagnostic PASS and after the confirmation rule/source/window were committed.
- result: **PASS_CONFIRMATION_SIGNAL_ONLY**.
- CAGR 18.236493% vs US parent 17.716654% and developed-global market 13.819653%.

This window had remained unopened by the failed momentum study and was subsequently reassigned to this materially different profitability hypothesis. It is no longer an unopened reserve for future historical confirmation claims.

### Actionable PIT translation

- 2016-06 -> 2021-06 annual formations.
- role: **IMPLEMENTATION_TRANSLATION_DIAGNOSTIC / CONSUMED MARKET WINDOW**.
- protocol and Git-blob seal frozen before stock outcomes.
- stock outcomes: **NOT OPENED**.
- current status: **BLOCKED_DATA_ACCESS** because `SEC_EDGAR_USER_AGENT` is absent in the available execution runtime.
- this block is not a negative economic result and does not consume stock outcomes.


## CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1

- snapshot frozen: **2026-09-27**, before future price outcomes;
- universe: current S&P 500 from Wolfram, frozen at 500 symbols;
- 500/500 mapped, 451 evaluable, 46 top-decile selected;
- signal proxy: current TotalRevenue × OperatingMargin / positive StockholdersEquity;
- weighting: current market-cap value-weighted;
- start: first common tradable session after 2026-09-27;
- 3m and 6m: descriptive checkpoints only;
- 12m: primary outcome versus SPY and URTH;
- future outcomes: **UNOPENED**;
- pre-outcome guard status: **PASS_PRE_OUTCOME_GUARDS**;
- exact value-weighted basket is concentrated (NVDA 34.27%, AAPL 31.42% internally); V1 remains frozen rather than being retuned;
- look-through overlap with the structural core must be quantified before any future Custodia integration;
- strict historical `CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1` remains separately **BLOCKED_DATA_ACCESS** on SEC User-Agent and has not opened stock outcomes.


## CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1

- role: **IMPLEMENTATION_TRANSLATION_DIAGNOSTIC_CONSUMED_WINDOW**;
- anchors frozen before prices: 2020-06-30 through 2024-06-30;
- stock-price outcomes opened for complete 2020 and 2021 periods; 2022 stopped on missing terminal listed price for CTXS;
- status: **INCONCLUSIVE_PRICE_OR_COVERAGE**;
- reason: selected CTXS ceased trading after the 2022 cash acquisition; frozen V1 required a listed adjusted-open endpoint and prohibited survivor renormalization;
- no candidate CAGR was computed and no economic PASS/FAIL claim is valid;
- this bridge sample is **CONSUMED** for any future delisting-aware accounting rule because the CTXS failure and its $104 cash consideration are now known;
- SEC PIT Stage C1 remains separately unopened; future-forward V1 remains fresh/prospective.


### Post-hoc terminal-value diagnostic

- sample: same already-consumed SimFin bridge 2020-07 -> 2024-07;
- rule added after CTXS blocker was known: CTXS terminal value = USD 104 cash/share, no reinvestment;
- role: **POSTHOC_ARCHITECTURE_DIAGNOSTIC_ONLY**;
- outcome: candidate CAGR 13.9390%, SPY 16.9444%, URTH 14.3837%;
- verdict: `POSTHOC_GROSS_EDGE_NOT_PRESENT`;
- promotion authority: **NONE**;
- the sample may not be used to tune or validate a replacement direct-profitability policy.


## CORE_OUTPERFORMANCE_PROFITABILITY_CAPPED_POLICY_V1

- signal population: exactly the same frozen 46 securities as `CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1`;
- policy difference only: 5% issuer cap with deterministic pro-rata redistribution;
- future sample: **same prospective sample as V1, not independent**;
- future outcomes: **UNOPENED**;
- historical cross-diagnostic 2020-2024: **CONSUMED / ARCHITECTURE DIAGNOSTIC ONLY**;
- historical capped CAGR 16.4654% vs SPY 16.9444% and URTH 14.3837%; no promotion and no retuning.

## CORE_OUTPERFORMANCE_PROFITABILITY_VALUE_FUTURE_FORWARD_V1

- hypothesis lineage: Candidate B was frozen before Candidate A outcomes; historical Candidate B returns remain unopened;
- snapshot: **2026-09-27**;
- universe: current S&P 500, 500 members / 451 evaluable;
- frozen selection: exact intersection of OP top quintile and BM top quintile;
- selected: **1 / CHTR**, weight 100%, effective N 1;
- future outcomes: **UNOPENED**;
- start convention: same first common tradable session after 2026-09-27; CHTR is already included in raw profitability V1 so the start observation can be shared;
- status: **PROSPECTIVE SIGNAL SNAPSHOT FROZEN / IMPLEMENTATION CONCENTRATION BLOCKED**;
- no widening of quintiles or alternative weighting is allowed on V1.


## CORE_OUTPERFORMANCE_PROFITABILITY_EXUS_GENERALIZATION_V1

- preregistered before target returns at commit `3043670bb7cacc073053a6c77c4c1beddede6446`;
- role: **GEOGRAPHIC_GENERALIZATION / NON-US HOLDOUT**, but calendar windows overlap periods used in prior U.S. research;
- candidate: Developed ex-US Big / Robust Operating Profitability, value-weighted;
- windows: 2009-01 -> 2014-12 and 2016-01 -> 2021-12, 72 months each;
- 2009-2014 excess CAGR: **-0.5858 pp/year** -> FAIL window;
- 2016-2021 excess CAGR: **+1.3667 pp/year** -> PASS window;
- overall status: **FAIL_GEOGRAPHIC_GENERALIZATION** because both windows were required to pass;
- sample is now **CONSUMED** for this exact geographic-generalization claim;
- no regional rescue variants may be opened from this result.

## CORE_OUTPERFORMANCE_PROFITABILITY_DIRECT_STOCK_IMPLEMENTATION_V1

- role: **IMPLEMENTATION ECONOMICS / NO SIGNAL PROMOTION**;
- frozen 46-name future-forward basket retained unchanged;
- current whole-share MyInvestor execution shows exact 46-name replication requires ~€396k of sleeve capital for at least one share per frozen target;
- status: **FAIL_DIRECT_STOCK_IMPLEMENTATION_FOR_NORMAL_SLEEVE**;
- this does not consume future price outcomes and does not alter signal status;
- next implementation hypothesis must be separately defined rather than changing the frozen basket.

## CORE_OUTPERFORMANCE_HIT_RATE_AUDIT_2026_09_28

New frequency statistic on existing consumed evidence only: academic OP 2009–2014 and 2016–2021, packaged selected Quality 2017–2025, retained SimFin raw/cap5 2020–2024. No selection or old economic study rerun. No alpha promotion and no strategy tuning. Annual primary descriptive frequency plus ALL rolling 12-month windows within existing OP blocks; no gap bridging.

Additional benchmark-only reads: Wolfram SPY/URTH adjusted close requested 2008-12..2025-12. Full response was truncated and rejected; retained compact cache covers SPY 2008-12..2014-12, SPY/URTH 2015-12..2021-12 plus December 2022..2025. No additional stock candidate outcomes opened. Official URTH annual NAV cross-check read. Benchmark price/NAV conventions differ and remain documented, never swapped for a favourable verdict.

Exact Fundamental Quality historical reconstruction remains BLOCKED_MISSING_HISTORICAL_PIT_DESCRIPTOR_PANEL. No new historical holdout declared, no current selection backcast. Its future snapshot/start/outcomes remain unchanged and UNOPENED. No momentum confirmation returns or new ex-US variant opened.


## SECTOR_52W_HIGH_LEADERSHIP_V1

- design frozen before implementation/economic outcomes on 2026-09-28;
- universe: XLB/XLE/XLF/XLI/XLK/XLP/XLU/XLV/XLY;
- intended diagnostic: 2013-01 -> 2019-01 boundary; intended replication: 2019-01 -> 2026-01 boundary;
- implementation code/tests and execution seal committed before economic outcome access;
- exact protocol JS-isolate verification: **PASS / 13 checks**;
- Node/npm/tsc: **NOT EXECUTED IN THIS CHAT — NO SHELL/CODESPACE TOOL**;
- primary Yahoo provider: **BLOCKED_CURRENT_CHAT_RUNTIME**;
- secondary Wolfram source: small preflight PASS, but mandatory issuer-official 10y reconciliation **FAIL 5/9**;
- failed reconciliation symbols: XLB, XLE, XLK, XLU, XLY; these exactly match State Street's documented 2025 2:1 split set;
- current status: **INCONCLUSIVE_DATA_RECONCILIATION**;
- candidate diagnostic returns: **UNOPENED / NOT CALCULATED**;
- temporal replication returns: **UNOPENED / NOT CALCULATED**;
- no sample is claimed consumed by an economic candidate test; source-QA data and public sector performance were accessed only for preflight/reconciliation;
- no parameter/source repair after the failed frozen reconciliation is allowed within this execution attempt;
- next valid action is the unchanged sealed runner using the primary Yahoo provider in a runtime where it is operational.


### Local-app execution integration — SECTOR_52W_HIGH_LEADERSHIP_V1

- job id: `sector-52w-high-leadership-v1`;
- surface: `ResearchValidationCenter`;
- execution runtime: **LOCAL_APP_BACKEND**;
- primary data path: Yahoo REAL, cached/frozen before economic calculation;
- pre-data guards include protocol, causality, Yahoo identity/parser, research-validation runtime, core architecture and TypeScript;
- economic runner calculates 10/20 bps per side; diagnostic continuation gate uses 20 bps;
- replication remains unopened unless diagnostic passes;
- current sample state in repository: **ECONOMIC_NOT_RUN / DIAGNOSTIC_UNOPENED / REPLICATION_UNOPENED**;
- the prior Wolfram reconciliation failure remains source-QA evidence only and is not the candidate economic result;
- machine-readable job evidence: `validation-runs/preregistration/sector-52w-high-leadership-v1-local-job.json`.
