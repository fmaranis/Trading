# PEAD Analyst Surprise V1 — preregistro de calidad predictiva

Fecha: 2026-09-29  
Estado: **FROZEN_BEFORE_PRICE_OUTCOMES / SIGNAL QUALITY ONLY / RESEARCH ONLY**

## Precondición

La auditoría de fuente `PEAD_EARNINGS_SOURCE_AUDIT_V1` cerró con:

`PASS_SOURCE_CAUSALITY_READY_FOR_SIGNAL_PREREGISTRATION`

Fuente autoritativa del preregistro:

- `validation-runs/diagnostics/pead-earnings-source-audit-v1-result.json`;
- revisión de fuente: `YAHOO_STATIC_DUAL_PIT_R1`;
- 463 eventos PIT por intersección;
- 461 eventos causalmente utilizables;
- `priceOutcomesFetched=false`;
- `economicOutcomesOpened=false`.

Este preregistro se congela **antes de abrir precios posteriores al anuncio**.

## Hipótesis única

Entre anuncios de resultados del S&P 500 PIT, una sorpresa de EPS más alta respecto al consenso previo debe asociarse con un retorno posterior mayor.

La hipótesis es de **calidad predictiva de señal**. No define una estrategia productiva, no decide importe, no introduce sizing, no modela cash, no aplica costes y no modifica `LEGACY`.

## Señal congelada

`PEAD_ANALYST_SURPRISE_V1`

Predictor por evento:

`surprise = Yahoo Surprise(%)`

No se retunea, winsoriza, transforma por precio ni combina con momentum, valoración, sector, Forward Risk u otra feature.

Motivo metodológico:

- el snapshot Yahoo aporta `EPS Estimate`, `Reported EPS` y `Surprise(%)`;
- el source audit exige que el signo de `Surprise(%)` no contradiga `Reported EPS - EPS Estimate` cuando los EPS redondeados difieren;
- el porcentaje del proveedor conserva precisión que se pierde cuando los EPS visibles están redondeados a 0,01;
- la literatura de PEAD documenta una relación entre sorpresas basadas en consenso de analistas y drift posterior, con evidencia históricamente más fuerte que la obtenida con simples modelos time-series.

Referencias metodológicas:

- Livnat & Mendenhall (2006), *Comparing the Post–Earnings Announcement Drift for Surprises Calculated from Analyst and Time Series Forecasts*, Journal of Accounting Research 44(1), 177–205.
- Jegadeesh & Livnat (2006), *Post-Earnings-Announcement Drift: The Role of Revenue Surprises*, Financial Analysts Journal 62(2), 22–34.

## Muestra diagnóstica

Se utiliza exactamente la misma ventana de eventos ya auditada:

`2024-01-15 -> 2024-03-15`.

Esto convierte esa ventana en **muestra consumida para promoción** cuando se abran los outcomes. Su resultado sólo podrá decidir si la señal merece una confirmación posterior fresh; nunca podrá promocionar producción.

Sólo entran eventos:

- incluidos por la intersección PIT dual congelada;
- con timing `BeforeMarket` o `AfterMarket`;
- con `EPS Estimate`, `Reported EPS` y `Surprise(%)` finitos;
- con precio Yahoo REAL suficiente para ejecutar la semántica de outcome;
- sin fallback sintético.

Población pre-precio esperada: **461 eventos**.

## Semántica causal de entrada

- `BeforeMarket`: primera apertura regular del `reportDate`; si no existe sesión ese día, primera apertura regular posterior.
- `AfterMarket`: primera apertura regular **posterior** al `reportDate`.
- nunca se utiliza el close de la sesión que sigue a la señal para construir el predictor;
- el predictor es exclusivamente el `Surprise(%)` ya disponible en el anuncio.

## Outcome único

Horizonte primario y único:

**60 sesiones de negociación posteriores a la entrada.**

Para cada evento:

- `entryPrice`: open ajustado de la sesión de ejecución;
- `exitPrice`: close ajustado de la sesión situada 60 sesiones después de la sesión de entrada;
- `stockReturn60 = exitPrice / entryPrice - 1`;
- benchmark: `SPY` entre las mismas fechas de entrada y salida;
- `excessReturn60 = stockReturn60 - spyReturn60`.

Ajuste de precios:

- Yahoo REAL;
- `adjustedOpen = rawOpen * adjustedClose / rawClose`;
- `adjustedClose = adjustedClose`;
- no se permite información sintética.

No se abre ningún horizonte alternativo 5/10/20/40/90/120 ni se elige el mejor después de ver resultados.

## Estadística diagnóstica congelada

### 1. Asociación continua

Spearman:

`rho = corr(rank(surprise), rank(excessReturn60))`.

### 2. Extremos de señal

Los eventos utilizables se ordenan por:

1. `surprise` ascendente;
2. `reportDate`;
3. `ticker`.

Se reparten determinísticamente en cinco grupos de tamaño lo más parecido posible:

- Q1 = sorpresas más bajas;
- Q5 = sorpresas más altas.

Se calculan:

- media de `excessReturn60` en Q1;
- media de `excessReturn60` en Q5;
- `Q5_Q1_spread = mean(Q5) - mean(Q1)`;
- hit-rate long-side Q5 = porcentaje de eventos Q5 con `excessReturn60 > 0`.

### 3. Significancia temporalmente condicionada

Antes de abrir outcomes se congelan **2.000 permutaciones deterministas** con semilla `20260929`.

En cada permutación:

- los valores de `surprise` se barajan **sólo dentro de la misma semana de anuncio**;
- los outcomes permanecen fijos;
- se recalculan Spearman y `Q5_Q1_spread`;
- se obtiene un p-value unilateral con corrección `(extremos + 1) / (iteraciones + 1)`.

Esto controla que un aparente PEAD no provenga únicamente de que determinadas semanas de mercado hayan tenido mejores retornos.

Los quintiles son diagnóstico estadístico, **no una regla de ejecución productiva**.

## Gates congelados

### Gate de cobertura

Debe existir outcome REAL válido para al menos **90%** de los 461 eventos pre-precio:

`minimumPriceCoverage = 415 eventos`.

Si falla, resultado:

`INCONCLUSIVE_SIGNAL_DATA_COVERAGE`.

No se reduce el mínimo después.

### Gates de señal

Si pasa cobertura, la señal sólo se retiene para confirmación fresh si se cumplen simultáneamente:

1. `Spearman rho > 0`;
2. p-value unilateral de Spearman por permutación intra-semana **< 0,05**;
3. `Q5_Q1_spread > 0`;
4. p-value unilateral del spread Q5−Q1 por permutación intra-semana **< 0,05**;
5. `mean(Q5 excessReturn60) > 0`;
6. `Q5 excess hit-rate > 50%`.

Los parámetros de inferencia quedan congelados en:
- `permutationIterations = 2000`;
- `permutationSeed = 20260929`;
- `maximumOneSidedPValue = 0.05`.

PASS:

`PASS_SIGNAL_DIAGNOSTIC_CANDIDATE_FOR_FRESH_CONFIRMATION`.

FAIL:

`FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY`.

No existe rescate paramétrico sobre esta muestra.

## Qué NO decide esta prueba

Aunque pase:

- no demuestra rentabilidad neta de costes;
- no fija importe;
- no fija número de posiciones;
- no fija duración productiva;
- no autoriza comprar;
- no autoriza reemplazar `LEGACY`;
- no autoriza una política económica;
- no autoriza promoción por sí sola porque el consenso histórico procede de `STATIC_REFERENCE` sin garantía independiente de vintage.

Si pasa, el siguiente paso será congelar **una única confirmación fresh** antes de abrir sus outcomes.

## Autoridad

- `productionDefault=LEGACY`;
- `productionAuthority=false`;
- `promotionAllowed=false`;
- `economicPolicyFrozen=false`;
- `priceOutcomesOpened=false` en el momento de este preregistro.
