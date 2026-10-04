# TimesFM runner · Railway deployment

Source of truth: `fmaranis/Trading/main`.

## Service

Create one Railway persistent service from the GitHub repository `fmaranis/Trading`, branch `main`.

Build configuration:

- Dockerfile path: `/runner/timesfm/Dockerfile`
- Healthcheck path: `/healthz`
- Healthcheck timeout: 300 s
- Restart policy: always
- Public networking: enabled; generate a Railway HTTPS domain
- Serverless/sleep: disabled for this service while a TimesFM job may be running

Runtime storage:

- Attach one Railway Volume at `/data`
- The volume stores the runner job state only.
- The frozen TimesFM checkpoint is baked into the Docker image and verified during build.

Required service variable:

- `TIMESFM_RUNNER_TOKEN`: long random bearer token generated for this runner only.

The runner listens on Railway's injected `PORT`; do not override it.

## App-side configuration

Configure these server-side secrets/variables in the AI Studio app backend:

- `TIMESFM_RUNNER_URL=https://<railway-domain>`
- `TIMESFM_RUNNER_TOKEN=<same-token-as-runner>`

Optional:

- `TIMESFM_RUNNER_TIMEOUT_MS=2700000`

Never expose the token with a `VITE_` prefix.

## Verification

Expected unauthenticated health response:

- `GET /healthz` -> HTTP 200

Authenticated job contract:

- `POST /v1/jobs/timesfm-stage-a-smoke-v1`
- `GET /v1/jobs/timesfm-stage-a-smoke-v1`

Expected lifecycle:

`IDLE -> RUNNING -> PASSED | FAILED`

The service accepts no arbitrary command or shell payload.

## Resource note

TimesFM 3.0 uses a ~1.32 GB checkpoint plus PyTorch/runtime memory. Railway Free is not a suitable target because its per-service RAM limit is currently 0.5 GB after trial. Use a plan/resource allocation that can hold the model comfortably; start with at least 4 GB RAM and inspect actual peak usage before reducing it.

Production allocation remains `LEGACY`; this runner has authority only for research jobs explicitly integrated by the app.
