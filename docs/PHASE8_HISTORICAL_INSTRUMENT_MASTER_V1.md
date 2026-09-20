# Fase 8 — Historical Instrument Master V1

Estado: **ARQUITECTURA IMPLEMENTADA / COBERTURA HISTÓRICA REAL AÚN INCOMPLETA**

Fecha: **2026-09-20**

## 1. Objetivo

Cerrar la limitación de survivorship del replay histórico sin utilizar discovery current/live para inventar retrospectivamente qué instrumentos existían en una fecha pasada.

La capa PIT se integra en el replay causal existente. No crea un motor paralelo.

## 2. Contrato

Archivo:

`src/investment/decision/historicalInstrumentMaster.ts`

Versión:

`HISTORICAL_INSTRUMENT_MASTER_V1`

Cada identidad económica puede registrar:

- identidad canónica;
- ISIN;
- listing date;
- delisting date;
- ticker/mercado con intervalos de vigencia;
- fuente/autoridad de referencia;
- fecha máxima de evidencia;
- flag `pointInTimeVerified`;
- procedencia `STATIC_REFERENCE`.

Cobertura del master:

- `CURRENT_REFERENCE_ONLY`;
- `PARTIAL_POINT_IN_TIME`;
- `COMPLETE_POINT_IN_TIME`.

Sólo `COMPLETE_POINT_IN_TIME` permite afirmar cobertura completa del universo objetivo histórico.

## 3. Regla anti-survivorship

La existencia de barras históricas **no prueba** que un instrumento fuese elegible/listado dentro del universo en esa fecha.

El catálogo actual `EUR_ASSET_UNIVERSE` se puede convertir a un snapshot deduplicado por identidad económica, pero ese snapshot queda obligatoriamente:

`CURRENT_REFERENCE_ONLY`

y todos sus registros quedan:

`pointInTimeVerified = false`.

Ese snapshot no puede filtrar ni autorizar un universo histórico PIT.

## 4. Identidad y ticker changes

El master separa identidad económica de alias de cotización.

Ejemplo conceptual:

`ISIN X -> OLD.DE [2010..2015] -> NEW.DE [2016..2020]`

La resolución por fecha devuelve el ticker vigente únicamente dentro de su intervalo. Los intervalos solapados para el mismo ticker/venue están prohibidos.

## 5. Listing / delisting / horizonte de evidencia

Estados por fecha:

- `TRADABLE_VERIFIED`;
- `NOT_YET_LISTED`;
- `DELISTED`;
- `AFTER_EVIDENCE_HORIZON`;
- `NO_ACTIVE_ALIAS`;
- `UNVERIFIED_POINT_IN_TIME`;
- `IDENTITY_NOT_FOUND`.

Un registro `pointInTimeVerified` exige listing date y una autoridad distinta de `CURRENT_CATALOG_REFERENCE`.

Una fecha posterior a `evidenceAsOfDate` no puede darse por verificada.

## 6. Integración con replay existente

`CausalUniverseBacktestEngine.run(...)` acepta ahora, como quinto argumento opcional, un `HistoricalInstrumentMaster`.

Semántica:

- sin master: comportamiento previo intacto, con warning de survivorship;
- `CURRENT_REFERENCE_ONLY`: rechazado explícitamente para selección histórica;
- `PARTIAL_POINT_IN_TIME`: sólo entran instrumentos PIT verificados y el resultado se etiqueta como subset parcial;
- `COMPLETE_POINT_IN_TIME`: sólo puede etiquetarse como PIT completo si, en cada fecha de decisión, todos los instrumentos que el master marca como `TRADABLE_VERIFIED` están también presentes en el catálogo y en el dataset del replay; cualquier hueco hace fallar cerrado.

No se modifica la cadena de decisión posterior: selección -> InvestmentDecisionEngine -> rebalance/execution.

## 7. Guard

`tests/historicalInstrumentMaster.unit.ts`

Comprueba:

- current catalogue no puede presentarse como PIT;
- dedupe de identidades económicas por ISIN;
- alias múltiples;
- listing/delisting;
- ticker change;
- horizonte de evidencia;
- imposibilidad de marcar `CURRENT_CATALOG_REFERENCE` como verificado;
- imposibilidad de declarar `COMPLETE_POINT_IN_TIME` con registros no verificados;
- filtro por fecha de catálogo PIT.

## 8. Fuente operativa candidata

La app ya dispone de integración backend con EODHD mediante `EODHD_API_KEY`.

EODHD ofrece dos piezas útiles para esta fase:

- `exchange-symbol-list/{EXCHANGE}` permite obtener activos actuales y, con `delisted=1`, los delistados;
- Fundamentals expone `IPODate` / `IsDelisted` / fecha de delisting para acciones y `Inception_Date` para ETF/fondos.

Esto permite construir cobertura PIT parcial con identidades activas y delistadas sin depender de Yahoo current discovery.

Limitación que debe mantenerse explícita:

- el historial de cambios de símbolo de EODHD está documentado de forma específica para US;
- para mercados europeos no debe asumirse que el histórico de ticker/exchange es exhaustivo sólo por disponer de active+delisted.

Por tanto, EODHD es una fuente válida para poblar progresivamente `PARTIAL_POINT_IN_TIME`, pero no se promoverá automáticamente a `COMPLETE_POINT_IN_TIME` sin verificar cobertura de ticker/exchange history para el universo objetivo.

## 9. Qué falta para cerrar Fase 8

La arquitectura ya está preparada. Falta poblar un master histórico REAL/STATIC_REFERENCE suficientemente exhaustivo para el universo objetivo con una fuente que aporte, como mínimo:

- altas/listings históricas;
- bajas/delistings;
- ticker/exchange history;
- identidad estable (preferiblemente ISIN u otra identidad canónica);
- fecha de evidencia.

No se aceptará como sustituto:

- Yahoo Search actual;
- una lista de instrumentos actuales;
- inferir listing date desde la primera barra disponible;
- rellenar delistings ausentes con supuestos.

Hasta disponer de cobertura suficiente, el estado correcto es:

**PIT architecture implemented / historical master coverage incomplete / survivorship limitation remains explicit.**
