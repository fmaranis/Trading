# APP TRADING — FLUJO MAESTRO Y ROADMAP DE CIERRE

Estado: **CANÓNICO PARA ORGANIZACIÓN DEL TRABAJO**  
Fecha base: **2026-09-11**  
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

# 6. Research y validación: papel correcto

`ResearchValidationCenter` sirve para guards, unit tests, TypeScript, diagnósticos current/live, replays integrados, Future Forward e investigación causal.

No debe convertirse en una colección ilimitada de botones por cada activo o hipótesis. Al cerrar una investigación, su estado pasa a `ARCHIVED / RETIRED / CONSUMED` según proceda.

Separación metodológica obligatoria:

```text
calidad de señal ≠ calidad de política económica
```

Una señal predictiva útil no queda invalidada porque una forma concreta de monetizarla falle.

---

# 7. Usuarios, persistencia y seguridad

Trading mantiene su propia infraestructura y no depende de ninguna otra app.

Ya existe:

- Firebase Authentication propio;
- verificación server-side del Firebase ID token;
- Firebase Admin SDK propio;
- custom claims `accessGranted` e `isAdmin`;
- Firestore privado por `uid`;
- reglas deny-by-default;
- aislamiento de cartera/efectivo/fiscalidad/historial entre usuarios;
- migración segura de estado local preexistente;
- panel ADMIN para alta, acceso, bloqueo, roles, reset y borrado;
- persistencia durable del deduplicado de alertas en Firestore;
- validación manual multiusuario ya realizada.

## Cubetos/Muros como referencia técnica

`fmaranis/Cubetos-y-balsas-sincronizado` puede estudiarse porque contiene patrones de usuarios/permisos/ADMIN ya probados, pero **no se integra ni se comparte con Trading**.

No se comparten:

- proyecto Firebase;
- usuarios/UID;
- Firestore;
- perfiles;
- roles/claims;
- planes/entitlements;
- backend/API;
- despliegue/runtime;
- alarmas;
- código común o imports entre repositorios.

Si un patrón es mejor, se adapta/reimplementa independientemente dentro de Trading y se prueba sin romper el comportamiento actual.

---

# 8. Alertas y autonomía 24/7

Las alarmas ya son una capacidad operativa en la configuración actual del usuario; no deben tratarse como una funcionalidad inexistente.

## 8.1 Entradas

```text
scheduler
→ POST /api/alerts/run-now
→ motor existente de oportunidades
→ Firestore dedupe
→ Telegram / webhook
```

## 8.2 Gestión de cartera

`runPortfolioManagementAlerts(...)` ya:

- trabaja con un UID configurado;
- verifica cuenta activa/autorizada;
- lee `users/{uid}/private/state`;
- reconstruye cartera, historial, lotes fiscales y cash benchmark;
- ejecuta `PortfolioPositionHealthService` y el clasificador compartido;
- mantiene dedupe por UID;
- puede enviar `ADD / WATCH / REDUCE / EXIT` por Telegram.

Pendiente residual, sólo según alcance V1:

- decidir si debe generalizarse a todos los usuarios activos;
- si se generaliza, mantener dedupe independiente por UID;
- revisar el uso residual de `PortfolioRotationReviewEngine` para evitar autoridad paralela;
- añadir guard/test si se toca este flujo;
- confirmar que las alarmas actuales siguen llegando después de cualquier cambio.

---

# 9. Estado consolidado

| Bloque | Estado | Decisión actual |
|---|---|---|
| Cadena productiva única | **DONE** | `CORE_ARCHITECTURE_V1` |
| Acción productiva + plan ejecutable únicos | **DONE** | Sin cadenas paralelas |
| Capital cero real | **DONE** | No se inventa dinero |
| Data provenance | **DONE** | REAL / STATIC_REFERENCE / SYNTHETIC |
| Replay causal integrado | **DONE** | `NEXT_OPEN`, modos integrados |
| Cash BCE + fiscalidad | **DONE** | Causal |
| External cash flows | **DONE / CONSUMED** | Integración PASS |
| Discovery current/live | **DONE** | Yahoo + seed/fallback |
| Top64 dinámico | **DONE / PASS** | No whitelist fija |
| Allocation productiva | **DONE** | `LEGACY` |
| QUALITY allocation | **VALIDATING** | Future Forward 1/12; no promoción |
| `CORE_ELIGIBILITY_V2` | **SHADOW** | No productivo |
| Forward Risk V8 | **RESEARCH RETAINED** | Señal útil; política no resuelta |
| V9 / V10 / V11 | **RETIRED** | No retunear |
| HFG | **CONSUMED / CLOSED** | Diagnóstico, no tuning |
| Identidad `DYNAMIC_*` / `OPEN_*` | **DONE / REAL REPLAY VERIFIED** | Acciones no heredan core |
| Móvil + JSON | **DONE / PASS** | Prueba física realizada |
| Usuarios privados / ADMIN / Firestore | **MUY AVANZADO / OPERATIVO** | Mejora selectiva, no reconstrucción |
| Cubetos/Muros como referencia | **REFERENCE ONLY** | Nunca compartir infraestructura con Trading |
| Alertas de entrada | **OPERATIVAS** | Ya llegan en configuración actual |
| Alertas de cartera backend | **IMPLEMENTADAS / CIERRE RESIDUAL** | Generalización opcional + alineación canónica |
| Broker API automática | **NOT IMPLEMENTED / FUTURE** | Ejecución manual asistida |
| Instrument master histórico point-in-time | **NOT IMPLEMENTED** | Survivorship reconocido |
| USD/Nasdaq/NYSE + FX | **DEFERRED** | Después del cierre V1 |
| Listings jóvenes / IPO / fundamentales / revisiones / volumen | **DEFERRED** | Después del cierre V1 |
| RL / FinRL | **DEFERRED** | Complejidad no justificada |

