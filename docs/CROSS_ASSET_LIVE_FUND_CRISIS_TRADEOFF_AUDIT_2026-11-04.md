# Custodia — Contrastación de coberturas multiactivo con historiales UCITS *realmente existentes* (no backfills)

**Fecha: 2026-11-04; estado `LIVE_UCITS_CRISIS_HEDGE_EPISODIC_NO_STATIC_WEALTH_ALPHA`.** Investigación descriptiva documental y aritmética; **NO** replay de Custodia, **NO** promoción, ni nuevos jobs, módulos o cambios en `LEGACY`. 2017–2025 y los ejemplos escogidos después de observar historia son **CONSUMIDOS**, no prospectivos.

## 1. Por qué esta comprobación añade información y NO repite la prueba 2025 del ETF DBMFE

El candidato UCITS ETF `LU2951555403` DBMFE nació en **marzo 2025**, por tanto no puede servir para afirmar que habría protegido la cartera de 2022. Se han localizado **otros fondos UCITS diferentes** de estrategia trend-following con clases que sí estaban emitidas antes de 2022, y se ha comprobado su comportamiento histórico real y **restricciones de suscripción**. NO interpolar el rendimiento del fondo antiguo como si fuese el mismo ISIN, clase o precio del ETF de DBi.

**Contrastes reales de fuente:**

| Instrumento | ISIN | Inicio efectivo de clase | Divisa | 2022 | 2023 | 2024 | 2025 | Operabilidad/coste |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Schroder GAIA BlueTrend **C Acc EUR Hedged** | `LU1293073828` | **09-12-2015** | EUR, clase con cobertura | **+28,93%** | **−10,76%** | **−7,02%** | **−2,06%** | Suscripción mínima oficial **10.000 USD equivalentes**; gastos corrientes ~**1,54%** y comisión éxito **10%** HWM, entrada hasta **1%**. TER ya neto en NAV anual; no volver a restarlo |
| Man AHL Trend Alternative **DNY H EUR Acc** | `LU0424370004` | **21-07-2009** (fecha de constitución recogida en proveedor) | EUR, clase con cobertura | **+11,57%** | **−4,29%** | **−8,06%** | **+2,82%** | Mínimo divulgado **10.000 EUR**, gestión hasta **2,50%** más éxito **20%** HWM. Confirmar directamente gestora/ISIN y comercialización real |
| EUNL UCITS MSCI World **EUR Xetra** (comparador indicativo, **no benchmark obligatorio**) | `IE00B4L5Y983` | **25-09-2009** | EUR cotización, SIN cobertura de riesgo FX subyacente | **−12,96%** | **+19,55%** | **+26,24%** | **+7,12%** | ETF UCITS, TER ~0,20%; no es igual a NAV anual USD que otros estudios del proyecto |

**Fuentes y precisión:**
- Schroders ficha oficial con clase C EUR H, fecha de lanzamiento, historial de rentabilidades **redondeadas** 2022 +28,9 / 2023 −10,8 / 2024 −7,0, mínimo 10k USD equivalentes, cargos e instrucciones T−2/T+3: https://api.schroders.com/document-store/GAIA-BlueTrend-EUR-Hedged-C-Acc-FMR-LUEN.pdf .
- Schroder clase con detalle 0,01 pp y 2025: https://fondosyplanes.cincodias.elpais.com/fondo-inversion/SCHRODER-GAIA-BLUETREND-C-ACC-EUR-HEDGED-LU1293073828 .
- Man AHL DNY con ISIN, rentabilidades, condiciones y mínimo (datos de gestora transmitidos por proveedor, NO certificado por folleto actual): https://fondosyplanes.cincodias.elpais.com/fondo-inversion/MAN-UMBRELLA-SICAV-MAN-AHL-TREND-ALTERNATIVE-DNY-H-EUR-ACC-LU0424370004 .
- EUNL retorno anual en EUR 2022–25: https://www.justetf.com/es/etf-profile.html?isin=IE00B4L5Y983 . No cruzar con NAV USD 2017–2025 de `STATIC_UCITS_FACTOR_R1`, pues las magnitudes nominales serían erróneas.

**Importante**: clase EUR con cobertura de BlueTrend/Man no hace que su exposición económica sea idéntica a la de EUNL ni garantiza neutralización de todos los FX; sólo es una forma coherente de presentar rentabilidades de clases publicadas en **EUR**.

