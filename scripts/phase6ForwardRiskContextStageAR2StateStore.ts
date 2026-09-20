import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  createEmptyPhase6StageAR2State,
  sha256Canonical,
  verifyPhase6StageAR2State,
  type Phase6StageAR2ProspectiveState
} from './phase6ForwardRiskContextStageAR2ProspectiveProtocol';

const LOCAL_CACHE_FILE = path.join(process.cwd(), '.runtime', 'phase6ForwardRiskContextStageAR2.json');
const DEFAULT_REPOSITORY = 'fmaranis/Trading';
const DEFAULT_BRANCH = 'replay-results';
const REMOTE_PATH = 'validation-runs/phase6-forward-risk-context-stage-a-r2-state.json';
const REQUEST_TIMEOUT_MS = 30_000;

export interface Phase6StageAR2DurableLoad {
  state: Phase6StageAR2ProspectiveState;
  existed: boolean;
  remoteBlobSha: string | null;
  persistence: {
    mode: 'GITHUB_REPLAY_RESULTS';
    repository: string;
    branch: string;
    path: string;
    stateHashSha256: string;
  };
}

export interface Phase6StageAR2DurableSave {
  remoteBlobSha: string;
  commitSha: string | null;
  persistence: Phase6StageAR2DurableLoad['persistence'];
}

function syncTarget() {
  const repository = String(process.env.GITHUB_REPLAY_SYNC_REPOSITORY || DEFAULT_REPOSITORY).trim();
  const branch = String(process.env.GITHUB_REPLAY_SYNC_BRANCH || DEFAULT_BRANCH).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('PHASE6_STAGE_A_R2_INVALID_DURABLE_REPOSITORY');
  if (!branch || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) throw new Error('PHASE6_STAGE_A_R2_INVALID_DURABLE_BRANCH');
  return { repository, branch, path: REMOTE_PATH };
}

function authToken(): string {
  const token = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  if (!token) throw new Error('PHASE6_STAGE_A_R2_DURABLE_GITHUB_TOKEN_REQUIRED');
  return token;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'fmaranis-trading-phase6-forward-risk-stage-a-r2',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function githubFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

function mirrorLocalCache(state: Phase6StageAR2ProspectiveState): void {
  mkdirSync(path.dirname(LOCAL_CACHE_FILE), { recursive: true });
  writeFileSync(LOCAL_CACHE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function localCacheHash(): string | null {
  try {
    const parsed = JSON.parse(readFileSync(LOCAL_CACHE_FILE, 'utf8')) as Phase6StageAR2ProspectiveState;
    verifyPhase6StageAR2State(parsed);
    return sha256Canonical(parsed);
  } catch {
    return null;
  }
}

export async function loadPhase6StageAR2DurableState(nowIso: string): Promise<Phase6StageAR2DurableLoad> {
  const token = authToken();
  const target = syncTarget();
  const apiUrl = `https://api.github.com/repos/${target.repository}/contents/${target.path}?ref=${encodeURIComponent(target.branch)}`;
  const response = await githubFetch(apiUrl, { headers: githubHeaders(token) });
  if (response.status === 404) {
    const state = createEmptyPhase6StageAR2State(nowIso);
    return {
      state,
      existed: false,
      remoteBlobSha: null,
      persistence: { mode: 'GITHUB_REPLAY_RESULTS', ...target, stateHashSha256: sha256Canonical(state) }
    };
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PHASE6_STAGE_A_R2_DURABLE_STATE_READ_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }
  const remote = await response.json() as any;
  if (typeof remote?.content !== 'string' || typeof remote?.sha !== 'string') throw new Error('PHASE6_STAGE_A_R2_DURABLE_STATE_INVALID_GITHUB_PAYLOAD');
  const decoded = Buffer.from(remote.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const state = JSON.parse(decoded) as Phase6StageAR2ProspectiveState;
  verifyPhase6StageAR2State(state);
  const remoteHash = sha256Canonical(state);
  const cacheHash = localCacheHash();
  if (cacheHash && cacheHash !== remoteHash) console.warn('PHASE6_STAGE_A_R2_LOCAL_CACHE_DIVERGED_FROM_DURABLE_STATE');
  mirrorLocalCache(state);
  return {
    state,
    existed: true,
    remoteBlobSha: remote.sha,
    persistence: { mode: 'GITHUB_REPLAY_RESULTS', ...target, stateHashSha256: remoteHash }
  };
}

export async function savePhase6StageAR2DurableState(
  state: Phase6StageAR2ProspectiveState,
  expectedRemoteBlobSha: string | null
): Promise<Phase6StageAR2DurableSave> {
  verifyPhase6StageAR2State(state);
  const token = authToken();
  const target = syncTarget();
  const apiUrl = `https://api.github.com/repos/${target.repository}/contents/${target.path}`;
  const serialized = `${JSON.stringify(state, null, 2)}\n`;
  const body: Record<string, unknown> = {
    message: `Record Phase 6 Stage A R2 prospective state · ${state.sampleState}`,
    content: Buffer.from(serialized, 'utf8').toString('base64'),
    branch: target.branch
  };
  if (expectedRemoteBlobSha) body.sha = expectedRemoteBlobSha;
  const response = await githubFetch(apiUrl, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PHASE6_STAGE_A_R2_DURABLE_STATE_WRITE_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }
  const written = await response.json() as any;
  const remoteBlobSha = String(written?.content?.sha || '');
  if (!remoteBlobSha) throw new Error('PHASE6_STAGE_A_R2_DURABLE_STATE_WRITE_NO_BLOB_SHA');
  mirrorLocalCache(state);
  return {
    remoteBlobSha,
    commitSha: typeof written?.commit?.sha === 'string' ? written.commit.sha : null,
    persistence: { mode: 'GITHUB_REPLAY_RESULTS', ...target, stateHashSha256: sha256Canonical(state) }
  };
}
