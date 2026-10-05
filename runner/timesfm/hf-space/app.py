from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
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
STAGE_B_STUDY = "TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1"
STAGE_B_CONTEXT_LENGTH = 512
STAGE_B_HORIZON = 60
STAGE_B_EVALUATION_HORIZONS = (1, 5, 20, 60)
STAGE_B_MAX_CASES = 256
STAGE_B_GPU_DURATION_SECONDS = 80
MV_STUDY = "TIMESFM_MULTIVARIATE_CONTEXT_V1"
MV_CONTEXT_LENGTH = 512
MV_HORIZON = 60
MV_EVALUATION_HORIZONS = (1, 5, 20, 60)
MV_TARGET_COUNT = 9
MV_PAST_ONLY_COVARIATE_COUNT = 23
MV_MAX_ANCHORS = 31
MV_GPU_DURATION_SECONDS = 180

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
        per_core_batch_size=16,
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


def _coerce_stage_b_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict):
        raise ValueError("TIMESFM_STAGE_B_PAYLOAD_NOT_OBJECT")
    if payload.get("study") != STAGE_B_STUDY:
        raise ValueError("TIMESFM_STAGE_B_STUDY_INVALID")
    cases = payload.get("cases")
    if not isinstance(cases, list) or not (1 <= len(cases) <= STAGE_B_MAX_CASES):
        raise ValueError("TIMESFM_STAGE_B_CASE_COUNT_INVALID")
    forbidden_fragments = ("future", "outcome", "actual", "forwardreturn", "realized", "realised")
    for case in cases:
        if not isinstance(case, dict):
            raise ValueError("TIMESFM_STAGE_B_CASE_NOT_OBJECT")
        for key in case.keys():
            compact = str(key).replace("_", "").replace("-", "").lower()
            if any(fragment in compact for fragment in forbidden_fragments):
                raise ValueError(f"TIMESFM_STAGE_B_FORBIDDEN_FIELD:{key}")
    return payload


def _stage_b_context(case: dict[str, Any], key: str) -> np.ndarray:
    value = np.asarray(case.get(key), dtype=np.float32)
    if value.shape != (STAGE_B_CONTEXT_LENGTH,):
        raise ValueError(f"TIMESFM_STAGE_B_CONTEXT_SHAPE:{key}:{value.shape}")
    if not np.isfinite(value).all() or np.any(value <= 0):
        raise ValueError(f"TIMESFM_STAGE_B_CONTEXT_VALUES:{key}")
    return value


def _stage_b_points(path: np.ndarray) -> dict[str, float]:
    return {str(h): float(path[h - 1]) for h in STAGE_B_EVALUATION_HORIZONS}


def _stage_b_quantiles(values: np.ndarray) -> dict[str, list[float]]:
    return {
        str(h): [float(x) for x in values[h - 1].tolist()]
        for h in STAGE_B_EVALUATION_HORIZONS
    }


