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


## 6. Revisión adversarial de actividad y precios de 2026-11-03 a 2026-11-05

**Fecha de revisión: 05-11-2026. Resultado: `PROTECTIVE_PUT_EXECUTABLE_QUOTE_GATE_FAIL_PUBLIC_DATA`.** La existencia del contrato no certifica un precio de negociación, y hay un dato **más reciente** de fuente oficial Eurex para `CSPX` que refuerza el bloqueo. Se conserva el estado previo `LISTED_TRUE_PUT_FOUND_EXECUTABLE_EDGE_NOT_DEMONSTRATED`.

### 6.1. CSPX: 10 ETF por contrato, pero predominio de CALL y PUT sin operaciones

Eurex confirma `iShares Core S&P 500 UCITS Options (CSPX)`, **ISIN subyacente `IE00B5BMR087`**, divisa **USD**, contrato **10 ETF** (excepción al multiplicador general 100). Un contrato de tamaño más ajustable que IWDA (100 ETF), aunque **CSPX cubre S&P 500, NO exactamente una cartera MSCI World u otro índice arbitrario**. Ficha oficial: https://www.eurex.com/ex-en/markets/etf-etc/eqt-idx-etfs/iShares-Core-S-P-500-UCITS-Options-946876

La **tabla Eurex con Trading Date 2026-11-03** (URL indexada con parámetros de newsletter, mismos datos oficiales) exhibe **Open Interest 5.988** y **volumen total 1**: https://www.eurex.com/ex-en/markets/etf-etc/eqt-idx-etfs/iShares-Core-S-P-500-UCITS-Options-946876?pk_campaign=Email-EquityIndexNews_Newsletter&pk_cid=campaign-id-value&pk_content=20230526_ETFOptionsLaunch_2026-10-09-08%3A10_3562492&pk_group=null&pk_kwd=campaign-keyword-value&pk_medium=email&pk_placement=null&pk_source=newsletter

**Desglose de todos los vencimientos publicados, en esa fecha concreta**:
- `CALL` open interest: `14+609+235+4383=5.241` contratos = **87,53%** del total. `PUT` open interest: `28+444+245+30=747` contratos = **12,47%**. El principal bloque de `CALL` estaba en **junio 2027** con `4.383` contratos (73,2% de TODO el open interest). Citar headline OI de 5988 como si fueran PUT de protección sería incorrecto.
- **PUT negociadas el 03-11-2026: CERO**. La única operación registrada fue CALL del vencimiento junio 2027. `Open Interest` NO demuestra liquidez a ASK razonable en la serie PUT que necesitamos; negociación cero no demuestra tampoco que un creador de mercado no cotizase sin que se ejecutara ninguna orden.
- Una tabla pública Eurex para `IWDA` que aún devuelve **Trading Date 09-09-2026** muestra volumen/OI cero; **no se ha conseguido obtener** una instantánea por contrato `IWDA` con fecha 03-11 o 04-11 en la interfaz web pública. No extrapolar el valor de septiembre a hoy.
- La estadística general de Eurex `Market statistics (online)` está fechada **2026-11-04** y disponible en https://eurexchange.com/ex-en/data/statistics/market-statistics-online , **pero no permite deducir el ASK/BID individual de CSPX/IWDA ni por sí sola la actividad de su put concreta**. No inventar que la tabla general valida la microestructura.

### 6.2. Precios de liquidación oficiales ≠ ejecuciones posibles

Las **especificaciones oficiales Eurex** indican expresamente que el **precio diario de liquidación de las ETF options se calcula con un modelo binomial Cox/Ross/Rubinstein**, cuando procede con dividendos/tipos de interés. Esa marca puede existir incluso sin transacciones reales en una serie. Fuente https://www.eurex.com/ex-en/markets/etf-etc/eqt-idx-etfs/iShares-Core-EURO-STOXX-50-UCITS-Options-944948

