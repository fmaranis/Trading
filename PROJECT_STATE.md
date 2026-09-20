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
FASE 6  FORWARD RISK V8 COMO CONTEXTO         V1 CONSUMED TECHNICAL FAIL · R2 SEALED · COLLECTOR ACTIVATED · NOT OPENED
FASE 7  QUALITY FUTURE FORWARD                WAITING/COLLECTING en paralelo
FASE 8  UNIVERSO HISTÓRICO POINT-IN-TIME      PENDIENTE
FASE 9  AUDITORÍA END-TO-END / CIERRE V1      PENDIENTE
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

R2 se congeló el 2026-09-20 **antes de abrir mercado R2**:

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

### Siguiente paso exacto

1. sincronizar la app al HEAD que contenga esta activación;
2. comprobar que `GITHUB_REPLAY_SYNC_TOKEN` está configurado;
3. ejecutar únicamente `Fase 6 · Forward Risk V8 como contexto · R2 collector`;
4. si todos los guards y TypeScript pasan, esa ejecución **abre/consume R2** y debe persistir `OPENED_COLLECTING` antes de la primera llamada de mercado;
5. verificar que el resultado tenga `outcomeAccessed:false`, contexto V5/V7 materializado para cada fecha y persistencia en `replay-results/validation-runs/phase6-forward-risk-context-stage-a-r2-state.json`;
6. no ejecutar evaluator de outcomes de 63 sesiones durante collection;
7. producción permanece `LEGACY`.


---

# 7. QUALITY FUTURE FORWARD

`QUALITY_ALLOCATION_BRIDGE_V1` continúa research-only. La evidencia prospectiva dinámica sigue su calendario propio y no autoriza cambio productivo hasta completar el protocolo correspondiente.

No usar esta vía para modificar Fase 6 ni viceversa.

---

# 8. FASE 8 — UNIVERSO HISTÓRICO POINT-IN-TIME

Sigue pendiente un instrument master histórico con listings, delistings, cambios de ticker/mercado y disponibilidad por fecha.

Hasta disponer de él:

- no afirmar que el replay histórico reconstruye el mercado completo de cada fecha;
- current Yahoo discovery no puede usarse retrospectivamente;
- survivorship permanece limitación explícita.

---

# 9. DEFERRED / RETIRED

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

# 10. CRITERIO DE CIERRE V1

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
