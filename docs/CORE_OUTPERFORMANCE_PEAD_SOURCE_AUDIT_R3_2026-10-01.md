# PEAD Source Audit R3 — Yahoo range + doble PIT + next-session causal

Fecha: 2026-10-01  
Estado: **PREREGISTERED PRE-PRICE / SOURCE QUALITY ONLY / RESEARCH ONLY**

## Motivo de R3

`PEAD_EARNINGS_SOURCE_AUDIT_R2` descargó correctamente 3.590 filas Yahoo y 468 eventos dentro del S&P 500 PIT, pero Yahoo devolvió timing histórico no utilizable para los 468 eventos (`startdatetimetype` sin hora causal utilizable). R2 terminó `INCONCLUSIVE_SOURCE_CAUSALITY_R2`.

R2 no se retunea ni se reescribe. Se conserva como evidencia consumida de contrato de fuente.

R3 modifica únicamente la semántica causal de ejecución **antes de abrir cualquier precio/outcome PEAD**:

> para todo anuncio, la observación de retorno comienza en la primera apertura regular estrictamente posterior al `reportDate`.

Esto elimina la necesidad de distinguir BMO/AMC/TAS y evita atribuir al drift el salto del propio anuncio.

## Fuente

Se conserva el transporte validado en R2:

- Yahoo Finance `/v1/finance/visualization`;
- región US;
- eventos `EAD | ERA`;
- rango exacto `2024-01-15 -> 2024-03-15`;
- sin `MOST_ACTIVES`;
- sin seed de tickers actuales;
- paginación de 100 filas;
- orden estable `startdatetime ASC`;
- condición terminal basada en filas crudas;
- 0 filas crudas no parseables.

Universo PIT:

- `fja05680/sp500` pinneado;
- `lawcal/sp500-components-history` pinneado;
- inclusión sólo por intersección exacta en `reportDate`.

## Predictor

Por evento:

- `EPS Estimate`;
- `Reported EPS`;
- `Surprise(%)`.

El predictor posterior de señal continúa siendo `Surprise(%)`.

## Causalidad R3

El timing Yahoo pasa a ser **diagnóstico, no gate**.

Evento fuente causalmente utilizable si:

1. pertenece a la intersección PIT;
2. `reportDate` es válido;
3. estimate es finito;
4. actual es finito;
5. surprise es finita;
6. no existe contradicción direccional entre `actual-estimate` y surprise cuando los EPS visibles difieren;
7. no es duplicado ticker + reportDate.

Semántica futura de outcome:

`entry = first regular market open with sessionDate > reportDate`.

No se permite:

- same-day open;
- same-day close;
- inferir BMO/AMC;
- usar una hora placeholder de Yahoo;
- fallback sintético.

## Gates congelados R3

- `pitEvents >= 450`;
- actual+estimate >= 95%;
- surprise finita >= 95%;
- causal eligible >= 440;
- duplicados ticker+reportDate = 0;
- contradicciones direccionales = 0;
- filas crudas no parseables = 0;
- página terminal confirmada;
- overlap con las 461 claves ticker+reportDate de R1 >= 95%;
- sin seed de tickers actuales;
- no sintético.

El timing conocido se reporta pero no decide PASS.

PASS:

`PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION_R3`

FAIL:

`INCONCLUSIVE_SOURCE_CAUSALITY_R3`

## Relación con la señal

Si R3 pasa, `PEAD_ANALYST_SURPRISE_V1` conservará:

- predictor `Surprise(%)`;
- benchmark SPY;
- horizonte 60 sesiones;
- 2.000 permutaciones intra-semana;
- p unilateral < 0,05 para Spearman;
- p unilateral < 0,05 para Q5-Q1;
- long-side Q5 > 0;
- hit-rate Q5 > 50%;
- cobertura = `max(415, ceil(90% * sourceEventsR3))`.

Sólo cambia la entrada causal a `NEXT_SESSION_STRICTLY_AFTER_REPORT_DATE`.

La muestra de precios sigue sin abrirse en el momento de congelar R3.

## Autoridad

- `priceOutcomesFetched=false`;
- `economicOutcomesOpened=false`;
- `productionDefault=LEGACY`;
- `productionAuthority=false`;
- `promotionAllowed=false`.