## 2. Coste sobre capital completo: el año que salva no asegura riqueza neta posterior

Ejercicio aritmético **NO replay de ejecución** y SIN rebalanceo: inicio de 2022, capital ficticio **13.000 EUR**, 80% EUNL y 20% fondo CTA, manteniendo participaciones hasta último día de 2025. Cada patrimonio final se calcula por `13.000×[0,8×∏(1+r_EUNL,año)+0,2×∏(1+r_CTA,año)]` usando las cuatro rentabilidades publicadas en EUR. No se inventan aportaciones, trades ni precios en sesión; ignora impuestos particulares, deslizamiento, comisión de suscripción/custodia/transacción, y no homologa riesgo ni disponibilidad real.

| Cartera ilustrativa 2022–2025 | Retorno 2022 | Múltiplo riqueza final 2025 | Capital final sobre 13.000 | Diferencia contra 100% EUNL |
| --- | ---: | ---: | ---: | ---: |
| 100% EUNL | **−12,96%** | **×1,40713580** | **18.292,77 EUR** | — |
| 80% EUNL + 20% Schroder BlueTrend C EUR H | **−4,582%** | **×1,33526130** | **17.358,40 EUR** | **−934,37 EUR** |
| 80% EUNL + 20% Man AHL DNY EUR H | **−8,054%** | **×1,32759959** | **17.258,79 EUR** | **−1.033,97 EUR** |

- Protección real-descriptiva sobre 2022: peso 20% BlueTrend reduce caída **8,378 puntos**; con Man AHL **4,906 puntos**. Es una amortiguación significativa **en ese año**, no garantía de protección en otros tipos de shock.
- El arrastre de retorno en la recuperación **2023–2025** da la vuelta a la diferencia de riqueza. El ejemplo está intencionalmente escogido para estudiar el tradeoff, **no para concluir una tasa general de fracaso** de los CTA.
- **Puerta de ejecutabilidad que falla:** ambos fondos C/DNY tienen mínimos comunicados del orden de **10.000 EUR/USD**; usar **2.600 EUR de un portfolio de 13k** como 20% en esas clases **no se podría ejecutar en condiciones estándar publicadas**. Puede existir comercialización con mínimo negociado, pero `NO_DATA` hasta que se confirme; **el cuadro es una identidad ilustrativa, no una simulación comerciable**.
- El ETF UCITS DBMFE EUR `LU2951555403` cotiza EUR en París desde 2025 y no anuncia un mínimo de 10k de esos fondos, pero **NO** se puede transferir ni un solo rendimiento de BlueTrend o Man al ETF iMGP. Necesita serie y spread propios y broker por ISIN.

**No declarar 934/1034 EUR como pérdidas realizadas** ni relacionar retorno 2022-25 con un supuesto predictor Forward Risk V8. Ninguna decisión dependió de V8 en este cálculo.

## 3. Una opción verdaderamente distinta: pagar seguro convexo en lugar de sustituir beta

Literatura académica y mercado sugieren la posibilidad de **mantener la exposición bursátil** y pagar explícitamente por cobertura convexa con opciones put. Pero hay que cuantificar prima de seguro; si no hay caída, la prima pagada perjudica patrimonio.

- CBOE `S&P 500 5% Put Protection Index (PPUT)` publica que el índice con puts redujo la frecuencia de pérdidas mensuales de 6% o más en su muestra, **a cambio de reducir subidas y pagar primas**: https://www.cboe.com/insights/posts/benchmark-indices-series-hedging-downside-exposure-with-pput-cll-and-cllz-indices/ . Es un índice teórico que asume reglas/exposición, **NO un ETF de 13k negociado**.
- Israelov y Ndong, `Equity Tail Protection Strategies Before, During, and After COVID-19`, JPM 2024 (peer-reviewed) concluyen que **coberturas resultan caras**, dependientes de trayectoria y algunas pueden empeorar los resultados incluso en episodios de estrés: https://doi.org/10.3905/jpm.2023.1.575 .
- `The Best Defensive Strategies: Two Centuries of Evidence` (Financial Analysts Journal, 2025/26) registra que el overlay de puts OTM en su muestra tiene retorno negativo de **~−2,5% anual cuando está escalado a un 5% de volatilidad realizada**. No extrapolar ese valor como 2,5% de prima anual bruta de nuestra cartera: metodología/escala diferentes. https://doi.org/10.1080/0015198X.2025.2602270 .
- Existe un ETF UCITS **buffer** de S&P 500 en Europa (`IE000WX2HZQ7`, First Trust Vest abril, lanzado 2025, TER 0,85%). Pretende amortiguar la primera caída del 10% **en la fecha final de su período de resultado** y **limita subidas mediante calls vendidos**; una compra a mitad de período no tiene el mismo buffer ni cap. **NO equivale** a una put pura ni a añadir hedge sobre 100% del índice. Serie 2022 inexistente y tamaño del ETF pequeño. https://www.justetf.com/en-es/etf-profile.html?isin=IE000WX2HZQ7

