# Fase 5 · protección de grandes ganadores · diseño pre-open

Fecha de diseño: **2026-09-13**  
Estado: **POLICY DESIGN FROZEN / SAMPLE NOT SEALED / HOLDOUT NOT OPENED / RESEARCH ONLY**

## 1. Objetivo

Evaluar si una protección causal y limitada de posiciones ganadoras puede reducir la devolución de beneficios sin destruir riqueza terminal frente a `CORE_ARCHITECTURE_V1`.

La hipótesis procede del diagnóstico consumido de HFG, pero HFG **no** valida esta política y no se utiliza para volver a ajustar parámetros. Cualquier muestra utilizada en HFG permanece consumida.

Producción continúa `LEGACY`.

## 2. Política candidata congelada

La política base ya existe en:

`src/investment/decision/trendProtectionPolicy.ts -> classifyTrendProtectionV2(...)`

No se crea V3 ni se retocan sus parámetros después de HFG.

Para Fase 5 se congela exclusivamente la **rama de protección de ganador** de `TREND_PROTECTION_V2`.

Parámetros heredados sin cambio de la implementación existente:

- MFE mínimo para armar protección: `8%`;
- giveback mínimo para armar: `6 pp`;
- giveback fuerte para ruptura confirmada: `8 pp`;
- confirmación por deterioro multiseñal: `3` sesiones;
- confirmación alternativa: `3` observaciones desde PROTECT y empeoramiento adicional de al menos `2 pp` desde el retorno de referencia al armar;
- reducción parcial por episodio: `25%`;
- una sola reducción parcial por episodio;
- un reclaim de tendencia corta desarma el episodio;
- no se encadenan reducciones por la misma ruptura.

La policy completa V2 también contiene lógica de tesis fallida/perdedor. **Esa rama queda fuera de Fase 5** para evitar mezclar la hipótesis “proteger grandes ganadores” con otra política económica distinta. La candidata Fase 5 sólo puede actuar cuando `winnerProtectionArmed === true`.

La fuente actual queda identificada por el blob Git de `trendProtectionPolicy.ts` existente al congelar este diseño. El seal final de Fase 5 deberá incluir ese blob y `tests/trendProtectionPolicy.unit.ts` antes de abrir el holdout.

## 3. Autoridad y límites de la candidata

La candidata será un overlay research-only dentro del replay/cadena existentes; no se crea un motor paralelo.

Reglas de autoridad:

1. baseline: `CORE_ARCHITECTURE_V1` sin overlay Fase 5;
2. candidato: mismo input, misma arquitectura y mismos datos, añadiendo únicamente la rama winner de `TREND_PROTECTION_V2`;
3. la candidata nunca convierte `PROTECT` o `WATCH` en una orden económica;
4. sólo `REDUCE` confirmado puede cambiar la trayectoria;
5. reducción exacta: `25%` una única vez por episodio;
6. si la cadena canónica ya ordena `REDUCE` o `EXIT`, esa acción canónica tiene prioridad y la candidata no la debilita, retrasa ni sustituye;
7. la candidata no crea BUY/ADD, no cambia ranking, no relaja gates, no aumenta sizing y no modifica el core;
8. la candidata no actúa sobre un instrumento marcado como `isDiversifiedCore=true`; la hipótesis se limita a ganadores satélite/listados no-core;
9. el estado del episodio debe evolucionar sólo con información disponible hasta cada `decisionDate`;
10. ejecución posterior a señal / `NEXT_OPEN` igual que el replay canónico.

## 4. Estado causal del episodio

Por activo, el overlay deberá mantener únicamente el estado mínimo que ya requiere V2:

- si existe episodio de protección armado;
- retorno de referencia al armar;
- número de observaciones protegidas;
- si la reducción del 25% ya fue ejecutada;
- si hubo reclaim y el episodio quedó cerrado.

No se utilizará información futura para MFE, giveback, streak ni reclaim.

Una reducción sólo cuenta como reach si la orden `REDUCE` fue realmente ejecutada por el replay. Una señal teórica suprimida por ejecución/costes no cuenta.

## 5. Integración prevista

La integración deberá realizarse en el wrapper research existente `runDynamicReplayWithRotationExperiment(...)`, no en un replay nuevo.

Punto conceptual:

`PortfolioDecisionEngine.evaluate -> CORE_GATE_V1 -> [overlay winner V2 research-only] -> CORE_ARCHITECTURE_V1 -> ejecución replay`

El overlay sólo puede añadir un `REDUCE 25%` winner-protection cuando la decisión canónica todavía no contiene un `REDUCE/EXIT` más fuerte. Después, `CORE_ARCHITECTURE_V1` conserva su tratamiento normal del resto de la cartera y de los proceeds.

La producción y el replay canónico sin opción research deben permanecer bit-a-bit semánticamente en su comportamiento actual.

