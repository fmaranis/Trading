# PEAD Earnings Surprise V1 — auditoría causal de fuente

Fecha: 2026-09-28  
Estado: **SOURCE_AUDIT_DESIGN_FROZEN / NO_PRICE_OUTCOMES / RESEARCH ONLY**

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
