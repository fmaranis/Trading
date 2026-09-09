# QUALITY_ALLOCATION_FUTURE_FORWARD_V1 — preregistro

Fecha de congelación: **2026-09-09**.

Primera fecha elegible de resultado: **2026-09-10**.

HEAD de código previo al preregistro: `479b1a1efa2576caf2be11790d9fc9a6cd2fb10c`.

## Pregunta

Una vez demostrado que el capital explícito permite a QUALITY alcanzar el allocator y las ejecuciones, ¿aporta `QUALITY_ALLOCATION_BRIDGE_V1` valor económico prospectivo frente a `LEGACY` sin empeorar materialmente el riesgo?

## Políticas congeladas

Control/productivo: `LEGACY`.

Candidato shadow: `QUALITY_ALLOCATION_BRIDGE_V1`.

No se modifica la fórmula ya consumida:

`candidateQualityAdjustment = (reliability - 50) * 0.10 + (opportunity - 50) * 0.20`

`qualityMultiplier = clamp(1 + candidateQualityAdjustment / 100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

No se permite tuning después de la congelación.

## Arquitectura

Ambos brazos usan `CORE_ARCHITECTURE_V1` y el mismo flujo:

`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine -> ejecución`.

QUALITY se introduce únicamente como opción research-only del allocator existente.

No se modifica `PortfolioCandidateGate`, timing, slots, caps, fiscalidad, cash hurdle, starter/build ni rotaciones.

Forward Risk queda expresamente fuera de este experimento.

## Universo congelado

Se congela una copia independiente de los **64 activos** que componían `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` el 2026-09-09.

No entran:

- futuros `OPEN_*` descubiertos después de la congelación;
- `EUR_VALIDATION_HOLDOUT_UNIVERSE`;
- activos añadidos posteriormente al catálogo productivo.

Esto evita cambiar retrospectivamente el universo después de observar resultados.

Limitación retenida: sigue sin ser un instrument master histórico point-in-time completo; es un universo actual congelado prospectivamente desde su fecha de registro.

## Datos y causalidad

- REAL-only;
- current Yahoo discovery: OFF dentro del checkpoint;
- barras anteriores al 2026-09-10 sólo sirven como warmup causal para features;
- ningún resultado anterior al 2026-09-10 cuenta como evidencia Phase A;
- las decisiones sólo utilizan prefixes disponibles en su fecha;
- ejecución posterior a señal según la arquitectura existente.

## Continuidad prospectiva / historial inmutable

La fase no puede recalcular dentro de unos meses el período forward completo con código nuevo y aceptar silenciosamente una historia diferente.

Por ello existe un estado runtime local:

`.runtime/quality-allocation-future-forward-v1-state.json`

`.runtime/` está excluido de Git y este mecanismo no usa GitHub Actions ni auto-commits.

El primer checkpoint debe crear el baseline **antes de que existan outcomes posteriores a la fecha elegible**. Si el baseline falta cuando los datos REAL ya superan el 2026-09-10, la fase no puede reconstruirse retrospectivamente y queda invalidada.

El estado conserva:

- fingerprint SHA-256 del protocolo congelado;
- fingerprint SHA-256 del universo congelado;
- última fecha REAL cerrada;
- hash del prefijo de decisiones LEGACY ya observado;
- hash del prefijo de decisiones QUALITY ya observado.

En cada checkpoint posterior se vuelve a calcular únicamente para verificar continuidad. Todo prefijo ya observado debe coincidir exactamente con el hash anterior.

Si cambia una decisión pasada, un plan pasado o una ejecución que ya era observable en la fecha bloqueada, el estado es:

`PHASE_A_INVALIDATED_FORWARD_HISTORY_DRIFT_KEEP_LEGACY`.

El hash previo no se sobreescribe.

Una señal generada en el último día bloqueado puede ejecutarse legítimamente después mediante `NEXT_OPEN`; esa ejecución futura no se considera reescritura porque sólo se bloquean hechos de ejecución ya observables hasta la fecha cerrada.

Si cambia el protocolo o el universo respecto al fingerprint persistido:

`PHASE_A_INVALIDATED_FROZEN_CONTRACT_DRIFT_KEEP_LEGACY`.

Si falta el baseline después de comenzar los outcomes:

`PHASE_A_INVALIDATED_MISSING_FORWARD_BASELINE_KEEP_LEGACY`.

En cualquier invalidación producción continúa `LEGACY`; no se permite tuning ni promoción.

## Configuración común

- frecuencia: MONTHLY;
- capital inicial: 13.000 EUR;
- riesgo: MEDIUM;
- horizonte: 3 años;
- cash: histórico BCE cuando corresponda;
- fiscalidad: configuración existente;
- `minimumBars: 252`.

## Flujos externos de investigación

Se mantiene el fixture ya utilizado para asegurar reach del allocator:

**1.000 EUR/mes research-only**.

No es:

- default de producción;
- recomendación de ahorro;
- supuesto sobre las aportaciones reales del usuario;
- consecuencia de frecuencia MONTHLY.

Ambos brazos reciben exactamente los mismos flujos explícitos.

## Madurez mínima — congelada antes de resultados

No se permite interpretación económica Phase A antes de:

**252 sesiones forward**.

Hasta entonces el estado normal es:

`ACCUMULATING_FUTURE_DATA`.

Los deltas económicos pueden guardarse como telemetría diagnóstica, pero no interpretarse como PASS/FAIL ni utilizarse para cambiar parámetros.

## Gate de reach Phase A

A partir de 252 sesiones, el candidato sólo es económicamente evaluable si alcanza simultáneamente:

- >= 3 gates donde cambie el plan de allocation;
- >= 8 fechas con adquisiciones ejecutadas distintas;
- >= 1.000 EUR de diferencia absoluta de notional ejecutado.

Si no alcanza ese reach:

`PHASE_A_INCONCLUSIVE_INSUFFICIENT_REACH_KEEP_LEGACY`.

No se retunea.

## Gate económico Phase A

Sólo si el gate de reach pasa:

- delta de `cashFlowAdjustedReturnPct` QUALITY - LEGACY >= **+0,50 puntos porcentuales**;
- delta de valor final QUALITY - LEGACY > **0 EUR**;
- QUALITY no puede empeorar el max drawdown en más de **1,0 pp**.

Si falla:

`PHASE_A_FAIL_KEEP_LEGACY`.

Si pasa:

`PHASE_A_CANDIDATE_FOR_CONFIRMATION`.

## Importante: Phase A no promociona

Incluso `PHASE_A_CANDIDATE_FOR_CONFIRMATION` sólo autoriza diseñar una segunda confirmación fresh congelada por separado.

No cambia producción automáticamente.

Producción permanece `LEGACY` durante toda Phase A.

## Estados permitidos

Estados normales:

- `ACCUMULATING_FUTURE_DATA`;
- `PHASE_A_INCONCLUSIVE_INSUFFICIENT_REACH_KEEP_LEGACY`;
- `PHASE_A_FAIL_KEEP_LEGACY`;
- `PHASE_A_CANDIDATE_FOR_CONFIRMATION`.

Estados de invalidación de integridad:

- `PHASE_A_INVALIDATED_FORWARD_HISTORY_DRIFT_KEEP_LEGACY`;
- `PHASE_A_INVALIDATED_FROZEN_CONTRACT_DRIFT_KEEP_LEGACY`;
- `PHASE_A_INVALIDATED_MISSING_FORWARD_BASELINE_KEEP_LEGACY`.

No existe un estado de promoción directa en V1.
