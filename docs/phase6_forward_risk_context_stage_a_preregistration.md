# Fase 6 — Forward Risk V8 como contexto — preregistro Stage A

Fecha de congelación: **2026-09-15**  
Estado: **FUTURE-FORWARD SAMPLE FROZEN / NOT OPENED / RESEARCH ONLY**

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
- frecuencia: DAILY, una observación máxima por activo y `informationDate`;
- sin backfill;
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

## 4. Contexto de decisión

Para cada fecha se reconstruye causalmente el prefijo histórico disponible y se evalúa el flujo existente hasta `PortfolioCandidateGate`.

Población primaria:

`PORTFOLIO_CANDIDATE_GATE_ELIGIBLE_WITH_CONTEXT_AVAILABLE`

Población secundaria descriptiva:

`ALL_GATE_EVALUABLE_WITH_CONTEXT_AVAILABLE`

Stage A no puede cambiar eligibility, ranking, sizing, cartera, órdenes ni ejecución.

## 5. Outcome predictivo congelado

Para cada observación:

- referencia: `NEXT_OPEN` de la sesión siguiente a `informationDate`;
- horizonte: 63 sesiones futuras;
- camino: `NEXT_OPEN` inicial seguido por cierres causales posteriores;
- métrica: máximo drawdown peak-to-trough dentro de esas 63 sesiones;
- evento de downside material: drawdown máximo `>= 5%`.

El outcome no se puede leer antes de que hayan transcurrido las 63 sesiones correspondientes.

El veredicto final sólo puede calcularse cuando hayan madurado todas las observaciones pertenecientes a la ventana congelada.

## 6. Reach mínimo

Antes de juzgar capacidad predictiva deben cumplirse simultáneamente:

- >=200 observaciones `ELIGIBLE` evaluables;
- >=30 observaciones `ELIGIBLE` con contexto alto;
- >=100 observaciones `ELIGIBLE` con contexto normal;
- contexto alto en >=4 activos distintos;
- contexto alto en >=6 semanas naturales distintas;
- ningún activo aporta >35% de las observaciones `ELIGIBLE` de contexto alto.

Si no hay reach suficiente, el resultado es `INCONCLUSIVE`, no FAIL y no autorización para retunear.

## 7. Gate predictivo Stage A

Comparación primaria dentro de población `ELIGIBLE`:

`HIGH_RISK_CONTEXT` vs `NORMAL_CONTEXT`.

Para PASS deben cumplirse simultáneamente:

- tasa de downside material del grupo alto al menos **10 puntos porcentuales** superior a normal;
- risk ratio de downside material `>= 1.5`;
- mediana del máximo drawdown futuro al menos **1 punto porcentual** peor en contexto alto que en normal.

Estos umbrales se congelan antes de abrir Stage A y no proceden de observar los outcomes futuros.

## 8. Datos y causalidad

Obligatorio:

- precios `REAL`;
- V5 con macro vintage-safe point-in-time;
- V7 con índices Cboe observados;
- cero fallback `SYNTHETIC`;
- `informationDate` causal;
- si falta V5 o V7, observación no disponible;
- fallo de proveedor = no observación, sin backfill posterior.

## 9. Veredictos

Únicos estados permitidos:

- `STAGE_A_PASS_CANDIDATE_FOR_STAGE_B_POLICY_DESIGN`;
- `STAGE_A_FAIL_NO_INCREMENTAL_DOWNSIDE_INFORMATION`;
- `STAGE_A_INCONCLUSIVE_OUTCOMES_IMMATURE`;
- `STAGE_A_INCONCLUSIVE_INSUFFICIENT_REAL_DATA`;
- `STAGE_A_INCONCLUSIVE_INSUFFICIENT_INCREMENTAL_REACH`.

PASS no promociona producción. Únicamente permite diseñar Stage B.

La muestra Stage A quedará consumida para validar económicamente cualquier política diseñada después de verla: Stage B necesitará otra muestra fresh.

## 10. Estado antes de abrir

Aún está prohibido consultar mercado/outcomes Stage A.

Antes de la primera observación prospectiva deben quedar implementados y sellados:

- collector/evaluator causal;
- persistencia durable e inmutable;
- no-backfill;
- fingerprint del runner y estado;
- guards arquitectónicos;
- TypeScript.

El siguiente job del Centro de validación será exclusivamente estático para comprobar este preregistro. No abre mercado ni consume muestra.
