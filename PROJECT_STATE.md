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
FASE 6  FORWARD RISK V8 COMO CONTEXTO         STAGE A FUTURE-FORWARD FROZEN · RUNNER SEALED PRE-OPEN · NOT OPENED
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

## 6.4 Collector/evaluator/state — implementados pero NO abiertos

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
- evaluator está separado y no tiene autoridad productiva.

## 6.5 Seal pre-open

Seal:

`validation-runs/preregistration/phase6-forward-risk-context-stage-a-seal.json`.

Guard:

`tests/phase6ForwardRiskContextStageASeal.unit.ts`.

El seal fija 20 archivos críticos por Git blob SHA-1 y registra:

- `sampleOpened=false`;
- `marketOutcomesOpened=false`;
- producción `LEGACY`;
- no policy económica;
- sample/gates/continuity exactos.

El guard verifica además:

- fingerprints;
- durable OPENED marker antes de mercado;
- causal cutoff por `informationDate`;
- collector sin acceso a outcomes;
- `currentOpenDiscovery=false`;
- hash chain / inmutabilidad;
- evaluator puro;
- collector live todavía no conectado al Centro de validación.

## 6.6 Estado exacto ahora

**STAGE A FUTURE-FORWARD FROZEN / RUNNER+STATE SEALED FOR STATIC VALIDATION / NOT OPENED / NO MARKET OUTCOMES OPENED / RESEARCH ONLY / PRODUCTION LEGACY.**

El `ResearchValidationCenter` sigue ejecutando sólo el job estático:

`Fase 6 · Forward Risk V8 como contexto · readiness`.

`tests/phase6ForwardRiskContextReadiness.unit.ts` importa primero el seal guard, por lo que la siguiente ejecución debe mostrar:

1. `PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_SEAL_PASS`;
2. `PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_FREEZE_PASS`;
3. guards arquitectura/gate/paridad/superficie;
4. TypeScript.

El collector REAL **NO está cableado** en el job y no debe ejecutarse manualmente.

### Siguiente paso exacto

1. sincronizar la app al HEAD que contenga este estado;
2. ejecutar sólo `Fase 6 · Forward Risk V8 como contexto · readiness`;
3. si seal/readiness/arquitectura/TypeScript pasan, habilitar en un cambio posterior el collector REAL con requisito de `GITHUB_REPLAY_SYNC_TOKEN`;
4. la primera ejecución live marcará la muestra `OPENED_COLLECTING` durable antes de acceder a mercado;
5. no leer outcomes de 63 sesiones durante signal collection.

No ejecutar el collector REAL en el mismo cambio que introduce el seal.

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