@spaces.GPU(duration=STAGE_B_GPU_DURATION_SECONDS)
def stage_b_predict(payload: Any) -> dict[str, Any]:
    request = _coerce_stage_b_payload(payload)
    cases = request["cases"]
    mv_contexts: list[np.ndarray] = []
    uv_contexts: list[np.ndarray] = []
    case_ids: list[str] = []

    for case in cases:
        case_id = str(case.get("caseId") or "").strip()
        if not case_id:
            raise ValueError("TIMESFM_STAGE_B_CASE_ID_MISSING")
        asset = _stage_b_context(case, "assetContext")
        core = _stage_b_context(case, "coreContext")
        case_ids.append(case_id)
        mv_contexts.append(np.stack([asset, core], axis=0))
        uv_contexts.append(asset)

    torch.set_grad_enabled(False)
    mv_outputs = list(
        FORECASTER.predict_batch(
            contexts=mv_contexts,
            horizon=STAGE_B_HORIZON,
            return_quantiles=True,
            use_symmetric_averaging=False,
            make_positive=False,
            sort_quantiles=True,
        )
    )
    uv_outputs = list(
        FORECASTER.predict_batch(
            contexts=uv_contexts,
            horizon=STAGE_B_HORIZON,
            return_quantiles=False,
            use_symmetric_averaging=False,
            make_positive=False,
            sort_quantiles=True,
        )
    )
    if len(mv_outputs) != len(cases) or len(uv_outputs) != len(cases):
        raise RuntimeError("TIMESFM_STAGE_B_OUTPUT_COUNT_INVALID")

    results: list[dict[str, Any]] = []
    for index, case_id in enumerate(case_ids):
        mv_forecast = np.asarray(mv_outputs[index].forecast, dtype=np.float32)
        mv_quantiles = np.asarray(mv_outputs[index].quantiles, dtype=np.float32)
        uv_forecast = np.asarray(uv_outputs[index].forecast, dtype=np.float32)
        if mv_forecast.shape != (2, STAGE_B_HORIZON):
            raise RuntimeError(f"TIMESFM_STAGE_B_MV_FORECAST_SHAPE:{mv_forecast.shape}")
        if mv_quantiles.shape != (2, STAGE_B_HORIZON, len(QUANTILES)):
            raise RuntimeError(f"TIMESFM_STAGE_B_MV_QUANTILE_SHAPE:{mv_quantiles.shape}")
        if uv_forecast.shape != (STAGE_B_HORIZON,):
            raise RuntimeError(f"TIMESFM_STAGE_B_UV_FORECAST_SHAPE:{uv_forecast.shape}")
        if not (np.isfinite(mv_forecast).all() and np.isfinite(mv_quantiles).all() and np.isfinite(uv_forecast).all()):
            raise RuntimeError("TIMESFM_STAGE_B_NON_FINITE_OUTPUT")

        results.append(
            {
                "caseId": case_id,
                "mvAssetPoint": _stage_b_points(mv_forecast[0]),
                "mvCorePoint": _stage_b_points(mv_forecast[1]),
                "mvAssetQuantiles": _stage_b_quantiles(mv_quantiles[0]),
                "mvAssetPath60": [float(x) for x in mv_forecast[0].tolist()],
                "uvAssetPoint": _stage_b_points(uv_forecast),
            }
        )

    return {
        "study": STAGE_B_STUDY,
        "status": "PASS_STAGE_B_INFERENCE_BATCH",
        "caseCount": len(results),
        "contextLength": STAGE_B_CONTEXT_LENGTH,
        "forecastHorizon": STAGE_B_HORIZON,
        "evaluationHorizons": list(STAGE_B_EVALUATION_HORIZONS),
        "model": {
            "package": "timesfm",
            "packageVersion": PACKAGE_VERSION,
            "checkpoint": CHECKPOINT,
            "checkpointRevision": CHECKPOINT_REVISION,
            "expectedWeightSha256": EXPECTED_WEIGHT_SHA256,
            "actualWeightSha256": ACTUAL_WEIGHT_SHA256,
        },
        "runtime": {
            "python": platform.python_version(),
            "device": "cuda",
            "torchVersion": getattr(torch, "__version__", "unknown"),
            "runner": "HUGGING_FACE_ZEROGPU",
            "gpuDurationCapSeconds": STAGE_B_GPU_DURATION_SECONDS,
        },
        "protocol": {
            "dataReceived": "CAUSAL_CONTEXT_ONLY",
            "futureOutcomesReceived": False,
            "marketDataFetchedBySpace": False,
            "productionAuthority": False,
            "productionDefault": "LEGACY",
            "zeroCostInfrastructure": True,
        },
        "cases": results,
    }


def _coerce_multivariate_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict):
        raise ValueError("TIMESFM_MV_V1_PAYLOAD_NOT_OBJECT")
    if payload.get("study") != MV_STUDY:
        raise ValueError("TIMESFM_MV_V1_STUDY_INVALID")
    protocol = payload.get("protocol")
    anchors = payload.get("anchors")
    if not isinstance(protocol, dict):
        raise ValueError("TIMESFM_MV_V1_PROTOCOL_NOT_OBJECT")
    if int(protocol.get("contextLength", 0)) != MV_CONTEXT_LENGTH:
        raise ValueError("TIMESFM_MV_V1_CONTEXT_LENGTH")
    if int(protocol.get("forecastHorizon", 0)) != MV_HORIZON:
        raise ValueError("TIMESFM_MV_V1_HORIZON")
    target_ids = protocol.get("targetIds")
    if not isinstance(target_ids, list) or len(target_ids) != MV_TARGET_COUNT or len(set(map(str, target_ids))) != MV_TARGET_COUNT:
        raise ValueError("TIMESFM_MV_V1_TARGET_IDS")
    if int(protocol.get("pastOnlyCovariateCount", -1)) != MV_PAST_ONLY_COVARIATE_COUNT:
        raise ValueError("TIMESFM_MV_V1_COVARIATE_COUNT")
    if not isinstance(anchors, list) or not (1 <= len(anchors) <= MV_MAX_ANCHORS):
        raise ValueError("TIMESFM_MV_V1_ANCHOR_COUNT")
    forbidden_fragments = ("outcome", "actual", "realized", "realised", "futureprice", "futurereturn")
    for anchor in anchors:
        if not isinstance(anchor, dict):
            raise ValueError("TIMESFM_MV_V1_ANCHOR_NOT_OBJECT")
        for key in anchor.keys():
            compact = str(key).replace("_", "").replace("-", "").lower()
            if any(fragment in compact for fragment in forbidden_fragments):
                raise ValueError(f"TIMESFM_MV_V1_FORBIDDEN_FIELD:{key}")
    return payload


