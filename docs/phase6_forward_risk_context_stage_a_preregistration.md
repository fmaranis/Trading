# Fase 6 — Forward Risk V8 como contexto — preregistro Stage A

Fecha de congelación de muestra: **2026-09-15**  
Refreeze operativo pre-open: **2026-09-16**  
Estado: **FUTURE-FORWARD SAMPLE FROZEN / NOT OPENED / RUNNER SEALED FOR STATIC CHECK / RESEARCH ONLY**

## 1. Motivo del diseño

Los periodos históricos usados por Forward Risk V8/V9/V10/V11 hasta 2026-09-01 están consumidos para promoción. Stage A no reutiliza esas ventanas para decidir si el contexto V8 tiene valor incremental dentro de `PortfolioCandidateGate`.

Por tanto, la muestra Stage A se congela como **future-forward**: sólo cuentan outcomes posteriores a esta congelación.

No se define ninguna política económica. Producción continúa `LEGACY`.

## 2. Hipótesis exacta

Pregunta primaria:

> Dentro de las decisiones que `PortfolioCandidateGate` considera `ELIGIBLE`, ¿un contexto Forward Risk alto conserva información incremental sobre downside futuro frente a contexto normal?

La señal permanece exactamente:

`contextScorePct = max(V5 vulnerabilityScorePct, V7 signalScorePct)`

Contexto alto:

`contextScorePct >= 80`

No se retunea el 80, no se ajustan pesos y ambas ramas V5/V7 son obligatorias. Si falta una, la observación queda `UNAVAILABLE`.

## 3. Muestra exacta

Ventana de predicción:

- inicio: `2026-09-16`;
- fin: `2027-03-31`;
- frecuencia conceptual: DAILY, una observación máxima por activo y `informationDate`;
- ningún dato anterior al 2026-09-16 puede incorporarse como observación Stage A;
- sin sustitución de activos después de abrir;
- warm-up de datos: desde `2022-01-03`;
- mínimo 252 barras causales por activo en cada fecha evaluada;
- mínimo 756 barras previas para el bloque de señal al abrir la ventana.

Cohorte congelada de diez activos ya existentes en el catálogo canónico:

1. `EUNL / EUNL.DE` — GLOBAL_EQUITY
2. `SXR8 / SXR8.DE` — US_EQUITY
3. `EXSA / EXSA.DE` — EUROPE_EQUITY
4. `IS3N / IS3N.DE` — EMERGING_EQUITY
5. `IUSN / IUSN.DE` — SMALL_CAP
6. `QDVE / QDVE.DE` — TECHNOLOGY
7. `VVSM / VVSM.DE` — SEMICONDUCTORS
8. `XDWH / XDWH.DE` — HEALTHCARE
9. `EXH1 / EXH1.DE` — ENERGY
10. `ISPA / ISPA.DE` — DIVIDEND

Deben resultar válidos al menos 8/10. No se sustituye un activo por otro si falla coverage tras la apertura.

El uso de estos activos no pretende reconstruir un universo histórico completo ni elimina survivorship. La inferencia queda limitada a esta cohorte prospectiva preseleccionada.

## 4. Refreeze operativo pre-open de continuidad

Antes de abrir mercado se detectó un problema puramente operativo: exigir que la aplicación estuviera activa cada sesión produciría huecos accidentales en una validación DAILY. Eso no aporta independencia metodológica y sí puede romper la continuidad por una causa ajena a la señal.

Se congela por ello, **antes de la primera lectura Stage A**, el modo:

`DETERMINISTIC_POST_FREEZE_CAUSAL_CATCH_UP`

Reglas exactas:

- sigue prohibido cualquier backfill pre-freeze: ninguna sesión anterior a `2026-09-16` puede convertirse en observación Stage A;
- cada sesión de mercado completada desde el inicio congelado debe registrarse exactamente una vez para los diez activos;
- si la app no se ejecutó un día, la siguiente ejecución reconstruye las sesiones post-freeze faltantes **en orden cronológico, empezando por la más antigua**;
- no puede omitirse ni escoger una fecha según retorno, drawdown, contexto observado u outcome;
- el prefijo de mercado de cada activo termina exactamente en su `informationDate`;
- V5/V7 sólo pueden usar información disponible hasta esa misma fecha;
- la sesión posterior del activo ancla `EUNL` sirve únicamente para demostrar que la sesión anterior ya cerró; **esa sesión sucesora no entra en V5, V7 ni `PortfolioCandidateGate` para la fecha anterior**;
- el collector no puede leer outcomes de 63 sesiones;
- el máximo de 5 fechas pendientes por ejecución es sólo batching operativo; si quedan más, permanecen pendientes y deben procesarse después con las mismas reglas;
- una vez persistida una observación en estado durable, es inmutable.

Este refreeze **no cambia** fechas de muestra, activos, regla V8, threshold 80, definición del outcome, reach ni gates predictivos.

## 5. Contexto de decisión

Para cada fecha se reconstruye causalmente el prefijo histórico disponible y se evalúa el flujo existente hasta `PortfolioCandidateGate`.

Población primaria:

`PORTFOLIO_CANDIDATE_GATE_ELIGIBLE_WITH_CONTEXT_AVAILABLE`

Población secundaria descriptiva:

`ALL_GATE_EVALUABLE_WITH_CONTEXT_AVAILABLE`

Stage A no puede cambiar eligibility, ranking, sizing, cartera, órdenes ni ejecución.

## 6. Outcome predictivo congelado

