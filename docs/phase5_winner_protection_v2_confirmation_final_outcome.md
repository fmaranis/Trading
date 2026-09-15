# Fase 5 · TREND_PROTECTION_V2 winner-only · resultado final de confirmación

Fecha de cierre: **2026-09-15**  
Estado: **CONFIRMATION CONSUMED / FAIL / NO PROMOTION / PRODUCTION LEGACY**

## 1. Resultado autoritativo

La confirmación temporal independiente de `TREND_PROTECTION_V2_WINNER_ONLY` fue ejecutada una única vez sobre la muestra sellada `2005-01-10 -> 2007-12-31` y quedó consumida.

La evidencia original quedó persistida en la rama durable `replay-results` a pesar de que el cliente local agotó su timeout mientras esperaba la respuesta del `PUT`.

Evidencia autoritativa:

- job: `phase5-winner-protection-v2-confirmation`;
- evidence kind: `ORIGINAL_VALIDATION`;
- durable commit: `db720e1993e90db1dd245ca312560deac36d5871`;
- durable blob: `2c516372946f4d6432d263935befd9e2658f5f20`;
- result version: `PHASE5_WINNER_PROTECTION_V2_CONFIRMATION_V1`;
- sample state: `PHASE5_CONFIRMATION_OPENED_CONSUMED`;
- verdict: **`CONFIRMATION_FAIL_NO_PROMOTION`**;
- production default: **`LEGACY`**.

El timeout del proceso cliente no invalida el resultado: GitHub creó el commit `ORIGINAL_VALIDATION` y conserva el JSON original completo. No debe repetirse la confirmación.

## 2. Integridad y reach

La confirmación preservó:

- los mismos 18 activos del primer blind;
- las mismas 6 cohortes de 3 activos;
- la misma política `TREND_PROTECTION_V2_WINNER_ONLY`;
- el mismo sizing y los mismos gates congelados;
- datos REAL Yahoo Finance;
- ejecución `NEXT_OPEN`;
- producción `LEGACY`.

Reach observado:

- reducciones winner-protection únicas ejecutadas: **63**;
- cohortes con al menos una reducción ejecutada: **6/6**;
- mínimo preregistrado: 6 reducciones y 4 cohortes;
- gate de reach: **PASS**.

Por tanto, el FAIL no se debe a falta de reach.

## 3. Resultado económico por cohorte

`finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur`

- cohorte 1: **+667,8933 EUR**;
- cohorte 2: **-272,6931 EUR**;
- cohorte 3: **+277,6655 EUR**;
- cohorte 4: **-1.852,9970 EUR**;
- cohorte 5: **-256,6872 EUR**;
- cohorte 6: **-1.216,5884 EUR**.

Resumen:

- cohortes positivas: **2/6** frente a 4/6 requeridas -> **FAIL**;
- mediana `finalValueDeltaEur`: **-264,6901 EUR** -> **FAIL**;
- delta agregado: **-2.653,4068 EUR**;
- mayor delta positivo: **+667,8933 EUR**;
- agregado eliminando la mejor cohorte: **-3.321,3002 EUR** -> gate de dominancia **FAIL**.

## 4. Materialidad y guardrails

Materialidad congelada:

- beneficio mediano observado: **-264,6901 EUR**;
- umbral de materialidad: **425,3849 EUR**;
- mediana de costes incrementales positivos: **425,3849 EUR**;
- gate: **FAIL**.

Drawdown:

- mediana de deterioro de max drawdown: **-4,4208 pp**;
- máximo permitido: `+0,5 pp`;
- gate: **PASS**.

Daño por cohorte:

- peor delta terminal: **-1.852,9970 EUR**;
- mínimo permitido: **-650 EUR**;
- gate de daño terminal: **FAIL**.

Drawdown individual:

- peor deterioro de max drawdown: **-1,0775 pp**;
- máximo permitido: `+3 pp`;
- gate: **PASS**.

La política redujo drawdown de forma clara en esta muestra, pero no convirtió esa reducción de riesgo en una mejora robusta de riqueza terminal.

## 5. Interpretación metodológica

El primer blind 2001–2003 terminó `PASS_CANDIDATE_FOR_CONFIRMATION`, pero la réplica temporal independiente 2005–2007 no confirmó el efecto económico.

La interpretación correcta es:

- `TREND_PROTECTION_V2_WINNER_ONLY` **sí tuvo reach suficiente**;
- mostró capacidad de reducir drawdown en la confirmación;
- **no replicó** la mejora de riqueza terminal del primer blind;
- sólo 2/6 cohortes mejoraron;
- el resultado agregado y la mediana fueron negativos;
- una cohorte sufrió un daño terminal muy superior al guardrail permitido.

Por tanto, la política **no se promociona a producción**.

Este resultado no debe reinterpretarse como que la información de deterioro de tendencia carece de valor. Igual que en Forward Risk, debe separarse la calidad informativa/señal de la calidad de una política económica concreta para monetizarla.

## 6. Decisión

- producción permanece **`LEGACY`**;
- `TREND_PROTECTION_V2_WINNER_ONLY` queda **retirada como candidata de promoción en la forma probada**;
- no se crea una V3/V4 cambiando retrospectivamente MFE, giveback, número de observaciones, worsening o porcentaje de reducción sobre las muestras 2001–2003 y 2005–2007;
- ambas muestras quedan consumidas para promoción de una política derivada;
- los resultados pueden utilizarse para diagnóstico arquitectónico y para separar efecto sobre drawdown de efecto sobre riqueza terminal;
- cualquier política futura deberá formular una hipótesis nueva, congelarla antes de abrir datos adecuados y validarla fresh/blind/OOS.

## 7. Incidencia de persistencia

El proceso local informó `TimeoutError` durante `saveDurableResearchValidationEvidence`, pero la operación GitHub había completado server-side y creó el commit durable original.

Consecuencia operativa:

- no repetir el one-shot;
- el resultado autoritativo es el JSON del commit durable citado arriba;
- queda como hardening pendiente evitar que un timeout de confirmación del cliente se presente como fallo cuando el write remoto ya se ha materializado.

Este hardening de infraestructura no modifica ni reabre la evidencia económica consumida.
