# Forward Risk V9 — pre-registration and blind validation seal

Frozen: 2026-09-07
Protocol: `V9_PREREG_2026_09_07`
Status: `HOLDOUT_SEALED / POLICY_NOT_FROZEN`

## Why V9 exists

V8 remains the frozen predictive evidence layer:

`V8 = (V5 vulnerability >= 80) OR (V7 options >= 80)`

V8 showed useful pre-peak anticipation, but its raw daily ON/OFF signal is too fragmented to be a valid transaction switch. The causal economic gate reduced drawdown but destroyed too much final value through repeated reductions/repurchases, commissions and estimated tax. The real-session fragmentation diagnostic then confirmed that the problem is temporal decision behavior rather than a justification to retune V8 thresholds.

V9 therefore does **not** replace or retune V8. Its research question is narrower:

> Can the already-frozen V8 evidence be converted into a causal persistent state machine (`NORMAL -> ALERTA -> PROTECCION -> RECUPERACION`) that preserves anticipation while avoiding daily churning and producing positive net economic value?

## Contamination boundary

All V8 data inspected up to 2026-09-01 are development-only for V9. They may be used to understand transitions, debug causality and design the state machine, but never as unbiased V9 OOS evidence.

The existing `EUR_VALIDATION_HOLDOUT_UNIVERSE` is also **not blind** for V9. `scripts/brokerAwareExecutionSweepLive.ts` already scans that full catalogue and derives trailing losses, volatility, full-history drawdowns and worst 6M/12M loss episodes. It is therefore contaminated for this research question even when an individual instrument was not one of the six explicit V8 transfer benchmarks.

## Historical blind holdout — sealed before policy design

The following six instruments are fixed before V9 transition rules, persistence durations, action sizes or recovery rules are designed:

| ID | Provider ticker | Exposure |
| --- | --- | --- |
| `V9_BLIND_SPPW` | `SPPW.DE` | Global equity |
| `V9_BLIND_SPY5` | `SPY5.DE` | US equity |
| `V9_BLIND_SPYM` | `SPYM.DE` | Emerging equity |
| `V9_BLIND_ZPRS` | `ZPRS.DE` | Global small cap |
| `V9_BLIND_VGEU` | `VGEU.DE` | Europe equity |
| `V9_BLIND_ZPDJ` | `ZPDJ.DE` | Japan equity |

Selection is structural only: UCITS equity exposure, EUR Deutsche Boerse/Xetra listing, absence from both existing production and validation catalogues, and cross-region/style diversification. **Historical returns, drawdowns, crisis episodes and V9 outcomes are not selection criteria.**

### Seal rule

Do not fetch or inspect the historical price series for these six assets for V9 until the complete V9 policy contract is committed to `main` with an immutable fingerprint.

Once opened:

- evaluate the frozen policy exactly once;
- do not replace a failing asset;
- do not replace an insufficient-data asset with a more convenient candidate;
- do not change transition rules, durations, action sizes or gates after seeing results;
- if the frozen V9 contract fails, retire that contract. A successor architecture requires a newly sealed validation sample.

## Temporally virgin confirmation

A second validation layer is reserved from **2026-09-08 onward**. These observations did not exist when this protocol was frozen and therefore provide the strongest anti-overfitting confirmation.

No V9 parameter may be changed in response to this future-forward stream. It is confirmation, not training data.

## What may be designed on the development sample

Only after the blind sample is sealed may development begin. The design sample may be used to determine and freeze:

1. the complete causal transition table among `NORMAL`, `ALERTA`, `PROTECCION`, `RECUPERACION`;
2. confirmation/persistence logic for entering and leaving states;
3. state memory and hysteresis;
4. mapping from states to economic actions;
5. `NEXT_OPEN` execution semantics;
6. transaction sizing;
7. treatment of commissions, remunerated cash and Spanish tax;
8. the predictive and economic PASS/FAIL gates.

The state machine may consume the frozen V8 signal and its own past state only. Outcome information, future prices or post-date drawdown knowledge may never become state inputs. V5/V7 thresholds remain fixed at 80.

## Mandatory freeze before opening the historical holdout

The holdout remains mechanically locked while `policyFreeze.status = NOT_FROZEN` and `policyFreeze.fingerprint = null` in `src/investment/decision/forwardRiskV9ValidationProtocol.ts`.

Before changing that lock, one commit must contain the full V9 contract and tests proving:

- every transition is causal and deterministic;
- all durations/confirmations are explicit;
- all economic actions are explicit;
- no outcome-dependent branch exists;
- V8 thresholds are unchanged;
- predictive and economic gates are explicit;
- the policy has a stable fingerprint;
- no historical blind-holdout series has been queried by the V9 workflow.

Only a later commit may add/run the blind validation script.

## Execution constraints

- Research-only until all gates pass.
- Do not wire V9 into Custodia, recommendations, alerts or the production replay worker during research.
- Long validation runs execute in the local app/backend.
- Never use GitHub Actions for long validation/replays.
- Do not create a parallel investment engine; a successful V9 would integrate into the existing architecture as the temporal risk-policy layer around the frozen signal.

## Immediate next step

Design the V9 transition contract **only on the acknowledged development data**. When the transition table, hysteresis and economic action mapping are fixed, commit them with the policy fingerprint. Until then the historical blind sample stays sealed.