**Hipótesis que merece auditoría documental posterior, NO estrategia V12 ni parámetros elegidos:** aprovechar información predictiva retenida de **Forward Risk V8** sin vender ni recomprar núcleo, como señal contextual para **determinar si conviene comprar temporalmente protección convexa** (put/vehículo de cobertura) antes de que explote volatilidad implícita. El resumen técnico histórico dice lead mediano de alrededor de 40 sesiones en las caídas pronosticadas, pero no conocemos precio de las primas **en el instante de cada señal**, false positives, accesibilidad del derivado, retorno neto de opciones, ni probabilidades condicionales defendibles. Ese lead histórico y muestras V8 **están consumidos**: NO seleccionar hoy tenor/strike/threshold ni llamar a eso evidencia fresh.

Si no existe opción/contrato ejecutable por MyInvestor/ISIN a ticket pequeño y precio ex ante comprobable, esta hipótesis se debe etiquetar `NO_EXECUTION_PATH` y STOP. MyInvestor acredita acciones y ETF y varias líneas inversas, **no consta oferta de opciones individuales sobre índices** en la ficha oficial: https://myinvestor.es/inversion/broker/ . No interpretar ausencia de esta ficha como prohibición legal universal; simplemente **no verificado para ese broker**. Tampoco utilizar ETF inverso 2x/3x diario como put ni protección estable de largo plazo: reset diario/path dependence y riesgo de pérdida.

## 4. Nuevos controles antes de que exista siquiera un job

1. **Separar efectos**: ¿Queremos menor drawdown con aceptación de menor retorno, o ganancia neta incremental al índice sin deteriorar drawdown? Ambas son fronteras distintas; política no debería presentarse como mejor en ambas sin pruebas.
2. **Ejecución real**: producto/ISIN, plataforma/cotización EUR, prima actual, compra mínima, colateral y spreads; si no puede ejecutarse con el capital realmente disponible, descartar sin backtest.
3. **Economía por euro protegido**: inversión/ticket por riesgo cubierto, coste anual recurrente de primas, pérdidas ocasionales cuando no hay crash, importe de posibles payouts, efecto en la recuperación y en fiscalidad de una venta/ejercicio. `NO_DATA` de prima `as-of` bloquea el cálculo de ventaja esperada.
4. **Distancia del trabajo consumido**: NO modificar el V8 predictor ni inventar nuevas versiones de políticas V8–V11; una aplicación nueva de V8 como *seguro* solo se formularía conceptualmente antes de abrir una muestra **fresh**, no tuning en 2008/2020/2022.
5. **Benchmarks sin master único**: comparar cuando proceda frente a un conjunto fijado **ex ante** de índices/bond-cash/60-40 y la misma caja y flujos; no obligar superar cada activo ganador pasado, ni atribuir dinero nuevo a frecuencia de revisión.
6. **Validación de calidad de fuente**: series de los fondos no deben tener backfills previos a lanzamiento ni proveniencia confundida; toda variante que exija REAL se bloquea si solo existe índice sintético o proxy con distinto ISIN.

**Veredicto de esta auditoría:** `LIVE_UCITS_CRISIS_HEDGE_EPISODIC_NO_STATIC_WEALTH_ALPHA`. Ya hay evidencia independiente con ISINs de que tendencias pueden generar protección material en una crisis específica; **a 13k su adquisición en un peso adecuado puede no ser viable en clases históricas** y esa protección puede cobrar una factura grande durante mercados alcistas siguientes. **No queda descartada la cobertura transitoria sin venta de núcleo**, pero se exige ruta de ejecución real y primas ex ante antes de cualquier desarrollo.

**Próximo paso responsable:** revisar solamente la operabilidad por bróker y coste de cobertura convexa en UCITS disponible; si no hay datos de contratos y márgenes, mantener V8 únicamente como alerta/research context, no motor de ventas ni orden automática.
