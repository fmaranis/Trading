# Dynamic Historical Replay

## Purpose

The static historical decision replay answers: **what would the engine have recommended on a historical start date, and what would that unchanged recommendation be worth at the latest REAL date?**

The dynamic historical replay answers the complementary question: **what would have happened if the user had continued following the app's later buy/hold/avoid/reduce signals through time?**

This is a causal diagnostic. It must never choose an operation because later prices reveal that the operation would have been profitable.

## Causal decision loop

For each monthly or quarterly decision checkpoint after the selected historical start date:

1. truncate every REAL series to information available on/before the checkpoint;
2. require the same minimum causal history;
3. rebuild the diversified historical shortlist;
4. run `InvestmentDecisionEngine` with the portfolio value that existed at that point;
5. rebuild the five-vote `StrategyConsensusEngine` assessment for selected and already-held assets;
6. generate BUY / ADD / HOLD / AVOID / REDUCE / EXIT signals;
7. execute allowed trades only on a common market date strictly after the signal date;
8. execute sells before buys;
9. accrue residual cash at the configured remunerated-cash benchmark;
10. repeat until the latest REAL date.

## Buy-side gate

A theoretical target weight does not create an executable purchase by itself.

- new position: requires `newMoneyAction === BUY`;
- existing position increase: requires `existingPositionAction === ADD`;
- WATCH / AVOID cannot consume new cash.

## Sell-side gate

Allocation drift alone remains explicitly insufficient to sell.

A reduction is eligible only when both are true at the historical decision date:

1. `StrategyConsensusEngine` returns `REDUCE_REVIEW`, which already requires structural downtrend plus several adverse votes;
2. the allocation engine for the same causal date requests a materially lower target weight than the current portfolio weight.

If the resulting target weight is effectively zero, the replay may simulate a full exit. Otherwise it reduces toward the causal target. A weak recent window, an overweight category, or future knowledge cannot create a sell.

## Execution model

- ETF/ETC: whole shares and the modeled MyInvestor commission.
- Mutual fund: fractional units; no explicit transaction fee until verified.
- Common post-signal execution date for all material signals in a decision window.
- Sells execute before buys so the replay never assumes unavailable cash.
- Cash never goes negative.
- Residual cash compounds using the configured annual remunerated-cash benchmark.

## Required comparisons

The UI must show three outcomes on identical historical evidence:

1. **Dynamic signals** — keep following later app signals.
2. **Initial recommendation + hold** — existing `HistoricalDecisionReplayEngine` baseline.
3. **All cash** — same starting capital left remunerated.

The value of later signals is reported directly as EUR and percentage-point excess of dynamic replay versus the static initial recommendation.

## Timeline

The UI exposes the historical signal trail with:

- signal date;
- action;
- ticker;
- current and target weight;
- consensus score and favorable/adverse vote counts;
- buy-the-dip / structural-downtrend context;
- execution date when applicable;
- units, notional, execution price and commission;
- causal explanation.

HOLD and AVOID signals can be displayed for audit but are hidden by default to keep the timeline readable.

## Limitations

- present-catalog survivorship bias remains;
- historical broker availability is not reconstructed;
- fund settlement, transfers and taxation are not simulated;
- the displayed drawdown is based on decision/execution equity points rather than every daily session and can understate intraperiod drawdown;
- this is a diagnostic of the current deterministic policy, not a forecast and not the retrospectively optimal sequence of trades.

## Validation gate

`npm run test:dynamic-historical-replay`

The test must prove:

- repeated chronological decisions;
- executable buy/add signals in a favorable regime;
- executable reduce/exit signals after engineered structural deterioration;
- every sell-side signal satisfies structural deterioration and multiple adverse votes;
- every execution occurs strictly after its signal-information date;
- prices modified only after a historical cutoff cannot alter earlier signals/targets;
- future changes may alter final outcomes without rewriting prior decisions.

The test is included in `validate:aistudio:raw`. Official validation remains local through `npm run validate:aistudio`; do not add or depend on GitHub Actions.
