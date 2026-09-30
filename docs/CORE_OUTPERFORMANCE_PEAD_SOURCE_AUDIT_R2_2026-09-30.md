# PEAD Source Audit R2 — Yahoo calendar por rango + doble PIT

Fecha: 2026-09-30  
Estado: **PREREGISTERED PRE-OUTCOME / SOURCE QUALITY ONLY / RESEARCH ONLY**

## Motivo de R2

La revisión `YAHOO_STATIC_DUAL_PIT_R1` verificó timing, EPS y doble pertenencia PIT, pero el snapshot de earnings usado fue generado sobre los 2.483 tickers presentes en ITOT a 2026-01-15. Por tanto puede omitir compañías que sí pertenecían al S&P 500 en 2024 y dejaron de estar en ese universo antes de 2026.

Este hallazgo ocurre **antes de abrir cualquier precio/outcome PEAD**. R1 no consume muestra predictiva, pero deja de autorizar el diagnóstico de señal como muestra S&P 500 PIT completa.

## Fuente R2 congelada

### Universo PIT

Se preservan exactamente las dos reconstrucciones históricas pinneadas de R1:

- `fja05680/sp500` @ `a2430f2af0c79ddf0748e91de11bdeb1616ab5a7`;
- `lawcal/sp500-components-history` @ `2e59b86998a119d68e377f9f98aa7a816cfc7d5b`.

Un ticker sólo es elegible si ambas reconstrucciones lo sitúan dentro del S&P 500 en la fecha del anuncio.

### Earnings

Se consulta directamente el calendario Yahoo Finance por **rango de fechas**, sin seed de tickers actuales:

- endpoint actual utilizado por `yfinance.Calendars`: `/v1/finance/visualization`;
- región: US;
- tipos de evento: `EAD` o `ERA`;
- ventana exacta: `2024-01-15 -> 2024-03-15`;
- `filter_most_active=false`;
- paginación determinista de 100 filas mediante `offset`;
- no se usa ninguna lista actual de tickers para construir la población.

Campos requeridos:

- ticker;
- startdatetime / timing;
- EPS estimate;
- EPS actual;
- surprise percentage.

La fuente es no contractual/unofficial y se usa sólo para research.

## Causalidad

- BeforeMarket: anuncio anterior a 09:30 ET;
- AfterMarket: anuncio desde 16:00 ET;
- DuringMarket/unknown: excluir;
- actual y estimate deben ser finitos;
- surprise debe ser finita;
- el signo de surprise no puede contradecir `actual-estimate` cuando los EPS visibles difieren;
- no se permiten duplicados del mismo ticker + timestamp de anuncio;
- no se permite fallback sintético.

## Gates R2 congelados

R2 no se considera lista si no cumple simultáneamente:

1. `pitEvents >= 450`;
2. timing conocido >= 95%;
3. actual+estimate >= 95%;
4. causal eligible >= 440;
5. duplicados = 0;
6. contradicciones direccionales = 0;
7. la descarga termina mediante una página final con menos de 100 **filas crudas**;
8. filas crudas de Yahoo no parseables = 0;
9. al menos 95% de los 461 eventos causalmente utilizables de R1 aparecen también en R2 por ticker + reportDate;
10. ninguna lista de tickers actual interviene en la query Yahoo;
11. no sintético.

Los umbrales 450/440 no son gates de rentabilidad: son controles de completitud fijados antes de abrir outcomes y exigen que R2 no pierda materialmente la cobertura ya observada en R1.

## Resultado permitido

PASS:

`PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION_R2`

FAIL:

`INCONCLUSIVE_SOURCE_CAUSALITY_R2`

Un PASS sólo permite reautorizar el preregistro de señal PEAD existente, conservando su horizonte y gates ya congelados. No autoriza política económica ni producción.

## Autoridad

- `priceOutcomesFetched=false`;
- `economicOutcomesOpened=false`;
- `productionDefault=LEGACY`;
- `productionAuthority=false`;
- `promotionAllowed=false`.
