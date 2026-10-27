# Custodia — comprobación de ejecutabilidad de una cartera UCITS factorial

**25 de octubre de 2026 — PRE-FLIGHT PARCIAL / NO APTO AÚN PARA BACKTEST ECONÓMICO NI PROMOCIÓN**

**Objetivo:** responder si una construcción *estática y operable* de ETFs globales Quality, Momentum y Value merece enfrentarse a mantener EUNL, con el mismo capital y flujos, costes, fiscalidad y riesgo. No estudiar otra señal/ranking de acciones. Mantener producción `LEGACY`, aplicación web y motor/replay únicos `CORE_ARCHITECTURE_V1`.

Manifest reproducible de hechos, fuentes y gates: `validation-runs/diagnostics/static-ucits-factor-implementability-preflight-2026-10-25.json`. Expedientes ya consumidos: `docs/INVESTMENT_EDGE_RESEARCH_LEDGER_AND_NEXT_GATE_2026-10-25.md` y `PROJECT_STATE.md`.

## 1. Identidades verificadas con páginas públicas

| Papel | ISIN / cotización Xetra EUR | Método económico actual | Lanzamiento / TER |
| --- | --- | --- | --- |
| Indexación control | EUNL.DE · IE00B4L5Y983 | MSCI World (iShares Core, acumulación) | 2009-09-25 · 0,20% |
| Momentum | XDEM.DE · IE00BL25JP72 | MSCI World Momentum (Xtrackers, acumulación) | 2014-09-05 · 0,25% |
| Quality | XDEQ.DE · IE00BL25JL35 | **MSCI World Sector Neutral Quality**, no MSCI World Quality estándar | 2014-09-11 · 0,25% |
| Value | XDEV.DE · IE00BL25JM42 | **MSCI World Enhanced Value**, no factor value genérico | 2014-09-11 · 0,25% |