**Decisión metodológica obligatoria:** el precio de liquidación sirve para contabilidad/valoración y puede registrarse con procedencia oficial `REAL` **sólo como observación de un valor de liquidación publicado**, distinguiendo mediante un campo semántico `SETTLEMENT_MODELLED_NOT_EXECUTABLE` su función de valoración, pero **no se aceptará como prima ASK/BID realmente ejecutable** para una prueba de prima comprada o liquidación vendida. Lo mismo para valores `theoretical` Eurex o una aplicación de simulación bursátil como `IEX Beursspel` (https://beursspel.iex.nl/) que muestra tablas históricas sin timestamp de orden verificable. **No usar supuestos ASK generados por modelo, precios «last» de otra fecha ni una pantalla sin profundidad como ejecuciones causales.**

Deutsche Börse/Eurex explican que el histórico granular del libro de órdenes y transacciones está disponible mediante productos de datos propios y proveedores habilitados: https://www.eurex.com/ex-en/data ; https://www.eurexgroup.com/dbcm-en/instruments-statistics/statistics/market-data . Por ahora **no se dispone en herramientas conectadas de un feed ASK/BID vivo del contrato exacto**, aunque existe una ruta comercial de datos y la alternativa de intermediarios habilitados. Tener acceso a datos requiere suscripción/licencia y **no implica** automáticamente derecho de operativa en el broker.

### 6.3. Condición matemática de la prima, que V8 todavía no suministra

**Ejemplo exclusivamente algebraico para una PUT ATM conservada hasta vencimiento, sobre exactamente el mismo subyacente y nocional, SIN primas observadas ni costes/riesgo/FX**: si la prima cuesta `c` fracción del nocional, la caída al vencimiento de magnitud `d` produce payoff `d` del nocional, y hay dos únicos escenarios (caída de magnitud d con probabilidad `q` o ausencia de pago), el valor esperado de la PUT es `q×d−c`. Para no perder en expectativa por **la PUT aislada**, se necesita `q > c/d`.

- Hipótesis prima `c=3%` y caída `d=10%` → tasa verdadera de **alertas que terminan en ese tipo de caída `q >30%`**, antes de fees/otros escenarios.
- Si `d=20%` → `q >15%`, en el mismo escenario simplificado.
- **No se ha medido `q`**, porque `72/83` de V8 es sensibilidad de episodios, NO `P(crash | alerta)`. Además el filtro binario omite caídas de distinta magnitud, movimientos antes de vencimiento, cancelación/cierre temprano y oportunidades correlacionadas. **No convertir `c=3%`, `d=10%` o el resultado de este ejemplo en thresholds/promoción**.
- **La comparación económica correcta exige también la cartera sin PUT, rendimiento neto, riesgo, coste de cash/derivado, pérdidas de alertas falsas y capacidad de comprar cada contrato antes de que suba la volatilidad implícita.** Una política puede ahorrar drawdown sin sumar patrimonio neto.

### 6.4. Cierre y siguiente condición externa

**Resultado de puerta: `PROTECTIVE_PUT_EXECUTABLE_QUOTE_GATE_FAIL_PUBLIC_DATA`**. No se ha demostrado que la PUT específica sobre IWDA o CSPX tenga ASK/BID competitivo y disponible en el momento de una señal de V8; **no se descarta universalmente el instrumento**, pero **no debe abrirse replay, política de mercado o motor**. No comprar ni vender; no sugerir arbitrariamente cambiar de bróker por la mera existencia del contrato. `LEGACY` inalterado.

**Evidencia que realmente cambia la decisión**: instantánea auditable de **contrato + strike + vencimiento + multiplicador + timestamp + ASK/BID + tamaño cotizado**, mercado y costes de ejecución y tratamiento de ejercicio/cierre confirmados, junto con una fuente sostenible de **snapshots futuros as-of**. Una cotización única de hoy puede demostrar ejecutabilidad **hoy**, pero no reconstruye precios históricos de V8 ya consumidos ni valida rendimiento de una estrategia retrospectiva. Sólo entonces diseñar investigación prospectiva con un protocolo congelado antes de observar outcomes.


## 7. Alternativa accesible en España: WARRANT PUT ordinario (no turbo), con cotización de emisor y broker concreto

**Fecha de revisión 2026-11-05. Nuevo resultado `VANILLA_PUT_WARRANT_MARKET_AND_BROKER_PATH_FOUND_QUOTE_NOT_VERIFIED`.**
Anterior conclusión **PUT Eurex IQDA/IWDA/CSPX sin ejecutabilidad** permanece intacta; este hallazgo investiga otro instrumento **titulizado**; no es la misma PUT estandarizada ni está libre de riesgo emisor.

### 7.1. ¿Existe el instrumento en un mercado utilizable desde España?

**SÍ**: BME Exchange documenta **warrants PUT ordinarios** sobre índices y otros subyacentes; son valores cotizados, con ratio por unidad, strike, expiración, **liquidación en EUR por diferencias** en el SIBE y nombramiento del especialista que facilita precios de compra/venta durante sesión. Contratar en cantidades pequeñas puede resultar más flexible que tener que comprar 10/100 participaciones del contrato Eurex; **PERO** no equivale a garantía de que cualquier hora haya ASK con tamaño, ni de que se cumplan términos de cobertura de cualquier cartera. BME distingue **warrants estándar** de **turbos** (barrera `knock-out` que puede extinguir seguro cuando el precio repunta), de `multi` (reseteo diario) y de `put-write` (vender puts, no comprar seguro). **Filtro obligatorio por tipo de producto**: `WARRANT_PUT_PLAIN_VANILLA`, sin barrera, *payoff PUT por debajo del strike*, con vencimiento posterior a señal.

Fuentes BME para esta distinción, funcionamiento y admisiones oficiales:
- https://www.bolsasymercados.es/es/bme-exchange/negociar/warrants.html
- https://www.bolsasymercados.es/es/bme-exchange/mercados-y-cotizaciones/warrants/admisiones.html
- https://www.bolsasymercados.es/es/bme-exchange/mercados-y-cotizaciones/warrants/warrants.html (**la tabla de precios devuelve «Information not available at this moment» al recuperarla; NO se ha capturado quote de serie vigente del libro BME**).
- CNMV documento inversor warrants: https://www.cnmv.es/Portal/Inversor/Warrants?lang=es . **Riesgo de crédito del banco emisor y suspensión del market making, posible pérdida total de prima**. Contrato emitido privado no equivale a opción compensada por cámara como Eurex.

**Intermediario REAL que publica acceso a categoría, sin afirmarlo del usuario:** Bankinter bróker permite **warrants ordinarios, turbos, etc.**, con comisión visible **4,50 EUR por orden hasta 3.000 EUR**, **9 EUR** superior, y **canon mercado BME** adicional (por ejemplo, rango efectivo 0–300 EUR publica 1,10 EUR por orden, más otras partidas). Es una ruta concreta de **mercado + intermediario para la CATEGORÍA**, sujeta a test de conveniencia/permisos y validación del ISIN. No prueba que Bankinter pueda negociar cualquier ISIN emitido hoy, ni que el usuario tenga cuenta, y no debemos recomendar abrirla por eso. Fuente: https://www.bankinter.com/broker/productos/cotizados y https://www.bankinter.com/broker/tarifas-comisiones/cotizados
- MyInvestor publica **acciones/ETF**, incluso acceso a Inversis-MyInvestor bajo tests para acciones/ETFs no listados en app, pero **no tenemos confirmación de operación de warrants**: https://myinvestor.es/inversion/broker/ . No inferir permiso por el mero buscador ISIN Inversis.
- Renta4/SG documento de conectividad de productos cotizados, fuente con interés comercial: https://bolsa.societegenerale.es/servicios/contratacion/brokers-conectados . No transferir automáticamente su acceso a MyInvestor ni su tarifa a Bankinter.

### 7.2. La primera cotización publicada (tiene FECHA y no es ASK ejecutable de hoy)

BNP Paribas, en su web de **España**, publicó la ficha de **warrant ordinario PUT S&P 500** `DE000BB20571` con:
- strike **7.000 USD**, **ratio/paridad 100 warrants por unidad de índice**, vencimiento **18-12-2026**, sin barrera knock-out en la ficha, delta indicada **−0,10**, subyacente de referencia S&P 500 **7.761,90**.
- **snapshot de 08-10-2026 a las 11:20:25**, `bid/Venta EUR 0,39` y `ask/Compra EUR 0,41`, tamaño **238.000** publicado por emisor. **No usar el bid de octubre como cotización de noviembre ni como transacción real**; la ficha advierte expresamente que **son indicaciones basadas en modelos propios y que el emisor puede suspender cotizaciones**. `Spread=(0,41−0,39)/0,41 = 4,878%` **de la prima ofertada**, incluso en ese instante y antes de broker. Eso **no** es el coste sobre todo el nocional cubierto, y NO se debe usar como horquilla esperada genérica.
- Página del emisor: https://warrants.bnpparibas.com/esp/es/product-details/DE000BB20571/ . El texto de la ficha con `08:00–22:00` hora de Berlín **no confirma que esa serie DE esté admitida en BME Madrid**. No sumar cotización de Alemania a tarifa de negociación BME de Bankinter como si fuera una única operación real.

**Economía del strike, no de un seguro exacto:** el índice del snapshot está `761,90/7761,90 = 9,816%` **por encima** de strike. Si el S&P 500 cayera `10%` hasta **6.985,71**, la PUT obtendría a vencimiento tan solo **(7000−6985,71)/100 ≈ 0,1429 USD por warrant** antes de divisas, mientras el coste de prima indicativo en ese momento era **0,41 EUR por warrant**. **No comparar USD de payoff con EUR de prima sin conversión**, pero sí evidenciar que una PUT muy OTM no protege el *primer tramo* de pérdidas y podría no compensar siquiera tras una caída de 10%. La etiqueta «PUT» no prueba que sea cobertura suficiente para el patrimonio.
- Una PUT sobre S&P 500 puede proteger la exposición de **S&P 500** de la cartera, pero no es una cobertura perfecta de cualquier ETF/índice global, ni de un índice europeo, bonos, divisa EUR/USD u otras posiciones.

### 7.3. Coste de orden: por qué importa incluso cuando las primas unitarias parecen pequeñas

**Cálculo ilustrativo independiente del ISIN anterior**, para **un warrant confirmado en BME** que se pudiera contratar por Bankinter en dos órdenes de hasta 3.000 EUR cada una (compra + venta antes del vencimiento):
- solo comisión broker `2×4,50 = 9,00 EUR`;
- canon de bolsa BME publicado para órdenes con efectivo inferior a 300 EUR `2×1,10 = 2,20 EUR`; sin contar otras partidas variables ni posibles reglas de amortización;
- coste básico aproximado **≥11,20 EUR por operación de ida/vuelta**, sin diferencia bid/ask, ni posible canon adicional, impuestos o pérdidas por prima. Si el presupuesto pagado de protección fuese sólo **100 EUR**, ese coste sería **≥11,2% del desembolso** en el supuesto concreto, no 11,2% del valor total de la cartera. Si fueran **250 EUR**, ≥**4,48% de prima**. **No es cotización de oferta ni un umbral V8**: explica por qué entradas frecuentes pueden destruir ventaja.
- Prima y ratio deben escalar correctamente: `unidades warrants × precio ask EUR` es prima inicial; nominal económico subyacente exige `unidades × (índice_subyacente / paridad) × FX` y **delta/riesgo base**; un presupuesto de 100 EUR en warrants OTM no garantiza 13.000 EUR cubiertos contra cualquier caída.

### 7.4. Decisión de diseño, sin crear otro módulo

**`VANILLA_PUT_WARRANT_MARKET_AND_BROKER_PATH_FOUND_QUOTE_NOT_VERIFIED`.** Por primera vez se confirma **mercado español + categoría de PUT ordinaria + acceso de un broker concreto y tarifas + un ejemplo real de bid/ask de emisor fechado con ISIN**. Se reducen dos bloqueos de la cobertura temporal **sin vender el núcleo**. **PERO NO se ha demostrado un único contrato con ISIN vigente, admisión BME, KID de serie, bid/ask BME con fecha/hora, volumen ejecutable y permiso broker simultáneamente**: los documentos son piezas distintas que NO deben combinarse en una transacción inventada.
- **Nueva puerta operativa mínima** si se continúa: una fila `ISIN + WarrantPlainPut + index + strike + ratio + maturity + listedBME + issuerCredit + BME/market quoteTime + trueBid/Ask+sizes + brokerOffer+allFees + settlement terms + applicableFX`. Sin todos estos datos en **UNA MISMA** serie, **`NO_EXECUTABLE_QUOTE_CONFIRMED`**.
- Sólo después se podría medir el coste de falsas alertas de V8 a partir de nuevas observaciones `REAL` **registradas después de congelar las reglas**, nunca generar primas por Black-Scholes ni utilizar el ejemplo de octubre para rellenar un backtest histórico. Los resultados V8 ya consumidos no sirven para elegir strikes, vencimiento o umbrales.
- Dado el capital de ejemplo 13.000 EUR, posibilidad de que el broker real del usuario sea distinto y riesgo de emisor, **NO recomendar ni operar el warrant** a partir de esta evidencia. Producto/decisión `LEGACY` inalterados; no nuevo job, feature, pantalla ni PR por inercia.

**El hallazgo sí modifica el juicio anterior**: la cubierta convexa **no está bloqueada por inexistencia comercial en España**; está bloqueada por demostrar **cotización operable de una serie determinada y una economía neta favorable**.
