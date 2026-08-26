from __future__ import annotations
import hashlib
import importlib.metadata
from pathlib import Path
import sys
from fastapi import APIRouter
from ..models.responses import HealthResponse

router = APIRouter(prefix="/api/quant", tags=["Health"])


def get_package_version(package_name: str, fallback_obj: any = None) -> str:
    """Safely retrieves package version without inventing hardcoded mock versions."""
    try:
        return importlib.metadata.version(package_name)
    except Exception:
        if fallback_obj and hasattr(fallback_obj, "__version__"):
            return str(fallback_obj.__version__)
        return "unknown"


def compute_quant_environment_fingerprint(
    py_ver: str, vbt_ver: str, np_ver: str, pd_ver: str, nb_ver: str
) -> str:
    """Computes a deterministic SHA-256 fingerprint of the quantitative runtime environment."""
    payload = f"py={py_ver}|vbt={vbt_ver}|np={np_ver}|pd={pd_ver}|nb={nb_ver}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    return f"qenv_{digest}"


def check_lock_status() -> str:
    """Checks whether installed dependencies match backend/requirements.lock.txt."""
    try:
        lock_path = Path(__file__).resolve().parent.parent.parent / "requirements.lock.txt"
        if not lock_path.exists():
            return "UNKNOWN"
        with open(lock_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "==" in line:
                    pkg, exp_ver = line.split("==", 1)
                    pkg = pkg.strip().lower()
                    exp_ver = exp_ver.strip()
                    try:
                        installed_ver = importlib.metadata.version(pkg)
                        if installed_ver != exp_ver:
                            return "MISMATCH"
                    except Exception:
                        return "MISMATCH"
        return "MATCH"
    except Exception:
        return "UNKNOWN"


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Health check endpoint returning auditable runtime versions and environment fingerprint."""
    import numpy as np
    import pandas as pd
    import vectorbt as vbt

    try:
        import numba
        nb_version = str(getattr(numba, "__version__", "unknown"))
    except ImportError:
        nb_version = "not_installed"

    py_version = sys.version.split()[0]
    vbt_version = get_package_version("vectorbt", vbt)
    np_version = str(getattr(np, "__version__", "unknown"))
    pd_version = str(getattr(pd, "__version__", "unknown"))

    qenv_fp = compute_quant_environment_fingerprint(
        py_version, vbt_version, np_version, pd_version, nb_version
    )

    return HealthResponse(
        status="ok",
        engine="vectorbt",
        pythonVersion=py_version,
        vectorbtVersion=vbt_version,
        numpyVersion=np_version,
        pandasVersion=pd_version,
        numbaVersion=nb_version,
        quantEnvironmentFingerprint=qenv_fp,
        environmentLockStatus=check_lock_status()
    )
