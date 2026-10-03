#!/usr/bin/env python3
"""TimesFM 3.0 Stage A smoke: technical, causal, research-only.

This runner deliberately uses a deterministic SYNTHETIC fixture. It does not fetch market
prices, does not evaluate economic outcomes, and cannot influence production decisions.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import platform
import sys
from typing import Any

import numpy as np

STUDY = "TIMESFM_STAGE_A_SMOKE_V1"
MARKER = "TIMESFM_STAGE_A_SMOKE_RESULT"
PACKAGE_VERSION = "3.0.2"
CHECKPOINT = "google/timesfm-3.0-pytorch"
CHECKPOINT_REVISION = "24701cec1b1ea47232c0766e888855c9976ef62b"
EXPECTED_WEIGHT_SHA256 = "a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da"
CONTEXT_LENGTH = 128
HORIZON = 16
QUANTILES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
TOL = 1e-5


def _hash_array(value: np.ndarray) -> str:
    arr = np.ascontiguousarray(value.astype(np.float32, copy=False))
    return hashlib.sha256(arr.tobytes()).hexdigest()


def _fixture() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Three target variates + one past-only covariate + forbidden future tail."""
    t = np.arange(CONTEXT_LENGTH, dtype=np.float32)
    targets = np.stack(
        [
            100.0 + 0.12 * t + 1.8 * np.sin(t / 9.0),
            75.0 + 0.08 * t + 1.2 * np.cos(t / 13.0),
            50.0 + 0.05 * t + 0.9 * np.sin(t / 17.0 + 0.4),
        ],
        axis=0,
    ).astype(np.float32)
    past_only = np.stack([np.sin(t / 21.0)], axis=0).astype(np.float32)
    # Deliberately absurd values. They represent data after informationDate and MUST NOT
    # enter the context passed to TimesFM.
    forbidden_future = np.full((3, 12), 1_000_000.0, dtype=np.float32)
    return targets, past_only, forbidden_future


def _forecast(forecaster: Any, targets: np.ndarray, past_only: np.ndarray):
    outputs = list(
        forecaster.predict_batch(
            contexts=[targets],
            horizon=HORIZON,
            past_only_covariates=[past_only],
            past_future_covariates=None,
            return_quantiles=True,
            use_symmetric_averaging=False,
            make_positive=False,
            sort_quantiles=True,
        )
    )
    if len(outputs) != 1:
        raise RuntimeError(f"TIMESFM_UNEXPECTED_OUTPUT_COUNT:{len(outputs)}")
    output = outputs[0]
    if output.forecast is None or output.quantiles is None:
        raise RuntimeError("TIMESFM_MISSING_FORECAST_OR_QUANTILES")
    return np.asarray(output.forecast), np.asarray(output.quantiles)


def _result(status: str, **extra: Any) -> dict[str, Any]:
    return {
        "study": STUDY,
        "status": status,
        "model": {
            "package": "timesfm",
            "packageVersion": PACKAGE_VERSION,
            "checkpoint": CHECKPOINT,
            "checkpointRevision": CHECKPOINT_REVISION,
            "expectedWeightSha256": EXPECTED_WEIGHT_SHA256,
        },
        "protocol": {
            "stage": "A_SMOKE_TECHNICAL",
            "dataProvenance": "SYNTHETIC",
            "fixturePurpose": "TECHNICAL_CAUSALITY_AND_INFERENCE_ONLY",
            "contextLength": CONTEXT_LENGTH,
            "horizon": HORIZON,
            "quantiles": QUANTILES,
            "marketPricesFetched": False,
            "marketOutcomesOpened": False,
            "economicPolicyOpened": False,
            "productionAuthority": False,
            "productionDefault": "LEGACY",
        },
        **extra,
    }


