# TimesFM Relative Rank V1 — economic shadow policy

Date: 2026-10-05  
Status: **FROZEN BEFORE FIRST PROSPECTIVE ANCHOR / RESEARCH-ONLY / NO PRODUCTION AUTHORITY**

## Purpose

Translate the predictive information that passed `TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1` into the smallest possible economic intervention inside the canonical chain:

`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine -> execution/follow-up`

No parallel engine is created.

## Frozen intervention

Policy id: `TIMESFM_RELATIVE_RANK_V1`.

TimesFM receives **no gate authority**. A candidate must first pass the exact existing requirements:

- REAL data;
- current dynamic shortlist semantics where applicable;
- cash hurdle;
- BUY consensus;
- no structural downtrend;
- EntryTiming != WAIT.

Only after those gates have passed, the policy reorders the eligible set.

### Ranking rule

For every eligible asset:

1. ordinal rank by frozen TimesFM predicted return **relative to the structural core** at 20 sessions;
2. ordinal rank by the same relative forecast at 60 sessions;
3. arithmetic mean of the two ordinal ranks;
4. lower mean rank is better;
5. exact mean-rank ties use the pre-existing LEGACY ranking score;
6. remaining deterministic tie uses `assetId`.

There is no fitted coefficient, multiplier, return threshold or post-outcome calibration.

If one eligible candidate lacks frozen TimesFM evidence for the information date, the research policy **fails closed**. It may not silently fall back to LEGACY for only that row.

The structural core reference itself may be represented in later economic evaluation with deterministic relative forecast `0% / 0%` because return relative to itself is definitionally zero; this is a benchmark identity, not a model prediction.

## What does not change

`TIMESFM_RELATIVE_RANK_V1` does **not** change:

- AssetUniverseScanner;
- PortfolioCandidateGate eligibility;
- EntryTiming thresholds or starter fractions;
- InvestmentDecisionEngine allocation method;
- target cash;
- portfolio slots;
- asset/category caps;
- opportunity allocation formula;
- starter/build sizing;
- rotation persistence requirements;
- broker commissions;
- Spanish tax model;
- external cash-flow accounting;
- NEXT_OPEN execution semantics;
- position health / REDUCE / EXIT logic.

The downstream allocator still uses its existing LEGACY economic priority formula. TimesFM only changes ordinal candidate ordering / which already-eligible candidate receives scarce selection or slot priority first.

## Baseline

Control arm: exact `CORE_ARCHITECTURE_V1` with candidate selection `LEGACY`.

Candidate arm: exact same chain, same data, dates, capital, cash, costs, taxes and execution, with only candidate selection set to `TIMESFM_RELATIVE_RANK_V1`.

## Fresh evidence

The economic shadow is bound before the first fresh anchor to `TIMESFM_STAGE_B_PROSPECTIVE_CONFIRMATION_V1`.

Every weekly anchor persists:

- causal TimesFM forecast evidence;
- policy version `TIMESFM_RELATIVE_RANK_V1`;
- `outcomesOpened=false`;
- hash-chained durable state on `replay-results`.

No historical Stage B outcome may be used to retune this policy.

## Evaluation timing

No economic promotion decision may be made until the prospective signal confirmation itself is mature:

- at least 26 persisted weekly anchors;
- the primary 60-session outcome for the final required anchor has matured;
- the signal gates remain frozen;
- no parameter changes after collection opens.

The economic evaluator must compare LEGACY and TIMESFM_RELATIVE_RANK_V1 on the identical fresh evidence and report at minimum:

- reach: dates where candidate ordering changed, selected assets changed and executable contributions changed;
- terminal value / flow-adjusted return;
- excess versus structural core where benchmark accounting is comparable;
- max drawdown;
- fees and estimated taxes;
- turnover / executed operation count;
- cash deployment / idle cash.

A signal PASS with zero economic reach is **not** an economic PASS.

## Production

`productionDefault = LEGACY`  
`productionAuthority = false`

This policy cannot alter today's recommendation or place an order.