## 6. Baseline y comparabilidad

Baseline y candidato deben compartir:

- misma muestra;
- mismo estado inicial;
- mismo capital;
- mismo cash;
- mismos `externalCashFlows`;
- mismas fechas de decisión;
- mismo `CORE_ARCHITECTURE_V1`;
- misma fiscalidad;
- mismos costes;
- mismo cash benchmark;
- misma procedencia REAL;
- misma ejecución causal;
- mismo sample-selection rule.

La única diferencia autorizada es el `REDUCE 25%` winner-protection descrito arriba.

## 7. Métricas congeladas antes de la muestra

### Métrica económica primaria

`finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur`

La política sólo es económicamente útil si conserva más riqueza terminal de forma material; evitar giveback no basta si el coste es perder demasiado upside posterior.

### Métricas de mecanismo/diagnóstico

Se reportarán, sin sustituir la métrica primaria:

- episodios winner-protection armados;
- reducciones winner-protection ejecutadas;
- reclaim posteriores;
- MFE causal al armar;
- giveback causal al armar y al ejecutar;
- retorno preservado/perdido después de la reducción;
- `profitCaptureRatioPct` cuando sea definible;
- comisiones, impuestos y turnover incrementales;
- diferencia de max drawdown;
- operación count delta.

Estas métricas sirven para explicar **por qué** funcionó o falló la política, no para cambiar sus parámetros después de abrir la muestra.

## 8. Reach predefinido

Antes del holdout, la muestra deberá diseñarse sin utilizar outcomes futuros de la policy y deberá permitir una posibilidad razonable de observar ganadores, pero la promoción exige reach ejecutado real.

Reach mínimo congelado para una validación de 6 cohortes:

- al menos `6` reducciones winner-protection únicas realmente ejecutadas en total;
- al menos `4/6` cohortes con una reducción winner-protection ejecutada.

Clave de episodio deduplicada:

`assetId + protectionArmDate + protectionReduceExecutionDate`

Si no se alcanza reach:

`INCONCLUSIVE_INSUFFICIENT_WINNER_PROTECTION_REACH`.

No se rebajan estos mínimos después de abrir la muestra.

## 9. Materialidad y PASS/FAIL

La validación deberá usar 6 cohortes emparejadas y sólo podrá declarar:

### PASS_CANDIDATE_FOR_CONFIRMATION

si simultáneamente:

1. 6/6 cohortes pasan data gate;
2. reach suficiente;
3. al menos 4/6 cohortes tienen `finalValueDeltaEur > 0`;
4. mediana de `finalValueDeltaEur > 0`;
5. la mediana supera `max(0,5% del capital económico expuesto, mediana de costes incrementales positivos)`;
6. mediana de deterioro de max drawdown <= `+0,5 pp`;
7. ninguna cohorte tiene `finalValueDeltaEur < -5%` del capital inicial de esa cohorte;
8. ninguna cohorte deteriora max drawdown en más de `+3 pp`;
9. ningún resultado depende de un único episodio extremo para cambiar el signo agregado.

Un PASS sólo habilita confirmación independiente. No promociona producción.

### FAIL_RETIRED_AS_TESTED

Reach suficiente pero no se cumplen los gates económicos/daño. La policy exacta queda retirada en la forma probada y no se retunea con esa muestra.

### INCONCLUSIVE_*

Datos insuficientes, reach insuficiente o fallo de infraestructura que impida una comparación válida. No es PASS ni FAIL económico y no autoriza retuning sobre la muestra consumida.

## 10. Datos y muestra — todavía NO sellados

A fecha de este diseño:

- no se ha elegido ni abierto el pool fresh de Fase 5;
- no se ha consultado ningún activo como muestra Fase 5;
- no existe seal Fase 5;
- no se ha ejecutado ningún outcome Fase 5.

Antes de abrir el holdout deberán fijarse y sellarse:

- ventana temporal;
- data request start;
- core válido y su preflight si se utiliza;
- pool fresh y exclusiones de identidades consumidas;
- regla de selección ciega basada sólo en información permitida pre-replay;
- tamaño de cohortes;
- mínimo causal de barras;
- REAL-only;
- current discovery histórico OFF;
- datos/fingerprints críticos;
- job único integrado en `ResearchValidationCenter`.

No se permite usar HFG, R2/R3 de Fase 4 ni otros outcomes consumidos para seleccionar retrospectivamente los activos que “mejor” hagan funcionar la protección.

## 11. Siguiente paso permitido

El siguiente trabajo pre-open es diseñar **la muestra Fase 5 y su preflight**, comprobando disponibilidad de datos sin observar outcomes económicos de la candidata.

Sólo después de cerrar y sellar muestra + implementación + guards podrá ejecutarse una única validación fresh/blind/OOS.
