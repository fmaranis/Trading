#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

JOB_ID = "timesfm-stage-a-smoke-v1"
MARKER = "TIMESFM_STAGE_A_SMOKE_RESULT"
SMOKE = pathlib.Path("/app/backend/scripts/timesfm_stage_a_smoke.py")
STATE_DIR = pathlib.Path(os.getenv("TIMESFM_RUNNER_STATE_DIR", "/data"))
STATE_PATH = STATE_DIR / f"{JOB_ID}.json"
PORT = int(os.getenv("PORT", "8080"))
TOKEN = os.getenv("TIMESFM_RUNNER_TOKEN", "").strip()
MAX_OUTPUT = 1_500_000
LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def empty_state() -> dict[str, Any]:
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
    }


def save_state(state: dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    tmp.replace(STATE_PATH)


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return empty_state()
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return empty_state()
        return {**empty_state(), **data, "jobId": JOB_ID}
    except Exception:
        return empty_state()


def reconcile_after_runner_restart() -> None:
    with LOCK:
        state = load_state()
        if state["status"] == "RUNNING":
            state.update(
                status="FAILED",
                finishedAt=now_iso(),
                currentStep=None,
                exitCode=1,
                error="TIMESFM_RUNNER_RESTARTED_DURING_JOB",
            )
            save_state(state)


def append_output(text: str) -> None:
    with LOCK:
        state = load_state()
        state["output"] = (str(state.get("output") or "") + text)[-MAX_OUTPUT:]
        save_state(state)


def extract_result(output: str) -> dict[str, Any] | None:
    marker_index = output.rfind(MARKER)
    if marker_index < 0:
        return None
    tail = output[marker_index + len(MARKER):]
    start = tail.find("{")
    if start < 0:
        return None
    try:
        return json.loads(tail[start:].strip())
    except Exception:
        return None


def run_smoke() -> None:
    env = {
        **os.environ,
        "PYTHONUNBUFFERED": "1",
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "TIMESFM_STAGE_A_DEVICE": os.getenv("TIMESFM_STAGE_A_DEVICE", "cpu"),
    }
    try:
        proc = subprocess.Popen(
            [sys.executable, str(SMOKE)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            append_output(line)
        code = proc.wait()
        with LOCK:
            state = load_state()
            result = extract_result(str(state.get("output") or ""))
            passed = code == 0 and result is not None and result.get("status") == "PASS_STAGE_A_TECHNICAL_SMOKE"
            state.update(
                status="PASSED" if passed else "FAILED",
                finishedAt=now_iso(),
                currentStep=None,
                exitCode=code,
                result=result,
                error=None if passed else (
                    (result or {}).get("error")
                    or f"TIMESFM_REMOTE_SMOKE_EXIT_{code}"
                ),
            )
            save_state(state)
    except Exception as exc:
        with LOCK:
            state = load_state()
            state.update(
                status="FAILED",
                finishedAt=now_iso(),
                currentStep=None,
                exitCode=1,
                error=f"{type(exc).__name__}:{exc}",
            )
            save_state(state)


def start_job() -> tuple[int, dict[str, Any]]:
    with LOCK:
        state = load_state()
        if state["status"] == "RUNNING":
            return 409, state
        state = empty_state()
        state.update(
            status="RUNNING",
            startedAt=now_iso(),
            currentStep="TimesFM 3.0 · checkpoint + smoke causal",
        )
        save_state(state)
    threading.Thread(target=run_smoke, daemon=True, name="timesfm-stage-a-smoke").start()
    return 202, load_state()


class Handler(BaseHTTPRequestHandler):
    server_version = "TimesFMRunner/1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[runner] {self.address_string()} {fmt % args}", flush=True)

    def json_response(self, status: int, payload: dict[str, Any]) -> None:
        body = (json.dumps(payload) + "\n").encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        if not TOKEN:
            return False
        return self.headers.get("Authorization", "") == f"Bearer {TOKEN}"

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self.json_response(200, {"ok": True, "runner": "timesfm-3.0-stage-a"})
            return
        if not self.authorized():
            self.json_response(401, {"error": "UNAUTHORIZED"})
            return
        if self.path == f"/v1/jobs/{JOB_ID}":
            with LOCK:
                self.json_response(200, load_state())
            return
        self.json_response(404, {"error": "NOT_FOUND"})

    def do_POST(self) -> None:
        if not self.authorized():
            self.json_response(401, {"error": "UNAUTHORIZED"})
            return
        if self.path == f"/v1/jobs/{JOB_ID}":
            status, state = start_job()
            self.json_response(status, state)
            return
        self.json_response(404, {"error": "NOT_FOUND"})


def main() -> int:
    if not TOKEN:
        print("TIMESFM_RUNNER_TOKEN is required", file=sys.stderr)
        return 2
    if not SMOKE.exists():
        print(f"Smoke runner not found: {SMOKE}", file=sys.stderr)
        return 2
    reconcile_after_runner_restart()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"TimesFM runner listening on :{PORT}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
