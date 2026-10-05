"""Add-on endpoint for the existing fmaranis/timesfm-stage-a Hugging Face Space.

The Space connector available to ChatGPT is read-only, so this file is the canonical
source to copy into the Space. It does not change the production Trading app.
"""

from __future__ import annotations

import os
import platform
from typing import Any

import numpy as np
import spaces
from timesfm3 import TimesFM3Forecaster

MODEL_ID = "google/timesfm-3.0-pytorch"
MODEL_REVISION = "24701cec1b1ea47232c0766e888855c9976ef62b"
STUDY = "TIMESFM_MULTIVARIATE_CONTEXT_V1"
STATUS = "PASS_TIMESFM_MULTIVARIATE_CONTEXT_V1_INFERENCE"
EVAL_HORIZONS = (1, 5, 20, 60)

_FORECASTER: TimesFM3Forecaster | None = None


def _forecaster() -> TimesFM3Forecaster:
    global _FORECASTER
    if _FORECASTER is None:
        _FORECASTER = TimesFM3Forecaster.from_pretrained(
            MODEL_ID,
            revision=MODEL_REVISION,
            per_core_batch_size=1,
        )
    return _FORECASTER


def _as_2d(value: Any, rows: int, cols: int, label: str) -> np.ndarray:
    arr = np.asarray(value, dtype=np.float32)
    if arr.shape != (rows, cols):
        raise ValueError(f"{label}_SHAPE:{arr.shape}:expected:{rows}x{cols}")
    if not np.isfinite(arr).all():
        raise ValueError(f"{label}_NON_FINITE")
    return arr


def _terminal_payload(output: Any, target_ids: list[str], horizon: int) -> dict[str, Any]:
    forecast = np.asarray(output.forecast, dtype=np.float64)
    quantiles = np.asarray(output.quantiles, dtype=np.float64)
    expected_targets = len(target_ids)
    if forecast.shape != (expected_targets, horizon):
        raise ValueError(f"FORECAST_SHAPE:{forecast.shape}")
    if quantiles.shape != (expected_targets, horizon, 9):
        raise ValueError(f"QUANTILE_SHAPE:{quantiles.shape}")
    if not np.isfinite(forecast).all() or not np.isfinite(quantiles).all():
        raise ValueError("FORECAST_NON_FINITE")

    points: dict[str, dict[str, float]] = {}
    qs: dict[str, dict[str, list[float]]] = {}
    for row, asset_id in enumerate(target_ids):
        points[asset_id] = {
            str(h): float(forecast[row, h - 1])
            for h in EVAL_HORIZONS
        }
        qs[asset_id] = {
            str(h): [float(v) for v in quantiles[row, h - 1, :]]
            for h in EVAL_HORIZONS
        }
    return {"point": points, "quantiles": qs}


@spaces.GPU(duration=180)
def multivariate_context_predict(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict) or payload.get("study") != STUDY:
        raise ValueError("TIMESFM_MV_V1_PAYLOAD_STUDY")
    protocol = payload.get("protocol") or {}
    context_len = int(protocol.get("contextLength", 0))
    horizon = int(protocol.get("forecastHorizon", 0))
    target_ids = list(protocol.get("targetIds") or [])
    covariate_count = int(protocol.get("pastOnlyCovariateCount", 0))
    anchors = list(payload.get("anchors") or [])

    if context_len != 512 or horizon != 60 or len(target_ids) != 9 or covariate_count != 23:
        raise ValueError("TIMESFM_MV_V1_PROTOCOL_MISMATCH")
    if not anchors:
        raise ValueError("TIMESFM_MV_V1_NO_ANCHORS")

    model = _forecaster()
    results = []
    for anchor in anchors:
        anchor_id = str(anchor.get("anchorId") or "")
        target_context = _as_2d(anchor.get("targetContext"), 9, context_len, "TARGET_CONTEXT")
        past_cov = _as_2d(anchor.get("pastOnlyCovariates"), covariate_count, context_len, "PAST_ONLY_COVARIATES")

        targets_only = model.predict(
            context=target_context,
            horizon=horizon,
            return_quantiles=True,
            use_znorm=True,
            sort_quantiles=True,
            make_positive=True,
        )
        with_covariates = model.predict(
            context=target_context,
            horizon=horizon,
            past_only_covariates=past_cov,
            return_quantiles=True,
            use_znorm=True,
            sort_quantiles=True,
            make_positive=True,
        )
        results.append({
            "anchorId": anchor_id,
            "targetsOnly": _terminal_payload(targets_only, target_ids, horizon),
            "withCausalCovariates": _terminal_payload(with_covariates, target_ids, horizon),
        })

    return {
        "study": STUDY,
        "status": STATUS,
        "model": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "anchorCount": len(results),
        "anchors": results,
        "runtime": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "cudaVisibleDevices": os.getenv("CUDA_VISIBLE_DEVICES"),
            "nativeMultivariate": True,
            "pastOnlyCovariates": True,
            "useZNorm": True,
        },
    }
