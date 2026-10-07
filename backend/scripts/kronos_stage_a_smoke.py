from __future__ import annotations

import hashlib
import json
import math
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path.cwd()
SOURCE_COMMIT = "67b630e67f6a18c9e9be918d9b4337c960db1e9a"
SOURCE_FILES = {
    "model/__init__.py": "718d07a21b53b7eff4a6564e6dfcae8ee7e8c6b1",
    "model/kronos.py": "ce4494ee0b3ec8751b09d5488c93bde995e008e0",
    "model/module.py": "f2a05158b48a56e9235426f6583e384360d761f9",
}
MODEL_REPO = "NeoQuasar/Kronos-small"
MODEL_REVISION = "901c26c1332695a2a8f243eb2f37243a37bea320"
MODEL_SHA256 = "b082dfcbd8e8c142a725c8bbb99781802f38fec81210e13479effb32b3c3e020"
TOKENIZER_REPO = "NeoQuasar/Kronos-Tokenizer-base"
TOKENIZER_REVISION = "0e0117387f39004a9016484a186a908917e22426"
TOKENIZER_SHA256 = "59d85f6af76a2c3b8240ea06cb21db4213b4eeca053f246b23e29cf832fc6bee"
MARKER = "KRONOS_STAGE_A_SMOKE_V1_RESULT"
SEED_BASE = 20261007
PATH_COUNT = 4
LOOKBACK = 128
HORIZON = 5


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode("utf-8") + data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_pinned_source() -> tuple[Path, dict]:
    base = ROOT / ".runtime" / "kronos-source" / SOURCE_COMMIT
    verified = {}
    for relative, expected in SOURCE_FILES.items():
        target = base / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            url = f"https://raw.githubusercontent.com/shiyu-coder/Kronos/{SOURCE_COMMIT}/{relative}"
            request = urllib.request.Request(url, headers={"User-Agent": "Custodia-Kronos-Research/1.0"})
            with urllib.request.urlopen(request, timeout=60) as response:
                target.write_bytes(response.read())
        actual = git_blob_sha1(target.read_bytes())
        if actual != expected:
            raise RuntimeError(f"KRONOS_SOURCE_BLOB_MISMATCH:{relative}:{actual}:{expected}")
        verified[relative] = {"expected": expected, "actual": actual, "match": True}
    return base, verified


def synthetic_ohlcv(pd, np):
    rng = np.random.default_rng(20261007)
    dates = pd.bdate_range("2024-01-02", periods=LOOKBACK)
    log_ret = 0.0007 + rng.normal(0.0, 0.004, LOOKBACK)
    close = 100.0 * np.exp(np.cumsum(log_ret))
    open_ = close * np.exp(rng.normal(0.0, 0.0015, LOOKBACK))
    spread = np.abs(rng.normal(0.0025, 0.0010, LOOKBACK))
    high = np.maximum(open_, close) * (1.0 + spread)
    low = np.minimum(open_, close) * np.maximum(0.01, 1.0 - spread)
    volume = rng.integers(900_000, 1_800_000, LOOKBACK).astype(float)
    amount = volume * ((open_ + high + low + close) / 4.0)
    frame = pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "volume": volume, "amount": amount},
        index=dates,
    )
    future = pd.bdate_range(dates[-1] + pd.offsets.BDay(1), periods=HORIZON)
    return frame, pd.Series(dates), pd.Series(future)


