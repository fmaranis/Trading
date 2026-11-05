# Custodia — PUT BME de un único ISIN: admisión, cotización de terceros y coste de seguro sobre capital cerrado

**Fecha 05-11-2026; estado `ONE_ISIN_ADMITTED_PUBLIC_SCREEN_FOUND_BME_EXECUTABLE_ASK_NOT_CONFIRMED`.**
Estudio estrictamente **documental y algebraico**, sin código, backtest, compra, venta ni cambio de `LEGACY`. Sigue `docs/TRUE_PROTECTIVE_PUT_EXECUTION_GATE_2026-11-05.md`; la meta es verificar UNA serie comparable, no sumar nuevas variantes de políticas.

## 1. Instrumento único comprobado entre varias fuentes

**`DE000FG0D9A8` — código SIBE `M4497` — Société Générale Effekten GmbH — Warrant PUT ordinario europeo sobre `IBX35`, strike `20.000`, vencimiento `18-12-2026`, EUR.** La **admisión a negociación efectiva el 19-06-2026**, no su vigencia de oferta continua en 05-11, está confirmada por aviso primario BME que distingue `W` (warrant ordinario) de `T/P` turbo. Fuente: https://www.bolsasymercados.es/dam/descargas/regulacion/renta-variable/bolsa-madrid/notas/2026/sgeg60warrants-em18jun26.pdf . La comunicación de Sociedad de Bolsas registra mismo ISIN/código/strike/mes: https://www.bolsasymercados.es/dam/descargas/regulacion/renta-variable/sociedad-de-bolsas/instrucciones-operativas/2026/2026-56-oi-warrants-sgeg.pdf .

**Ratio/paridad** de los partes diarios oficiales BME para esta línea: `0,001` *unidad índice por warrant*, equivalente a **1.000 warrants por una unidad del IBEX** para el cálculo de pago `max(K-S_T,0)×0,001 EUR` por warrant. Fuente: https://www.bolsasymercados.es/descargas/boletines/madrid/2026/06/22/1_32_0_20260622.pdf . Es un valor de ratio, NO un precio de ejecución. Con un cierre/index de liquidación potencialmente especial del índice a vencimiento, los términos finales del emisor, ajuste y condiciones de ejercicio prevalecen; KID exacto de `DE000FG0D9A8` **no ha sido recuperado/confirmado**.

**Precios de tercero para ESE MISMO ISIN:**
1. Bolsamanía ficha **26-08-2026** del ISIN `DE000FG0D9A8`: presenta `Venta 0,66`, `Compra 0,65` EUR, **volumen venta y compra 100.000** y última transacción con sello de hora `13:32 26/08/26`. Estos datos demuestran que el proveedor difundía horquilla y tamaño de mercado en esa fecha; **no prueban una ejecución real del usuario ni el precio de 05-11**. https://www.bolsamania.com/indice/IBEX-35/warrant/IBEX-20000-PW-1226-DE000FG0D9A8-55 .
2. Bolsamanía tabla `Warrants del IBEX 35`, página fechada **05-11-2026, actualización general 17:46**; para código `M4497` registra **`Venta 0,79` y `Compra 0,78` EUR**, con `Precio 0,74` EUR, **sin timestamp individual de esa serie ni tamaño visible en dicha tabla**. Cotización orientativa **no capturada del libro BME al instante de la señal**. https://media.bolsamania.com/indice/IBEX-35/warrants (enlace de sitio dinámico; el contenido abierto/caché puede mostrar otra sesión). Otra página del mismo grupo en la web muestra valores de otros instantes (`1,27/1,26`), prueba de que **no debemos combinar precios sin sello horario de línea**, no motivo para escoger el más favorable.
3. La **web oficial BME Precios Warrants** confirma difusión con **15 minutos de retraso** pero el listado devuelve `Information not available at this moment` en la recuperación textual, por lo que no permite certificar BUY-ASK/SIZE de `M4497` ahora. https://www.bolsasymercados.es/es/bme-exchange/mercados-y-cotizaciones/warrants/warrants.html
4. Existe una fuente **oficial de datos mercado**, no integrada en la app, BME `WRR N2` (mejores posiciones/volúmenes de warrants, hasta 5 niveles), con acceso mediante servicio de mercado o proveedor autorizado: https://www.bolsasymercados.es/es/bme-exchange/mercados-y-cotizaciones/market-data-services/datos-en-tiempo-real.html . **Suministrar feeds de cotización no equivale a licencia de operar.**

