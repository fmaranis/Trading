# Fase 4 · EXIT_PROCEEDS_CUSTODY_V1 · R3

Estado: **POLICY FROZEN / R2 CONSUMED-INCONCLUSIVE / R3 SEALED PRE-OPEN / RESEARCH ONLY**

## 1. Motivo de R3

R2 se abrió y quedó consumida, pero la comparación económica no llegó a ejecutarse porque el core `FUND_VANGUARD_GLOBAL` no obtuvo serie REAL válida en el proveedor. La reconstrucción posterior devolvió `INCONCLUSIVE_INVALID_DATA` con `coreAccepted=false` y `coreBarsBeforeReplay=0` en las seis cohortes.

R3 no modifica `EXIT_PROCEEDS_CUSTODY_V1`, no cambia thresholds, sizing, waiting, confirmaciones, fiscalidad, cash ni reglas de reentrada. Corrige únicamente el diseño de muestra/datos antes de abrir una nueva muestra OOS.

R2 no se reutiliza ni se reinterpreta para promoción.

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

Ventana temporal deliberadamente disjunta de R2 y de las ventanas Opportunity/Allocation consumidas:

- data request start: `2000-12-27`;
- replay start: `2002-01-15`;
- end: `2003-12-31`;
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

La ventana termina antes del inicio de R2 (`2004-01-02`).

## 4. Core R3

Core de control/prueba:

- assetId: `CORE_PH4_R3_EXS1`;
- ticker: `EXS1.DE`;
- ISIN: `DE0005933931`;
- instrumento: iShares Core DAX UCITS ETF (DE);
- moneda: EUR;
- listed ETF, no fondo NAV por ISIN.

La identidad del core se fija antes de abrir R3 y no puede cambiarse durante el one-shot. Su selección responde exclusivamente a cobertura histórica anterior a R2 y a evitar la ruta de datos de fondos que invalidó R2. No es una recomendación productiva ni sustituye el core de producción.

El runtime debe exigir:

- `REAL`;
- proveedor aceptado por la infraestructura normal;
- >=252 barras hasta `REPLAY_START_DATE`;
- OHLC/date integrity;
- cobertura utilizable del periodo de replay.

Si el core falla, R3 termina `INCONCLUSIVE_INVALID_DATA`; no se sustituye.

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

El one-shot debe:

- verificar un seal de blobs críticos antes de la primera consulta R3;
- ejecutar todos los guards rápidos y TypeScript antes del runner largo;
- persistir el JSON completo en `replay-results` antes de declarar la ejecución cerrada;
- no depender de memoria del backend ni de una descarga manual del usuario.

La primera llamada de mercado del runner R3 consume la muestra. Desde ese instante R3 nunca vuelve a ser fresh aunque falle por datos.

## 11. Interpretación permitida

- `PASS_CANDIDATE_FOR_CONFIRMATION`: candidato a confirmación, no producción.
- `FAIL_RETIRED_AS_TESTED`: retirar esta policy exacta; no retunear en R3.
- `INCONCLUSIVE_*`: no promover ni retirar por evidencia económica insuficiente; tampoco retunear usando R3.

Survivorship/catalog bias sigue siendo una limitación: no existe todavía instrument master histórico point-in-time con delistings/listings completos.
