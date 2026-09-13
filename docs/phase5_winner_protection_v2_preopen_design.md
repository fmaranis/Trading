# Fase 5 · protección de grandes ganadores · diseño pre-open

Fecha de diseño: **2026-09-13**  
Estado: **POLICY FROZEN / SAMPLE SEALED / BLIND NOT OPENED / RESEARCH ONLY**

## 1. Objetivo

Evaluar si una protección causal y limitada de posiciones ganadoras puede reducir la devolución de beneficios sin destruir riqueza terminal frente a `CORE_ARCHITECTURE_V1`.

La hipótesis procede del diagnóstico consumido de HFG, pero HFG **no** valida esta política y no se utiliza para volver a ajustar parámetros. Producción continúa `LEGACY`.

## 2. Política candidata congelada

La política base ya existe en:

`src/investment/decision/trendProtectionPolicy.ts -> classifyTrendProtectionV2(...)`

No se crea V3 ni se retocan sus parámetros.

Para Fase 5 se congela exclusivamente la **rama de protección de ganador** de `TREND_PROTECTION_V2`:

- MFE mínimo para armar protección: `8%`;
- giveback mínimo para armar: `6 pp`;
- giveback fuerte para ruptura confirmada: `8 pp`;
- confirmación por deterioro multiseñal: `3` sesiones;
- confirmación alternativa: `3` observaciones desde PROTECT y empeoramiento adicional de al menos `2 pp` desde el retorno de referencia al armar;
- reducción parcial por episodio: `25%`;
- una sola reducción parcial por episodio;
- un reclaim de tendencia corta desarma el episodio;
- no se encadenan reducciones por la misma ruptura.

La policy completa V2 también contiene lógica de tesis fallida/perdedor. **Esa rama queda fuera de Fase 5**. La integración winner-only conserva la estructura de tendencia de V2 pero neutraliza los votos/score adversos que activan la rama de perdedor; no modifica `trendProtectionPolicy.ts`.

## 3. Autoridad y límites

La candidata es un overlay research-only dentro del wrapper existente `runDynamicReplayWithRotationExperiment(...)`; no se crea un replay ni motor paralelo.

Reglas:

1. baseline: `CORE_ARCHITECTURE_V1` sin overlay Fase 5;
2. candidato: mismo input, misma arquitectura y mismos datos, añadiendo únicamente winner-only V2;
3. `PROTECT`/`WATCH` no son órdenes;
4. sólo un `REDUCE 25%` confirmado puede alterar la trayectoria;
5. una única reducción por episodio;
6. cualquier `REDUCE/EXIT` canónico más fuerte tiene prioridad;
7. no crea BUY/ADD, no cambia ranking, gates, core ni sizing;
8. no actúa sobre `isDiversifiedCore=true`;
9. estado causal sólo hasta cada `decisionDate`;
10. ejecución económica posterior a señal / `NEXT_OPEN`;
11. reach cuenta únicamente `REDUCE` etiquetados por Fase 5 y realmente ejecutados por el replay.

Punto integrado:

`PortfolioDecisionEngine.evaluate -> CORE_GATE_V1 -> [winner V2 research-only] -> CORE_ARCHITECTURE_V1 -> ejecución replay`

El default sin `winnerProtectionPolicy` sigue `LEGACY`.

## 4. Estado causal del episodio

Por activo se conserva únicamente:

- episodio armado;
- `protectionArmDate`;
- retorno de referencia al armar;
- número de observaciones protegidas;
- reducción propuesta/pendiente;
- reducción realmente ejecutada;
- reclaim/reset;
- unidades observadas para confirmar que la reducción se ejecutó.

MFE, giveback, streak y reclaim proceden exclusivamente de información disponible hasta la fecha de decisión. Una propuesta que no reduzca realmente unidades no cuenta como reach.

## 5. Baseline y comparabilidad

Baseline y candidato comparten:

- la misma cohorte;
- el mismo estado inicial;
- `13.000 EUR`;
- mismo cash;
- sin `externalCashFlows`;
- mismas fechas DAILY;
- mismo `CORE_ARCHITECTURE_V1`;
- misma fiscalidad;
- mismos costes;
- cash BCE histórico con suelo 0%;
- datos `REAL`;
- misma ejecución causal;
- misma regla de selección.

La única diferencia autorizada es winner-only V2.

### Estado inicial congelado

Cada cohorte contiene 3 activos sellados y arranca como **cartera manual igual ponderada**:

- los `13.000 EUR` se distribuyen a partes iguales entre los tres activos, ajustando sólo céntimos para que la suma sea exactamente 13.000 EUR;
- cash inicial: `0 EUR`;
- esa cartera es estado inicial, no una recomendación del motor;
- no se seleccionan ganadores mirando el futuro: cada activo empieza con retorno de posición 0 y sólo puede convertirse causalmente en ganador durante el replay.

Este diseño condiciona correctamente la pregunta económica: qué ocurre cuando una posición ya poseída alcanza MFE suficiente y posteriormente deteriora tendencia.

## 6. Métrica y diagnósticos congelados

Métrica primaria:

`finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur`

Diagnósticos:

- episodios armados;
- reducciones ejecutadas;
- reclaims;
- MFE/giveback/retorno causal en la señal;
- `profitCaptureRatioPct` cuando sea definible;
- efecto terminal del slice vendido frente a haber mantenido esas unidades;
- fees/impuestos incrementales;
- max drawdown delta;
- operation count delta.

