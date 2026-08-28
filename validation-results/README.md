# Validation results

This directory is populated automatically by the recorded validation commands.

Current recorded commands:

- `npm run validate:aistudio` → `latest-aistudio.json` and `latest-broker-backtest-feasibility.json`.
- `npm run test:eodhd-shortlist` → `latest-eodhd-shortlist.json`.

The wrapper preserves the original console output, extracts the JSON result markers, writes the latest structured result with timestamp, Git HEAD and branch, and then attempts an isolated commit/push containing only the generated validation-result files.

If Git credentials are unavailable, validation itself is not invalidated: the files remain written in the local working tree and the wrapper reports the Git recording warning. Set `VALIDATION_AUTO_COMMIT=0` to disable the automatic commit/push explicitly.

These files are operational evidence. `PROJECT_STATE.md` remains the canonical narrative state and should reference the latest recorded validation rather than requiring chat copy/paste.
