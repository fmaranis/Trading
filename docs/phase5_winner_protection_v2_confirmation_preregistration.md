# Fase 5 · TREND_PROTECTION_V2 winner-only · confirmación independiente

Fecha de preregistro: **2026-09-14**  
Estado: **PREREGISTERED / COVERAGE PREFLIGHT ONLY / CONFIRMATION NOT OPENED / RESEARCH ONLY / PRODUCTION LEGACY**

## 1. Objetivo

El primer blind fresh/OOS de `TREND_PROTECTION_V2_WINNER_ONLY` terminó `PASS_CANDIDATE_FOR_CONFIRMATION`. Según `docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md`, ese PASS no autoriza producción: exige una segunda confirmación independiente con la misma política congelada sin cambios.

Esta confirmación responde únicamente a:

> ¿La mejora económica observada en el primer blind se replica en un bloque temporal independiente cuando se mantienen exactamente la misma política, los mismos activos, las mismas cohortes, el mismo sizing, la misma arquitectura y los mismos gates?

No se diseña una V3, no se ajusta V2 y no se utiliza el outcome 2001–2003 para seleccionar parámetros ni activos.

## 2. Independencia de la muestra

La confirmación será una **réplica temporal**, no una nueva selección transversal.

Se mantienen:

- los **mismos 18 activos** sellados en el primer blind;
- las **mismas 6 cohortes** de 3 activos;
- el mismo estado inicial y capital;
- la misma política winner-only V2;
- los mismos criterios de reach, dirección, materialidad y daño.

No existe reselección por retorno, drawdown, MFE, giveback, resultado de la primera muestra ni comportamiento posterior. La regla es explícitamente **sin retuning y sin reselección**.

Esto elimina el grado de libertad de escoger una nueva combinación de nombres después de haber visto qué cohortes funcionaron mejor o peor en 2001–2003.

## 3. Regla temporal congelada

Primer blind consumido:

- data request: desde `1998-01-02`;
- ventana económica: `2001-01-03 -> 2003-12-31`.

Confirmación:

- data start / warm-up no puntuado: **`2004-01-02`**;
- replay económico: **`2005-01-03 -> 2007-12-31`**;
- frecuencia: `DAILY`;
- horizonte nominal: 3 años.

La regla temporal se fija antes de consultar outcomes de confirmación:

> usar el siguiente bloque cronológico limpio de tres años posterior al primer blind, precedido por un año completo de warm-up también posterior al blind, y terminar antes de las muestras consumidas de Fase 4 R3 y de las ventanas de evaluación Forward Risk iniciadas en 2011.

El año 2004 es únicamente **warm-up causal**. No forma parte de la métrica económica primaria ni se puntúa como outcome. El request de confirmación comienza después del 31/12/2003, por lo que ni siquiera el warm-up se solapa con el primer blind consumido.

La ventana no se ha elegido por conocer su rentabilidad, crisis, drawdown, comportamiento de los activos o facilidad para producir reducciones winner-protection.

## 4. Muestra congelada

Cohorte 1:

- `FER.MC`
- `RHM.DE`
- `ENEL.MI`

Cohorte 2:

- `UCG.MI`
- `OR.PA`
- `ASML.AS`

Cohorte 3:

- `REP.MC`
- `DTE.DE`
- `SAN.PA`

Cohorte 4:

- `ENI.MI`
- `SAP.DE`
- `SU.PA`

Cohorte 5:

- `ADS.DE`
- `BBVA.MC`
- `TTE.PA`

Cohorte 6:

- `AI.PA`
- `BNP.PA`
- `ISP.MI`

No se sustituirá un activo por otro porque tenga cobertura incómoda o porque el resultado económico sea desfavorable. Antes de abrir outcomes sólo se permite un preflight de cobertura REAL. Si la muestra completa no es técnicamente evaluable, la confirmación no se abre y cualquier solución posterior deberá documentarse antes de conocer outcomes económicos.

## 5. Política congelada sin cambios

Candidata:

`TREND_PROTECTION_V2_WINNER_ONLY`

Se conserva exactamente:

- MFE mínimo de armado: 8%;
- giveback mínimo: 6 pp;
- giveback fuerte: 8 pp;
- confirmación: 3 sesiones o 3 observaciones protegidas + 2 pp de empeoramiento;
- una única reducción del 25% por episodio;
- reclaim desarma/reset;
- no actúa sobre `isDiversifiedCore=true`;
- `REDUCE/EXIT` canónico más fuerte prevalece;
- `PROTECT/WATCH` no ejecutan operación;
- rama loser/failure neutralizada para esta investigación.

No se retoca ninguna constante después del PASS inicial.

## 6. Arquitectura y estado económico

Baseline:

`CORE_ARCHITECTURE_V1`

Candidato:

`CORE_ARCHITECTURE_V1 + TREND_PROTECTION_V2_WINNER_ONLY`

Integración research-only existente:

`PortfolioDecisionEngine.evaluate -> CORE_GATE_V1 -> [winner V2 overlay] -> CORE_ARCHITECTURE_V1 -> ejecución replay`

