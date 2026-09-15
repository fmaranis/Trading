# APP TRADING — FLUJO MAESTRO Y ROADMAP DE CIERRE

Estado: **CANÓNICO PARA ORGANIZACIÓN DEL TRABAJO**  
Fecha base: **2026-09-15**  
Repositorio: `fmaranis/Trading`  
Rama: `main`

Este documento organiza la aplicación y la ruta de cierre del proyecto. No sustituye al código ni a `PROJECT_STATE.md`; ambos deben mantenerse coherentes con este mapa.

Si existe conflicto, prevalece:

1. `fmaranis/Trading/main`;
2. HEAD actual;
3. `PROJECT_STATE.md`;
4. este documento;
5. chats y resúmenes históricos.

---

## 1. Objetivo final del producto

La app debe responder de forma integrada, utilizando una única cadena de decisión:

- qué hacer hoy;
- qué activo comprar, mantener, reducir o vender;
- qué importe asignar;
- por qué;
- cómo está la cartera;
- qué oportunidades existen;
- qué riesgo existe;
- cómo ejecutar la decisión teniendo en cuenta cash, títulos enteros, broker, costes y fiscalidad;
- cómo registrar y seguir la operación real;
- cómo habría actuado históricamente la misma arquitectura de forma causal;
- cómo continuar funcionando de forma privada y persistente aunque el navegador concreto del usuario no sea la única fuente de estado.

La app **no** debe evolucionar hacia una colección de motores, pantallas, replays o investigaciones independientes.

---

## 2. Invariantes que no se pueden romper

- Arquitectura productiva: `CORE_ARCHITECTURE_V1`.
- Una sola cadena productiva desde discovery hasta ejecución y seguimiento.
- Producción mantiene allocation/opportunity `LEGACY` hasta evidencia fresh suficiente.
- `CORE_ELIGIBILITY_V2` permanece shadow.
- Forward Risk no modifica producción en su estado actual.
- Los jobs research no crean una segunda recomendación productiva.
- Replays largos se ejecutan en el motor local/backend de la app, nunca en GitHub Actions.
- Guards, unit tests y TypeScript deben pasar antes de cálculos largos.
- Procedencia siempre explícita: `REAL / STATIC_REFERENCE / SYNTHETIC`.
- Una validación REAL falla si aparece información sintética.
- Replay causal y ejecución posterior a señal; `NEXT_OPEN` cuando corresponde.
- `DAILY/WEEKLY/MONTHLY/QUARTERLY` = frecuencia de revisión, no aportaciones.
- `stagedCapitalPlan` = capital ya disponible, no dinero recurrente.
- Aportaciones/retiradas = `externalCashFlows` explícitos y fechados.
- No retunear una política después de ver el resultado en la misma muestra.
- Una muestra usada para diseñar/interpretar una política queda consumida para promoción.
- Fases 4–6 quedan sometidas a `docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md` antes de abrir cualquier muestra nueva.
- Un `PASS_CANDIDATE_FOR_CONFIRMATION` no cambia producción: exige confirmación independiente con la política exacta congelada.
- La confirmación Fase 5 no puede re-seleccionar activos o cohortes a partir del primer PASS.
- Tras una confirmación FAIL, la política exacta probada no se retunea sobre las muestras consumidas.
- Fase 6 separa primero información de señal de cualquier política económica nueva.
- No crear un nuevo apartado, job, motor o replay si la capacidad cabe en un flujo existente.
- No rehacer infraestructura operativa ya validada si basta una mejora selectiva.
- Cubetos/Muros y Trading permanecen **completamente independientes**; Cubetos/Muros sólo puede servir como referencia técnica.

---

# 3. Diagrama maestro de la aplicación

