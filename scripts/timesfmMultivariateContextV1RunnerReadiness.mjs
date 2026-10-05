const DEFAULT_TIMESFM_ZERO_GPU_URL = 'https://fmaranis-timesfm-stage-a.hf.space';

export async function checkTimesFmMultivariateRunner(options = {}) {
  const base = String(options.baseUrl || process.env.TIMESFM_RUNNER_URL || DEFAULT_TIMESFM_ZERO_GPU_URL)
    .trim()
    .replace(/\/$/, '');
  const response = await fetch(`${base}/gradio_api/info`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(Number(options.timeoutMs || 15_000))
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`TIMESFM_MULTIVARIATE_RUNNER_INFO_FAILED:${response.status}:${text.slice(0,300)}`);
  }
  const payload = JSON.parse(text);
  const serialized = JSON.stringify(payload);
  if (!serialized.includes('multivariate_context_predict')) {
    throw new Error('TIMESFM_MULTIVARIATE_RUNNER_ENDPOINT_REQUIRED');
  }
  return {
    status: 'PASS_TIMESFM_MULTIVARIATE_RUNNER_READY',
    endpoint: 'multivariate_context_predict',
    baseUrl: base
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  checkTimesFmMultivariateRunner()
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error?.message ?? String(error));
      process.exitCode = 1;
    });
}
