const DEFAULT_REPOSITORY = 'fmaranis/Trading';
const DEFAULT_BRANCH = 'replay-results';
const BASE_PATH = 'validation-runs/research-validation';
const REQUEST_TIMEOUT_MS = 30_000;

export type ResearchValidationEvidenceKind = 'ORIGINAL_VALIDATION' | 'AUDIT_RECONSTRUCTION';

export interface DurableResearchValidationEvidence {
  schemaVersion: 1;
  jobId: string;
  jobName: string;
  evidenceKind: ResearchValidationEvidenceKind;
  recordedAt: string;
  status: 'PASSED';
  startedAt: string | null;
  finishedAt: string | null;
  result: unknown;
  note?: string;
}

function safeFilePart(value: string): string {
  return value.replace(/[:.]/g, '-').replace(/[^0-9A-Za-zTZ_-]/g, '_').slice(0, 120) || 'result';
}

function syncTarget(jobId: string) {
  const repository = String(process.env.GITHUB_REPLAY_SYNC_REPOSITORY || DEFAULT_REPOSITORY).trim();
  const branch = String(process.env.GITHUB_REPLAY_SYNC_BRANCH || DEFAULT_BRANCH).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('RESEARCH_VALIDATION_INVALID_DURABLE_REPOSITORY');
  if (!branch || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) throw new Error('RESEARCH_VALIDATION_INVALID_DURABLE_BRANCH');
  return { repository, branch, path: `${BASE_PATH}/${safeFilePart(jobId)}.json` };
}

function githubHeaders(write = false): Record<string, string> {
  const token = process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim();
  if (write && !token) throw new Error('RESEARCH_VALIDATION_DURABLE_GITHUB_TOKEN_REQUIRED');
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(write ? { 'Content-Type': 'application/json' } : {}),
    'User-Agent': 'fmaranis-trading-research-validation',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function githubFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

export function durableResearchValidationPath(jobId: string): string {
  return syncTarget(jobId).path;
}

export async function loadDurableResearchValidationEvidence(jobId: string): Promise<DurableResearchValidationEvidence | null> {
  const target = syncTarget(jobId);
  const apiUrl = `https://api.github.com/repos/${target.repository}/contents/${target.path}?ref=${encodeURIComponent(target.branch)}`;
  const response = await githubFetch(apiUrl, { headers: githubHeaders(false) });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`RESEARCH_VALIDATION_DURABLE_READ_FAILED:${response.status}:${detail.slice(0, 300)}`);
  }
  const remote = await response.json() as any;
  if (typeof remote?.content !== 'string') throw new Error('RESEARCH_VALIDATION_DURABLE_INVALID_GITHUB_PAYLOAD');
  const decoded = Buffer.from(remote.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const parsed = JSON.parse(decoded) as DurableResearchValidationEvidence;
  if (parsed?.schemaVersion !== 1 || parsed?.jobId !== jobId || parsed?.status !== 'PASSED') {
    throw new Error('RESEARCH_VALIDATION_DURABLE_INVALID_EVIDENCE');
  }
  return parsed;
}

export async function saveDurableResearchValidationEvidence(
  evidence: DurableResearchValidationEvidence
): Promise<{ path: string; blobSha: string; commitSha: string | null }> {
  if (evidence.schemaVersion !== 1 || evidence.status !== 'PASSED' || !evidence.jobId) {
    throw new Error('RESEARCH_VALIDATION_DURABLE_INVALID_EVIDENCE');
  }
  const target = syncTarget(evidence.jobId);
  const headers = githubHeaders(true);
  const apiUrl = `https://api.github.com/repos/${target.repository}/contents/${target.path}`;
  const currentResponse = await githubFetch(`${apiUrl}?ref=${encodeURIComponent(target.branch)}`, { headers });
  let sha: string | undefined;
  if (currentResponse.ok) {
    const current = await currentResponse.json() as any;
    sha = typeof current?.sha === 'string' ? current.sha : undefined;
  } else if (currentResponse.status !== 404) {
    const detail = await currentResponse.text();
    throw new Error(`RESEARCH_VALIDATION_DURABLE_READ_BEFORE_WRITE_FAILED:${currentResponse.status}:${detail.slice(0, 300)}`);
  }

  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  const body: Record<string, unknown> = {
    message: `Record research validation evidence ${evidence.jobId}`,
    content: Buffer.from(serialized, 'utf8').toString('base64'),
    branch: target.branch
  };
  if (sha) body.sha = sha;

  const writeResponse = await githubFetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });
  if (!writeResponse.ok) {
    const detail = await writeResponse.text();
    throw new Error(`RESEARCH_VALIDATION_DURABLE_WRITE_FAILED:${writeResponse.status}:${detail.slice(0, 300)}`);
  }
  const written = await writeResponse.json() as any;
  const blobSha = String(written?.content?.sha || '');
  if (!blobSha) throw new Error('RESEARCH_VALIDATION_DURABLE_WRITE_NO_BLOB_SHA');
  return {
    path: target.path,
    blobSha,
    commitSha: typeof written?.commit?.sha === 'string' ? written.commit.sha : null
  };
}
