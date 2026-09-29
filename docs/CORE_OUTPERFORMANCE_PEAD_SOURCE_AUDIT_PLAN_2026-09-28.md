# PEAD Earnings Surprise V1 — auditoría causal de fuente

Fecha: 2026-09-28  
Estado: **SOURCE_AUDIT_PASS_STATIC_REFERENCE / NO_PRICE_OUTCOMES / RESEARCH ONLY**

## Objetivo

Comprobar si Custodia puede estudiar de forma causal una hipótesis PEAD (post-earnings announcement drift) sin abrir todavía retornos posteriores ni diseñar una política económica.

Esta línea es materialmente distinta de `SECTOR_52W_HIGH_LEADERSHIP_V1`, que queda cerrada tras `FAIL_DIAGNOSTIC`. No es una V2 paramétrica ni un rescate de 52W.

## Fuentes congeladas

1. Universo point-in-time: EODHD S&P 500 `HistoricalTickerComponents`, índice `GSPC.INDX`, mediante el Fundamentals API documentado (`/api/fundamentals/GSPC.INDX?filter=HistoricalTickerComponents`).
2. Eventos: EODHD Calendar Earnings.
3. Contrato documental del proveedor:
   - `report_date`: fecha de anuncio;
   - `before_after_market`: BeforeMarket / AfterMarket cuando está disponible;
   - `actual`: EPS reportado;
   - `estimate`: consenso EPS;
   - `difference` y `percent`: sorpresa.
4. La documentación/glosario de EODHD describe `epsEstimate` como la estimación previa al release. Esto soporta un uso causal de diagnóstico, pero EODHD no aporta en este audit un archivo de vintages de consenso; por tanto ningún resultado histórico futuro de esta fuente tendrá autoridad de promoción por sí solo.

Referencias:
- https://eodhd.com/financial-apis/calendar-upcoming-earnings-ipos-and-splits
- https://eodhd.com/financial-academy/financial-faq/fundamentals-glossary-common-stock
- infraestructura existente: `scripts/fundamentalQualityValuationBroadPitV1Live.ts`

## Ventana de auditoría de datos

`2024-01-15 -> 2024-03-15`.

Se elige antes de inspeccionar el feed para abarcar una temporada de resultados suficientemente amplia. No se descargarán precios ni retornos posteriores.

## Reglas PIT y causalidad

Un evento sólo cuenta como S&P 500 PIT si el ticker estaba activo en `HistoricalTickerComponents` en su `report_date`.

Un evento es causalmente utilizable si:

- pertenece al S&P 500 PIT;
- `report_date` y fiscal `date` son fechas válidas;
- `before_after_market` es `BeforeMarket` o `AfterMarket`;
- `actual` y `estimate` son numéricos finitos;
- `difference` es consistente con `actual-estimate` con tolerancia congelada de `max(0,005 EPS; 0,01% relativo)`, para admitir redondeo del proveedor sin aceptar discrepancias materiales;
- no existe duplicado del mismo ticker + fiscal period + report date.

Semántica futura de ejecución, aún sin backtest:
- `BeforeMarket`: primera apertura regular del `report_date`;
- `AfterMarket`: primera apertura regular posterior al `report_date`;
- timing desconocido: excluir, nunca inferir.

## Gates de fuente congelados

- eventos PIT en la ventana: **>= 200**;
- cobertura de timing conocido entre PIT: **>= 70%**;
- cobertura de actual+consenso entre PIT: **>= 70%**;
- eventos causalmente utilizables: **>= 150**;
- duplicados: **0**;
- inconsistencias `difference != actual-estimate`: **0**;
- no se permiten datos sintéticos.

Si falla: `INCONCLUSIVE_SOURCE_CAUSALITY`. No se abre ninguna rentabilidad y no se cambian los gates para rescatar.

Si pasa: `PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION`. El siguiente trabajo será preregistrar una sola prueba de **calidad predictiva de señal**, separada de la política económica.

## Autoridad

- `productionDefault=LEGACY`;
- `productionAuthority=false`;
- `economicOutcomesOpened=false`;
- `promotionAllowed=false`.


## Endurecimiento técnico de fuente — 2026-09-29

Antes de abrir ningún outcome se sustituyó únicamente el transporte heredado del endpoint de componentes por el Fundamentals API documentado de EODHD para `HistoricalTickerComponents`. El parser acepta tanto la sección filtrada directa como una respuesta envuelta bajo `HistoricalTickerComponents`, y la caché de componentes cambia de identidad para impedir reutilizar accidentalmente una respuesta del endpoint anterior.

Este cambio **no modifica** la ventana, universo, definición PIT, eventos, thresholds, gates, sorpresa, timing, outcome futuro ni autoridad de producción. Sigue siendo la misma auditoría congelada y continúa sin precios/outcomes abiertos.


## Sustitución de fuente pre-outcome — 2026-09-29

La ejecución REAL del contrato EODHD alcanzó correctamente el último step del job, pero el proveedor respondió HTTP 403 porque la cuenta configurada sólo permite EOD gratuito y no autoriza Fundamentals `HistoricalTickerComponents`. La ejecución quedó `BLOCKED_PROVIDER_ENTITLEMENT`; no descargó precios, no abrió outcomes económicos y no consume muestra PEAD.

