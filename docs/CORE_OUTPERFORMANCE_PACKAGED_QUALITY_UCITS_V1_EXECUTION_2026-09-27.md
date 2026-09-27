# CORE_OUTPERFORMANCE_PACKAGED_QUALITY_UCITS_V1 — historical implementation diagnostic

Date: 2026-09-27

Status: **POST_SELECTION_PACKAGED_PARENT_EDGE_NOT_PRESENT / NOT BLIND / NO PROMOTION AUTHORITY**

Vehicle selection was frozen in `docs/CORE_OUTPERFORMANCE_PACKAGED_QUALITY_UCITS_V1_2026-09-27.md` before this calculation. Historical performance snippets had already been visible during product verification, so this result is deliberately diagnostic only.

| 2017–2025 | Total return | CAGR |
| --- | ---: | ---: |
| iShares USA Quality UCITS (IUQA/QDVB share class) | +221.01% | **13.84%** |
| SPDR S&P 500 UCITS parent | +245.34% | **14.76%** |
| URTH global | +197.83% | **12.89%** |

Excess CAGR:

- vs U.S. parent: **-0.93 pp/year**;
- vs URTH: **+0.94 pp/year**.

Interpretation:

- the one-order UCITS wrapper solves most of the direct-stock implementation/whole-share problem;
- fund TER is already embedded in the reported NAV return;
- the quality implementation beats the global comparator over this fixed diagnostic but **does not beat the U.S. parent**;
- therefore it does not solve the project's core-outperformance hurdle historically;
- do not switch to another ETF after seeing this result.

The clean remaining evidence path is future-forward. Production stays `LEGACY`.

Reproducibility:
- `validation-runs/diagnostics/core-outperformance-packaged-quality-ucits-v1-input.json`;
- `validation-runs/diagnostics/core-outperformance-packaged-quality-ucits-v1-result.json`;
- `scripts/coreOutperformancePackagedQualityUcitsV1.mjs`.
