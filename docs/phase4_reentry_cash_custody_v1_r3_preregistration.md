# Fase 4 · EXIT_PROCEEDS_CUSTODY_V1 · R3

Estado: **POLICY FROZEN / R2 CONSUMED-INCONCLUSIVE / R3 SEALED PRE-OPEN / RESEARCH ONLY**

## 1. Motivo de R3

R2 se abrió y quedó consumida, pero la comparación económica no llegó a ejecutarse porque el core `FUND_VANGUARD_GLOBAL` no obtuvo serie REAL válida en el proveedor. La reconstrucción posterior devolvió `INCONCLUSIVE_INVALID_DATA` con `coreAccepted=false` y `coreBarsBeforeReplay=0` en las seis cohortes.

El primer diseño pre-open de R3 intentó resolver ese problema con `Fidelity Funds - World Fund E-Acc-EUR` (`LU0115769746`) y una ventana 2002–2003. Todos los guards y TypeScript pasaron, pero el **preflight aislado del core**, ejecutado antes de consultar un solo `EQ_PH4_R3_*`, falló por falta de histórico utilizable en la infraestructura disponible (`Error proveedor HTTP 400`). Por tanto esa tentativa **no abrió ni consumió R3** y no produjo ningún outcome fresh.

R3 se refija ahora antes de abrir la muestra con un core global cotizado en EUR que dispone de una identidad Yahoo/Xetra directa y verificable. El cambio responde exclusivamente a disponibilidad/integridad de datos del core; no se ha observado ninguna rentabilidad ni resultado económico del pool fresh.

R3 no modifica `EXIT_PROCEEDS_CUSTODY_V1`, no cambia thresholds, sizing, waiting, confirmaciones, fiscalidad, cash ni reglas de reentrada. R2 no se reutiliza ni se reinterpreta para promoción.

## 2. Hipótesis y política congeladas

Hipótesis: tras un EXIT completo elegible de una acción no-core, reservar causalmente sus proceeds netos como cash remunerado para la primera reentrada ordinaria futura del mismo activo puede mejorar riqueza terminal frente al baseline que devuelve esos proceeds al core, sin aumentar drawdown materialmente.

Política exacta: `EXIT_PROCEEDS_CUSTODY_V1` ya congelada en Fase 4.

No se permite:

- crear nuevas señales;
- relajar `REJECTED` / `WAIT`;
- aumentar sizing canónico;
- retunear la policy después de R2;
- usar texto de `reason` como autoridad;
- usar current discovery para reconstruir el universo histórico;
- sustituir manualmente activos después de abrir R3.

Producción/default permanece `LEGACY`.

## 3. Ventana R3

La ventana se fija **antes de abrir cualquier activo fresh R3** y responde a la fecha de cotización del core global listado elegido:

- data request start: `2005-10-28`;
- replay start: `2007-01-15`;
- end: `2010-12-31`;
- frecuencia: `MONTHLY`;
- capital inicial: `13.000 EUR`;
- riesgo: `MEDIUM`;
- horizonte: `3 años`;
- replay: `CUSTODIA_ENGINE`;
- cash: `HISTORICAL_ECB_DFR_FLOOR_0`;
- fiscalidad: `contextConfirmed:false` en ambos brazos;
- `externalCashFlows`: ninguno;
- REAL-only;
- mínimo causal antes del replay: `252` barras;
- current Yahoo discovery: `OFF`.

Esta ventana se solapa temporalmente con la ventana nominal de R2, pero **no reutiliza la muestra económica de R2**: R2 falló en el data gate del core y nunca ejecutó baseline/candidato ni produjo resultados económicos que pudieran informar o retunear la policy. R3 usa identidades fresh disjuntas, un core diferente fijado por disponibilidad de datos antes de abrir el holdout y reglas económicas que permanecen exactamente congeladas. El solape temporal queda documentado como limitación metodológica; un eventual PASS sólo puede habilitar confirmación independiente, nunca promoción directa.

La ventana termina antes de las validaciones Forward Risk rolling 2011–2026 y antes de las ventanas Opportunity/Allocation 10y/6y/3y hasta 2026-09-01 señaladas como consumidas por el protocolo común.

## 4. Core R3

Core estructural research-only fijado antes de abrir la muestra:

- assetId: `CORE_PH4_R3_IQQW_WORLD`;
- ticker Yahoo/Xetra: `IQQW.DE`;
- ISIN: `IE00B0M62Q58`;
- instrumento: `iShares MSCI World UCITS ETF USD (Dist)` listado en Xetra en EUR;
- categoría: `GLOBAL_EQUITY`;
- moneda de cotización usada por el replay: EUR;
- primera cotización Xetra: `2005-10-28`;
- identidad research-only, ausente del catálogo productivo.

La elección respeta la semántica de `CORE_ARCHITECTURE_V1`: el ETF replica MSCI World y proporciona exposición amplia a mercados desarrollados globales; no es un índice regional usado como sustituto. La identidad está reconocida únicamente como core estratégico de investigación y no se incorpora al discovery productivo ni a la prioridad de core de producción.

Antes de abrir R3 el job ejecutará un **preflight de datos sólo sobre este core**. Ese preflight puede consultar la infraestructura REAL del core porque no observa ningún activo ni outcome de la muestra fresh R3. Debe exigir:

- histórico Yahoo REAL directo de `IQQW.DE`, sin proxy sintético;
- moneda de cotización EUR;
- >=252 barras hasta `REPLAY_START_DATE`;
- integridad OHLC/fechas;
- cobertura utilizable hasta `END_DATE`.

