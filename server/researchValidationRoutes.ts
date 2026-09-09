import express, { Request, Response } from 'express';
import { spawn } from 'node:child_process';

export const researchValidationRouter = express.Router();

type JobStatus = 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
type JobVisibility = 'CURRENT' | 'ARCHIVED';
interface Step { label: string; command: string; args: string[]; }
interface JobDefinition {
  id: string;
  name: string;
  description: string;
  steps: Step[];
  marker?: string;
  visibility: JobVisibility;
  historyLabel?: string;
}
interface JobState {
  status: JobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  exitCode: number | null;
  output: string;
  result: unknown | null;
  error: string | null;
}

const MAX_OUTPUT_CHARS = 1_500_000;

function archivedJob(id: string, name: string, description: string, historyLabel: string, marker?: string): JobDefinition {
  return { id, name, description, marker, visibility: 'ARCHIVED', historyLabel, steps: [] };
}

const JOBS: JobDefinition[] = [
  archivedJob(
    'forward-risk-v8-fragmentation-diagnostic',
    'Forward Risk V8 · diagnóstico de fragmentación',
    'Diagnóstico histórico consumido. Confirmó fragmentación de la señal V8; su valor predictivo retenido se conserva, pero este job no puede relanzarse.',
    'V8 · diagnóstico completado',
    'FORWARD_RISK_V8_FRAGMENTATION_RESULT'
  ),
  archivedJob(
    'forward-risk-v9-policy-guard',
    'Forward Risk V9 · guard de política congelada',
    'Guard histórico consumido de V9.',
    'V9 · guard completado'
  ),
  archivedJob(
    'forward-risk-v9-blind-validation',
    'Forward Risk V9 · validación blind',
    'Validación histórica consumida. V9_POLICY_1 falló el blind y está retirada.',
    'V9 · blind FAIL · retirada',
    'FORWARD_RISK_V9_BLIND_RESULT'
  ),
  archivedJob(
    'forward-risk-v10-policy-guard',
    'Forward Risk V10 · guard de política riesgo + oportunidad',
    'Guard V10 consumido y archivado.',
    'V10 · guard PASS'
  ),
  archivedJob(
    'forward-risk-v10-blind-validation',
    'Forward Risk · V10 · validación blind',
    'Validación histórica consumida. V10_POLICY_1 falló el gate económico blind y queda retirada.',
    'V10 · blind FAIL · retirada',
    'FORWARD_RISK_V10_BLIND_RESULT'
  ),
  archivedJob(
    'forward-risk-v11-policy-guard',
    'Forward Risk · V11 · guard de sizing continuo',
    'Guard V11 consumido y archivado.',
    'V11 · guard PASS'
  ),
  archivedJob(
    'forward-risk-v11-blind-validation',
    'Forward Risk · V11 · validación blind',
    'Validación histórica consumida. V11_POLICY_1 falló el gate blind de retorno/riesgo y queda retirada.',
    'V11 · blind FAIL · retirada',
    'FORWARD_RISK_V11_BLIND_RESULT'
  ),
  archivedJob(
    'open-market-discovery-v1-validation',
    'Mercado abierto · V1 · discovery + core shadow',
    'Validación de infraestructura consumida con PASS. Confirmó discovery current/live integrado sin modificar el replay histórico.',
    'Mercado abierto V1 · infraestructura PASS',
    'OPEN_MARKET_DISCOVERY_V1_LIVE_RESULT'
  ),
  archivedJob(
    'open-market-live-scanner-integration',
    'Mercado abierto · V1 · integración en scanner live',
    'Integración current/live consumida con PASS; CORE_ELIGIBILITY_V2 continúa shadow.',
    'Mercado abierto V1 · integración live PASS',
    'OPEN_MARKET_LIVE_SCANNER_INTEGRATION_RESULT'
  ),
  archivedJob(
    'opportunity-ranking-causal-comparison-v1',
    'Oportunidad · ranking causal · LEGACY vs QUALITY vs SLOPE',
    'Diagnóstico histórico consumido. QUALITY quedó research-only con efecto insuficiente; SLOPE no justificó promoción; producción continúa LEGACY.',
    'Ranking causal V1 · QUALITY insuficiente · SLOPE no mejora',
    'OPPORTUNITY_RANKING_CAUSAL_COMPARISON_RESULT'
  ),
  archivedJob(
    'opportunity-ranking-reach-audit-v1',
    'Oportunidad · auditoría de alcance del ranking',
    'Diagnóstico consumido. QUALITY cambiaba ranking/selección pero apenas alcanzaba compras con capital cerrado.',
    'Ranking reach audit · señal moría antes del capital',
    'OPPORTUNITY_RANKING_REACH_AUDIT_RESULT'
  ),
  archivedJob(
    'opportunity-quality-allocation-bridge-v1',
    'Oportunidad · QUALITY bridge de asignación',
    'Diagnóstico consumido. El bridge llegó al allocator, pero el replay cerrado sólo tuvo capital desplegable en 3/228 decisiones.',
    'QUALITY bridge · capital disponible fue el cuello de botella',
    'OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1_RESULT'
  ),
  archivedJob(
    'replay-explicit-cash-flows-v1',
    'Replay · flujos externos explícitos',
    'PASS consumido el 2026-09-09. Confirmó causalidad/contabilidad de externalCashFlows y que el capital explícito aumentó el reach: gates desplegables 3 -> 22 y +212.386,21 EUR de notional ejecutado; QUALITY alcanzó 10 planes y 23 fechas ejecutadas, sin evidencia económica suficiente para promoción.',
    'Flujos explícitos V1 · PASS · reach de capital demostrado',
    'REPLAY_EXPLICIT_CASH_FLOWS_V1_RESULT'
  ),
  archivedJob(
    'quality-allocation-future-forward-v1',
    'QUALITY allocation · future-forward V1',
    'ANULADO ANTES DE ARRANCAR/ANTES DE OUTCOMES. Congelaba 64 nombres y por tanto contradecía la arquitectura productiva: el mercado debe descubrirse dinámicamente y 64 significa shortlist dinámica, no whitelist. No consumió muestra ni genera evidencia. Debe sustituirse por un protocolo que congele reglas de discovery/ranking y registre snapshots de candidatos por fecha.',
    'QUALITY future-forward V1 · VOID pre-start · universo fijo incorrecto',
    'QUALITY_ALLOCATION_FUTURE_FORWARD_V1_RESULT'
  ),
  archivedJob(
    'dynamic-market-top64-v1',
    'Mercado dinámico · Top 64 current/live',
    'PASS FINAL el 2026-09-09. Cerró discovery Search+Lookup, independencia del seed, Top64 REAL, dedupe económico, autoridad de PortfolioCandidateGate, 0 leaks fuera del Top64 y corrección current/live para que acciones individuales no queden artificialmente limitadas por la etiqueta amplia EUROPE_EQUITY. Producción continúa LEGACY y replay histórico permanece intacto.',
    'Mercado dinámico Top64 · PASS final · cerrado',
    'DYNAMIC_MARKET_TOP64_LIVE_RESULT'
  )
];

