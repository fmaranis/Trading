import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kronos-durable-'));
process.env.NODE_ENV='test';
process.env.KRONOS_STAGE_B_DURABLE_TEST='1';
process.env.KRONOS_STAGE_B_TEST_CHECKPOINT_PATH=path.join(dir,'progress.json');
process.env.GITHUB_REPLAY_SYNC_TOKEN='test-token';
process.env.GITHUB_REPLAY_SYNC_REPOSITORY='fmaranis/Trading';
process.env.GITHUB_REPLAY_SYNC_BRANCH='replay-results';

const {
  KRONOS_PROGRESS_PATH,validateKronosProgress,countKronosPaths,
  assertKronosMonotone,bootstrapKronosDurableState,syncKronosDurableState,
  readRemoteKronosCheckpoint
}=await import('../scripts/kronosStageBDurableStore.mjs');

const empty=()=>({version:'KRONOS_STAGE_B_DIAGNOSTIC_V1',completed:{},partial:{}});
const forecast=()=>Array.from({length:60},(_,i)=>100+i/10);
const initial=empty();
const partial=empty();
partial.partial['2018Q1']={forecasts:{EUNL:[forecast(),...Array(19).fill(null)]}};
assert.equal(countKronosPaths(initial),0);
assert.equal(countKronosPaths(partial),1);
assert.equal(assertKronosMonotone(initial,partial),true);
assert.throws(()=>assertKronosMonotone(partial,initial),/KRONOS_DURABLE_REGRESSION/);
const changed=JSON.parse(JSON.stringify(partial));
changed.partial['2018Q1'].forecasts.EUNL[0][0]=999;
assert.throws(()=>assertKronosMonotone(partial,changed),/KRONOS_DURABLE_CHANGED_PATH/);
assert.throws(()=>validateKronosProgress({...initial,partial:{'2018Q1':{forecasts:{EUNL:[[-1],...Array(19).fill(null)]}}}}),/KRONOS_DURABLE_INVALID_PATHS/);

let remote=null;
let sha=null;
let puts=0;
let simulateWriteFail=false;
const originalFetch=globalThis.fetch;
const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
globalThis.fetch=async (url,options={})=>{
  assert.match(String(url),/^https:\/\/api\.github\.com\/repos\/fmaranis\/Trading\//);
  assert.equal(options.headers.Authorization,'Bearer test-token');
  const uri=String(url);
  if(uri.includes('/branches/'))return respond(200,{name:'replay-results'});
  if(options.method==='PUT'){
    if(simulateWriteFail)return respond(503,{message:'unavailable'});
    const body=JSON.parse(options.body);
    assert.equal(body.branch,'replay-results');
    assert.ok(body.sha===undefined || body.sha===sha);
    remote=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));
    sha=crypto.createHash('sha1').update(JSON.stringify(remote)).digest('hex');
    puts++;
    return respond(201,{content:{sha},commit:{sha:'commit-test'}});
  }
  if(!remote)return respond(404,{message:'Not Found'});
  return respond(200,{sha,encoding:'base64',content:Buffer.from(JSON.stringify(remote)).toString('base64')});
};

try{
  assert.equal(KRONOS_PROGRESS_PATH,path.join(dir,'progress.json'));
  const first=await bootstrapKronosDurableState();
  assert.equal(first.source,'NEW_REMOTE_BASELINE');
  assert.equal(puts,1);
  assert.equal(countKronosPaths(await readRemoteKronosCheckpoint()),0);
  fs.writeFileSync(KRONOS_PROGRESS_PATH,JSON.stringify(partial));
  const pushed=await syncKronosDurableState();
  assert.equal(pushed.saved,1);
  assert.equal(puts,2);
  fs.unlinkSync(KRONOS_PROGRESS_PATH);
  const recovered=await bootstrapKronosDurableState();
  assert.equal(recovered.restored,1);
  assert.equal(recovered.source,'GITHUB_REPLAY_RESULTS');
  assert.deepEqual(JSON.parse(fs.readFileSync(KRONOS_PROGRESS_PATH,'utf8')),partial);
  assert.equal(puts,2,'restore must never generate a new commit');
  const progressed=JSON.parse(JSON.stringify(partial));
  progressed.partial['2018Q1'].forecasts.EUNL[1]=forecast();
  fs.writeFileSync(KRONOS_PROGRESS_PATH,JSON.stringify(progressed));
  simulateWriteFail=true;
  await assert.rejects(()=>syncKronosDurableState(),/KRONOS_DURABLE_WRITE_FAILED:503/);
  assert.equal(countKronosPaths(await readRemoteKronosCheckpoint()),1);
  assert.equal(countKronosPaths(JSON.parse(fs.readFileSync(KRONOS_PROGRESS_PATH,'utf8'))),2);
  simulateWriteFail=false;
  const salvage=await bootstrapKronosDurableState();
  assert.equal(salvage.source,'LOCAL_AHEAD_SYNCED');
  assert.equal(countKronosPaths(await readRemoteKronosCheckpoint()),2);
  const branch=process.env.GITHUB_REPLAY_SYNC_BRANCH;
  process.env.GITHUB_REPLAY_SYNC_BRANCH='main';
  await assert.rejects(()=>syncKronosDurableState(),/KRONOS_DURABLE_UNSAFE_BRANCH/);
  process.env.GITHUB_REPLAY_SYNC_BRANCH=branch;
  const token=process.env.GITHUB_REPLAY_SYNC_TOKEN;
  delete process.env.GITHUB_REPLAY_SYNC_TOKEN;
  await assert.rejects(()=>bootstrapKronosDurableState(),/KRONOS_DURABLE_GITHUB_TOKEN_REQUIRED/);
  process.env.GITHUB_REPLAY_SYNC_TOKEN=token;
  const diverged=JSON.parse(JSON.stringify(progressed));
  diverged.partial['2018Q1'].forecasts.EUNL[0][0]=999;
  fs.writeFileSync(KRONOS_PROGRESS_PATH,JSON.stringify(diverged));
  await assert.rejects(()=>bootstrapKronosDurableState(),/KRONOS_DURABLE_LOCAL_REMOTE_DIVERGED/);
  assert.equal(countKronosPaths(await readRemoteKronosCheckpoint()),2);
  console.log('kronosStageBDurableStore.unit: PASS — no external requests, no live checkpoint touched');
} finally {
  globalThis.fetch=originalFetch;
  fs.rmSync(dir,{recursive:true,force:true});
}
