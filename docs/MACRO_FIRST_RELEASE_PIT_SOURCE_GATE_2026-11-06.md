# Custodia — disponibilidad de datos macro punto-en-el-tiempo, primera publicación real

**6 de noviembre de 2026. Resultado: `MACRO_FIRST_RELEASE_SOURCES_FOUND_PIT_CONTRACT_POSSIBLE_PREDICTIVE_EDGE_UNPROVEN`.**
Punto de partida comprobado en `fmaranis/Trading/main` HEAD `4e378dd5bbbe85b6d13ad5b88a637f661c927570` y `docs/DEFENSIVE_SLEEVE_MACRO_REGIME_FEASIBILITY_GATE_2026-11-05.md`. No código, jobs, backtests, nuevos motores ni cambio de `LEGACY`. EUNL no es benchmark master obligatorio.

## Hallazgo: hay fuentes históricas oficiales que conservan CUÁNDO se sabía cada observación

| Fuente | Serie o identificación original | Hecho contrastado | Qué NO significa |
| --- | --- | --- | --- |
| **Eurostat HICP primer dato difundido** | `prc_hicp_fpd` — «Harmonised index of consumer prices — first released data», con cobertura histórica **desde enero 1996** para taxonomía ECOICOP antigua, y desde **enero 2024** para ECOICOP 2 (comprobar clasificación seleccionada) | Conjunto separado que conserva datos mensuales tal como fueron publicados originalmente, evitando introducir por defecto la revisión final retrospectiva. **La fecha de referencia del mes no es la fecha de difusión.** | El conjunto **NO sustituye automáticamente la estimación rápida FLASH** de fin de mes: los datos completos salen alrededor de mitad del mes siguiente. Tampoco demuestra por sí mismo una prima económica |
| **BCE Survey of Professional Forecasters (SPF)** | Dataset `SPF`, expectativas de HICP, crecimiento real y paro, por rondas trimestrales **desde 1999**; archivo oficial con publicación por fecha | Cambios de expectativas disponibles únicamente **DESPUÉS de la fecha pública de cada ronda**, no desde fecha de encuesta, inicio de trimestre o fecha de predicción. Descargar solo series/horizontes reportados ya publicados. | No es consenso de mercado del IPC mensual de la próxima sesión, ni una «sorpresa» de IPC contemporánea. Una expectativa más alta no prueba que el bono vaya a bajar después de publicarse |
| **BCE curva diaria de rendimientos** | Dataset `YC`, ejemplo **AAA eurozona 10 años** `YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y`; tipo cero cupón estimado con método Svensson | Curvas diarias desde **6 septiembre 2004** basadas en precios de deuda pública, difundidas en días TARGET; útiles para comprobar si los rendimientos **ya se habían reajustado** | Es una **estimación estadística**, NO el ASK/BID del fondo EUNA o EUN6, ni rendimiento de un ETF, ni dato disponible antes de su publicación efectiva |

**Enlaces oficiales:**
- Eurostat primer dato (incluye aviso documentado de corrección técnica de enero 2026): https://ec.europa.eu/eurostat/databrowser/product/page/prc_hicp_fpd
- Eurostat HICP metadatos y distinción FLASH vs total: https://ec.europa.eu/eurostat/cache/metadata/en/prc_hicp_esms.htm y https://ec.europa.eu/eurostat/web/hicp/information-data
- Eurostat API técnica: https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api y https://ec.europa.eu/eurostat/en/web/user-guides/data-browser/api-data-access/api-introduction
- BCE SPF datos de todas las rondas: https://www.ecb.europa.eu/stats/ecb_surveys/survey_of_professional_forecasters/html/all_data.en.html y archivo de informes por fecha https://www.ecb.europa.eu/stats/ecb_surveys/survey_of_professional_forecasters/html/all-releases.en.html
- BCE curvas de tipos, método y serie identificable: https://data.ecb.europa.eu/methodology/yield-curves y https://data.ecb.europa.eu/data/datasets/YC

**Riesgo de archivo y revisión:** la página `prc_hicp_fpd` documenta que los primeros datos de **enero 2026**, publicados el **25 febrero 2026**, se corrigieron por error técnico el **3 marzo 2026**; la página facilita archivo de lo inicialmente publicado. Por tanto el nombre «first published» **no exonera** de guardar `sourceDocumentURL`, `retrievalTimestamp`, `sourceHash`, `originalReleaseDate`, `correctionDate` (si aplica), **NO** utilizar cualquier descarga posterior como si fuera exactamente el snapshot previo a la corrección. La API normal de Eurostat sólo expone la versión actual del dataset y **no almacena versiones históricas**; el conjunto especial `prc_hicp_fpd` es un mecanismo distinto y limitado. No dar por comprobado un parser funcional de API: **en este gate se verificó documentación y publicaciones, no ingestion técnica end-to-end**.

## Prueba documental de causalidad CON CIFRAS HISTÓRICAS, sin mirar precios futuros

Previsiones **para el MISMO año calendario 2023** publicadas por la encuesta SPF del BCE:

| Ronda | **Fecha en que el público pudo conocer resultados** | IPC anual 2023 esperado | Crecimiento PIB 2023 esperado | Fuentes BCE |
| --- | --- | ---: | ---: | --- |
| `2022Q2` | **15-04-2022** | **2,4%** | **2,3%** | `SPF 2022Q3` tabla «Previous SPF» y archivo 2022Q2 |
| `2022Q3` | **22-07-2022** | **3,6%** | **1,5%** | BCE nota oficial 22/07/2022 |
| `2022Q4` | **28-10-2022** | **5,8%** | **0,1%** | BCE nota oficial 28/10/2022 |

