# Forward Risk V9 — pre-registration and blind validation seal

Frozen: 2026-09-07
Protocol: `V9_PREREG_2026_09_07`
Policy: `V9_POLICY_1`
Fingerprint: `sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0`
Status: `POLICY_FROZEN / HOLDOUT_SEALED_PENDING_LOCAL_IMPLEMENTATION_GATES`

## Why V9 exists

V8 remains the frozen predictive evidence layer:

`V8 = (V5 vulnerability >= 80) OR (V7 options >= 80)`

V8 showed useful pre-peak anticipation, but its raw daily ON/OFF signal is too fragmented to be a valid transaction switch. The causal economic gate reduced drawdown but destroyed too much final value through repeated reductions/repurchases, commissions and estimated tax. The real-session fragmentation diagnostic confirmed that the problem is temporal decision behavior rather than a justification to retune V8 thresholds.

V9 therefore does **not** replace or retune V8. Its research question is narrower:

> Can the already-frozen V8 evidence be converted into a causal persistent state machine (`NORMAL -> ALERTA -> PROTECCION -> RECUPERACION`) that preserves anticipation while avoiding daily churning and producing positive net economic value?

## Contamination boundary

All V8 data inspected up to 2026-09-01 are development-only for V9. They may be used to understand transitions and design the state machine, but never as unbiased V9 OOS evidence.

The existing `EUR_VALIDATION_HOLDOUT_UNIVERSE` is also **not blind** for V9. `scripts/brokerAwareExecutionSweepLive.ts` already scans that full catalogue and derives trailing losses, volatility, full-history drawdowns and worst 6M/12M loss episodes. It is therefore contaminated for this research question even when an individual instrument was not one of the six explicit V8 transfer benchmarks.

## Historical blind holdout — sealed before policy design

The following six instruments were fixed before V9 transition rules, persistence durations, action sizes or recovery rules were implemented:

| ID | Provider ticker | Exposure |
| --- | --- | --- |
| `V9_BLIND_SPPW` | `SPPW.DE` | Global equity |
| `V9_BLIND_SPY5` | `SPY5.DE` | US equity |
| `V9_BLIND_SPYM` | `SPYM.DE` | Emerging equity |
| `V9_BLIND_ZPRS` | `ZPRS.DE` | Global small cap |
| `V9_BLIND_VGEU` | `VGEU.DE` | Europe equity |
| `V9_BLIND_ZPDJ` | `ZPDJ.DE` | Japan equity |

Selection is structural only: UCITS equity exposure, EUR Deutsche Boerse/Xetra listing, absence from both existing production and validation catalogues, and cross-region/style diversification. Historical returns, drawdowns, crisis episodes and V9 outcomes are not selection criteria.

No historical V9 validation series for these six instruments is to be fetched before the implementation gates are recorded PASS.

## Frozen V9 state machine

Implementation: `src/investment/decision/forwardRiskV9StateMachine.ts`.

The state machine consumes only the frozen V8 boolean and its own past state. It does not consume future prices, realized drawdowns or post-date outcome information.

### Transition contract

1. `NORMAL` + first V8 ON -> `ALERTA`. No trade.
2. While `ALERTA`, a second V8 ON inside the three-session alert window -> `PROTECCION` and one `SELL_25_PCT_NEXT_OPEN`.
3. If the three-session alert window expires without the second ON -> `NORMAL`. No trade.
4. `PROTECCION` stays protected while V8 remains ON.
5. First V8 OFF while protected -> `RECUPERACION`. No trade; the portfolio remains 25% reduced.
6. `RECUPERACION` requires five consecutive V8 OFF sessions in total before returning to `NORMAL`; then one `BUY_BACK_NEXT_OPEN` is emitted.
7. Any V8 ON during `RECUPERACION` -> `PROTECCION` with **no additional sale**, because capital is already reduced.

Thus one protection episode can create at most one reduction and one later buy-back. Relapses do not stack repeated 25% sales.

