# Current opportunity alerts and Spanish tax-aware execution

## Operational objective

The real-portfolio workspace must answer two different questions without mixing them:

1. **Where is there a valid entry today?**
2. **What should I do with the positions and cash I actually hold?**

Historical BUY/ADD/SELL markers remain available on every individual chart and in robustness tests. The old historical-alert/snapshot block is no longer a primary portfolio surface.

## Current-entry alert levels

Every emitted current opportunity has already passed the canonical new-money gate:

**REAL data -> cash hurdle -> StrategyConsensus BUY -> no structural downtrend**

Levels:

- `HIGH_CONVICTION`: at least 4/5 favorable signals, consensus >= +3, at least +5 percentage points versus the configured cash benchmark, healthy long trend/SMA200, aligned 20/60/120-session momentum, annualized volatility <= 30%, current drawdown no worse than -20%.
- `GOOD_ENTRY`: BUY-grade consensus with at least 3 favorable signals, consensus >= +2, at least +2 pp versus cash, positive 120-session momentum and annualized volatility <= 35%.
- `VALID_ENTRY`: passes the canonical cash+consensus gate but does not meet the stronger alert thresholds.

A large scanner score or momentum ratio alone can never create a HIGH_CONVICTION alert.

Autonomous notifications use `EUR_PORTFOLIO_DISCOVERY_UNIVERSE`, not the external validation holdout. The webhook is sent only for `HIGH_CONVICTION` or `GOOD_ENTRY`.

## MyInvestor availability policy

Operational default: assume an instrument is available in MyInvestor unless the user explicitly marks it unavailable. This is kept separate from official/public broker evidence and must never be represented as an official MyInvestor confirmation.

## Spanish tax-aware rotations

The execution layer treats tax as economic friction, not as a broker cash movement.

Current savings-base scale implemented for a Spanish resident:

- 0–6,000 EUR: 19%
- 6,000–50,000 EUR: 21%
- 50,000–200,000 EUR: 23%
- 200,000–300,000 EUR: 27%
- above 300,000 EUR: 30%

The app allows the user to provide an estimate of positive savings taxable base already accumulated during the year. If that context is not confirmed, the model reserves a conservative 30% of estimated realized gains.

### Rotation rule

For a partial `REDUCE`/rotation with a positive gain:

**expected advantage over selected horizon > estimated IRPF on realized gain + transaction fee**

If this cannot be demonstrated, the operation becomes `REVIEW / NO OPERAR`.

A structural `EXIT` is a risk-control decision: tax is displayed but does not trap the portfolio in a severely deteriorating position.

### Funds

For eligible transferable mutual funds, a fund-to-fund transfer is preferred where operationally appropriate. The immediate tax estimate is zero under the tax-deferral assumption, subject to the legal/operational requirements being satisfied.

For direct redemption, the realized gain is estimated from the registered acquisition cost and current value. Current real Vanguard positions have registered invested amounts, acquisition dates and units.

### Listed shares/ETFs

Purchases executed through the app create a separate tax-lot ledger. Future sales use FIFO tracked lots to estimate acquisition cost. If an existing/manual holding lacks sufficient tracked acquisition history, tax precision is marked unknown and a non-structural rotation is not approved merely by inventing a cost basis.

## Important limitation

Tax output is a decision-support estimate, not a tax return. It does not automatically model all possible loss-compensation rules, prior-year carried losses, special taxpayer situations or other components of the savings base. Those inputs must not be invented.
