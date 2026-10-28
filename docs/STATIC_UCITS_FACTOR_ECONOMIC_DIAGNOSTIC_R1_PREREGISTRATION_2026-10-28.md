# Custodia — preregistro de diagnóstico económico estático UCITS R1

**Fecha de congelación: 2026-10-28, después de PASSED anual de calidad, ANTES del primer replay económico de la cartera candidata.**
**Estado: FROZEN_DIAGNOSTIC_ONLY / NO PROMOTION AUTHORITY.**

## 1. Evidencia recibida y qué demuestra

El export original del Centro de validación `static-ucits-factor-issuer-annual-reconciliation-v1-2026-10-28T21-28-49-264Z.json` declara `status=PASSED`, `exitCode=0`, sin error. Resultado científico **`PASS_ANNUAL_CONSISTENCY_PENDING_DAILY_NAV`**, **no** equivalencia diaria de NAV ni ventaja de inversión.

Se contrastaron los **9 rendimientos anuales de 2017–2025 para cada uno de cuatro ETF** (36 comparaciones) contra referencias de BlackRock/DWS y referencia USD/EUR BCE. Diferencias anuales absolutas, en puntos porcentuales:

| Ticker | Media absoluta | Máxima absoluta | Gate anual |
| --- | ---: | ---: | --- |
| EUNL.DE | 0.4450468867 | 0.7446611020 | PASS |
| XDEM.DE | 0.4741853462 | 0.9357996559 | PASS |
| XDEQ.DE | 0.3874433086 | 0.7415577167 | PASS |
| XDEV.DE | 0.3815770677 | 0.9392730452 | PASS |

Límites congelados antes del resultado: máximo anual **3,0 pp**, media absoluta **1,5 pp** por instrumento. Todos cumplen. Se obtuvo por **`sourceResolution=EXPLICIT_NEW_SOURCE_RECAPTURE`**, snapshot de proveedor distinto del original 26-10, `sourceVintageHash=9c63b4584a6aef38444d752799c5c9c5b02f80d35be1a2d11334ca4f99748af9`, `matchesPriorPublishedSummary=true` (coincidencia del calendario y cobertura, **no** igualdad de raw bytes). `economicOutcomesCalculated=false`, `productionAuthority=false`.

**Límite de fuente:** el export que llegó al chat contiene sólo conteos/estadísticas y el hash de *conjunto*, no los 36 valores mercado individuales, fechas exactas usadas por año, ni los cuatro archivos brutos con hashes propios. El documento refleja fielmente el PASS reportado por backend; los datos de precios originales sólo se custodian donde efectivamente persistan en el entorno de la app.

## 2. Pregunta económica de R1

**¿Mejora una cartera pasiva, diversificada y comprable de factores UCITS el patrimonio neto que habría producido indexarse sencillamente a MSCI World a través de EUNL?**

El mecanismo hipotético es **diversificación entre Quality, Momentum y Value**, no seleccionar el ganador ni pronosticar tendencias; no implica anticrash. Se investiga una implementación **con ETFs reales**, NO se reabre `CORE_RELATIVE_LEADERSHIP`, momentum 12–2, profitability stock-picking, PEAD, Forward Risk ni TimesFM. El blend previo de índices 50/50 Quality+Momentum **ya se estudió**; R1 evalúa una construcción económica materialmente distinta, no presenta el factor como descubrimiento.

## 3. Dos brazos CONGELADOS antes de abrir resultados económicos

- **Control A:** invertir el capital disponible **100% en EUNL.DE / IE00B4L5Y983**, ETF UCITS accumulating Xetra EUR, sin aportaciones por calendario y sin ventas/rebalanceos salvo liquidación terminal comparable.
- **Candidato B:** invertir el mismo capital inicial **50% EUNL.DE + 1/6 XDEM.DE (Momentum) + 1/6 XDEQ.DE (Sector Neutral Quality) + 1/6 XDEV.DE (Enhanced Value)**. Las tres exposiciones factoriales reciben pesos simétricos porque no hay evidencia que justifique elegir el ganador pasado; EUNL conserva mitad del riesgo broad-index. No optimizar ni buscar pesos alternativos sobre 2017–2025.
- **Regla de mantenimiento:** buy-and-hold **sin rebalanceo periódico**; pesos evolucionan por mercado. NO se añade capital con frecuencia mensual/trimestral. **Única venta** al final si se exige medir patrimonio después de realización fiscal en ambos brazos. Cualquier `externalCashFlows` futuro debe ser explícito y idéntico en A/B; en este primer diagnóstico `externalCashFlows=[]`.
- **Capital primario:** **13.000 EUR** (igual al expediente real previo de Custodia de 2019–2022; no seleccionada por rentabilidad); sensibilidad de ejecutabilidad no promocionable a **2.500 EUR y 30.000 EUR**, sin cambiar nada más. No incluir 500 EUR en el brazo primario por la fricción de cuatro órdenes/títulos enteros; si no es operable, reportar `UNEXECUTABLE`, no inventar títulos fraccionarios.
- **Ventana:** primer día común operable posterior al 2016-11-03, con señal de construcción fijada **antes** del primer precio de ejecución y compras `NEXT_OPEN`; final de diagnóstico histórico en 2025-12-31 (última sesión verificada de 2025) para comparar años civiles completos 2017–2025. **Todo 2017–2025 queda CONSUMED/DIAGNOSTIC_ONLY** porque ya hemos visto NAV anuales y parte del blend de factores. El estudio será útil para costes y viabilidad, **no** para promoción. El verdadero OOS requiere observación prospectiva desde fecha posterior al congelamiento; jamás reutilizar el mismo historial como fresh/blind.
- **Mercado y moneda:** compras de los cuatro ETF únicamente en Xetra EUR; el control no finge un `FUND_VANGUARD_GLOBAL` con reglas fiscales diferentes. Comprobar precios `open` ajustados o semántica coherente de ejecución posterior a señal con operaciones corporativas; no comprar al cierre usado para decidir. Nunca extrapolar retrospectivamente el universo Yahoo Top64 actual.

