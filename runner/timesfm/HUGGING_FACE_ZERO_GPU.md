# TimesFM Stage A · Hugging Face ZeroGPU

This is the only approved hosted runner for TimesFM while the project has a permanent **0 EUR infrastructure** rule.

## Cost guard

- Use **ZeroGPU large only**.
- Do not select paid CPU/GPU hardware.
- Do not add credits.
- Do not enable any paid plan.
- The app intentionally makes unauthenticated API calls, so it uses the anonymous ZeroGPU quota and cannot consume paid credits.
- GPU execution is capped in code at 110 seconds.

## Space

Canonical target:

- Owner: `fmaranis`
- Space: `timesfm-stage-a`
- SDK: Gradio
- Hardware: ZeroGPU
- Visibility: Public

Expected URL:

`https://fmaranis-timesfm-stage-a.hf.space`

Space source is under `runner/timesfm/hf-space/`:

- `README.md`
- `app.py`
- `requirements.txt`

The Hugging Face ChatGPT connector currently exposes repository read access only, so creating/updating the Space itself cannot be performed through the connector.

## API contract

Gradio exposes:

- `POST /gradio_api/call/status`
- `GET /gradio_api/call/status/<event_id>`
- `POST /gradio_api/call/run_stage_a`
- `GET /gradio_api/call/run_stage_a/<event_id>`

The app backend maps this onto the existing validation state contract:

`IDLE -> RUNNING -> PASSED | FAILED`

No second validation engine is introduced. The existing `ResearchValidationCenter` remains the control surface.
