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
const JOBS: JobDefinition[] = [
  {
    id: 'forward-risk-v8-fragmentation-diagnostic',
    name: 'Forward Risk V8 · diagnóstico de fragmentación',
    description: 'Diagnóstico histórico archivado. Confirmó fragmentación de la señal V8; no forma parte del flujo operativo actual.',
    marker: 'FORWARD_RISK_V8_FRAGMENTATION_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'V8 · diagnóstico completado',
    steps: [
      { label: 'Guard V8 fragmentación', command: 'npx', args: ['tsx', 'tests/forwardRiskV8FragmentationDiagnostic.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'V8 diagnóstico de estados ON/OFF', command: 'npx', args: ['tsx', 'scripts/forwardRiskV8FragmentationDiagnosticLive.ts'] }
    ]
  },
  {
    id: 'forward-risk-v9-policy-guard',
    name: 'Forward Risk V9 · guard de política congelada',
    description: 'Guard histórico archivado de V9.',
    visibility: 'ARCHIVED',
    historyLabel: 'V9 · guard completado',
    steps: [
      { label: 'Guard V9 máquina de estados', command: 'npx', args: ['tsx', 'tests/forwardRiskV9StateMachine.unit.ts'] },
      { label: 'Guard V9 protocolo blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV9ValidationProtocol.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] }
    ]
  },
  {
    id: 'forward-risk-v9-blind-validation',
    name: 'Forward Risk V9 · validación blind',
    description: 'Validación histórica consumida. V9_POLICY_1 falló el blind y está retirada.',
    marker: 'FORWARD_RISK_V9_BLIND_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'V9 · blind FAIL · retirada',
    steps: [
      { label: 'Guard V9 máquina de estados', command: 'npx', args: ['tsx', 'tests/forwardRiskV9StateMachine.unit.ts'] },
      { label: 'Guard V9 protocolo blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV9ValidationProtocol.unit.ts'] },
      { label: 'Guard V9 runner blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV9BlindValidation.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'V9 validación blind one-shot', command: 'npx', args: ['tsx', 'scripts/forwardRiskV9BlindValidationLive.ts'] }
    ]
  },
  {
    id: 'forward-risk-v10-policy-guard',
    name: 'Forward Risk V10 · guard de política riesgo + oportunidad',
    description: 'Guard V10 ya superado y archivado tras registrar PASS.',
    visibility: 'ARCHIVED',
    historyLabel: 'V10 · guard PASS',
    steps: [
      { label: 'Guard V10 política de dinero nuevo', command: 'npx', args: ['tsx', 'tests/forwardRiskV10Policy.unit.ts'] },
      { label: 'Guard V10 protocolo blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV10ValidationProtocol.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] }
    ]
  },
  {
    id: 'forward-risk-v10-blind-validation',
    name: 'Forward Risk · V10 · validación blind',
    description: 'Validación histórica consumida. V10_POLICY_1 terminó correctamente a nivel técnico, pero falló el gate económico blind y queda retirada. No puede relanzarse ni retunearse sobre estos seis activos.',
    marker: 'FORWARD_RISK_V10_BLIND_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'V10 · blind FAIL · retirada',
    steps: [
      { label: 'Guard V10 política de dinero nuevo', command: 'npx', args: ['tsx', 'tests/forwardRiskV10Policy.unit.ts'] },
      { label: 'Guard V10 protocolo blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV10ValidationProtocol.unit.ts'] },
      { label: 'Guard V10 runner blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV10BlindValidation.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'V10 validación blind one-shot', command: 'npx', args: ['tsx', 'scripts/forwardRiskV10BlindValidationLive.ts'] }
    ]
  },
  {
    id: 'forward-risk-v11-policy-guard',
    name: 'Forward Risk · V11 · guard de sizing continuo',
    description: 'Guard V11 superado localmente antes de abrir el holdout.',
    visibility: 'ARCHIVED',
    historyLabel: 'V11 · guard PASS',
    steps: [
      { label: 'Guard V11 sizing continuo', command: 'npx', args: ['tsx', 'tests/forwardRiskV11SizingOverlay.unit.ts'] },
      { label: 'Guard V11 protocolo blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV11ValidationProtocol.unit.ts'] },
      { label: 'Guard V11 runner blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV11BlindValidation.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] }
    ]
  },
  {
    id: 'forward-risk-v11-blind-validation',
    name: 'Forward Risk · V11 · validación blind',
    description: 'Validación histórica consumida. V11_POLICY_1 terminó correctamente a nivel técnico, pero falló el gate blind de retorno/riesgo y queda retirada. No puede relanzarse ni retunearse sobre estos seis activos.',
    marker: 'FORWARD_RISK_V11_BLIND_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'V11 · blind FAIL · retirada',
    steps: [
      { label: 'Preflight FRED/ALFRED', command: 'npx', args: ['tsx', 'scripts/forwardRiskV11RuntimePreflight.ts'] },
      { label: 'Guard V11 sizing continuo', command: 'npx', args: ['tsx', 'tests/forwardRiskV11SizingOverlay.unit.ts'] },
      { label: 'Guard V11 protocolo blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV11ValidationProtocol.unit.ts'] },
      { label: 'Guard V11 runner blind', command: 'npx', args: ['tsx', 'tests/forwardRiskV11BlindValidation.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'V11 validación blind one-shot', command: 'npx', args: ['tsx', 'scripts/forwardRiskV11BlindValidationLive.ts'] }
    ]
  },
  {
    id: 'open-market-discovery-v1-validation',
    name: 'Mercado abierto · V1 · discovery + core shadow',
    description: 'Validación de infraestructura consumida con PASS el 2026-09-07. Confirmó Yahoo current/live -> scanner REAL -> CORE_ELIGIBILITY_V2 shadow -> PortfolioCandidateGate, sin modificar el replay histórico.',
    marker: 'OPEN_MARKET_DISCOVERY_V1_LIVE_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'Mercado abierto V1 · infraestructura PASS',
    steps: [
      { label: 'Guard discovery V1', command: 'npx', args: ['tsx', 'tests/openMarketDiscoveryV1.unit.ts'] },
      { label: 'Guard core eligibility V2', command: 'npx', args: ['tsx', 'tests/coreEligibilityV2.unit.ts'] },
      { label: 'Guard arquitectura discovery', command: 'npx', args: ['tsx', 'tests/openMarketDiscoveryArchitecture.unit.ts'] },
      { label: 'Guard búsqueda manual replay existente', command: 'npx', args: ['tsx', 'tests/openMarketReplayDiscovery.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Smoke REAL discovery + scanner + gate', command: 'npx', args: ['tsx', 'scripts/openMarketDiscoveryV1Live.ts'] }
    ]
  },
  {
    id: 'open-market-live-scanner-integration',
    name: 'Mercado abierto · V1 · integración en scanner live',
    description: 'Integración CURRENT/LIVE cerrada con PASS el 2026-09-08: 64 activos base + 2 ETF descubiertos = 66 escaneados; 2 OPEN_* aceptados con provenance REAL; ambos quedaron REJECTED por DOES_NOT_BEAT_CASH. CORE_ELIGIBILITY_V2 siguió shadow y el replay histórico no se modificó.',
    marker: 'OPEN_MARKET_LIVE_SCANNER_INTEGRATION_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'Mercado abierto V1 · integración live PASS',
    steps: [
      { label: 'Guard discovery V1', command: 'npx', args: ['tsx', 'tests/openMarketDiscoveryV1.unit.ts'] },
      { label: 'Guard core eligibility V2 shadow', command: 'npx', args: ['tsx', 'tests/coreEligibilityV2.unit.ts'] },
      { label: 'Guard arquitectura discovery', command: 'npx', args: ['tsx', 'tests/openMarketDiscoveryArchitecture.unit.ts'] },
      { label: 'Guard integración scanner live', command: 'npx', args: ['tsx', 'tests/openMarketLiveScannerIntegration.unit.ts'] },
      { label: 'Guard replay existente', command: 'npx', args: ['tsx', 'tests/openMarketReplayDiscovery.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Smoke REAL scanner live + gate', command: 'npx', args: ['tsx', 'scripts/openMarketLiveScannerIntegration.ts'] }
    ]
  },
  {
    id: 'opportunity-ranking-causal-comparison-v1',
    name: 'Oportunidad · ranking causal · LEGACY vs QUALITY vs SLOPE',
    description: 'Diagnóstico histórico consumido el 2026-09-08. QUALITY quedó research-only con efecto insuficiente; SLOPE no es candidato de promoción en su forma actual; producción continúa LEGACY. No se permite tuning sobre estas ventanas.',
    marker: 'OPPORTUNITY_RANKING_CAUSAL_COMPARISON_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'Ranking causal V1 · QUALITY insuficiente · SLOPE no mejora',
    steps: [
      { label: 'Guard arquitectura ranking', command: 'npx', args: ['tsx', 'tests/opportunityRankingArchitecture.unit.ts'] },
      { label: 'Guard protocolo ranking', command: 'npx', args: ['tsx', 'tests/opportunityRankingComparison.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'Guard replay existente', command: 'npx', args: ['tsx', 'tests/openMarketReplayDiscovery.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Comparación REAL 3 políticas × 3 ventanas', command: 'npx', args: ['tsx', 'scripts/opportunityRankingCausalComparisonLive.ts'] }
    ]
  },
  {
    id: 'opportunity-ranking-reach-audit-v1',
    name: 'Oportunidad · auditoría de alcance del ranking',
    description: 'Diagnóstico consumido el 2026-09-08. Confirmó 0 violaciones de elegibilidad y que QUALITY cambia orden/conjunto muchas veces pero casi nunca llega a compras ejecutadas. El cuello de botella está en asignación de capital, no en la selección.',
    marker: 'OPPORTUNITY_RANKING_REACH_AUDIT_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'Ranking reach audit · señal muere antes del capital',
    steps: [
      { label: 'Guard arquitectura ranking', command: 'npx', args: ['tsx', 'tests/opportunityRankingArchitecture.unit.ts'] },
      { label: 'Guard alcance ranking', command: 'npx', args: ['tsx', 'tests/opportunityRankingReachAudit.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'Guard replay existente', command: 'npx', args: ['tsx', 'tests/openMarketReplayDiscovery.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Auditoría REAL 3 políticas × 3 ventanas', command: 'npx', args: ['tsx', 'scripts/opportunityRankingReachAuditLive.ts'] }
    ]
  },
  {
    id: 'opportunity-quality-allocation-bridge-v1',
    name: 'Oportunidad · QUALITY bridge de asignación',
    description: 'Diagnóstico consumido. El bridge llegó al allocator, pero apenas movió capital porque el replay cerrado tuvo capital desplegable en sólo 3/228 decisiones. Resultado: technical pass, reach insuficiente y no promoción.',
    marker: 'OPPORTUNITY_QUALITY_ALLOCATION_BRIDGE_V1_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'QUALITY bridge · capital disponible fue el cuello de botella',
    steps: [
      { label: 'Guard QUALITY bridge', command: 'npx', args: ['tsx', 'tests/opportunityQualityAllocationBridge.unit.ts'] },
      { label: 'Guard restricciones de asignación', command: 'npx', args: ['tsx', 'tests/opportunityAllocationConstraintAudit.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'Guard replay existente', command: 'npx', args: ['tsx', 'tests/openMarketReplayDiscovery.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Diagnóstico REAL de restricciones', command: 'npx', args: ['tsx', 'scripts/opportunityQualityAllocationBridgeV1Live.ts'] }
    ]
  },
  {
    id: 'replay-explicit-cash-flows-v1',
    name: 'Replay · flujos externos explícitos',
    description: 'Valida dentro del replay existente que MONTHLY sea sólo frecuencia de decisión y que aportaciones/retiradas fechadas entren causalmente como flujos externos. Compara capital cerrado, aportaciones explícitas con LEGACY y el mismo flujo con QUALITY research-only; producción no cambia.',
    marker: 'REPLAY_EXPLICIT_CASH_FLOWS_V1_RESULT',
    visibility: 'CURRENT',
    steps: [
      { label: 'Guard contabilidad de flujos', command: 'npx', args: ['tsx', 'tests/replayExternalCashFlows.unit.ts'] },
      { label: 'Guard integración flujos/replay', command: 'npx', args: ['tsx', 'tests/replayExternalCashFlowIntegration.unit.ts'] },
      { label: 'Guard replay dinámico existente', command: 'npx', args: ['tsx', 'tests/dynamicHistoricalReplay.unit.ts'] },
      { label: 'Guard modos de cartera inicial', command: 'npx', args: ['tsx', 'tests/replayInitialPortfolioModes.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Diagnóstico REAL closed vs flujos explícitos vs QUALITY', command: 'npx', args: ['tsx', 'scripts/replayExplicitCashFlowsV1Live.ts'] }
    ]
  }
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