```mermaid
flowchart TD
    U[Usuario / estado privado<br/>cartera · cash · riesgo · horizonte<br/>aportaciones · fiscalidad] --> AUTH[Autenticación / autorización<br/>Firebase Auth + claims propios de Trading]
    AUTH --> STATE[Estado privado por UID<br/>Firestore propio de Trading + caché aislada]

    M[Mercado actual REAL<br/>Yahoo / NAV fondos] --> SCAN[AssetUniverseScanner<br/>discovery + calidad de datos]
    SCAN --> TOP[Top64 dinámico<br/>MARKET_SHORTLIST_LEGACY_SCORE_V1]
    TOP --> GATE[PortfolioCandidateGate<br/>cash hurdle · consenso · caps]
    GATE --> IDE[InvestmentDecisionEngine<br/>timing · oportunidad · sizing teórico]

    STATE --> HEALTH[PortfolioPositionHealth<br/>ADD · HOLD · WATCH · REDUCE · EXIT]
    IDE --> PDE[PortfolioDecisionEngine<br/>evaluatePortfolioDecision]
    HEALTH --> PDE
    PDE --> CG[CORE_GATE_V1]
    CG --> CA[CORE_ARCHITECTURE_V1<br/>allocation productiva LEGACY]
    CA --> PLAN[Plan ejecutable único<br/>buildPortfolioExecutionPlan]
    PLAN --> TAX[Overlay ejecución<br/>broker · títulos enteros · costes · fiscalidad]
    TAX --> ACTION[COMPRAR / VENDER / TRASPASAR / REVIEW<br/>o NO HACER NADA]
    ACTION --> EXEC[Ejecución manual real<br/>registro de operación]
    EXEC --> STATE
    STATE --> FOLLOW[Seguimiento<br/>retorno · MFE · giveback · salud]
    FOLLOW --> HEALTH

    REPLAY[Replay histórico integrado<br/>Desde cero / manual / cartera actual<br/>Custodia / mantener cartera] -. misma cadena conceptual .-> GATE
    REPLAY --> EVID[JSON · métricas · benchmarks<br/>BCE histórico · fiscalidad · flujos]

    RVC[ResearchValidationCenter<br/>guards · tests · research · Future Forward] -. valida; no decide por producto .-> SCAN
    RVC -. valida; no decide por producto .-> PDE

    SCHED[Scheduler / invocación backend] --> ALERT[POST /api/alerts/run-now]
    ALERT --> ENTRY[Oportunidades de entrada<br/>motor compartido + dedupe]
    ALERT --> PM[Portfolio management alerts<br/>estado privado de cartera]
    ENTRY --> NOTIF[Telegram / webhook]
    PM --> NOTIF
```

La lectura funcional es:

1. **DÓNDE** — discovery current/live + Top64 dinámico.
2. **CUÁNDO** — gates, consenso y timing.
3. **CUÁNTO** — portfolio decision + allocator + límites.
4. **POR QUÉ / CÓMO EJECUTAR** — evidencia, plan ejecutable, costes, broker, fiscalidad y seguimiento.

`NO HACER NADA` sigue siendo una respuesta válida.

---

# 4. Flujo productivo actual

```text
mercado REAL actual
→ AssetUniverseScanner
→ Top64 dinámico
→ PortfolioCandidateGate
→ InvestmentDecisionEngine
→ PortfolioDecisionEngine / evaluatePortfolioDecision
→ CORE_GATE_V1
→ CORE_ARCHITECTURE_V1
→ buildPortfolioExecutionPlan
→ applyTaxAwareExecutionOverlay
→ COMPRAR / VENDER / TRASPASAR / REVIEW / NO HACER NADA
→ ejecución manual
→ registro
→ seguimiento de cartera
```

Regla: una tarjeta o panel secundario puede mostrar evidencia, pero no puede recalcular una decisión productiva diferente.

---

# 5. Replay histórico integrado

El replay no es otro motor. Reproduce causalmente la misma arquitectura conceptual con las limitaciones de datos históricos.

```text
estado inicial
  ├─ Desde cero
  ├─ Manual
  └─ Mi cartera actual
        ↓
política
  ├─ Motor Custodia
  └─ Mantener cartera
        ↓
frecuencia DAILY / WEEKLY / MONTHLY / QUARTERLY
        ↓
datos disponibles hasta decisionDate
        ↓
misma cadena conceptual de decisión
        ↓
ejecución posterior a señal / NEXT_OPEN
        ↓
BCE histórico + fiscalidad + externalCashFlows
        ↓
JSON + métricas + benchmarks + auditoría
```