def _mv_matrix(anchor: dict[str, Any], key: str, rows: int, cols: int, require_positive: bool) -> np.ndarray:
    value = np.asarray(anchor.get(key), dtype=np.float32)
    if value.shape != (rows, cols):
        raise ValueError(f"TIMESFM_MV_V1_SHAPE:{key}:{value.shape}:expected:{rows}x{cols}")
    if not np.isfinite(value).all():
        raise ValueError(f"TIMESFM_MV_V1_NON_FINITE:{key}")
    if require_positive and np.any(value <= 0):
        raise ValueError(f"TIMESFM_MV_V1_NON_POSITIVE:{key}")
    return value


def _mv_points(path: np.ndarray) -> dict[str, float]:
    return {str(h): float(path[h - 1]) for h in MV_EVALUATION_HORIZONS}


def _mv_quantiles(values: np.ndarray) -> dict[str, list[float]]:
    return {
        str(h): [float(x) for x in values[h - 1].tolist()]
        for h in MV_EVALUATION_HORIZONS
    }


def _mv_output_payload(output: Any, target_ids: list[str]) -> dict[str, Any]:
    forecast = np.asarray(output.forecast, dtype=np.float32)
    quantiles = np.asarray(output.quantiles, dtype=np.float32)
    if forecast.shape != (MV_TARGET_COUNT, MV_HORIZON):
        raise RuntimeError(f"TIMESFM_MV_V1_FORECAST_SHAPE:{forecast.shape}")
    if quantiles.shape != (MV_TARGET_COUNT, MV_HORIZON, len(QUANTILES)):
        raise RuntimeError(f"TIMESFM_MV_V1_QUANTILE_SHAPE:{quantiles.shape}")
    if not (np.isfinite(forecast).all() and np.isfinite(quantiles).all()):
        raise RuntimeError("TIMESFM_MV_V1_NON_FINITE_OUTPUT")
    return {
        "point": {
            str(target_ids[i]): _mv_points(forecast[i])
            for i in range(MV_TARGET_COUNT)
        },
        "quantiles": {
            str(target_ids[i]): _mv_quantiles(quantiles[i])
            for i in range(MV_TARGET_COUNT)
        },
    }


