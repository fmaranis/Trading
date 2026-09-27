# CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1

Date: 2026-09-27

Status: **PREREGISTERED BEFORE FULL CROSS-SECTION / FUTURE OUTCOMES UNAVAILABLE / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Starting HEAD: `d472b6d0874bb6ec73f9e156ef45bdd919ad44c4`.

Production remains `LEGACY`.

## Purpose

Create an independent prospective implementation check for the profitability family while the strict historical SEC PIT translation remains blocked by runtime access.

This study does **not** replace `CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1`. It starts a fresh forward sample with information observable on 2026-09-27 and waits for future outcomes.

## Universe

At snapshot time:

- `FinancialData["^GSPC","Members"]` from Wolfram;
- expected current membership count: 500;
- membership list is frozen in the committed snapshot;
- no future constituent refresh is allowed for V1.

## Signal

For each member, map the listed security to its Wolfram Company entity and retrieve current:

- `TotalRevenue`;
- `OperatingMargin`;
- `StockholdersEquity`;
- listed-security `MarketCap`.

Frozen profitability proxy:

`OPERATING_PROFITABILITY_PROXY = TotalRevenue * (OperatingMargin / 100) / StockholdersEquity`

Eligibility:

- all four values finite;
- `TotalRevenue > 0`;
- `StockholdersEquity > 0`;
- `MarketCap > 0`;
- negative profitability values remain eligible and rank naturally;
- missing values are excluded, never imputed.

This is an implementation proxy, not byte-identical to Kenneth French's accounting construction and not a substitute for SEC filing-date PIT evidence.

## Selection

- descending profitability proxy;
- ticker ascending as deterministic tie-break;
- top decile count = `ceil(evaluable / 10)`;
- value-weight inside the selected decile using current market cap;
- no sector neutralization;
- no valuation, momentum, trend, Forward Risk or timing overlay;
- no post-snapshot threshold changes.

## Snapshot evidence

The committed snapshot must preserve:

- raw listed member symbol;
- company entity canonical id;
- profitability proxy;
- market cap;
- selected flag;
- selected weight;
- counts: members, mapped, evaluable, selected;
- source and retrieval date.

No future price outcome is read before the snapshot commit.

## Outcome semantics

Primary horizon: **12 months** from the first common tradable session after snapshot.

Checkpoints are descriptive only at approximately:

- 3 months;
- 6 months;
- 12 months.

Primary 12-month comparison:

1. selected basket total return, with dividends/adjustments;
2. SPY total return;
3. URTH total return.

Primary PASS requires basket return > both SPY and URTH at 12 months.

The 3m/6m checkpoints cannot promote or terminate the study.

## Risk and implementation follow-up

At the 12-month primary outcome also report:

- daily annualized volatility;
- daily max drawdown;
- Sharpe using the same risk-free convention across candidate and benchmarks;
- turnover implied by any successor snapshot, if a V2 is separately preregistered;
- estimated Custodia/MyInvestor execution drag and Spanish-tax treatment only after the gross signal outcome is known.

No production promotion can occur from this single future-forward observation. It can only add independent evidence to the already positive external academic signal and the still-pending strict PIT translation.

## Stop / anti-retuning rules

After snapshot commit, do not:

- change the formula;
- exclude sectors or firms because they later perform poorly;
- change the decile;
- switch to equal weight;
- add valuation/momentum/trend filters;
- replace missing members with hand-picked securities;
- relabel 3m/6m results as the primary endpoint.

Any V2 must be separately preregistered before its own snapshot and must not rewrite V1.