Limitación conocida: Yahoo current discovery no reconstruye el universo histórico point-in-time. Sigue existiendo survivorship mientras no haya instrument master histórico con listings/delistings.

---

# 6. Research y validación

`ResearchValidationCenter` sirve para guards, unit tests, TypeScript, diagnósticos current/live, replays integrados, Future Forward e investigación causal.

No debe convertirse en una colección ilimitada de botones por cada activo o hipótesis. Al cerrar una investigación, su estado pasa a `ARCHIVED / RETIRED / CONSUMED` según proceda.

Separación metodológica obligatoria:

```text
calidad de señal ≠ calidad de política económica
```

`Producto · cierre rápido` es el gate corto de regresión productiva. Incluye `tests/privateUserSecurity.unit.ts` como **Guard usuarios privados**, dentro del mismo job existente y sin replay largo. Desde Fase 2B incluye además un invariante que impide que el backend de alertas vuelva a crear una recomendación de rotación paralela.

`docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md` es el contrato común de investigación económica para Fases 4–6. Exige preregistro, muestra fresh/blind/OOS, comparación emparejada, materialidad económica, guardrails y confirmación independiente antes de una eventual promoción.

---

# 7. Usuarios, persistencia y seguridad

Trading mantiene su propia infraestructura y no depende de ninguna otra app.

Ya existía antes de Fase 2A:

- Firebase Authentication propio;
- verificación server-side del Firebase ID token;
- Firebase Admin SDK propio;
- custom claims `accessGranted` e `isAdmin`;
- Firestore privado por `uid`;
- reglas deny-by-default;
- aislamiento de cartera/efectivo/fiscalidad/historial entre usuarios;
- migración segura de estado local;
- panel ADMIN para alta, acceso, bloqueo, roles, reset y borrado;
- persistencia durable de alertas;
- validación manual multiusuario.

## Cubetos/Muros como referencia técnica

`fmaranis/Cubetos-y-balsas-sincronizado` se utiliza sólo para estudiar soluciones ya probadas. No se comparten proyecto Firebase, usuarios/UID, Firestore, perfiles, claims, backend/API, despliegue/runtime, alarmas, datos ni código común.

La comparación de Fase 2A concluyó que no conviene copiar el sistema SaaS completo de Cubetos/Muros. Trading sólo necesita actualmente `accessGranted` + `isAdmin`; introducir planes, entitlements, créditos o un `PermissionContext` genérico añadiría complejidad sin necesidad productiva.

## Hardening selectivo Fase 2A — DONE

Sin sustituir `SecureAppGate`, UID, claims ni Firestore existentes se implementó:

- `admin_audit_log` backend-only;
- actividad administrativa dentro de `AdminUsersPanel`;
- búsqueda por correo/nombre/UID;
- `emailVerified` visible;
- rollback best-effort del alta administrada;
- semántica explícita: ADMIN implica acceso y debe retirarse ADMIN antes de revocar acceso;
- revalidación de sesiones abiertas cada 15 s y al recuperar foco;
- autosync parado antes de limpiar caché privada;
- fallo de red de revalidación = fail-closed sin borrar caché como revocación;
- lista de usuarios desacoplada del audit log;
- Firebase Auth como autoridad y profile mirror best-effort;
- aserciones de comportamiento en `privateUserSecurity.unit.ts`;
- confirmación sensible dentro del propio panel, sin depender de `window.confirm`;
- enlaces de contraseña visibles aunque `navigator.clipboard` esté restringido.

El usuario completó el smoke runtime: las acciones ADMIN responden, la revocación invalida el acceso, la recuperación posterior funciona y el estado privado se conserva. Después ejecutó el **quick closure final** sobre el HEAD `472e7d1f20db3901a4bac1ab5003cb16bfe4d79a`: **PASS**.

Estado 2A:

**DONE / RUNTIME PASS / QUICK CLOSURE FINAL PASS.**