---

# 10. Ruta maestra para finalizar la aplicación

## FASE 0 — MAPA MAESTRO Y ESTADO CANÓNICO

**Estado: DONE.**

El mapa, la ruta y el estado canónico quedan documentados en este archivo y `PROJECT_STATE.md`.

## FASE 1 — BASE PRODUCTIVA V1

**Estado: DONE salvo bug/regresión material.**

No repetir `Producto · cierre rápido` salvo cambio material posterior.

## FASE 2 — USUARIOS / SEGURIDAD / AUTONOMÍA

**Estado: ACTIVA / MUY AVANZADA / CIERRE SELECTIVO.**

Objetivo:

- conservar todo lo que ya funciona en Trading;
- comparar el sistema de usuarios propio de Trading con patrones ya probados en Cubetos/Muros;
- adoptar sólo mejoras con ventaja clara;
- implementarlas de forma independiente dentro de Trading;
- no compartir Firebase, usuarios, Firestore, backend ni código común;
- no romper login, ADMIN, carteras, persistencia o alarmas existentes.

Secuencia:

1. inventario diferencial Trading vs Cubetos/Muros;
2. seleccionar mejoras objetivas;
3. implementarlas dentro de Trading con infraestructura propia;
4. comprobar mismo usuario → misma cartera → mismo estado privado → mismas alarmas;
5. retirar código antiguo sólo si la sustitución está validada;
6. cerrar remates residuales de alertas sólo si forman parte del alcance V1.

Criterio DONE: Trading mantiene autonomía completa y conserva las capacidades actuales, con mejoras de usuarios/ADMIN sólo donde aporten valor probado.

## FASE 3 — PROTOCOLO ECONÓMICO FINAL

**Estado: NEXT.**

Antes de nuevas políticas congelar:

- métricas PASS/FAIL;
- definición fresh/blind/OOS;
- registro de muestras consumidas;
- benchmarks comparables;
- costes/fiscalidad;
- materialidad económica;
- política congelada antes de abrir resultados.

## FASE 4 — REENTRADA DESPUÉS DE UNA SALIDA ERRÓNEA

**Estado: PENDIENTE RESEARCH.**

Diseñar hipótesis general sin thresholds derivados de HFG y validar fresh/OOS.

## FASE 5 — PROTECCIÓN DE GRANDES GANADORES

**Estado: PENDIENTE RESEARCH.**

Diseñar política antes de abrir nueva muestra. HFG es diagnóstico consumido y no fija el `REDUCE 50%` productivo.

## FASE 6 — FORWARD RISK V8 COMO CONTEXTO

**Estado: PENDIENTE RESEARCH.**

Explorar contexto de riesgo, sizing, ranking, alertas, stress o margen de seguridad. No ON/OFF diario directo ni V12/V13 retrospectivo.

## FASE 7 — QUALITY FUTURE FORWARD

**Estado: WAITING / COLLECTING EN PARALELO.**

- 1/12 observaciones;
- 0 outcomes maduros a 2026-09-11;
- producción `LEGACY`;
- 25 archivos metodológicos congelados;
- siguiente observación nueva: **2026-10-09 22:30–24:00 Europe/Madrid**.

## FASE 8 — UNIVERSO HISTÓRICO POINT-IN-TIME

**Estado: PENDIENTE.**

Instrument master histórico con listings, delistings, cambios de ticker/mercado y disponibilidad por fecha.

## FASE 9 — AUDITORÍA END-TO-END Y CIERRE V1

Revisar producto current/live, usuarios/seguridad, alertas, replay causal, regímenes de mercado, cartera desde cero/manual/actual, cash/flujos, costes/fiscalidad, benchmarks y límites de evidencia económica.

## FASE 10 — EXPANSIONES V2

**Estado: DEFERRED.**

USD/Nasdaq/NYSE con FX, listings jóvenes/IPO, fundamentales, revisiones de beneficios, volumen avanzado, taxonomía sectorial robusta, proveedor/instrument master más exhaustivo, broker API/ejecución automática si se justifica y RL/FinRL sólo si aporta valor.

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

No reabrir como tareas activas:

- V9/V10/V11;
- SLOPE_V1;
- QUALITY_V1 retrospectivo;
- QUALITY_ALLOCATION_BRIDGE_V1 retrospectivo;
- HFG como muestra de promoción;
- antiguos motores/pantallas productivos duplicados;
- replays independientes por variante;
- nuevos jobs por activo concreto;
- retuning de Top64/Opportunity con snapshots ya observados;
- V12/V13 como parameter chasing;
- reconstruir Firebase/usuarios/Telegram de Trading desde cero;
- unificar o compartir el sistema de usuarios entre Trading y Cubetos/Muros.

---

# 13. Siguiente paso operativo

1. trabajar en **Fase 2** con una comparación diferencial Trading vs Cubetos/Muros;
2. Cubetos/Muros se usa sólo como referencia de patrones probados;
3. mantener intacto todo lo que ya funciona en Trading;
4. después cerrar **Fase 3** documentalmente antes de abrir muestras nuevas;
5. continuar Fase 7 sólo por calendario;
6. no abrir Fases 4–6 hasta congelar el protocolo económico;
7. no tocar los 25 archivos congelados de Future Forward para avanzar otras fases.