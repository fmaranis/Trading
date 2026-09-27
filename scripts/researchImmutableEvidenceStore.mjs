import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, fingerprint, requireThat } from './fundamentalQualityFutureForwardV1Infrastructure.mjs';

// Same repository / replay-results convention as existing research stores; create-only, never overwrite a lock.
export class ImmutableEvidenceStore {
  constructor(token=process.env.GITHUB_REPLAY_SYNC_TOKEN, fetchImpl=fetch) {
    requireThat(typeof token==='string' && token.trim().length>0,'GITHUB_REPLAY_SYNC_TOKEN_REQUIRED');
    this.token=token;this.fetchImpl=fetchImpl;
  }
  url(key) {
    requireThat(/^[a-z0-9-]+$/.test(key),'EVIDENCE_KEY');
    return `https://api.github.com/repos/fmaranis/Trading/contents/validation-runs/fundamental-quality-future-forward-v1/${key}.json`;
  }
  headers(){return {Accept:'application/vnd.github+json',Authorization:`Bearer ${this.token}`,'Content-Type':'application/json','User-Agent':'Custodia-Research','X-GitHub-Api-Version':'2022-11-28'};}
  async read(key) {
    const r=await this.fetchImpl(this.url(key)+'?ref=replay-results',{headers:this.headers(),signal:AbortSignal.timeout(30000)});
    if(r.status===404)return null;
    requireThat(r.ok,`DURABLE_READ_HTTP_${r.status}`);
    const body=await r.json(); requireThat(body.encoding==='base64' && typeof body.content==='string','DURABLE_ENCODING');
    const packed=JSON.parse(Buffer.from(body.content.replace(/\n/g,''),'base64').toString());
    const value=JSON.parse(gunzipSync(Buffer.from(packed.gzipBase64,'base64')).toString());
    requireThat(fingerprint(value)===packed.sha256,'DURABLE_HASH_MISMATCH'); return value;
  }
  async create(key,value) {
    const existing=await this.read(key);
    if(existing){requireThat(fingerprint(existing)===fingerprint(value),'IMMUTABLE_EVIDENCE_CONFLICT');return {alreadyPresent:true,sha256:fingerprint(existing)};}
    const packed={sha256:fingerprint(value),gzipBase64:gzipSync(Buffer.from(JSON.stringify(value))).toString('base64')};
    const content=JSON.stringify(packed)+'\n'; requireThat(Buffer.byteLength(content)<900000,'DURABLE_ARTIFACT_TOO_LARGE');
    const r=await this.fetchImpl(this.url(key),{method:'PUT',headers:this.headers(),signal:AbortSignal.timeout(30000),
      body:JSON.stringify({message:`Record immutable Fundamental Quality evidence: ${key}`,branch:'replay-results',content:Buffer.from(content).toString('base64')})});
    // No sha supplied: GitHub rejects replacing an existing path, including concurrent creation.
    if(!r.ok){const concurrent=await this.read(key);requireThat(concurrent && fingerprint(concurrent)===fingerprint(value),`IMMUTABLE_CREATE_HTTP_${r.status}`);}
    const check=await this.read(key);requireThat(check && fingerprint(check)===fingerprint(value),'DURABLE_READBACK_FAILED');
    const dir=resolve(ROOT,'.runtime/fundamental-quality-future-forward-v1');mkdirSync(dir,{recursive:true});
    const file=resolve(dir,key+'.json');
    if(existsSync(file))requireThat(fingerprint(JSON.parse(readFileSync(file,'utf8')))===fingerprint(value),'LOCAL_RECOVERY_CONFLICT');
    else writeFileSync(file,JSON.stringify(value)+'\n',{flag:'wx'});
    return {alreadyPresent:false,sha256:fingerprint(value)};
  }
}
