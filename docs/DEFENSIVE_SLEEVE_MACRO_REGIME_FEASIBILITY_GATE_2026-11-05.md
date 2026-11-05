# Custodia — Siguiente puerta: selección del refugio por tipo de shock, SIN opciones y SIN V12

**Fecha: 2026-11-05. Estado: `DEFENSIVE_SLEEVE_SOURCES_PASS_MACRO_TIMING_NO_GO_PREVALIDATION`.**
Fuente de verdad revisada: `fmaranis/Trading/main` HEAD `ddb15659215734ffb8d2c30ab793ca6e30c5a574`, `PROJECT_STATE.md`, `src/investment/decision/assetUniverse.ts`. Se continúa tras `SAME_ISIN_BME_ADMITTED_THIRD_PARTY_QUOTE_NO_EXECUTABLE_ASK` del warrant M4497; **no seguir encadenando opciones y warrants sin feed ASK real**.

**No hay código, nueva pantalla, motor, política productiva ni backtest. `LEGACY` intacto.** Es una auditoría de mecanismos/precios de activos **ya integrados** en `EUR_ASSET_UNIVERSE`, NO una inversión recomendada ni un programa probado para batir a cualquier índice.

## 1. Descubrimiento específico: «defensive: true» NO garantiza protección equivalente

El catálogo canónico productivo **ya incluye** varios instrumentos y los marca como `defensive: true`. El campo no contiene por sí solo **duración, sensibilidad a inflación, convexidad, FX, condiciones de liquidez ni fallos de contrapartida**; no afirmar sin revisar sus consumidores que el booleano cause por sí mismo un error de ejecución. Es un riesgo **semántico a auditar** cuando se evalúe el comportamiento del motor durante shocks.

| `assetId` y símbolo código existente | ISIN | Papel financiero real | Fuentes del emisor, 2026 |
| --- | --- | --- | --- |
| `EUNA` `EUNA.DE` iShares Core Global Aggregate Bond UCITS **EUR Hedged** | `IE00BDBRDM35` | Cartera mundial de bonos con **duración efectiva ~5,99 años**, expuesta a subida de yields y crédito, cobertura divisa EUR. **TER 0,10%** (BlackRock 28/29-10-2026). No refugio garantizado si suben tipos. | https://www.ishares.com/uk/individual/en/products/291770/fund |
| `EUN6` `EUN6.DE` iShares € Govt Bond **0–1yr** UCITS ETF, clase **distribución** | `IE00B3FH7618` | Deuda soberana EUR con duración efectiva ~**0,52** años al 09-09-2026 (≈0,54 el 09-10), **TER 0,07%**, reparte cupones, **no confundir precio sin dividendos con rentabilidad total**. | https://www.ishares.com/uk/individual/en/products/251741/ishares-euro-government-bond-01yr-ucits-etf |
| `XEON` / `DBX0AN` `XEON.DE` / `DBX0AN.DE` Xtrackers II EUR Overnight Rate Swap UCITS ETF 1C | **MISMO ISIN** `LU0290358497` | ETF sintético **swap** y riesgo de contraparte; desde **30-11-2023** indexa **Solactive €STR + 8,5 pb diario**, **TER 0,10%**; **el índice anterior era distinto**. No equiparar automáticamente al cash histórico BCE de Custodia con suelo nominal del 0%; en época de tipos negativos el retorno XEON podía ser negativo. | https://etf.dws.com/en/LU0290358497-eur-overnight-rate-swap-ucits-etf-1c/ |
| `IBCI` `IBCI.DE` iShares € Inflation Linked Govt Bond | `IE00B0M62X26` | Bonos públicos indexados a inflación EUR, **duración efectiva ~7,06 años** en octubre 2026, **TER 0,09%**. Aun siendo «inflation-linked», **puede caer cuando suben los tipos reales**, en especial si el precio ya anticipaba inflación. | https://www.ishares.com/uk/individual/en/products/251739/ishares-inflation-linked-govt-bond-ucits-etf |
| `SGLD` `SGLD.DE` Invesco Physical Gold | `IE00B579F325` | **ETC, NO ETF/fondo UCITS**, deuda titulizada con garantía de lingotes; **TER 0,12%**; precio oro USD con riesgo EUR/USD no cubierto por mero hecho de cotizar en EUR, sin flujo de cupón; tampoco seguro anticrash automático. | https://www.invesco.com/es/es/productos-de-inversion/etfs/why-invest-in-gold.html |
| `VAGF`, `4GLD`, `AIGC`, `WCOA` | Ya en código | Otros bonos, oro o materias primas **NO** se promueven por la etiqueta `defensive` sin revisar horizonte, estructura/roll y coste real | `assetUniverse.ts`, documentación específica pendiente si se eligen |

