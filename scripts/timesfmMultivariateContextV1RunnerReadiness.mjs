const DEFAULT_TIMESFM_ZERO_GPU_URL = 'https://fmaranis-timesfm-stage-a.hf.space';

function parseGradioComplete(payload){
  for(const block of String(payload).split(/\r?\n\r?\n/)){
    const lines=block.split(/\r?\n/);
    const event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim();
    const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n');
    if(event==='error') throw new Error('TIMESFM_MULTIVARIATE_STATUS_EVENT_ERROR:'+(data||'unknown'));
    if(event==='complete'){
      const decoded=JSON.parse(data||'null');
      return Array.isArray(decoded)?decoded[0]:decoded;
    }
  }
  throw new Error('TIMESFM_MULTIVARIATE_STATUS_COMPLETE_MISSING');
}

async function callStatus(base,timeoutMs){
  const endpoint='multivariate_context_status';
  const submit=await fetch(`${base}/gradio_api/call/${endpoint}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({data:[]}),
    signal:AbortSignal.timeout(Math.min(timeoutMs,30_000))
  });
  if(!submit.ok){
    const detail=await submit.text();
    throw new Error(`TIMESFM_MULTIVARIATE_STATUS_SUBMIT_FAILED:${submit.status}:${detail.slice(0,300)}`);
  }
  const accepted=await submit.json();
  if(!accepted?.event_id) throw new Error('TIMESFM_MULTIVARIATE_STATUS_EVENT_ID_MISSING');
  const response=await fetch(`${base}/gradio_api/call/${endpoint}/${encodeURIComponent(accepted.event_id)}`,{
    headers:{Accept:'text/event-stream'},
    signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response.ok){
    const detail=await response.text();
    throw new Error(`TIMESFM_MULTIVARIATE_STATUS_RESULT_FAILED:${response.status}:${detail.slice(0,300)}`);
  }
  return parseGradioComplete(await response.text());
}

export function validateTimesFmMultivariateRunnerStatus(status){
  if(!status || status.study!=='TIMESFM_MULTIVARIATE_CONTEXT_V1') throw new Error('TIMESFM_MULTIVARIATE_RUNNER_STUDY_INVALID');
  if(status.status!=='READY_TIMESFM_MULTIVARIATE_CONTEXT_V1') throw new Error('TIMESFM_MULTIVARIATE_RUNNER_STATUS_INVALID');
  const checks={
    apiVersion:status.apiVersion===2,
    maxAnchorsPerCall:status.maxAnchorsPerCall===8,
    gpuDurationSeconds:status.gpuDurationSeconds===120,
    targetCount:status.targetCount===9,
    pastOnlyCovariateCount:status.pastOnlyCovariateCount===23,
    contextLength:status.contextLength===512,
    forecastHorizon:status.forecastHorizon===60,
    productionAuthority:status.productionAuthority===false,
    productionDefault:status.productionDefault==='LEGACY'
  };
  if(Object.values(checks).some(value=>value!==true)){
    throw new Error('TIMESFM_MULTIVARIATE_RUNNER_VERSION_REQUIRED:'+JSON.stringify({status,checks}));
  }
  return checks;
}

export async function checkTimesFmMultivariateRunner(options = {}) {
  const base = String(options.baseUrl || process.env.TIMESFM_RUNNER_URL || DEFAULT_TIMESFM_ZERO_GPU_URL)
    .trim()
    .replace(/\/$/, '');
  const timeoutMs=Number(options.timeoutMs||15_000);

  const infoResponse = await fetch(`${base}/gradio_api/info`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const infoText = await infoResponse.text();
  if (!infoResponse.ok) {
    throw new Error(`TIMESFM_MULTIVARIATE_RUNNER_INFO_FAILED:${infoResponse.status}:${infoText.slice(0,300)}`);
  }
  const infoPayload = JSON.parse(infoText);
  const serialized = JSON.stringify(infoPayload);
  if (!serialized.includes('multivariate_context_predict') || !serialized.includes('multivariate_context_status')) {
    throw new Error('TIMESFM_MULTIVARIATE_RUNNER_ENDPOINT_REQUIRED');
  }

  const status=await callStatus(base,timeoutMs);
  const checks=validateTimesFmMultivariateRunnerStatus(status);
  return {
    status: 'PASS_TIMESFM_MULTIVARIATE_RUNNER_READY',
    endpoint: 'multivariate_context_predict',
    statusEndpoint:'multivariate_context_status',
    baseUrl: base,
    remoteStatus:status,
    checks
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
