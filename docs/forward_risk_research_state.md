# Forward Risk — canonical research state

Updated: 2026-09-15

This file is the compact canonical state for the drawdown-anticipation research line. Production/Custodia/replay policy remains isolated from every research architecture below unless a future promotion is explicitly approved.

## Objective

Anticipate material downside before it occurs and separate permanently:

1. **signal / predictive information quality**;
2. **economic execution-policy quality**.

A failed economic policy does not by itself invalidate a predictive signal.

## Earlier frozen/retired architectures

### V3.1 — supervised future-drawdown forecast

Adversarial holdout verdict: `RETIRE_V3_1_ARCHITECTURE`.

Do not tune V3.1, create V3.2, or reconnect V1/V2/V3/V3.1 to the replay worker.

### V4 — label-free market regime shift

Rolling annual holdout 2011–2026 verdict: `V4_RESEARCH_ONLY`.

Useful as deterioration/confirmation context, not as an independently leading architecture.

### V5 — macro/financial vulnerability

Frozen historical screening result retained as research evidence. Do not lower its 80 threshold, extend its 63-session lookback or reweight components on consumed windows.

## V7/V8 — predictive information retained

V7 added observed options-implied stress from Cboe. V8 froze the complementarity rule:

`V5 vulnerability >= 80 OR V7 options >= 80`

Closed evidence retained:

- EUNL: 11/19 episodes anticipated = 57.89%; median lead 63 sessions; false signal time 16.73%;
- six V8 holdouts: 72/83 episodes anticipated = 86.75%; median lead 40 sessions; false signal time 26.33%; 6/6 predictive PASS;
- the macro leg was subsequently reconstructed vintage-safe with FRED/ALFRED point-in-time semantics.

Permanent interpretation:

> **V8 contains useful downside information.**

The historical V8 binary state was highly fragmented and must not return as a direct daily trading switch.

## V9 / V10 / V11 — economic policies retired

- V9: retired in the tested state-machine form;
- V10: retired in the tested contribution-delay form;
- V11: retired in the tested continuous-sizing form.

V11 produced a reusable architectural diagnosis: only 51/272 baseline `ELIGIBLE` decisions (18.75%) were exposed to risk >80, so applying Forward Risk only after `PortfolioCandidateGate` left little incremental reach.

Do not create V12/V13 as parameter chasing.

## Phase 6 — current research direction

Current state:

**`FORWARD_RISK_CONTEXT_V1` / STAGE A FUTURE-FORWARD SAMPLE FROZEN / NOT OPENED / RESEARCH ONLY.**

Stage A preserves only an informational context:

- continuous context score = `max(V5 vulnerability score, V7 options score)`;
- high context retains the frozen V8 threshold `>=80`;
- both V5 and V7 legs are required;
- no fitted coefficients or new signal thresholds;
- shadow observation at the `PortfolioCandidateGate` decision context;
- no change to eligibility, ranking, sizing, existing holdings, waiting states or orders;
- production remains `LEGACY`.

### Stage A frozen sample

Historical Forward Risk windows through 2026-09-01 remain consumed, so Stage A is prospectively frozen instead of reopening them.

Prediction window:

`2026-09-16 -> 2027-03-31`

Exact cohort:

`EUNL / SXR8 / EXSA / IS3N / IUSN / QDVE / VVSM / XDWH / EXH1 / ISPA`

Primary population:

`PortfolioCandidateGate = ELIGIBLE` with both Forward Risk legs available.

Predictive outcome:

- reference `NEXT_OPEN` after the information date;
- 63 future sessions;
- maximum peak-to-trough drawdown within that path;
- material downside threshold `>=5%`.

Primary PASS requirements after reach/data gates:

- high-risk material-downside rate at least +10 percentage points versus normal;
- risk ratio >=1.5;
- median future max drawdown at least 1 percentage point worse in high context.

Reach must include at least 200 eligible evaluable observations, 30 high-risk eligible, 100 normal eligible, high-risk reach across at least four assets and six calendar weeks, and no asset may dominate more than 35% of high-risk eligible observations.

A PASS only permits Stage B policy design; it does not promote production. The Stage A sample then cannot validate economically the policy designed from it.

### Pre-open boundary

Stage A market/outcome access remains prohibited until the causal collector/evaluator, immutable durable state, no-backfill guard and runner/state fingerprints are implemented and sealed with architecture guards and TypeScript.

Canonical documents/code:

- `docs/phase6_forward_risk_context_preregistration.md`;
- `docs/phase6_forward_risk_context_stage_a_preregistration.md`;
- `src/investment/decision/phase6ForwardRiskContextProtocol.ts`;
- `src/investment/decision/phase6ForwardRiskContextStageAProtocol.ts`.

## Production boundary

Forward Risk currently has **no production authority**.

It cannot:

- make a rejected candidate eligible;
- suppress an eligible candidate in production;
- alter productive ranking or sizing;
- sell/reduce an existing holding;
- create a daily ON/OFF state;
- create a parallel recommendation engine.

Production remains `CORE_ARCHITECTURE_V1` with allocation/opportunity `LEGACY` and `CORE_ELIGIBILITY_V2` shadow.
