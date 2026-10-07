import express, { Request, Response } from 'express';
import { spawn } from 'node:child_process';
import { loadDurableJobState, reconcileLoadedJobState, saveDurableJobState } from './researchValidationStateStore.mjs';
import { checkTimesFmRemoteEndpoint, fetchTimesFmMultivariateRunnerStatus, fetchTimesFmRemoteState, fetchTimesFmZeroGpuQuota, reconcileTimesFmState, timesFmHfTokenConfigured, timesFmRemoteRunnerConfigured, TIMESFM_REMOTE_JOB_ID } from './timesfmRemoteRunner';

export const researchValidationRouter = express.Router();

type JobStatus = 'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED';
type JobVisibility = 'CURRENT' | 'PARKED' | 'ARCHIVED';
interface Step { label: string; command: string; args: string[]; }
interface JobDefinition {
  id: string;
  name: string;
  description: string;
  steps: Step[];
  marker?: string;
  visibility: JobVisibility;
  historyLabel?: string;
  requiresGithubReplayToken?: boolean;
  requiresEodhdApiKey?: boolean;
  requiresSecEdgarUserAgent?: boolean;
  requiresTimesFmRunner?: boolean;
  requiresTimesFmAuth?: boolean;
}
interface JobState {
  status: JobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  currentStep: string | null;
  processId: number | null;
  exitCode: number | null;
  output: string;
  result: unknown | null;
  error: string | null;
}

const MAX_OUTPUT_CHARS = 1_500_000;
const TIMESFM_MULTIVARIATE_CONTEXT_JOB_ID = 'timesfm-multivariate-context-v1';
const TIMESFM_PROSPECTIVE_JOB_ID = 'timesfm-stage-b-prospective-confirmation-v1';
const TIMESFM_PANEL_STICKY_OOS_JOB_ID = 'timesfm-panel-sticky-oos-v1';
const TIMESFM_MULTIVARIATE_CONTEXT_ENDPOINT = 'multivariate_context_predict';

function archivedJob(id: string, name: string, description: string, historyLabel: string, marker?: string): JobDefinition {
  return { id, name, description, marker, visibility: 'ARCHIVED', historyLabel, steps: [] };
}

