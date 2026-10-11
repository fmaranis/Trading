FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf-cache \
    TIMESFM_RUNNER_STATE_DIR=/data \
    PORT=8080

WORKDIR /app

COPY backend/requirements-timesfm.txt /app/backend/requirements-timesfm.txt

RUN python -m pip install --prefer-binary --index-url https://download.pytorch.org/whl/cpu "torch>=2.0.0" \
    && python -m pip install --prefer-binary -r /app/backend/requirements-timesfm.txt

COPY backend/scripts/timesfm_stage_a_smoke.py /app/backend/scripts/timesfm_stage_a_smoke.py

# Bake the exact frozen TimesFM checkpoint into the runner image. Runtime inference is
# offline and does not depend on the lifecycle or network access of the AI Studio app.
RUN python - <<'PY'
import hashlib
from huggingface_hub import hf_hub_download, snapshot_download

repo = "google/timesfm-3.0-pytorch"
revision = "24701cec1b1ea47232c0766e888855c9976ef62b"
expected = "a7592b0a8432baee54483254e5647856911ce69e09d09a9bb65904b2d98f17da"

snapshot_download(repo_id=repo, revision=revision)
weight = hf_hub_download(repo_id=repo, filename="model.safetensors", revision=revision)
digest = hashlib.sha256()
with open(weight, "rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
        digest.update(chunk)
actual = digest.hexdigest()
if actual != expected:
    raise SystemExit(f"TIMESFM_WEIGHT_SHA256_MISMATCH:{actual}!={expected}")
print("TimesFM frozen checkpoint cached and verified:", actual)
PY

COPY runner/timesfm/server.py /app/runner/timesfm/server.py

ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

EXPOSE 8080

CMD ["python", "/app/runner/timesfm/server.py"]