Los diagnósticos explican el mecanismo; no permiten retunear tras abrir la muestra.

## 7. Reach congelado

Para 6 cohortes:

- al menos `6` reducciones winner-protection únicas realmente ejecutadas;
- al menos `4/6` cohortes con una reducción ejecutada.

Clave:

`assetId + protectionArmDate + protectionReduceExecutionDate`

Si no se alcanza:

`INCONCLUSIVE_INSUFFICIENT_WINNER_PROTECTION_REACH`.

## 8. Gates económicos congelados

Sólo puede declararse `PASS_CANDIDATE_FOR_CONFIRMATION` si simultáneamente:

1. 6/6 cohortes pasan data gate;
2. reach suficiente;
3. al menos 4/6 cohortes tienen `finalValueDeltaEur > 0`;
4. mediana `finalValueDeltaEur > 0`;
5. mediana > `max(0,5% de 13.000 EUR, mediana de costes incrementales positivos)`;
6. mediana de deterioro de max drawdown <= `+0,5 pp`;
7. ninguna cohorte tiene `finalValueDeltaEur < -5%` de 13.000 EUR;
8. ninguna cohorte deteriora max drawdown > `+3 pp`;
9. **dominancia**: la suma agregada de `finalValueDeltaEur` debe seguir siendo positiva incluso eliminando la cohorte con mayor delta positivo.

El punto 9 cuantifica antes del blind la regla “el resultado no depende de un único caso extremo”.

Con reach suficiente pero sin todos los gates:

`FAIL_RETIRED_AS_TESTED`.

Un PASS sólo habilita confirmación independiente; no cambia producción.

## 9. Ventana y preflights

Configuración final:

- data request start: `1998-01-02`;
- replay: `2001-01-03 -> 2003-12-31`;
- DAILY;
- 13.000 EUR por cohorte;
- MEDIUM;
- horizonte nominal 3 años;
- BCE DFR histórico floor 0;
- `contextConfirmed:false`;
- sin flows;
- current discovery histórico OFF;
- mínimo causal: 252 barras.

### Preflight #1 — FAIL CLOSED

La frontera original `2000-01-03` produjo sólo `10/26` coverage-eligible porque muchas series Yahoo comienzan exactamente ese día. Resultado:

- `selected: []`;
- `cohorts: []`;
- ningún baseline/candidato;
- ningún outcome económico.

Se refijó sólo el inicio a `2001-01-03`, conservando pool, thresholds, 252 barras, end date y 6x3. La modificación se basó exclusivamente en cobertura/listing.

### Preflight #2 — PASS

El usuario ejecutó el preflight refijado y reportó **PASSED**. La selección queda determinada por la regla ya congelada: coverage REAL + 252 barras pre-replay + orden SHA-256 fijo. El preflight no ejecutó baseline/candidato ni calculó retornos económicos de la política.

## 10. Muestra final sellada

Pool original: 26 identidades `EQ_PH5_*`, sin current discovery y excluyendo HFG/R2/R3 consumidos.

Muestra final 18, en orden sellado:

1. `FER.MC`
2. `RHM.DE`
3. `ENEL.MI`
4. `UCG.MI`
5. `OR.PA`
6. `ASML.AS`
7. `REP.MC`
8. `DTE.DE`
9. `SAN.PA`
10. `ENI.MI`
11. `SAP.DE`
12. `SU.PA`
13. `ADS.DE`
14. `BBVA.MC`
15. `TTE.PA`
16. `AI.PA`
17. `BNP.PA`
18. `ISP.MI`

Cohortes disjuntas:

- C1: `FER.MC / RHM.DE / ENEL.MI`
- C2: `UCG.MI / OR.PA / ASML.AS`
- C3: `REP.MC / DTE.DE / SAN.PA`
- C4: `ENI.MI / SAP.DE / SU.PA`
- C5: `ADS.DE / BBVA.MC / TTE.PA`
- C6: `AI.PA / BNP.PA / ISP.MI`

La identidad sellada está codificada en `scripts/phase5WinnerProtectionV2SealedSample.ts`.

## 11. Apertura y consumo

Antes del blind debe existir un seal Git de todos los archivos metodológicos/ejecutables críticos y el job debe ejecutar:

1. readiness;
2. seal guard;
3. `trendProtectionPolicy.unit.ts`;
4. integración winner-only;
5. arquitectura/gates/paridad/superficie/cash;
6. TypeScript;
7. blind REAL one-shot.

Los pasos 1–6 no consumen outcomes. El blind verifica el seal **antes** de pedir el sample.

La muestra pasa a:

`PHASE5_OPENED_CONSUMED`

en la primera solicitud de market data del runner blind sellado. Desde ese momento ningún fallo permite cambiar thresholds, sizing, ventana, frecuencia, muestra, reach ni gates usando lo observado.

## 12. Estado pre-open

A cierre de este documento:

- política congelada;
- primer preflight coverage-only falló cerrado;
- ventana refijada por cobertura antes de outcomes;
- segundo preflight coverage-only: PASS;
- 18 identidades y 6 cohortes: selladas;
- integración winner-only: preparada dentro del wrapper canónico;
- runner blind: preparado;
- baseline/candidato económico: **NO EJECUTADO**;
- holdout económico: **NO ABIERTO / NO CONSUMIDO**;
- producción: `LEGACY`.

El único siguiente paso permitido, después de crear y verificar el seal final, es ejecutar **una sola vez** el blind desde el mismo `ResearchValidationCenter`.