---

# 8. Alertas y autonomía 24/7

Las alarmas ya son una capacidad operativa en la configuración actual del usuario; no deben tratarse como una funcionalidad inexistente.

## Entrada

```text
scheduler
→ POST /api/alerts/run-now
→ motor existente de oportunidades
→ Firestore dedupe
→ Telegram / webhook
```

## Gestión de cartera

`runPortfolioManagementAlerts(...)`:

- trabaja con el UID configurado actualmente;
- verifica cuenta activa/autorizada;
- lee `users/{uid}/private/state`;
- reconstruye cartera, historial, lotes fiscales y cash benchmark;
- ejecuta `PortfolioPositionHealthService` y el clasificador compartido;
- mantiene dedupe por UID;
- puede enviar `ADD / WATCH / REDUCE / EXIT` por Telegram.

### Auditoría y corrección Fase 2B

La auditoría confirmó que `server/portfolioManagementAlerts.ts` todavía ejecutaba `PortfolioRotationReviewEngine.evaluate(...)` y, ante `ROTATE_NOW`, generaba una `rotationEvent` independiente de `evaluatePortfolioDecision` y del `executionPlan` canónico.

Eso era una **autoridad paralela residual** incompatible con `CORE_ARCHITECTURE_V1`.

Corrección implementada en el HEAD iniciado en `fb8e1f2cf464ef91a2502beb29659fb2f59dcbc6`:

- eliminado `PortfolioRotationReviewEngine` del backend de alertas;
- eliminado `ROTATE_NOW`/`rotationEvent` del camino Telegram;
- preservados `ADD / WATCH / REDUCE / EXIT` y toda su lógica de dedupe;
- preservados scheduler, Firebase/Firestore, UID configurado y canal Telegram;
- `rotationStatus` se mantiene en el contrato de summary como `null` para no romper consumidores existentes;
- añadido invariante **1034** a `tests/productSurfaceClosureV1.unit.ts`;
- el guard pasa ahora a esperar **34/34** invariantes y prohíbe `PortfolioRotationReviewEngine`, `ROTATE_NOW` y `rotationEvent` en el backend/notificador de gestión de cartera.

Decisión V1:

- la generalización a todos los usuarios queda **DEFERRED** mientras no exista una necesidad productiva explícita;
- V1 mantiene el UID configurado actualmente;
- una futura alerta de rotación sólo podrá existir si consume la decisión/plan canónicos, nunca recalculando una política paralela.

### Cierre runtime Fase 2B — 2026-09-12

Después de publicar el backend corregido, una ejecución real de producción de `POST /api/alerts/run-now` confirmó:

- `ok: true`;
- `lastError: null`;
- `lastMarketDate: 2026-09-11`;
- Telegram de oportunidades ya comprobado físicamente;
- dedupe de oportunidades funcionando;
- `portfolioManagement.configured: true`;
- `portfolioManagement.evaluated: true`;
- `evaluatedPositions: 2`;
- `pendingEventCount: 0`;
- `rotationStatus: null`;
- `notificationSent: false`;
- `error: null`.

La ausencia de notificación de gestión en esa ejecución es correcta: no había un nuevo `ADD/WATCH/REDUCE/EXIT` pendiente. No es necesario forzar una operación para cerrar la continuidad.

`CROSS_PROVIDER_UNAVAILABLE` se mantiene como estado de evidencia secundaria de mercado y no invalida este cierre mientras `lastError` sea `null`.

Estado 2B:

**DONE / QUICK CLOSURE PASS / RUNTIME ALERT CONTINUITY PASS.**

---

# 9. Estado consolidado

