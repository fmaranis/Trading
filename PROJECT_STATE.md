# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar primero el HEAD real de `main`, leer este archivo y después `docs/APP_FLOW_AND_ROADMAP.md`. Si un chat antiguo contradice el repositorio actual, manda el repositorio.

Histórico técnico detallado anterior a Fase 6:

- `docs/PROJECT_STATE_FULL_HISTORY_THROUGH_2026-09-15_PRE_PHASE6.md`.

Documentos normativos principales:

- `PROJECT_SKILLS_POLICY.md`;
- `docs/APP_FLOW_AND_ROADMAP.md`;
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`;
- `docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md`;
- `docs/DECISIONS.md`.

---

# 1. REGLAS OPERATIVAS QUE NO SE PUEDEN ROMPER

- Rama canónica: `main`.
- Arquitectura productiva: `CORE_ARCHITECTURE_V1`.
- Cadena conceptual única: `AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine/evaluatePortfolioDecision -> ejecución y seguimiento`.
- Allocation/opportunity productivo: `LEGACY` hasta evidencia fresh suficiente y promoción explícita.
- `CORE_ELIGIBILITY_V2`: shadow.
- Forward Risk: sin autoridad productiva mientras Fase 6 siga en investigación.
- No crear motores, replays o recomendaciones paralelas si una capacidad cabe en la arquitectura existente.
- Replays y validaciones largas: motor local/backend de la app, nunca GitHub Actions.
- Guards/unit tests/TypeScript antes de cualquier cálculo largo.
- Procedencia explícita `REAL / STATIC_REFERENCE / SYNTHETIC`; cero fallback sintético silencioso.
- Yahoo current/live no reconstruye retrospectivamente un universo histórico.
- Replay causal, sin lookahead; ejecución posterior a señal / `NEXT_OPEN` cuando corresponda.
- Frecuencia DAILY/WEEKLY/MONTHLY/QUARTERLY no crea dinero.
- `stagedCapitalPlan` es capital disponible, no aportación periódica.
- Aportaciones/retiradas: `externalCashFlows` explícitos y fechados.
- Cash histórico BCE y fiscalidad permanecen causales e independientes de benchmarks.
- Separar siempre calidad de señal de calidad de política económica.
- No retunear thresholds, coeficientes, esperas, confirmaciones o sizing tras observar la misma muestra.
- Una muestra usada para diseñar o interpretar una política queda consumida para promoción.
- PASS inicial no promociona producción: exige confirmación independiente.
- FAIL de política no invalida automáticamente la señal predictiva.
- V9/V10/V11 permanecen retiradas en sus formas probadas.
- No crear V12/V13 como ajuste retrospectivo de V8-V11.
- Tras cambios relevantes actualizar este archivo.

---

# 2. RUTA VIGENTE

```text
FASE 0  MAPA MAESTRO / ESTADO CANÓNICO       DONE
FASE 1  BASE PRODUCTIVA V1                    DONE salvo bug/regresión reproducible
FASE 2  USUARIOS / SEGURIDAD / AUTONOMÍA      DONE · 2A PASS · 2B PASS RUNTIME
FASE 3  PROTOCOLO ECONÓMICO FINAL             DONE / FROZEN
FASE 4  REENTRADA TRAS SALIDA ERRÓNEA         CLOSED · R2/R3 CONSUMED · INCONCLUSIVE REACH
FASE 5  PROTECCIÓN DE GRANDES GANADORES       CLOSED · FIRST BLIND PASS · CONFIRMATION FAIL · NO PROMOTION
FASE 6  FORWARD RISK V8 COMO CONTEXTO         V1 CONSUMED TECHNICAL FAIL · R2 OPENED/COLLECTING · 0 OBS
FASE 7  QUALITY FUTURE FORWARD                WAITING/COLLECTING en paralelo
FASE 8  UNIVERSO HISTÓRICO POINT-IN-TIME      STRUCTURAL CLOSED · REAL MASTER POPULATION PENDING
FASE 9  AUDITORÍA END-TO-END / CIERRE V1      CLOSED · TECHNICAL_V1_PRECLOSE_PASS
FASE 10 EXPANSIONES V2                         DEFERRED
```

Carriles:

- producto/operación: F0 -> F1 -> F2 -> F9;
- evidencia económica: F3 -> F4 -> F5 -> F6 -> F9;
- prospectivo por calendario: F7;
- datos históricos: F8 -> F9;
- V2: F10 sólo después del cierre V1.

---

# 3. PRODUCTO Y ARQUITECTURA — ESTADO CERRADO

Cadena productiva:

```text
mercado actual REAL
-> AssetUniverseScanner
-> Top64 dinámico
-> PortfolioCandidateGate
-> InvestmentDecisionEngine
-> PortfolioDecisionEngine / evaluatePortfolioDecision
-> CORE_GATE_V1
-> CORE_ARCHITECTURE_V1
-> buildPortfolioExecutionPlan
-> applyTaxAwareExecutionOverlay
-> COMPRAR / VENDER / TRASPASAR / REVIEW / NO HACER NADA
-> ejecución manual
-> registro y seguimiento
```

Estado durable:

- discovery current/live dinámico: PASS / archived;
- Top64 no es whitelist fija;
- acciones individuales current/live no comparten un bucket artificial de dos slots;
- replay histórico integrado y causal;
- cash BCE histórico + fiscalidad integrados;
- usuarios privados/Firebase/ADMIN: Fase 2A PASS;
- backend de alertas sin `PortfolioRotationReviewEngine` paralelo: Fase 2B PASS runtime;
- `rotationStatus:null` se conserva por compatibilidad;
- quick product closure: 34/34 invariantes PASS en última ejecución reportada;
- producción continúa `LEGACY`.

---

# 4. FASE 4 — CERRADA

`EXIT_PROCEEDS_CUSTODY_V1` permanece research-only.

R2 y R3 están consumidas. R3 alcanzó datos/core válidos pero obtuvo:

- scanner 66/66;
- seis cohortes válidas;
- `uniqueExitReservations = 0`;
- `uniqueReentries = 0`;
- `INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

No crear R4 para forzar eventos ni retunear con R2/R3.

Documento final:

- `docs/phase4_reentry_cash_custody_v1_final_outcome.md`.

---

# 5. FASE 5 — CERRADA / NO PROMOTION

Política probada:

`TREND_PROTECTION_V2_WINNER_ONLY`.

Parámetros exactos congelados y ya consumidos:

- MFE 8%;
- giveback 6 pp;
- strong giveback 8 pp;
- streak 3;
- worsening 2 pp;
- una reducción 25% por episodio;
- reclaim antes de nueva reducción;
- loser branch neutralizada.

Primer blind 2001–2003:

- PASS candidate for confirmation;
- 18 reducciones;
- reach 6/6;
- 4/6 cohortes positivas;
- mediana +118,46 EUR;
- agregado +736,47 EUR.

Confirmación temporal 2005-01-10 -> 2007-12-31:

- `PHASE5_CONFIRMATION_OPENED_CONSUMED`;
- `CONFIRMATION_FAIL_NO_PROMOTION`;
- 63 reducciones;
- reach 6/6;
- sólo 2/6 cohortes positivas;
- mediana terminal aprox. -264,69 EUR;
- agregado aprox. -2.653,41 EUR;
- mediana de max drawdown mejoró aprox. -4,42 pp;
- peor delta individual aprox. -1.853 EUR, peor que el guardrail -650 EUR.

Interpretación obligatoria:

- la protección tuvo reach real y redujo drawdown en mediana;
- no generalizó como mejora de riqueza terminal;
- la policy exacta queda retirada para promoción;
- no retunear 8%, 6/8 pp, streak 3, worsening 2 pp ni 25%;
- no crear V3 paramétrica sobre estas muestras;
- producción sigue `LEGACY`.

Los jobs de Fase 5 están archivados/read-only y no deben relanzarse.

---

# 6. FASE 6 — FORWARD RISK V8 COMO CONTEXTO

## 6.1 Principio retenido

V8 sí mostró capacidad útil para anticipar futuras caídas. Los FAIL económicos de V8/V9/V10/V11 significan que fallaron las traducciones económicas ensayadas, no que desaparezca el contenido predictivo de V8.

Stage A pregunta sólo por información predictiva incremental dentro del contexto canónico de candidatos. Todavía no existe policy económica Stage B.

`FORWARD_RISK_CONTEXT_V1`:

- `contextScorePct = max(V5 vulnerabilityScorePct, V7 signalScorePct)`;
- contexto alto `>=80`;
- ambas ramas obligatorias;
- missing/invalid cualquiera de las dos => `UNAVAILABLE`;
- no cambia eligibility, ranking, sizing, holdings ni órdenes;
- no ON/OFF diario productivo;
- producción `LEGACY`.

## 6.2 Stage A — muestra future-forward congelada

Documento:

- `docs/phase6_forward_risk_context_stage_a_preregistration.md`.

Ventana:

- `2026-09-16 -> 2027-03-31`;
- warm-up desde `2022-01-03`;
- DAILY;
- exactos 10 activos: `EUNL, SXR8, EXSA, IS3N, IUSN, QDVE, VVSM, XDWH, EXH1, ISPA`;
- mínimo 8 activos válidos;
- `currentOpenDiscovery=false`;
- REAL-only.

Outcome congelado:

- referencia `NEXT_OPEN_AFTER_INFORMATION_DATE`;
- horizonte 63 sesiones;
- max peak-to-trough drawdown dentro de 63 sesiones;
- downside material >=5%;
- outcomes no se leen durante collection;
- veredicto final sólo cuando madure toda la ventana congelada.

Reach congelado:

- >=200 observaciones ELIGIBLE evaluables;
- >=30 high-risk ELIGIBLE;
- >=100 normal-risk ELIGIBLE;
- >=4 activos con high-risk;
- >=6 semanas naturales con high-risk;
- un solo activo <=35% del high-risk reach.

Gates predictivos congelados:

- lift absoluto de tasa de downside >=10 pp;
- risk ratio >=1,5;
- lift de severidad mediana >=1 pp.

## 6.3 Refreeze operativo pre-open de continuidad

El 2026-09-16, todavía antes de abrir Stage A, se sustituyó la exigencia impracticable de tener la app activa cada sesión por una regla operativa causal congelada:

`DETERMINISTIC_POST_FREEZE_CAUSAL_CATCH_UP`.

Esto **no modifica** muestra, fechas, activos, V8, threshold, outcome, reach ni gates.

Reglas:

- cero backfill anterior a 2026-09-16;
- todas las sesiones completadas desde el inicio se registran exactamente una vez;
- sesiones faltantes se reconstruyen en orden, empezando por la más antigua;
- no se seleccionan/omiten fechas según outcomes;
- cada candidate prefix termina exactamente en `informationDate`;
- V5/V7 sólo usan información <= `informationDate`;
- una sesión sucesora de EUNL sólo certifica que la anterior cerró y no entra en la señal/gate de esa fecha;
- máximo 5 fechas pendientes por ejecución es batching, no selección;
- datos/provider failure quedan pendientes para catch-up causal, nunca sintético.

## 6.4 Collector/evaluator/state — Stage A ABIERTA / COLLECTING

Archivos críticos:

- `src/investment/decision/phase6ForwardRiskContextStageAProtocol.ts`;
- `src/investment/decision/phase6ForwardRiskContextStageAEvaluator.ts`;
- `scripts/phase6ForwardRiskContextStageAProspectiveProtocol.ts`;
- `scripts/phase6ForwardRiskContextStageAStateStore.ts`;
- `scripts/phase6ForwardRiskContextStageACollectorLive.ts`.

Persistencia durable prevista:

`replay-results/validation-runs/phase6-forward-risk-context-stage-a-state.json`.

Semántica pre-open:

- el estado durable `OPENED_COLLECTING` debe escribirse **antes de la primera llamada de mercado**;
- si luego falla un proveedor, la muestra ya consta correctamente como abierta/consumida;
- observaciones encadenadas por SHA-256;
- copia `.runtime` no autoritativa;
- collector no importa el evaluator de outcomes y reporta `outcomeAccessed:false`;
- evaluator está separado y no tiene autoridad productiva;
- el mismo job de Fase 6 exige `GITHUB_REPLAY_SYNC_TOKEN` y ejecuta todos los guards + TypeScript antes del collector.

## 6.5 Seal pre-open y activación

Seal:

`validation-runs/preregistration/phase6-forward-risk-context-stage-a-seal.json`.

Guard:

`tests/phase6ForwardRiskContextStageASeal.unit.ts`.

El seal fija 20 archivos críticos por Git blob SHA-1 y registra:

- `sampleOpened=false`;
- `marketOutcomesOpened=false`;
- producción `LEGACY`;
- no policy económica;
- sample/gates/continuity exactos;
- reseal técnico pre-open del fix TypeScript sin cambio metodológico;
- activación pre-open del collector sólo después del readiness estático PASS.

El guard verifica además:

- fingerprints;
- durable OPENED marker antes de mercado;
- causal cutoff por `informationDate`;
- collector sin acceso a outcomes;
- `currentOpenDiscovery=false`;
- hash chain / inmutabilidad;
- evaluator puro;
- collector cableado sólo detrás de token durable, guards y TypeScript;
- collector posterior al paso TypeScript;
- ningún evaluator de outcomes conectado al job live.

## 6.6 Estado exacto ahora

**Stage A V1: CONSUMED / INVALID FOR PROMOTION DUE TECHNICAL SIGNAL-MATERIALIZATION FAILURE / OUTCOMES NOT OPENED.**

V1 durable se conserva intacta:

- `openedAt = 2026-09-17T16:52:49.017Z`;
- 20 observaciones correspondientes a 2026-09-16 y 2026-09-17;
- las 20 quedaron con `contextStatus=UNAVAILABLE` por incompatibilidad entre el corte del collector y la necesidad de V5/V7/V4 de una sesión sucesora para materializar `executionDate`;
- no se reescriben ni se borran;
- no se han leído outcomes de 63 sesiones;
- V1 no puede promover nada.

### Stage A R2 — preregistro fresh congelado

R2 se congeló el 2026-09-20 y fue abierta de forma durable el mismo día, antes de cualquier observación elegible:

- versión: `PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_R2_V1`;
- inicio fresh: `2026-09-21`;
- fin: `2027-03-31`;
- mismos 10 activos que V1;
- mismo `FORWARD_RISK_CONTEXT_V1`;
- mismo threshold alto `80`;
- ambas ramas V5/V7 obligatorias;
- mismo outcome `NEXT_OPEN` + max drawdown a 63 sesiones + umbral 5%;
- mismos reach gates y predictive gates;
- producción `LEGACY`;
- sin policy económica.

La única corrección técnica congelada es:

`REAL_SUCCESSOR_SESSION_MAY_BE_PRESENT_ONLY_TO_MATERIALIZE_EXECUTION_DATE`.

Semántica exacta:

- la sesión sucesora REAL sólo permite que las implementaciones históricas sin modificar de V5/V7/V4 emitan el punto de la `informationDate` previa y su `executionDate`;
- macro, opciones y diagnóstico se cortan en `informationDate`;
- el `PortfolioCandidateGate` se calcula con prefix terminado en `informationDate`;
- la sesión sucesora no puede modificar componentes, score, eligibility, ranking, sizing ni outcome;
- si V5 o V7 no materializan el punto exacto, R2 falla cerrado y no registra una observación degradada silenciosamente;
- no hay fallback sintético.

Archivos nuevos R2:

- `src/investment/decision/phase6ForwardRiskContextStageAR2Protocol.ts`;
- `scripts/phase6ForwardRiskContextStageAR2ProspectiveProtocol.ts`;
- `scripts/phase6ForwardRiskContextStageAR2StateStore.ts`;
- `scripts/phase6ForwardRiskContextStageAR2CollectorLive.ts`;
- `tests/phase6ForwardRiskContextStageAR2.unit.ts`.

Tras PASS completo de seal/readiness, el collector R2 quedó **activado detrás de token durable, guards y TypeScript**, sin modificar ninguno de los 18 archivos metodológicos sellados. El readiness post-seal se ajustó para validar precisamente ese estado activado; el fallo `R2_COLLECTOR_WIRED_BEFORE_SEAL` fue un falso negativo del guard antiguo y ocurrió antes de cualquier acceso de mercado. El job vigente es ahora:

`Fase 6 · Forward Risk V8 como contexto · R2 collector`

y exige `GITHUB_REPLAY_SYNC_TOKEN`. El orden es: seal R2 -> readiness R2 -> arquitectura -> CandidateGate -> paridad -> superficie -> TypeScript -> collector REAL R2. El collector persiste `OPENED_COLLECTING` antes del primer acceso a mercado y no conecta el evaluator de outcomes.