const states = new Map<string, JobState>();
function initialState(): JobState {
  return { status: 'IDLE', startedAt: null, finishedAt: null, currentStep: null, exitCode: null, output: '', result: null, error: null };
}
function stateFor(id: string): JobState {
  const current = states.get(id) ?? initialState();
  if (!states.has(id)) states.set(id, current);
  return current;
}
function appendOutput(state: JobState, text: string): void {
  state.output = `${state.output}${text}`.slice(-MAX_OUTPUT_CHARS);
}
function extractJsonAfterMarker(output: string, marker?: string): unknown | null {
  if (!marker) return null;
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const after = output.slice(markerIndex + marker.length);
  const start = after.indexOf('{');
  if (start < 0) return null;
  const text = after.slice(start);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(0, index + 1)); } catch { return null; }
      }
    }
  }
  return null;
}
function runStep(step: Step, state: JobState): Promise<number> {
  return new Promise(resolve => {
    state.currentStep = step.label;
    appendOutput(state, `\n\n=== ${step.label} ===\n`);
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: { ...process.env, DISABLE_HMR: 'true' },
      shell: process.platform === 'win32'
    });
    child.stdout.on('data', data => appendOutput(state, String(data)));
    child.stderr.on('data', data => appendOutput(state, String(data)));
    child.on('error', error => { appendOutput(state, `\nPROCESS_ERROR: ${error.message}\n`); resolve(1); });
    child.on('close', code => resolve(code ?? 1));
  });
}
async function runJob(job: JobDefinition): Promise<void> {
  const state = stateFor(job.id);
  state.status = 'RUNNING';
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.currentStep = null;
  state.exitCode = null;
  state.output = '';
  state.result = null;
  state.error = null;
  try {
    for (const step of job.steps) {
      const code = await runStep(step, state);
      if (code !== 0) {
        state.exitCode = code;
        state.status = 'FAILED';
        state.error = `Falló: ${step.label}`;
        return;
      }
    }
    state.exitCode = 0;
    state.result = extractJsonAfterMarker(state.output, job.marker);
    state.status = 'PASSED';
  } catch (error: any) {
    state.status = 'FAILED';
    state.exitCode = 1;
    state.error = error?.message || String(error);
  } finally {
    state.currentStep = null;
    state.finishedAt = new Date().toISOString();
  }
}
function publicJob(job: JobDefinition) {
  return { id: job.id, name: job.name, description: job.description, ...stateFor(job.id) };
}

researchValidationRouter.get('/jobs', (_req: Request, res: Response) => {
  const currentJobs = JOBS.filter(job => job.visibility === 'CURRENT').map(publicJob);
  const history = JOBS.filter(job => job.visibility === 'ARCHIVED').map(job => ({ id: job.id, label: job.historyLabel ?? job.name }));
  res.json({ aiTokensUsed: false, execution: 'LOCAL_APP_BACKEND', jobs: currentJobs, history });
});
researchValidationRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const job = JOBS.find(item => item.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'UNKNOWN_VALIDATION_JOB' }); return; }
  res.json({ aiTokensUsed: false, execution: 'LOCAL_APP_BACKEND', archived: job.visibility === 'ARCHIVED', job: publicJob(job) });
});
researchValidationRouter.post('/jobs/:id/run', (req: Request, res: Response) => {
  const job = JOBS.find(item => item.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'UNKNOWN_VALIDATION_JOB' }); return; }
  if (job.visibility === 'ARCHIVED') { res.status(409).json({ error: 'VALIDATION_ARCHIVED_READ_ONLY', job: publicJob(job) }); return; }
  const state = stateFor(job.id);
  if (state.status === 'RUNNING') { res.status(409).json({ error: 'VALIDATION_ALREADY_RUNNING', job: publicJob(job) }); return; }
  void runJob(job);
  res.status(202).json({ ok: true, aiTokensUsed: false, execution: 'LOCAL_APP_BACKEND', job: publicJob(job) });
});