**No duplicar XEON y DBX0AN como dos activos diferentes**: son dos identificadores del **mismo ISIN** y representarían la misma exposición de cartera. `IS3N`/`EIMI` fuera de este gate también comparten ISIN, conocido en el catálogo, pero no debe confundirse la etiqueta con un ISIN nuevo.

## 2. Evidencia externa de por qué cambiar «bolsa → bonos» puede fallar

- **BCE Financial Stability Review 2022** documenta que los shocks inflacionarios hacen subir simultáneamente correlación acciones/bonos, dificultando la diversificación. La correlación no es constante y en períodos de sorpresa de crecimiento desfavorable y baja inflación los bonos largos **pueden** amortiguar caídas bursátiles: https://www.ecb.europa.eu/press/financial-stability-publications/fsr/focus/2022/html/ecb.fsrbox202211_02~7abb48e333.en.html
- **Banco de Pagos Internacionales**, diciembre 2023, «The correlation of equity and bond returns», concluye que la correlación fue positiva desde 2021 en el episodio inflacionario, frente al patrón negativo previo. Importa distinguir sorpresa de inflación de sorpresa de crecimiento; **no equivale a una señal predictiva con precio neto ejecutable**: https://www.bis.org/publications/correlation-equity-and-bond-returns
- **LSEG/FTSE Russell, 2026** documenta que los bonos indexados a inflación sufrieron durante 2022–2023 porque las subidas de rentabilidad real/descuento superaron la compensación por IPC. **Un producto vinculado a inflación con duración ~7 NO es equivalencia de cash**: https://www.lseg.com/en/insights/ftse-russell/time-to-re-grow-some-inflation-hedges-overseas

**Hipótesis económica causal que merece PREGUNTARSE (no se considera congelada ni aprobada para código):** determinar si la **parte de cartera que ya cumple función defensiva** debe tener *duración diferente* según se trate de un shock de inflación/tipos o uno de crecimiento/deflación, sin tocar por sistema la renta variable. Es un cambio de **riesgo de refugio**, no reabrir V8 SELL/REBUY ni crear un ranking de nuevos productos. Sólo funciona económicamente si la identificación del tipo de shock está disponible **antes del movimiento de rendimientos**; si los bonos se han reajustado cuando se publica IPC, reaccionar a ese IPC ya conocido puede llegar tarde.

## 3. Impacto de primera orden sobre patrimonio total, SIN retornos históricos seleccionados

Identidad de duración para **pequeño movimiento paralelo de yields** de `+100 puntos básicos`, spreads y convexidad constantes: `ΔP/P≈−Duración_efectiva×0,01`.

- EUNA duración 5,99 → **~−5,99%** de componente precio por el shock (ignora carry, primas de crédito, convexidad y cambios de curvas multicurrency).
- EUN6 duración ~0,52 → **~−0,52%** de componente precio (ignora reinversión de dividendos y rol de soberanos a muy corto).
- Diferencia de sensibilidad **~5,47 puntos porcentuales**. Sobre la **sleeve de ejemplo 30%×13.000 EUR = 3.900 EUR**, si se hubiese optado por corta duración *antes* del shock, habría **~213,33 EUR (1,64% patrimonio)** de menor impacto de precio respecto de mantener EUNA, **sin costes de cambio**. El 30% es ejemplo algebraico, **NO peso congelado ni objetivo de riesgo nuevo**.
- Si los tipos **bajan** −100 pb y el resto permaneciese constante, sería **lo contrario**: la duración larga podría subir ~5,99%, la corta ~0,52% y elegir corta duración sacrificaría **~213,33 EUR** sobre la sleeve de 3.900 EUR.
- Broker ETF MyInvestor como referencia pública del estudio anterior `0,12%` por operación: vender `3.900` de EUNA y comprar `3.900` de EUN6 supone **~9,36 EUR** de comisiones básicas con mismo nocional, más horquilla, cánones y **posibles impuestos por plusvalía**; ida y vuelta por el mismo nominal **~18,72 EUR**, ~**0,144% del capital total**. Sin mirar la fecha de ejecución, **no es una expectativa de beneficio**. Ejemplo de dos viajes redondos por año ~37,44 EUR sólo comisión estimada, antes fiscalidad/spread; rotar por cada alerta fragmentada podría destruir el margen.
- La mejora neta futura **no es 213 EUR por sí sola**: depende de acertar el sentido *antes* del cambio de yields, tiempo fuera y qué pasa en el resto de la cartera, emisiones/cupones/FX, y la frecuencia de reversión. No calcular hit rate con muestras consumidas ni utilizar cifras hipotéticas como objetivos de promoción.

