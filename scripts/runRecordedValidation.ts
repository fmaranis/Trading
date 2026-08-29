import { spawn } from 'node:child_process';
import { recordValidationResult } from './validationResultStore';

type ValidationMode = 'aistudio' | 'eodhd-shortlist';
const RESULT_BRANCH = 'validation-results';

const config: Record<ValidationMode, { script: string; runFileName: string; markers: Array<{ marker: string; fileName: string }> }> = {
  aistudio: {
    script: 'validate:aistudio:raw',
    runFileName: 'latest-aistudio-run.json',
    markers: [
      { marker: 'AI_STUDIO_VALIDATION_RESULT', fileName: 'latest-aistudio.json' },
      { marker: 'BROKER_BACKTEST_FEASIBILITY_RESULT', fileName: 'latest-broker-backtest-feasibility.json' },
      { marker: 'BROKER_AWARE_EXECUTION_SWEEP_RESULT', fileName: 'latest-broker-aware-execution-sweep.json' }
    ]
  },
  'eodhd-shortlist': {
    script: 'test:eodhd-shortlist:raw',
    runFileName: 'latest-eodhd-shortlist-run.json',
    markers: [
      { marker: 'EODHD_SHORTLIST_VALIDATION_RESULT', fileName: 'latest-eodhd-shortlist.json' }
    ]
  }
};

function extractJsonAfterMarker(output: string, marker: string): unknown | null {
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const tail = output.slice(markerIndex + marker.length);
  const start = tail.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < tail.length; i++) {
    const char = tail[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(tail.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

async function main() {
  if (!mode || !(mode in config)) throw new Error(`Modo de validación no soportado: ${mode ?? 'undefined'}`);

  const selected = config[mode];
  const child = spawn('npm', ['run', selected.script], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, VALIDATION_PARENT_WRAPPER: '1' }
  });

  let output = '';
  let spawnError: string | null = null;
  child.stdout.on('data', chunk => { const text = String(chunk); output += text; process.stdout.write(text); });
  child.stderr.on('data', chunk => { const text = String(chunk); output += text; process.stderr.write(text); });

  const exitCode = await new Promise<number | null>(resolve => {
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    child.on('close', finish);
    child.on('error', error => {
      spawnError = error?.message || String(error);
      const text = `\nVALIDATION_SPAWN_ERROR: ${spawnError}\n`;
      output += text;
      process.stderr.write(text);
      finish(1);
    });
  });

  const detectedMarkers = selected.markers.filter(item => output.includes(item.marker)).map(item => item.marker);
  const runPayload = {
    generatedAt: new Date().toISOString(),
    mode,
    underlyingScript: selected.script,
    exitCode: exitCode ?? 1,
    ok: exitCode === 0 && !spawnError,
    spawnError,
    expectedMarkers: selected.markers.map(item => item.marker),
    detectedMarkers,
    outputTail: output.slice(-12000)
  };
  const runRecord = recordValidationResult(selected.runFileName, 'VALIDATION_RUN_RESULT', runPayload, {
    autoCommit: false,
    commitMessage: `Record ${mode} validation run`
  });
  const records: Array<Record<string, any>> = [{ marker: 'VALIDATION_RUN_RESULT', fileName: selected.runFileName, ...runRecord }];

  for (const item of selected.markers) {
    const payload = extractJsonAfterMarker(output, item.marker);
    if (payload == null) continue;
    const record = recordValidationResult(item.fileName, item.marker, payload, { autoCommit: false, commitMessage: `Record ${item.marker}` });
    records.push({ ...item, ...record });
  }

  if (detectedMarkers.length !== selected.markers.length) {
    console.error(`VALIDATION_RESULT_RECORDING_WARNING: marcadores detectados ${detectedMarkers.length}/${selected.markers.length}. El registro general de ejecución sí se ha guardado.`);
  }
  console.log('\nVALIDATION_RESULTS_RECORDED');
  console.log(JSON.stringify(records, null, 2));

  if (process.env.VALIDATION_AUTO_COMMIT !== '0') {
    const { execFileSync } = await import('node:child_process');
    const paths = records.map(record => record.path);
    try {
      execFileSync('git', ['add', '--', ...paths], { stdio: 'ignore' });
      const changed = execFileSync('git', ['diff', '--cached', '--name-only', '--', ...paths], { encoding: 'utf8' }).trim();
      let commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      let committed = false;
      if (changed) {
        execFileSync('git', ['commit', '-m', `Record ${mode} validation results`, '--', ...paths], { stdio: 'ignore' });
        commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        committed = true;
      }

      const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
      let pushedMain = false;
      try { execFileSync('git', ['push', 'origin', branch], { stdio: 'ignore' }); pushedMain = true; } catch {}
      let pushedResultBranch = false;
      try { execFileSync('git', ['fetch', 'origin', RESULT_BRANCH], { stdio: 'ignore' }); } catch {}
      try {
        execFileSync('git', ['push', '--force-with-lease', 'origin', `${commitSha}:refs/heads/${RESULT_BRANCH}`], { stdio: 'ignore' });
        pushedResultBranch = true;
      } catch {
        try { execFileSync('git', ['push', '--force', 'origin', `${commitSha}:refs/heads/${RESULT_BRANCH}`], { stdio: 'ignore' }); pushedResultBranch = true; } catch {}
      }

      console.log('VALIDATION_RESULTS_GIT');
      console.log(JSON.stringify({ committed, pushedMain, pushedResultBranch, resultBranch: RESULT_BRANCH, branch, commitSha, paths }, null, 2));
    } catch (error: any) {
      console.error('VALIDATION_RESULTS_GIT_WARNING', error?.message || String(error));
    }
  }

  if (exitCode !== 0 || spawnError) process.exitCode = exitCode ?? 1;
}

main().catch(error => {
  console.error('RECORDED_VALIDATION_FATAL', error?.message || String(error));
  process.exit(1);
});