**Bróker categoría**: Bankinter publica expresamente `Warrants`, por orden ≤3.000 EUR `4,50 EUR` más canon BME (efectivo 300,01–3.000,00 EUR `2,45 EUR+0,024%` y otros gastos aplicables) y 0,30% comisión amortización con mínimo 0,90 EUR. https://www.bankinter.com/broker/tarifas-comisiones/cotizados . **NO sabemos que una cuenta existente del usuario pueda introducir `DE000FG0D9A8`, ni que MyInvestor lo permita; no se ha simulado o hecho operación.** A la venta/exercise se aplicaría tratamiento y costos reales pertinentes; no sumar arbitrariamente todos como si fueran iguales.

## 2. La pregunta económica correcta: ¿cuánto cuesta asegurar 13.000 EUR *sin inventar dinero*?

**Sólo escenario didáctico de una cartera 100% IBEX en EUR y un vencimiento**, no la cartera real del usuario ni cobertura MSCI World. Captura de **índice de referencia `S0=19.455,70` puntos a `05-11-2026 17:23`** de Bolsamanía, y `0,79 EUR` como **precio de compra supuesto procedente de la columna «Venta» del proveedor** (NO oferta BME ni ejecución confirmada; no interpretar columna al revés sin verificar convención del proveedor), ratio 0,001, strike 20000 y vencimiento a 43 días naturales. Fecha/hora del índice y de la serie **no están sincronizadas**. Fuente índice https://media.bolsamania.com/indice/IBEX-35/warrants .

Si el capital cerrado inicial es `C=13.000 EUR`, **no se puede pagar una prima adicional de bolsillo y afirmar que la cartera sigue siendo 100% bolsa**. Si los 13.000 estaban ya íntegramente en la cartera se necesitaría **vender una parte** para obtener prima, con posible comisión e impuesto, o contar con cash real inicial (no está documentado en el usuario).

Sin ingresos extra, con supuesto de vender parte del índice por la prima, el número de warrants que **cubre aproximadamente** la exposición residual es:

`N = floor(C / (S0*0,001 + 0,79)) = 642 warrants`.

- Prima pagada hipotética `642×0,79=507,18 EUR`, **3,90% del capital total como desembolso hoy**.
- Exposición a índice restante después de pagar prima: `12.492,82 EUR`; nominal aproximado de 642 warrants al `S0`: `642×19,45570 = 12.490,56 EUR` (sólo comparabilidad de unidades).
- Valor intrínseco **ya existente** al `S0`: `642×(20.000−19.455,70)×0,001=349,44 EUR` (no es beneficio neto; es dinero pagado como componente del precio).
- Valor temporal pagado en la hipótesis `642×(0,79−0,5443)=157,74 EUR`. Coste económico de la prima respecto de su payoff intrínseco **al vencimiento con subyacente constante**: aproximadamente **1,21% de C en ~43 días**, antes de impuestos, canon, comisiones, horquillas y coste de oportunidad; **NO** comparable al TER anual de un ETF.
- Diferencia entre columnas difundidas `0,79−0,78=0,01 EUR` por unidad ≈`6,42 EUR` para N642 de fricción instantánea de horquilla de ejemplo, sin verificar si el libro real ofrecería esa profundidad a ese tamaño. **No computar 0,01 EUR como spread cierto**.

