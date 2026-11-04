# Custodia — MSCI World, réplica física vs swap: ventaja estructural sobre TODO el capital

**Fecha: 2026-11-04. Estado: `SAME_INDEX_REPLICATION_DOCUMENTARY_EDGE_SMALL_NOT_PROMOTABLE`.**
**Sin backtest, sin órdenes, sin nuevo motor ni job, `LEGACY` intacto.**
Revisado HEAD canónico `fmaranis/Trading/main` antes de investigar. Continúa `docs/WHOLE_CAPITAL_AFTER_TAX_FRICTION_PAPER_GATE_2026-11-04.md`; es **otro mecanismo específico**: réplica sintética del *mismo* índice, tratamiento de retenciones de dividendos en el fondo y tarifa del swap. NO nueva apuesta momentum, Quality, sector, market timing, ni mezcla de ETFs.

## 1. Contrato económico y universo idéntico

| Fondo | ISIN | Bolsa divisa / símbolo | Índice y método | Gastos publicados |
| --- | --- | --- | --- | --- |
| EUNL, iShares Core MSCI World UCITS ETF USD Acc | `IE00B4L5Y983` | Xetra EUR `EUNL.DE` | MSCI World Net Return USD, réplica física optimizada | TER `0,20%` (iShares factsheet marzo 2026) |
| Invesco MSCI World UCITS ETF Acc | `IE00B60SX394` | Xetra EUR `SC0J`, Yahoo símbolo a verificar independientemente | MSCI World Net Return USD, réplica **sintética unfunded swap**, acumulación | Invesco desde 2026-04-01 comisión 0,05% gestión + swap fee 0,03%, **suma 0,08% según factsheet**; costes del bróker adicionales |

Ambos ETF mantienen exposición económica al MSCI World **sin cobertura de divisa**, aunque sus clases de ETF están denominadas en USD y se pueden negociar en EUR en Xetra. **Negociar en EUR evita el cambio explícito del bróker si la operación es realmente en EUR, pero NO elimina riesgo de divisas de las empresas subyacentes**. La clase ETF de Invesco usa `IE00B60SX394`; no confundir símbolo en LSE USD `MXWO` con Xetra `SC0J`.

Fuentes primarias:
- BlackRock marzo 2026, hoja SWDA/EUNL: https://www.ishares.com/uk/professional/en/literature/fact-sheet/swda-ishares-core-msci-world-ucits-etf-fund-fact-sheet-en-gb.pdf
- Invesco factsheet (captura junio 2026 en página primera): https://www.invesco.com/content/dam/invesco/emea/en/product-documents/etf/share-class/factsheet/IE00B60SX394_factsheet_en.pdf
- Anuncio oficial de **reducción 0,19→0,05% efectiva 2026-04-01**: https://www.invesco.com/content/dam/invesco/uk/en/pdf/press/2026/invesco-reduces-fee-on-its-msci-world-ucits-etf.pdf
- Documento de datos fundamentales **español** 2026-04-01: https://www.invesco.com/content/dam/invesco/es/es/product-documents/etf/share-class/kid/IE00B60SX394_kid_es-es.pdf (0,05% gestión + 0,03% operación estimada; tratamiento exacto de `swap fee` vs KID exige contrastar documentos y no contar dos veces)
- Bolsa alemana oficial confirma `IE00B60SX394`, `SC0J`, Xetra **EUR**, `MSCI World Net TR`: https://live.deutsche-boerse.com/en/etf/invesco-msci-world-ucits-etf-acc?currency=EUR
- Invesco atribuye a retención inferior sobre ciertos dividendos una ventaja **media de 0,05 puntos porcentuales/año desde 2018 vs ETF físicos MSCI World, antes de fees**. Fuente: anuncio de marzo 2026, **afirmación del propio emisor, no experimento independiente ni prima que deba sumarse a rentabilidades NAV observadas**.

## 2. Evidencia realmente observada: año contra año, mismos NAV en USD

Comparación **manual reproducible** desde hojas **oficiales** BlackRock e Invesco, rentabilidad anual de NAV USD acumuladora (rendimientos después del gasto de cada fondo, **excluyen spreads/cánones/broker/impuesto personal**). Anualidades **2017–2025, conocidas y CONSUMIDAS**. No aplicar retroactivamente la nueva comisión de Invesco de 2026 a estas rentabilidades (antes cobraba 0,19% gestión).

