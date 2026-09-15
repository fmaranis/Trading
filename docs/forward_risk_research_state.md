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

- valid 20d cases: 9/14;
- median 20d AUC: 0.4857;
- DIRECT 20d cases: 33.33%;
- mean high-risk false positives: 91.87%;
- mean episode anticipation: 65.28%.

Do not tune V3.1, create V3.2, or reconnect V1/V2/V3/V3.1 to the replay worker.

### V4 — label-free market regime shift

Rolling annual holdout 2011–2026 verdict: `V4_RESEARCH_ONLY`.

- valid cases: 42/48;
- median 20d AUC: 0.5986;
- mean 20d AUC: 0.5629;
- DIRECT cases: 66.67%;
- mean false positives: 77.35%;
- auditable episodes: 45;
- anticipated episodes: 2;
- mean episode anticipation: 4.04%.

Useful as deterioration/confirmation context, not as an independently leading architecture.

### V5 — macro/financial vulnerability

Frozen historical screening result:

- auditable episodes: 19;
- anticipated episodes: 7;
- anticipation: 36.84%;
- median lead: 58 sessions;
- false vulnerability time: 14.62%;
- verdict: `RETIRE_V5_VULNERABILITY_ARCHITECTURE` as a standalone architecture.

Do not lower its 80 threshold, extend its 63-session lookback or reweight components on the consumed windows. Its information family remains reusable only inside a genuinely new preregistered hypothesis.

## V7/V8 — predictive information retained

V7 added observed options-implied stress from Cboe. V8 froze the complementarity rule:

`V5 vulnerability >= 80 OR V7 options >= 80`

Closed evidence retained:

- EUNL: 11/19 episodes anticipated = 57.89%; median lead 63 sessions; false signal time 16.73%;
- six V8 holdouts: 72/83 episodes anticipated = 86.75%; median lead 40 sessions; false signal time 26.33%; 6/6 predictive PASS;
- the macro leg was subsequently reconstructed vintage-safe with FRED/ALFRED point-in-time semantics.

Permanent interpretation:

> **V8 contains useful downside information.**

The historical V8 binary state was nevertheless highly fragmented: 1,059 ON sessions across 111 runs, median run 2 sessions, with 72.1% of runs lasting <=3 sessions. It must not return as a direct daily trading switch.

## V9 / V10 / V11 — economic policies retired

- V9: retired in the tested state-machine form;
- V10: retired in the tested contribution-delay form;
- V11: retired in the tested continuous-sizing form.

V11 produced a reusable architectural diagnosis: only 51/272 baseline `ELIGIBLE` decisions (18.75%) were actually exposed to risk >80, so applying Forward Risk only after `PortfolioCandidateGate` left little incremental reach.

This diagnosis may motivate a different research placement, but may not tune a successor policy on the consumed holdouts.

Do not create V12/V13 as parameter chasing.

## Phase 6 — current research direction

Current state:

**`FORWARD_RISK_CONTEXT_V1` PREREGISTERED / SAMPLE NOT SELECTED / NOT OPENED / RESEARCH ONLY.**

Stage A freezes only an informational context:

- continuous context score = `max(V5 vulnerability score, V7 options score)`;
- high context retains the already-frozen V8 threshold `>=80`;
- both V5 and V7 legs are required; missing one leg is `UNAVAILABLE`, never a silent fallback;
- no fitted coefficients or new thresholds;
- shadow observation at the `PortfolioCandidateGate` decision context;
- no change to eligibility, ranking, sizing, existing holdings, waiting states or orders;
- production remains `LEGACY`.

The next methodological step is **not** an economic replay. Before any Stage A market/outcome access, freeze a fresh structural/coverage-only sample, exact predictive outcomes, reach/data gates and PASS/FAIL/INCONCLUSIVE criteria, then seal the runner.

If Stage A later passes, that sample becomes consumed for economic-policy design. Any economic translation must then be designed explicitly and validated on a separate fresh sample; the Stage A sample cannot both design and promote the policy.

Canonical preregistration:

`docs/phase6_forward_risk_context_preregistration.md`

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