Para cada observación:

- referencia: `NEXT_OPEN` de la sesión siguiente a `informationDate`;
- horizonte: 63 sesiones futuras;
- camino: `NEXT_OPEN` inicial seguido por cierres causales posteriores;
- métrica: máximo drawdown peak-to-trough dentro de esas 63 sesiones;
- evento de downside material: drawdown máximo `>= 5%`.

El collector de señal no importa ni ejecuta el evaluator de outcomes.

El outcome no se puede leer antes de que hayan transcurrido las 63 sesiones correspondientes. El veredicto final sólo puede calcularse cuando hayan madurado todas las observaciones pertenecientes a la ventana congelada.

## 7. Reach mínimo

Antes de juzgar capacidad predictiva deben cumplirse simultáneamente:

- >=200 observaciones `ELIGIBLE` evaluables;
- >=30 observaciones `ELIGIBLE` con contexto alto;
- >=100 observaciones `ELIGIBLE` con contexto normal;
- contexto alto en >=4 activos distintos;
- contexto alto en >=6 semanas naturales distintas;
- ningún activo aporta >35% de las observaciones `ELIGIBLE` de contexto alto.

Si no hay reach suficiente, el resultado es `INCONCLUSIVE`, no FAIL y no autorización para retunear.

## 8. Gate predictivo Stage A

Comparación primaria dentro de población `ELIGIBLE`:

`HIGH_RISK_CONTEXT` vs `NORMAL_CONTEXT`.

Para PASS deben cumplirse simultáneamente:

- tasa de downside material del grupo alto al menos **10 puntos porcentuales** superior a normal;
- risk ratio de downside material `>= 1.5`;
- mediana del máximo drawdown futuro al menos **1 punto porcentual** peor en contexto alto que en normal.

Estos umbrales se congelan antes de abrir Stage A y no proceden de observar los outcomes futuros.

## 9. Datos y causalidad

Obligatorio:

- precios `REAL`;
- V5 con macro vintage-safe point-in-time;
- V7 con índices Cboe observados;
- cero fallback `SYNTHETIC`;
- `informationDate` causal;
- si falta V5 o V7, contexto `UNAVAILABLE`;
- si un activo no dispone de datos REAL válidos, no puede aparecer como `ELIGIBLE`;
- fallo de proveedor deja la sesión pendiente para reconstrucción causal post-freeze; nunca autoriza sustitución ni datos sintéticos;
- `currentOpenDiscovery=false` durante toda reconstrucción Stage A.

## 10. Apertura y persistencia durable

El estado autoritativo se guarda en:

`replay-results/validation-runs/phase6-forward-risk-context-stage-a-state.json`

Reglas:

- requiere `GITHUB_REPLAY_SYNC_TOKEN`;
- la copia `.runtime` es sólo cache de recuperación, nunca autoridad;
- antes de la primera llamada de mercado el runner debe persistir `sampleState=OPENED_COLLECTING` y `openedAt` en el estado durable;
- por tanto, si el proveedor falla después, la muestra sigue correctamente registrada como abierta/consumida;
- cada observación queda encadenada por SHA-256 y no puede reescribirse silenciosamente;
- el collector persiste por fecha completa de diez activos, no por activo seleccionado según resultado.

## 11. Seal pre-open

El contrato queda sellado en:

`validation-runs/preregistration/phase6-forward-risk-context-stage-a-seal.json`

El seal fingerprinta por Git blob SHA-1 los archivos críticos de:

- protocolo Stage A;
- contexto V8/V5/V7;
- scanner/gate;
- collector;
- estado prospectivo y persistencia durable;
- evaluator predictivo.

`tests/phase6ForwardRiskContextStageASeal.unit.ts` comprueba fingerprints, apertura durable antes de mercado, causalidad del corte por `informationDate`, ausencia de acceso a outcomes en el collector, inmutabilidad/hash chain y mecánica pura del evaluator.

Mientras ese guard y TypeScript no hayan pasado en el HEAD sellado, **el collector REAL no se conecta al Centro de validación**.

## 12. Veredictos

Únicos estados permitidos:

- `STAGE_A_PASS_CANDIDATE_FOR_STAGE_B_POLICY_DESIGN`;
- `STAGE_A_FAIL_NO_INCREMENTAL_DOWNSIDE_INFORMATION`;
- `STAGE_A_INCONCLUSIVE_OUTCOMES_IMMATURE`;
- `STAGE_A_INCONCLUSIVE_INSUFFICIENT_REAL_DATA`;
- `STAGE_A_INCONCLUSIVE_INSUFFICIENT_INCREMENTAL_REACH`.

PASS no promociona producción. Únicamente permite diseñar Stage B.

La muestra Stage A quedará consumida para validar económicamente cualquier política diseñada después de verla: Stage B necesitará otra muestra fresh.

## 13. Estado antes de abrir

A fecha 2026-09-16:

- muestra y gates: congelados;
- continuity refreeze: congelado pre-open;
- collector/evaluator: implementados;
- persistencia durable/hash chain: implementada;
- seal: creado;
- collector REAL: **NO conectado al Centro de validación**;
- mercado/outcomes Stage A: **NO abiertos**;
- producción: `LEGACY`.

El siguiente job del Centro de validación sigue siendo exclusivamente estático. Debe demostrar `PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_SEAL_PASS`, después el freeze/readiness existente, arquitectura y TypeScript. Sólo tras ese PASS podrá habilitarse explícitamente el primer collector REAL.
