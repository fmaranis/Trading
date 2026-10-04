from __future__ import annotations

import copy
import hashlib
import importlib.util
import platform
import subprocess
import sys
import threading
from datetime import datetime, timezone
from typing import Any

def _ensure_timesfm_runtime() -> None:
    if importlib.util.find_spec("timesfm3") is not None:
        return
    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--no-cache-dir",
            "timesfm==3.0.2",
            "numpy>=1.26.4,<3.0.0",
        ]
    )


_ensure_timesfm_runtime()

import gradio as gr
import numpy as np
import spaces
import torch
from huggingface_hub import hf_hub_download
from timesfm3 import ModelConfig, TimesFM3Evaluator

JOB_ID = "timesfm-stage-a-smoke-v1"
STUDY = "TIMESFM_STAGE_A_SMOKE_V1"
PACKAGE_VERSION = "3.0.2"
CHECKPOINT = "google/timesfm-3.0-pytorch"
CHECKPOINT_REVISION = "24701cec1b1ea47232c0766e888855c9976ef62b"
EXPECTED_WEIGHT_SHA256 = "a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da"
CONTEXT_LENGTH = 128
HORIZON = 16
QUANTILES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
TOL = 1e-5
GPU_DURATION_SECONDS = 110

_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _empty_state() -> dict[str, Any]:
    return {
        "jobId": JOB_ID,
        "status": "IDLE",
        "startedAt": None,
        "finishedAt": None,
        "currentStep": None,
        "exitCode": None,
        "output": "",
        "result": None,
        "error": None,
        "execution": "HUGGING_FACE_ZEROGPU",
    }


_STATE = _empty_state()


def _set_state(**changes: Any) -> dict[str, Any]:
    with _LOCK:
        _STATE.update(changes)
        return copy.deepcopy(_STATE)


def _state() -> dict[str, Any]:
    with _LOCK:
        return copy.deepcopy(_STATE)


def _sha256_file(file_path: str) -> str:
    digest = hashlib.sha256()
    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _hash_array(value: np.ndarray) -> str:
    arr = np.ascontiguousarray(value.astype(np.float32, copy=False))
    return hashlib.sha256(arr.tobytes()).hexdigest()


def _fixture() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
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
    forbidden_future = np.full((3, 12), 1_000_000.0, dtype=np.float32)
    return targets, past_only, forbidden_future


def _forecast(targets: np.ndarray, past_only: np.ndarray):
    outputs = list(
        FORECASTER.predict_batch(
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
            "zeroCostInfrastructure": True,
            "gpuDurationCapSeconds": GPU_DURATION_SECONDS,
        },
        **extra,
    }


WEIGHT_PATH = hf_hub_download(
    repo_id=CHECKPOINT,
    filename="model.safetensors",
    revision=CHECKPOINT_REVISION,
)
ACTUAL_WEIGHT_SHA256 = _sha256_file(WEIGHT_PATH)
if ACTUAL_WEIGHT_SHA256 != EXPECTED_WEIGHT_SHA256:
    raise RuntimeError(
        f"TIMESFM_WEIGHT_SHA256_MISMATCH:{ACTUAL_WEIGHT_SHA256}!={EXPECTED_WEIGHT_SHA256}"
    )

torch.set_grad_enabled(False)
FORECASTER = TimesFM3Evaluator(
    ModelConfig(
        checkpoint_path=CHECKPOINT,
        revision=CHECKPOINT_REVISION,
        per_core_batch_size=1,
        device="cuda",
    )
)


def status() -> dict[str, Any]:
    return _state()


@spaces.GPU(duration=GPU_DURATION_SECONDS)
def run_stage_a() -> dict[str, Any]:
    current = _state()
    if current["status"] == "RUNNING":
        return current

    _set_state(
        status="RUNNING",
        startedAt=_now(),
        finishedAt=None,
        currentStep="TimesFM 3.0 · ZeroGPU causal smoke",
        exitCode=None,
        output="[ZeroGPU] checkpoint verified; running deterministic causal smoke\n",
        result=None,
        error=None,
    )

    try:
        np.random.seed(20261004)
        torch.manual_seed(20261004)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(20261004)

        targets, past_only, forbidden_future = _fixture()
        information_cutoff = targets.shape[-1]
        full_with_future = np.concatenate([targets, forbidden_future], axis=-1)
        causal_targets = full_with_future[:, :information_cutoff]
        causal_hash_matches = _hash_array(causal_targets) == _hash_array(targets)

        forecast_a, quantiles_a = _forecast(causal_targets, past_only)
        forecast_b, quantiles_b = _forecast(causal_targets.copy(), past_only.copy())

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
            "checkpointWeightSha256Matches": ACTUAL_WEIGHT_SHA256 == EXPECTED_WEIGHT_SHA256,
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
                "python": platform.python_version(),
                "platform": platform.platform(),
                "device": "cuda",
                "torchVersion": getattr(torch, "__version__", "unknown"),
                "timesfmVersion": PACKAGE_VERSION,
                "runner": "HUGGING_FACE_ZEROGPU",
            },
            checks=checks,
            evidence={
                "actualWeightSha256": ACTUAL_WEIGHT_SHA256,
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
        return _set_state(
            status="PASSED" if passed else "FAILED",
            finishedAt=_now(),
            currentStep=None,
            exitCode=0 if passed else 2,
            output="[ZeroGPU] causal smoke complete\n",
            result=result,
            error=None if passed else "FAIL_STAGE_A_TECHNICAL_SMOKE",
        )
    except Exception as exc:
        result = _result(
            "BLOCKED_OR_FAILED_STAGE_A_TECHNICAL_SMOKE",
            error=f"{type(exc).__name__}:{exc}",
            runtime={
                "python": platform.python_version(),
                "platform": platform.platform(),
                "runner": "HUGGING_FACE_ZEROGPU",
            },
        )
        return _set_state(
            status="FAILED",
            finishedAt=_now(),
            currentStep=None,
            exitCode=1,
            output="[ZeroGPU] smoke failed\n",
            result=result,
            error=result["error"],
        )


with gr.Blocks() as demo:
    gr.Markdown(
        "### TimesFM 3.0 · Stage A runner\n"
        "Research-only technical endpoint. No market data, no economic outcomes, no production authority."
    )
    status_button = gr.Button("Status", visible=False)
    run_button = gr.Button("Run Stage A", visible=False)
    status_output = gr.JSON(visible=False)
    run_output = gr.JSON(visible=False)

    status_button.click(status, outputs=status_output, api_name="status", queue=False)
    run_button.click(run_stage_a, outputs=run_output, api_name="run_stage_a", concurrency_limit=1)

demo.queue(default_concurrency_limit=1).launch()
