const DEFAULT_TIMESFM_ZERO_GPU_URL = 'https://fmaranis-timesfm-stage-a.hf.space';
const HF_ZERO_GPU_QUOTA_URL = 'https://huggingface.co/api/spaces/zero-gpu/quota';
export const TIMESFM_MULTIVARIATE_CONTEXT_STUDY = 'TIMESFM_MULTIVARIATE_CONTEXT_V1';
export const TIMESFM_MULTIVARIATE_MAX_ANCHORS_PER_REMOTE_CALL = 8;
export const TIMESFM_MULTIVARIATE_MIN_BATCH_QUOTA_SECONDS = 70;

function hfToken(){
  const value=String(
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_TOKEN ||
    process.env.HUGGING_FACE_HUB_TOKEN ||
    ''
  ).trim();
  return value||null;
}

function authHeaders(extra={}){
  const token=hfToken();
  return token?{...extra,Authorization:`Bearer ${token}`}:extra;
}

export async function fetchTimesFmZeroGpuQuota(options={}){
  const token=hfToken();
  if(!token) throw new Error('TIMESFM_HF_TOKEN_REQUIRED');
  const timeoutMs=Math.max(5_000,Number(options.timeoutMs||15_000));
  const response=await fetch(HF_ZERO_GPU_QUOTA_URL,{
    headers:authHeaders({Accept:'application/json'}),
    signal:AbortSignal.timeout(timeoutMs)
  });
  const text=await response.text();
  if(!response.ok){
    if(response.status===401||response.status===403){
      throw new Error(`TIMESFM_HF_TOKEN_QUOTA_PERMISSION_REQUIRED:${response.status}`);
    }
    throw new Error(`TIMESFM_ZERO_GPU_QUOTA_FAILED:${response.status}:${text.slice(0,300)}`);
  }
  const payload=JSON.parse(text);
  const base=Number(payload?.base);
  const remaining=Number(payload?.current);
  if(!Number.isFinite(base)||!Number.isFinite(remaining)) throw new Error('TIMESFM_ZERO_GPU_QUOTA_RESPONSE_INVALID');
  return {
    base,
    remaining,
    resetsAt:payload?.resetsAt?String(payload.resetsAt):null,
    overquotaUsed:payload?.overquotaUsed==null?null:Number(payload.overquotaUsed)
  };
}

export function parseGradioComplete(payload){
  for(const block of String(payload).split(/\r?\n\r?\n/)){
    const lines=block.split(/\r?\n/);
    const event=lines.find(line=>line.startsWith('event:'))?.slice(6).trim();
    const data=lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n');
    if(event==='error') throw new Error('TIMESFM_MV_V1_ZEROGPU_EVENT_ERROR:'+(data||'unknown'));
    if(event==='complete'){
      const decoded=JSON.parse(data||'null');
      return Array.isArray(decoded)?decoded[0]:decoded;
    }
  }
  throw new Error('TIMESFM_MV_V1_ZEROGPU_COMPLETE_MISSING');
}

