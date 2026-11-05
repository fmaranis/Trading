# Custodia — Puerta REAL de ejecución de una PUT protectora, sin venta del núcleo

**5 de noviembre de 2026. Estado `LISTED_TRUE_PUT_FOUND_EXECUTABLE_EDGE_NOT_DEMONSTRATED`.**
Investigación **documental y cálculo hipotético**, no recomendación de compra, no backtest, no codificación, no apertura de cuenta, no cambio de `LEGACY`. Continúa el estudio de `docs/CROSS_ASSET_LIVE_FUND_CRISIS_TRADEOFF_AUDIT_2026-11-04.md`.

## 1. Hay una opción auténtica: el problema no era la inexistencia del contrato

**Hallazgo comprobado en Eurex**: existe `iShares Core MSCI World UCITS Options` **código IWDA**, y el contrato tiene **ISIN del subyacente `IE00B4L5Y983`**, **el mismo ISIN** de EUNL en Xetra. Es una **opción real sobre 100 participaciones del ETF**, **denominada en USD** porque el subyacente contractual es `IWDA LN`, con ejercicio americano y **entrega física** del ETF a vencimiento/ejercicio. No es un ETF buffer, un ETF inverso con reseteo, un futuro ni una put sobre un índice diferente. **SAME_ISIN no significa que los títulos custodiados en MyInvestor puedan entregarse sin fricción en un contrato Eurex mantenido en otro bróker**: la entrega/ejercicio debe resolverse con el bróker, o el usuario necesita vender/cerrar la PUT *antes* de vencimiento (con su propia horquilla, liquidez y comisión).

- **Fuente oficial Eurex, ficha contractual IWDA:** https://www.eurex.com/ex-en/markets/etf-etc/eqt-idx-etfs/iShares-Core-MSCI-World-UCITS-Options-70398
- **Tamaño vigente a fecha de análisis:** cierre completo ETF `IWDA.L` London **4-11-2026 `146,43 USD`** por participación → **100×146,43 = 14.643 USD de exposición nominal a participaciones**, mismo orden de magnitud que el capital ilustrativo 13.000 EUR; **NO convertir mecánicamente a euros sin FX del momento y disponibilidad de posición/contrato**. Precio ETF (NO prima de opción) fuente https://markets.ft.markitdigital.com/data/etfs/tearsheet/historical?s=IWDA%3ALSE%3AUSD .
- **Bloqueo 1: mercado real de la PUT**. Una captura de la página Eurex referenciada en búsqueda conserva **Trading Date 09-09-2026**, mostrando **`volume=0`, `open interest=0`** sobre IWDA y todos los vencimientos allí desplegados, con `underlying closing price=0,00` (dato no válido). **Sólo es un snapshot de fecha anterior, no una prueba de inexistencia de cotizaciones en noviembre ni estadística agregada universal.** Demuestra que **listar un contrato NO certifica spread, bid/ask ejecutable, mercado activo ni prima contemporánea**. Fuente misma Eurex arriba. No inventar primas ni construir replay con Black-Scholes teórico como si fueran precios negociables.
- **Bloqueo 2: MyInvestor** documenta bróker de **acciones/ETFs/ETPs inversos**, comisión ETF 0,12% con mínimo 1 EUR y cambio divisa 0,30% cuando procede, pero **NO documenta en su oferta pública la negociación directa de opciones IWDA/Eurex**. Esto es `OPTIONS_BROKER_MYINVESTOR_UNVERIFIED`, **no** afirmar categóricamente que la impide. Fuente https://myinvestor.es/inversion/broker/ .
- **Ruta alternativa teórica con bróker distinto**: Interactive Brokers documenta **opciones largas/protectoras desde permisos de nivel 2**, sujetos a idoneidad y habilitación del mercado alemán y contrato concreto, y tarifas Eurex opciones sobre acciones/ETF alrededor de **1,10 EUR por contrato en modelo fijo** según tabla (más posibles otras partidas y tratamientos de ejercicio); **NO certifica que la cuenta del usuario tenga permiso, que IWDA tenga bid/ask razonable ni recomienda abrir cuenta**. Fuentes https://www.interactivebrokers.com/es/trading/products-options.php ; https://www.ibkrguides.com/clientportal/optionstradingpermissions.htm ; https://www.interactivebrokers.com/es/pricing/commissions-options-europe.php .