| Bloque | Estado | Decisión actual |
|---|---|---|
| Cadena productiva única | **DONE** | `CORE_ARCHITECTURE_V1` |
| Acción productiva + plan ejecutable únicos | **DONE** | Sin cadenas paralelas |
| Capital cero real | **DONE** | No se inventa dinero |
| Data provenance | **DONE** | REAL / STATIC_REFERENCE / SYNTHETIC |
| Replay causal integrado | **DONE** | `NEXT_OPEN`, modos integrados |
| Cash BCE + fiscalidad | **DONE** | Causal; DFR histórico completado desde 1999 |
| External cash flows | **DONE / CONSUMED** | Integración PASS |
| Discovery current/live | **DONE** | Yahoo + seed/fallback |
| Top64 dinámico | **DONE / PASS** | No whitelist fija |
| Allocation productiva | **DONE** | `LEGACY` |
| QUALITY allocation | **VALIDATING** | Future Forward 1/12; no promoción |
| `CORE_ELIGIBILITY_V2` | **SHADOW** | No productivo |
| Forward Risk V8 | **RESEARCH RETAINED** | Señal útil; sin autoridad económica productiva |
| V9 / V10 / V11 | **RETIRED** | No retunear |
| HFG | **CONSUMED / CLOSED** | Diagnóstico, no tuning |
| Fase 4 reentrada | **CLOSED / INCONCLUSIVE** | R2/R3 consumidas; R3 sin reach, no promoción ni R4 reactiva |
| Fase 5 protección ganadores | **CLOSED / CONFIRMATION FAIL** | Primer blind PASS; confirmación consumida FAIL; no promoción; V2 winner-only retirada como policy probada |
| Fase 6 Forward Risk contexto | **PREREGISTERED STAGE A / NOT OPENED** | `FORWARD_RISK_CONTEXT_V1` shadow; muestra aún no seleccionada; producción LEGACY |
| Móvil + JSON | **DONE / PASS** | Prueba física realizada |
| Usuarios privados / Firestore | **OPERATIVO** | Arquitectura propia |
| Fase 2A ADMIN hardening | **DONE / PASS** | Runtime + quick closure final PASS |
| Fase 2B alertas/autonomía | **DONE / PASS** | Runtime real con `rotationStatus:null` |
| Fase 3 protocolo económico | **DONE / FROZEN** | `ECONOMIC_VALIDATION_PROTOCOL_V1` |
| Cubetos/Muros | **REFERENCE ONLY** | Nunca compartir infraestructura |
| Alertas de entrada | **OPERATIVAS** | Ya llegan en configuración actual |
| Alertas de cartera backend | **OPERATIVAS** | Health alerts; sin rotación paralela |
| Multiuser fan-out de alertas | **DEFERRED** | No necesario para alcance V1 actual |
| Broker API automática | **NOT IMPLEMENTED / FUTURE** | Ejecución manual asistida |
| Instrument master histórico point-in-time | **NOT IMPLEMENTED** | Survivorship reconocido |
| USD/Nasdaq/NYSE + FX | **DEFERRED** | Después del cierre V1 |
| Listings jóvenes / IPO / fundamentales / revisiones / volumen | **DEFERRED** | Después del cierre V1 |
| RL / FinRL | **DEFERRED** | Complejidad no justificada |

---

# 10. Ruta maestra para finalizar la aplicación

## FASE 0 — MAPA MAESTRO Y ESTADO CANÓNICO

**DONE.**

## FASE 1 — BASE PRODUCTIVA V1

**DONE salvo bug/regresión material.**

## FASE 2 — USUARIOS / SEGURIDAD / AUTONOMÍA

**DONE.**

### 2A — usuarios/ADMIN

**DONE.**

Evidencia de cierre:

- hardening integrado sin stack paralelo;
- runtime smoke PASS;
- revocación/recuperación y estado privado PASS;
- confirmación interna ADMIN PASS;
- `Producto · cierre rápido` final PASS sobre `472e7d1f20db3901a4bac1ab5003cb16bfe4d79a`.

### 2B — alertas/autonomía

**DONE.**

Evidencia de cierre:

- fix de rotación paralela integrado;
- `Producto · cierre rápido` PASS;
- producción publicada y ejecución real del scheduler PASS;
- cartera real evaluada: 2 posiciones;
- `rotationStatus:null`;
- `error:null`;
- Telegram de oportunidades y dedupe comprobados físicamente;
- no se forzó una señal de cartera inexistente.

La expansión multiusuario queda deferred y no bloquea V1 actual.