### Seal pre-open R2

Seal:

`validation-runs/preregistration/phase6-forward-risk-context-stage-a-r2-seal.json`

Guard:

`tests/phase6ForwardRiskContextStageAR2Seal.unit.ts`

El seal fija 18 archivos críticos por Git blob SHA-1, incluidos protocolo R2, V4/V5/V7, loaders de macro/opciones, scanner/gate y runner/state R2. Registra explícitamente:

Corrección pre-open registrada el 2026-09-20: el primer JSON del seal omitió dos campos descriptivos ya congelados de `predictiveGate` (`primaryComparison` y `thresholdsDerivedFromOpenedStageAOutcomes`). Se corrigió únicamente la serialización del seal antes de abrir R2; no cambió ninguna regla, threshold, muestra ni outcome.

- `sampleOpened=false`;
- `marketOutcomesOpened=false`;
- producción `LEGACY`;
- no policy económica;
- V1 preservada/consumida;
- ventana R2 2026-09-21 -> 2027-03-31;
- mismos activos, threshold, outcome, reach y predictive gates;
- regla exacta de successor-session materialization.

El guard verifica además que V5/V7/V4 mantienen la semántica histórica de `executionDate`, que macro/opciones/gate siguen cortados en `informationDate`, que V5/V7 deben materializar el punto exacto y, tras la activación pre-open, que el collector R2 está cableado únicamente detrás de token durable, guards y TypeScript, sin evaluator de outcomes.

### Apertura durable R2

Primera ejecución live completada:

- `sampleState = OPENED_COLLECTING`;
- `openedAt = 2026-09-20T19:22:33.001Z`;
- `predictionStartDate = 2026-09-21`;
- `observationCount = 0`;
- `lastInformationDate = null`;
- `outcomeAccessed = false`;
- estado autoritativo: `replay-results/validation-runs/phase6-forward-risk-context-stage-a-r2-state.json`;
- hash durable reportado: `0498c03db70a177c62f1209cad22246d32a2c0d6698f50513d3004780187429b`.

La salida `NO_MATURE_INFORMATION_SESSION_TO_COLLECT` es esperada: R2 comienza el 2026-09-21 y necesita una sesión sucesora REAL cerrada para materializar el punto de `informationDate`. La apertura consume R2 para este estudio, pero todavía no existe ninguna observación ni outcome.

### Siguiente paso exacto

1. no modificar muestra, activos, V8, threshold, outcome, reach ni predictive gates;
2. no ejecutar evaluator de outcomes durante collection;
3. volver a ejecutar `Fase 6 · Forward Risk V8 como contexto · R2 collector` únicamente cuando exista al menos una sesión sucesora cerrada posterior al 2026-09-21;
4. en la primera colección efectiva verificar que V5 y V7 estén ambos materializados para la fecha y que `contextStatus` no quede `UNAVAILABLE` por el fallo técnico V1;
5. confirmar persistencia durable y hash-chain en replay-results;
6. producción permanece `LEGACY`.


---

# 7. QUALITY FUTURE FORWARD

`QUALITY_ALLOCATION_BRIDGE_V1` continúa research-only. La evidencia prospectiva dinámica sigue su calendario propio y no autoriza cambio productivo hasta completar el protocolo correspondiente.

No usar esta vía para modificar Fase 6 ni viceversa.

---

# 8. FASE 8 — UNIVERSO HISTÓRICO POINT-IN-TIME

## 8.1 Arquitectura implementada

Se integró `HISTORICAL_INSTRUMENT_MASTER_V1` en:

- `src/investment/decision/historicalInstrumentMaster.ts`;
- `src/investment/decision/causalUniverseBacktestEngine.ts`.

No existe un motor paralelo. El master actúa como capa opcional de elegibilidad histórica dentro del replay causal existente.

Contrato por identidad económica:

- identidad canónica;
- ISIN;
- listing date;
- delisting date;
- alias ticker/venue con intervalo de vigencia;
- autoridad/fuente;
- `evidenceAsOfDate`;
- `pointInTimeVerified`;
- procedencia `STATIC_REFERENCE`.

Cobertura declarada:

- `CURRENT_REFERENCE_ONLY`;
- `PARTIAL_POINT_IN_TIME`;
- `COMPLETE_POINT_IN_TIME`.

Sólo `COMPLETE_POINT_IN_TIME` permite afirmar cobertura completa del universo objetivo histórico.

## 8.2 Guard anti-survivorship

El catálogo actual `EUR_ASSET_UNIVERSE` puede convertirse a referencia deduplicada por identidad económica, pero queda obligatoriamente:

`CURRENT_REFERENCE_ONLY`

y no puede autorizar selección histórica PIT.

La primera barra disponible tampoco se acepta como prueba de listing date.

Estados por fecha:

- `TRADABLE_VERIFIED`;
- `NOT_YET_LISTED`;
- `DELISTED`;
- `AFTER_EVIDENCE_HORIZON`;
- `NO_ACTIVE_ALIAS`;
- `UNVERIFIED_POINT_IN_TIME`;
- `IDENTITY_NOT_FOUND`.

El replay causal, cuando recibe master PIT explícito:

- rechaza `CURRENT_REFERENCE_ONLY`;
- con `PARTIAL_POINT_IN_TIME` usa sólo identidades verificadas y mantiene la limitación de cobertura;
- con `COMPLETE_POINT_IN_TIME` puede etiquetar el universo objetivo como PIT completo;
- sin master mantiene el comportamiento histórico previo y el warning de survivorship.

## 8.3 Validación estructural

Guard:

`tests/historicalInstrumentMaster.unit.ts`

Job:

`Fase 8 · universo histórico PIT · cierre estructural`

Comprueba contrato, dedupe ISIN, ticker changes, listing/delisting, horizonte de evidencia, bloqueo del catálogo current y la integración en el replay causal. Después de guards + TypeScript ejecuta un inventario live ligero de EODHD para los mercados EUR primarios, consultando listas activas y `delisted=1`. No lanza replay largo y ese inventario no se promociona automáticamente a PIT.

Documento:

`docs/PHASE8_HISTORICAL_INSTRUMENT_MASTER_V1.md`.

## 8.4 Estado real pendiente

**Cierre estructural PASS reportado el 2026-09-20. El master histórico exhaustivo todavía no está poblado.**

La ejecución confirmó:

- `PHASE8_HISTORICAL_INSTRUMENT_MASTER_PASS`;
- arquitectura core PASS;
- paridad replay/producto PASS;
- TypeScript PASS;
- catálogo current: 38 assets / 36 identidades económicas deduplicadas;
- 0 identidades current autorizadas como PIT;
- integración del master en el replay causal activa;
- master COMPLETE obligado a cubrir catálogo + dataset de cada fecha.

El inventario live EODHD no llegó a ejecutarse por límite diario del proveedor (`HTTP 402 / daily API requests limit`). Esto no invalida el cierre estructural: es una indisponibilidad temporal de la fuente, no un fallo del contrato PIT ni del replay.

El job de Fase 8 queda archivado para evitar repeticiones inútiles. La población REAL del master pasa a deuda de datos, no a bloqueo de arquitectura.

El script live ahora trata específicamente ese 402 como `SOURCE_DAILY_LIMIT_EXCEEDED`, devuelve resultado informativo y no bloquea el cierre estructural. No promociona ningún master ni inventa cobertura.

Falta incorporar una fuente histórica suficientemente completa que aporte altas, bajas/delistings y cambios de ticker/mercado. Hasta entonces:

- no afirmar que el replay histórico reproduce el mercado completo de cada fecha;
- current Yahoo discovery no puede usarse retrospectivamente;
- survivorship permanece limitación explícita;
- no inventar listing dates a partir de precios.

Fuente operativa seleccionada para el siguiente incremento: EODHD, reutilizando `EODHD_API_KEY` ya soportada por el backend. La Exchange Symbols API aporta activos activos/delistados e ISIN cuando existe; Fundamentals aporta `IPODate`/estado y fecha de delisting para acciones e `Inception_Date` para ETF/fondos. Debido a que el historial de cambios de ticker no es exhaustivo para todos los mercados europeos, EODHD puede poblar `PARTIAL_POINT_IN_TIME` de forma rigurosa, pero no se declarará `COMPLETE_POINT_IN_TIME` sin cobertura adicional verificada.


---

# 9. FASE 9 — AUDITORÍA END-TO-END / PRE-CIERRE V1

Estado: **CLOSED · TECHNICAL_V1_PRECLOSE_PASS**.

La ejecución consolidada del 2026-09-20 pasó completa y el job quedó archivado/read-only. No debe relanzarse salvo bug o regresión reproducible.

Resultado final:

`PHASE9_END_TO_END_PRECLOSE_RESULT`

con:

- `status = TECHNICAL_V1_PRECLOSE_PASS`;
- producción `LEGACY`;
- `CORE_ARCHITECTURE_V1`;
- sin motores productivos paralelos;
- sin replay largo;
- sin APIs externas;
- TypeScript PASS.

Incluye:

- arquitectura `CORE_ARCHITECTURE_V1`;
- `PortfolioCandidateGate`;
- paridad replay/producto;
- superficie productiva única;
- usuarios/seguridad;
- plan ejecutable;
- cartera y salud de posiciones;
- broker;
- fiscalidad de ejecución;
- modos de cartera inicial del replay;
- replay causal;
- externalCashFlows;
- cash BCE + fiscalidad del cash;
- instrument master PIT estructural;
- runtime del Centro de validación;
- TypeScript;
- resumen de cierre.

Primera ejecución F9 del 2026-09-20: todos los guards funcionales, replay, cash, fiscalidad y PIT pasaron hasta `Guard runtime validación`. Ese único fallo fue un falso negativo del test legado `researchValidationRuntime.unit.ts`, que todavía buscaba el antiguo job `forward-risk-v6`. Se actualizó el guard a los jobs vigentes F6 R2/F7/F9 y se movió al primer paso del job para fail-fast.

El pre-cierre técnico no finge que F6/F7/F8 hayan madurado. Tras el PASS quedan únicamente tres carriles externos/calendario:

1. F6 R2 future-forward;
2. F7 QUALITY future-forward;
3. población REAL del master PIT de F8.

Ninguno de esos tres justifica seguir retocando código cada pocos minutos. Fase 9 queda cerrada y fuera de la superficie CURRENT del Centro de validación.

---

# 10. DEFERRED / RETIRED

No reabrir ahora:

- Fase 2 salvo bug reproducible;
- Fase 4 R2/R3 como muestras fresh;
- Fase 5 blind y confirmación como muestras fresh;
- `TREND_PROTECTION_V2_WINNER_ONLY` para retuning;
- V9/V10/V11;
- V12/V13 como tuning retrospectivo;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY bridge sobre ventanas consumidas;
- HFG para promoción;
- replays/motores productivos paralelos;
- reconstrucción histórica con current discovery;
- nueva policy económica Fase 6 diseñada y validada con la misma muestra Stage A.

---

# 12. OPPORTUNITY ALPHA RESEARCH — DIAGNÓSTICO 2026-09-24

Documento canónico:

- `docs/OPPORTUNITY_ALPHA_RESEARCH_2026-09-24.md`.

Resultado retenido del replay mixto 2021-01-04 -> 2024-01-03:

- motor: 27.886,51 EUR / +21,25% / max DD 25,81%;
- exact hold: 26.712,01 EUR / +16,14%;
- structural core: 31.585,57 EUR / +37,33% / max DD 16,90%;
- la lógica de salida mejoró frente a mantener la cesta mala, pero no batió al core.

Contrafactuales realizados **sin modificar producción**:

1. `EXIT/REDUCE -> mejor oportunidad válida inmediata`: 15 episodios evaluables, 9/15 batieron al core a ~6 meses, pero sólo ~+38,5 EUR de exceso ponderado sobre ~7.515 EUR desviados (~+0,51%) antes de costes/fiscalidad. **ARCHIVED / NO IMPLEMENTATION**.
2. reentrada simple del mismo activo cuando vuelve a `ENTRY_READY`: resultados mixtos y no robustos. **ARCHIVED / NO IMPLEMENTATION**.
3. filtro retrospectivo por régimen: aparente mejora en muestra consumida pero contradicha por replay independiente. **ARCHIVED / NO IMPLEMENTATION**.

Conclusión obligatoria:

> El siguiente problema no es liberar más capital del core. Es identificar causalmente qué oportunidad tiene una probabilidad razonable de **batir al structural core**, no sólo de superar cash o mostrar momentum absoluto.

Nueva línea research-only, todavía **sin implementación**:

- `CORE_RELATIVE_LEADERSHIP_RESEARCH_V1`: relative strength/momentum frente al core + calidad de tendencia + proximidad a máximos + fundamentales causales cuando existan;
- `OWNERSHIP_CONFIRMATION_RESEARCH_V1`: sponsorship institucional/insider como contexto, usando filings oficiales y sus timestamps causales.

Familias de referencia a estudiar y traducir a features cuantificables:

- William O'Neil / CAN SLIM;
- Mark Minervini / SEPA, Trend Template, VCP;
- Stan Weinstein / Stage Analysis;
- momentum/trend following académico.

Smart-money / ownership:

- 13F: sólo contexto lento; trimestral y con hasta 45 días de retraso;
- Form 4: insider transactions generalmente dentro de 2 business days;
- EU MAR/PDMR: transacciones notificadas normalmente dentro de 3 working days;
- agregadores sólo como discovery/conveniencia; fuente canónica preferida = filing oficial.

No tocar `LEGACY`, allocator ni core hasta que una feature/policy nueva tenga evidencia fresh/blind y confirmación independiente.

Actualización 2026-09-25 — `CORE_RELATIVE_LEADERSHIP_RESEARCH_V1` simple:

- 15 episodios evaluables de routing con outcome a ~6 meses contra structural core;
- slopes 20d/60d positivos: media -3,11 pp vs core, mediana -3,76 pp, 37,5% winners;
- `ENTRY_STRONG` + slopes 20d/60d positivos: media -4,50 pp, 25% winners;
- slopes 20d/60d + aceleración positiva: media +1,53 pp vs baseline del conjunto +1,43 pp; mejora sólo ~+0,10 pp y mantiene un caso ≈ -20,92 pp;
- cross-check 2019-2020 / 2024-2025 no aporta evidencia suficiente por tamaño pequeño e inconsistencia con los episodios de rotación;
- **ARCHIVED / NO IMPLEMENTATION**. No retunear medias/slopes sobre estas observaciones consumidas.

Siguiente línea materialmente distinta: fundamentales causales y/o ownership/insider timestamped como señal ortogonal, siempre offline primero.

Actualización 2026-09-25 — ownership/fundamentals offline:

- insider buying como gate duro: **ARCHIVED / NO IMPLEMENTATION**. Form 4 de NVIDIA/AMD/Tesla muestra que grandes ganadores pueden no tener compra discrecional abierta, mientras Carvana tuvo compras `P` importantes durante su desplome de 2022; útil como contexto, no como autorización directa;
- `FUNDAMENTAL_PROFITABILITY_GUARD`: **PROMISING_DIAGNOSTIC / NO IMPLEMENTATION YET**;
- en la cesta consumida 2021-2024, Carvana + Delivery Hero + Siemens Energy eran claramente deficitarias operacionalmente al inicio y las tres posiciones sumaron aprox. -550,5 EUR netos;
- las otras siete acciones con rentabilidad operativa positiva sumaron aprox. +1.438,6 EUR netos;
- contrafactual simple de mandar esos 3.000 EUR excluidos al structural core: mejora terminal aproximada +1.670 EUR y retorno aproximado ~+28,5% vs +21,25% baseline, todavía por debajo del core puro +37,33%;
- no usar crecimiento de ventas como gate adicional: excluiría Rheinmetall y retendría varios perdedores;
- la hipótesis útil es `profitability as tail-risk guard`, no `profitability as winner ranking`;
- siguiente paso: ampliar muestra y contrastar contra core antes de congelar cualquier research-only guard.

Actualización 2026-09-26 — validación externa fija:

