# APP TRADING — FLUJO MAESTRO Y ROADMAP DE CIERRE

Estado: **CANÓNICO PARA ORGANIZACIÓN DEL TRABAJO**  
Fecha base: **2026-09-12**  
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
| Forward Risk V8 | **RESEARCH RETAINED** | Señal útil; política no resuelta |
| V9 / V10 / V11 | **RETIRED** | No retunear |
| HFG | **CONSUMED / CLOSED** | Diagnóstico, no tuning |
| Fase 4 reentrada | **PRE-OPEN READY** | `EXIT_PROCEEDS_CUSTODY_V1`; R2 sealed; guards locales pendientes |
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

**PRE-OPEN READY / R2 SEALED / BLIND NOT OPENED.**

Política congelada: `EXIT_PROCEEDS_CUSTODY_V1`.

Documento: `docs/phase4_reentry_cash_custody_v1_preregistration.md`.

R1 quedó `VOID PRE-OPEN` y no consumió muestra. R2 usa 30 acciones EUR en 6 cohortes disjuntas durante `2004-01-02 -> 2014-08-31`, con datos solicitados desde `2002-12-10`, REAL-only, current discovery histórico OFF y `FUND_VANGUARD_GLOBAL` como core común. La muestra sigue sin abrirse.

La implementación research-only está integrada dentro del replay/wrapper existente y no modifica producción. Los guards pre-open cubren, entre otros:

- elegibilidad estructurada y sólo EXIT completo listado no-core;
- no uso de `reason` como autoridad;
- neto real venta-comisión-impuesto;
- protección de reserva desde la misma tanda del EXIT;
- comisión incluida en el cash autorizado;
- atomicidad de rotaciones 1:1;
- shortfall pro-rata;
- lower-bound conservador para financiación de `REDUCE` parcial sin FIFO visible;
- estabilización de la fecha común `NEXT_OPEN` después de desacoplar `RETURN_TO_CORE`;
- reach sólo por reentrada ejecutada con autorización positiva de la reserva específica;
- producción/default `LEGACY` sin exportar la policy research.

Único job operativo:

`Fase 4 · reentrada · custodia de proceeds`

El job ejecuta primero guards rápidos + BCE + TypeScript. Sólo si todos pasan abre `Blind R2 REAL one-shot`. Por tanto, el siguiente paso no es diseñar más política: es ejecutar ese único job en el backend local y aceptar su resultado sin retuning.

## FASE 5 — PROTECCIÓN DE GRANDES GANADORES

**PENDIENTE RESEARCH.** Diseñar política antes de abrir nueva muestra. HFG no fija política productiva. No abrir hasta veredictar Fase 4.

## FASE 6 — FORWARD RISK V8 COMO CONTEXTO

**PENDIENTE RESEARCH.** Explorar contexto de riesgo, sizing, ranking, alertas, stress o margen de seguridad. No ON/OFF diario directo ni V12/V13 retrospectivo.

## FASE 7 — QUALITY FUTURE FORWARD

**WAITING / COLLECTING EN PARALELO.**

- 1/12 observaciones;
- 0 outcomes maduros a 2026-09-12;
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
Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 9

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
- V9/V10/V11;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY_ALLOCATION_BRIDGE_V1 retrospectivo;
- HFG como muestra de promoción;
- motores/pantallas/replays duplicados;
- jobs específicos por activo;
- retuning de Top64/Opportunity con snapshots observados;
- V12/V13 como parameter chasing;
- reconstruir Firebase/usuarios/Telegram desde cero;
- copiar planes/entitlements/monetización de Cubetos/Muros;
- compartir sistema de usuarios entre aplicaciones;
- generalizar alertas a todos los usuarios sin necesidad productiva explícita.

---

# 13. Siguiente paso operativo

1. **Fase 2 = DONE.** No reabrir salvo bug/regresión reproducible.
2. **Fase 3 = DONE / FROZEN** mediante `ECONOMIC_VALIDATION_PROTOCOL_V1`.
3. **Fase 4 = PRE-OPEN READY.** Política, muestra R2, reach, materialidad y PASS/FAIL están congelados; R2 sigue sin abrirse.
4. Ejecutar **una sola vez** `Fase 4 · reentrada · custodia de proceeds` en `ResearchValidationCenter` local/backend.
5. El job debe detenerse antes del blind si falla cualquiera de sus guards o `tsc --noEmit`.
6. Sólo si todos los gates rápidos pasan, el mismo job abre `Blind R2 REAL one-shot`; desde ese momento R2 queda consumida.
7. No modificar política, muestra, thresholds, reach ni criterios tras ver el resultado.
8. Fase 5 no se abre hasta cerrar/veredictar Fase 4.
9. Fase 7 continúa sólo por calendario y sus 25 archivos siguen congelados.