**Cierre económico sintético a vencimiento**, sin rebalanceos ni costes, usando `V_T=(C−N·0,79)×(S_T/S0) + N·0,001·max(20.000−S_T,0)`. Esto presupone exposición exactamente indexada al IBEX 35 de contado sin tracking, dividendos/acciones corporativas, pagos de rentas ni fallos del emisor; si el fondo es de **total return** vs IBEX price index no coincide y hay que modelar dividendos. NO es replay ni backtest.

| IBEX en vencimiento vs referencia de pantalla S0 | Valor estimado de cartera + PUT | Pérdida neta sobre 13k antes de costes |
| --- | ---: | ---: |
| 0% | **12.842,26 EUR** | **−157,74 EUR** |
| −5% | **12.842,15 EUR** | **−157,85 EUR** |
| −10% | **12.842,03 EUR** | **−157,97 EUR** |
| −20% | **12.841,81 EUR** | **−158,19 EUR** |

**Esto ilustra muy bien qué ofrece realmente una put «protectora»**: si se logra comprar un strike por encima del spot a un precio razonable y con exposición ajustada, puede establecer un suelo *matemático al vencimiento* para una cartera **exactamente del mismo índice**. Su precio económico de seguro del ejemplo ronda **158 EUR por 43 días** y habría que renovarlo y pagar de nuevo si se desea más tiempo. No es un suelo garantizado durante toda la vida ni contra el riesgo de emisor, ni contra diferencias de ETF/índice, divisas, impuestos ni fallos de ejecución. **No extrapolar costes futuros, no escoger esos 43 días por haber visto 2022/V8 y NO convertir la cuota hipotética en estrategia.**

**Riesgo adicional de no cobertura en una cartera real**: una PUT de IBEX no protege exactamente EUNL, el S&P 500 ni una cartera mixta. Diferencias de geografía, beta/correlación, divisas y dividendos pueden hacer que el valor del warrant no crezca si baja el patrimonio; el suelo de la tabla **sería falso** fuera de la hipótesis *100% IBEX perfectamente replicado*.

## 3. Estado final y cuál sería una verdadera puerta de ejecución

El ISIN concreto **sí está confirmado** a través del aviso de BME, y existen referencias de precios del mismo warrant en una ficha y una tabla externa con fechas; esto avanza respecto del estado `VANILLA_PUT_WARRANT_MARKET_AND_BROKER_PATH_FOUND_QUOTE_NOT_VERIFIED` sin probar operativa hoy.

**Gate `SAME_ISIN_BME_ADMITTED_THIRD_PARTY_QUOTE_NO_EXECUTABLE_ASK`.** Falta para convertirlo en una operación viable:
- KID/condiciones finales de la SERIE exacta consultadas y coherentes con cotización, paridad, settlement/ref-date, emisor y límites; no inferir del producto genérico.
- Quote de libro BME en mercado abierto para **`M4497 / DE000FG0D9A8`** con **timestamp del instrumento, ASK y BID, profundidad a tamaño suficiente** y sin suspensión; fuentes BME WRR N2 / broker autorizado; página de terceros sin sello de hora *individual* no pasa.
- Disponibilidad por el **bróker real y permiso de operativa** (sin suponer Bankinter o imponer cambio a usuario), costes de compraventa/ejercicio, impuestos de vender parte de cartera para financiar las primas.
- Registro de flujo futuro de quotes as-of con reglas prospectivas congeladas; que este ISIN venza el 18-12-2026 no permite reconstruir buy prices de 2008–25 ni validar sus señales V8 consumidas. **72/83 episodios acertados es recall, no probabilidades de alertas con put rentable**.

**Resultado operativo: NO-GO para replays y órdenes, sin cambios de código**. La vía existe, pero cuesta capital y dinero, y todavía no se ha certificado la prima real ejecutable ni la precisión de las alertas. Si no hay acceso al libro/permiso, cerrar aquí la exploración de warrants en vez de encadenar ISINs o presentar precios de distinta sesión como cobertura real. `LEGACY` intacto.