- muestra: Top 20 performers Nasdaq-100 2020 publicada por Nasdaq; 17/20 con par exacto de precios 2021-05-03 -> 2022-05-03 disponible en la fuente usada;
- regla sin tuning: último FY publicado con operating income > 0;
- 13 rentables: retorno medio -11,27%, exceso medio vs QQQ -6,11 pp, 46,2% batieron QQQ;
- 4 no rentables: retorno medio -31,69%, exceso medio vs QQQ -26,52 pp, 25% batieron QQQ;
- filtro mejora la media equal-weight de -16,08% a -11,27% (~+4,80 pp), pero QQQ hizo aprox. -5,17%;
- conclusión: confirma valor como **guard de calidad/tail-risk**, pero no crea alpha suficiente frente al core;
- estado: `PROMISING QUALITY GUARD / NO IMPLEMENTATION YET`; siguiente investigación debe discriminar entre compañías ya rentables con una señal ortogonal y mantener el core como hurdle.

Actualización 2026-09-26 — nueva familia de alpha fundamental:

- se confirma que el antiguo `QUALITY_V1` del proyecto (reliability/opportunity) **no es** calidad corporativa;
- MSCI World Quality usa ROE alto + D/E bajo + baja variabilidad de beneficios;
- evidencia externa: ~12,02% anualizado desde 1994 vs ~9,01% MSCI World; 10y 14,74% vs 13,29%; Sharpe 10y 0,83 vs 0,76; max DD 48,01% vs 57,46%;
- en años completos post-lanzamiento 2014-2025: ~13,11% CAGR vs ~10,97% World;
- una mezcla 50/50 Quality+Momentum sobre retornos anuales publicados 2014-2025 da ~13,03% CAGR vs ~10,97% World, pero no domina todos los subperiodos;
- un QVM genérico no garantiza alpha: S&P 500 QVM Top-90% sólo supera ligeramente al S&P 500 en 10y (13,65% vs 13,48% price CAGR);
- nueva hipótesis retained: `FUNDAMENTAL_QUALITY_SCORE_RESEARCH_V1` = **PROMISING EXTERNAL ALPHA FAMILY / NOT YET PROJECT-VALIDATED**;
- traducción prevista offline: profitability guard + ranking causal por ROE/D-E/earnings variability; momentum sólo como timing; core siempre hurdle;
- sin implementación productiva ni retuning sobre la muestra 2021-2024.


Actualización 2026-09-26 — validación amplia live de fundamental Quality:

- se contrastó externamente la misma familia MSCI de tres descriptores (ROE alto, apalancamiento bajo y baja variabilidad de beneficios) usando sólo años completos posteriores al lanzamiento de cada índice, evitando tratar backtests pre-lanzamiento como evidencia live;
- MSCI USA Quality 2013-2025: CAGR ~16,17% vs ~14,85% parent, ventaja ~+1,31 pp/año, 8/13 años por encima;
- MSCI World Quality 2013-2025: ~14,17% vs ~12,16%, ventaja ~+2,02 pp/año, 9/13;
- MSCI Europe Quality 2013-2025: ~8,62% vs ~8,23%, ventaja pequeña ~+0,39 pp/año, 7/13;
- MSCI World ex USA Quality 2015-2025: ~7,62% vs ~7,44%, ventaja pequeña ~+0,18 pp/año, 7/11;
- MSCI USA Sector Neutral Quality 2015-2025: ~12,97% vs ~13,50%, **underperformance ~-0,52 pp/año**, 5/11;
- subperiodo 2021-2024 no uniforme: USA/World positivos frente a parent, Europa/ex-USA negativos y USA sector-neutral prácticamente plano;
- AQR QMJ aporta corroboración independiente de la familia Quality, pero no se toma como validación exacta porque usa una definición más amplia (profitability/growth/safety/payout);
- conclusión: el hallazgo pequeño previo no parece una anomalía aislada, pero **Quality no genera alpha universalmente** y parte de la ventaja broad-index puede depender de exposiciones sectoriales/concentración; no se puede afirmar todavía alpha puro de ranking dentro de sector;
- estado de `FUNDAMENTAL_QUALITY_SCORE_RESEARCH_V1`: **BROAD EXTERNAL VALIDATION SUPPORTS QUALITY FAMILY / PROJECT-SPECIFIC CAUSAL VALIDATION STILL REQUIRED / NO PRODUCTION AUTHORITY**;
- no cambiar pesos ni thresholds; producción continúa `LEGACY`; siguiente requisito es validación causal del score congelado dentro de la población de oportunidades del proyecto contra structural core.

Actualización 2026-09-27 — interacción fundamental Quality × valoración recuperada y preservada:

- se reconstruyó el diagnóstico `VALUATION_AWARE_QUALITY` que había quedado sólo en chat;
- muestra fija principal: 13 líderes Nasdaq-100 2020 con operating profitability positiva; corte causal 2021-05-03 y outcome 2022-05-03; QQQ ~-4,71%;
- Quality congelado: ROE alto + D/E bajo + EVAR bajo, z-scores equiponderados; tratamiento de EVAR faltante según regla MSCI contemporánea;
- dentro de `HIGH_QUALITY`, valoración = earnings yield histórico y split determinista por mediana del propio subgrupo;
- high Quality + cheap/reasonable: PYPL, CDNS, SNPS, AAPL; retorno medio -1,67%, exceso medio **+3,04 pp** vs QQQ, exceso mediano **+23,35 pp**, 3/4 winners;
- high Quality + expensive: ZM, ALGN, IDXX; retorno medio -45,85%, exceso medio **-41,14 pp**, 0/3 winners;
- control negativo: valoración sola no explica el resultado; existen lower-quality expensive winners como TSLA/NVDA, por lo que la hipótesis retained es la **interacción Quality × valuation**, no `cheap stocks` en general;
- cross-check independiente por mayores pesos Nasdaq-100 a 2020-12-14: high Quality cheap/reasonable AAPL/META/GOOGL => exceso medio +0,35 pp, 2/3 winners; high Quality expensive PYPL/ADBE => -37,31 pp, 0/2;
- interpretación: se reproduce con otra selección la penalización de `expensive Quality`, pero todavía no se demuestra alpha robusto de `cheap Quality`;
- estado: `VALUATION_AWARE_QUALITY = PROMISING_DIAGNOSTIC_INTERACTION / BROAD PIT STOCK-LEVEL CONFIRMATION REQUIRED / NO PRODUCTION AUTHORITY`;
- no cambiar pesos ni thresholds; producción continúa `LEGACY`.

Regla nueva de continuidad de investigación:

- todo hallazgo que abra una hipótesis materialmente prometedora debe registrarse en `PROJECT_STATE.md` y/o documento research **antes de pasar al test siguiente**;
- el registro mínimo incluye definición, fecha causal, muestra, grupos reconstruibles, resultado vs core, estado consumed/fresh y siguiente prueba;
- un resultado prometedor incompleto se etiqueta `PROMISING_DIAGNOSTIC_UNCONFIRMED`; no debe quedar únicamente en el chat.


Actualización 2026-09-27 — confirmación amplia PIT de Quality × valoración preparada y sellada:

- se integró el job research-only `Fundamental Quality × valoración · validación PIT amplia` (`fundamental-quality-valuation-broad-pit-v1`) dentro de `ResearchValidationCenter`;
- versión: `FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1`;
- seal pre-run: `validation-runs/preregistration/fundamental-quality-valuation-broad-pit-v1-seal.json`;
- el seal fija por Git blob SHA el protocolo, runner y guard; cualquier modificación de esos archivos invalida la ejecución antes de consultar datos;
- muestra: miembros históricos del S&P 500 existentes a 2021-05-03, obtenidos mediante componentes históricos EODHD; no usa Yahoo current discovery para reconstruir el universo;
- fundamentales: SEC EDGAR `companyfacts`, aceptando exclusivamente hechos con `filed <= 2021-05-03`; no se aceptan reexpresiones conocidas después del corte;
- guard previo: operating income anual causal > 0;
- Quality congelado: ROE alto + D/E bajo + EVAR bajo; winsor 5/95, z-score cross-sectional, pesos iguales, cinco ejercicios de EPS -> cuatro crecimientos YoY; ROE obligatorio y regla de missing equivalente a la metodología MSCI usada en la reconstrucción;
- la implementación SEC es una traducción independiente del mismo concepto económico, no una reproducción byte-a-byte del proveedor Wolfram del diagnóstico pequeño;
- high Quality = score >= mediana cross-sectional entre compañías rentables/evaluables;
- valoración congelada = earnings yield anual causal SEC, calculado como beneficio anual / (precio raw en informationDate × acciones causales en circulación); dentro de high Quality se divide por la mediana del earnings yield;
- outcomes: Yahoo REAL ajustado 2021-05-03 -> 2022-05-03;
- benchmarks congelados antes de abrir outcomes: SPY como parent USA y URTH/MSCI World USD como proxy adicional del structural global core;
- gates de cobertura preregistrados: >=400 miembros históricos, >=350 CIK mapeados, >=250 rentables/evaluables, >=100 high Quality y >=40 observaciones por rama de valoración;
- verdict direccional sólo confirma la interacción si cheap/reasonable supera expensive y además cheap/reasonable tiene exceso medio positivo frente a SPY y URTH mientras expensive queda negativo frente a ambos;
- el resultado, sea positivo o negativo, se persistirá en `replay-results`; no autoriza promoción productiva y no puede utilizarse para retunear sobre la misma muestra;
- producción permanece `LEGACY`.

Estado operativo del job a 2026-09-27:

- **SEALED / GUARDS + FULL TYPESCRIPT PASS / LIVE ATTEMPT BLOCKED BEFORE DATA** (auditoría posterior del 2026-09-27; detalle al final de esta sección);
- este chat no ha abierto todavía la población S&P 500 ni sus outcomes mediante el nuevo runner;
- el módulo matemático aislado del protocolo fue compilado con TypeScript 5.8.3 sin errores;
- no fue posible ejecutar el `tsc --noEmit` del HEAD completo desde el entorno de ChatGPT porque su contenedor no puede resolver GitHub; por diseño, el job local ejecuta guards + `npm run lint` antes de cualquier cálculo largo;
- prerequisitos fail-closed: `GITHUB_REPLAY_SYNC_TOKEN`, `EODHD_API_KEY` y `SEC_EDGAR_USER_AGENT`;
- la SEC no requiere API key para `companyfacts`, pero exige User-Agent declarado para acceso automatizado; el runner limita SEC a <=8 req/s;
- siguiente acción: disponer de los tres prerequisitos en el runtime de ejecución del runner; no trasladar al usuario la ejecución manual del Centro de validación. No modificar fórmula ni thresholds.


Actualización 2026-09-27 — Quality × valoración, broad external R1 cerrado y R2 sellado:

**Calificación posterior de auditoría:** R1 externo conserva un FAIL reportado, pero no acredita PIT estricto con la evidencia guardada. R2 ya contiene outcomes parciales en main y no está unopened. Prevalece la actualización de auditoría que sigue.

- R1 externo amplio completado sobre población histórica S&P 500 mayo-2021;
- 506 miembros históricos -> 379 profitable/evaluable -> 190 high Quality -> 185 con outcome usable;
- high Quality + cheap/reasonable: mean +0,47%, median +4,01%, mean excess vs SPY -0,41 pp, vs URTH +3,63 pp, beat SPY 54,8%;
- high Quality + expensive: mean -2,71%, median -5,41%, mean excess vs SPY -3,59 pp, vs URTH +0,45 pp, beat SPY 39,1%;
- interacción media cheap - expensive: **+3,18 pp**;
- full alpha gate **FAIL** porque cheap/reasonable no bate SPY en retorno medio;
- control de cuartiles preregistrado: el cuartil más caro fue claramente peor, mean -7,61%, -8,49 pp vs SPY y -4,45 pp vs URTH;
- lectura retained: `PARTIAL_SUPPORT_EXPENSIVE_QUALITY_PENALTY`; posible guard de valoración extrema, no motor de alpha validado;
- muestra 2021-2022 queda consumed; prohibido retunear threshold/peso sobre ella;
- evidencia durable: `validation-runs/diagnostics/fundamental-quality-valuation-external-2021-result.json` + 4 chunks raw;
- R2 temporal independiente sellado ANTES de outcomes en `validation-runs/preregistration/fundamental-quality-valuation-external-r2-seal.json`;
- R2: 2022-05-03 -> 2023-05-03, población histórica S&P 500 mayo-2022, FY2021, misma Quality y mismo split mediana;
- diagnóstico secundario R2 congelado: confirmar o rechazar la penalización del cuartil más caro;
- producción continúa `LEGACY`; ninguna integración productiva autorizada todavía.

Actualización 2026-09-27 — auditoría de cierre PIT y ejecución directa:

- HEAD auditado: `6075b5eb43fe909d1fdf68945262829fd6e2e8da`;
- estado vigente: **STRICT_PIT_VALIDATION_INCOMPLETE / EXTERNAL_R1_REPORTED_FAIL / NO_PROMOTION**;
- el sello y sus tres archivos permanecen intactos; no se ha cambiado producción, fórmula, pesos, thresholds, fechas ni fuentes del protocolo;
- ejecutados y PASS: guard Quality × valoración/sello, core architecture, historical instrument master, validation runtime y `npm run lint` (`tsc --noEmit`) del HEAD completo;
- runner live sin modificar ejecutado después de esos gates: fallo explícito `FUNDAMENTAL_QUALITY_VALUATION_EODHD_API_KEY_REQUIRED` antes de datos; tampoco están disponibles `SEC_EDGAR_USER_AGENT` ni `GITHUB_REPLAY_SYNC_TOKEN` en este runtime;
- instalación local de dependencias sin cambiar package.json/lockfile; guards ejecutados mediante `node --import tsx` por restricción del socket IPC del CLI tsx;
- no hay resultado recuperable de esta investigación en la rama `replay-results` inspeccionada;
- cobertura **reportada** externa: 506 miembros -> 379 evaluables -> 190 HIGH_QUALITY; cobertura **recomputada**: 190 tickers únicos, 185 pares de precios positivos, 5 ausentes (APTV, BLK, INFO, KSU, LH), cero duplicados;
- no están preservados los fundamentales por empresa, fechas de publicación/revisión, scores, earnings yields ni etiquetas de rama; no se pueden reconstruir independientemente los grupos o acreditar `filed <= informationDate`;
- FY2020 por sí solo no prueba causalidad; la traducción externa SimFin + EPS diluido/precio no equivale al runner congelado SEC + beneficio/(precio × acciones causales);
- resúmenes reportados: cheap N=93, media +0,4727960314%, mediana +4,0132845904%, exceso medio SPY -0,4110522769 pp / URTH +3,6314514434 pp; expensive N=92, media -2,7078741275%, mediana -5,4091725465%, exceso medio SPY -3,5917224358 pp / URTH +0,4507812845 pp;
- FAIL completo por **dos** condiciones: cheap no bate SPY y expensive no queda negativo contra URTH. Diferencia condicional cheap-expensive +3,1806701589 pp no demuestra interacción incremental ni alpha ajustado por riesgo;
- pooled 185 precios recomputados: media -1,1089426422%, mediana -0,7375249299%, desviación típica 21,1655058673 pp, percentil 10 -26,7683072004%, peor -64,9889998199%, 94/185 negativos. No equivalen a volatilidad temporal ni drawdown;
- controles QUALITY sola, value solo e interacción incremental: **NO IDENTIFICABLES** por falta del panel lower-quality; dispersión por rama y drawdown: **N/D** por falta de etiquetas/series. El runner sellado sólo recoge valoración/outcomes HIGH_QUALITY y no cubre por sí mismo esos controles;
- R2: tres chunks ya comprometidos contienen 150 filas de las 198 declaradas; estado corregido **PARTIALLY_OPENED / CONSUMED_FOR_BLIND_CLAIMS / INCOMPLETE_EVIDENCE**. No se han pedido más outcomes ni calculado retornos R2 en esta auditoría;
- R1 sigue consumida; una reconstrucción futura no será fresh. No nuevo holdout ni V2 escogidos sobre estos resultados;
- evidencia reproducible: `scripts/auditFundamentalQualityValuationEvidence.py` y `validation-runs/diagnostics/fundamental-quality-valuation-evidence-audit-2026-09-27.json`;
- detalle, tabla completa de medianas/excesos/hit-rates y límites en §20 de `docs/OPPORTUNITY_ALPHA_RESEARCH_2026-09-24.md`;
- pendiente concreto: habilitar de forma segura los prerequisitos del runner o recuperar un paquete auténtico completo ya ejecutado; preservar entradas PIT/etiquetas antes de outcomes y completar controles lower-quality explícitamente diagnósticos, sin modificar el protocolo primario;
- no presentar el trabajo como validación PIT terminada ni afirmar que ya se mejora al core. Producción sigue `LEGACY`.

---

Actualización 2026-09-27 — plan de implementación de momentum relativo, con presupuesto de tokens limitado:

- plan canónico: `docs/CORE_OUTPERFORMANCE_RESEARCH_PLAN_2026-09-27.md`; **PLAN AUTORIZADO / SIN RESULTADOS / NO PRODUCCIÓN**;
- prioridad única: réplica long-only de momentum meses 2–12, revisión mensual; no equivale a las pendientes 20/60d ya diagnosticadas;
- orden: inventario + registro de muestras + sello -> diagnóstico externo barato -> réplica accionable -> traducción Custodia sólo con ventaja neta previa -> confirmación temporal;
- etapas con parada por bloqueo/FAIL; cálculos deterministas en backend local, sin subagentes, sin Actions, sin búsquedas paramétricas ni polling continuo;
- fechas/universo/costes restantes se congelan antes de outcomes; el plan no es un preregistro de muestra ya ejecutable;
- medir exceso neto frente a core y parent, costes duplicados, drawdown/Sharpe, incertidumbre y reach; no confundir mayor riesgo con alpha;
- otro chat debe implementar y ejecutar este plan directamente sin pedir al usuario lanzar manualmente el Centro de validación;
- Quality × valoración conserva estado y sellos; LEGACY sigue default. No nuevas pruebas numéricas realizadas al escribir este plan.


Actualización 2026-09-27 — CORE_OUTPERFORMANCE_MOMENTUM_REFERENCE_V1 ejecutado y cerrado por gate:

- plan ejecutado: `docs/CORE_OUTPERFORMANCE_RESEARCH_PLAN_2026-09-27.md`;
- familia primaria: long-only winner decile por momentum previo 12-2, revisión mensual, value-weighted; no se probaron variantes posteriores al outcome;
- registro de muestras: `docs/CORE_OUTPERFORMANCE_SAMPLE_REGISTRY_2026-09-27.md`;
- diagnóstico fijado antes de abrir outcomes en conversación: 2016-01 -> 2021-12, 72 meses;
- confirmación reservada: 2009-01 -> 2014-12, con 2015 como separación; **NO ABIERTA**;
- runner reproducible: `scripts/coreOutperformanceMomentumDiagnosticV1.mjs`;
- caché/manifest: `validation-runs/diagnostics/core-outperformance-momentum-v1-input.json`;
- resultado machine-readable: `validation-runs/diagnostics/core-outperformance-momentum-v1-result.json`;
- winner decile momentum: retorno total **+152,33%**, CAGR **16,68%**;
- French/CRSP US market: retorno total **+163,38%**, CAGR **17,52%**;
- URTH proxy global: retorno total **+122,06%**, CAGR **14,22%**;
- SPY cross-check: CAGR **17,55%**;
- exceso CAGR momentum vs parent USA: **-0,84 pp/año**;
- exceso CAGR momentum vs URTH: **+2,46 pp/año**;
- gate Etapa B exigía exceso bruto > 0 frente a ambos benchmarks; resultado **FAIL_DIAGNOSTIC**;
- criterio de parada activado: **STOP_PRIMARY_REPLICA_NO_VARIANTS**;
- no se abre confirmación, no se implementa Etapa C, no se crean lookbacks/deciles/filtros alternativos para rescatar el FAIL;
- producción sigue `LEGACY`; ninguna autoridad productiva.
- caveat de secuencia: las ventanas se declararon aquí antes de calcular outcomes, pero el sello GitHub no llegó a committearse pre-outcome; por tanto no se presenta esta ejecución como validación formal preregistrada. El FAIL económico se conserva como diagnóstico y hace improcedente repetir otra ventana para buscar un PASS.


# 13. CRITERIO DE CIERRE V1

V1 puede cerrarse integralmente cuando estén suficientemente cerrados:

- cadena productiva única;
- usuarios/seguridad/persistencia;
- alertas coherentes con la cadena compartida;
- replay causal;
- cash/flujos/costes/fiscalidad;
- Fases 4–6 bajo evidencia válida;
- QUALITY future-forward cuando madure;
- limitación survivorship explícita / Fase 8 suficientemente resuelta;
- auditoría end-to-end Fase 9.


---

Actualización 2026-09-27 — verificación independiente de CORE_OUTPERFORMANCE_MOMENTUM_REFERENCE_V1:

- se recomputó desde la caché comprometida el resultado de Etapa B y coincide con el JSON durable dentro de precisión numérica;
- momentum winner decile: CAGR 16,679724%; parent USA: 17,516112%; URTH: 14,220895%; exceso vs parent -0,836388 pp/año y vs URTH +2,458829 pp/año;
- el gate conjunto permanece **FAIL_DIAGNOSTIC** y la decisión **STOP_PRIMARY_REPLICA_NO_VARIANTS**;
- la reserva 2009-01 -> 2014-12 continúa **NO ABIERTA**; Etapa C continúa no implementada;
- desde el commit del plan `e905503fd9c95299e4ca3fe0eeefc29f257f76ff` hasta el cierre verificado no se modificó ningún archivo productivo;
- evidencia de verificación: `validation-runs/diagnostics/core-outperformance-momentum-v1-verification-2026-09-27.json`;
- producción permanece `LEGACY` y sin autoridad de promoción.


---

Actualización 2026-09-27 — Operating Profitability: primer candidato con confirmación positiva:

- se preregistró antes de outcomes una cola finita de familias ortogonales; Candidate A = French Operating Profitability `Hi 10`, value-weighted, long-only;
- diagnóstico 2016-01 -> 2021-12: CAGR **20,7995%** vs US parent **17,5161%** y URTH **14,2209%**; excesos **+3,2834 pp/año** y **+6,5786 pp/año** -> **PASS_EXTERNAL_DIAGNOSTIC_CANDIDATE**;
- al pasar A se detuvo la cola: las candidatas B/C no se abrieron;
- confirmación 2009-01 -> 2014-12 fue congelada en Git antes de abrir esos returns: CAGR **18,2365%** vs US parent **17,7167%** y developed global **13,8197%**; excesos **+0,5198 pp/año** y **+4,4168 pp/año** -> **PASS_CONFIRMATION_SIGNAL_ONLY**;
- drawdown mensual descriptivo: diagnóstico -19,47% vs -20,21% parent; confirmación -13,19% vs -17,70% parent. No equivale todavía al guard diario de promoción;
- runner/caché reproducibles: `scripts/coreOutperformanceProfitabilityV1.mjs`, `validation-runs/diagnostics/core-outperformance-profitability-v1-input.json` y `...-result.json`;
- Stage C1 stock-level PIT quedó preregistrada y sellada **antes de stock outcomes**: SEC causal `filed <= signalDate`, operating profitability estricta, top decile, value-weighted, annual June/NEXT_OPEN, SPY+URTH, fail-closed en delistings/missing;
- universo histórico Stage C1 usa reconstrucción estática versionada `chinobing/historical_sp500_constituents@019beba...`; no usa current constituents como universo histórico ni requiere EODHD;
- se corrigieron aliases `BRK.B/BF.B` y se reseñaló el protocolo pre-outcome; no cambió fórmula, muestra, decil, ponderación ni gates;
- preflight Stage C1: **BLOCKED_DATA_ACCESS** únicamente porque falta `SEC_EDGAR_USER_AGENT` en este runtime; **stock outcomes no abiertos** y no hay FAIL económico;
- evidencia: `docs/CORE_OUTPERFORMANCE_PROFITABILITY_V1_EXECUTION_2026-09-27.md`, `docs/CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1_PREREGISTRATION_2026-09-27.md`, seal y preflight machine-readable;
- siguiente paso permitido: ejecutar el Stage C1 sellado sin modificarlo cuando el runtime disponga de User-Agent SEC válido; sólo un PASS abre Stage C2 de costes/fiscalidad/riesgo y después confirmación future-forward;
- producción permanece **LEGACY**; no hay promoción automática.


---

Actualización 2026-09-27 — Profitability future-forward V1 congelado:

- la validación histórica stock-level estricta `CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1` permanece **BLOCKED_DATA_ACCESS** por ausencia de `SEC_EDGAR_USER_AGENT`; no se han abierto CompanyFacts ni outcomes stock-level y este bloqueo no es un FAIL económico;
- como evidencia independiente y causal desde hoy se preregistró antes del cross-section completo `CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1`;
- snapshot congelado 2026-09-27 con universo S&P 500 current de Wolfram: **500 miembros / 500 mapeados / 451 evaluables / 46 seleccionados**;
- proxy congelado: `TotalRevenue × OperatingMargin / StockholdersEquity`, sólo revenue/equity/market-cap positivos; top decile, value-weighted por market cap; sin valuation, momentum, trend, sector filters, Forward Risk ni timing;
- future outcomes: **UNOPENED**; regla de inicio = primera sesión común negociable posterior al 2026-09-27;
- 3m y 6m son checkpoints descriptivos sin autoridad; **12m es el único endpoint primario**, PASS sólo si el basket supera simultáneamente SPY y URTH con cobertura 100%;
- el basket académico-style value-weighted quedó muy concentrado **antes de outcomes**: NVDA 34,27%, AAPL 31,42%, top-5 78,81%, effective N 4,44. V1 se mantiene congelada y no se retunea;
- bajo los límites actuales de `CORE_ARCHITECTURE_V1`, esa concentración se reduciría si se usase como sleeve no-core, pero sigue pendiente medir el **look-through overlap** con las megacaps ya contenidas en el core antes de cualquier integración;
- evidencia live de implementación: los vehículos reales de Dimensional de high profitability son implementables pero no mostraron una ventaja persistente frente a Russell 1000 en los periodos estandarizados citados; se conserva como contexto de fricciones/implementación, no como FAIL de nuestra construcción;
- evaluator future-forward y unit guard quedaron sellados; verificación **PASS_PRE_OUTCOME_GUARDS**, 46 símbolos únicos, pesos suman 1 dentro de tolerancia y producción sin autoridad;
- archivos clave: `docs/CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1_2026-09-27.md`, `..._SNAPSHOT_2026-09-27.md`, snapshot/seal/verification bajo `validation-runs`, y `scripts/coreOutperformanceProfitabilityFutureForwardV1Protocol.mjs`;
- siguiente hito: fijar los precios adjusted de arranque en la primera sesión común posterior al snapshot; después no hay nada que optimizar hasta los checkpoints congelados;
- producción permanece **LEGACY**.


---

Actualización 2026-09-27 — audit look-through profitability vs core:

- se auditó la concentración look-through del basket future-forward congelado frente a los cinco IDs de core estructural; EUNL/IWDA comparten ISIN y se tratan como un mismo fondo a efectos de holdings;
- holdings oficiales recientes usados: Vanguard Global IE00B03HD191 (31-08-2026), Vanguard ESG Developed IE00B5456744 (31-07-2026), VWCE IE00BK5BQT80 (31-08-2026) e iShares Core MSCI World IE00B4L5Y983 (24-09-2026);
- el basket profitability contiene **NVDA 34,275%** y **AAPL 31,424%**; los cores contienen aproximadamente NVDA 4,77–5,66% y AAPL 4,24–5,41%;
- escenario conservador core + profitability sleeve al máximo presupuesto no-core: exposición combinada NVDA+AAPL ≈ **19,21–20,90% LOW**, **23,18–24,73% MEDIUM**, **28,85–30,19% HIGH**;
- cada NVDA y AAPL excedería el cap de BUILD ya existente en Custodia (6% LOW / 8% MEDIUM / 12% HIGH) si se llenase todo el presupuesto no-core con esta sleeve;
- usando esos caps ya existentes sólo como referencia de gobierno —no como tuning por outcomes—, **NVDA es vinculante** y el máximo teórico de profitability sleeve antes de alcanzarlos queda aprox.: LOW **1,19–4,18%**, MEDIUM **8,18–10,96%**, HIGH **22,16–24,51%**, según core seleccionado;
- esta capacidad es un upper bound basado en los overlaps auditados principales; una integración real debe comprobar todos los holdings seleccionados y otras sleeves existentes;
- decisión: **no usar el 18/25/35% completo como profitability sleeve**. La señal V1 no se retunea; sizing/riesgo se mantiene separado y fail-closed;
- evidencia: `validation-runs/diagnostics/core-outperformance-profitability-look-through-audit-2026-09-27.json`;
- future-forward sigue con outcomes **UNOPENED**; producción continúa **LEGACY**.


---

Actualización 2026-09-27 — future-forward start capture preparado y PIT secundario auditado:

- calendario NYSE oficial: 28-09-2026 no es festivo; es la primera sesión esperada posterior al snapshot del 27-09, pero el runner exige de todos modos una **sesión común real** para las 46 seleccionadas + SPY + URTH;
- capturador pre-outcome añadido: `scripts/coreOutperformanceProfitabilityFutureForwardV1Start.mjs`;
- semántica congelada: `adjusted open = raw open × adjusted close / raw close` de la misma sesión ya completada; cobertura obligatoria 100%, sin sustitución ni renormalización;
- sello separado: `validation-runs/preregistration/core-outperformance-profitability-future-forward-v1-start-seal.json`;
- unit guard local: **PASS** (`CORE_OUTPERFORMANCE_PROFITABILITY_FUTURE_FORWARD_V1_START_UNIT_PASS`);
- verificación de fingerprints: **PASS_PRE_START_GUARDS**; precios futuros siguen **UNOPENED**;
- se auditó una vía secundaria SimFin para intentar desbloquear el histórico sin SEC: fuente moderna 2019-2024 completa en columnas y `Publish Date`; snapshot antiguo demuestra 45.645 filas/69 columnas con datos al menos 2009-2019 y `Total Equity`, pero sólo está accesible como pickle binario no materializable aquí;
- decisión anti-bias: no acortar Stage C1, no coser snapshots heterogéneos sin filas auditables, no usar current fundamentals; el PIT SEC estricto permanece **BLOCKED_DATA_ACCESS** y sus stock outcomes siguen sin abrir;
- evidencia: `validation-runs/diagnostics/core-outperformance-profitability-pit-secondary-source-audit-2026-09-27.json` y `...future-forward-v1-start-verification-2026-09-27.json`;
- siguiente acción: ejecutar **sin cambios** el capturador tras completar la sesión del 28-09-2026 y fijar el punto cero del future-forward;
- producción permanece **LEGACY**.


---

Actualización 2026-09-27 — SimFin stock-level bridge V1 cerrado inconcluso:

- se preregistró antes de abrir precios `CORE_OUTPERFORMANCE_PROFITABILITY_SIMFIN_BRIDGE_V1`, como diagnóstico de traducción stock-level secundario y sin autoridad de promoción;
- fuentes congeladas: reconstrucción histórica S&P 500 `chinobing@019beba...` + SimFin quarterly versionado `income 117ac76...` / `balance 035c230...`, con `Publish Date <= anchor`;
- señal congelada: cuatro trimestres TTM de `Revenue + CostOfRevenue + SG&A + InterestExpenseNet` (gastos con signo negativo en SimFin), dividido por `Total Equity > 0`; top decile, value-weight por close causal × Shares Basic;
- coverage pre-price pasó los mismos mínimos heredados de Stage C1 en 2020–2024: 266–292 evaluables y 27–30 seleccionados, sin reducir thresholds;
- 2020 y 2021 obtuvieron **100% de cobertura de precios** para seleccionados + SPY + URTH;
- en la formación 2022, `CTXS` quedó seleccionada (rank 16) pero no existe precio de salida el 03-07-2023 porque Citrix fue adquirida y dejó de cotizar el 30-09-2022; la operación convirtió las acciones en derecho a recibir **104 USD cash/share**;
- el preregistro V1 exigía adjusted-open en el endpoint y 100% de coverage, sin survivor renormalization ni terminal-value fallback; por tanto el estudio se cierra **INCONCLUSIVE_PRICE_OR_COVERAGE**, no FAIL;
- no se introduce retrospectivamente el pago de 104 USD dentro de V1. Cualquier accounting delisting/corporate-action aware debe existir en un protocolo separado y no puede promocionarse con esta muestra ya consumida;
- resultado machine-readable: `validation-runs/diagnostics/core-outperformance-profitability-simfin-bridge-v1-result.json`;
- el SEC PIT estricto permanece **BLOCKED_DATA_ACCESS / outcomes unopened** y future-forward V1 permanece sellado a la espera del arranque 28-09-2026;
- producción continúa **LEGACY**.


---

Actualización 2026-09-27 — diagnóstico post-hoc delisting-aware del bridge SimFin:

- exclusivamente como **diagnóstico de arquitectura sobre muestra consumida**, se contabilizó CTXS con el cash merger consideration conocido de **104 USD/acción**, sin reinversión ni interés, después de que V1 ya hubiese quedado INCONCLUSIVE;
- esta regla terminal se definió después de observar el caso CTXS y por tanto **no tiene autoridad de validación/promoción**;
- ventana 01-07-2020 -> 01-07-2024: basket direct profitability total **+68,53%**, CAGR **13,9390%**; SPY **+87,03%**, CAGR **16,9444%**; URTH **+71,18%**, CAGR **14,3837%**;
- exceso post-hoc: **-3,0054 pp/año vs SPY** y **-0,4447 pp/año vs URTH** -> `POSTHOC_GROSS_EDGE_NOT_PRESENT`;
- periodos: +30,88% / -20,04% / +15,68% / +39,22% para candidate, frente a SPY +40,62% / -10,95% / +19,56% / +24,92%;
- la traducción value-weighted quedó dominada por megacaps: AMZN representó aprox. **50,3% / 45,9% / 42,0% / 36,7%** del basket en los cuatro periodos;
- interpretación metodológica: **no declarar fallida la señal Operating Profitability externa**, pero sí cerrar esta construcción stock-level directa/value-weighted como una política con mala transferencia económica en la muestra consumida;
- no retunear score, decil, pesos, equity floor ni añadir filtros sobre 2020-2024;
- evidencia: `validation-runs/diagnostics/core-outperformance-profitability-simfin-bridge-v1-posthoc-result.json`;
- siguiente investigación sólo puede ser una hipótesis distinta y congelada antes de outcomes fresh; producción permanece `LEGACY`.


---

Actualización 2026-09-27 — profitability capped policy + value intersection:

- `CORE_OUTPERFORMANCE_PROFITABILITY_CAPPED_POLICY_V1` quedó preregistrada y sellada **antes de outcomes future-forward** usando exactamente las mismas 46 acciones de Profitability V1; sólo cambia la política de pesos mediante cap externo del **5% por emisor** con redistribución pro-rata;
- no cambia score, ranking, universo ni señal. Referencia del cap: metodología pública MSCI Quality para control de concentración; producción sigue `LEGACY`;
- concentración prospectiva pre-outcome: max 5%, top-5 25%, top-10 49,39%, HHI 0,03472, effective N **28,80**, frente a effective N 4,44 del value-weight raw;
- cross-diagnostic sobre la muestra SimFin **ya consumida**, sin autoridad de promoción: raw CAGR 13,9390% -> capped 16,4654%; SPY 16,9444%; URTH 14,3837%;
- el cap recupera **+2,5264 pp/año** frente al raw y supera URTH en **+2,0818 pp/año**, pero sigue **-0,4790 pp/año vs SPY**; no se ajusta 5%/quintiles/pesos para cerrar esa diferencia;
- evidencia: `validation-runs/diagnostics/core-outperformance-profitability-capped-policy-historical-cross-diagnostic-2026-09-27.json`; la prueba limpia del cap sigue siendo el brazo future-forward aún **UNOPENED**;
- la hipótesis previa Candidate B `profitability × value` se abrió sólo de forma prospectiva, sin consultar sus retornos históricos: `CORE_OUTPERFORMANCE_PROFITABILITY_VALUE_FUTURE_FORWARD_V1`;
- snapshot 27-09-2026: 500 miembros -> 451 evaluables -> top quintile OP 91 + top quintile BM 91 -> **intersección exacta de 1 sola acción: CHTR**;
- CHTR queda al **100%** del signal replica; effective N = 1. El protocolo prohíbe ampliar quintiles, rank-sum o rescatar con vecinos tras ver el cross-section;
- V2 permanece sellada para diagnóstico future-forward, pero la **promoción queda bloqueada por concentración aunque eventualmente bata SPY/URTH**; CHTR ya pertenece a las 46 de V1 y puede reutilizar el mismo start price;
- archivos: `docs/CORE_OUTPERFORMANCE_PROFITABILITY_CAPPED_POLICY_V1_2026-09-27.md`, `...PROFITABILITY_VALUE_FUTURE_FORWARD_V1_2026-09-27.md`, snapshots/seals y evaluadores correspondientes;
- lectura retenida: profitability contiene información; la ponderación raw fue un problema importante; cap 5% mejora mucho la transferencia, pero todavía no acredita exceso conjunto frente a SPY+core. La intersección literal value×profitability 5×5 es demasiado estrecha como política Custodia.


---

Actualización 2026-09-27 — direct-stock profitability no viable + ex-US no generaliza:

- se auditó la ejecución exacta de las 46 acciones del basket profitability congelado con títulos enteros y la tarifa vigente de MyInvestor para acciones USA: 0,12% por operación con mínimo 3 € / máximo 25 € y 0,30% de cambio de divisa;
- la réplica directa exige aprox. **396.286 € sólo en la sleeve** para poder comprar al menos una acción de las 46 respetando los pesos congelados; a 5.000 € sólo 3 posiciones son ejecutables y a 10.000 €, 5;
- el modelo productivo actual de `brokerExecution.ts` no es suficiente para validar esta sleeve: usa el mínimo ETF de 1 € y no incorpora el coste FX al `totalCost`; producción no se modifica ahora;
- decisión metodológica: **FAIL_DIRECT_STOCK_IMPLEMENTATION_FOR_NORMAL_SLEEVE**. Es un FAIL de política/implementación, no de calidad de señal. La réplica future-forward raw permanece intacta como experimento;
- evidencia: `validation-runs/diagnostics/core-outperformance-profitability-direct-stock-implementation-2026-09-27.json`;

- se ejecutó después, exactamente como estaba preregistrado, `CORE_OUTPERFORMANCE_PROFITABILITY_EXUS_GENERALIZATION_V1`;
- Developed ex-US Big/Robust OP 2009-2014: CAGR **9,6855%** vs mercado ex-US **10,2713%** -> **-0,5858 pp/año**;
- Developed ex-US Big/Robust OP 2016-2021: CAGR **10,6934%** vs mercado ex-US **9,3268%** -> **+1,3667 pp/año**;
- el gate exigía exceso positivo en ambas ventanas; resultado **FAIL_GEOGRAPHIC_GENERALIZATION**;
- la rama ex-US se cierra sin abrir rescates Europe/Japan/Small+Big ni cambiar buckets/ventanas;
- la señal U.S. Operating Profitability conserva su PASS + confirmación temporal, pero ya no se puede describir como ventaja geográficamente generalizada bajo esta construcción;
- archivos: `docs/CORE_OUTPERFORMANCE_PROFITABILITY_EXUS_GENERALIZATION_V1_EXECUTION_2026-09-27.md`, input/result y runner reproducible;
- siguiente dirección: implementación empaquetada UCITS/fondo seleccionada por metodología, accesibilidad y costes antes de abrir su histórico objetivo; producción continúa **LEGACY**.


---

Actualización 2026-09-27 — checkpoint quality future-forward tras snapshot:

- HEAD de checkpoint: `382d7d3f3b57abf1c8f0728621a8c140f42adde0`;
- `CORE_OUTPERFORMANCE_PROFITABILITY_DIRECT_STOCK_IMPLEMENTATION_V1`: cerrado como **FAIL_DIRECT_STOCK_IMPLEMENTATION_FOR_NORMAL_SLEEVE**; la réplica exacta de 46 acciones requiere aprox. 396k EUR de sleeve para disponer de al menos una acción por target congelado;
- `CORE_OUTPERFORMANCE_PROFITABILITY_EXUS_GENERALIZATION_V1`: ejecutado bajo preregistro y cerrado **FAIL_GEOGRAPHIC_GENERALIZATION**; 2009-2014 = -0,5858 pp/año vs mercado ex-US y 2016-2021 = +1,3667 pp/año; no abrir rescates regionales;
- `CORE_OUTPERFORMANCE_PACKAGED_QUALITY_UCITS_V1`: candidato principal congelado por metodología/ejecutabilidad = iShares Edge MSCI USA Quality Factor UCITS ETF, ISIN IE00BD1F4L37, QDVB/Xetra/EUR; diagnóstico histórico no-blind 2017-2025: CAGR 13,8361% vs parent USA 14,7638% y URTH 12,8920%; estado **POST_SELECTION_PACKAGED_PARENT_EDGE_NOT_PRESENT**; no cambiar ETF para rescatar;
- `FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1`: protocolo y guard pre-outcome integrados; convención congelada = winsor 5/95 lineal `p*(n-1)`, z-score poblacional, 100 seleccionados, `QualityScore × market cap`, cap **5% por emisor**;
- descriptores fundamentales actuales capturados en dos partes para los 500 miembros del S&P 500; **347/500 evaluables**, sin abrir retornos;
- snapshot prospectivo congelado en `validation-runs/preregistration/fundamental-quality-future-forward-v1-snapshot.json`;
- snapshot: **100 acciones / 99 emisores**, max issuer 5%, top-5 25%, top-10 46,0156%, HHI 0,0292515, effective N **34,1863**;
- top ranks de quality antes de outcome incluyen FTNT, LII, AAPL, KLAC, IDXX, ADP, WSM, LRCX, ITW y MA; estos nombres y pesos están congelados y no se retunean;
- future outcomes continúan **UNOPENED**; producción sigue **LEGACY**;
- único trabajo que quedó pendiente al producirse una interrupción de sesión: completar y commitear el evaluador de checkpoints + capturador del primer common adjusted-open posterior al 27-09-2026, sin cambiar el snapshot.

---

Actualización 2026-09-27 — cierre de diseño FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1:

- **Estado vigente: DESIGN_AND_INFRASTRUCTURE_COMPLETE / PREPARED / START_NOT_CAPTURED / FUTURE_OUTCOMES_UNOPENED.** No resultado económico nuevo ni promoción.
- HEAD base comprobado: `8708155950912a0b6dd9e8ea6e48e414f4053397`. Commit de implementación/sellos/tests: `48b3b26192edc5f7eef55b187ea38212aa38636e`. El HEAD de cierre es el commit de main que contiene esta entrada (resolver `git rev-parse origin/main` después de fetch); no copiar el HEAD base como si siguiese vigente.
- Snapshot **intacto byte a byte**: `validation-runs/preregistration/fundamental-quality-future-forward-v1-snapshot.json`, SHA-256 `06ad777b20970fe8c957d9febe8ccadcbcc75ecbf08cc870cd600236488ab2f2`. 347/500 evaluables, 100 securities / 99 emisores, pesos iniciales suman 1, cap inicial 5%; ningún nombre, descriptor, score, rank o peso cambiado.
- Protocolo matemático y unit original conservados sin modificaciones. Nuevo sello: `validation-runs/preregistration/fundamental-quality-future-forward-v1-infrastructure-seal.json`, cubre snapshot, los dos ficheros de descriptores, protocolo, documentación, código y tests.
- Evaluador: `scripts/fundamentalQualityFutureForwardV1Evaluator.mjs`. Cesta buy-and-hold de pesos iniciales congelados, total return bruto USD; 3m/6m sólo descriptivos, 12m único gate. PASS máximo `PASS_PRIMARY_12M_SIGNAL_ONLY` exige 100% cobertura y retorno estrictamente superior a SPY y URTH; riesgo descriptivo no añade gates retrospectivos.
- Métricas: total return, CAGR equivalente ACT/365,25, volatilidad diaria muestral anualizada sqrt(252), drawdown diario, Sharpe con risk-free **cero diario idéntico** para las tres curvas (referencia research, no cash económico). No costes ni fiscalidad ni ejecutabilidad implícitos.
- Capturador: `scripts/fundamentalQualityFutureForwardV1Start.mjs`; CLI `scripts/fundamentalQualityFutureForwardV1Live.mjs`. Primer common tradable session posterior a 2026-09-27, adjusted open = raw open × adjusted close / raw close de la misma sesión completada. No fecha manual, no fallback parcial, no survivor renormalization.
- Las ausencias del proveedor no permiten saltar al día siguiente; sólo una suspensión de sesión completa acreditada puede demostrar que un día anterior no era común. Cierres extraordinarios no previstos quedan bloqueados. Calendario oficial programado congelado hasta 2027-12-31.
- Para no mezclar bases de ajuste por dividendos, outcomes usan el adjusted open inicial y la serie completa del mismo vintage; raw open/close iniciales deben coincidir con el punto cero sellado. No se cambia el start. Split/revisión incompatible => bloqueo.
- Persistencia create-only en `replay-results/validation-runs/fundamental-quality-future-forward-v1/`, con apertura durable previa a consultas, respuestas/cache por símbolo, manifest/input y objeto `start` con hash atómico. No se sobrescribe inicio ni checkpoint; readback obligatorio; `.runtime` no es autoridad. No requiere modificar helpers ni jobs de otras investigaciones.
- Corporate actions: **formalmente bloqueado el accounting de cash mergers, stock mergers, delistings, ticker changes, spin-offs y splits** hasta un handler genérico causal separado, congelado antes de conocer el evento. Regla común de admisión: `scripts/researchCorporateActionsFailClosedV1.mjs`. No terminal values inventados ni CTXS usado para validación.
- Cada captura/checkpoint requiere revisión REAL de eventos de las 102 identidades, con fechas/fuentes/hashes; Yahoo vacío no acredita ausencia de eventos. Sólo dividendos ordinarios vía total-return del proveedor están admitidos. Si falta esa revisión, el runner bloquea antes de precios.
- Comprobaciones PASS: unit matemático original; **22 grupos de tests** de infraestructura (hash, inmutabilidad, calendario/DST, causalidad/madurez, captura, huecos/duplicados, REAL/identidad, rebasing, gate exclusivo 12m, métricas, corporate actions y persistencia mock); coreArchitectureV1; historicalInstrumentMaster; researchValidationRuntime; **TypeScript completo `npm run lint`**.
- Ejecución real hoy del capturador: **WAITING_FOR_COMPLETED_SESSION**, `startCaptured=false`, `outcomesState=UNOPENED`, **0 llamadas de mercado**. Los precios artificiales sólo existen en unit fixtures aislados, nunca como evidencia del estudio.
- Evidencia de comandos/exit codes/stdout y hash de sello: `validation-runs/diagnostics/fundamental-quality-future-forward-v1-design-verification-2026-09-27.json`.
- Documento operativo completo, contratos de inputs, fechas, cálculos, límites y comandos: `docs/FUNDAMENTAL_QUALITY_FUTURE_FORWARD_V1_INFRASTRUCTURE_2026-09-27.md`.
- **Primer momento permitido de lectura:** 2026-09-28 22:00 UTC (2026-09-29 00:00 Europe/Madrid), deliberadamente después del cierre cash. No se ha anticipado ni capturado precio del 28. No existe proceso/background ni automatización creada.
- **Blockers operativos reales:** maduración de la sesión, `GITHUB_REPLAY_SYNC_TOKEN` ausente en el runtime actual, revisión REAL de corporate actions por rango/102 identidades, disponibilidad completa de precios REAL. La rama replay-results debe ser accesible; no sustituir persistencia durable por éxito local.
- **Siguiente acción permitida:** a partir de la hora anterior, obtener/auditar la revisión real y ejecutar `node scripts/fundamentalQualityFutureForwardV1Live.mjs start --review-dir <directorio-real>` desde el runtime con persistencia habilitada. Si falta un requisito, conservar BLOCKED/WAIT, no pedir al usuario ejecutar manualmente pruebas ni inventar el start. Después sólo checkpoints a 3/6/12 meses desde el start legítimo; endpoints previstos si éste es el 28: 2026-12-28, 2027-03-29, 2027-09-28. Nunca abrirlos antes de completar su sesión.
- Las aperturas futuras se registrarán en marcadores durables nuevos; el `outcomeOpened:false` del snapshot permanece como declaración histórica pre-outcome y no se reescribe.
- **Ramas cerradas preservadas:** U.S. Operating Profitability conserva PASS de señal + confirmación; réplica directa raw/46 acciones cerrada por transferencia/ejecución; cap 5% no retuneado sobre 2020-2024; ex-US FAIL_GEOGRAPHIC_GENERALIZATION sin rescates; Profitability × Value (CHTR 100%) bloqueada por concentración; UCITS IE00BD1F4L37/QDVB conserva POST_SELECTION_PACKAGED_PARENT_EDGE_NOT_PRESENT, sin cambio de ETF. No se reejecutaron sus estudios económicos.
- No cambios en `src/`, `server/`, CORE_ARCHITECTURE_V1, replay/NEXT_OPEN, Forward Risk, broker ni allocation. Producción **LEGACY**, `productionAuthority=false`, `promotionAllowed=false`.

---

Actualización 2026-09-28 — pruebas económicas de consistencia / objetivo del usuario 80%:

- Base main verificada: `0015935ddedbc9c4822a652f8f8a18287659a7a9`. Nueva auditoría `CORE_OUTPERFORMANCE_HIT_RATE_AUDIT_2026_09_28`, cálculo de frecuencia sobre evidencia ya consumida, sin reejecutar selecciones ni rescatar ramas cerradas. No es un nuevo backtest PIT de las 100 acciones.
- Se define «vez» como periodo completo de 12 meses; 80% es objetivo descriptivo pedido por el usuario, no cambio retroactivo de gates sellados. No equivale a probabilidad futura acreditada, frecuencia de operaciones ganadoras ni retorno absoluto positivo.
- Cobertura: OP académico 72+72 meses en bloques 2009–2014/2016–2021; SPY completo en ambos; URTH completo sólo 2016–2021 (no existía al inicio del primer bloque). ETF congelado 9/9 años; SimFin consumido 4/4 intervalos con caveat post-hoc CTXS conservado. Caché nueva de benchmarks REAL: 227 observaciones históricas, sin precios futuros.
- OP académico 2009–2014: **2/6 años baten SPY (33,33%)**. 2016–2021: **4/6 SPY (66,67%), 6/6 URTH (100%), 4/6 ambos**. Agregado de frecuencias: **6/12 SPY (50%)**, aunque 11/12 años fueron positivos en términos absolutos. No encadenar riqueza atravesando 2015 ausente.
- Todas las ventanas móviles de 12m dentro de cada bloque: 2009–2014 **17/61 SPY (27,87%)**; 2016–2021 **42/61 SPY (68,85%), 52/61 URTH (85,25%), 41/61 ambos (67,21%)**. Son ventanas solapadas/dependientes, no 61 años independientes.
- ETF Quality ya congelado IE00BD1F4L37, 2017–2025: **3/9 SPY (33,33%), 6/9 URTH (66,67%), 2/9 ambos (22,22%)**. No cambiar ETF ni diseño tras estas cifras.
- Implementación SimFin consumida raw **1/4 ambos (25%)**, cap5 **2/4 (50%)**; sólo lectura de resultados guardados. Direct-stock sigue cerrado y no se ha revalidado accounting CTXS ni retuneado cap/señal.
- Hallazgo de comparabilidad: antiguo URTH académico usaba 2016-01-04 close, mientras candidate incluía enero completo. Esta auditoría usa 2015-12-31: candidate CAGR20,7995%, SPY17,2757%, URTH13,9457%. Los artefactos antiguos no se reescriben. Antiguo parent empaquetado era S&P500 **UCITS**, no SPY; se conservan por separado.
- Advertencia de datos: AdjustedClose de Wolfram y NAV oficial no coinciden exactamente; causa no completamente reconciliada. Conteos anuales URTH contrastados con NAV oficial coinciden (6/6 académico reciente, 6/9 ETF); rolling sigue dependiente del proveedor. No convertir diferencias de convención en alpha.
- Conclusión: **NO_80PCT_STABLE_IMPLEMENTABLE_EDGE_DEMONSTRATED**. El buen 100%/85,25% reciente contra URTH conserva interés como señal académica, pero no acredita la política Custodia ni generalización temporal. No borrar el PASS académico previo: CAGR y frecuencia contestan preguntas diferentes.
- Backtest histórico exacto de Fundamental Quality: **BLOCKED_MISSING_HISTORICAL_PIT_DESCRIPTOR_PANEL**, 0 paneles de formación completos en la evidencia revisada. Los 347 descriptores current y 100 seleccionados prospectivos no prueban ROE/D-E/market-cap/as-filed/EPS de cada fecha histórica. No trasladar cartera actual al pasado. Faltan vintages, seis anchors causales por formación y accounting histórico completo; no es un FAIL económico de esa hipótesis.
- Pruebas PASS: 10 unit tests nuevos, verificación aritmética independiente por log-returns/endpoints/conteos, unit Quality original, 22 grupos de infraestructura/sellos, coreArchitectureV1 y TypeScript completo (`npm run lint`). Sin Actions ni subagentes.
- Archivos: `scripts/coreOutperformanceHitRateAudit.py`, `tests/coreOutperformanceHitRateAudit.unit.py`, `docs/CORE_OUTPERFORMANCE_HIT_RATE_AUDIT_2026-09-28.md`, input/result/verification `validation-runs/diagnostics/core-outperformance-hit-rate-*2026-09-28.json`.
- Siguiente paso permitido: obtener/auditar panel histórico causal para una réplica histórica especificada aparte antes de outcomes; no requiere esperar un año si se resuelve la deuda de datos. La prueba prospectiva se conserva sin cambios: **START_NOT_CAPTURED / FUTURE_OUTCOMES_UNOPENED** en esta sesión de madrugada; no se ejecutó collector ni evaluator live. No hay automatización creada.
- Snapshot, protocolo, pesos, fechas y sellos future-forward intactos. Todas las ramas cerradas siguen cerradas. Producción **LEGACY**, `productionAuthority=false`.

---

Actualización 2026-09-28 — nueva prioridad autorizada: gráficos/liderazgo sectorial, preservar Quality:

- Usuario pide una dirección fundamentada en literatura y un plan listo para implementar/ejecutar desde otro chat, con bajo coste de tokens. No se promete encontrar rentabilidad mediante búsqueda indefinida.
- Base comprobada `c282d73ec920d3bde55466c36284ad8e41195956`. Plan canónico: `docs/CORE_OUTPERFORMANCE_PRICE_DISCOVERY_PLAN_2026-09-28.md`; handoff: `docs/CORE_OUTPERFORMANCE_PRICE_DISCOVERY_HANDOFF_2026-09-28.md`.
- Revisión primaria completada: Lo/Mamaysky/Wang sobre información de patrones; George/Hwang máximos52w; Hong/Jordan/Liu componente industrial; trend following AQR con límites de transferencia; Novy-Marx sobre múltiples señales; PEAD con evidencia histórica y contraevidencia contemporánea. No pruebas basadas en testimonios de traders.
- Candidata **SECTOR_52W_HIGH_LEADERSHIP_V1**: adaptación long-only de cercanía a máximos a los nueve ETF sectoriales originales de1998. `close/max252` a cierre mensual, top3 (=ceil30%×9), desempate por ticker; pesos por frecuencia entre seis selecciones mensuales/18, rebalanceo NEXT_OPEN. No se modifica EntryTiming ni slopes productivos.
- Existe diseño JSON + seal documental en `validation-runs/preregistration/sector-52w-high-leadership-v1-design*.json`. **Estado: DESIGN_FROZEN / IMPLEMENTATION_PENDING / ECONOMIC_NOT_RUN**. El sello de ejecución deberá incluir el código/tests antes de precios; el sello documental no lo sustituye.
- Diagnóstico2013–2018 y replicación2019–2025, fronteras por primer common open del año sucesor. Mercados ya consumidos, sin claim fresh/blind. Regla/gates congelados antes de calcular nueva cartera; rendimientos sectoriales2019 fueron visibles incidentalmente en documentación de instrumentos.
- Comparadores SPY+URTH, basket9 equal-weight y ablación12-2 misma construcción. Ablación no promocionable ni reapertura momentum cerrado. Slopes/rupturas sólo descriptivos; no ajustes tras outcomes. 80% conjunto anual por bloque se informa separado del gate económico.
- Sólo tras complete coverage/accounting y exceso económico/riesgo frente a benchmarks/control con stress fijo de costes, replicación sin cambios. Sólo después economía real UCITS/broker/FX/impuestos/capital y eventual revisión research/shadow. ETF USA no se presentan como producto retail español disponible.
- Alternativa ortogonal PEAD conservada a nivel literatura/inventario de datos, sin outcomes ni fallback automático. No combinaciones Quality×breakout ad hoc.
- Calidad corporativa/Profitability conservan avances de señal; el FAIL de slopes20/60 en15 episodios no invalida todo análisis técnico. Tampoco permite retunear aquella política. Ramas cerradas, snapshots, sellos e infraestructura prospectiva permanecen intactos.
- Siguiente acción: el chat ejecutor debe implementar/tests/seal/preflight/diagnóstico siguiendo el plan; no entregar otro plan, no pedir al usuario ejecutar el Centro. Si hay bloqueo, registrar causa exacta y parar sin inventar precios ni reducir cobertura.
- Cambios de esta sesión sólo documentación/especificación; comprobados hashes y coherencia del diseño. **No se ejecutó backtest nuevo ni se capturó inicio prospectivo.** Producción LEGACY, authority=false. No Actions/subagentes ni automatización.


---

Actualización 2026-09-28 — SECTOR_52W_HIGH_LEADERSHIP_V1 implementada, bloqueada antes de outcomes:

- diseño canónico seguido sin replantear: `docs/CORE_OUTPERFORMANCE_PRICE_DISCOVERY_PLAN_2026-09-28.md` + handoff; candidata `SECTOR_52W_HIGH_LEADERSHIP_V1`;
- implementación research-only añadida: `scripts/sector52WeekHighLeadershipV1Protocol.mjs` y `scripts/sector52WeekHighLeadershipV1Live.mjs`; tests `tests/sector52WeekHighLeadershipV1.unit.mjs` y `tests/sector52WeekHighLeadershipV1.causal.unit.mjs`;
- semántica congelada preservada: nueve Select Sector originales; max252 causal incluido t; top3; empate ticker ASCII; seis votos /18; monthly NEXT_OPEN; equal-weight9; ablación 12-2 congelada antes de outcomes como close[t-2]/close[t-12]-1; stress 10/20 pb/side; gates/riesgo/hit-rate/bootstrap del plan;
- sello de ejecución pre-outcome: `validation-runs/preregistration/sector-52w-high-leadership-v1-execution-seal.json`; `economicResult=NOT_RUN`, `outcomesOpened=false`;
- exact protocol ejecutado en el runtime JS disponible: **13 checks PASS**, marker `SECTOR_52W_HIGH_LEADERSHIP_V1_PROTOCOL_RUNTIME_PASS`; se corrigió únicamente un fixture de prefix-invariance que cortaba artificialmente a mitad de mes; protocolo económico no cambió;
- limitación del chat: **no existe shell/Codespace expuesto**, por lo que Node CLI/npm/tsc no se ejecutaron y no se declaran PASS;
- fuente primaria Yahoo del proveedor existente: **BLOCKED_CURRENT_CHAT_RUNTIME**; acceso directo al endpoint no disponible desde las herramientas actuales;
- fallback Wolfram `REAL_SECONDARY` se congeló antes de outcomes, incluido guard de reconciliación oficial <= **0,20 pp/año** frente a NAV y Market Value State Street a 10 años para los 9 sectores;
- preflight corto Wolfram: 11/11 símbolos, 9 sesiones comunes, NYSE, adjusted-open reconstruido coincide con `rawOpen × adjustedClose/rawClose` a precisión de coma flotante;
- reconciliación oficial 31-08-2026: PASS sólo XLF/XLI/XLP/XLV; FAIL XLB/XLE/XLK/XLU/XLY. Los cinco FAIL coinciden exactamente con los cinco Select Sector sometidos por State Street a split 2:1 efectivo 05-12-2025; se registra incompatibilidad de ajuste no resuelta y **no se corrige post-hoc**;
- estado de ejecución: **INCONCLUSIVE_DATA_RECONCILIATION**; diagnóstico 2013-2018 **NO ABIERTO / NO CALCULADO**; replicación 2019-2025 **NO ABIERTA / NO CALCULADA**; no existe CAGR/hit-rate/gate económico válido de la candidata;
- evidencia: `validation-runs/diagnostics/sector-52w-high-leadership-v1-preflight-2026-09-28.json` y `docs/SECTOR_52W_HIGH_LEADERSHIP_V1_EXECUTION_2026-09-28.md`;
- siguiente acción permitida: ejecutar **sin modificar** la implementación sellada en un runtime donde funcione el proveedor Yahoo primario; si falta reconciliación/cobertura/accounting, conservar INCONCLUSIVE. No cambiar signal/window/top3/votes/costs para rescatar;
- Quality/Profitability y sus snapshots/sellos permanecen intactos; producción continúa **LEGACY**, `productionAuthority=false`, sin integración productiva.


---

Actualización 2026-09-28 — SECTOR_52W_HIGH_LEADERSHIP_V1 integrada en ResearchValidationCenter:

- aclaración del bloqueo anterior: `INCONCLUSIVE_DATA_RECONCILIATION` describía exclusivamente el runtime de ChatGPT, donde Yahoo primario no era accesible y Wolfram fue rechazado como fallback económico. **No es el runtime previsto de ejecución final**;
- la candidata está ahora integrada como job local de la propia app: `sector-52w-high-leadership-v1` en `ResearchValidationCenter`, botón **Ejecutar diagnóstico 52W**;
- backend: `server/researchValidationRoutes.ts`; UI: `src/components/ResearchValidationCenter.tsx`; ejecución marcada `LOCAL_APP_BACKEND`, sin IA ni GitHub Actions;
- cadena del job: guard protocolo -> guard causal/prefix -> guard parser/identidad Yahoo -> guard runtime -> guard `CORE_ARCHITECTURE_V1` -> `npm run lint` -> descarga/caché Yahoo REAL -> runner económico;
- Yahoo REAL local: `scripts/sector52WeekHighLeadershipV1YahooInput.mjs`; descarga 2011-07-01 -> 2026-01-07, exige ETF/USD/identidad, adjusted open = raw open × adjClose/rawClose, cobertura completa y cachea raw bajo `.runtime/sector-52w-high-leadership-v1/yahoo`;
- el primer input válido se congela en `validation-runs/diagnostics/sector-52w-high-leadership-v1-input.json`; ejecuciones posteriores lo reutilizan y no refrescan la muestra histórica;
- runner `scripts/sector52WeekHighLeadershipV1Live.mjs` completado: calendario de ejecución sectorial conserva señal de diciembre para frontera enero; common calendar incluye la sesión sucesora real; calcula 10 y 20 pb/lado, pero gate de continuidad sólo usa **20 pb/lado**;
- diagnóstico 2013-2018 siempre se ejecuta primero; replicación 2019-2025 sólo se calcula si el gate diagnóstico 20 pb pasa. Resultado previo, si existe, se reutiliza sin recomputar;
- estadística corregida al plan: bootstrap pareado circular 12 meses, 2.000 réplicas, seed 20260928, sobre el mínimo del exceso CAGR vs SPY/URTH; límite inferior unilateral 95% >0 requerido en ambos bloques tras gates;
- slopes20/60/120, aceleración, breakout20 y breakout252 se guardan sólo como descriptivos; no afectan selección/pesos. Fórmula de slopes replica la de `strategyConsensusEngine`; breakout252 excluye t;
- exact protocol vuelto a ejecutar en el runtime JS de este chat tras las correcciones: **15 checks PASS**; esto no sustituye los guards Node/npm del job local;
- sello de ejecución regenerado después de integrar Yahoo, runner, tests, route y UI: `validation-runs/preregistration/sector-52w-high-leadership-v1-execution-seal.json`;
- evidencia de integración: `validation-runs/preregistration/sector-52w-high-leadership-v1-local-job.json`;
- estado económico en main: **READY_LOCAL_APP_EXECUTION / NOT_RUN**; diagnóstico y replicación siguen **UNOPENED** en el repositorio;
- siguiente acción normal: sincronizar/usar este HEAD en la app local, abrir **Validación de investigación** y pulsar una sola vez **Ejecutar diagnóstico 52W**. No ejecutar scripts manualmente;
- Quality/Profitability se conservan; producción productiva sigue **LEGACY**, sin cambio en `CORE_ARCHITECTURE_V1` ni autoridad productiva.


---

Actualización 2026-09-28 — primer run 52W inválido técnicamente; fix de rotación:

- primera ejecución local del job `sector-52w-high-leadership-v1`: backend/job terminó, pero el resultado económico reportado como `FAIL_DIAGNOSTIC` **NO ES VÁLIDO**;
- evidencia observada: candidata 52W y control 12-2 devolvieron `null` en total return/CAGR/vol/drawdown/Sharpe, además de `null` en costes/turnover/HAC, mientras SPY/URTH/equal9 sí fueron finitos; esto identifica contaminación `NaN` serializada como `null`;
- root cause confirmado en código: al rotar una cartera mensual, `simulate` pedía opens sólo de los nuevos targets. Una posición que salía de cartera no tenía precio de apertura para ser valorada/vendida en `rebalanceAtOpen`, generando `undefined -> NaN`. Equal9 no sufría el bug porque siempre mantiene los nueve sectores;
- clasificación correcta del primer run: **TECHNICAL_INVALID_NO_ECONOMIC_VERDICT**. No usar su `FAIL_DIAGNOSTIC` como evidencia contra la señal;
- reparación técnica, sin retuning: el rebalanceo usa ahora la unión de **holdings actuales + nuevos targets**; precios/costes/equity no finitos hacen hard-fail; el runner rechaza bloques económicos no finitos antes de gates;
- el runner detecta el resultado local inválido existente, lo archiva como `sector-52w-high-leadership-v1-result-invalid-technical-v1.json` y recalcula usando **el mismo input Yahoo congelado**, sin refrescar datos ni cambiar política;
- test añadido para rotación explícita A/B -> B/C y para precio faltante de una posición saliente; checks dirigidos en runtime JS: PASS;
- evidencia durable: `validation-runs/diagnostics/sector-52w-high-leadership-v1-first-run-technical-invalid-2026-09-28.json`;
- metodología: diagnóstico histórico ya **OPENED/CONSUMED como diagnóstico técnico**, sin autoridad de promoción; replicación 2019-2025 sigue **UNOPENED** porque nunca fue calculada. La reparación no cambia señal, top3, seis votos, fechas, costes ni gates;
- execution seal actualizado tras el fix; producción sigue **LEGACY**;
- siguiente acción: sincronizar al HEAD corregido y volver a pulsar **Ejecutar diagnóstico 52W** una sola vez. El job reutilizará el mismo input Yahoo y sólo abrirá replicación si el diagnóstico válido pasa.


---

Actualización 2026-09-28 — SECTOR_52W_HIGH_LEADERSHIP_V1 R3 técnica validada; dos exports anulados:

- **No considerar válidos** ninguno de los dos exports locales de las 19:25 y 19:33: ambos reportaron `FAIL_DIAGNOSTIC` con candidata 52W y control 12-2 completamente `null` en economics; ambos usan el mismo input Yahoo hash `35d30e16609099e0d852e744753fd74edd0989126931174608113f6b242b825f` y ninguno reporta `implementationRevision`;
- clasificación canónica: **BOTH_RUNS_TECHNICAL_INVALID_NO_ECONOMIC_VERDICT**. Diagnóstico histórico quedó abierto/consumido sólo como diagnóstico técnico; **replicación 2019-2025 continúa UNOPENED**;
- root cause primario: durante una rotación mensual se pedían opens sólo para nuevos targets; un holding saliente quedaba sin precio de apertura, propagando `NaN -> null`. Equal9 no lo mostraba porque conserva siempre los nueve sectores;
- la segunda ejecución devolvió el mismo resultado lógico inválido, por lo que no constituye evidencia de que el runner reparado hubiera sido ejecutado;
- revisión técnica vigente: **`SECTOR_52W_HIGH_LEADERSHIP_V1_VALIDATED_R3_2026_09_28`**. Todo resultado futuro debe incluir exactamente ese fingerprint; un resultado sin revisión o con otra revisión se archiva/recalcula y no se acepta;
- reparación R3 sin retuning: union(current holdings,new targets) para opens; hard-fail en precios/equity/costes no finitos; hard-fail de bloques económicos no finitos antes de gates; convención mensual que incluye coste inicial; clasificación separada de bootstrap y objetivo observado 80%;
- reporting completado según plan: worst12m, tamaño medio de victoria/pérdida relativa, pérdida relativa máxima, concentración/HHI, meses/años y turnover;
- E2E automático **antes de Yahoo** integrado en ResearchValidationCenter: ejecuta el runner real con (a) fixture de rotación + resultado inválido preexistente que debe archivarse y (b) fixture fuerte que debe pasar diagnóstico, abrir replicación, pasar gates, bootstrap y objetivo 80%;
- el job también exige antes del runner real: revision guard, unit/causal/Yahoo parser, corporate-actions unit, NAV unit, runtime integration, core architecture y TypeScript;
- corporate actions REAL: raw cache Yahoo hash-check + eventos; se exige el set oficial de splits 2:1 del 05-12-2025 en XLB/XLE/XLK/XLU/XLY y continuidad compatible con la convención Yahoo de OHLC ya split-adjusted;
- reconciliación Yahoo/NAV REAL: antes del backtest, CAGR AdjustedClose 2016-08-31 -> 2026-08-31 de cada uno de los 9 sectores debe estar dentro de **±0,20 pp/año** de NAV **y** Market Value oficiales State Street al 31-08-2026; un fallo bloquea el estudio antes de economía;
- pruebas propias en Node v22.16.0/mirror del runner: rotación 72 eventos/33 cambios de composición, control 12-2 con 36 rotaciones, todas las métricas finitas; escenario fuerte abre replicación y pasa gates/bootstrap/80%; convención mensual con coste inicial PASS; corporate-actions unit PASS; NAV unit PASS;
- limitación honesta: el contenedor de ChatGPT no puede clonar GitHub por DNS ni ejecutar el backend local del usuario/Yahoo cache; por eso el **E2E exacto del repo** es ahora un paso obligatorio dentro del job local **antes de descargar/abrir economía REAL**, no una prueba manual delegada al usuario;
- sello R3: `validation-runs/preregistration/sector-52w-high-leadership-v1-execution-seal.json`; local job R3: `validation-runs/preregistration/sector-52w-high-leadership-v1-local-job.json`; evidencia de invalidación: `validation-runs/diagnostics/sector-52w-high-leadership-v1-first-run-technical-invalid-2026-09-28.json`;
- **no pedir al usuario otra ejecución como mecanismo de testing**. Estado: `NO_VALID_ECONOMIC_VERDICT`; producción continúa **LEGACY**, sin autoridad productiva ni cambios en la cadena de decisión.


---

Actualización 2026-09-28 — SECTOR_52W_HIGH_LEADERSHIP_V1 R3 cierre técnico PASS:

- revisión vigente: `SECTOR_52W_HIGH_LEADERSHIP_V1_VALIDATED_R3_2026_09_28`;
- los dos exports anteriores continúan **ANULADOS / NO ECONOMIC VERDICT**; replicación 2019-2025 permanece **UNOPENED**;
- verificación técnica adicional ejecutada sobre los blobs exactos actuales de `main`:
  - protocolo exacto: **PASS 16 checks**;
  - runner exacto evaluado con fixture de rotación: **72 eventos / 22 composiciones distintas / economics finitos**;
  - fixture fuerte: diagnóstico **PASS**, replicación **PASS**, bootstrap lower bound > 0 en ambos bloques, hit-rate observado conjunto **100%/100%**;
  - corporate-actions guard exacto: **PASS**, caso deliberadamente roto rechazado;
  - NAV guard exacto: **PASS**, referencia oficial exacta pasa y +25 pb falla con tolerancia ±0,20 pp/año;
  - integración del job: todos los pasos presentes y ordenados; **E2E antes de Yahoo**; UI muestra rev. técnica 3 + implementationRevision;
- evidencia machine-readable: `validation-runs/diagnostics/sector-52w-high-leadership-v1-r3-technical-verification-2026-09-28.json`;
- estado técnico: **PASS_R3_TECHNICAL_VERIFICATION_READY_FOR_SINGLE_REAL_ECONOMIC_RUN**;
- limitación restante: ChatGPT no puede ejecutar el backend local/Yahoo cache del usuario; por ello el único paso externo pendiente es **una ejecución REAL** del job local, no otra prueba manual;
- siguiente acción permitida: sincronizar al HEAD vigente y ejecutar **una sola vez** `Precio · liderazgo sectorial 52W · V1 · rev. técnica 3`. El job ejecuta revisión/unit/causal/E2E/runtime/arquitectura/TypeScript/corporate-actions/NAV antes de economía;
- producción continúa **LEGACY** y no se autoriza retuning.


---

Actualización 2026-09-28 — SECTOR_52W_HIGH_LEADERSHIP_V1 diagnóstico económico válido FAIL:

- ejecución válida recibida con `implementationRevision=SECTOR_52W_HIGH_LEADERSHIP_V1_VALIDATED_R3_2026_09_28`, provider `YAHOO_FINANCE` e input hash congelado `35d30e16609099e0d852e744753fd74edd0989126931174608113f6b242b825f`;
- estado canónico: **FAIL_DIAGNOSTIC**. Éste sí sustituye a los dos exports técnicos inválidos anteriores;
- diagnóstico 20 pb/lado, 2013-01-02 -> 2019-01-02:
  - candidata CAGR **10,1157%**;
  - SPY **11,3116%** => exceso **-1,1959 pp/año**;
  - URTH **7,1922%** => exceso **+2,9235 pp/año**;
  - basket9 equiponderado **10,2581%** => exceso **-0,1424 pp/año**;
  - control sector 12-2 **9,4761%** => V1 52W mejora **+0,6396 pp/año** frente al control, pero no supera los hurdles primarios;
  - max drawdown candidata **-20,5044%** vs URTH **-18,8925%** => gate de drawdown FAIL;
  - Sharpe candidata **0,8181** vs URTH **0,5329** => gate Sharpe PASS;
  - hit-rate anual conjunto SPY+URTH: **2/6 = 33,33%**;
  - selector incremental vs basket9 HAC12: alpha mensual **-0,0476%**, t-stat **-0,609**, sin evidencia de valor incremental;
  - turnover sobre capital inicial **24,2626x**; coste a 20 pb/lado **0,0485253**, reconciliación aritmética exacta;
- gates 20 pb: FAIL vs SPY, PASS vs URTH, FAIL vs basket9, FAIL drawdown, PASS Sharpe => gate conjunto FAIL;
- incluso a 10 pb/lado sigue FAIL vs SPY y drawdown; no existe rescate por coste bajo;
- conforme al preregistro: **replicación 2019-2025 NO SE ABRE**; `statistics=null`; `userFrequencyTarget=null`;
- interpretación metodológica: no declarar inútil toda la información de máximos/sector; esta política long-only concreta no demuestra ventaja suficiente frente al core/controles. El ligero diferencial frente a 12-2 no autoriza retuning;
- `SECTOR_52W_HIGH_LEADERSHIP_V1` queda **CERRADA / NO RETUNE / NO V2 PARAMÉTRICA** sobre estas muestras;
- resultado canónico: `validation-runs/diagnostics/sector-52w-high-leadership-v1-result.json`;
- producción continúa **LEGACY**; Quality/Profitability se conservan sin cambios;
- siguiente línea permitida: hipótesis **materialmente distinta**, con preregistro propio. Prioridad de estudio: PEAD / reacción tardía a sorpresa de resultados, empezando por demostrar disponibilidad causal de evento + consenso previo + before/after-market antes de cualquier outcome.


---

Actualización 2026-09-28 — transición a PEAD source audit V1:

- `SECTOR_52W_HIGH_LEADERSHIP_V1` permanece **CLOSED / FAIL_DIAGNOSTIC / NO RETUNE**; job 52W archivado en `ResearchValidationCenter` para impedir relanzamientos accidentales;
- siguiente familia materialmente distinta: PEAD / reacción tardía a sorpresa de resultados; no hereda parámetros ni muestras de 52W;
- antes de cualquier backtest se ha congelado `PEAD_EARNINGS_SOURCE_AUDIT_V1`: sólo audita si existe materia prima causal suficiente, **sin descargar precios ni outcomes**;
- plan: `docs/CORE_OUTPERFORMANCE_PEAD_SOURCE_AUDIT_PLAN_2026-09-28.md`;
- fuente prevista: EODHD Calendar Earnings + S&P500 HistoricalTickerComponents `GSPC.INDX`, reutilizando infraestructura PIT ya existente;
- contrato documental EODHD revisado: `report_date`, `before_after_market`, EPS `actual`, consenso `estimate`, `difference`, `percent`; EODHD describe el estimate como previo al release, pero no se asume un archivo de vintages de consenso con autoridad prospectiva;
- ventana source-audit congelada: **2024-01-15 -> 2024-03-15**; no se examinan retornos;
- gates congelados antes del feed: >=200 eventos S&P500 PIT, >=70% timing conocido, >=70% actual+consenso, >=150 causalmente utilizables, 0 duplicados, 0 inconsistencias materiales de `actual-estimate`;
- tolerancia de diferencia EPS congelada: `max(0,005; 0,01% relativo)`;
- parser/audit: `scripts/peadEarningsSourceAuditV1.mjs`; unit: `tests/peadEarningsSourceAuditV1.unit.mjs`;
- fixture exacto de parser ejecutado en runtime JS: **PASS**, 220/220 eventos PIT/causales; discrepancia deliberada rechazada;
- job integrado: `pead-earnings-source-audit-v1` / **PEAD · auditoría causal de datos · V1**; ejecuta unit -> runtime guard -> core architecture -> TypeScript -> audit EODHD REAL;
- 52W se movió a histórico del Centro de validación con estado `FAIL_DIAGNOSTIC · cerrado`;
- sello pre-live: `validation-runs/preregistration/pead-earnings-source-audit-v1-seal.json`; `economicOutcomesOpened=false`, `priceOutcomesFetched=false`, señal/política económica todavía NO congeladas;
- limitación operativa real: `EODHD_API_KEY` está sólo en el backend local y no es accesible desde este chat. No pedir/pegar secretos; el audit live debe correr dentro del backend local cuando corresponda;
- si el audit live devuelve `INCONCLUSIVE_SOURCE_CAUSALITY`, PEAD se bloquea sin abrir precios. Sólo un `PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION` permite diseñar/congelar la prueba predictiva;
- producción continúa **LEGACY**, sin cambios en la cadena productiva.


---

Actualización 2026-09-29 — ResearchValidationCenter simplificado a una única línea activa visible:

- problema corregido: el Centro había acumulado demasiadas tarjetas simultáneas aunque varias investigaciones sólo estuvieran bloqueadas, esperando ventana o recopilando evidencia en paralelo;
- inventario técnico en `server/researchValidationRoutes.ts`: 27 definiciones históricas/operativas acumuladas; la evidencia y runners se conservan, pero **no deben equivaler a 27 elementos visibles**;
- regla de producto desde ahora: **máximo una investigación `CURRENT` visible en ResearchValidationCenter**;
- línea activa visible actual: `pead-earnings-source-audit-v1` / PEAD · auditoría causal de datos · V1;
- `fundamental-quality-valuation-broad-pit-v1`, `phase6-forward-risk-context-stage-a-r2-readiness` y `quality-allocation-dynamic-future-forward-v1` pasan a `PARKED`: conservan implementación, estado y posibilidad de retomarse, pero no aparecen como tarjetas ni botones en la pantalla principal;
- los jobs cerrados continúan `ARCHIVED` dentro del histórico colapsado; no se duplican pantallas ni motores;
- guard añadido en `tests/researchValidationRuntime.unit.ts`: exige exactamente **1** `visibility: 'CURRENT'` y mantiene líneas paralelas como `PARKED`;
- esta simplificación es de superficie/UI y priorización; no cambia resultados, muestras, políticas, producción `LEGACY` ni `CORE_ARCHITECTURE_V1`.


---

Actualización 2026-09-29 — PEAD source audit endurecido sin abrir outcomes:

- `pead-earnings-source-audit-v1` continúa como **única línea CURRENT visible**; no se añade ninguna tarjeta/job visible nuevo;
- el transporte de membresía PIT se cambia técnicamente al Fundamentals API documentado de EODHD para `GSPC.INDX` + `filter=HistoricalTickerComponents`; la semántica del universo no cambia;
- el parser acepta tanto la sección filtrada directa como una respuesta envuelta en `HistoricalTickerComponents`;
- la caché de componentes usa una identidad nueva para impedir reutilizar accidentalmente una respuesta del endpoint heredado;
- el unit cubre ambas formas de payload;
- el job PEAD declara ahora `requiresEodhdApiKey=true`, por lo que el preflight bloquea antes de guards/descargas si falta la clave;
- el mensaje de prerequisite del Centro queda específico para EODHD / SEC / GitHub token y deja de mostrar instrucciones erróneas de otro requisito;
- EODHD documenta que `HistoricalTickerComponents` del S&P 500 contiene StartDate/EndDate y que el Calendar Earnings expone `report_date`, `before_after_market`, `actual`, `estimate`, `difference` y `percent`;
- **no se han descargado precios, no se han abierto outcomes y no se ha cambiado ningún gate** de PEAD;
- siguiente transición metodológica sigue siendo condicional: sólo un `PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION` permite congelar la prueba predictiva;
- producción permanece `LEGACY`.


---

Actualización 2026-09-29 — PEAD no se entrega hasta prueba REAL propia:

- criterio de trabajo reafirmado: una investigación nueva **no se muestra al usuario para que la pruebe**; primero debe pasar los tests que ChatGPT pueda ejecutar y, cuando requiera datos privados del backend, sólo se entrega tras una ejecución REAL válida;
- `pead-earnings-source-audit-v1` pasa de `CURRENT` a **`PARKED`** mientras `liveEodhdAudit = NOT_RUN`; por tanto el Centro puede mostrar **cero** líneas activas;
- el guard general cambia de “exactamente una” a **máximo una** línea `CURRENT`;
- unit exacto del parser ejecutado por ChatGPT: **PASS**;
- casos adversos añadidos y ejecutados: timing desconocido, consenso ausente, duplicado, inconsistencia de difference y evento fuera del intervalo PIT => todos bloquean/excluyen según contrato;
- ejecución sin `EODHD_API_KEY`: **PASS fail-closed**, devuelve `BLOCKED`, `economicOutcomesOpened=false` y producción `LEGACY`;
- se detectó y corrigió antes de live una debilidad real: el sello pre-live había quedado desactualizado tras el endurecimiento técnico de fuente;
- nuevo guard `tests/peadEarningsSourceAuditV1Seal.unit.mjs`: verifica fingerprints, ausencia de outcomes, autoridad LEGACY, endpoint Fundamentals documentado y estado PARKED pre-live;
- fingerprints del sello contrastados directamente contra los blobs actuales de `main`: **todos MATCH**;
- EODHD confirma documentalmente que `HistoricalTickerComponents` de `GSPC.INDX` reconstruye membresía desde abril de 2012 y que Calendar Earnings expone report date, before/after market, actual y estimate;
- pendiente único para poder decir “funciona”: **ejecución REAL del source audit con la `EODHD_API_KEY` privada del backend**;
- esa clave no está disponible en el runtime de este chat y no se pedirá ni se expondrá;
- hasta que el live audit no exista y pase, PEAD **no se considera entregado/probado** y permanece oculto;
- producción continúa `LEGACY`.


---

Actualización 2026-09-29 — regla operativa de testing antes de pedir ejecución al usuario:

- ChatGPT debe **probar primero por sí mismo** toda modificación o investigación con todas las herramientas y runtimes accesibles;
- esto incluye, según aplique: unit tests, guards, seal/fingerprints, TypeScript, fixtures adversos, validación causal, parsers y cualquier fuente/live runtime accesible;
- objetivo: ver el fallo real, reproducirlo y corregirlo antes de pedir intervención externa;
- sólo si queda un bloqueo que dependa exclusivamente del runtime privado del usuario (por ejemplo API key no accesible desde este chat, backend local privado o proveedor sólo disponible allí) se puede pedir una ejecución manual;
- en ese caso la ejecución del usuario es **un mecanismo de transporte de evidencia**, no una delegación del testing: debe ser una única acción concreta y mínima;
- el usuario devuelve la salida/result JSON y ChatGPT continúa el diagnóstico, reparación y nueva verificación;
- no pedir ejecuciones repetidas sin una causa técnica nueva y explícita;
- no presentar como “probado/listo” algo que no haya pasado la prueba REAL necesaria.


---

Actualización 2026-09-29 — PEAD self-tests agotados; única ejecución REAL externa autorizada:

- HEAD de trabajo previo a esta entrada incluye integración/test endurecido de `PEAD_EARNINGS_SOURCE_AUDIT_V1`;
- ChatGPT ejecutó el **código exacto** del parser/unit en Node: `PEAD_EARNINGS_SOURCE_AUDIT_V1_UNIT_PASS`;
- ejecución exacta sin `EODHD_API_KEY`: fail-closed correcto, `BLOCKED / PEAD_SOURCE_EODHD_API_KEY_NOT_CONFIGURED`, `economicOutcomesOpened=false`, producción `LEGACY`;
- integración end-to-end sin red ejecutada por ChatGPT con `fetch` EODHD simulado:
  - 220 eventos PIT/causales => `PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION`;
  - 100 eventos => `INCONCLUSIVE_SOURCE_CAUSALITY`, gates de cobertura FAIL y ningún outcome abierto;
- el test de integración queda incorporado al repo como `tests/peadEarningsSourceAuditV1.integration.mjs` y se ejecuta antes de cualquier llamada REAL;
- orden live vigente: seal -> unit -> integración sin red -> runtime guard -> core architecture -> TypeScript -> EODHD REAL;
- se detectó y corrigió antes del live otro fallo real del runner: un exit code no cero (por ejemplo INCONCLUSIVE válido) descartaba `job.result`; ahora el JSON marcado se extrae y conserva también en esa ruta;
- fingerprints del seal fueron reseñados tras cada cambio metodológicamente neutro y contrastados contra los blobs actuales de `main`;
- se intentó alcanzar directamente el host desplegado de AI Studio/Cloud Run desde el runtime de ChatGPT, pero este entorno no puede resolver/acceder ese host privado; por tanto no puede utilizar la `EODHD_API_KEY` configurada allí;
- agotadas las pruebas accesibles a ChatGPT, queda autorizada **una única ejecución manual mínima** como transporte de evidencia: sincronizar el HEAD vigente y pulsar `Ejecutar audit REAL PEAD`;
- el usuario no debe interpretar ni depurar el resultado: debe devolver a ChatGPT la salida/result JSON y ChatGPT continuará el análisis/corrección;
- no repetir la ejecución salvo que ChatGPT identifique una causa técnica nueva;
- no avanzar a señal ni precios PEAD hasta obtener el veredicto de fuente REAL;
- producción continúa `LEGACY`.


---

Actualización 2026-09-29 — primera ejecución PEAD invalidada por contaminación de fixture; runner corregido:

- evidencia recibida del job `pead-earnings-source-audit-v1` iniciado `2026-09-29T15:47:51.244Z` y terminado `2026-09-29T15:47:53.323Z`;
- el JSON exportado mostraba `FAILED` + `INCONCLUSIVE_SOURCE_CAUSALITY` con exactamente 250 component intervals, 100 earnings, 50 BeforeMarket y 50 AfterMarket;
- análisis forense: los dos `sourceHashes` exportados coinciden **exactamente byte a byte** con los fixtures de `tests/peadEarningsSourceAuditV1.integration.mjs`:
  - historical components: `be2bdaf5a358a270e43c2fe3b89ffed25904f0c1bbc7407639cadda45307c381`;
  - earnings calendar: `0fe5b66494b644cf2d41384c7d31bc251cdb109d15bfa08c3cd658c877225d87`;
- SHA-256 del artefacto recibido: `b7859d8ca2bf64cb82cf83b2e2cb7bf73f6e66a0e862193bf153233725b15374`;
- conclusión: la corrida se clasifica **INVALID_TEST_ARTIFACT**; no fue evidencia REAL de EODHD, no consume muestra PEAD y no autoriza ninguna interpretación de señal;
- causa del corte: `tests/researchValidationRuntime.unit.ts` todavía exigía rutas ejecutables del estudio sectorial 52W después de haber sido movido a `ARCHIVED`; el guard fallaba después de la integración offline;
- bug adicional del runner: ante ese fallo, extraía el último marcador desde stdout acumulado y heredaba el resultado del fixture anterior;
- correcciones:
  - runtime guard alineado con 52W archivado; ya no exige sus runners retirados;
  - un fallo sólo puede extraer evidencia del stdout del **mismo step** que falla;
  - la integración PEAD captura internamente los logs de `main()` y no emite el marcador oficial del fixture al stream del job;
  - el JSON de evidencia exporta ahora también `exitCode` y `error`;
  - evidencia de invalidación persistida en `validation-runs/diagnostics/pead-earnings-source-audit-v1-invalid-run-2026-09-29.json`;
- verificación independiente sobre `main`: runtime guard equivalente **PASS**, cero referencias ejecutables antiguas de 52W, aislamiento de evidencia **PASS**, fingerprints del seal **todos MATCH**;
- `liveEodhdAudit` continúa **NOT_RUN**;
- siguiente acción permitida: una única repetición del audit REAL con el HEAD corregido; no abrir precios ni señal antes;
- producción continúa `LEGACY`.


---

Actualización 2026-09-29 — PEAD source audit cerrado sin EODHD de pago:

- la segunda ejecución manual del job llegó correctamente al último step y devolvió `HTTP 403` de EODHD Fundamentals: la cuenta configurada sólo permite EOD gratuito;
- clasificación: **`BLOCKED_PROVIDER_ENTITLEMENT`**, no fallo de arquitectura/app; aun así era evitable y desde ahora la compatibilidad del plan/proveedor debe verificarse antes de pedir una ejecución privada;
- evidencia del bloqueo: `validation-runs/diagnostics/pead-earnings-source-audit-v1-eodhd-blocked-2026-09-29.json`;
- el bloqueo no abrió precios/outcomes, no consume muestra y no cambia producción;
- EODHD se elimina por completo del camino PEAD; no se pide otra ejecución al usuario;
- sustitución pre-outcome congelada: **`YAHOO_STATIC_DUAL_PIT_R1`** con procedencia explícita `STATIC_REFERENCE`;
- earnings: `vivek-v-rao/Earnings-Dates` commit `7ed98a0e2497b0a83bcbc290db41705089768c16`, blob `abde11f719e93dc427a1040ffed3f0b8590b8508`;
- PIT A: `fja05680/sp500` commit `a2430f2af0c79ddf0748e91de11bdeb1616ab5a7`, blob `3ed3b0e8d9e6e63730c153ee1f13ddaf6ed281bb`;
- PIT B: `lawcal/sp500-components-history` commit `2e59b86998a119d68e377f9f98aa7a816cfc7d5b`, blob `6a865618173f322ecda9a569bc6bd48edcfaf996`;
- un evento sólo entra si el ticker histórico está activo simultáneamente en ambas reconstrucciones PIT; una sola fuente nunca puede ampliar el universo;
- única discrepancia detectada en la ventana: `FISV` 2024-02-06, lawcal-only por tratamiento de alias; excluida. La reconstrucción fja registra `FISV -> FI` en 2023;
- timing Yahoo causal: <09:30 ET `BeforeMarket`; 09:30-15:59 `DuringMarket` excluido; >=16:00 ET `AfterMarket`;
- integridad de sorpresa: no se fuerza igualdad porcentual entre EPS redondeados a 0,01 y `Surprise(%)`; se exige cero contradicciones direccionales cuando los EPS redondeados difieren;
- resultado exacto del audit estático:
  - 150.983 earnings en snapshot;
  - 2.141 en ventana 2024-01-15 -> 2024-03-15;
  - 463 eventos por intersección PIT;
  - 462/463 timing conocido = 99,784%;
  - 462/463 actual + estimate = 99,784%;
  - 461 causalmente utilizables;
  - 259 BeforeMarket, 203 AfterMarket, 1 DuringMarket excluido;
  - 1 actual ausente;
  - 0 duplicados;
  - 0 contradicciones direccionales;
- todos los gates cuantitativos congelados previamente pasan sin relajación: **`PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION`**;
- evidencia persistida en `validation-runs/diagnostics/pead-earnings-source-audit-v1-result.json`;
- el runner verifica los tres blobs por commit + Git blob SHA y falla cerrado ante cualquier cambio;
- durante la revisión previa ChatGPT detectó y corrigió escapes dobles generados en regex/byte NUL del runner antes de entregar el cambio al usuario;
- seal reseñado con fingerprints de metodología + evidencia; contraste final: todos MATCH;
- `pead-earnings-source-audit-v1` queda **ARCHIVED**; ResearchValidationCenter vuelve a **0 líneas CURRENT** y no existe acción manual PEAD source;
- `priceOutcomesFetched=false`, `economicOutcomesOpened=false`, `productionDefault=LEGACY`, `productionAuthority=false`;
- siguiente paso autorizado: preregistrar **una sola** prueba de calidad predictiva PEAD antes de abrir precios.


---

Actualización 2026-09-29 — segunda ejecución PEAD: bloqueo de proveedor confirmado, fallback estático verificado independientemente:

- evidencia recibida del job iniciado `2026-09-29T16:12:00.574Z` y terminado `2026-09-29T16:12:30.893Z`;
- esta vez el runner llegó correctamente al último step `EODHD REAL · auditar causalidad PEAD`;
- EODHD respondió HTTP 403: `Only EOD data allowed for free users`; causa = entitlement de la cuenta configurada, no fallo del runner ni de la aplicación;
- la documentación actual de EODHD confirma que el plan Free sólo incluye EOD limitado y que Fundamentals/índices históricos requieren acceso de pago;
- no se abrió ningún precio/outcome y la corrida no consume muestra;
- antes de abrir precios se sustituyó EODHD por `YAHOO_STATIC_DUAL_PIT_R1`: earnings Yahoo pinneados + intersección de dos reconstrucciones PIT S&P 500 pinneadas;
- ChatGPT reprodujo de forma independiente el audit leyendo directamente los tres blobs GitHub por SHA, sin reutilizar el JSON de resultado ni llamar al runner PEAD;
- reproducción independiente exacta:
  - raw earnings = 150983;
  - ventana = 2141;
  - PIT fja = 463;
  - PIT lawcal = 464;
  - intersección PIT = 463;
  - timing conocido = 462;
  - actual+estimate = 462;
  - causal eligible = 461;
  - BeforeMarket = 259;
  - AfterMarket = 203;
  - DuringMarket = 1 (APA 2024-02-21);
  - missing actual = 1 (PNW 2024-02-27);
  - duplicados = 0;
  - contradicciones direccionales = 0;
  - rounded-equal/provider-surprise = 23;
  - único desacuerdo PIT = FISV 2024-02-06 lawcal-only, excluido por intersección;
- los tres blob SHA obtenidos directamente coinciden con los pins congelados;
- por tanto `PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION` queda independientemente reproducido;
- el siguiente `PEAD_ANALYST_SURPRISE_V1` está preregistrado y sellado pero permanece **PARKED**;
- los 9 fingerprints del seal de señal coinciden con `main`; `priceOutcomesOpened=false`, `economicPolicyOpened=false`, producción `LEGACY`;
- no se pide ninguna acción manual al usuario en este estado; el live de señal sólo debe abrirse tras completar la verificación previa de su runner.


---

Actualización 2026-09-30 — bloqueo EODHD confirmado; PEAD signal preregistration endurecido antes de outcomes:

- artefacto REAL recibido del usuario para `pead-earnings-source-audit-v1`: el runner alcanzó el último step `EODHD REAL · auditar causalidad PEAD` y EODHD devolvió HTTP 403 `Only EOD data allowed for free users`;
- conclusión: **no es un fallo de la app ni del runner**; es un bloqueo de entitlement del proveedor para `HistoricalTickerComponents`;
- el runner exportó correctamente `exitCode=1`, `error=Falló: EODHD REAL · auditar causalidad PEAD` y `result.status=BLOCKED`; no se abrieron outcomes y producción siguió `LEGACY`;
- EODHD no se volverá a usar como dependencia de este audit mientras el plan actual no autorice ese endpoint;
- la alternativa ya integrada `YAHOO_STATIC_DUAL_PIT_R1` permanece como fuente cerrada/reproducible y ya había sido reproducida independientemente antes de abrir precios;
- revisión preventiva del siguiente runner `PEAD_ANALYST_SURPRISE_V1` detectó gates demasiado permisivos (signo positivo sin control de significancia);
- **antes de abrir cualquier precio**, el preregistro fue endurecido:
  - horizonte único permanece 60 sesiones;
  - benchmark permanece SPY;
  - cobertura mínima permanece 415/461;
  - se añaden 2.000 permutaciones deterministas intra-semana de anuncio;
  - semilla congelada = 20260929;
  - PASS exige además p-value unilateral < 0,05 para Spearman y para el spread Q5-Q1;
  - no se abre ningún horizonte alternativo ni se retunea tras outcomes;
- ChatGPT ejecutó directamente el bloque estadístico real del runner actual:
  - fixture positivo fuerte => PASS; p Spearman = 0,00049975; p spread = 0,00049975;
  - fixture invertido => FAIL;
  - fixture nulo => FAIL;
- seal de señal reseñado; todos sus fingerprints coinciden con los blobs actuales de `main`;
- la fuente cerrada sigue `priceOutcomesFetched=false` y `economicOutcomesOpened=false`;
- `pead-analyst-surprise-v1` continúa **PARKED**;
- líneas `CURRENT` visibles = 0;
- `livePriceDiagnostic = NOT_RUN`;
- no se pide acción manual al usuario en este estado;
- producción continúa `LEGACY`.