| Año | EUNL USD % | Invesco USD % | Invesco menos EUNL (pp) |
| --- | ---: | ---: | ---: |
| 2017 | 22,45 | 22,41 | **−0,04** |
| 2018 | −8,65 | −8,63 | **+0,02** |
| 2019 | 27,76 | 27,92 | **+0,16** |
| 2020 | 15,95 | 16,10 | **+0,15** |
| 2021 | 21,90 | 21,93 | **+0,03** |
| 2022 | −18,03 | −18,02 | **+0,01** |
| 2023 | 23,86 | 23,96 | **+0,10** |
| 2024 | 18,70 | 18,76 | **+0,06** |
| 2025 | 21,16 | 21,17 | **+0,01** |

- **8 de 9 años** Invesco mayor que EUNL, **según rentabilidades redondeadas a 0,01 pp**. Varios márgenes son tan pequeños que comisiones de negociación o errores/redondeos pueden anularlos. Es *hit rate de ETF NAV comparados*, NO 8/9 años de una estrategia original con señales de mercado, NO `~80%` de éxito futuro validado.
- Diferencia aritmética anual media de retornos publicados **+0,05556 puntos porcentuales**. Multiplicar retornos por año `∏(1+r/100)` da EUNL **×2,94939335** e Invesco **×2,96180557** del capital a fin 2016, acumulación 2017–25; **ventaja relativa acumulada de Invesco +0,42084% de la riqueza final de EUNL** y ventaja geométrica relativa **~0,04667% por año**.
- Si se multiplican ambos NAV USD por **13.000 unidades de moneda constante** (o se ignora deliberadamente la variación EUR/USD), diferencia de patrimonios al fin 2025 **161,36 unidades**. **NO afirmar que sean 161,36 EUR realizables**: para inversión real de 13.000 EUR en Xetra habría que aplicar exactamente FX de inicio y fin, cotización ejecutable, bid-ask, cash residual y comisión. Para dos ETF USD no cubiertos convertidos por el mismo FX en las mismas fechas, el **signo** de las diferencias anuales se conserva; su importe **en EUR** cambia.
- Son rentabilidades sobre **muestra consumida**, elegida retrospectivamente después de haber leído miles de comparaciones de la app. La probabilidad de superar EUNL el próximo año no se deduce de 8/9. No abrir backtest 2017–25 para «confirmar» que gana.

El MSCI World mismo sin cambio sectorial/geográfico descarta que esta diferencia provenga de mejorar stock picking o trend timing. Es **eficiencia de implementación**, con primas pequeñas y riesgo de contrato.

## 3. Por qué la reducción de fees de 2026 NO puede fingirse histórica

Comunicado Invesco **30-03-2026**: gestión anual antigua **0,19%**, nueva **0,05% desde 01-04-2026**. Factsheet indica **0,03% de swap fee adicional**: suma publicada aproximada **0,08%**, frente a TER EUNL **0,20%**, es decir **0,12 pp/año de diferencia de costes nominal** si no varían los otros conceptos. Magnitud inicial sobre 13.000 EUR íntegramente invertidos: **15,60 EUR/año**, *no* 0,12% de rendimiento garantizado.

La mejora del coste de Invesco desde abril 2026 es **0,14 pp sobre su antigua comisión**, pero NO autoriza sumar 0,14 pp a los 9 retornos 2017–25 ni añadir otros 0,05 pp de dividendos a esos mismos retornos: **doble conteo y lookahead**. Seguimiento real incluye spreads de swap, préstamo de valores de EUNL, retenciones, corporate actions y mercado.

El riesgo no es intercambiable: Invesco depende de bancos contraparte de swaps y una cartera sustituida por garantía. La normativa UCITS limita exposición a contraparte de derivados en condiciones concretas (habitualmente límite máximo 10% NAV por entidad de crédito elegible); **no** equivale a garantía de pérdida máxima de 10%, porque existe riesgo de liquidez/valoración, contraparte y liquidación. Contraste independiente de riesgos y semántica: Vanguard https://www.vanguard.co.uk/professional/vanguard-365/investment-knowledge/etf-knowledge/etf-basics y folleto/KID Invesco.

## 4. ¿Se puede materializar con MyInvestor y 13.000 EUR?

**Identidad y cotización EUR Xetra: CONFIRMADAS** `SC0J / IE00B60SX394`. **Acceso de ese ISIN en MyInvestor: NO_VERIFIED**. La plataforma publica comisión bróker ETFs **0,12% por operación, mínimo 1 EUR, máximo 25 EUR**, y **0,30% por conversión de divisa solo si realmente ocurre**, más spread, cánones/tributos de mercado: https://myinvestor.es/inversion/broker/ . Invertir y mantener en **una línea EUR** no tiene por qué devengar el 0,30% FX cada año; exposición económica USD se conserva.