## 2. Alternativas europeas de menor tamaño: posibles, pero con riesgo de base

**Eurex ETF PUT `EUN2` sobre iShares Core EURO STOXX 50 UCITS ETF (Dist)**, `ISIN IE0008471009`, **100 participaciones/contrato, EUR, entrega física**. Cierre Xetra **04-11-2026 `64,02 EUR` por participación** → **6.402 EUR de exposición nominal por PUT**. Existe un snapshot fechado **09-09-2026** de Eurex con **317 contratos de volumen y 3.766 open interest** para `EUN2`, con operaciones PUT en varios vencimientos. Esta evidencia de actividad **no garantiza mercado continuo, liquidez en un strike concreto ni un precio ASK de hoy**.

- Eurex contrato y estadística fechada: https://www.eurex.com/ex-en/markets/etf-etc/eqt-idx-etfs/iShares-Core-EURO-STOXX-50-UCITS-Options-944948
- Precio ETF EUN2 04-11-2026 por cotización Xetra: https://www.marketscreener.com/quote/etf/ISHARES-CORE-EURO-STOXX-5-442164/quotes/

**VETO POR TRACKING/BASIS**: la opción EUN2 protege un ETF **EURO STOXX 50 de reparto** y **NO** es una PUT sobre MSCI World, S&P 500 u otra cartera global. Puede cubrir parte de un episodio de estrés correlacionado, pero también puede no pagar cuando el índice global que poseemos cae y el europeo no lo hace. El pago nominal 6.402 EUR **NO equivale a garantizar 6.402 EUR de la cartera global**. El tamaño más pequeño no compensa una cobertura de subyacente incorrecto.

**Otras referencias reales, no alternativas automáticamente buenas**:
- `ODXS`, opciones Micro-DAX liquidación en efectivo **1 EUR/punto DAX**; un DAX cercano a decenas de miles de puntos implica contrato de orden 20–30 mil EUR, no necesariamente micro para una cartera de 13k; además subyacente alemán, no global. https://www.eurex.com/ex-en/markets/idx/dax/Micro-DAX-Options-3371522 .
- `OESX`, opciones EURO STOXX 50, **10 EUR/punto índice**; contrato de orden **decenas de miles de euros**, normalmente demasiado grande para cobertura proporcional de 13k. https://www.eurex.com/ex-en/markets/idx/stx/euro-stoxx-50-derivatives/products/EURO-STOXX-50-Index-Options-69660 .
- La alternativa EURO STOXX EUN2 puede ser viable **solo** para una cartera que posea efectivamente EUN2 o con riesgo europeo pertinente; no generalizarla al portfolio global.

## 3. Frontera matemática para 13.000 EUR: cuánto seguro puede consumir el patrimonio

**Esto es un ejemplo hipotético sin primas reales, sin configuración V8 ni calendario de vencimiento congelado.** Si una PUT sobre **100 EUN2 = 6.402 EUR** cuesta en un período hipotético **3% del nominal**, la prima sería **192,06 EUR** por evento/periodo comprado (sin broker/spread/impuestos). Con alertas frecuentes:

| Contrataciones independientes del seguro (hipotéticas) | Coste total de primas 3%/contrato | % de patrimonio ejemplo 13.000 EUR |
| --- | ---: | ---: |
| 1 | 192,06 EUR | 1,48% |
| 2 | 384,12 EUR | 2,95% |
| 4 | 768,24 EUR | 5,91% |

Si cada put es **ATM** al adquirirla y se mantiene hasta vencimiento, y solo la última coincide con caída del subyacente europeo **20%** desde strike, entonces esa última pagaría **1.280,40 EUR** de valor intrínseco (más o menos su valor extrínseco cero al vencimiento) contra los **768,24 EUR de 4 primas** pagadas en total, es decir **+512,16 EUR hipotéticos antes de fees/tax**. Si ninguna se activa en un desplome suficiente, se pierden hasta las cuatro primas. **Si el MSCI World cae y EUN2 no, la PUT EUN2 no paga**, sin importar qué haya anunciado V8.

