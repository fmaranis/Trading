import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface ValidationRecordOptions {
  autoCommit?: boolean;
  commitMessage?: string;
}

function safeGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export function currentGitHead(): string | null {
  return safeGit(['rev-parse', 'HEAD']);
}

export function currentGitBranch(): string | null {
  return safeGit(['rev-parse', '--abbrev-ref', 'HEAD']);
}

export function recordValidationResult(
  fileName: string,
  marker: string,
  payload: unknown,
  options: ValidationRecordOptions = {}
): { path: string; committed: boolean; pushed: boolean; commitSha: string | null } {
  const relativePath = `validation-results/${fileName}`;
  const absolutePath = resolve(process.cwd(), relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });

  const envelope = {
    marker,
    recordedAt: new Date().toISOString(),
    gitHeadBeforeRecord: currentGitHead(),
    gitBranch: currentGitBranch(),
    payload
  };
  writeFileSync(absolutePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');

  const autoCommit = options.autoCommit ?? process.env.VALIDATION_AUTO_COMMIT !== '0';
  if (!autoCommit) return { path: relativePath, committed: false, pushed: false, commitSha: null };

  const branch = currentGitBranch();
  if (!branch || branch === 'HEAD') return { path: relativePath, committed: false, pushed: false, commitSha: null };

  try {
    execFileSync('git', ['add', '--', relativePath], { stdio: 'ignore' });
    const staged = safeGit(['diff', '--cached', '--name-only', '--', relativePath]);
    if (!staged) return { path: relativePath, committed: false, pushed: false, commitSha: currentGitHead() };

    execFileSync('git', ['commit', '-m', options.commitMessage ?? `Record ${marker}` , '--', relativePath], { stdio: 'ignore' });
    const commitSha = currentGitHead();
    let pushed = false;
    if (commitSha) {
      try {
        execFileSync('git', ['push', 'origin', branch], { stdio: 'ignore' });
        pushed = true;
      } catch {
        pushed = false;
      }
    }
    return { path: relativePath, committed: true, pushed, commitSha };
  } catch {
    return { path: relativePath, committed: false, pushed: false, commitSha: currentGitHead() };
  }
}