## 4. Condiciones ejecutables, contabilidad y riesgos

1. Reutilizar `CORE_ARCHITECTURE_V1` y replay integrado; emplear el **mismo módulo** de ejecución/comisiones/fiscalidad para A y B, no desarrollar otro replay especializado.
2. **Gap identificado en el código actual:** `DynamicHistoricalReplayEngine.run({simulationMode:'HOLD_ONLY',initialPortfolio})` utiliza `seedInitialPortfolio` que crea unidades `amountEur/close` fraccionarias con `feeEur=0` **a fecha inicial** y las etiqueta como estado del usuario, no orden futura. Por tanto, NO usar ese modo directamente como si implementase A/B comprados desde cero. Integrar una opción research-only explícita de compras iniciales `NEXT_OPEN` **dentro de la contabilidad canónica**, sin alterar los defaults de producción, con test de paridad al omitir esa opción. Si ese gap no puede cerrarse causalmente, **STOP**, no exportar cifras falsas.
3. **Comisiones:** MyInvestor catálogo de perfil `0,12%/operación`, mínimo `1 EUR`, máximo `25 EUR`; **una unidad entera** y cash residual realmente no invertido con remuneración histórica configurada (BCE), spreads y gastos de terceros con datos/modelo declarados; no aplicar dos veces TER embebido en adjusted prices. Comisión en ventas finales A/B si se vende; mismas reglas.
4. **Impuestos:** cálculo español sobre ganancias realizables e intereses, aplicable a ambos, incluyendo liquidación final para patrimonio neto después de impuestos; no gravar apreciaciones latentes durante buy-and-hold como si fueran ventas. Flujos externos nunca son rentabilidad.
5. **Riesgo:** reportar capital final antes/después de costes e impuestos, diferencial neto en EUR y puntos de rentabilidad, drawdown máximo, volatilidad, desviación relativa respecto a EUNL, exposición efectiva USA/mega-caps/sector y caída conjunta; no asumir que 3 ETFs son protección frente a crash.
6. **Consistencia:** medir fracción de **años no solapados de 12 meses** en que B supera A neto y, por separado, ventanas móviles de 12 meses como diagnóstico correlacionado. El objetivo de ~80% de éxito solicitado por el usuario es una **aspiración de investigación**, no probabilidad garantizada ni gate retuneable retroactivamente.
7. **Datos:** utilizar sólo `REAL`, comprobar fechas alineadas, precios ajustados, eventos corporativos, guardas de calidad, fuente y vintage; si NAV diario o ajuste/FX no permiten una comparación razonable, etiquetar `INCONCLUSIVE` sin inventar precios. El `PASS` anual permite un diagnóstico, **no certificación definitiva de ejecución ni de compatibilidad de cada dato diario**.
8. **Acceso MyInvestor:** el mercado Xetra y el coste genérico están documentados; la negociabilidad de los **cuatro ISIN concretos** sigue `UNVERIFIED` y limita la aplicabilidad. **No promocionar** mientras no se compruebe.

## 5. Criterio de interpretación antes de calcular

R1 no optimiza parámetros. Si B no mejora en términos netos a A, resultado **FAIL_DIAGNOSTIC**; si mejora, estado **PROMISING_DIAGNOSTIC_ONLY**, no autorización productiva. Si los datos/costes/causalidad no son correctos, **INCONCLUSIVE/STOP**. No elegir después otro peso o ETF porque haya ganado menos. Ninguno de estos resultados por sí solo autoriza modificar `LEGACY`.

**Implementación siguiente:** inspeccionar contratos de la contabilidad actual y añadir el mínimo camino research-only para **apertura desde cash con órdenes enteras y costes en NEXT_OPEN**, y una comparación con mismas fechas/capital/flujos usando el `ResearchValidationCenter`. Guards y `tsc --noEmit` antes del cálculo, un solo job visible, sin GitHub Actions/replay largo fuera del backend. No perder la evidencia de cobertura/calidad ya certificada, no descargarla otra vez por capricho.