**Escenario desde efectivo**: comprar EUNL o SC0J en Xetra EUR costaría teóricamente lo mismo en comisión MyInvestor de ETF a 13.000 EUR (**15,60 EUR por compra**, sin spread), pero la disponibilidad exacta de SC0J, tamaño de lote, spread y comisiones reales de mercado no están certificados. El `0,12 pp` de gastos de producto afecta prácticamente toda la parte del patrimonio en MSCI World, a diferencia de E1/E2/E4 donde no llegábamos a mover capital.

**Escenario ya dueño de EUNL**: vender para pasar a SC0J provoca comisión de salida+entrada y puede realizar plusvalías tributable en España; no hay diferimiento ordinario de traspaso entre ETF. Referencia AEAT: https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c11-ganancias-perdidas-patrimoniales/determinacion-importe-ganancias-perdidas-patrimon-especificas/transmisiones-reembolsos-acciones-iic/regimen-especial-diferimiento-tributacion.html .

**Ejemplo explicativo, no impuestos de usuario** (régimen general español, sin otras ganancias/pérdidas, cierre fiscal final en ambos brazos):
- EUNL vale hoy **13.000 EUR**, base fiscal histórica **10.000 EUR**; vender y pagar IRPF 19% sobre 3.000 **adelanta ~570 EUR** antes de cambiar de ETF.
- Suponer, deliberadamente sin previsiones, **10 años de retornos mecánicos** 7%/año manteniendo EUNL y **7,12%/año** manteniendo el nuevo ETF (diferencia inventariada como *hipótesis favorable +0,12 pp/año*). Comparar dos carteras liquidando al final, con escala ahorro 19% primeros 6k +21% tramo restante, y nueva base de la operación:
  - EUNL sin vender hoy: final bruto **25.572,97 EUR**, neto tras venta final **22.422,64 EUR**.
  - Vender hoy tributando 570 EUR, invertir **12.430 EUR** 10 años al 7,12%, y vender final: final bruto **24.727,30 EUR**, neto tras venta final **22.264,87 EUR**.
  - **−157,77 EUR netos a favor de mantener EUNL**, incluso suponiendo 0,12 pp/año más de retorno futuro del sustituto, **antes** de pagar comisiones, spread y cánones por el cambio. Es un ejemplo financiero de coste de oportunidad fiscal, no una proyección de fondos ni consejo particular.
- **No recomendar ventas de EUNL ya existente por una ventaja de costes marginal**. El caso sin plusvalía latente y el de nuevos aportes es distinto.

## 5. Qué gate hemos aprobado y qué NO

| Criterio | Estado |
| --- | --- |
| Mismo índice MSCI World Net Return, clases Acc, USD NAV | PASS fuentes primarias |
| Xetra EUR SC0J y diferencia de réplica/coste | PASS documental |
| 2017–25 mejores NAV anuales (8/9) | PASS DESCRIPTIVO CONSUMIDO; pequeña y redondeada |
| Cambio de comisión 01-04-2026 e impactos independientes | PASS fuente primaria; efecto futuro NO_VALIDADO |
| Riesgo swap/collateral y fiscalidad venta ETF | DOCUMENTADO, no prueba de equivalencia de riesgos |
| Disponibilidad MyInvestor por ISIN, spread real y fiscalidad individual | NO_DATA |
| Ventaja **NETA** ex-ante para ya invertir 13k en EUNL | NO_DEMOSTRADA, escenario fiscal puede anular |
| Mejora 2% patrimonio por año, o validación fresh del 80% años con margen material | NO; magnitud insuficiente |

**Decisión:** `SAME_INDEX_REPLICATION_DOCUMENTARY_EDGE_SMALL_NOT_PROMOTABLE`. Es el hallazgo más concreto de **alta frecuencia histórica en mismo índice** sin modificar apuestas de mercado, pero el edge patrimonial es **minúsculo** y no resuelve el objetivo original; emisor con exposición swap distinta y tarifas actuales no estaban vigentes en muestra anterior. **Ningún cambio de producción, cartera real, algoritmo, universo o nueva validación.**

**Próximo acto económico justificado** solo si el usuario fuera a invertir **dinero nuevo** en un núcleo global: contrastar en el bróker la disponibilidad por **ISIN** y costes totales de Xetra EUR/horquilla, unificar fuente *tracking difference* neto en período posterior a 2026-04 y compararla con el fondo MSCI World traspasable más eficiente. No se necesita pedir al usuario ejecutar ningún test ni usar GitHub Actions; no existe urgencia para cambiar posiciones antiguas.