def main():
    import numpy as np
    import pandas as pd
    import torch
    import huggingface_hub
    from huggingface_hub import snapshot_download

    torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
    source_root, source_verification = fetch_pinned_source()
    sys.path.insert(0, str(source_root))

    from model import Kronos, KronosPredictor, KronosTokenizer

    cache_dir = ROOT / ".runtime" / "kronos-hf-cache"
    model_dir = Path(snapshot_download(
        repo_id=MODEL_REPO,
        revision=MODEL_REVISION,
        allow_patterns=["config.json", "model.safetensors"],
        cache_dir=str(cache_dir),
    ))
    tokenizer_dir = Path(snapshot_download(
        repo_id=TOKENIZER_REPO,
        revision=TOKENIZER_REVISION,
        allow_patterns=["config.json", "model.safetensors"],
        cache_dir=str(cache_dir),
    ))

    model_weight = model_dir / "model.safetensors"
    tokenizer_weight = tokenizer_dir / "model.safetensors"
    model_hash = sha256_file(model_weight)
    tokenizer_hash = sha256_file(tokenizer_weight)
    if model_hash != MODEL_SHA256:
        raise RuntimeError(f"KRONOS_MODEL_SHA256_MISMATCH:{model_hash}:{MODEL_SHA256}")
    if tokenizer_hash != TOKENIZER_SHA256:
        raise RuntimeError(f"KRONOS_TOKENIZER_SHA256_MISMATCH:{tokenizer_hash}:{TOKENIZER_SHA256}")

    device = "cpu"
    tokenizer = KronosTokenizer.from_pretrained(str(tokenizer_dir))
    model = Kronos.from_pretrained(str(model_dir))
    tokenizer.eval()
    model.eval()
    predictor = KronosPredictor(model, tokenizer, device=device, max_context=512)

    frame, x_ts, y_ts = synthetic_ohlcv(pd, np)
    last_close = float(frame["close"].iloc[-1])

    def run_path(seed: int):
        np.random.seed(seed)
        torch.manual_seed(seed)
        pred = predictor.predict(
            df=frame,
            x_timestamp=x_ts,
            y_timestamp=y_ts,
            pred_len=HORIZON,
            T=1.0,
            top_k=0,
            top_p=0.9,
            sample_count=1,
            verbose=False,
        )
        values = pred[["open", "high", "low", "close", "volume", "amount"]].to_numpy(dtype=float)
        if values.shape != (HORIZON, 6) or not np.isfinite(values).all():
            raise RuntimeError("KRONOS_STAGE_A_NONFINITE_OR_SHAPE")
        closes = pred["close"].to_numpy(dtype=float)
        if np.any(closes <= 0):
            raise RuntimeError("KRONOS_STAGE_A_NONPOSITIVE_CLOSE")
        slope = float(np.polyfit(np.arange(HORIZON, dtype=float), np.log(closes), 1)[0])
        ret = float(closes[-1] / last_close - 1.0)
        return {
            "seed": seed,
            "close": [float(v) for v in closes],
            "returnPct": ret * 100.0,
            "logCloseSlopePerSession": slope,
        }

    first = run_path(SEED_BASE)
    repeated = run_path(SEED_BASE)
    repeatability = max(abs(a - b) for a, b in zip(first["close"], repeated["close"]))

    paths = [first] + [run_path(SEED_BASE + i) for i in range(1, PATH_COUNT)]
    matrix = np.array([p["close"] for p in paths], dtype=float)
    path_diversity = float(np.max(np.std(matrix, axis=0)))
    p_return_positive = float(np.mean([p["returnPct"] > 0 for p in paths]))
    p_slope_positive = float(np.mean([p["logCloseSlopePerSession"] > 0 for p in paths]))

    checks = {
        "sourcePinnedAndVerified": all(v["match"] for v in source_verification.values()),
        "modelWeightSha256Matches": model_hash == MODEL_SHA256,
        "tokenizerWeightSha256Matches": tokenizer_hash == TOKENIZER_SHA256,
        "syntheticOnlyNoMarketPrices": True,
        "fourIndividualPathsPreserved": len(paths) == PATH_COUNT,
        "sameSeedRepeatable": repeatability <= 1e-6,
        "differentSeedsProducePathDiversity": path_diversity > 1e-8,
        "probabilitiesFinite": math.isfinite(p_return_positive) and math.isfinite(p_slope_positive),
    }
    passed = all(checks.values())

    result = {
        "schemaVersion": 1,
        "study": "KRONOS_STAGE_A_SMOKE_V1",
        "status": "PASS_STAGE_A_TECHNICAL_SMOKE" if passed else "FAIL_STAGE_A_TECHNICAL_SMOKE",
        "source": {
            "repository": "shiyu-coder/Kronos",
            "commit": SOURCE_COMMIT,
            "license": "MIT",
            "verification": source_verification,
        },
        "model": {
            "repoId": MODEL_REPO,
            "revision": MODEL_REVISION,
            "weightSha256": model_hash,
            "tokenizerRepoId": TOKENIZER_REPO,
            "tokenizerRevision": TOKENIZER_REVISION,
            "tokenizerWeightSha256": tokenizer_hash,
            "maxContext": 512,
        },
        "runtime": {
            "python": sys.version.split()[0],
            "torch": torch.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "huggingfaceHub": huggingface_hub.__version__,
            "device": device,
        },
        "smoke": {
            "dataProvenance": "SYNTHETIC",
            "lookback": LOOKBACK,
            "horizon": HORIZON,
            "samplePaths": PATH_COUNT,
            "temperature": 1.0,
            "topP": 0.9,
            "topK": 0,
            "lastObservedClose": last_close,
            "pReturnPositive": p_return_positive,
            "pSlopePositive": p_slope_positive,
            "sameSeedMaxAbsDiff": repeatability,
            "pathDiversityStdMax": path_diversity,
            "paths": paths,
        },
        "checks": checks,
        "marketPricesFetched": False,
        "marketOutcomesOpened": False,
        "economicPolicyOpened": False,
        "productionDefault": "LEGACY",
        "productionAuthority": False,
        "nextAction": "STAGE_B_DIAGNOSTIC_ONLY" if passed else "STOP_TECHNICAL",
    }
    print(MARKER)
    print(json.dumps(result, indent=2))
    if not passed:
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(MARKER)
        print(json.dumps({
            "study": "KRONOS_STAGE_A_SMOKE_V1",
            "status": "BLOCKED_OR_TECHNICAL_FAILED",
            "error": str(exc),
            "marketPricesFetched": False,
            "marketOutcomesOpened": False,
            "economicPolicyOpened": False,
            "productionDefault": "LEGACY",
            "productionAuthority": False,
        }, indent=2))
        raise
