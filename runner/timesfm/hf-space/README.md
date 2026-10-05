---
title: TimesFM 3.0 Research Runner
emoji: 📈
colorFrom: indigo
colorTo: blue
sdk: gradio
python_version: 3.12.12
app_file: app.py
license: apache-2.0
---

# TimesFM 3.0 · research runner

Research-only ZeroGPU runner for `fmaranis/Trading`.

Endpoints:
- `status` / `run_stage_a`: technical causal smoke.
- `stage_b_predict`: frozen pairwise candidate + EUNL Stage B inference.
- `multivariate_context_predict`: frozen full-panel TimesFM Multivariate Context V1 inference.

The multivariate V1 endpoint accepts only causal contexts from the Trading validation backend:
- 9 simultaneous target series;
- 23 past-only covariates;
- 512-session context;
- 60-session horizon;
- no future outcomes;
- no production authority.

Production remains `LEGACY`.

TimesFM 3.0 pretrained weights are research-only/non-production under their current separate model-weight license.
