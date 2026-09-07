const fredKey = process.env.FRED_API_KEY?.trim();

if (!fredKey) {
  console.error('FORWARD_RISK_V11_PREFLIGHT_FAIL:FRED_API_KEY_REQUIRED');
  console.error('Configure FRED_API_KEY as a server-side secret before running the V11 blind validation.');
  console.error('The blind holdout has NOT been opened by this preflight.');
  process.exit(1);
}

if (!/^[a-z0-9]{32}$/.test(fredKey)) {
  console.error('FORWARD_RISK_V11_PREFLIGHT_FAIL:FRED_API_KEY_INVALID_FORMAT');
  console.error('FRED API keys are expected to be 32 lowercase alphanumeric characters.');
  console.error('The blind holdout has NOT been opened by this preflight.');
  process.exit(1);
}

console.log('forwardRiskV11RuntimePreflight: PASS');
console.log('FRED_API_KEY: configured server-side');
console.log('Blind holdout: still unopened; this step performs no market-data or ALFRED request.');
