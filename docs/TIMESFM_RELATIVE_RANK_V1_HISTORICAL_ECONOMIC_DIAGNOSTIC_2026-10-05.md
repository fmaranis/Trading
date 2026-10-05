# TimesFM Relative Rank V1 — historical economic diagnostic

Date: 2026-10-05  
Status: **FROZEN BEFORE ECONOMIC REPLAY / CONSUMED SAMPLE / NO PROMOTION AUTHORITY**

## Question

Does the already-consumed Stage B TimesFM signal produce **economic reach** when inserted as the frozen `TIMESFM_RELATIVE_RANK_V1` ordering policy inside the canonical `CORE_ARCHITECTURE_V1` replay?

This test can answer whether the historical signal would have changed executable behavior and money. It **cannot** confirm production because the Stage B historical sample is already consumed and the economic policy was designed after the Stage B signal result was observed.

## Arms

Control:
- exact `CORE_ARCHITECTURE_V1`;
- candidate selection `LEGACY`;
- allocation `LEGACY`.

Candidate:
- exact same replay/data/dates/capital/cash/tax/execution;
- candidate selection `TIMESFM_RELATIVE_RANK_V1`;
- allocation remains `LEGACY`.

The only intended difference is ordinal priority among candidates already eligible under REAL + cash + BUY consensus + no structural downtrend + EntryTiming.

## Decision calendar

Use **exactly** the 31 Stage B `informationDate` values. No calendar approximation and no extra decisions.

The canonical replay receives these via a research-only optional `explicitDecisionDates` input. Omission of that input preserves existing product/default behavior.

## Data and forecast evidence

- use the exact Stage B result `validation-runs/diagnostics/timesfm-stage-b-predictive-benchmark-v1-result.json` when present;
- verify Stage B status is `PASS_DIAGNOSTIC_START_PROSPECTIVE_CONFIRMATION`;
- reuse its Yahoo raw-cache files and verify their recorded SHA-256;
- if the local Stage B result/cache is absent, the diagnostic may regenerate the **same frozen consumed Stage B** once, without changing parameters;
- construct the replay dataset from the same raw Yahoo responses;
- core `EUNL` receives relative forecast 0/0 by definition of return relative to itself;
- each candidate uses the frozen 20/60 relative forecasts from the Stage B result.

## Scenario matrix

Five execution-capital bands already defined by Custodia:
- MICRO: 250 EUR;
- SMALL: 500 EUR;
- MEDIUM: 2,500 EUR;
- LARGE: 10,000 EUR;
- INSTITUTIONAL: 30,000 EUR.

Three existing risk profiles:
- LOW;
- MEDIUM;
- HIGH.

Total: **15 scenarios**.

Common settings:
- initial portfolio: zero;
- explicit external flows: none;
- horizon: 5 years;
- cash: historical ECB DFR floor 0%;
- tax: canonical conservative default when annual prior savings base is not confirmed;
- minimum history: 252 bars;
- execution: NEXT_OPEN;
- same fees, taxes, caps, slots and rotation semantics in both arms.

No scenario may be dropped because its result is inconvenient.

## Metrics

For each scenario:
- final value and total return;
- excess final EUR / return points candidate vs LEGACY;
- structural-core benchmark comparison;
- max drawdown;
- fees;
- estimated tax;
- executed buys/adds/reductions/exits;
- final cash;
- whether the executed-trade signature changed.

Aggregate:
- positive/negative/flat scenario counts;
- median excess final EUR;
- median excess return pp;
- number of scenarios with economic reach;
- number beating LEGACY;
- number beating structural core.

## Descriptive verdict

This is deliberately **not a promotion gate**.

- `NO_ECONOMIC_REACH`: no executed-trade signature changes and all final deltas are economically zero.
- `POSITIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC`: median excess final EUR is positive and positive scenarios outnumber negative scenarios.
- `NEGATIVE_HISTORICAL_ECONOMIC_DIAGNOSTIC`: median excess final EUR is negative and negative scenarios outnumber positive scenarios.
- otherwise `MIXED_HISTORICAL_ECONOMIC_DIAGNOSTIC`.

The verdict is descriptive only. The fresh prospective confirmation remains mandatory.

## Production

Production remains `LEGACY`. No output from this diagnostic may alter today's decision.
