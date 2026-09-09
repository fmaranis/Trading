# QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — preregistro prospectivo

Fecha de congelación: **2026-09-09**  
Estado: **ARMED / PRE-START / NO OBSERVATION / NO OUTCOME / PRODUCTION LEGACY**

## Enmienda pre-start del 2026-09-09

Antes de ejecutar el primer checkpoint se auditó de nuevo el protocolo y se corrigieron varias omisiones metodológicas. La comprobación directa de `replay-results` confirmó que **no existía todavía** `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`; por tanto no se había consumido ninguna observación ni outcome y estas correcciones no utilizan resultados prospectivos.

La versión definitivamente armada añade:

- estado prospectivo autoritativo y durable en GitHub `replay-results`, no sólo en `.runtime`;
- ventana mensual fija, para impedir elegir el día después de observar el mercado;
- meses consecutivos obligatorios, sin backfill ni selección de meses;
- fingerprint de la implementación metodológicamente crítica mediante Git blob SHA-1;
- cierre de Phase A sólo después de 12 checkpoints y de la madurez necesaria;
- precio RAW de la apertura futura para sizing/comisiones y serie ajustada sólo para medir retorno total posterior;
- tratamiento correcto de checkpoints 100% cash mediante un calendario REAL de mercado;
- ejecución del job restringida al backend local.

El antiguo `QUALITY_ALLOCATION_FUTURE_FORWARD_V1` sigue **VOID BEFORE START** porque congelaba 64 nombres. No se reactiva.

---

## 1. Pregunta

> **Con el mercado current/live descubierto dinámicamente y el mismo capital disponible, ¿`QUALITY_ALLOCATION_BRIDGE_V1` distribuye prospectivamente mejor ese capital que `LEGACY`?**

No se vuelve a preguntar si QUALITY contiene información: eso ya se estudió en muestras históricas consumidas. Esta fase estudia exclusivamente la política económica de asignación con datos futuros.

Producción permanece `LEGACY` durante toda Phase A.

---

## 2. Arquitectura compartida

No se crea ningún scanner, gate, decision engine ni allocator paralelo.

Cada checkpoint usa:

`Yahoo Search + Lookup current/live`
` -> AssetUniverseScanner`
` -> Top64 dinámico`
` -> PortfolioCandidateGate [LEGACY]`
` -> InvestmentDecisionEngine`
` -> PortfolioDecisionEngine`

El mismo `PortfolioDecisionEngine.evaluate(...)` recibe dos veces exactamente la misma foto de mercado, decisión y notional research:

- control: `LEGACY`;
- shadow: `QUALITY_ALLOCATION_BRIDGE_V1`.

La única diferencia permitida entre brazos es `opportunityAllocationPolicy`.

---

## 3. Bridge congelado

Se reutiliza sin retuning:

`candidateQualityAdjustment = (reliability - 50)*0.10 + (opportunity - 50)*0.20`

