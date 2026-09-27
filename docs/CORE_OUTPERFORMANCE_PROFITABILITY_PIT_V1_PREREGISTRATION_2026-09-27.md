# CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1 — preregistro de traducción accionable

Fecha: 2026-09-27

Estado: **FROZEN BEFORE STOCK OUTCOMES / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Antecedente: `CORE_OUTPERFORMANCE_PROFITABILITY_V1` ha superado el diagnóstico 2016-2021 y la confirmación temporal 2009-2014. Este protocolo no vuelve a buscar otra variante del factor; prueba si la misma idea puede traducirse causalmente a acciones identificables.

Producción continúa `LEGACY`.

## Rol de la muestra

La ventana de esta traducción está **consumida por investigación previa de mercado** y se usa sólo como diagnóstico de implementación:

- anchors anuales: finales de junio 2016, 2017, 2018, 2019, 2020 y 2021;
- cinco periodos completos: primer NEXT_OPEN posterior al cierre de junio de 2016 hasta primer NEXT_OPEN posterior al cierre de junio de 2021;
- no se presenta como confirmación fresh de alpha;
- la confirmación independiente de la familia ya es 2009-2014;
- cualquier promoción posterior exige evidencia future-forward independiente.

## Universo histórico

Fuente estática pública y versionada:

- `chinobing/historical_sp500_constituents`;
- commit congelado: `019beba2644764db88219cee6a8c43b8aae4904e`;
- current constituents blob: `1431476ddf0f0389afa175d010116d96c8371975`;
- historical changes blob: `ccdcb9d50c588a198c2eecdf0f7c38a7f205c75e`.

El snapshot de cada fecha se reconstruye hacia atrás desde la lista congelada aplicando inversamente todos los cambios posteriores. Esta fuente se etiqueta `STATIC_REFERENCE`, no como master oficial completo. No se usan constituyentes actuales sin reconstrucción.

## Señal congelada

Traducción SEC de operating profitability, deliberadamente más estricta y no byte-identical a French:

`OP_SEC = (Revenue - COGS - SG&A - InterestExpense) / positive BookEquity`

Reglas:

- sólo `10-K/10-K/A`;
- `filed <= signalDate`;
- todos los componentes anuales deben corresponder al mismo fiscal-period end;
- book equity positivo en ese mismo cierre;
- sin relleno con datos posteriores;
- sin fallback a `OperatingIncomeLoss` si faltan componentes;
- negativos permanecen en el cross-section; no se filtran para favorecer el resultado.

Tags equivalentes se resuelven por listas congeladas en el runner. Si no hay cobertura suficiente, `INCONCLUSIVE_COVERAGE`.

## Selección y ponderación

- rank descendente por `OP_SEC`;
- desempate por ticker normalizado;
- top decile = `ceil(N/10)`;
- value-weight dentro del decil usando market cap causal = raw close en signalDate × últimas shares outstanding con evidencia causal <= signalDate;
- no equal-weight fallback;
- no mínimo de profitability retrospectivo;
- aliases de share class congelados para ejecución: `BRK.B/BRKB -> BRK-B` y `BF.B/BFB -> BF-B`;\n- no sector filter, momentum, valuation, Forward Risk ni stops.

## Calendario y ejecución

- anchor = 30 de junio de cada año;
- signalDate = última sesión REAL de mercado <= anchor;
- executionDate = primera sesión REAL posterior a signalDate;
- la selección sólo puede usar información <= signalDate;
- retorno de cada posición desde adjusted-open en executionDate hasta adjusted-open del siguiente executionDate;
- adjusted-open = raw open × (adjusted close / raw close) de la misma sesión;
- sin lookahead.

Una baja/fusión o endpoint no resoluble de una posición seleccionada hace el periodo `INCONCLUSIVE_SELECTED_OUTCOME_COVERAGE`; no se renormalizan silenciosamente supervivientes.

## Benchmarks

Mismo intervalo y misma semántica de adjusted-open:

- SPY = parent USA;
- URTH = proxy global del core.

URTH sigue siendo proxy USD; no se presenta como equivalencia exacta con la cartera EUR de Custodia.

## Cobertura mínima preregistrada por formación

- miembros históricos reconstruidos >= 450;
- CIK mapeados >= 350;
- filas OP_SEC evaluables >= 250;
- selección top-decile >= 25;
- market-cap causal disponible para 100% de seleccionados;
- outcome endpoint disponible para 100% de seleccionados.

## Gate Stage C1 — traducción de señal

Condiciones conjuntas:

1. cinco periodos completos evaluables;
2. CAGR bruto de la cartera > CAGR SPY;
3. CAGR bruto de la cartera > CAGR URTH.

PASS => `PASS_ACTIONABLE_TRANSLATION_GROSS_ONLY` y permite Stage C2 económico.
FAIL => `FAIL_ACTIONABLE_TRANSLATION`; no cambiar fórmula, decil, ponderación o fechas.
Coverage/data fail => estado inconcluso, no búsqueda de sustitutos después de outcomes.

## Stage C2 — sólo tras PASS C1

Usará la misma selección congelada dentro del harness de Custodia y los costes/fiscalidad existentes, incluyendo el perfil MyInvestor ya definido en el repositorio. Debe cumplir los gates económicos del plan original:

- exceso neto CAGR > core y parent;
- exceso positivo con costes de transacción duplicados;
- max drawdown diario no peor que core y Sharpe >= core;
- evidencia independiente future-forward antes de promoción.

No modificar producción; `LEGACY` permanece default.
