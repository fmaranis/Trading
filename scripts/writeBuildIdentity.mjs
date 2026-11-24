/**
 * Binds one built deployment to its exact source commit when the build has
 * verifiable Git context. No network requests and no external credentials.
 *
 * A missing Git checkout or a dirty local checkout must NOT claim that a
 * deployed artifact exactly matches a commit.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function sourceRevision() {
  const ciSha = process.env.GITHUB_SHA?.trim();
  if (ciSha && /^[a-f0-9]{40}$/i.test(ciSha)) {
    return { commitSha: ciSha.toLowerCase(), provenance: 'GITHUB_CI_SHA' };
  }
  try {
    const commitSha = git(['rev-parse', '--verify', 'HEAD']);
    const dirty = git(['status', '--porcelain', '--untracked-files=no']);
    if (/^[a-f0-9]{40}$/i.test(commitSha) && !dirty) {
      return { commitSha: commitSha.toLowerCase(), provenance: 'CLEAN_GIT_HEAD' };
    }
  } catch {
    // A packaged build without .git can still start; provenance is unknown.
  }
  return { commitSha: null, provenance: 'UNVERIFIED_BUILD_SOURCE' };
}

const metadata = {
  schemaVersion: 1,
  ...sourceRevision(),
  builtAtUtc: new Date().toISOString()
};
mkdirSync('dist', { recursive: true });
writeFileSync(join('dist', 'build-identity.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log('[Build Identity]', metadata.commitSha ?? 'N/D', metadata.provenance);