**No son previsiones ni opción negociable a 3%**: la prima real cambia con strike, vencimiento, volatilidad implícita, superficie, skew, dividendos, intereses, FX, horquilla y tiempo de alerta. **No usar esa tasa 3% como parámetro de un replay, ni elegir número de alertas basándose en 2016–2025.**

La ecuación económica relevante es `costoTotal = ∑(ASK_de_put × multiplier + fees + spread_de_salida + costes_de_operación)`, contra `pagoReal = ∑(BID_de_cierre_real o payoff_de_ejercicio)`. Para medir exceso neto se debe comparar P&L del conjunto (incluido coste de mantener la prima inmovilizada) con **los mismos activos sin protección**, no con índice de otra región o con precio de gráfico ex post.

## 4. El dato que la tasa de aciertos V8 NO resuelve: alertas falsas y prima temporal

V8 retuvo información predictiva sobre caídas futuras (p. ej., **72/83 episodios** anticipados en seis holdouts del trabajo anterior). **72/83 es sensibilidad o *recall por episodio*, no la probabilidad de que cada alerta acierte**. Para poner precio a seguros temporales hacen falta el número real de alertas, duración de protección, frecuencia de falsas alarmas, distancia hasta crash, magnitud bajo el subyacente *exacto*, momento al que encarece la volatilidad implícita y si la put puede comprarse **antes** del aumento de prima. El propio proyecto ya documenta V8 fragmentado (muchos ON/OFF). **No inferir número de puts o coste de primas de 72/83** y no convertir toda fase ON en orden diaria: eso sería volver a la política antigua bajo otro nombre.

**Preflight imprescindible y no paramétrico ANTES de un job**:
1. **Aprobación del tipo de operación**: un único broker confirmado para la put real o instrucciones reales para cierre antes de vencimiento cuando cartera y put residen en brokers diferentes. No forzar ventas del núcleo.
2. **Liquidez**: cadena de contratos con **timestamp**, strikes/vencimientos, **ASK ejecutable**, BID, tamaño y comisiones, snapshots auditables; strikes exactos compatibles con la cartera y ajustes de dividendos/corporate actions.
3. **Causalidad**: señal de V8 causal con timestamp, negociación al primer horario operable después de ella y **prima de ese instante**, sin serie sintética ni precio futuro; no abrir muestras históricas consumidas para optimizar strikes/duración.
4. **Viabilidad**: número de alertas, plazo efectivo de cobertura y coste de falsas alarmas; sensibilidad/recall ≠ precision/payoff. Si no hay precio de PUT ni mercado real, **`NO_VALIDATION_REAL`**.
5. **Fiscalidad y benchmark**: patrimonio neto con la posición original intacta, prima y costes como pagos explícitos; benchmark multiíndice definido antes, y resultado de riesgo, drawdown y pérdida de capital final; las aportaciones externas separadas.
6. **Sin ejecución automática** hasta evidencia fresh, contrato y cumplimiento legal de derivado en bróker; los límites en `CORE_ARCHITECTURE_V1` y `LEGACY` siguen vigentes.

## 5. Decisión

**`LISTED_TRUE_PUT_FOUND_EXECUTABLE_EDGE_NOT_DEMONSTRATED`**: la existencia del producto sí supera el veto inicial de *«no existe opción»*, pero **NO** el de *«se puede contratar a una prima real que permita monetizar V8 desde esta cartera y bróker»*. Se ha verificado un candidato exacto (PUT IWDA / EUNL mismo ISIN) y otro candidato con actividad estadística (EUN2) pero **subyacente distinto**. Sin quotes ASK/BID verificables y sin acceso MyInvestor confirmado, **NO-GO para programar replay/órdenes de puts ahora**.

No recomendar al usuario cambiar broker ni comprar opciones. **El siguiente trabajo que sí puede desbloquear el estudio es obtener una única ficha de cotización real y cadena con vencimiento/strike y autorización de operativa, y solo entonces decidir si el importe de primas y liquidez merece investigación prospectiva.** Ante ausencia de esos datos no hay motivo para más código, ni para reejecutar V8–V11 ni para reajustar sus thresholds. 