@spaces.GPU(duration=MV_GPU_DURATION_SECONDS)
def multivariate_context_predict(payload: Any) -> dict[str, Any]:
    request = _coerce_multivariate_payload(payload)
    protocol = request["protocol"]
    target_ids = [str(value) for value in protocol["targetIds"]]
    anchor_ids: list[str] = []
    contexts: list[np.ndarray] = []
    past_only_covariates: list[np.ndarray] = []

    for anchor in request["anchors"]:
        anchor_id = str(anchor.get("anchorId") or "").strip()
        if not anchor_id:
            raise ValueError("TIMESFM_MV_V1_ANCHOR_ID_MISSING")
        anchor_ids.append(anchor_id)
        contexts.append(
            _mv_matrix(
                anchor,
                "targetContext",
                MV_TARGET_COUNT,
                MV_CONTEXT_LENGTH,
                True,
            )
        )
        past_only_covariates.append(
            _mv_matrix(
                anchor,
                "pastOnlyCovariates",
                MV_PAST_ONLY_COVARIATE_COUNT,
                MV_CONTEXT_LENGTH,
                False,
            )
        )

    torch.set_grad_enabled(False)
    targets_only_outputs = list(
        FORECASTER.predict_batch(
            contexts=contexts,
            horizon=MV_HORIZON,
            past_only_covariates=None,
            past_future_covariates=None,
            return_quantiles=True,
            use_symmetric_averaging=False,
            make_positive=False,
            sort_quantiles=True,
        )
    )
    causal_context_outputs = list(
        FORECASTER.predict_batch(
            contexts=contexts,
            horizon=MV_HORIZON,
            past_only_covariates=past_only_covariates,
            past_future_covariates=None,
            return_quantiles=True,
            use_symmetric_averaging=False,
            make_positive=False,
            sort_quantiles=True,
        )
    )
    if len(targets_only_outputs) != len(anchor_ids) or len(causal_context_outputs) != len(anchor_ids):
        raise RuntimeError("TIMESFM_MV_V1_OUTPUT_COUNT_INVALID")

    results: list[dict[str, Any]] = []
    for index, anchor_id in enumerate(anchor_ids):
        results.append(
            {
                "anchorId": anchor_id,
                "targetsOnly": _mv_output_payload(targets_only_outputs[index], target_ids),
                "withCausalCovariates": _mv_output_payload(causal_context_outputs[index], target_ids),
            }
        )

    return {
        "study": MV_STUDY,
        "status": "PASS_TIMESFM_MULTIVARIATE_CONTEXT_V1_INFERENCE",
        "anchorCount": len(results),
        "contextLength": MV_CONTEXT_LENGTH,
        "forecastHorizon": MV_HORIZON,
        "evaluationHorizons": list(MV_EVALUATION_HORIZONS),
        "model": {
            "package": "timesfm",
            "packageVersion": PACKAGE_VERSION,
            "checkpoint": CHECKPOINT,
            "checkpointRevision": CHECKPOINT_REVISION,
            "expectedWeightSha256": EXPECTED_WEIGHT_SHA256,
            "actualWeightSha256": ACTUAL_WEIGHT_SHA256,
        },
        "runtime": {
            "python": platform.python_version(),
            "device": "cuda",
            "torchVersion": getattr(torch, "__version__", "unknown"),
            "runner": "HUGGING_FACE_ZEROGPU",
            "gpuDurationCapSeconds": MV_GPU_DURATION_SECONDS,
            "nativeMultivariate": True,
            "pastOnlyCovariates": True,
        },
        "protocol": {
            "targetVariates": MV_TARGET_COUNT,
            "pastOnlyCovariates": MV_PAST_ONLY_COVARIATE_COUNT,
            "totalVariatesWithContext": MV_TARGET_COUNT + MV_PAST_ONLY_COVARIATE_COUNT,
            "pastFutureCovariates": 0,
            "dataReceived": "CAUSAL_CONTEXT_ONLY",
            "futureOutcomesReceived": False,
            "marketDataFetchedBySpace": False,
            "productionAuthority": False,
            "productionDefault": "LEGACY",
            "zeroCostInfrastructure": True,
        },
        "anchors": results,
    }


with gr.Blocks() as demo:
    gr.Markdown(
        "### TimesFM 3.0 · Stage A runner\n"
        "Research-only technical endpoint. No market data, no economic outcomes, no production authority."
    )
    status_button = gr.Button("Status", visible=False)
    run_button = gr.Button("Run Stage A", visible=False)
    status_output = gr.JSON(visible=False)
    run_output = gr.JSON(visible=False)
    stage_b_input = gr.JSON(visible=False)
    stage_b_button = gr.Button("Run Stage B batch", visible=False)
    stage_b_output = gr.JSON(visible=False)
    mv_input = gr.JSON(visible=False)
    mv_button = gr.Button("Run TimesFM multivariate context V1", visible=False)
    mv_output = gr.JSON(visible=False)

    status_button.click(status, outputs=status_output, api_name="status", queue=False)
    run_button.click(run_stage_a, outputs=run_output, api_name="run_stage_a", concurrency_limit=1)
    stage_b_button.click(
        stage_b_predict,
        inputs=stage_b_input,
        outputs=stage_b_output,
        api_name="stage_b_predict",
        concurrency_limit=1,
    )
    mv_button.click(
        multivariate_context_predict,
        inputs=mv_input,
        outputs=mv_output,
        api_name="multivariate_context_predict",
        concurrency_limit=1,
    )

demo.queue(default_concurrency_limit=1).launch()