Antes de abrir ningún precio se sustituye la fuente por una ruta gratuita, pinneada y reproducible:

1. **Eventos de resultados** — snapshot histórico derivado de Yahoo Finance:
   - repositorio: `vivek-v-rao/Earnings-Dates`;
   - commit: `7ed98a0e2497b0a83bcbc290db41705089768c16`;
   - fichero: `earnings_dates_all.csv`;
   - blob: `abde11f719e93dc427a1040ffed3f0b8590b8508`;
   - campos utilizados: timestamp local/UTC del anuncio, ticker, `EPS Estimate`, `Reported EPS` y `Surprise(%)`.
2. **PIT S&P 500 — reconstrucción A**:
   - repositorio: `fja05680/sp500`;
   - commit: `a2430f2af0c79ddf0748e91de11bdeb1616ab5a7`;
   - `sp500_ticker_start_end.csv`;
   - blob: `3ed3b0e8d9e6e63730c153ee1f13ddaf6ed281bb`.
3. **PIT S&P 500 — reconstrucción B**:
   - repositorio: `lawcal/sp500-components-history`;
   - commit: `2e59b86998a119d68e377f9f98aa7a816cfc7d5b`;
   - `data/components_history.csv`;
   - blob: `6a865618173f322ecda9a569bc6bd48edcfaf996`;
   - se aplica el contrato del propio repositorio: `date_added <= date < date_removed` y `created_at <= date`.

La procedencia de esta revisión es **`STATIC_REFERENCE`**, no `REAL`. Los tres blobs se fijan por commit + Git blob SHA y el runner falla cerrado si cambia el contenido.

### Regla PIT conservadora

Un anuncio entra en el audit sólo si el **mismo ticker histórico** está activo en ambas reconstrucciones PIT en la fecha del anuncio. Una fuente nunca puede ampliar por sí sola el universo.

La auditoría detectó una única discrepancia en la ventana: `FISV` el 2024-02-06 aparece activo en la reconstrucción lawcal, mientras la reconstrucción fja registra el cambio `FISV -> FI` en 2023. El evento queda excluido por la regla de intersección. Esta política evita que aliases/tickers actuales reescriban retrospectivamente la identidad histórica.

### Timing causal Yahoo

Se utiliza el timestamp local publicado en `Earnings Date`:

- antes de 09:30 ET: `BeforeMarket`;
- desde 09:30 ET hasta antes de 16:00 ET: `DuringMarket` y se excluye;
- desde 16:00 ET: `AfterMarket`;
- timestamp no parseable: `UNKNOWN` y se excluye.

La semántica futura de ejecución no cambia:

- `BeforeMarket` -> primera apertura regular del mismo `reportDate`;
- `AfterMarket` -> primera apertura regular posterior;
- nunca se infiere un timing desconocido.

### Integridad de sorpresa

Yahoo redondea `EPS Estimate` y `Reported EPS` a 0,01, mientras `Surprise(%)` puede proceder de valores internos de mayor precisión. Por ello no se fuerza una igualdad porcentual artificial. El control estable es fail-closed ante una **contradicción direccional**: cuando los EPS redondeados difieren y `Surprise(%)` es distinto de cero, ambos deben tener el mismo signo.

La auditoría observó 23 casos donde los dos EPS redondean al mismo valor pero Yahoo conserva una sorpresa no nula; se documentan como efecto de redondeo y no se utilizan para inventar precisión adicional.

### Gates preservados y resultado

Se mantienen sin modificación los gates cuantitativos congelados antes de abrir el feed:

- PIT events >= 200;
- timing conocido >= 70%;
- actual + estimate >= 70%;
- causalmente utilizables >= 150;
- duplicados = 0;
- no sintético.

Resultado de la auditoría estática pinneada:

- earnings totales del snapshot: **150.983**;
- earnings en la ventana congelada: **2.141**;
- eventos por PIT fja: **463**;
- eventos por PIT lawcal: **464**;
- eventos por **intersección PIT**: **463**;
- timing conocido: **462 / 463 = 99,784%**;
- actual + estimate: **462 / 463 = 99,784%**;
- causalmente utilizables: **461**;
- BeforeMarket: **259**;
- AfterMarket: **203**;
- DuringMarket excluidos: **1** (`APA`, 2024-02-21 12:00 ET);
- actual ausente: **1** (`PNW`, 2024-02-27);
- duplicados: **0**;
- contradicciones direccionales: **0**;
- desacuerdos PIT: **1**, `FISV`, excluido por intersección.

Veredicto: **`PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION`**.

Este PASS sólo autoriza a preregistrar una prueba de calidad predictiva. La fuente sigue sin disponer de una garantía independiente de vintage del consenso y, además, su procedencia es `STATIC_REFERENCE`; por tanto ningún resultado histórico derivado de ella puede promover producción por sí solo. `productionDefault=LEGACY`, `productionAuthority=false`, `priceOutcomesFetched=false`, `economicOutcomesOpened=false`.