## FASE 3 — PROTOCOLO ECONÓMICO FINAL

**DONE / FROZEN.**

Documento canónico:

`docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md`

Quedan congelados antes de nuevas muestras:

- definición fresh/blind/OOS;
- registro de muestras consumidas;
- baseline y benchmarks;
- causalidad;
- costes/fiscalidad/cash;
- métricas comunes;
- reach y materialidad económica;
- estados `PASS_CANDIDATE_FOR_CONFIRMATION / FAIL_RETIRED_AS_TESTED / INCONCLUSIVE`;
- promoción en dos etapas;
- reglas específicas de Fases 4–6.

## FASE 4 — REENTRADA DESPUÉS DE UNA SALIDA ERRÓNEA

**CLOSED FOR V1 / INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH.**

Política investigada: `EXIT_PROCEEDS_CUSTODY_V1`.

Documentos:

- `docs/phase4_reentry_cash_custody_v1_preregistration.md`;
- `docs/phase4_reentry_cash_custody_v1_r3_preregistration.md`;
- `docs/phase4_reentry_cash_custody_v1_final_outcome.md`.

Resumen de evidencia:

- R1: `VOID PRE-OPEN`, no consumió muestra;
- R2: `CONSUMED / INCONCLUSIVE_INVALID_DATA` porque el core no obtuvo serie REAL válida; no hubo comparación económica evaluable;
- R3: preregistrada y sellada antes de abrir el pool fresh;
- core R3: `DBXW.DE`, acumulación, EUR, Yahoo REAL;
- replay R3: `2009-01-05 -> 2010-12-31`;
- preflight core: PASS, 256 barras causales para mínimo 252;
- scanner: 66/66 aceptados;
- pool fresh: 65/65 coverage-eligible;
- selección: 30 activos por regla congelada;
- data gate: 6/6 cohortes válidas;
- reach: 0 EXIT-reservas y 0 reentradas;
- veredicto R3: `INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

El mecanismo no llegó a activarse. Los deltas baseline/candidato iguales a cero no constituyen evidencia de equivalencia económica. R2/R3 quedan consumidas y no se retunean.

Decisión V1: no crear R4 reactiva para forzar reach después de observar R3. Producción continúa `LEGACY`; la policy queda archivada research-only. El carril económico avanza a Fase 5.

Evidencia durable R3: `replay-results/validation-runs/research-validation/phase4-reentry-cash-custody-v1-r3.json`.

## FASE 5 — PROTECCIÓN DE GRANDES GANADORES

**CLOSED / FIRST BLIND PASS / CONFIRMATION CONSUMED FAIL / NO PROMOTION / PRODUCTION LEGACY.**

Documentos:

- `docs/phase5_winner_protection_v2_preopen_design.md`;
- `docs/phase5_winner_protection_v2_final_outcome.md`;
- `docs/phase5_winner_protection_v2_confirmation_preregistration.md`;
- `docs/phase5_winner_protection_v2_confirmation_final_outcome.md`.

La candidata reutilizó `TREND_PROTECTION_V2` existente **sin retuning** y habilitó únicamente su rama winner dentro de `runDynamicReplayWithRotationExperiment(...)`.

Política congelada probada:

- MFE mínimo 8%;
- giveback de armado 6 pp;
- giveback fuerte 8 pp;
- confirmación 3 sesiones o 3 observaciones + 2 pp de empeoramiento;
- una única reducción parcial del 25% por episodio;
- reclaim desarma;
- no actúa sobre core diversificado;
- un `REDUCE/EXIT` canónico más fuerte siempre prevalece;
- reach sólo cuenta `REDUCE` F5 realmente ejecutadas `NEXT_OPEN`.

### Primer blind 2001–2003

- 6 cohortes de 3 activos;
- 13.000 EUR por cohorte, cartera manual inicial igual ponderada, cash 0;
- DAILY / MEDIUM;
- datos REAL Yahoo;
- muestra consumida;
- reach 18 reducciones, 6/6 cohortes;
- 4/6 cohortes positivas;
- mediana +118,46 EUR;
- agregado +736,47 EUR;
- leave-best-out +430,63 EUR;
- guardrails preregistrados PASS;
- veredicto `PASS_CANDIDATE_FOR_CONFIRMATION`.

### Confirmación temporal 2005–2007

La confirmación reutilizó exactamente los mismos 18 activos, 6 cohortes, política, sizing y gates; no hubo reselección según el primer outcome. El inicio scoring se refijó pre-open por cobertura exclusivamente a `2005-01-10`, manteniendo warm-up 2004 y final 2007-12-31.

Resultado autoritativo:

- muestra: `PHASE5_CONFIRMATION_OPENED_CONSUMED`;
- veredicto: **`CONFIRMATION_FAIL_NO_PROMOTION`**;
- reach: **63** reducciones ejecutadas;
- cohortes alcanzadas: **6/6**;
- cohortes con delta terminal positivo: **2/6** frente a 4/6 requeridas;
- deltas por cohorte: aproximadamente `+667,89 / -272,69 / +277,67 / -1.853,00 / -256,69 / -1.216,59 EUR`;
- mediana terminal: aproximadamente **-264,69 EUR**;
- agregado: aproximadamente **-2.653,41 EUR**;
- leave-best-out: aproximadamente **-3.321,30 EUR**;
- mediana de max-drawdown mejoró alrededor de **4,42 pp**, mostrando valor protector parcial;
- peor delta individual alrededor de **-1.853 EUR**, incumpliendo el guardrail -650 EUR.

Lectura correcta:

- la policy exacta no generalizó en riqueza terminal y **no se promociona**;
- la reducción de drawdown observada no convierte el FAIL económico en PASS;
- no se ajustan ahora MFE/giveback/streak/worsening/sizing usando estas muestras;
- no se crea una V3 paramétrica sobre los mismos outcomes;
- ambas muestras quedan consumidas;
- producción permanece `LEGACY`.

El one-shot de confirmación queda **ARCHIVED / READ-ONLY** en `ResearchValidationCenter`; no puede relanzarse.

## FASE 6 — FORWARD RISK V8 COMO CONTEXTO

**STAGE A PREREGISTERED / SAMPLE NOT SELECTED / NOT OPENED / RESEARCH ONLY.**

Documento:

`docs/phase6_forward_risk_context_preregistration.md`

Contexto congelado:

`FORWARD_RISK_CONTEXT_V1`

- preserva la regla V8: `V5 >=80 OR V7 >=80`;
- score continuo de contexto = `max(V5, V7)`;
- exige ambas familias disponibles; sin fallback silencioso;
- no ajusta coeficientes ni thresholds;
- se observa en shadow en el contexto de decisión de `PortfolioCandidateGate`;
- no cambia eligibility, ranking, sizing, holdings ni órdenes;
- no crea ON/OFF diario ni waiting state;
- producción continúa `LEGACY`.

Razón metodológica: antes de inventar otra política económica se comprobará en una muestra fresh si V8 aporta **información incremental** dentro del flujo real de candidatos. El diagnóstico V11 de sólo 51/272 decisiones `ELIGIBLE` con riesgo >80 justifica estudiar una colocación informativa anterior, pero no autoriza a retunear V11.

La muestra Stage A todavía es `NOT_SELECTED_NOT_OPENED`. Antes de cualquier outcome deben congelarse muestra, ventana, outcomes predictivos, reach, gates y seal. Si Stage A pasa, esa muestra quedará consumida para diseñar cualquier política económica posterior; la policy tendrá que validarse en otra muestra fresh.

Job actual:

`Fase 6 · Forward Risk V8 como contexto · readiness`

Sólo ejecuta guard de preregistro + arquitectura + CandidateGate + paridad + superficie + TypeScript. No consulta mercado ni outcomes.

## FASE 7 — QUALITY FUTURE FORWARD

**WAITING / COLLECTING EN PARALELO.**

- 1/12 observaciones;
- 0 outcomes maduros a 2026-09-15;
- producción `LEGACY`;
- 25 archivos metodológicos congelados;
- siguiente observación: **2026-10-09 22:30–24:00 Europe/Madrid**.

## FASE 8 — UNIVERSO HISTÓRICO POINT-IN-TIME

**PENDIENTE.** Instrument master histórico con listings, delistings, cambios de ticker/mercado y disponibilidad por fecha.

## FASE 9 — AUDITORÍA END-TO-END Y CIERRE V1

Revisar producto current/live, usuarios/seguridad, alertas, replay causal, regímenes, cartera, cash/flujos, costes/fiscalidad, benchmarks y límites de evidencia económica.

## FASE 10 — EXPANSIONES V2

**DEFERRED.** USD/Nasdaq/NYSE con FX, IPO/listings jóvenes, fundamentales, revisiones, volumen avanzado, taxonomía sectorial, proveedor/instrument master más exhaustivo, broker API si se justifica y RL/FinRL sólo si aporta valor.

---

# 11. Carriles paralelos

```text
CARRIL A — PRODUCTO / OPERACIÓN
Fase 0 → Fase 1 → Fase 2 → Fase 9