Frozen temporal parameters:
- ON hits required: **2**;
- alert window: **3 market sessions**;
- recovery OFF streak: **5 market sessions**;
- protection size: **25%**;
- execution: **NEXT_OPEN**.

The 25% size is intentionally inherited from the frozen V8 economic gate rather than re-optimized, so the V9 experiment isolates the effect of temporal state/hysteresis.

## Frozen predictive gate

The blind predictive result must use:
- drawdown event threshold: **5%**;
- pre-peak lookback: **63 sessions**;
- action counted as anticipation: entry into `PROTECCION`, not merely `ALERTA`;
- anticipation rate >= **50%**;
- median lead before peak >= **10 sessions**;
- false protected time <= **35%**;
- all **6** blind assets must be valid for a PASS. Fewer valid assets makes the blind result inconclusive, with no replacement allowed.

`PROTECCION + RECUPERACION` count as protected exposure when measuring false protected time because capital remains reduced in both states.

## Frozen economic gate

The economic objective is deliberately inherited from V8 rather than rewritten after seeing V8 fail.

Simulation remains:
- initial capital: **13,000 EUR**;
- whole shares;
- MyInvestor existing commission model;
- historical ECB DFR cash with 0% floor, after tax;
- existing Spanish tax model with unconfirmed context;
- strictly causal `NEXT_OPEN` execution;
- same-asset buy-and-hold baseline.

Individual blind asset PASS:

`finalDeltaEur >= 0 AND drawdownReductionPctPoints >= 1 AND netBreachProtectionEur > 0`

Aggregate blind PASS requires:
- all **6** blind assets valid;
- at least **4/6** individual economic passes;
- median `finalDeltaEur >= 0`;
- median drawdown reduction >= **1 percentage point**.

No grid or post-holdout parameter change is permitted.

## Policy fingerprint and implementation gate

Frozen policy fingerprint:

`sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0`

The policy is frozen, but the blind holdout is still mechanically blocked until all local implementation gates pass:

1. `npx tsx tests/forwardRiskV9StateMachine.unit.ts`
2. `npx tsx tests/forwardRiskV9ValidationProtocol.unit.ts`
3. `npm run lint`

The Research Validation Center exposes these as:

`forward-risk-v9-policy-guard` — **Forward Risk V9 · guard de política congelada**.

This job does not fetch the six blind assets and does not run a long replay.

Until those gates are recorded PASS, `assertForwardRiskV9HistoricalHoldoutUnlocked()` throws:

`V9_BLIND_HOLDOUT_LOCKED_LOCAL_GATES_NOT_RECORDED`

## One-shot holdout rule

After local implementation gates pass:
- open/evaluate the frozen historical holdout exactly once;
- do not replace a failing asset;
- do not replace an insufficient-data asset with a more convenient candidate;
- do not change transitions, durations, action sizes or gates after seeing results;
- if `V9_POLICY_1` fails, retire that contract. A successor requires a newly sealed validation sample.

The blind validation runner must be added only after the local implementation gates have passed and the PASS has been recorded in the protocol.

## Temporally virgin confirmation

A second validation layer is reserved from **2026-09-08 onward**. These observations did not exist when this protocol was frozen and therefore provide the strongest anti-overfitting confirmation.

No V9 parameter may be changed in response to this future-forward stream. It is confirmation, not training data.

## Execution constraints

- Research-only until all gates pass.
- Do not wire V9 into Custodia, recommendations, alerts or the production replay worker during research.
- Long validation runs execute in the local app/backend.
- Never use GitHub Actions for long validation/replays.
- Do not create a parallel investment engine; a successful V9 would integrate into the existing architecture as the temporal risk-policy layer around the frozen V8 signal.

## Immediate next step

Run only the local `forward-risk-v9-policy-guard`. If the three implementation gates pass, record that PASS in the protocol without changing the fingerprint or policy; only then create the one-shot blind validation runner.