async function callSingleBatch(base,endpoint,payload,timeoutMs){
  const submit=await fetch(`${base}/gradio_api/call/${endpoint}`,{
    method:'POST',
    headers:authHeaders({'Content-Type':'application/json'}),
    body:JSON.stringify({data:[payload]}),
    signal:AbortSignal.timeout(Math.min(timeoutMs,30_000))
  });
  if(!submit.ok){
    const detail=await submit.text();
    if(submit.status===404) throw new Error('TIMESFM_MULTIVARIATE_RUNNER_ENDPOINT_REQUIRED');
    if(submit.status===401||submit.status===403) throw new Error(`TIMESFM_HF_TOKEN_SPACE_AUTH_FAILED:${submit.status}`);
    throw new Error(`TIMESFM_MV_V1_ZEROGPU_SUBMIT_FAILED:${submit.status}:${detail.slice(0,500)}`);
  }
  const accepted=await submit.json();
  if(!accepted?.event_id) throw new Error('TIMESFM_MV_V1_ZEROGPU_EVENT_ID_MISSING');

  const response=await fetch(`${base}/gradio_api/call/${endpoint}/${encodeURIComponent(accepted.event_id)}`,{
    headers:authHeaders({Accept:'text/event-stream'}),
    signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response.ok){
    const detail=await response.text();
    throw new Error(`TIMESFM_MV_V1_ZEROGPU_RESULT_FAILED:${response.status}:${detail.slice(0,500)}`);
  }

  const result=parseGradioComplete(await response.text());
  if(!result || result.study!==TIMESFM_MULTIVARIATE_CONTEXT_STUDY || result.status!=='PASS_TIMESFM_MULTIVARIATE_CONTEXT_V1_INFERENCE'){
    throw new Error('TIMESFM_MV_V1_ZEROGPU_RESPONSE_INVALID');
  }
  if(!Array.isArray(result.anchors) || result.anchors.length!==payload.anchors.length){
    throw new Error('TIMESFM_MV_V1_ZEROGPU_ANCHOR_COUNT_MISMATCH');
  }
  return result;
}

export async function callTimesFmMultivariateContextV1(payload,options={}){
  const base=String(options.baseUrl||process.env.TIMESFM_RUNNER_URL||DEFAULT_TIMESFM_ZERO_GPU_URL).trim().replace(/\/$/,'');
  const timeoutMs=Math.max(30_000,Number(options.timeoutMs||process.env.TIMESFM_RUNNER_TIMEOUT_MS||600_000));
  if(!hfToken()) throw new Error('TIMESFM_HF_TOKEN_REQUIRED');
  if(!payload || payload.study!==TIMESFM_MULTIVARIATE_CONTEXT_STUDY || !Array.isArray(payload.anchors) || payload.anchors.length===0){
    throw new Error('TIMESFM_MV_V1_PAYLOAD_INVALID');
  }

  const endpoint='multivariate_context_predict';
  const mergedAnchors=[];
  const batchRuntime=[];
  let canonicalModel=null;
  let canonicalProtocol=null;
  let canonicalRuntime=null;

  for(let start=0,batchIndex=0;start<payload.anchors.length;start+=TIMESFM_MULTIVARIATE_MAX_ANCHORS_PER_REMOTE_CALL,batchIndex++){
    const quotaBefore=await fetchTimesFmZeroGpuQuota({timeoutMs:Math.min(timeoutMs,15_000)});
    if(quotaBefore.remaining<TIMESFM_MULTIVARIATE_MIN_BATCH_QUOTA_SECONDS){
      throw new Error(
        `TIMESFM_ZERO_GPU_QUOTA_LOW:${quotaBefore.remaining}:${quotaBefore.resetsAt||'UNKNOWN_RESET'}`
      );
    }

    const anchors=payload.anchors.slice(start,start+TIMESFM_MULTIVARIATE_MAX_ANCHORS_PER_REMOTE_CALL);
    const batchPayload={...payload,anchors};
    const result=await callSingleBatch(base,endpoint,batchPayload,timeoutMs);

    if(canonicalModel==null) canonicalModel=result.model??null;
    if(canonicalProtocol==null) canonicalProtocol=result.protocol??null;
    if(canonicalRuntime==null) canonicalRuntime=result.runtime??null;

    mergedAnchors.push(...result.anchors);
    batchRuntime.push({
      batchIndex,
      anchors:anchors.length,
      firstAnchorId:anchors[0]?.anchorId??null,
      lastAnchorId:anchors.at(-1)?.anchorId??null,
      gpuDurationCapSeconds:result.runtime?.gpuDurationCapSeconds??null,
      quotaRemainingBefore:quotaBefore.remaining,
      quotaResetAt:quotaBefore.resetsAt
    });
  }

  if(mergedAnchors.length!==payload.anchors.length){
    throw new Error('TIMESFM_MV_V1_ZEROGPU_MERGED_ANCHOR_COUNT_MISMATCH');
  }
  const expectedOrder=payload.anchors.map(x=>String(x.anchorId));
  const actualOrder=mergedAnchors.map(x=>String(x.anchorId));
  if(expectedOrder.some((id,index)=>id!==actualOrder[index])){
    throw new Error('TIMESFM_MV_V1_ZEROGPU_ANCHOR_ORDER_MISMATCH');
  }

  const quotaAfter=await fetchTimesFmZeroGpuQuota({timeoutMs:Math.min(timeoutMs,15_000)});
  return {
    study:TIMESFM_MULTIVARIATE_CONTEXT_STUDY,
    status:'PASS_TIMESFM_MULTIVARIATE_CONTEXT_V1_INFERENCE',
    anchorCount:mergedAnchors.length,
    anchors:mergedAnchors,
    model:canonicalModel,
    protocol:canonicalProtocol,
    runtime:{
      ...(canonicalRuntime||{}),
      authenticatedZeroGpu:true,
      remoteBatching:{
        maxAnchorsPerCall:TIMESFM_MULTIVARIATE_MAX_ANCHORS_PER_REMOTE_CALL,
        batchCount:batchRuntime.length,
        batches:batchRuntime,
        quotaAfter
      }
    }
  };
}
