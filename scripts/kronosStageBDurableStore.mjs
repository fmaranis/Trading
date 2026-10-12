// Kronos Stage B durable checkpoint boundary. Reuses the existing replay-results
// GitHub configuration; never uses main, GitHub Actions, or a parallel replay.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const KRONOS_PROGRESS_PATH = path.resolve(process.cwd(), '.runtime/kronos-stage-b-v1/progress.json');
export const KRONOS_REMOTE_PATH = 'validation-runs/kronos-stage-b-v1-progress.json';
const VERSION = 'KRONOS_STAGE_B_DIAGNOSTIC_V1';
const EXPECTED_ASSETS = new Set(['EUNL','SXR8','EQQQ','EXSA','IS3N','ZPRV','EXH1','IBCI','4GLD']);
const anchorPattern = /^(?:201[89]|202[0-4])Q[1-4]$|^2025Q[1-3]$/;

export function validateKronosProgress(value) {
  if (!value || value.version !== VERSION || !plain(value.completed) || !plain(value.partial))
    throw new Error('KRONOS_DURABLE_INVALID_SCHEMA');
  for (const [anchor,rows] of Object.entries(value.completed)) {
    if (!anchorPattern.test(anchor) || !Array.isArray(rows) || rows.length < 5 || rows.length > 8 ||
        new Set(rows.map(row=>row?.assetId)).size !== rows.length ||
        rows.some(row=> !plain(row) || !EXPECTED_ASSETS.has(row.assetId) ||
          row.assetId === 'EUNL' || !plain(row.horizons) || !plain(row.horizons['20']) ||
          !plain(row.horizons['60'])))
      throw new Error('KRONOS_DURABLE_INVALID_COMPLETED:' + anchor);
  }
  for (const [anchor,part] of Object.entries(value.partial)) {
    if (!anchorPattern.test(anchor) || !plain(part) || !plain(part.forecasts))
      throw new Error('KRONOS_DURABLE_INVALID_PARTIAL:' + anchor);
    if (value.completed[anchor]) throw new Error('KRONOS_DURABLE_DUPLICATE_ANCHOR:' + anchor);
    for (const [asset,paths] of Object.entries(part.forecasts)) {
      if (!EXPECTED_ASSETS.has(asset) || !Array.isArray(paths) || paths.length !== 20 ||
          paths.some(p=>p!==null && (!Array.isArray(p) || p.length !== 60 ||
            p.some(n=>typeof n !== 'number' || !Number.isFinite(n) || n<=0))))
        throw new Error('KRONOS_DURABLE_INVALID_PATHS:' + anchor + ':' + asset);
    }
    if (part.torchRngState !== undefined &&
      (!Array.isArray(part.torchRngState) || part.torchRngState.some(n=>!Number.isInteger(n)||n<0||n>255)))
      throw new Error('KRONOS_DURABLE_INVALID_TORCH_RNG:' + anchor);
  }
  return value;
}
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exact(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function pathCount(p) {
  return Object.values(p?.forecasts || {}).reduce((n,paths)=>n+paths.filter(x=>x!==null).length,0);
}
export function countKronosPaths(p) {
  validateKronosProgress(p);
  return Object.values(p.completed).reduce((n,rows)=>n+(rows.length+1)*20,0) +
    Object.values(p.partial).reduce((n,part)=>n+pathCount(part),0);
}
export function assertKronosMonotone(previous,next) {
  validateKronosProgress(previous); validateKronosProgress(next);
  if (countKronosPaths(next)<countKronosPaths(previous)) throw new Error('KRONOS_DURABLE_REGRESSION');
  for (const [anchor,rows] of Object.entries(previous.completed)) {
    if (!exact(rows,next.completed[anchor])) throw new Error('KRONOS_DURABLE_COMPLETED_DIVERGENCE:' + anchor);
  }
  for (const [anchor,part] of Object.entries(previous.partial)) {
    if (next.completed[anchor]) {
      if (Object.keys(part.forecasts).length !== next.completed[anchor].length+1 ||
          Object.values(part.forecasts).some(paths=>paths.some(p=>p===null)))
        throw new Error('KRONOS_DURABLE_INCOMPLETE_TO_COMPLETED:' + anchor);
      continue;
    }
    const updated=next.partial[anchor];
    if (!updated) throw new Error('KRONOS_DURABLE_LOST_PARTIAL:' + anchor);
    for (const [asset,paths] of Object.entries(part.forecasts)) {
      const newPaths=updated.forecasts[asset];
      if (!newPaths || paths.some((p,i)=>p!==null&&!exact(p,newPaths[i])))
        throw new Error('KRONOS_DURABLE_CHANGED_PATH:' + anchor + ':' + asset);
    }
  }
  return true;
}
const empty=()=>({version:VERSION,completed:{},partial:{}});
const hash=(v)=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function config() {
  const token=process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  if (!token) throw new Error('KRONOS_DURABLE_GITHUB_TOKEN_REQUIRED');
  const repository=(process.env.GITHUB_REPLAY_SYNC_REPOSITORY||'fmaranis/Trading').trim();
  const branch=(process.env.GITHUB_REPLAY_SYNC_BRANCH||'replay-results').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('KRONOS_DURABLE_BAD_REPOSITORY');
  if (!branch || !/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..') || branch.startsWith('/') ||
       branch.endsWith('/') || branch === 'main' || branch === 'master')
    throw new Error('KRONOS_DURABLE_UNSAFE_BRANCH');
  return {token,repository,branch};
}
function headers(c) {
  return {Accept:'application/vnd.github+json',Authorization:'Bearer '+c.token,'Content-Type':'application/json',
   'User-Agent':'fmaranis-trading-kronos-stage-b', 'X-GitHub-Api-Version':'2022-11-28'};
}
async function api(c,uri,init={}) {
  const response=await fetch('https://api.github.com/repos/'+c.repository+uri,{
    ...init,headers:headers(c),signal:AbortSignal.timeout(30000)
  });
  return response;
}
async function readRemote(c) {
  const url='/contents/'+KRONOS_REMOTE_PATH+'?ref='+encodeURIComponent(c.branch);
  const response=await api(c,url);
  if (response.status===404) {
    // A missing branch is not a valid empty checkpoint.
    const branchCheck=await api(c,'/branches/'+encodeURIComponent(c.branch));
    if (!branchCheck.ok) throw new Error('KRONOS_DURABLE_BRANCH_MISSING_OR_UNREACHABLE:'+branchCheck.status);
    return {progress:null,sha:null};
  }
  if (!response.ok) throw new Error('KRONOS_DURABLE_READ_FAILED:'+response.status);
  const json=await response.json();
  if(typeof json?.sha!=='string'||typeof json?.content!=='string'||json.encoding!=='base64')
    throw new Error('KRONOS_DURABLE_INVALID_GITHUB_RESPONSE');
  const decoded=Buffer.from(json.content.replace(/\s/g,''),'base64').toString('utf8');
  const progress=validateKronosProgress(JSON.parse(decoded));
  return {progress,sha:json.sha};
}
export async function readRemoteKronosCheckpoint() {
  const c=config();
  return (await readRemote(c)).progress;
}
function local() {
  if(!fs.existsSync(KRONOS_PROGRESS_PATH)) return null;
  return validateKronosProgress(JSON.parse(fs.readFileSync(KRONOS_PROGRESS_PATH,'utf8')));
}
function writeLocal(progress) {
  validateKronosProgress(progress);
  fs.mkdirSync(path.dirname(KRONOS_PROGRESS_PATH),{recursive:true});
  const temp=KRONOS_PROGRESS_PATH+'.bootstrap.tmp';
  const handle=fs.openSync(temp,'w');
  try { fs.writeFileSync(handle,JSON.stringify(progress)); fs.fsyncSync(handle); }
  finally { fs.closeSync(handle); }
  fs.renameSync(temp,KRONOS_PROGRESS_PATH);
}
async function writeRemote(c,progress,sha) {
  const body={message:'Checkpoint KRONOS_STAGE_B_DIAGNOSTIC_V1 · '+countKronosPaths(progress)+' saved paths',
    content:Buffer.from(JSON.stringify(progress)).toString('base64'),branch:c.branch};
  if(sha) body.sha=sha;
  const response=await api(c,'/contents/'+KRONOS_REMOTE_PATH,{method:'PUT',body:JSON.stringify(body)});
  if(!response.ok) throw new Error('KRONOS_DURABLE_WRITE_FAILED:'+response.status);
  const result=await response.json();
  if(typeof result?.content?.sha!=='string') throw new Error('KRONOS_DURABLE_MISSING_COMMIT_ACK');
  // Acknowledged commit is not enough: verify read-after-write.
  const verify=await readRemote(c);
  if(!verify.progress || hash(verify.progress)!==hash(progress))
    throw new Error('KRONOS_DURABLE_REMOTE_VERIFY_FAILED');
  return verify;
}
export async function bootstrapKronosDurableState() {
  const c=config(), remote=await readRemote(c), existing=local();
  if(!remote.progress && !existing) {
    const start=empty();
    await writeRemote(c,start,null);
    writeLocal(start);
    return {restored:0,source:'NEW_REMOTE_BASELINE'};
  }
  if(!remote.progress) {
    await writeRemote(c,existing,null);
    return {restored:countKronosPaths(existing),source:'LOCAL_RECOVERED_TO_REMOTE'};
  }
  if(!existing) {
    writeLocal(remote.progress);
    return {restored:countKronosPaths(remote.progress),source:'GITHUB_REPLAY_RESULTS'};
  }
  const localAhead=(()=>{
    try {assertKronosMonotone(remote.progress,existing);return true;}catch{return false;}
  })();
  const remoteAhead=(()=>{
    try {assertKronosMonotone(existing,remote.progress);return true;}catch{return false;}
  })();
  if(localAhead && !remoteAhead) {
    await writeRemote(c,existing,remote.sha);
    return {restored:countKronosPaths(existing),source:'LOCAL_AHEAD_SYNCED'};
  }
  if(remoteAhead) {
    // Remote authority wins for equal or more advanced data.
    writeLocal(remote.progress);
    return {restored:countKronosPaths(remote.progress),source:'GITHUB_REPLAY_RESULTS'};
  }
  throw new Error('KRONOS_DURABLE_LOCAL_REMOTE_DIVERGED_MANUAL_RECONCILIATION');
}
export async function syncKronosDurableState() {
  const c=config(), existing=local();
  if(!existing) throw new Error('KRONOS_DURABLE_LOCAL_MISSING');
  const remote=await readRemote(c);
  if(!remote.progress) throw new Error('KRONOS_DURABLE_REMOTE_DISAPPEARED');
  assertKronosMonotone(remote.progress,existing);
  if(hash(existing)!==hash(remote.progress)) await writeRemote(c,existing,remote.sha);
  return {saved:countKronosPaths(existing),remote:true};
}
if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) {
  const action=process.argv[2];
  try {
    const outcome=action==='bootstrap'?await bootstrapKronosDurableState()
      :action==='sync'?await syncKronosDurableState()
      :null;
    if(!outcome) throw new Error('KRONOS_DURABLE_UNKNOWN_ACTION');
    console.log('[Kronos durable]',JSON.stringify(outcome));
  }catch(e){console.error('[Kronos durable]',e?.message||String(e));process.exitCode=1;}
}