Si este preflight falla, el job se detiene **antes de consultar el pool fresh** y R3 continúa no abierta. No se selecciona automáticamente otro core ni se consume la muestra.

Una vez que el preflight del core pasa y el one-shot inicia la consulta del pool fresh, la identidad del core no puede cambiarse y cualquier fallo posterior se clasifica `INCONCLUSIVE_INVALID_DATA`.

## 5. Pool fresh y regla de selección

El pool candidato está congelado en `scripts/phase4ReentryCashCustodyV1R3Protocol.ts`.

Reglas pre-open:

1. ningún ticker puede coincidir con R2;
2. ningún ticker puede pertenecer al catálogo productivo curado existente al congelar R3;
3. todos los assets tienen identidad `EQ_PH4_R3_*`;
4. se escanean todos juntos con discovery histórico OFF;
5. el filtro de selección sólo puede utilizar cobertura/procedencia/integridad y número de barras causales previas al replay;
6. no puede utilizar retornos, drawdowns, momentum, ranking, scores ni outcomes económicos para escoger la muestra;
7. entre los coverage-eligible se ordena una sola vez por `SHA256("PHASE4_REENTRY_BLIND_R3:" + assetId)` y se toman los primeros 30;
8. esos 30 se dividen secuencialmente en 6 cohortes disjuntas de 5;
9. si hay menos de 30 coverage-eligible, R3 termina `INCONCLUSIVE_INVALID_DATA`;
10. no existe lista de reemplazo manual.

El proceso de cobertura + selección + replay ocurre dentro del mismo one-shot, sin pausa para inspeccionar rentabilidades antes de decidir identidades.

## 6. Data gate por cohorte

Cada cohorte debe contener:

- el core R3 REAL y causalmente suficiente;
- 5 fresh seleccionados;
- al menos 4/5 fresh válidos durante el replay;
- ningún `SYNTHETIC`;
- ningún `OPEN_*` current discovery;
- OHLC/date integrity válida.

Las seis cohortes deben ser válidas. En caso contrario:

`INCONCLUSIVE_INVALID_DATA`.

## 7. Baseline y candidato

Baseline:

`runDynamicReplayWithRotationExperiment(input, 'CORE_ARCHITECTURE_V1')`

Candidato:

misma llamada y mismo input, añadiendo únicamente:

`reentryFundingPolicy: EXIT_PROCEEDS_CUSTODY_V1`

Todo lo demás debe ser idéntico entre brazos.

## 8. Reach congelado

Mismos gates de R2:

- >=12 EXIT-reservas únicas realmente ejecutadas;
- >=6 reentradas únicas realmente ejecutadas y financiadas positivamente por su reserva.

Claves deduplicadas:

- reserva: `assetId + exitExecutionDate`;
- reentrada: `assetId + sourceExitExecutionDate + reentryExecutionDate`.

Si no alcanza reach:

`INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

## 9. Métrica primaria y gates económicos

Métrica primaria:

`finalValueDeltaEur = candidate.finalValueEur - baseline.finalValueEur`.

`PASS_CANDIDATE_FOR_CONFIRMATION` sólo si se cumplen simultáneamente:

1. 6/6 cohortes válidas;
2. reach suficiente;
3. >=4/6 cohortes con `finalValueDeltaEur > 0`;
4. mediana de `finalValueDeltaEur > 0`;
5. mediana de `finalValueDeltaEur > max(65 EUR, mediana de frictionIncreaseEur positivo)`;
6. mediana de deterioro de max drawdown <= +0,5 pp;
7. ninguna cohorte con `finalValueDeltaEur < -650 EUR`;
8. ninguna cohorte con deterioro de max drawdown > +3 pp.

Para el punto 5 sólo cuentan valores de `frictionIncreaseEur > 0`; si no existe ninguno, el componente de fricción es 0 EUR. Esta formulación corrige una discrepancia de implementación detectada en el runner R2, que etiquetaba la métrica como “positive” pero calculaba la mediana sobre todos los valores. R2 no llegó a la fase económica y por tanto esa corrección no altera ni reinterpreta su outcome.

Con reach suficiente pero sin cumplir PASS:

`FAIL_RETIRED_AS_TESTED`.

Un PASS no promociona producción: sólo habilita confirmación independiente con la policy sin cambios.

## 10. Persistencia y apertura

El flujo debe:

- verificar un seal de blobs críticos antes del preflight;
- ejecutar todos los guards rápidos y TypeScript antes de cualquier consulta fresh;
- ejecutar después el preflight REAL **sólo del core**;
- sólo si el core pasa, iniciar el one-shot R3 y su primera consulta al pool fresh;
- persistir el JSON completo en `replay-results` antes de declarar la ejecución cerrada;
- no depender de memoria del backend ni de una descarga manual del usuario.

La primera consulta de mercado a cualquier asset `EQ_PH4_R3_*` consume la muestra. Las consultas previas limitadas al core no abren el holdout porque no contienen activos ni outcomes fresh de R3.

## 11. Interpretación permitida

- `PASS_CANDIDATE_FOR_CONFIRMATION`: candidato a confirmación, no producción.
- `FAIL_RETIRED_AS_TESTED`: retirar esta policy exacta; no retunear en R3.
- `INCONCLUSIVE_*`: no promover ni retirar por evidencia económica insuficiente; tampoco retunear usando R3.

Survivorship/catalog bias sigue siendo una limitación: no existe todavía instrument master histórico point-in-time con delistings/listings completos.