`qualityMultiplier = clamp(1 + candidateQualityAdjustment/100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

No pueden cambiarse después de abrir la muestra los coeficientes, límites, cash hurdle, consensus, Entry Timing, starter/build caps, slots, caps de activo/categoría, rotación ni fórmula productiva del Top64.

---

## 4. Mercado dinámico: reglas congeladas, nombres no congelados

Se conserva la arquitectura ya cerrada:

- `DYNAMIC_CURRENT_DISCOVERY`;
- target Top64 = 64;
- Yahoo Search + Lookup current/live;
- seed de 64 sólo bootstrap/fallback;
- EUR compatible;
- ETF/EQUITY según capacidad actual;
- mínimo 252 barras;
- REAL-only;
- datos con antigüedad máxima de 7 días;
- dedupe económico vigente;
- ningún candidato fuera del Top64 puede reaparecer downstream.

Un checkpoint sólo puede grabarse si discovery current fue realmente ejecutado, no está degradado, promociona al menos 64 candidatos fuera del bootstrap y produce un Top64 completo REAL.

**Nunca se congela una lista futura de activos.**

---

## 5. Ventana mensual congelada

Cadencia: **MONTHLY**.  
Primer mes: **2026-09**.  
Máximo: **12 checkpoints**.  
Zona horaria: **Europe/Madrid**.

La única ventana válida para crear una observación nueva es:

> **día 9 de cada mes, desde las 22:30 hasta las 24:00 hora de Madrid.**

La elección responde a dos motivos:

1. el mercado europeo ya está cerrado;
2. no se cruza medianoche, por lo que con barras diarias la “primera apertura posterior al checkpoint” queda definida sin ambigüedad como una sesión posterior a `checkpointRunDate`.

Antes de las 22:30 el job puede verificar estado/outcomes pero no crear el checkpoint. Después de las 24:00 no se permite crear retrospectivamente la observación del mes.

Puede reintentarse dentro de la misma ventana si falla infraestructura o proveedor. Si al cerrar la ventana no existe observación válida del mes esperado, **la continuidad de esta Phase A queda invalidada**; no se salta ese mes y no se hace backfill.

Los 12 checkpoints deben corresponder a meses naturales consecutivos.

---

## 6. Estado durable y no reescribible

Autoridad:

- repositorio: `fmaranis/Trading`;
- rama: `replay-results` por defecto;
- archivo: `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`.

La credencial ya utilizada por la app para sincronización de resultados es `GITHUB_REPLAY_SYNC_TOKEN`. Si falta o GitHub rechaza lectura/escritura, el checkpoint falla **antes de considerar consumida una nueva observación**.

`.runtime/qualityAllocationDynamicFutureForwardV1.json` queda únicamente como caché local no autoritativa. Si diverge, manda el estado durable.

Cada observación guarda hash propio y hash encadenado con la anterior. Los outcomes también son hash-inmutables. La escritura remota utiliza el blob SHA previamente leído, de forma que dos escritores concurrentes no pueden pisarse silenciosamente.

Si el archivo durable desaparece después del primer mes elegible, el protocolo falla cerrado. No puede recrear una baseline tardía.

---

## 7. Implementación congelada, no sólo parámetros

Phase A podría durar más de un año mientras el resto de la aplicación sigue evolucionando. Por ello no basta con congelar 0.10/0.20/0.85/1.15.

El protocolo contiene un manifiesto `QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS` con Git blob SHA-1 de los componentes que materialmente determinan discovery, datos, scanner, quality, gate, consensus, timing, decisión, allocator, costes, cash y cálculo de outcomes.

Antes de cada ejecución se recalculan esos blob hashes desde el checkout local. Si cambia cualquiera:

`QUALITY_FF_FROZEN_IMPLEMENTATION_CHANGED`

El Phase A existente se detiene. No mezcla una nueva implementación con observaciones anteriores.

El resto de UI/producto puede evolucionar si no modifica esos componentes congelados.

El propio archivo de protocolo queda protegido además por `protocolFingerprintSha256` almacenado en el estado durable.

---

## 8. Capital research

Cada mes es una allocation shot independiente:

- capital research: **13.000 EUR**;
- riesgo: **MEDIUM**;
- horizonte de decisión: **3 años**;
- cash benchmark comparativo: **2,5% anual**;
- cartera inicial: vacía;
- cash inicial: 13.000 EUR;
- `stagedCapitalPlan.availableEur = 0`.

Los 13.000 EUR:

- no son la cartera privada del usuario;
- no son un flujo externo real;
- no son una aportación mensual;
- no se acumulan entre checkpoints.

Sólo crean el mismo problema de asignación para LEGACY y QUALITY y dan reach económico suficiente para comparar políticas.

---

## 9. Contenido de cada observación

Se guarda, como mínimo:

- timestamp real y mes natural;
- fingerprint de protocolo e implementación;
- discovery ejecutado/promovidos/error;
- pool completo de candidatos con scores/provenance;
- Top64 y hash;
- resultado de `PortfolioCandidateGate` LEGACY;
- `InvestmentDecisionResult` compartido y hash;
- plan LEGACY y hash;
- plan QUALITY y hash;
- amount por activo, priority, multiplier, opportunity level, timing y fraction;
- diferencia absoluta de notional planificado;
- hash de observación y chain hash.

`planChanged = true` exige una diferencia absoluta superior a 0,01 EUR.

Una segunda ejecución del mismo mes nunca sustituye el snapshot; sólo puede verificar estado o madurar outcomes.

---

## 10. Ejecución causal de outcomes

La entrada económica no utiliza el último close conocido al crear el checkpoint.

Entrada:

> **primera apertura REAL posterior a `checkpointRunDate`.**

Para activos de unidades enteras:

- el número de unidades y `brokerCommission` se calculan con el **open RAW** de esa sesión futura;
- el capital que no alcanza una unidad o queda tras comisión permanece cash.

Para la evolución del activo hasta el horizonte se usa el factor:

`adjustedClose_mark / adjustedOpen_entry`

Esto permite medir el retorno ajustado por corporate actions sin utilizar retrospectivamente un precio ajustado para decidir cuántas unidades se habrían comprado.

El tratamiento congelado es:

`RAW_NEXT_OPEN_FOR_UNIT_SIZING_PLUS_ADJUSTED_TOTAL_RETURN_FACTOR_TO_MARK`.

No se simula venta al final; se marca el valor al horizonte.

---

## 11. Horizontes y cash residual

Outcomes:

- 20 sesiones;
- 60 sesiones.

Marca N:

> cierre ajustado después de N sesiones subsecuentes desde la sesión de ejecución.

Cash no desplegado:

`(1 + 0.025)^(N/252)`

Si ambos brazos quedan 100% cash, no se resuelve el futuro inmediatamente: un ticker REAL del Top64 actúa únicamente como calendario y el outcome se registra sólo cuando han transcurrido realmente las 20/60 sesiones.

Si falta información REAL suficiente para cualquier activo necesario, el outcome permanece `pending` y nunca se rellena con sintético.

---

## 12. Reach y economía son preguntas distintas

Reach:

- número de checkpoints;
- checkpoints con `planChanged`;
- diferencia absoluta del plan.

Economía:

- retorno de cada brazo;
- QUALITY − LEGACY en puntos porcentuales;
- delta final EUR;
- win rate;
- mediana de deltas;
- notional realmente invertido y comisión.

Un bridge con poca frecuencia de cambio se clasifica por falta de reach; no se fuerza una conclusión económica.

---

## 13. Cierre de Phase A

No se emite un veredicto económico definitivo antes de recopilar los **12 checkpoints**.

Después:

1. si menos de 6 observaciones tuvieron `planChanged`, estado = `INSUFFICIENT_REACH`;
2. si hubo al menos 6 pero todavía faltan outcomes de 60 sesiones de alguna observación con plan cambiado, estado = `AWAITING_60_SESSION_MATURITY`;
3. sólo cuando todos los changed-plan outcomes de 60 sesiones hayan madurado se hace la lectura final.

`DIRECTIONALLY_POSITIVE_FOR_SEPARATE_PHASE_B` exige simultáneamente:

- mediana QUALITY − LEGACY > 0 pp;
- win rate QUALITY >= 60%.

Si hay reach suficiente pero no ambas condiciones:

`NO_DIRECTIONAL_EVIDENCE_FOR_PHASE_B`.

Incluso un resultado direccionalmente positivo **no promociona producción**. Sólo permitiría preregistrar una Phase B blind separada.

---

## 14. Prohibiciones tras abrir la muestra

No se puede usar Phase A para:

- ampliar 0,85–1,15;
- retocar 0.10/0.20;
- alterar Top64, hurdle, consensus o timing;
- escoger otros horizontes porque funcionen mejor;
- cambiar el notional de 13.000 EUR;
- eliminar meses malos;
- saltar meses;
- sustituir snapshots;
- cambiar el tratamiento RAW/adjusted del outcome;
- modificar un archivo crítico y continuar bajo el mismo V1.

Una modificación metodológica futura exige un protocolo nuevo y muestra fresh.

---

## 15. ResearchValidationCenter

Existe un único job CURRENT:

`quality-allocation-dynamic-future-forward-v1`

Orden obligatorio:

1. guard prospectivo completo;
2. guard bridge congelado;
3. guard Top64;
4. guard `CORE_ARCHITECTURE_V1`;
5. guard `PortfolioCandidateGate`;
6. `npm run lint` / TypeScript;
7. checkpoint REAL.

El paso 7 no arranca si falla cualquiera de los anteriores.

El endpoint POST de ejecución está bloqueado con `RESEARCH_VALIDATION_LOCAL_ONLY` cuando `NODE_ENV=production`. Esta investigación se ejecuta en backend local, nunca GitHub Actions.

---

## 16. Relación con los replays históricos

El usuario puede seguir ejecutando replays con el motor productivo existente mientras Phase A madura.

Este future-forward:

- no modifica replay histórico;
- no usa Yahoo current para reconstruir universos pasados;
- no elimina la limitación conocida de survivorship del replay;
- no cambia la política productiva `LEGACY`.

---

## Contrato final

Durante toda Phase A:

- **producción = LEGACY**;
- QUALITY = shadow/research-only;
- reglas e implementación crítica congeladas;
- nombres de activos dinámicos;
- una única foto válida cada mes consecutivo;
- ventana fija sin cherry-picking temporal;
- estado durable en `replay-results`;
- observaciones/outcomes hash-inmutables;
- no datos privados del usuario;
- no aportaciones implícitas;
- no sintético;
- no promoción directa;
- no retuning sobre datos observados.