def main() -> int:
    try:
        if not ((3, 11) <= sys.version_info[:2] < (3, 15)):
            raise RuntimeError(f"UNSUPPORTED_PYTHON:{sys.version.split()[0]}")

        installed = importlib.metadata.version("timesfm")
        if installed != PACKAGE_VERSION:
            raise RuntimeError(f"TIMESFM_VERSION_MISMATCH:{installed}!={PACKAGE_VERSION}")

        import torch
        from timesfm3 import ModelConfig, TimesFM3Evaluator

        requested_device = os.getenv("TIMESFM_STAGE_A_DEVICE", "cpu").strip() or "cpu"
        if requested_device.startswith("cuda") and not torch.cuda.is_available():
            raise RuntimeError("TIMESFM_CUDA_REQUESTED_BUT_UNAVAILABLE")

        # Make the smoke as repeatable as practical. Stage A is not an economic benchmark.
        np.random.seed(20261004)
        torch.manual_seed(20261004)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(20261004)
        torch.set_grad_enabled(False)

        config = ModelConfig(
            checkpoint_path=CHECKPOINT,
            revision=CHECKPOINT_REVISION,
            per_core_batch_size=1,
            device=requested_device,
        )
        forecaster = TimesFM3Evaluator(config)

        targets, past_only, forbidden_future = _fixture()
        information_cutoff = targets.shape[-1]

        # Causal contract: an upstream container may hold later values, but the model input
        # is explicitly sliced to informationDate. The forbidden tail must never enter.
        full_with_future = np.concatenate([targets, forbidden_future], axis=-1)
        causal_targets = full_with_future[:, :information_cutoff]
        causal_hash_matches = _hash_array(causal_targets) == _hash_array(targets)

        forecast_a, quantiles_a = _forecast(forecaster, causal_targets, past_only)
        forecast_b, quantiles_b = _forecast(forecaster, causal_targets.copy(), past_only.copy())

        expected_forecast_shape = (targets.shape[0], HORIZON)
        expected_quantile_shape = (targets.shape[0], HORIZON, len(QUANTILES))
        shape_ok = forecast_a.shape == expected_forecast_shape and quantiles_a.shape == expected_quantile_shape
        finite_ok = bool(np.isfinite(forecast_a).all() and np.isfinite(quantiles_a).all())
        quantile_order_ok = bool((np.diff(quantiles_a, axis=-1) >= -TOL).all())
        median_matches = bool(np.max(np.abs(forecast_a - quantiles_a[..., 4])) <= TOL)
        repeat_forecast_delta = float(np.max(np.abs(forecast_a - forecast_b)))
        repeat_quantile_delta = float(np.max(np.abs(quantiles_a - quantiles_b)))
        repeatability_ok = repeat_forecast_delta <= TOL and repeat_quantile_delta <= TOL

        checks = {
            "causalPrefixExcludesForbiddenFuture": bool(causal_hash_matches),
            "forecastShape": bool(shape_ok),
            "finiteOutputs": finite_ok,
            "quantilesMonotonic": quantile_order_ok,
            "pointForecastEqualsMedianQuantile": median_matches,
            "repeatabilityWithinTolerance": repeatability_ok,
        }
        passed = all(checks.values())

        result = _result(
            "PASS_STAGE_A_TECHNICAL_SMOKE" if passed else "FAIL_STAGE_A_TECHNICAL_SMOKE",
            runtime={
                "python": sys.version.split()[0],
                "platform": platform.platform(),
                "device": requested_device,
                "torchVersion": getattr(torch, "__version__", "unknown"),
                "timesfmVersion": installed,
            },
            checks=checks,
            evidence={
                "inputFingerprint": _hash_array(targets),
                "pastOnlyCovariateFingerprint": _hash_array(past_only),
                "forecastFingerprint": _hash_array(forecast_a),
                "quantileFingerprint": _hash_array(quantiles_a),
                "forecastShape": list(forecast_a.shape),
                "quantileShape": list(quantiles_a.shape),
                "repeatForecastMaxAbsDelta": repeat_forecast_delta,
                "repeatQuantileMaxAbsDelta": repeat_quantile_delta,
                "tolerance": TOL,
            },
        )
        print(MARKER)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if passed else 2
    except Exception as exc:
        result = _result(
            "BLOCKED_OR_FAILED_STAGE_A_TECHNICAL_SMOKE",
            error=f"{type(exc).__name__}:{exc}",
            runtime={"python": sys.version.split()[0], "platform": platform.platform()},
        )
        print(MARKER)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