Fuentes precisas:
- https://www.ecb.europa.eu/press/pr/date/2022/html/ecb.pr220722~3bb7720d07.en.html
- https://www.ecb.europa.eu/press/pr/date/2022/html/ecb.pr221028~8ba2374005.es.html
- https://www.ecb.europa.eu/stats/ecb_surveys/survey_of_professional_forecasters/html/all-releases.en.html

**Interpretación causal necesaria:** en **abril-julio-octubre de 2022** las expectativas de **inflación 2023 subían** y las de **PIB 2023 bajaban**. La mezcla es compatible con **shock inflacionista + deterioro de crecimiento simultáneos**, de signo ambiguo para bonos nominales largos. **NO se deduce rentabilidad futura de EUNA, EUN6, IBCI, oro ni índices de renta variable.** Las previsiones eran públicamente conocidas en la fecha indicada; no demuestran que el inversor pudiera evitar caídas que hubiesen ocurrido **antes** de cada publicación. Esos episodios se consideran **CONSUMIDOS**: sirven para demostrar la arquitectura temporal, nunca para diseñar umbrales y promocionarlos sobre la propia muestra.

**No adelantar información en replays:** `SPF surveyDates 01–05 July 2022` ≠ `publicReleaseDate 22 July 2022`. Los datos de 2022Q3 sólo entran después de la nota, y una compra de cierre **anterior** queda prohibida. Si no consta la hora exacta de publicación, aplicar *convención conservadora siguiente sesión* después de la fecha de difusión, preservando `NEXT_OPEN` de señales y ejecución propia. Lo mismo con `YC` calculada/publicada en días TARGET: no usar como «dato conocido a apertura» una curva cuyo valor se conoce más tarde. El PDF del BCE con notas técnicas antiguas indica publicación en torno a 12:00 CET, pero debe verificarse el timestamp por vintage operativo, no inventarlo al reconstruir 2022.

**Validación fuera del contexto de 2022 (dato actual, sin señal de inversión):** la ronda SPF **2026Q4** figura publicada **30-10-2026** y su comunicado cifra expectativas de **IPC 2027 2,6% (revisión +0,4 pp)** y **PIB 2027 1,3% (revisión +0,1 pp)**, evidencia de que cambios de inflación pueden ir acompañados de expectativas de crecimiento que *mejoran*, no siempre «estanflación». Fuente https://www.ecb.europa.eu/stats/ecb_surveys/survey_of_professional_forecasters/html/all-releases.en.html y https://www.ecb.europa.eu/stats/ecb_surveys/survey_of_professional_forecasters/html/ecb.spf2026q4.en.html . **No inferir movimiento de mercado ni recomendar rotación** a partir de esos datos.

## Contrato mínimo de calidad de fuente, SIN nuevo motor

Una futura observación sólo es elegible `REAL` para diagnóstico si conserva:

`sourceId, seriesKey, geographicArea, observationPeriod, forecastTargetPeriod, originalReleaseDate, originalReleaseTimestampOrConservativeNextOpen, observedValue, units, firstPublishedOrRevisionFlag, releaseVintage, retrievalTimestamp, sourceURL, contentHash, sourceRole`.

- `sourceRole` diferencia `FLASH`, `HICP_FIRST_PUBLISHED_FULL`, `SPF_QUARTERLY_FORECAST`, `ECB_YC_ESTIMATED_CURVE`, y `MARKET_ETF_RETURN`. Estos **NO** son nuevos tipos de procedencia; seguir `REAL | STATIC_REFERENCE | SYNTHETIC` en producción, con `sourceRole` como metadato de significado. Una fuente `REAL` puede contener valores calculados/estimados por el BCE que **NO** sean una orden real ejecutable de ETF.
- Si falta `originalReleaseDate`, hay corrección sin versión de archivo identificable, taxonomía inestable o fecha de anuncio distinta de `effectiveDate`: `FAIL_CAUSAL_SOURCE`. No usar `observationPeriod` ni fecha de actualización de base de datos como fecha de disponibilidad. No fallback sintético silencioso.
- No confundir `YC` euro AAA agregada con rendimiento exacto de bonos globales EUNA, que también tienen riesgo de crédito y varias curvas; un vínculo requiere series del ETF REAL, cupones/dividendos, gastos, spreads y calendario de negociación. `EUN6` es distribución y necesita total-return / cash-flows correctos.
- **Evidencia predictiva/negociable**: para justificar rotación de duración, hay que comprobar si las expectativas SPF `as-of` o HICP first-release aportan predicción *incremental* **más allá de la propia curva YC ya observada por el mercado** y si el beneficio neto alcanza capital total después de fiscalidad. Ni `IPC>2%` ni `SPF inflacion crece` son por sí mismos un edge. 2022 está consumido, cualquier política candidata debe congelarse antes de abrir datos fresh suficientes. No usar regresión en toda la historia para ajustar puertas y llamarlo OOS.

## Decisión ejecutiva

**`PASS_DOCUMENTARY_PIT_SOURCES`** para Eurostat `prc_hicp_fpd`, SPF BCE y YC BCE, con **limitaciones explícitas de latencia, corrección y rol semántico**. Mejora concreta: el bloqueo «no hay dato macro real de primera publicación» es falso; **sí hay archivo oficial estructurado**.

**`NO_GO_TRADING_POLICY` y `NOT_TESTED_END_TO_END_INGESTION`**: encontrar el dato no demuestra poder anticipar precios de los ETF, especialmente cuando inflación y crecimiento se deterioran simultáneamente y la curva del mercado ya descuenta las expectativas. No crear job/replay/algoritmo sin primero verificar descarga/parsing de un conjunto pequeño y contrato as-of; no repetir V8/V9/V10/V11 ni escoger pesos/umbrales sobre fechas consumidas. En caso de avance verificable, integrar en la infraestructura de datos/research ya existente, sin segundo motor.