Fuentes: emisores [XDEM](https://etf.dws.com/en-gb/IE00BL25JP72-msci-world-momentum-ucits-etf-1c/), [XDEQ](https://etf.dws.com/en/IE00BL25JL35-msci-world-quality-ucits-etf-1c/), [XDEV](https://etf.dws.com/en/IE00BL25JM42-msci-world-value-ucits-etf-1c/), [ficha EUNL](https://www.justetf.com/en/etf-profile.html?isin=IE00B4L5Y983), [cotización XDEM](https://www.justetf.com/es/etf-profile.html?isin=IE00BL25JP72), [XDEQ](https://www.justetf.com/en-es/etf-profile.html?isin=IE00BL25JL35), [XDEV](https://www.justetf.com/en/etf-profile.html?isin=IE00BL25JM42). El catálogo del proyecto ya registra los cuatro tickers/roles; **no crear otro universo ni cambiar producción**.

Los fondos subyacentes tienen divisa base USD; la **cotización Xetra EUR** no elimina exposición cambiaria. Las cuatro posiciones están expuestas a **renta variable desarrollada**, con riesgo de caída conjunta; cuatro ISINs no equivalen a diversificación de clases de activo.

### Hallazgo crítico: tres cambios de benchmark simultáneos

El **3 de noviembre de 2016**, DWS cambió el índice seguido por **los tres**, no sólo Value:
- XDEM: DB Equity Momentum Factor -> MSCI World Momentum;
- XDEQ: DB Equity Quality Factor -> MSCI World Sector Neutral Quality;
- XDEV: DB Equity Value Factor -> MSCI World Enhanced Value.

Esto aparece explícitamente en las páginas/fichas del **emisor** anteriores. La afirmación anterior del proyecto de que únicamente XDEV había cambiado estaba incompleta.

**Regla causal de admisibilidad:** para probar los índices *actuales*, tomar como comienzo **la primera sesión común real de Xetra estrictamente posterior a 2016-11-03**, tras verificar que existe `REAL` ajustada para los cuatro instrumentos. Pre-2016 no tiene la misma metodología aunque el ETF existiera; sin backfill retrospectivo de índices actuales. No asumir automáticamente que 2016-11-04 fue una sesión negociable común sin leer el calendario/series. La comparación exploratoria 2014–2025 de índices Quality+Momentum al 50/50 ya inspeccionada no es el resultado de estos vehículos ni la política de tres factores.

## 2. Costes, negociación y fiscalidad verificables

**MyInvestor, página pública del bróker (consulta 2026-10-25):**

- Mercados soportados incluyen **XTR / Xetra Alemania**. Eso NO confirma aún la **habilitación de los cuatro ISINs concretos**, existencia de KID para el cliente o que estén operables ahora en su catálogo.
- Comisión publicada ETF: **0,12%** por compraventa, **mínimo 1 EUR / máximo 25 EUR por orden**, más cánones ajenos y spread efectivo; custodia y mantenimiento publicados 0 EUR.
- Conversión divisa publicada **0,30%**, sólo si la operación requiere cambio de divisa. Comprar una cotización Xetra en EUR no autoriza cargar un 0,30% automático; sin embargo, el subyacente conserva riesgo de tipo de cambio.
- La política del repo `MYINVESTOR_BROKER_PROFILE` coincide en 0,12%, 1/25 EUR, FX 0,30% y títulos enteros. El replay tiene comisiones y filtros de órdenes, pero no equivale por sí solo a verificar acceso individual a ISIN, spreads históricos ni cargos completos de terceros.

Fuente [MyInvestor — bróker](https://myinvestor.es/inversion/broker/) y [preguntas frecuentes](https://myinvestor.es/ayuda/preguntas-frecuentes/inversion/).

Costes orientativos **únicamente para explicar el impacto del mínimo**, si cada ETF recibiese un tercio del capital, sin spread, acciones fraccionarias ni ajuste de títulos:

- Con **500 EUR**: tres órdenes factoriales de 1 EUR = 3 EUR; una orden EUNL de 1 EUR; **2 EUR adicionales de comisión inicial** (0,40% del capital). Puede que alguno de los tres títulos no sea comprable con su asignación: pendientes precios reales.
- Con **13.000 EUR**: las tres órdenes factoriales al 0,12% sumarían ~15,60 EUR; comprar sólo EUNL al 0,12% también ~15,60 EUR. **No hay una penalización fija de 2 EUR en este tamaño**; sí spreads, redondeo a títulos enteros, posibles comisiones ajenas y mayor complejidad.

TER anual 0,25% frente a 0,20% EUNL: en rentabilidades/NAV realizados **los gastos internos ya se reflejan**; no descontar nuevamente TER al calcular rentabilidad ni confundir diferencia de coste con exceso de retorno esperado.

**España (CNMV, guía enero 2026):** las ganancias al vender ETFs tributan como ganancias patrimoniales y **los ETFs no acceden al diferimiento fiscal por traspaso** de fondos tradicionales elegibles. Buy-and-hold sin ventas periódicas minimiza hechos imponibles intermedios, pero una liquidación final y los flujos retirados deben tratarse en ambos brazos de modo compatible. Comparador principal **EUNL ETF**, no simular sin ajustes los privilegios fiscales de traspasos de un fondo mutualista como Vanguard. Fuente oficial [CNMV fiscalidad IRPF 2026](https://www.cnmv.es/DocPortal/Publicaciones/Guias/FiscalidadFondosDeInversionEnElIRPF.pdf).

## 3. Resultado del preflight y criterio de parada

| Guard | Estado | Motivo |
| --- | --- | --- |
| Identidad UCITS, cuatro ISIN, índice vigente, comisión de gestión | **PASS documental** | Gestoras, fichas, listado Xetra |
| Mercado Xetra y comisión general MyInvestor | **PASS documental** | Publicado por el bróker |
| Histórico 2014–2016 comparable con índices actuales | **FAIL** | Los tres factores cambiaron benchmark el 2016-11-03 |
| Acceso concreto al broker por los 4 ISIN | **NO VERIFICADO** | Mercados genéricos no garantizan catálogo |
| Serie diaria `REAL` común Xetra EUR con adjusted/raw, eventos corporativos, reconciliación NAV | **NO VERIFICADO** | No se ha descargado/auditado la serie original en el backend de Custodia |
| Capital/títulos enteros, spread y solapamiento accionarial real | **NO VERIFICADO** | Requiere precios/holdings y capital definido |
| Rentabilidad superior a EUNL, riesgos, fiscalidad y frecuencia de éxito | **NO CALCULADO** | No abrir economía antes de superar los guards |

**Veredicto: `PARTIAL_PREFLIGHT_BLOCKED_BEFORE_ECONOMIC_DATA`**. La idea parece operable *en principio* a través de ETFs UCITS disponibles en Xetra, pero **NO está demostrado que pueda comprarse esta cesta en concreto en MyInvestor ni que supere una indexación global**. Tampoco permite afirmar que proteja frente a un desplome.

## 4. Siguiente tarea técnica precisa, sin crear otro motor ni pantalla

En el **backend de datos real ya existente** de la app, obtener una **única captura limitada y auditada** de `EUNL.DE`, `XDEM.DE`, `XDEQ.DE`, `XDEV.DE`, sin mirar todavía rentabilidades agregadas para seleccionar retrospectivamente otra cartera:

1. Confirmar ISIN y cambio de benchmark, primera sesión Xetra común tras 2016-11-03, `REAL` por símbolo/fecha y `rawOpen/rawClose/adjustedClose` consistentes, huecos, splits y NAV issuer. Hacer fail-closed si falta historia/identidad/currency; **nunca synthetic fallback**. Preservar provenance y versión/hash raw.
2. Verificar si el bróker permite operar **estos cuatro ISINs**. Si no puede verificarse mediante datos disponibles en la app o fuente pública, dejarlo `UNVERIFIED`, sin pedir claves al usuario.
3. Comprobar solapamiento real: exposición USA/mega-caps, sectores y 100% equities; no atribuir diversificación anticrash sin prueba.
4. **Sólo si PASS** congelar **una sola** propuesta de cartera estática, pesos y convenio de ejecución antes de abrir outcomes económicos, sin grid ni rescate paramétrico. Benchmark: EUNL 100% con mismos `externalCashFlows`, costes, cash e impuestos; ambos en euros y `NEXT_OPEN`/compras causales. No usar una muestra ya consumida para promoción.
5. Ejecutar el estudio de implementación neta **en el replay canónico** desde el `ResearchValidationCenter`, tras pasar guards/TypeScript. Capitales pequeños y medianos deben valorar si se pueden adquirir títulos enteros; el 80% de años ganadores es objetivo informativo, no conclusión. Identificar una ventana fresh o continuar prospectivo/shadow tras congelar la política.

**Alcance de esta entrega:** investigación documental + preflight machine-readable guardado. Ningún job largo, Yahoo histórico, benchmark económico, tests Node/tsc o cambio a `LEGACY` ejecutado. No se creó menú, motor paralelo, parámetro de trading ni tarjeta nueva. Se preservan íntegramente los FAIL de investigaciones previas y se evita refit sobre ventanas consumidas.


## 5. Capturador REAL acotado incorporado al Centro de validación

**Implementación en `main`**: `scripts/staticUcitsFactorMarketDataPreflightV1.mjs` y `tests/staticUcitsFactorMarketDataPreflightV1.unit.mjs`. El archivo de precio sólo se lee del proveedor Yahoo Finance `v8/finance/chart` para los **cuatro símbolos explícitos**, no del discovery current/live y nunca de una fuente sintética. Las identidades ISIN se contrastan con el catálogo existente `src/investment/decision/assetUniverse.ts`, no se adivinan mediante Yahoo.

**Ventana de observación documental predefinida**, sin elegirla por rendimiento: del **2016-11-04** (posterior al cambio de benchmark común del 2016-11-03) al **2026-10-23** (último viernes completo antes de la fecha actual); esta ventana es histórica **consumida/descriptiva**, jamás se convierte por arte de magia en holdout fresh.

El lector exige identidad exacta de símbolo, moneda **EUR**, instrumento **ETF**, metadatos **GER/Xetra**, primer día de negociación anterior a 2016-11-03 y adjustedClose de Yahoo; registra `rawOpen`, `rawClose`, `adjustedClose` y `adjustedOpen=rawOpen×adjustedClose/rawClose` sin fabricar ninguna observación faltante. Comprueba duplicados, monotonía, cobertura de referencia EUNL ≥2000 barras, cobertura ≥95% para cada ETF frente a EUNL, intersección común ≥90%, primera fecha común ≤2016-11-15 y última fecha común ≥2026-09-30. Estos thresholds son **guards de calidad de datos**, no reglas para elegir activos, y se fijan antes de descargar series. Splits/dividendos se guardan como hechos de procedencia: **no** se declaran conciliados con NAV ni capaces de justificar retornos históricos por sí solos.

Las respuestas brutas se preservan con SHA256 y escritura **create-only** bajo `.runtime/static-ucits-factor-v1/yahoo/<ticker>.json`; una repetición reutiliza exactamente el raw persistido. La salida compacta de cobertura, sin retorno ni score, se escribe sólo si los datos cumplen como `validation-runs/diagnostics/static-ucits-factor-market-data-preflight-v1-result.json`. Estado en caso de cobertura suficiente: `PASS_DATA_COVERAGE_PENDING_EXTERNAL_RECONCILIATION`, **NO** PASS económico ni autorización productiva. NAV de emisor, corporate actions e identidad de broker por ISIN, overlap y validez OOS siguen pendientes. Si la primera llamada queda bloqueada, el Centro registra `BLOCKED`/FAILED sin abrir replay ni bajar thresholds.

**Ejecución normal:** se ha integrado como **único job `CURRENT`** de `ResearchValidationCenter` con id `static-ucits-factor-market-data-preflight-v1` y el botón existente **«Comprobar datos REAL de 4 ETFs»**. `kronos-stage-b-diagnostic-v1` pasa de CURRENT a PARKED, preservando su evidencia/estado, sin lanzarlo ni retocar el modelo. No hay pantalla ni motor nuevo. Orden de ejecución impuesto por el backend: guard unit específico -> guard catálogo -> guard arquitectura -> guard runtime -> **`npm run lint` (`tsc --noEmit`)** -> descargador Yahoo REAL. Un fallo detiene la cola antes de red.

**Verificación en esta sesión:** contratos de integración presentes e inspeccionados en los blobs actuales de GitHub (un solo CURRENT, Kronos PARKED, guards antes de fuente, botón correcto, estado económico falso). Las pruebas completas Node/TS **todavía NO han podido ejecutarse**, pues las herramientas de este chat no tienen un checkout ejecutable del backend de la app ni acceso a su proceso. **No se ha descargado ningún precio REAL ni se ha observado el retorno de cartera**. Cualquier `PASSED` futuro de este job sólo certificará identificación/cobertura del feed, no conciliación de NAV ni mejora frente al core.

Siguiente hito tras los guards y captura: contrastar el resultado contra NAV y eventos oficiales para todos los ISINs, disponibilidad broker y solapamiento efectivo. Sólo después fijar una construcción estática comparable y un estudio económico causal.


## 6. Ejecución REAL 2026-10-26 — cobertura PASS, conciliación pendiente

**Se recibió el export de la aplicación**, job `static-ucits-factor-market-data-preflight-v1`, `PASSED` / exitCode `0`, desde `2026-10-26T17:47:47.737Z` a `2026-10-26T17:48:18.332Z`. El resultado efectivo no es `PASS` económico, sino **`PASS_DATA_COVERAGE_PENDING_EXTERNAL_RECONCILIATION`**. Evidencia materializada en `validation-runs/diagnostics/static-ucits-factor-market-data-preflight-v1-execution-review-2026-10-26.json`, sin sobrescribir informes históricos ni el output local del backend.

| Ticker Xetra EUR | Barras Yahoo declaradas | Alineadas con EUNL | Porcentaje de solapamiento |
| --- | ---: | ---: | ---: |
| EUNL.DE | 2532 | 2532 | 100% |
| XDEM.DE | 2533 | 2532 | 100% |
| XDEQ.DE | 2533 | 2532 | 100% |
| XDEV.DE | 2533 | 2532 | 100% |

- Sesión común inicial **2016-11-04**, final **2026-10-23**: 2532 fechas idénticas. Los tres ETFs factoriales tienen **una fecha extra cada uno** ajena al calendario EUNL; no afecta al solapamiento pero no se deduce de qué fechas son a partir de este resumen.
- `sourceType=REAL` según **declaración del backend**. El export subido **no incluye** payload Yahoo, manifiesto SHA256, tablas OHLC ajustadas, detalles split/dividends ni NAV oficial. Por ello la revisión del chat **no acredita independientemente los precios**, sólo el resultado y los conteos del job.
- `economicOutcomesCalculated=false`, `productionAuthority=false`. Conservar `LEGACY` y las ventanas previamente inspeccionadas como históricas/consumidas.

### Próximo y único gate: verificación independiente de los datos utilizados

Antes de congelar pesos o ejecutar un replay económico, conciliar **por ISIN** `EUNL/IE00B4L5Y983`, `XDEM/IE00BL25JP72`, `XDEQ/IE00BL25JL35`, `XDEV/IE00BL25JM42` de la siguiente forma:

1. Recuperar del **backend ya ejecutado** el output completo `validation-runs/diagnostics/static-ucits-factor-market-data-preflight-v1-result.json` y hashes/cache original `.runtime/static-ucits-factor-v1/yahoo/`. **No solicitar repetir la descarga** salvo pérdida/autenticación rota o hash discrepante; no inventar que este material reside en GitHub.
2. Contrastar los datos contra **NAV oficial del emisor**: [iShares EUNL](https://www.ishares.com/uk/individual/en/products/251882/ishares-msci-world-ucits-etf-acc-fund) y páginas DWS [XDEM](https://etf.dws.com/en/IE00BL25JP72-msci-world-momentum-ucits-etf-1c/), [XDEQ](https://etf.dws.com/en/IE00BL25JL35-msci-world-quality-ucits-etf-1c/), [XDEV](https://etf.dws.com/en/IE00BL25JM42-msci-world-value-ucits-etf-1c/). **NAV de share class expresado en USD; precios Xetra en EUR**. Primero reconciliar FX con fuente, fecha y cierre temporal explícitos; comparar series de rendimientos o tracking y diferencias justificables por prima/descuento a NAV/spread, no equiparar niveles absolutos.
3. Verificar eventos corporativos, ajuste Yahoo (`rawOpen × adjustedClose/rawClose`), dataciones y metodología vigente post-2016-11-03; ante huecos discrepantes **`INCONCLUSIVE_SOURCE_RECONCILIATION`**, no fijar tolerancias tras ver el error para forzar PASS.
4. Confirmar disponibilidad concreta de los tres ETF factoriales y EUNL para MyInvestor y tamaño mínimo ejecutable con títulos enteros; no deducirlo de que MyInvestor admita Xetra.
5. Sólo con estos requisitos superados se podrá congelar UNA construcción estática de ETF factoriales y compararla **neto** con 100% EUNL, mismo capital, cash, flujos, fiscalidad y `NEXT_OPEN`, usando replay actual. Ni los 2532 días ni la ventaja exploratoria del índice 2014–2025 son confirmación fresh.

**Decisión de continuidad 2026-10-26:** datos de cobertura `PASS`; **pasar a conciliación de proveedor/NAV, no volver a ejecutar el mismo preflight ni abrir directamente el backtest**.


## 7. Reconciliación oficial 2017–2025 integrada · 2026-10-27

Se ha avanzado desde `PASS_DATA_COVERAGE_PENDING_EXTERNAL_RECONCILIATION` a una **verificación independiente de consistencia anual del NAV**, manteniendo la misma muestra histórica **consumida** y sin abrir un backtest/política.

### Fuentes oficiales recuperadas (USD, ISIN exactos)

Los tres `Past Performance` oficiales DWS para las clases **1C** y el factsheet oficial iShares de la clase EUNL/SWDA **IE00B4L5Y983** contienen los rendimientos anuales del **propio ETF (NAV, después de gastos internos)**, no la rentabilidad de un índice simulada. Los documentos DWS señalan el cambio de benchmark del 3 de noviembre de 2016 y que 2016 es mixto, por lo que se **excluye**.

- EUNL / BlackRock: https://www.ishares.com/uk/professional/en/literature/fact-sheet/swda-ishares-core-msci-world-ucits-etf-fund-fact-sheet-en-gb.pdf
- XDEM / DWS: https://etf.dws.com/Download/Past%20Performance/IE00BL25JP72/IE/EN
- XDEQ / DWS: https://etf.dws.com/Download/Past%20Performance/IE00BL25JL35/IE/EN
- XDEV / DWS: https://etf.dws.com/Download/Past%20Performance/IE00BL25JM42/IE/EN

Rendimientos de **clase/ETF**, en **porcentaje USD**, transcritos del material oficial; **no son mediciones del replay de Custodia**:

| Año | EUNL | XDEM | XDEQ | XDEV |
| --- | ---: | ---: | ---: | ---: |
| 2017 | 22,45 | 32,7 | 23,2 | 22,3 |
| 2018 | −8,65 | −4,0 | −7,9 | −14,4 |
| 2019 | 27,76 | 28,8 | 31,5 | 19,6 |
| 2020 | 15,95 | 28,0 | 14,9 | −4,0 |
| 2021 | 21,90 | 14,5 | 23,3 | 20,1 |
| 2022 | −18,03 | −17,8 | −19,2 | −9,8 |
| 2023 | 23,86 | 11,7 | 25,8 | 19,5 |
| 2024 | 18,70 | 30,0 | 16,7 | 5,2 |
| 2025 | 21,16 | 21,2 | 15,4 | 39,5 |

**Uso limitado:** esta tabla se emplea **exclusivamente como referencia congelada de calidad de precios**; no escoger los ETFs ni pesos según quién obtuvo mejor retorno, no convertir los 9 años ya inspeccionados en holdout de inversión. Fuente y datos transcritos están dentro de `scripts/staticUcitsFactorIssuerAnnualReconciliationV1.mjs`.

### Cálculo y arquitectura

El nuevo runner `scripts/staticUcitsFactorIssuerAnnualReconciliationV1.mjs` **lee** el `manifest`/raw Yahoo que generó la prueba del 26 de octubre; comprueba los SHA256 sin refrescar las descargas de cotización. Descarga **una sola serie de divisas** oficial del BCE (USD por EUR: `EXR.D.USD.EUR.SP00.A`), también con caché create-only; convierte el cierre ajustado Xetra EUR a USD **multiplicando** por USD/EUR.

Para cada año 2017–2025 toma el último cierre Xetra disponible en diciembre del año anterior y el del año, con su referencia BCE de fecha igual/anterior; las separaciones máximas admitidas quedan definidas antes de abrir precios en `QUALITY_LIMITS`: cierre Xetra no más de **7 días** antes del fin de año, fijación BCE no más de **4 días** anteriores a ese cierre. Calcula `100 × ((closeEUR_fin × USDperEUR_fin) / (closeEUR_inicio × USDperEUR_inicio) − 1)` y lo compara con el rendimiento anual oficial, sin aplicar de nuevo TER. Rechaza datos faltantes, identidades de ISIN/serie FX incorrectas, ruta cache inesperada, hash distinto o retorno incongruente.

**Gates de consistencia preregistrados** exclusivamente para decidir si el feed exige investigar discrepancias (NO para inversión): 9 años por ETF, diferencia máxima por año **3,0 puntos porcentuales** y diferencia absoluta media por ETF **1,5 puntos**. El error puede reflejar diferencias entre cierre bursátil, instante de fijación del BCE y NAV; si se incumple, devolver `INCONCLUSIVE_ANNUAL_RECONCILIATION` sin alterar thresholds. Si pasa, estado `PASS_ANNUAL_CONSISTENCY_PENDING_DAILY_NAV`, **no** aceptación de NAV diario/corporate actions/broker ni alfa probado.

**Centro de validación integrado:** `static-ucits-factor-market-data-preflight-v1` pasa a `ARCHIVED` (resultado **PASSED** y 2532 fechas compartidas ya conservado), `kronos-stage-b-diagnostic-v1` sigue PARKED. Único CURRENT `static-ucits-factor-issuer-annual-reconciliation-v1`, mismo Centro y botón **«Contrastar gestoras y BCE»**. Orden fail-fast: test unitario del nuevo comparador -> test preflight antiguo -> guard catálogo -> arquitectura -> runtime -> TypeScript -> ejecutar reconciliador. **Nunca relanzar descarga de Yahoo en el job nuevo**. Pruebas deterministas en `tests/staticUcitsFactorIssuerAnnualReconciliationV1.unit.mjs`.

El output compacto del backend será `validation-runs/diagnostics/static-ucits-factor-issuer-annual-reconciliation-v1-result.json`, create-only, con las 36 comparaciones, hash FX BCE, URL documental de cada gestora, informe de diferencias y estado del gate; `productionAuthority=false`. **Advertencia de persistencia:** si el runtime perdió `.runtime/static-ucits-factor-v1/yahoo` o `validation-runs/diagnostics/static-ucits-factor-market-data-preflight-v1-result.json`, el job devuelve **BLOCKED**, sin recrear falsamente el snapshot original ni re-descargarlo en silencio; se investigará la recuperación real del manifiesto/caché.

**Estado al cierre del cambio de código:** fuentes issuer recuperadas y 36 retornos oficiales congelados; modelo matemático, conversión, cuatro activos y parser BCE probados sobre fixtures construidos en el runtime de comprobación (4/4 coincidencias sintéticas, 2201 fechas FX de prueba y rechazo de FX ausente). **No se ha ejecutado este job en el backend de Custodia** ni se ha leído su caché/FX reales desde ChatGPT; falta `npm run lint` y los guards en el runtime real. No afirmar `PASS` de precio, ni rentabilidad económica de cartera o mejora frente al core.
