# Replay runtime results

The historical replay UI keeps the complete audit locally:

- `validation-runs/latest.json` — latest full replay audit;
- `validation-runs/archive/` — timestamped full local archives.

Those runtime files are ignored by Git. When `GITHUB_REPLAY_SYNC_TOKEN` is configured server-side, **Guardar + publicar para ChatGPT** also writes a compact canonical projection to:

- repository: `fmaranis/Trading`;
- branch: `replay-results`;
- path: `validation-runs/latest-chatgpt.json`.

The compact projection preserves the replay configuration, summary, checkpoints, executions, positions, equity/cash path and the diagnostic fields needed from every signal (consensus, Entry Timing, MFE/giveback, deterioration streak, core/satellite classification and execution data). Verbose reasons are retained for material actions and WATCH signals.

No GitHub Action is involved. The GitHub credential is server-only and must never use a `VITE_` prefix or be placed in frontend code.