Estado inicial por cohorte:

- `13.000 EUR`;
- modo `MANUAL`;
- tres activos a partes iguales;
- cash inicial 0;
- `MEDIUM`;
- `DAILY`;
- BCE DFR histórico con suelo nominal 0%;
- sin `externalCashFlows`;
- ejecución `NEXT_OPEN`;
- current discovery histórico OFF;
- datos REAL Yahoo Finance.

La cartera inicial es estado inicial de investigación, no recomendación del motor.

## 7. Preflight permitido antes de abrir la confirmación

El único trabajo con datos permitido en esta etapa es coverage-only:

- exactamente los 18 tickers ya sellados;
- provider `yahoo_finance`;
- currency `EUR`;
- OHLC íntegro, fechas únicas y monotónicas;
- al menos 252 barras causales anteriores a `2005-01-03`;
- cobertura hasta diciembre de 2007;
- 6 cohortes x3 intactas;
- current discovery histórico OFF.

El preflight **no puede**:

- ejecutar baseline o candidato;
- calcular `finalValueDeltaEur`;
- calcular retorno o drawdown comparativo;
- mirar MFE/giveback de outcomes;
- contar reach económico del overlay;
- cambiar activos o cohortes.

Estado actual:

**baseline/candidato económico: NO EJECUTADO**.

La confirmación permanece **NOT OPENED** hasta que exista seal posterior al preflight y se ejecute por primera vez el runner económico sellado.

## 8. Métrica primaria y diagnósticos

Métrica primaria idéntica al primer blind:

`finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur`

Se conservarán también:

- episodios armados;
- reducciones winner-protection realmente ejecutadas;
- reclaims;
- MFE/giveback causal del episodio;
- costes/fiscalidad/turnover incrementales;
- delta de max drawdown;
- delta de número de operaciones;
- daño por cohorte;
- dominancia de una única cohorte.

## 9. Reach congelado

La confirmación necesita simultáneamente:

- al menos **6 reducciones winner-protection únicas realmente ejecutadas**;
- al menos **4 de 6 cohortes** con una reducción ejecutada.

Las propuestas `PROTECT`, `WATCH` o un `REDUCE` no ejecutado no cuentan como reach económico.

Si no se alcanza reach suficiente, el resultado es `CONFIRMATION_INCONCLUSIVE_INSUFFICIENT_REACH`, no FAIL económico ni permiso para retunear.

## 10. Gates económicos congelados

Para que la confirmación sea consistente con el PASS inicial deben cumplirse todos los gates originales, sin relajarlos:

1. data gate válido en 6/6 cohortes;
2. reach suficiente según el apartado anterior;
3. al menos 4/6 cohortes con `finalValueDeltaEur > 0`;
4. mediana `finalValueDeltaEur > 0`;
5. mejora mediana superior al mayor de:
   - 0,5% del capital económico expuesto; o
   - mediana de los costes incrementales positivos atribuibles a la política;
6. mediana de deterioro de max drawdown <= +0,5 pp;
7. ninguna cohorte peor que -5% de su capital inicial frente al baseline;
8. ninguna cohorte con max drawdown empeorado > +3 pp;
9. eliminando la cohorte con mayor delta positivo, el delta agregado restante debe seguir siendo >0.

No se cambian métricas ni umbrales después de conocer la confirmación.

## 11. Veredictos de confirmación

### `CONFIRMATION_PASS`

Todos los gates congelados pasan con integridad técnica/causal. Significa que el primer PASS se ha replicado en la segunda muestra independiente.

**No promociona automáticamente producción.** Abre una revisión explícita de promoción en la que deberán considerarse conjuntamente las dos evidencias, la limitación de survivorship y la integración productiva segura.

### `CONFIRMATION_FAIL_NO_PROMOTION`

Existe reach evaluable pero falla uno o más gates económicos congelados. La política no se promociona y no se retunea utilizando conjuntamente ambas muestras.

### `CONFIRMATION_INCONCLUSIVE_*`

Datos, reach o infraestructura no permiten una confirmación evaluable. No hay promoción. Cualquier nueva confirmación futura debe volver a preregistrarse sobre evidencia independiente.

## 12. Limitaciones

Permanece explícita la limitación de survivorship/catalog bias: todavía no existe un instrument master histórico point-in-time completo. Esta confirmación puede demostrar replicación temporal dentro de la misma cross-section OOS, pero no convierte la muestra en una reconstrucción del mercado completo disponible en cada fecha.

## 13. Estado y siguiente paso

Estado tras este preregistro:

**PREREGISTERED / COVERAGE PREFLIGHT ONLY / CONFIRMATION NOT OPENED / PRODUCTION LEGACY**.

Siguiente paso permitido:

1. ejecutar guards rápidos;
2. ejecutar exclusivamente el preflight REAL de cobertura 2004–2007;
3. si 18/18 activos pasan, sellar muestra/implementación/runner y sólo entonces habilitar una ejecución económica one-shot;
4. si el preflight falla, detenerse sin abrir outcomes.

Producción permanece `LEGACY` durante toda esta etapa.