function isRemoteTimesFmValidationJob(job: JobDefinition): boolean {
  return job.requiresTimesFmRunner === true;
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
    'ANULADO ANTES DE ARRANCAR/ANTES DE OUTCOMES. Congelaba 64 nombres y por tanto contradecía la arquitectura productiva. No consumió muestra ni genera evidencia.',
    'QUALITY future-forward V1 · VOID pre-start · universo fijo incorrecto',
    'QUALITY_ALLOCATION_FUTURE_FORWARD_V1_RESULT'
  ),
  archivedJob(
    'dynamic-market-top64-v1',
    'Mercado dinámico · Top 64 current/live',
    'PASS FINAL el 2026-09-09. Cerró discovery Search+Lookup, independencia del seed, Top64 REAL, dedupe económico, autoridad de PortfolioCandidateGate, 0 leaks fuera del Top64 y corrección current/live para acciones individuales. Producción continúa LEGACY y replay histórico permanece intacto.',
    'Mercado dinámico Top64 · PASS final · cerrado',
    'DYNAMIC_MARKET_TOP64_LIVE_RESULT'
  ),
  {
    id: 'product-surface-closure-v1',
    name: 'Producto · cierre rápido',
    description: 'Verificación rápida de la superficie productiva integrada y seguridad privada: decisión única, auth/ADMIN, plan ejecutable, cartera, salud de posiciones, broker, fiscalidad y TypeScript. No ejecuta replay, no consulta un checkpoint prospectivo y no escribe en replay-results.',
    visibility: 'ARCHIVED',
    steps: [
      { label: 'Guard cierre de superficie', command: 'npx', args: ['tsx', 'tests/productSurfaceClosureV1.unit.ts'] },
      { label: 'Guard usuarios privados', command: 'npx', args: ['tsx', 'tests/privateUserSecurity.unit.ts'] },
      { label: 'Guard decisión productiva única', command: 'npx', args: ['tsx', 'tests/productDecisionSurface.unit.ts'] },
      { label: 'Guard plan de ejecución', command: 'npx', args: ['tsx', 'tests/portfolioExecutionPlan.unit.ts'] },
      { label: 'Guard cartera', command: 'npx', args: ['tsx', 'tests/userPortfolio.unit.ts'] },
      { label: 'Guard salud de posiciones', command: 'npx', args: ['tsx', 'tests/portfolioPositionHealth.unit.ts'] },
      { label: 'Guard disponibilidad broker', command: 'npx', args: ['tsx', 'tests/brokerAvailability.unit.ts'] },
      { label: 'Guard fiscalidad de ejecución', command: 'npx', args: ['tsx', 'tests/taxAwareExecutionOverlay.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] }
    ]
  },
  {
    id: 'phase4-reentry-cash-custody-v1',
    name: 'Fase 4 · reentrada · custodia de proceeds',
    description: 'Validación blind R2 de EXIT_PROCEEDS_CUSTODY_V1 dentro del replay integrado CORE_ARCHITECTURE_V1. Ejecuta primero todos los guards rápidos y TypeScript; sólo si pasan abre por primera vez la muestra histórica R2 REAL. Producción/default permanece LEGACY.',
    marker: 'PHASE4_REENTRY_CASH_CUSTODY_V1_RESULT',
    visibility: 'ARCHIVED',
    steps: [
      { label: 'Guard política de custodia', command: 'npx', args: ['tsx', 'tests/reentryCashCustodyPolicy.unit.ts'] },
      { label: 'Guard integración Fase 4', command: 'npx', args: ['tsx', 'tests/phase4ReentryCustodyIntegration.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'Guard paridad replay/producto', command: 'npx', args: ['tsx', 'tests/decisionArchitectureParity.unit.ts'] },
      { label: 'Guard superficie productiva', command: 'npx', args: ['tsx', 'tests/productSurfaceClosureV1.unit.ts'] },
      { label: 'Guard cash histórico BCE', command: 'npx', args: ['tsx', 'tests/cashRemuneration.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Blind R2 REAL one-shot', command: 'npx', args: ['tsx', 'scripts/phase4ReentryCashCustodyV1BlindLive.ts'] }
    ]
  },
  archivedJob(
    'phase5-winner-protection-v2',
    'Fase 5 · protección de ganadores · blind V1',
    'Blind fresh/OOS consumido el 2026-09-14. PASS_CANDIDATE_FOR_CONFIRMATION: 18 reducciones winner-protection ejecutadas en 6/6 cohortes; 4/6 cohortes positivas; mediana +118,46 EUR; todos los guardrails preregistrados PASS. No promociona producción; la confirmación temporal posterior falló y la policy exacta queda retirada para promoción.',
    'Fase 5 · winner protection V2 · primer blind PASS · confirmación posterior FAIL',
    'PHASE5_WINNER_PROTECTION_V2_BLIND_RESULT'
  ),
  archivedJob(
    'phase5-winner-protection-v2-confirmation',
    'Fase 5 · confirmación winner protection · blind one-shot',
    'Confirmación temporal 2005-01-10 -> 2007-12-31 consumida. CONFIRMATION_FAIL_NO_PROMOTION: 63 reducciones ejecutadas y 6/6 cohortes alcanzadas, pero sólo 2/6 cohortes mejoraron; mediana terminal negativa y guardrail de daño individual fallido. El job queda archivado y no puede relanzarse.',
    'Fase 5 · confirmación FAIL · no promoción · consumida',
    'PHASE5_WINNER_PROTECTION_V2_CONFIRMATION_RESULT'
  ),
  archivedJob(
    'phase6-forward-risk-context-readiness',
    'Fase 6 · Forward Risk V8 como contexto · Stage A V1',
    'Stage A V1 consumida tras 20 observaciones con contexto UNAVAILABLE por incompatibilidad técnica de materialización signalDate/executionDate. Outcomes no abiertos. No relanzar ni reescribir.',
    'Fase 6 · Stage A V1 consumida · fallo técnico pre-outcome',
    'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_COLLECTOR_RESULT'
  ),
  {
    id: 'core-outperformance-profitability-pit-v1',
    name: 'Operating Profitability · traducción PIT stock-level · V1',
    description: 'V1 cerrada como inconclusa antes de outcomes: la traducción SEC exigía simultáneamente COGS, SG&A e intereses y sólo obtuvo 114 filas evaluables en 2016 frente al mínimo 250.',
    marker: 'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'Operating Profitability PIT V1 · INCONCLUSIVE coverage 114/250 · pre-outcome',
    requiresSecEdgarUserAgent: true,
    steps: [
      { label: 'Guard Operating Profitability PIT', command: 'node', args: ['tests/coreOutperformanceProfitabilityPitV1.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'SEC PIT + Yahoo REAL · Operating Profitability', command: 'node', args: ['scripts/coreOutperformanceProfitabilityPitV1Live.mjs'] }
    ]
  },
  {
    id: 'core-outperformance-profitability-pit-r2',
    name: 'Operating Profitability · traducción PIT R2 Fama/French',
    description: 'R2 completada: traducción stock-level causal válida pero FAIL económico. CAGR 12,68% vs SPY 17,57% y URTH 14,99%; STOP_TRANSLATION_NO_RETUNING. Producción LEGACY.',
    marker: 'CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2_RESULT',
    historyLabel: 'Operating Profitability PIT R2 · FAIL actionable translation · cerrado',
    visibility: 'ARCHIVED',
    requiresSecEdgarUserAgent: true,
    steps: [
      { label: 'Guard sello Operating Profitability PIT R2', command: 'node', args: ['tests/coreOutperformanceProfitabilityPitR2Seal.unit.mjs'] },
      { label: 'Guard protocolo Operating Profitability PIT R2', command: 'node', args: ['tests/coreOutperformanceProfitabilityPitR2.unit.mjs'] },
      { label: 'Guard contrato missing-expense R2', command: 'node', args: ['tests/coreOutperformanceProfitabilityPitR2Contract.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'SEC PIT + Yahoo REAL · Operating Profitability R2', command: 'node', args: ['scripts/coreOutperformanceProfitabilityPitR2Live.mjs'] }
    ]
  },
  {
    id: 'fundamental-quality-valuation-broad-pit-v1',
    name: 'Fundamental Quality × valoración · validación PIT amplia',
    description: 'Diagnóstico research-only sobre miembros históricos del S&P 500 a 2021-05-03: EODHD fija la membresía PIT, SEC EDGAR aporta fundamentales con filed <= informationDate y Yahoo REAL mide outcomes. Quality y valoración están congelados antes de abrir outcomes; no puede promocionar producción.',
    marker: 'FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1_RESULT',
    visibility: 'PARKED',
    requiresGithubReplayToken: true,
    requiresEodhdApiKey: true,
    requiresSecEdgarUserAgent: true,
    steps: [
      { label: 'Guard Quality × valoración PIT', command: 'npx', args: ['tsx', 'tests/fundamentalQualityValuationBroadPitV1.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard master histórico PIT', command: 'npx', args: ['tsx', 'tests/historicalInstrumentMaster.unit.ts'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Validación stock-level PIT REAL', command: 'npx', args: ['tsx', 'scripts/fundamentalQualityValuationBroadPitV1Live.ts'] }
    ]
  },
  {
    id: 'phase6-forward-risk-context-stage-a-r2-readiness',
    name: 'Fase 6 · Forward Risk V8 como contexto · R2 collector',
    description: 'Stage A R2 fresh desde 2026-09-21. Ejecuta seal/readiness, arquitectura, PortfolioCandidateGate, paridad, superficie y TypeScript; sólo si todo pasa abre/continúa la muestra R2, persiste OPENED_COLLECTING antes del primer acceso a mercado y registra señal/contexto REAL causal. La sesión sucesora sólo materializa executionDate; no lee outcomes de 63 sesiones, no ejecuta órdenes y producción permanece LEGACY.',
    marker: 'PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_COLLECTOR_RESULT',
    visibility: 'PARKED',
    requiresGithubReplayToken: true,
    steps: [
      { label: 'Guard seal R2 Fase 6', command: 'npx', args: ['tsx', 'tests/phase6ForwardRiskContextStageAR2Seal.unit.ts'] },
      { label: 'Guard R2 Fase 6', command: 'npx', args: ['tsx', 'tests/phase6ForwardRiskContextStageAR2.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'Guard paridad replay/producto', command: 'npx', args: ['tsx', 'tests/decisionArchitectureParity.unit.ts'] },
      { label: 'Guard superficie productiva', command: 'npx', args: ['tsx', 'tests/productSurfaceClosureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Collector prospectivo REAL R2', command: 'npx', args: ['tsx', 'scripts/phase6ForwardRiskContextStageAR2CollectorLive.ts'] }
    ]
  },
  {
    id: 'pead-earnings-source-audit-v1',
    name: 'PEAD · auditoría causal de datos · V1',
    description: 'Auditoría estática R1 cerrada y supersedida pre-outcome: el snapshot Yahoo fue generado sobre tickers ITOT 2026 y puede introducir survivorship para 2024. Se conserva como evidencia técnica, pero ya no autoriza el diagnóstico de señal. Sin precios ni autoridad productiva.',
    marker: 'PEAD_EARNINGS_SOURCE_AUDIT_V1_RESULT',
    visibility: 'ARCHIVED',
    steps: [
      { label: 'Guard seal PEAD source audit', command: 'node', args: ['tests/peadEarningsSourceAuditV1Seal.unit.mjs'] },
      { label: 'Guard PEAD source audit', command: 'node', args: ['tests/peadEarningsSourceAuditV1.unit.mjs'] },
      { label: 'Integración PEAD sin red', command: 'node', args: ['tests/peadEarningsSourceAuditV1.integration.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Fuente estática pinneada · auditar causalidad PEAD', command: 'node', args: ['scripts/peadEarningsSourceAuditV1.mjs'] }
    ]
  },
  archivedJob(
    'pead-yahoo-calendar-source-audit-r2',
    'PEAD · auditoría Yahoo por rango + doble PIT · R2',
    'R2 consumida como auditoría de fuente. Yahoo devolvió 3.590 filas, 468 eventos PIT y EPS completo, pero timing histórico no utilizable (468 UNKNOWN/TAS). Terminó INCONCLUSIVE_SOURCE_TIMING_UNAVAILABLE. No abrió precios y no debe relanzarse.',
    'PEAD source R2 · INCONCLUSIVE timing unavailable · cerrado',
    'PEAD_EARNINGS_SOURCE_AUDIT_R2_RESULT'
  ),
  {
    id: 'timesfm-stage-a-smoke-v1',
    name: 'TimesFM 3.0 · Stage A · smoke causal',
    description: 'Smoke técnico research-only delegado a Hugging Face ZeroGPU gratuito. La app sólo ejecuta guards rápidos y consulta el estado remoto; fixture SYNTHETIC, sin precios/outcomes/recomendaciones, sin billing y producción LEGACY.',
    marker: 'TIMESFM_STAGE_A_SMOKE_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'TimesFM Stage A · PASS técnico real ZeroGPU · cerrado',
    requiresTimesFmRunner: true,
    steps: [
      { label: 'Guard cliente runner remoto TimesFM', command: 'node', args: ['tests/timesfmRemoteClient.unit.mjs'] },
      { label: 'Guard contrato runner remoto TimesFM', command: 'node', args: ['tests/timesfmRemoteRunnerContract.unit.mjs'] },
      { label: 'Guard reconciliación estado TimesFM', command: 'npx', args: ['tsx', 'tests/timesfmStateReconciliation.unit.ts'] },
      { label: 'Guard contrato TimesFM Stage A', command: 'node', args: ['tests/timesfmStageAContract.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Runner remoto TimesFM 3.0 · checkpoint + smoke', command: 'node', args: ['scripts/timesfmStageARemoteClient.mjs'] }
    ]
  },
  {
    id: 'timesfm-stage-b-predictive-benchmark-v1',
    name: 'TimesFM 3.0 · Stage B · señal vs core',
    description: 'Benchmark predictivo research-only preregistrado: Yahoo REAL, 31 cortes trimestrales, 8 activos frente a EUNL.DE, contexto causal de 512 sesiones y una sola inferencia batch en ZeroGPU gratuito. Mide señal relativa al core; no abre política económica ni modifica LEGACY.',
    marker: 'TIMESFM_STAGE_B_PREDICTIVE_BENCHMARK_V1_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'TimesFM Stage B · PASS diagnóstico señal · confirmación prospectiva habilitada',
    requiresTimesFmRunner: true,
    steps: [
      { label: 'Guard sello TimesFM Stage B', command: 'node', args: ['tests/timesfmStageBSeal.unit.mjs'] },
      { label: 'Guard protocolo TimesFM Stage B', command: 'node', args: ['tests/timesfmStageBProtocol.unit.mjs'] },
      { label: 'Guard cliente ZeroGPU Stage B', command: 'node', args: ['tests/timesfmStageBRemoteClient.unit.mjs'] },
      { label: 'Guard contrato ZeroGPU Stage B', command: 'node', args: ['tests/timesfmStageBRemoteContract.unit.mjs'] },
      { label: 'Guard harness predictivo Stage B', command: 'node', args: ['tests/timesfmStageBDiagnostic.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Yahoo REAL + TimesFM ZeroGPU · benchmark predictivo', command: 'node', args: ['scripts/timesfmStageBDiagnosticLive.mjs'] }
    ]
  },
  {
    id: 'timesfm-stage-b-prospective-confirmation-v1',
    name: 'TimesFM · confirmación prospectiva semanal',
    description: 'Collector fresh/blind único de TimesFM. Registra una observación semanal sin backfill: Stage B pairwise, selector directo shadow y los dos brazos multivariantes ya congelados (panel 9 y panel 9 + 23 covariables), siempre antes de outcomes. Producción continúa LEGACY.',
    marker: 'TIMESFM_STAGE_B_PROSPECTIVE_CONFIRMATION_V1_COLLECTOR_RESULT',
    visibility: 'PARKED',
    requiresTimesFmRunner: true,
    requiresTimesFmAuth: true,
    requiresGithubReplayToken: true,
    steps: [
      { label: 'Guard sello TimesFM prospectivo', command: 'node', args: ['tests/timesfmStageBProspectiveSeal.unit.mjs'] },
      { label: 'Guard cliente ZeroGPU Stage B autenticado', command: 'node', args: ['tests/timesfmStageBRemoteClient.unit.mjs'] },
      { label: 'Guard contrato ZeroGPU Stage B autenticado', command: 'node', args: ['tests/timesfmStageBRemoteContract.unit.mjs'] },
      { label: 'Guard selector directo TimesFM', command: 'npx', args: ['tsx', 'tests/timesFmDirectSelectorV1.unit.ts'] },
      { label: 'Guard contrato selector directo TimesFM', command: 'node', args: ['tests/timesFmDirectSelectorV1Contract.unit.mjs'] },
      { label: 'Guard paridad selector directo prospectivo', command: 'npx', args: ['tsx', 'tests/timesFmDirectSelectorProspectiveParity.unit.ts'] },
      { label: 'Guard protocolo/collector TimesFM prospectivo', command: 'node', args: ['tests/timesfmStageBProspective.unit.mjs'] },
      { label: 'Guard contrato no-outcome TimesFM prospectivo', command: 'node', args: ['tests/timesfmStageBProspectiveContract.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Collector semanal REAL + TimesFM ZeroGPU', command: 'node', args: ['scripts/timesfmStageBProspectiveCollectorLive.mjs'] }
    ]
  },
  {
    id: 'timesfm-relative-rank-economic-diagnostic-v1',
    name: 'TimesFM · dinero histórico · diagnóstico',
    description: 'Diagnóstico económico consumido/no promocional sobre las 31 fechas exactas de Stage B. Compara CORE_ARCHITECTURE_V1 + LEGACY frente a CORE_ARCHITECTURE_V1 + TIMESFM_RELATIVE_RANK_V1 en 15 escenarios de capital/riesgo, con mismo cash BCE, fiscalidad, costes y NEXT_OPEN. Producción continúa LEGACY.',
    marker: 'TIMESFM_RELATIVE_RANK_ECONOMIC_DIAGNOSTIC_V1_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'TimesFM relative-rank V1 · NO_ECONOMIC_REACH · muestra consumida',
    requiresTimesFmRunner: true,
    steps: [
      { label: 'Guard sello diagnóstico económico TimesFM', command: 'node', args: ['tests/timesfmRelativeRankEconomicDiagnosticV1Seal.unit.mjs'] },
      { label: 'Guard protocolo diagnóstico económico TimesFM', command: 'node', args: ['tests/timesfmRelativeRankEconomicDiagnosticV1.unit.mjs'] },
      { label: 'Guard contrato replay económico TimesFM', command: 'node', args: ['tests/timesfmRelativeRankEconomicDiagnosticV1Contract.unit.mjs'] },
      { label: 'Guard política TimesFM relative-rank', command: 'npx', args: ['tsx', 'tests/timesFmRelativeRankV1.unit.ts'] },
      { label: 'Guard contrato TimesFM relative-rank', command: 'node', args: ['tests/timesFmRelativeRankV1Contract.unit.mjs'] },
      { label: 'Guard replay fechas explícitas', command: 'npx', args: ['tsx', 'tests/dynamicHistoricalReplay.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Replay económico histórico LEGACY vs TimesFM', command: 'npx', args: ['tsx', 'scripts/timesfmRelativeRankEconomicDiagnosticV1.ts'] }
    ]
  },
  {
    id: 'timesfm-allocation-bridge-posthoc-v1',
    name: 'TimesFM · bridge económico post-hoc',
    description: 'Diagnóstico arquitectónico post-hoc sobre la muestra Stage B ya consumida. TimesFM no cambia gates ni sizing: sólo decide qué oportunidad ya elegible consume primero slots/capital escaso; LEGACY sigue calculando magnitudes. Sin autoridad de promoción.',
    marker: 'TIMESFM_ALLOCATION_BRIDGE_POSTHOC_V1_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'TimesFM allocation bridge V1 · POSTHOC_NO_REACH · cerrado',
    requiresTimesFmRunner: true,
    steps: [
      { label: 'Guard sello bridge TimesFM', command: 'node', args: ['tests/timesfmAllocationBridgePosthocV1Seal.unit.mjs'] },
      { label: 'Guard protocolo bridge TimesFM', command: 'node', args: ['tests/timesfmAllocationBridgePosthocV1.unit.mjs'] },
      { label: 'Guard contrato bridge TimesFM', command: 'node', args: ['tests/timesfmAllocationBridgePosthocV1Contract.unit.mjs'] },
      { label: 'Guard política TimesFM relative-rank', command: 'npx', args: ['tsx', 'tests/timesFmRelativeRankV1.unit.ts'] },
      { label: 'Guard contrato TimesFM relative-rank', command: 'node', args: ['tests/timesFmRelativeRankV1Contract.unit.mjs'] },
      { label: 'Guard replay fechas explícitas', command: 'npx', args: ['tsx', 'tests/dynamicHistoricalReplay.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Replay post-hoc LEGACY vs TimesFM bridge', command: 'npx', args: ['tsx', 'scripts/timesfmAllocationBridgePosthocV1.ts'] }
    ]
  },
  {
    id: 'timesfm-direct-selector-historical-diagnostic-v1',
    name: 'TimesFM · selector directo vs app vs core',
    description: 'Diagnóstico post-hoc donde TimesFM elige realmente el activo entre los 8 candidatos Stage B + EUNL. El replay canónico ejecuta 100% del shadow equity al ganador con NEXT_OPEN, costes, impuestos y cash causal. Compara TimesFM directo vs LEGACY app vs EUNL core; sin autoridad de promoción.',
    marker: 'TIMESFM_DIRECT_SELECTOR_HISTORICAL_DIAGNOSTIC_V1_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'TimesFM direct selector V1 · BEATS_NEITHER · cerrado',
    requiresTimesFmRunner: true,
    steps: [
      { label: 'Guard sello selector directo TimesFM', command: 'node', args: ['tests/timesfmDirectSelectorHistoricalDiagnosticV1Seal.unit.mjs'] },
      { label: 'Guard selector directo TimesFM', command: 'npx', args: ['tsx', 'tests/timesFmDirectSelectorV1.unit.ts'] },
      { label: 'Guard contrato selector directo TimesFM', command: 'node', args: ['tests/timesFmDirectSelectorV1Contract.unit.mjs'] },
      { label: 'Guard protocolo diagnóstico directo TimesFM', command: 'node', args: ['tests/timesfmDirectSelectorHistoricalDiagnosticV1.unit.mjs'] },
      { label: 'Guard contrato diagnóstico directo TimesFM', command: 'node', args: ['tests/timesfmDirectSelectorHistoricalDiagnosticV1Contract.unit.mjs'] },
      { label: 'Guard replay directo + fechas explícitas', command: 'npx', args: ['tsx', 'tests/dynamicHistoricalReplay.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Replay TimesFM directo vs LEGACY vs core', command: 'npx', args: ['tsx', 'scripts/timesfmDirectSelectorHistoricalDiagnosticV1.ts'] }
    ]
  },
  {
    id: 'timesfm-multivariate-context-v1',
    name: 'TimesFM · multivariante nativo + contexto',
    description: 'Diagnóstico histórico consumido. El panel nativo de 9 activos mostró señal; las 23 covariables no añadieron lift agregado. No tiene autoridad de promoción y no debe relanzarse ni retunearse sobre esta muestra.',
    marker: 'TIMESFM_MULTIVARIATE_CONTEXT_V1_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'TimesFM multivariante V1 · PANEL_SIGNAL_NO_COVARIATE_LIFT · muestra consumida',
    requiresTimesFmRunner: true,
    requiresTimesFmAuth: true,
    steps: [
      { label: 'Guard sello TimesFM multivariante V1', command: 'node', args: ['tests/timesfmMultivariateContextV1Seal.unit.mjs'] },
      { label: 'Guard protocolo TimesFM multivariante V1', command: 'node', args: ['tests/timesfmMultivariateContextV1.unit.mjs'] },
      { label: 'Guard contrato TimesFM multivariante V1', command: 'node', args: ['tests/timesfmMultivariateContextV1Contract.unit.mjs'] },
      { label: 'Guard contrato runner remoto TimesFM', command: 'node', args: ['tests/timesfmMultivariateContextV1RunnerReadiness.unit.mjs'] },
      { label: 'Guard sintaxis runner Space', command: 'python3', args: ['-m', 'py_compile', 'runner/timesfm/hf-space/app.py'] },
      { label: 'Guard endpoint runner TimesFM multivariante', command: 'node', args: ['scripts/timesfmMultivariateContextV1RunnerReadiness.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Yahoo REAL + TimesFM 3 · panel completo + covariables', command: 'node', args: ['scripts/timesfmMultivariateContextV1DiagnosticLive.mjs'] }
    ]
  },
  {
    id: 'timesfm-panel-sticky-oos-v1',
    name: 'TimesFM · Panel Sticky V1 · OOS económico',
    description: 'FAIL OOS cerrado. Sticky redujo la rotación pero quedó concentrado en 4GLD y perdió contra EUNL/LEGACY en 15/15 escenarios. Holdout consumido: no puede retunear ni promocionar una política nueva.',
    marker: 'TIMESFM_PANEL_STICKY_OOS_V1_RESULT',
    historyLabel: 'TimesFM Panel Sticky OOS V1 · FAIL · holdout consumido',
    visibility: 'ARCHIVED',
    requiresTimesFmRunner: true,
    requiresTimesFmAuth: true,
    steps: [
      { label: 'Guard sello TimesFM Panel Sticky OOS V1', command: 'node', args: ['tests/timesfmPanelStickyOosV1Seal.unit.mjs'] },
      { label: 'Guard protocolo TimesFM Panel Sticky OOS V1', command: 'node', args: ['tests/timesfmPanelStickyOosV1Protocol.unit.mjs'] },
      { label: 'Guard selector TimesFM Panel Sticky V1', command: 'npx', args: ['tsx', 'tests/timesFmPanelStickySelectorV1.unit.ts'] },
      { label: 'Guard contrato TimesFM Panel Sticky OOS V1', command: 'node', args: ['tests/timesfmPanelStickyOosV1Contract.unit.mjs'] },
      { label: 'Guard endpoint runner TimesFM multivariante', command: 'node', args: ['scripts/timesfmMultivariateContextV1RunnerReadiness.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Yahoo REAL + TimesFM · Panel Sticky OOS económico', command: 'npx', args: ['tsx', 'scripts/timesfmPanelStickyOosV1Live.ts'] }
    ]
  },
  {
    id: 'timesfm-panel-sticky-oos-v1-postmortem',
    name: 'TimesFM · postmortem señal OOS Sticky V1',
    description: 'Diagnóstico local sobre el holdout OOS ya consumido. Mide Rank IC 60, dirección y calidad del top-1 usando los forecasts guardados y los Yahoo REAL ya descargados. No llama a TimesFM, no abre muestra nueva y no puede promocionar producción.',
    marker: 'TIMESFM_PANEL_STICKY_OOS_V1_POSTMORTEM_RESULT',
    visibility: 'ARCHIVED',
    historyLabel: 'TimesFM Sticky V1 postmortem · señal OOS negativa · holdout consumido',
    steps: [
      { label: 'Guard métricas postmortem TimesFM', command: 'npx', args: ['tsx', 'tests/timesfmPanelStickyOosV1Postmortem.unit.ts'] },
      { label: 'Guard alcance postmortem TimesFM', command: 'node', args: ['tests/timesfmPanelStickyOosV1PostmortemContract.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Postmortem señal OOS TimesFM', command: 'npx', args: ['tsx', 'scripts/timesfmPanelStickyOosV1Postmortem.ts'] }
    ]
  },
  {
    id: 'kronos-stage-a-smoke-v1',
    name: 'Kronos · Stage A · smoke técnico',
    description: 'Smoke research-only de Kronos-small con código/pesos pinneados. Usa OHLCV sintético, conserva trayectorias Monte Carlo individuales y calcula P(retorno>0) y P(pendiente>0). Sin Yahoo, outcomes ni autoridad productiva.',
    marker: 'KRONOS_STAGE_A_SMOKE_V1_RESULT',
    historyLabel: 'Kronos Stage A · PASS_STAGE_A_TECHNICAL_SMOKE · cerrado',
    visibility: 'ARCHIVED',
    steps: [
      { label: 'Guard sello Kronos Stage A', command: 'node', args: ['tests/kronosStageASeal.unit.mjs'] },
      { label: 'Guard bootstrap pip local Kronos', command: 'node', args: ['tests/kronosPipBootstrap.unit.mjs'] },
      { label: 'Guard protocolo Kronos Stage A', command: 'node', args: ['tests/kronosStageAProtocol.unit.mjs'] },
      { label: 'Guard contrato Kronos Stage A', command: 'node', args: ['tests/kronosStageAContract.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Kronos-small · smoke aislado CPU', command: 'node', args: ['scripts/kronosStageALive.mjs'] }
    ]
  },
  {
    id: 'kronos-stage-b-diagnostic-v1',
    name: 'Kronos · Stage B · diagnóstico 20/60',
    description: 'Benchmark histórico descriptivo sobre la muestra ya consumida de TimesFM: mismo panel/anchors, Yahoo REAL causal, 20 trayectorias por activo y horizontes 20/60. Compara RankIC, dirección, Brier y momentum. Sin autoridad de promoción por cutoff de pretraining desconocido.',
    marker: 'KRONOS_STAGE_B_DIAGNOSTIC_V1_RESULT',
    visibility: 'CURRENT',
    steps: [
      { label: 'Guard sello Kronos Stage B', command: 'node', args: ['tests/kronosStageBDiagnosticV1Seal.unit.mjs'] },
      { label: 'Guard protocolo Kronos Stage B', command: 'node', args: ['tests/kronosStageBDiagnosticV1.unit.mjs'] },
      { label: 'Guard contrato Kronos Stage B', command: 'node', args: ['tests/kronosStageBDiagnosticV1Contract.unit.mjs'] },
      { label: 'Guard sintaxis Python Kronos Stage B', command: 'python3', args: ['-m', 'py_compile', 'backend/scripts/kronos_stage_b_diagnostic.py'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Kronos runtime · revalidar Stage A', command: 'node', args: ['scripts/kronosStageALive.mjs'] },
      { label: 'Kronos Stage B · Yahoo REAL + batch 20x', command: 'node', args: ['scripts/kronosStageBDiagnosticLive.mjs'] }
    ]
  },
  {
    id: 'pead-yahoo-calendar-source-audit-r3',
    name: 'PEAD · Yahoo histórico + doble PIT · R3 next-session',
    description: 'R3 completada con PASS causal: 470 eventos PIT, 100% actual/estimate y surprise, 98,48% overlap R1, 0 duplicados/contradicciones/unparseables. Sin precios ni outcomes económicos.',
    marker: 'PEAD_EARNINGS_SOURCE_AUDIT_R3_RESULT',
    historyLabel: 'PEAD Source Audit R3 · PASS causal · 470 eventos',
    visibility: 'ARCHIVED',
    steps: [
      { label: 'Guard seal PEAD R3', command: 'node', args: ['tests/peadYahooCalendarSourceAuditR3Seal.unit.mjs'] },
      { label: 'Guard PEAD R3 next-session', command: 'node', args: ['tests/peadYahooCalendarSourceAuditR3.unit.mjs'] },
      { label: 'Guard transporte Yahoo R2', command: 'node', args: ['tests/peadYahooCalendarSourceAuditR2.integration.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Yahoo REAL · auditar PEAD R3 next-session', command: 'node', args: ['scripts/peadYahooCalendarSourceAuditR3.mjs'] }
    ]
  },
  {
    id: 'pead-analyst-surprise-v1',
    name: 'PEAD · calidad predictiva de sorpresa · V1',
    description: 'Cerrado tras ejecución: FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY. Cobertura 455/470 (96,8%) suficiente, pero Surprise(%) no mostró señal estadísticamente útil a 60 sesiones; sin política ni retuning.',
    marker: 'PEAD_ANALYST_SURPRISE_V1_RESULT',
    historyLabel: 'PEAD Analyst Surprise V1 · FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY · cerrado',
    visibility: 'ARCHIVED',
    steps: [
      { label: 'Guard fuente PEAD R3', command: 'node', args: ['tests/peadSignalSourceR3Readiness.unit.mjs'] },
      { label: 'Guard seal PEAD señal', command: 'node', args: ['tests/peadSignalDiagnosticV1Seal.unit.mjs'] },
      { label: 'Guard PEAD señal causal', command: 'node', args: ['tests/peadSignalDiagnosticV1.unit.mjs'] },
      { label: 'Guard PEAD fuente cerrada', command: 'node', args: ['tests/peadEarningsSourceAuditV1Seal.unit.mjs'] },
      { label: 'Guard runtime validación', command: 'npx', args: ['tsx', 'tests/researchValidationRuntime.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Yahoo REAL · diagnóstico PEAD 60 sesiones', command: 'node', args: ['scripts/peadSignalDiagnosticV1.mjs'] }
    ]
  },
  archivedJob(
    'sector-52w-high-leadership-v1',
    'Precio · liderazgo sectorial 52W · V1',
    'Cerrado el 2026-09-28 con FAIL_DIAGNOSTIC válido en R3. A 20 pb/lado no superó SPY ni el basket9 y tuvo peor drawdown que URTH. Replicación 2019-2025 permaneció sin abrir. No relanzar ni retunear esta política sobre la muestra consumida.',
    '52W V1 · FAIL_DIAGNOSTIC · cerrado',
    'SECTOR_52W_HIGH_LEADERSHIP_V1_RESULT'
  ),
  archivedJob(
    'phase8-historical-instrument-master-v1',
    'Fase 8 · universo histórico PIT · cierre estructural',
    'Cierre estructural PASS el 2026-09-20: instrument master PIT integrado en el replay causal, current catalogue bloqueado como evidencia histórica y cobertura COMPLETE fail-closed. El inventario EODHD quedó pendiente por cuota diaria externa; no invalida la arquitectura ni exige repetir el job.',
    'Fase 8 · estructura PIT PASS · población REAL pendiente',
    'PHASE8_HISTORICAL_INSTRUMENT_MASTER_PASS'
  ),
  archivedJob(
    'phase9-end-to-end-preclose-v1',
    'Fase 9 · auditoría end-to-end V1 · pre-cierre técnico',
    'PASS FINAL el 2026-09-20. TECHNICAL_V1_PRECLOSE_PASS: arquitectura, producto, usuarios/seguridad, ejecución, cartera, broker, fiscalidad, replay causal, flujos externos, cash BCE/fiscalidad, PIT estructural, runtime y TypeScript pasaron en una única ejecución consolidada. No relanzar salvo bug/regresión reproducible.',
    'Fase 9 · pre-cierre técnico V1 PASS · cerrado',
    'PHASE9_END_TO_END_PRECLOSE_RESULT'
  ),
  {
    id: 'quality-allocation-dynamic-future-forward-v1',
    name: 'QUALITY allocation · future-forward dinámico',
    description: 'Phase A prospectiva sobre Top64 current/live dinámico. Una única foto mensual consecutiva en la ventana congelada del día 9, 22:30-24:00 Europe/Madrid; mismo snapshot y 13.000 EUR de notional research para LEGACY y QUALITY_ALLOCATION_BRIDGE_V1. Reglas e implementación crítica quedan fingerprintadas, el estado autoritativo se encadena en replay-results y producción continúa LEGACY.',
    marker: 'QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_RESULT',
    visibility: 'PARKED',
    requiresGithubReplayToken: true,
    steps: [
      { label: 'Guard future-forward dinámico', command: 'npx', args: ['tsx', 'tests/qualityAllocationDynamicFutureForwardV1.unit.ts'] },
      { label: 'Guard QUALITY bridge congelado', command: 'npx', args: ['tsx', 'tests/opportunityQualityAllocationBridge.unit.ts'] },
      { label: 'Guard Top64 dinámico', command: 'npx', args: ['tsx', 'tests/dynamicMarketShortlist.unit.ts'] },
      { label: 'Guard arquitectura core', command: 'npx', args: ['tsx', 'tests/coreArchitectureV1.unit.ts'] },
      { label: 'Guard PortfolioCandidateGate', command: 'npx', args: ['tsx', 'tests/portfolioCandidateGate.unit.ts'] },
      { label: 'TypeScript', command: 'npm', args: ['run', 'lint'] },
      { label: 'Checkpoint prospectivo REAL', command: 'npx', args: ['tsx', 'scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts'] }
    ]
  }
];

const states = new Map<string, JobState>();

function initialState(): JobState {
  return { status: 'IDLE', startedAt: null, finishedAt: null, currentStep: null, processId: null, exitCode: null, output: '', result: null, error: null };
}

function persistState(id: string, state: JobState): void {
  try { saveDurableJobState(id, state); } catch { /* runtime state remains available in memory */ }
}

function stateFor(id: string): JobState {
  const existing = states.get(id);
  if (existing) return existing;

  const durable = loadDurableJobState(id) as JobState | null;
  if (!durable) {
    const fresh = initialState();
    states.set(id, fresh);
    return fresh;
  }

  const reconciled = reconcileLoadedJobState(durable) as { state: JobState; changed: boolean };
  states.set(id, reconciled.state);
  if (reconciled.changed) persistState(id, reconciled.state);
  return reconciled.state;
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

function runStep(jobId: string, step: Step, state: JobState): Promise<{ code: number; output: string }> {
  return new Promise(resolve => {
    state.currentStep = step.label;
    state.processId = null;
    appendOutput(state, `\n\n=== ${step.label} ===\n`);
    persistState(jobId, state);
    let stepOutput = '';
    const capture = (value: unknown) => {
      const text = String(value);
      stepOutput += text;
      appendOutput(state, text);
    };
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: { ...process.env, DISABLE_HMR: 'true' },
      shell: process.platform === 'win32'
    });
    state.processId = child.pid ?? null;
    persistState(jobId, state);
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', error => {
      capture(`\nPROCESS_ERROR: ${error.message}\n`);
      state.processId = null;
      persistState(jobId, state);
      resolve({ code: 1, output: stepOutput });
    });
    child.on('close', code => {
      state.processId = null;
      persistState(jobId, state);
      resolve({ code: code ?? 1, output: stepOutput });
    });
  });
}

function prerequisiteError(job: JobDefinition): string | null {
  if (job.requiresGithubReplayToken && !process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()) {
    if (job.id === 'quality-allocation-dynamic-future-forward-v1') return 'QUALITY_FF_DURABLE_GITHUB_TOKEN_REQUIRED';
    return 'DURABLE_GITHUB_TOKEN_REQUIRED';
  }
  if (job.requiresEodhdApiKey && !process.env.EODHD_API_KEY?.trim()) return 'EODHD_API_KEY_REQUIRED';
  if (job.requiresSecEdgarUserAgent) {
    const secUa = process.env.SEC_EDGAR_USER_AGENT?.trim() ?? '';
    if (!secUa) return 'SEC_EDGAR_USER_AGENT_REQUIRED';
    if (!/\S+@\S+\.\S+/.test(secUa)) return 'SEC_EDGAR_USER_AGENT_INVALID';
  }
  if (job.requiresTimesFmRunner && !timesFmRemoteRunnerConfigured()) return 'TIMESFM_REMOTE_RUNNER_REQUIRED';
  if (job.requiresTimesFmAuth && !timesFmHfTokenConfigured()) return 'TIMESFM_HF_TOKEN_REQUIRED';
  return null;
}

async function asyncPrerequisiteError(job: JobDefinition): Promise<string | null> {
  const syncReason = prerequisiteError(job);
  if (syncReason) return syncReason;
  if (job.id === TIMESFM_MULTIVARIATE_CONTEXT_JOB_ID || job.id === TIMESFM_PROSPECTIVE_JOB_ID || job.id === TIMESFM_PANEL_STICKY_OOS_JOB_ID) {
    try {
      const available = await checkTimesFmRemoteEndpoint(TIMESFM_MULTIVARIATE_CONTEXT_ENDPOINT);
      if (!available) return 'TIMESFM_MULTIVARIATE_RUNNER_ENDPOINT_REQUIRED';
      const remote = await fetchTimesFmMultivariateRunnerStatus();
      if (
        remote.apiVersion !== 3 ||
        remote.maxAnchorsPerCall !== 8 ||
        remote.gpuDurationSeconds !== 45 ||
        remote.targetCount !== 9 ||
        remote.pastOnlyCovariateCount !== 23 ||
        remote.contextLength !== 512 ||
        remote.forecastHorizon !== 60 ||
        remote.productionAuthority !== false ||
        remote.productionDefault !== 'LEGACY'
      ) {
        return 'TIMESFM_MULTIVARIATE_RUNNER_VERSION_REQUIRED';
      }
      const quota = await fetchTimesFmZeroGpuQuota();
      const minimumQuota = job.id === TIMESFM_MULTIVARIATE_CONTEXT_JOB_ID ? 270 : job.id === TIMESFM_PANEL_STICKY_OOS_JOB_ID ? 160 : 120;
      if (quota.remaining < minimumQuota) return 'TIMESFM_ZERO_GPU_QUOTA_INSUFFICIENT';
    } catch (error: any) {
      const message = error?.message || String(error);
      if (/TIMESFM_HF_TOKEN_REQUIRED/i.test(message)) return 'TIMESFM_HF_TOKEN_REQUIRED';
      if (/TIMESFM_HF_TOKEN_QUOTA_PERMISSION_REQUIRED/i.test(message)) return 'TIMESFM_HF_TOKEN_QUOTA_PERMISSION_REQUIRED';
      if (/404|multivariate_context_status|TIMESFM_MULTIVARIATE_STATUS/i.test(message)) {
        return 'TIMESFM_MULTIVARIATE_RUNNER_VERSION_REQUIRED';
      }
      return 'TIMESFM_REMOTE_RUNNER_UNREACHABLE';
    }
  }
  return null;
}

function prerequisiteDetail(reason: string): string {
  if (reason === 'EODHD_API_KEY_REQUIRED') {
    return 'Falta EODHD_API_KEY en el backend local. No se han lanzado guards, descargas ni cálculos.';
  }
  if (reason === 'SEC_EDGAR_USER_AGENT_REQUIRED') {
    return 'Falta SEC_EDGAR_USER_AGENT en el backend local. No se han lanzado guards, descargas ni cálculos.';
  }
  if (reason === 'TIMESFM_REMOTE_RUNNER_REQUIRED') {
    return 'TimesFM requiere el Space gratuito Hugging Face ZeroGPU. AI Studio ya no ejecuta ni descarga el modelo localmente.';
  }
  if (reason === 'TIMESFM_MULTIVARIATE_RUNNER_ENDPOINT_REQUIRED') {
    return 'El Space TimesFM remoto todavía no expone multivariate_context_predict. El job queda bloqueado antes de guards, Yahoo o inferencia.';
  }
  if (reason === 'TIMESFM_MULTIVARIATE_RUNNER_VERSION_REQUIRED') {
    return 'El Space TimesFM remoto no coincide con la versión requerida: API v3, lotes de 8 y 45 s por llamada. El job queda bloqueado antes de guards, Yahoo o inferencia.';
  }
  if (reason === 'TIMESFM_HF_TOKEN_REQUIRED') {
    return 'Falta HF_TOKEN en el backend. TimesFM ZeroGPU debe ejecutarse autenticado para usar la cuota de tu cuenta y no la cuota anónima.';
  }
  if (reason === 'TIMESFM_HF_TOKEN_QUOTA_PERMISSION_REQUIRED') {
    return 'HF_TOKEN existe, pero no permite consultar la cuota ZeroGPU. Un token fine-grained necesita Billing > Read billing usage and payment method status.';
  }
  if (reason === 'TIMESFM_ZERO_GPU_QUOTA_INSUFFICIENT') {
    return 'La cuota ZeroGPU autenticada restante es insuficiente para la ejecución requerida. El job no arrancará hasta que la cuota se recupere.';
  }
  if (reason === 'TIMESFM_REMOTE_RUNNER_UNREACHABLE') {
    return 'No se ha podido verificar el Space TimesFM remoto. El job queda bloqueado antes de guards, Yahoo o inferencia.';
  }
  return 'Falta GITHUB_REPLAY_SYNC_TOKEN en el backend local. No se han lanzado guards ni cálculos.';
}

async function runJob(job: JobDefinition): Promise<void> {
  const state = stateFor(job.id);
  state.status = 'RUNNING';
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.currentStep = null;
  state.processId = null;
  state.exitCode = null;
  state.output = '';
  state.result = null;
  state.error = null;
  persistState(job.id, state);
  try {
    const missing = await asyncPrerequisiteError(job);
    if (missing) throw new Error(missing);
    for (const step of job.steps) {
      const stepRun = await runStep(job.id, step, state);
      if (stepRun.code !== 0) {
        state.exitCode = stepRun.code;
        state.result = extractJsonAfterMarker(stepRun.output, job.marker);
        state.status = 'FAILED';
        state.error = `Falló: ${step.label}`;
        persistState(job.id, state);
        return;
      }
    }
    state.exitCode = 0;
    state.result = extractJsonAfterMarker(state.output, job.marker);
    state.status = 'PASSED';
    persistState(job.id, state);
  } catch (error: any) {
    state.status = 'FAILED';
    state.exitCode = 1;
    state.error = error?.message || String(error);
    persistState(job.id, state);
  } finally {
    state.currentStep = null;
    state.processId = null;
    state.finishedAt = new Date().toISOString();
    persistState(job.id, state);
  }
}

async function publicJob(job: JobDefinition) {
  const blockedReason = await asyncPrerequisiteError(job);
  const local = stateFor(job.id);
  let resolved: JobState = local;
  let runnerReachable: boolean | null = null;
  let runnerError: string | null = null;

  if (job.id === TIMESFM_REMOTE_JOB_ID && timesFmRemoteRunnerConfigured()) {
    try {
      const remote = await fetchTimesFmRemoteState();
      runnerReachable = true;
      if (remote) {
        const localComparable = {
          jobId: TIMESFM_REMOTE_JOB_ID,
          status: local.status,
          startedAt: local.startedAt,
          finishedAt: local.finishedAt,
          currentStep: local.currentStep,
          exitCode: local.exitCode,
          output: local.output,
          result: local.result,
          error: local.error
        };
        const chosen = reconcileTimesFmState(localComparable, remote);
        resolved = {
          status: chosen.status,
          startedAt: chosen.startedAt,
          finishedAt: chosen.finishedAt,
          currentStep: chosen.currentStep,
          processId: null,
          exitCode: chosen.exitCode,
          output: chosen.output,
          result: chosen.result,
          error: chosen.error
        };
      }
    } catch (error: any) {
      runnerReachable = false;
      runnerError = error?.message || String(error);
    }
  }

  return {
    id: job.id,
    name: job.name,
    description: job.description,
    readyToRun: blockedReason == null,
    blockedReason,
    execution: isRemoteTimesFmValidationJob(job) ? 'REMOTE_TIMESFM_RUNNER' : 'LOCAL_APP_BACKEND',
    runnerReachable,
    runnerError,
    ...resolved
  };
}

function safeFilePart(value: string): string {
  return value.replace(/[:.]/g, '-').replace(/[^0-9A-Za-zTZ_-]/g, '_').slice(0, 120) || 'result';
}

researchValidationRouter.get('/jobs', async (_req: Request, res: Response): Promise<void> => {
  const currentJobs = await Promise.all(JOBS.filter(job => job.visibility === 'CURRENT').map(publicJob));
  const history = JOBS.filter(job => job.visibility === 'ARCHIVED').map(job => ({ id: job.id, label: job.historyLabel ?? job.name }));
  res.json({
    aiTokensUsed: false,
    execution: 'MIXED_LOCAL_AND_REMOTE',
    prerequisites: {
      githubReplaySyncConfigured: Boolean(process.env.GITHUB_REPLAY_SYNC_TOKEN?.trim()),
      eodhdConfigured: Boolean(process.env.EODHD_API_KEY?.trim()),
      secEdgarUserAgentConfigured: Boolean(process.env.SEC_EDGAR_USER_AGENT?.trim()),
      timesFmRemoteRunnerConfigured: timesFmRemoteRunnerConfigured(),
      timesFmHfTokenConfigured: timesFmHfTokenConfigured()
    },
    jobs: currentJobs,
    history
  });
});

researchValidationRouter.get('/jobs/:id/result.json', async (req: Request, res: Response): Promise<void> => {
  const job = JOBS.find(item => item.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'UNKNOWN_VALIDATION_JOB' }); return; }
  const state = job.id === TIMESFM_REMOTE_JOB_ID ? await publicJob(job) : stateFor(job.id);
  if (state.result == null) { res.status(404).json({ error: 'VALIDATION_RESULT_NOT_AVAILABLE' }); return; }
  const stamp = safeFilePart(state.finishedAt || new Date().toISOString());
  const filename = `${safeFilePart(job.id)}-${stamp}.json`;
  res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    jobId: job.id,
    jobName: job.name,
    status: state.status,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    exitCode: state.exitCode,
    error: state.error,
    result: state.result
  });
});

researchValidationRouter.get('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
  const job = JOBS.find(item => item.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'UNKNOWN_VALIDATION_JOB' }); return; }
  const publicState = await publicJob(job);
  res.json({ aiTokensUsed: false, execution: publicState.execution, archived: job.visibility === 'ARCHIVED', job: publicState });
});

researchValidationRouter.post('/jobs/:id/run', async (req: Request, res: Response): Promise<void> => {
  const job = JOBS.find(item => item.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'UNKNOWN_VALIDATION_JOB' }); return; }
  if (process.env.NODE_ENV === 'production' && !isRemoteTimesFmValidationJob(job)) {
    res.status(403).json({ error: 'RESEARCH_VALIDATION_LOCAL_ONLY', execution: 'LOCAL_APP_BACKEND' });
    return;
  }
  if (job.visibility === 'ARCHIVED') { res.status(409).json({ error: 'VALIDATION_ARCHIVED_READ_ONLY', job: await publicJob(job) }); return; }
  const missing = await asyncPrerequisiteError(job);
  if (missing) {
    res.status(412).json({
      error: missing,
      detail: prerequisiteDetail(missing),
      job: await publicJob(job)
    });
    return;
  }
  const state = stateFor(job.id);
  if (state.status === 'RUNNING') { res.status(409).json({ error: 'VALIDATION_ALREADY_RUNNING', job: await publicJob(job) }); return; }
  void runJob(job);
  const acceptedState = stateFor(job.id);
  res.status(202).json({
    ok: true,
    aiTokensUsed: false,
    execution: isRemoteTimesFmValidationJob(job) ? 'REMOTE_TIMESFM_RUNNER' : 'LOCAL_APP_BACKEND',
    job: {
      id: job.id,
      name: job.name,
      description: job.description,
      readyToRun: true,
      blockedReason: null,
      execution: isRemoteTimesFmValidationJob(job) ? 'REMOTE_TIMESFM_RUNNER' : 'LOCAL_APP_BACKEND',
      runnerReachable: null,
      runnerError: null,
      ...acceptedState
    }
  });
});