Pruebas de origen: `docs/STATIC_UCITS_FACTOR_IMPLEMENTABILITY_PREFLIGHT_2026-10-25.md`, `validation-runs/diagnostics/static-ucits-factor-implementability-preflight-2026-10-25.json`, y el export JSON real recibido del job del 28-10.

## 6. Implementación del replay R1 y paso de ejecución

**Implementado en `main` con parámetros opt-in research-only**, después del preregistro y antes de cualquier simulación económica real:

- `src/investment/decision/dynamicHistoricalReplayCore.ts`: `researchStaticBuyHold`, exclusivamente `simulationMode='HOLD_ONLY'`, desde efectivo `source=ZERO`, sin aportaciones/retiradas ni cartera inicial preexistente. Reutiliza `rebalanceCostAware`, el perfil broker vigente, `addLot`/`consumeLots`, fiscalidad española, valoraciones, flujos y remuneración histórica del cash del motor unificado. Prepara señal al inicio, **compra al NEXT_OPEN de la primera fecha común** de los ETFs; impone **número entero de participaciones, caja no negativa, comisiones del broker y sin selección por motor**. Las salidas finales se señalan una sesión antes y se ejecutan al **NEXT_OPEN de la última sesión común**, realizando impuestos y costes de venta en ambos brazos de forma simétrica.
- **Hipótesis de slippage congelada:** **0,10% de deslizamiento por lado** (10 puntos básicos de coste de ejecución al comprar y al vender), además de la comisión del broker en cada orden. Es una aproximación declarada, **no spread/horquilla real certificada**; evita simular ejecución gratis. No se optimizará tras observar los resultados.
- `scripts/staticUcitsFactorEconomicR1.ts`: contrasta exactamente **A = 100% EUNL**, **B = 50% EUNL + 1/6 de XDEM/XDEQ/XDEV**, capital 13.000 EUR principal y 2.500/30.000 EUR como sensibilidad descriptiva. Reutiliza el manifiesto/caché Yahoo REAL con SHA256 o captura un nuevo vintage **etiquetado explícitamente** si desapareció. **Antes de calcular retornos vuelve a verificar las mismas 36 referencias NAV oficiales en USD contra BCE**, sin cambiar límites. No utiliza Yahoo current/live para descubrir retrospectivamente instrumentos.
- Precio OHLC: adjusted OHLC Yahoo, sin interpolación de datos faltantes; ventana desde el 2016-11-04 al último día común de diciembre de 2025 (sin pre-2016 no comparable). Si falta una barra completa, se detiene con error, no inventa precios. La compra inicial es **NEXT_OPEN**, no inversión fraccionaria de la cartera inicial de un usuario.
- El output `validation-runs/diagnostics/static-ucits-factor-economic-diagnostic-r1-result.json` presenta capital final **neto tras liquidación terminal**, tasas/comisiones/impuestos, drawdown, diferencia vs EUNL y victorias en **9 años calendario**. El año terminal 2025 incluye la venta y tributo estimado; las anualidades no son pruebas OOS independientes. Una sensibilidad donde sea imposible comprar todos los ETFs con títulos enteros queda **UNEXECUTABLE**, no se reajustan los pesos ni se impide calcular el brazo principal.
- `tests/staticUcitsFactorEconomicR1.unit.ts` cubre regla de NEXT_OPEN, acciones enteras, comisiones, impuestos, causalidad con cambios futuros de precios, ausencia de aportaciones, bloqueo de política inválida y **paridad del modo HOLD_ONLY preexistente** cuando se omite el opt-in.
- `ResearchValidationCenter`: único job `static-ucits-factor-economic-diagnostic-r1` y botón existente **«Comparar patrimonio neto vs EUNL»**. Los dos jobs de calidad de datos Yahoo y NAV/BCE están **ARCHIVED**; Kronos está **PARKED**. Pasan los guards y `npm run lint`/TypeScript **antes de los cálculos**; nada se ejecuta por Actions.
- **Estado:** **INTEGRATED_AWAITING_LOCAL_VALIDATION**. Los scripts/guards se guardaron y sus contratos fueron inspeccionados vía GitHub, pero **todavía no se han ejecutado en el backend de Custodia** ni se han calculado retornos A/B. Un resultado positivo sería `PROMISING_DIAGNOSTIC_ONLY`, jamás promoción: historia consumida, NAV diario, broker ISINs y muestra prospectiva todavía pendientes.

**Alcance de investigación:** esta R1 mide la *viabilidad económica histórica* de una construcción elegida ex ante. No modifica `LEGACY`, ni el universo productivo, ni thresholds de ranking/Forward Risk, ni convierte una muestra ya consumida en evidencia fresca. No se abrirán versiones de optimización paramétrica sobre los resultados R1.