La versión económica de una política futura (solo si se llega a preregistrar) debe cumplir `R_portfolio – R_benchmark_mismos_flujos – comisión – spread – impuesto_realizado` y demostrar menor pérdida máxima **y** no sacrificar excesivamente retornos/recuperación. Si un criterio defensivo únicamente mejora drawdown, puede ofrecer valor al usuario, pero **no declararse alpha neta superior a cualquier benchmark**.

## 4. El obstáculo es el **dato temporal**, no encontrar más ETFs

- La información de IPC **no es conocida al cierre del mes**. Eurostat explica que el HICP llega **en primera estimación aproximadamente a final del mes de referencia**, y **dato final completo a mitad del mes siguiente**, con posibles **revisiones**. Para cualquier simulación histórica, guardar `periodDate`, `releaseTimestamp`, `valueAsFirstPublished`, `revisionTimestamp`, fuente, timezone y `informationDate`. Fuentes: https://ec.europa.eu/eurostat/web/hicp/information-data .
- Un **nivel de inflación superior al 2%** NO es una sorpresa de inflación, ni implica que el bono vaya a bajar *después* de publicarse. El mercado puede llevar semanas descontando el dato. No inventar consenso de analistas o sorpresa sin fuente **PIT**. El objetivo del BCE es el 2%, no un threshold de trading validado.
- El BCE publica series de tipos con fecha de **entrada en vigor**, que no siempre coincide con la fecha en que el BCE **anunció** el cambio; no permitir usar `effectiveDate` como señal adelantada retrospectiva. Fuente tipos https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html .
- **XEON tuvo cambio de benchmark en noviembre 2023**: tramo anterior a ese cambio NO representa exactamente la misma estrategia del índice de 2026; si se utiliza como datos REAL de precios del ETF, el precio es REAL pero la **definición del benchmark es variable**. Etiquetar hecho y no extrapolar retroactivamente `€STR +8,5pb` a toda la historia desde 2007.
- **EUN6 es distribución**: un Yahoo `Close` sin dividendos reinvertidos no es retorno total del activo; precisa `Adj Close` causal adecuado + efectivo cobrado y tributación, sin duplicar.
- **SGLD es ETC y no UCITS**: comprobar legalidad/cotización/ISIN/estructura riesgo emisor y fiscalidad antes de atribuirle el beneficio de traspasos de fondos. Oro cotizado en EUR sin hedge sigue dependiendo de divisa.
- Disponibilidad por broker de **cada** instrumento ya en catálogo **no** constituye acceso de cuenta confirmado. Sin pruebas de `NEXT_OPEN` con mercado realmente abierto y spread/liquidación/tax, ningún job de costes.

## 5. ¿Qué haría la app si esta hipótesis alguna vez pasara una puerta research?

**No añadir módulos de producto.** `AssetUniverseScanner → PortfolioCandidateGate → InvestmentDecisionEngine → PortfolioDecisionEngine` ya contienen activos; una eventual evaluación **research-only / shadow** estudiaría la **elección del destino del capital que ya está destinado a defensa**, sin generar aportaciones, duplicar catálogos, vender automáticamente el núcleo ni reinterpretar `reviewCadence` como dinero nuevo. El concepto preserva `LEGACY` y no convierte `defensive=true` en garantía mecánica.

**Falsificadores previos a abrir un estudio costoso:**
1. ¿El mecanismo depende de un valor macro que ya se había publicado, o usa `periodEnd`/revisiones con lookahead? Si falta historia PIT verificable: **STOP**.
2. ¿La ventaja surge sólo de haber identificado shocks 2022 después de ver outcomes? Si sí: **CONSUMED_DIAGNOSTIC_ONLY**, nunca promoción.
3. ¿La diferencia en el **conjunto del patrimonio** puede cubrir 1–2 viajes redondos, dividendos, impuestos y la pérdida de oportunidad de una caída de yields? Si NO_DATA, no crear motor ni backtest.
4. ¿Qué tipo de shock económico se intenta identificar? De inflación vs crecimiento **no** se deduce del signo de dos fondos que acaban de caer (eso sería lookahead/price chase); la señal macro requiere vintage temporal y fuente independiente.
5. Si hay indicador V8 útil en riesgo: **V8 no se retunea**, ni se supone que anticipe subida de bonos u oro. Sus FAIL económicos previos siguen FAIL.

**Veredicto `DEFENSIVE_SLEEVE_SOURCES_PASS_MACRO_TIMING_NO_GO_PREVALIDATION`**: instrumentos reales, mecanismo de duración documentado, impacto económico sobre una fracción material plausible. La señal **que identifique el siguiente shock**, y no simplemente el actual, **NO EXISTE VERIFICADA** en las fuentes accesibles; por tanto **NO es una política de rotación lista para el usuario**. Nuevo trabajo sólo justificado con un instrumento macro PIT/first-release defendible, una política concebida sin tuning, y posibilidad de contraste fresh; mientras tanto, **no crear otro job ni modificar producción**.
