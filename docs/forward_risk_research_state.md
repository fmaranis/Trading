# Forward Risk — canonical research state

Updated: 2026-09-06

This file is the compact canonical state for the drawdown-anticipation research line. Production/Custodia/replay policy remains isolated from every architecture below.

## Objective
Anticipate material drawdowns before the preceding market peak. Primary evidence: episode coverage, lead sessions, false alarms and, only after a predictive gate passes, economic value protected. Reactive loss avoidance after the drawdown starts is not sufficient.

## Frozen/retired architectures

### V3.1 — supervised future-drawdown forecast
Adversarial holdout verdict: `RETIRE_V3_1_ARCHITECTURE`.
- valid 20d cases: 9/14
- median 20d AUC: 0.4857
- DIRECT 20d cases: 33.33%
- mean high-risk false positives: 91.87%
- mean episode anticipation: 65.28%

Do not tune V3.1, create V3.2, or reconnect V1/V2/V3/V3.1 to the replay worker.

### V4 — label-free market regime shift
Rolling annual holdout 2011–2026 verdict: `V4_RESEARCH_ONLY`.
- valid cases: 42/48
- median 20d AUC: 0.5986
- mean 20d AUC: 0.5629
- DIRECT cases: 66.67%
- mean false positives: 77.35%
- auditable episodes: 45
- anticipated episodes: 2
- mean episode anticipation: 4.04%

Interpretation: useful deterioration/confirmation diagnostic, but not an early-warning architecture. Keep isolated; it may only serve as secondary confirmation for an independently leading signal.

### V5 — macro/financial vulnerability + V4 confirmation
Architecture fixed before evaluation. Macro inputs: T10Y2Y, T10Y3M, BAA10Y, WALCL using current FRED vintage; no synthetic fallback. V4 only supplies secondary confirmation. No future labels are fitted.

Predeclared screening gate:
- anticipation >= 40% of auditable episodes;
- median lead >= 10 sessions;
- false vulnerability time <= 35%.

Annual rolling 2011–2026 YTD result:
- valid annual windows: 16
- auditable episodes: 19
- anticipated episodes: 7
- anticipation: 36.84%
- median lead: 58 sessions
- false vulnerability time: 14.62%
- annual gate passes: 4
- verdict: `RETIRE_V5_VULNERABILITY_ARCHITECTURE`

The miss is narrow (one additional anticipated episode would exceed 40%), but the predeclared gate is binding. Do not lower the 80th-percentile vulnerability threshold, extend the 63-session lookback, reweight V5 components, or create V5.1 using these same windows. V5 does not advance to the economic gate or production.

The result is still informative: macro/financial vulnerability delivered long lead and comparatively little false-vulnerability time when it did fire. This information family may be retained only as an independent component in a genuinely new architecture whose rules are fixed before evaluation.

## Current research direction
The next architecture must add a genuinely different leading information family rather than tune V5. Candidate direction: cross-asset/factor deterioration and defensive rotation while the global equity core remains near its high, using the existing real market-data universe. V5 macro vulnerability and V4 regime deterioration may be retained as independent context/confirmation, but neither may be retuned on the 2011–2026 results.

Before evaluating the next architecture, freeze its components, lookbacks, state transitions and promotion gate. Reuse all consecutive annual windows rather than hand-picking crises. Do not run an economic gate until the new architecture passes the pre-peak anticipation gate.