CARRIL B — EVIDENCIA ECONÓMICA
Fase 3 → Fase 4 → Fase 5 (cerrada) → Fase 6 → Fase 9

CARRIL C — PROSPECTIVO POR CALENDARIO
Fase 7

CARRIL D — CALIDAD DE DATOS HISTÓRICOS
Fase 8 → Fase 9

CARRIL E — V2
Fase 10 después del cierre V1
```

---

# 12. Qué NO es trabajo pendiente

No reabrir:

- Fase 2 salvo bug/regresión reproducible;
- R2/R3 de Fase 4 como muestras fresh;
- `EXIT_PROCEEDS_CUSTODY_V1` mediante retuning sobre R2/R3;
- Fase 5 blind 2001–2003 ni confirmación 2005–2007 como fresh;
- `TREND_PROTECTION_V2_WINNER_ONLY` mediante parámetros ajustados con cualquiera de sus dos outcomes;
- volver a ejecutar el one-shot de confirmación F5;
- V9/V10/V11;
- V12/V13 como parameter chasing;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY_ALLOCATION_BRIDGE_V1 retrospectivo;
- HFG como muestra de promoción;
- motores/pantallas/replays duplicados;
- jobs específicos por activo;
- retuning de Top64/Opportunity con snapshots observados;
- reconstruir Firebase/usuarios/Telegram desde cero;
- copiar planes/entitlements/monetización de Cubetos/Muros;
- compartir sistema de usuarios entre aplicaciones;
- generalizar alertas a todos los usuarios sin necesidad productiva explícita.

---

# 13. Siguiente paso operativo

1. **Fase 2 = DONE.** No reabrir salvo bug/regresión reproducible.
2. **Fase 3 = DONE / FROZEN** mediante `ECONOMIC_VALIDATION_PROTOCOL_V1`.
3. **Fase 4 = CLOSED FOR V1 / INCONCLUSIVE.** R2/R3 consumidas; no R4 reactiva ni retuning.
4. **Fase 5 = CLOSED / CONFIRMATION FAIL / NO PROMOTION.** Primer blind y confirmación consumidos; one-shot archivado; producción `LEGACY`.
5. **Fase 6 Stage A = CONTEXT PREREGISTERED / SAMPLE NOT SELECTED / NOT OPENED.**
6. Sincronizar `main` y ejecutar únicamente `Fase 6 · Forward Risk V8 como contexto · readiness`.
7. El readiness debe pasar guards + `tsc --noEmit`; no consulta mercado, no calcula outcomes y no consume muestra.
8. Si pasa, congelar después la regla de selección fresh, muestra exacta, ventana, outcomes predictivos, reach/gates y seal Stage A **antes** de cualquier market/outcome access.
9. No diseñar aún sizing/ranking/hurdle económico con resultados no abiertos. Una policy económica sólo se diseña después de una Stage A válida y necesitará otra muestra fresh.
10. Fase 7 continúa sólo por calendario y sus 25 archivos siguen congelados.
