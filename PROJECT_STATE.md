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

---

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
