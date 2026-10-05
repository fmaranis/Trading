import fs from 'node:fs';
import path from 'node:path';
import {
  createEmptyTimesFmProspectiveState,
  sha256Canonical,
  verifyTimesFmProspectiveState
} from './timesfmStageBProspectiveProtocol.mjs';

const LOCAL_CACHE_FILE = path.join(process.cwd(), '.runtime', 'timesfmStageBProspectiveV1.json');
const DEFAULT_REPOSITORY = 'fmaranis/Trading';
const DEFAULT_BRANCH = 'replay-results';
const REMOTE_PATH = 'validation-runs/timesfm-stage-b-prospective-confirmation-v1-state.json';
const REQUEST_TIMEOUT_MS = 30_000;

function target() {
  const repository = String(process.env.GITHUB_REPLAY_SYNC_REPOSITORY || DEFAULT_REPOSITORY).trim();
  const branch = String(process.env.GITHUB_REPLAY_SYNC_BRANCH || DEFAULT_BRANCH).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('TIMESFM_PROSPECTIVE_INVALID_REPOSITORY');
  if (!branch || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) throw new Error('TIMESFM_PROSPECTIVE_INVALID_BRANCH');
  return { repository, branch, path: REMOTE_PATH };
}

function token() {
  const value = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  if (!value) throw new Error('TIMESFM_PROSPECTIVE_GITHUB_TOKEN_REQUIRED');
  return value;
}

function headers(auth) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + auth,
    'Content-Type': 'application/json',
    'User-Agent': 'fmaranis-trading-timesfm-prospective-v1',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function mirror(state) {
  fs.mkdirSync(path.dirname(LOCAL_CACHE_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_CACHE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function loadTimesFmProspectiveDurableState(nowIso) {
  const auth = token();
  const t = target();
  const url = `https://api.github.com/repos/${t.repository}/contents/${t.path}?ref=${encodeURIComponent(t.branch)}`;
  const response = await fetch(url, { headers: headers(auth), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (response.status === 404) {
    const state = createEmptyTimesFmProspectiveState(nowIso);
    return { state, existed: false, remoteBlobSha: null, persistence: { mode:'GITHUB_REPLAY_RESULTS', ...t, stateHashSha256: sha256Canonical(state) } };
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TIMESFM_PROSPECTIVE_READ_FAILED:${response.status}:${detail.slice(0,300)}`);
  }
  const remote = await response.json();
  if (typeof remote?.content !== 'string' || typeof remote?.sha !== 'string') throw new Error('TIMESFM_PROSPECTIVE_INVALID_GITHUB_PAYLOAD');
  const state = JSON.parse(Buffer.from(remote.content.replace(/\n/g,''),'base64').toString('utf8'));
  verifyTimesFmProspectiveState(state);
  mirror(state);
  return { state, existed: true, remoteBlobSha: remote.sha, persistence: { mode:'GITHUB_REPLAY_RESULTS', ...t, stateHashSha256: sha256Canonical(state) } };
}

export async function saveTimesFmProspectiveDurableState(state, expectedRemoteBlobSha) {
  verifyTimesFmProspectiveState(state);
  const auth = token();
  const t = target();
  const body = {
    message: `Record TimesFM Stage B prospective state · ${state.sampleState} · ${state.lastInformationDate ?? 'opened'}`,
    content: Buffer.from(JSON.stringify(state, null, 2) + '\n','utf8').toString('base64'),
    branch: t.branch
  };
  if (expectedRemoteBlobSha) body.sha = expectedRemoteBlobSha;
  const response = await fetch(`https://api.github.com/repos/${t.repository}/contents/${t.path}`, {
    method:'PUT',
    headers:headers(auth),
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    const detail=await response.text();
    throw new Error(`TIMESFM_PROSPECTIVE_WRITE_FAILED:${response.status}:${detail.slice(0,300)}`);
  }
  const written=await response.json();
  const remoteBlobSha=String(written?.content?.sha||'');
  if(!remoteBlobSha) throw new Error('TIMESFM_PROSPECTIVE_WRITE_NO_BLOB_SHA');
  mirror(state);
  return {
    remoteBlobSha,
    commitSha: typeof written?.commit?.sha === 'string' ? written.commit.sha : null,
    persistence:{ mode:'GITHUB_REPLAY_RESULTS', ...t, stateHashSha256: sha256Canonical(state) }
  };
}
