# Fase 4 · EXIT_PROCEEDS_CUSTODY_V1 · resultado final V1

Fecha de cierre: **2026-09-13**  
Estado: **CLOSED FOR V1 / INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH / NO PRODUCTION CHANGE**

## 1. Pregunta investigada

Fase 4 evaluó la policy research-only `EXIT_PROCEEDS_CUSTODY_V1`: después de un EXIT completo elegible de una acción no-core, reservar causalmente sus proceeds netos como cash remunerado para la primera reentrada ordinaria futura del mismo activo, sin crear una señal nueva, relajar gates ni aumentar el sizing canónico.

Producción permaneció y permanece `LEGACY`.

## 2. Historial de muestras

### R1 — VOID PRE-OPEN

R1 fue anulada antes de abrir resultados porque el primer diseño tenía problemas metodológicos de atomicidad, uso de `reason`, solape de cohortes, contaminación de identidades y ventana ya consumida. R1 no produjo evidencia económica y no consumió holdout.

### R2 — CONSUMED / INCONCLUSIVE_INVALID_DATA

R2 llegó a abrirse, pero la comparación económica no pudo ejecutarse porque el core `FUND_VANGUARD_GLOBAL` no obtuvo serie REAL válida en la infraestructura disponible. No hubo baseline/candidato evaluable ni outcomes económicos utilizables para retuning.

R2 queda consumida y no se reutiliza.

### R3 — CONSUMED / INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH

R3 se preregistró y selló antes de abrir el pool fresh. El core research-only quedó fijado en `DBXW.DE` (`LU0274208692`, Xtrackers MSCI World Swap UCITS ETF 1C, acumulación) y el replay quedó finalmente fijado en `2009-01-05 -> 2010-12-31`, con histórico solicitado desde `2006-12-19`.

Antes de abrir la muestra, todos los guards rápidos y TypeScript pasaron. El preflight REAL aislado del core devolvió:

- proveedor: `yahoo_finance`;
- moneda: EUR;
- barras totales: 764;
- barras causales antes del replay: 256;
- mínimo exigido: 252;
- integridad OHLC/fechas: válida;
- cobertura final: válida;
- preflight: PASS.

El one-shot fresh abrió después el pool R3 y quedó consumido. Resultado de datos:

- scanner: 66/66 aceptados;
- pool fresh: 65/65 coverage-eligible;
- selección congelada: 30 activos por orden SHA-256;
- 6 cohortes disjuntas de 5;
- data gate: 6/6 cohortes válidas;
- ningún `SYNTHETIC`;
- current discovery histórico: OFF.

Por tanto el outcome no se explica por fallo de proveedor ni cobertura insuficiente.

## 3. Resultado económico/mecánico

El mecanismo experimental no tuvo reach:

- `uniqueExitReservations = 0`;
- `uniqueReentries = 0`;
- reach gate preregistrado: FAIL;
- veredicto: `INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

Las seis cohortes ejecutaron muy pocas operaciones después de la asignación inicial y ninguna produjo un EXIT completo elegible. Como consecuencia, `EXIT_PROCEEDS_CUSTODY_V1` nunca creó una reserva y candidato/baseline quedaron económicamente idénticos en todas las cohortes.

Los deltas nulos **no significan que la policy haya empatado económicamente tras ser aplicada**. Significan que la policy no llegó a activarse.

## 4. Interpretación permitida

Conforme a `ECONOMIC_VALIDATION_PROTOCOL_V1`:

- esto **no es** `PASS_CANDIDATE_FOR_CONFIRMATION`;
- esto **no es** `FAIL_RETIRED_AS_TESTED`;
- no existe evidencia económica suficiente para afirmar que reservar proceeds mejora o empeora el resultado;
- R3 está consumida y no puede utilizarse para retunear thresholds, waiting, frecuencia, sizing, sample selection o reglas de salida/reentrada;
- R2 y R3 no se vuelven a abrir ni a repetir como fresh.

El hallazgo retenido es de **reach de política**, no de calidad económica: con la arquitectura y condiciones congeladas, la muestra R3 no produjo EXITs elegibles y el mecanismo de custodia no pudo ser evaluado.

## 5. Decisión de cierre V1

Fase 4 se cierra para V1 como **INCONCLUSIVE por reach insuficiente**, sin cambio productivo y sin gastar otra muestra histórica intentando forzar eventos después de haber observado el reach cero.

No se crea R4 como ajuste reactivo de ventana, frecuencia, universo, thresholds o política. Un eventual estudio futuro de esta idea tendría que ser una investigación nueva, explícitamente preregistrada y metodológicamente independiente; R2/R3 seguirían consumidas.

`EXIT_PROCEEDS_CUSTODY_V1` queda archivada como research-only, sin autoridad productiva.

El carril económico continúa con **Fase 5 — protección de grandes ganadores**, empezando por diseño/preregistro antes de abrir cualquier holdout fresh.

## 6. Evidencia durable

Evidencia autoritativa R3:

- branch: `replay-results`;
- path: `validation-runs/research-validation/phase4-reentry-cash-custody-v1-r3.json`;
- evidence kind: `ORIGINAL_VALIDATION`;
- sample state: `R3_OPENED_CONSUMED`;
- verdict: `INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`;
- blob SHA registrado por la ejecución: `752c29519f586eb2268595413fa74722c2014ac4`;
- commit SHA registrado por la ejecución: `5854bae235fc50642b33703fa6a12f7f1f05222b`.

Los preregistros y seals R2/R3 se conservan como evidencia histórica y no se reescriben después del outcome.
