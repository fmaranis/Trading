# Custodia — inventario antirrepetición y siguiente investigación económica

Fecha: **2026-10-25** · Fuente canónica: `fmaranis/Trading/main` y `PROJECT_STATE.md`.

**Decisión:** antes de programar más modelos o indicadores, contrastar la viabilidad **implementable** de una cartera indexada multifactorial, contra mantener el núcleo global indexado, utilizando instrumentos UCITS reales. No es nueva prueba de momentum, no es señal de compra de acciones, no es una nueva versión de LEGACY, no es una propuesta para operar hoy. **El alpha neto todavía NO está demostrado.**

Este documento sintetiza hechos **ya investigados en el proyecto**, señala lo que NO se debe reabrir, y formula el único siguiente gate lógico de bajo coste. No sustituye sellos ni permite reutilizar como fresh muestras ya inspeccionadas.

> **Preflight 2026-10-25 ejecutado:** identidad, metodología, mercado y tarifas públicas comprobadas; estados `PARTIAL_PREFLIGHT_BLOCKED_BEFORE_ECONOMIC_DATA`, con 4 ISINs por verificar en el bróker y datos REAL Xetra/NAV aún no auditados. Documento operativo `docs/STATIC_UCITS_FACTOR_IMPLEMENTABILITY_PREFLIGHT_2026-10-25.md`; manifest `validation-runs/diagnostics/static-ucits-factor-implementability-preflight-2026-10-25.json`. No backtest ejecutado, no promoción.

## 1. Evidencia histórica comprobada — no repetir

| Estudio / pregunta efectivamente probado | Evidencia y veredicto | Restricción metodológica |
| --- | --- | --- |
| `QUALITY_V1` / `SLOPE_V1` y bridge de asignación | QUALITY aportó cambios de ranking, reach de órdenes muy pequeño; SLOPE y QUALITY no promovidos; bridge alcanzó el allocator pero en la muestra cerrada casi nunca había capital nuevo disponible. | No retuning sobre ventanas consumidas; `LEGACY` productivo. |
| `OPPORTUNITY_ALPHA`: EXIT/REDUCE -> oportunidad vs core | 15 episodios; 9/15 > core a ~6m; +38,5 EUR sobre ~7515 EUR desviados, ~0,51% **antes** de costes/impuestos. Cerrado sin implementar. | No «core-vs-satélite V2» cosmético. |
| `CORE_RELATIVE_LEADERSHIP_RESEARCH_V1` | Pendientes 20/60, aceleración, ENTRY_STRONG sobre 15 casos: resultados insuficientes/inconsistentes. | ARCHIVED. |
| `CORE_OUTPERFORMANCE_MOMENTUM_REFERENCE_V1` | Momentum long-only académico 12–2, 2016–2021: CAGR 16,68% vs parent USA 17,52%, URTH 14,22%. FAIL gate conjunto. | No cambiar decil/lookback/ventana retrospectivamente; confirmación reservada unopened. |
| `SECTOR_52W_HIGH_LEADERSHIP_V1` | 2013–2018 Yahoo REAL, 20bp/lado: CAGR 10,12%, SPY 11,31%, basket 9 ETF 10,26%; drawdown peor vs URTH; FAIL. | La réplica posterior quedó unopened, no crear V2 tuneada. |
| `OPERATING_PROFITABILITY_DECILE_10_VW` académico | PASS de señal en 2016–2021 y confirmación 2009–2014, pero señal *factor académica* no equivale a cartera ejecutable. | Preservar valor de información, sin falsa promoción. |
| `CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2` | **2026-10-07**, Stage C1 causal y 5 periodos ya ejecutados: candidato 12,6832% CAGR bruto vs SPY 17,5698%, URTH 14,9861%, beats 0/5 SPY y 1/5 URTH; FAIL_ACTIONABLE_TRANSLATION, STOP_TRANSLATION_NO_RETUNING. | No volver a describir como bloqueado por SEC: fue un estado **anterior**. |
| Quality × valoración | Diagnóstico pequeño prometedor; réplica amplia reportó FAIL alpha y PIT estricta no acreditable, R2 parcialmente abierta/consumida. | No rescatar barato/caro con cortes a medida ni llamar «fresh» a R2. |
| Calidad UCITS individual | QDVB (USA Quality) 2017–2025 CAGR 13,8361% vs parent USA 14,7638%; `POST_SELECTION_PACKAGED_PARENT_EDGE_NOT_PRESENT`. | No sustituir QDVB por el ETF que retrospectivamente ganase. |
| Profitability direct-stock / SimFin / ex-US | 46 acciones impracticables para sleeve normal por whole shares/fricciones; SimFin bridge inconcluso, diagnóstico posthoc bajo SPY/URTH; ex-US FAIL de generalización. | No cambiar pesos/caps tras la muestra; lección central: rentabilidad del factor y ejecutabilidad son cosas distintas. |
| `PEAD_ANALYST_SURPRISE_V1` | 2026-10-07: Spearman ≈0,0056 (p≈0,365), Q5 exceso medio -0,3395%, hit-rate 46,15%; FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY. | No retunear horizonte/sorpresa con 2024Q1. |
| TimesFM relative rank/bridge/sticky | Rank económico 15/15 escenarios sin cambio de operaciones; OOS Sticky peor que core y LEGACY; la señal predictiva y la traducción monetaria se evalúan separadamente. | No reabrir variantes con nuevos buffers en misma muestra. |
| Forward Risk V8–V11 y protección | V8 conserva señal predictiva de downside en pruebas propias; políticas V8–V11 monetizaron mal y variantes retiradas; Fase 5 winner-protection no pasó confirmación. | No interruptor diario ni V12 parametrizado posthoc. |

Fuentes primarias internas: `PROJECT_STATE.md` apartados históricos 2026-09-24→2026-10-07; `docs/OPPORTUNITY_ALPHA_RESEARCH_2026-09-24.md`; `docs/CORE_OUTPERFORMANCE_RESEARCH_PLAN_2026-09-27.md`; `docs/CORE_OUTPERFORMANCE_PROFITABILITY_V1_EXECUTION_2026-09-27.md`; `docs/CORE_OUTPERFORMANCE_HIT_RATE_AUDIT_2026-09-28.md`; `validation-runs/diagnostics/*` citados allí. Los porcentajes se transcriben **de esos informes**, no son replays nuevos.

## 2. ¿Qué rescatamos de la investigación anterior?

La evidencia sugiere dos cosas distintas:

1. El **ranking activo** y los métodos de elegir/rotar una única acción han fallado a menudo por inestabilidad del alfa y/o falta de alcance de órdenes. No hay base para promocionarlos.
2. La **diversificación de exposiciones factoriales** tiene interés, no por predecir al ganador del mes, sino por combinar fuentes económicas de prima de riesgo sin seleccionar stock a stock. En el propio proyecto hubo una comprobación ilustrativa de índice `MSCI World Quality + Momentum` **50/50**, rebalanceo anual 2014–2025, CAGR aproximado 13,03% vs MSCI World 10,97%. Es historia inspeccionada/consumida y **NO** equivalía a comprar vehículos reales; por tanto no se declara investigación inédita ni holdout.

La literatura independiente respalda estudiar una combinación diversificada, pero no garantiza primas futuras ni que la gestión dinámica mejore a un peso estable:

- S&P Dow Jones Indices, *Harnessing Multi-Factor Strategies Close to the Core*: https://www.spglobal.com/spdji/en/research/article/harnessing-multi-factor-strategies-close-to-the-core/
- Reschenhofer, *Combining factors* (Economics Letters 2024): https://doi.org/10.1016/j.econlet.2023.111510
- Ilmanen, Israel, Lee, Moskowitz & Thapar, *How Do Factor Premia Vary Over Time? A Century of Evidence*: https://www.aqr.com/Insights/Research/Journal-Article/How-Do-Factor-Premia-Vary-Over-Time-A-Century-of-Evidence
- Schwarz, *On the performance of volatility-managed equity factors – International and further evidence* (2025): https://doi.org/10.1016/j.jempfin.2024.101560

Especialmente importante: la investigación de AQR documenta dificultades para obtener beneficios de **market-timing de factores** una vez considerados retardos de datos y costes. Por ello **empezar estático**, no por factor timing adaptativo/ML ni por más regresiones.

## 3. Comprobación de vehículos realmente existentes

**Hecho verificado en el código del 2026-10-25:** `src/investment/decision/assetUniverse.ts` ya incluye las referencias research `HOLDOUT_XDEM`, `HOLDOUT_XDEV` y `HOLDOUT_XDEQ` en `EUR_VALIDATION_HOLDOUT_UNIVERSE`, así como `EUNL` en el universo principal. No son prueba de que el rendimiento esté disponible o sea fresh.

- **EUNL**, iShares Core MSCI World UCITS ETF Acc, ISIN IE00B4L5Y983; benchmark MSCI World, TER referencial 0,20%, EUR listing Xetra. Fuente proveedor: https://www.justetf.com/en-es/etf-profile.html?isin=IE00B4L5Y983
- **XDEM**, Xtrackers MSCI World Momentum UCITS ETF 1C, ISIN IE00BL25JP72, aproximadamente TER 0,25%, acumulación, Xetra EUR: https://www.justetf.com/en-es/etf-profile.html?isin=IE00BL25JP72
- **XDEQ**, Xtrackers MSCI World Quality UCITS ETF 1C, ISIN IE00BL25JL35, aproximadamente TER 0,25%, acumulación, Xetra EUR: https://www.justetf.com/en-es/etf-profile.html?isin=IE00BL25JL35
- **XDEV**, Xtrackers MSCI World Value UCITS ETF 1C, ISIN IE00BL25JM42, aproximadamente TER 0,25%, acumulación, Xetra EUR: https://etf.dws.com/en/IE00BL25JM42-msci-world-value-ucits-etf-1c/

**Incompatibilidades que invalidarían una réplica ingenua:** `XDEQ` sigue **MSCI World Sector Neutral Quality**, NO el MSCI World Quality ordinario usado en la comprobación ilustrativa del índice. **Los tres Xtrackers XDEM/XDEQ/XDEV cambiaron de índice el 03-11-2016**, desde sus respectivos DB Equity Momentum / Quality / Value Factor a MSCI World Momentum / Sector Neutral Quality / Enhanced Value. Por tanto **todo el historial anterior al cambio carece de comparabilidad con la política de índices vigentes**, no sólo el de XDEV. Fuente directa: las tres páginas DWS; ver preflight documentado en `docs/STATIC_UCITS_FACTOR_IMPLEMENTABILITY_PREFLIGHT_2026-10-25.md`. La cotización `EUR` no elimina exposición FX de acciones globales USD. El TER suele estar incorporado en el NAV/retorno adjusted del ETF; **no descontarlo por duplicado**. Obtener fechas exactas de inicio, split/corporate actions, NAV de proveedor y disponibilidad/tickets reales del broker antes del cálculo.

Fuentes para metodologías: XDEQ https://www.justetf.com/en-es/etf-profile.html?isin=IE00BL25JL35 ; XDEV factsheet del emisor https://etf.dws.com/en/IE00BL25JM42-msci-world-value-ucits-etf-1c/.

## 4. Único siguiente paso propuesto: STATIC_UCITS_FACTOR_IMPLEMENTABILITY_PRECHECK

**Pregunta ECONÓMICA distinta de los experimentos cerrados:** *¿Puede una cartera diversificada de ETFs UCITS factoriales, comprable y mantenida sin predicción/rotaciones frecuentes, mejorar el patrimonio neto y la consistencia relativa al core global para capitales normales en EUR?*

**No es** volver a probar 12–2 sobre acciones, relajar candidate gates, elegir a posteriori fondos ganadores, convertir Quality factor en profitability direct-stock ni hacer un `H-CORE-OPPORTUNITY` nuevo.

**Primero sólo PRE-FLIGHT, sin abrir outcomes:**

1. Verificar identidad ISIN, index tracking exacto, históricos **desde lanzamiento real** (no backfills de índice), día común de cotización, ajuste de dividendos, calidad de FX y posible cambio de benchmark XDEV, reembolso y coste real de broker/títulos enteros. `UNAVAILABLE` si falla algún imprescindible; evitar fallbacks sintéticos.
2. Consultar registro de muestras y resultados previos con estos ISINs: el nombre `HOLDOUT_` en el catálogo no supone holdout sin consumir. Declarar historia 2014–2025 **consumida al menos conceptualmente** por el análisis de índices; un replay de ETF en ese periodo sería sólo estudio de ejecutabilidad y robustez, **nunca promoción**.
3. Un diseño inicial **simple y predeclarado por teoría, no calibrado por retorno**: referencia 100% EUNL vs cartera estática diversificada de MSCI World Value/Quality/Momentum *en vehículos reales*. Definir **antes de precio histórico** si es 100% de esos factores o una pequeña sleeve con el core y cómo se financia; no convertirlo en una cuadrícula de pesos. Primera decisión debe respetar caja, tolerancia al riesgo, tamaño de ticket y comparación con indexación simple de igual flujo/coste fiscal. Para mínimo de fricción, empezar con **buy-and-hold sin rebalanceos ni ventas periódicas**; una variante reequilibrada exige pregunta nueva y fiscalidad real, no asumirse equivalente al cálculo de índices 50/50 anual.
4. Medir las mismas `externalCashFlows`, ejecución después de señal, títulos enteros, fees/spread, impuestos españoles efectivamente aplicables, drawdown, volatilidad, riesgo y solapamiento look-through con mega-caps; además **frecuencia de ventaja sobre ventanas de 12 meses** (el 80% deseado es objetivo a comprobar, nunca una probabilidad que podamos prometer).
5. Rechazo temprano: si no hay exposición ortogonal real, datos fiables, tamaño operable, o la diferencia bruta frente a EUNL es demasiado estrecha para los costes, **STOP sin desarrollar nada en Custodia**.
6. Si el preflight pasa, formular UNA única construcción con reglas/conjunto/instrumentos congelados, diagnosticar muestras conocidas usando la cadena de replay existente y reservar confirmación cronológica fresh/prospectiva. Un pass descriptivo no modifica `LEGACY`.

**Coste objetivo 0 €, backend/replay existente, sin GUI nueva, sin GitHub Actions.** No ejecutado aún: fuentes de precio REAL, simulación económica, tests, ni validación de disponibilidad exacta MyInvestor. No presentar rentabilidad realizable todavía.

## 5. Regla de continuidad

Ante cualquier nueva idea: contrastar primero esta matriz y `PROJECT_STATE.md`. Si ya está en familia/política/muestra cerrada, `DUPLICATE_STOP`. Si es una traducción real de una señal previa, etiquetar **IMPLEMENTATION_TRANSLATION** y preservar el resultado original; no presentarla como nuevo descubrimiento predictor.

Objetivo final constante: que Custodia produzca decisiones de inversión con patrimonio neto superior a indexación simple, si y sólo si la evidencia causal, ejecutable y fuera de muestra lo justifica. Si no, recomendar la alternativa indexada sin operaciones extra. La app web y `CORE_ARCHITECTURE_V1` se conservan. Ningún permiso de promoción productiva nuevo.

## Actualización de decisión 2026-10-28: ruta nueva PAPER-FIRST reemplaza prioridad UCITS

**La antigua prioridad está cerrada, NO pendiente**. El estudio real UCITS factorial R1 fue ejecutado por el backend: `PASSED` de ejecución, pero `FAIL_DIAGNOSTIC` económico, 13.000 EUR iniciales, B frente a EUNL −464,1056 EUR netos, 4/9 años ganadores; `LEGACY` intacto. Véase `docs/STATIC_UCITS_FACTOR_ECONOMIC_R1_RESULT_REVIEW_2026-10-28.md`.

**Ruta activa:** `docs/NEW_ECONOMIC_EDGE_RESEARCH_ROUTE_2026-10-28.md`, estado `E1_PAPER_SOURCE_FEASIBILITY_OPEN`. Primero estudiar **recompras de acciones efectivamente realizadas** y reducción neta de capital a partir de `Item 703` SEC publicado, con datos PIT y **coste real MyInvestor de acciones y FX**. No programar nada aún ni ejecutar backtests. Alternativas secuenciales sólo si E1 falla en papel: E2 spin-offs/ventas forzadas; E3 insiders Form4, context-only de entrada por resultado académico adverso a copying realizable. No son tres variantes o tres jobs.

**Regla antirrepetición:** el resultado anterior se conserva aunque desfavorable; un estudio publicado de asociación entre recompras y rentabilidades NO justifica por sí mismo implementación. No abrir outcomes antes de congelar pregunta y comprobar fecha disponible, viabilidad, canal causal y caja de órdenes. Si falla una condición, `PAPER_REJECTED` sin código.


## E1 documental cerrado, 2026-10-28 — no repetir compras-recompra

El informe `docs/E1_EXECUTED_BUYBACK_PAPER_GATE_RESULT_2026-10-28.md` cierra `E1_NO_GO_STANDALONE_TRADING_ON_CURRENT_EVIDENCE` sin abrir precios futuros: SEC Item703 ofrece disclosure mensual tardío, no diario; Palantir FY2025 reportó 600.446 títulos recomprados pero total shares outstanding A+B+F **creció +2,24%**; literatura Gunn (2017) pequeña/mediana reacción alrededor del 10-Q/10-K no acredita NEXT_OPEN; Li et al. (2018) encuentra prima de emisión neta impulsada en su muestra por emisiones y no recompras; tarifa MyInvestor redonda acciones EE. UU. ~0,84–1,06% ida/vuelta de tickets 2600/1300 EUR **antes spread/tax** si hay conversión EUR/USD compra y venta. Ninguna ventaja after-publication after-cost frente a EUNL demostrada. **No crear detector de buybacks ni retunear E1**.

La próxima comprobación es `E2_PAPER_LIQUIDITY_AND_EVENT_FREQUENCY_GATE_NEXT` sobre escisiones **dos etapas** y presión vendedora. Fuente Amihud/Huh/Subrahmanyam 2025: 68 casos 1986–2017 y 8,31–9,65% CAR 0→+60 específico (no global/after-fees), pocos eventos anuales; evaluar **alcance económico sobre caja** antes de cualquier desarrollo.


## E2 cerrado, E4 papel activo — 2026-10-29

`E2_NO_GO_STANDALONE_ON_CURRENT_EVIDENCE`. Estudio académico 68 eventos **dos etapas** 1986–2017, distinto de canje voluntario KVUE/JNJ o escisión ordinaria Qnity/DD. Exceso CAR 0→+60 no es ganancia neta ejecutable NEXT_OPEN ni fuente de múltiples operaciones anuales; falta master point-in-time completo. Evidencia negativa reciente de seguimiento particular y positiva de ETF ponderado describen **preguntas diferentes**. Documento `docs/E2_TWO_STEP_SPINOFF_PAPER_GATE_RESULT_2026-10-29.md`. No lanzar `spinoff V2` ni rotación retrospectiva de escindidas.

`E4_PAPER_CONTRACTUAL_SPREAD_SOURCE_GATE_OPEN` en `docs/NEW_ECONOMIC_EDGE_RESEARCH_ROUTE_2026-10-28.md` §8: **adquisiciones por precio fijo en efectivo**, no escisiones ni nuevas pendientes técnicas. Casos de documentación: MISTRAS 20,35 USD cash/acción, onsemi/Synaptics precio revisado 123 USD cash, SoundThinking 8 USD + CVR contingent (excluida de fixed cash). El spread observable tras anuncio **no** es expectativa de beneficio sin estimar probabilidad y severidad de ruptura, duración, costes, cash FX e impuestos. Investigar sólo esquema y posibilidad de evidencia futura, sin replays ni código nuevo; `LEGACY` intacto.


## 2026-11-04 — E4 cierre documental y frontera transversal de capital

- **E4 adquisiciones a precio fijo cash** `NO_GO` para estrategia independiente de una cartera 13.000 EUR con evidencia actual. Informe `docs/E4_ALL_CASH_MERGER_SPREAD_PAPER_GATE_RESULT_2026-11-04.md`; dos precios de cierre **posteriores al anuncio**, 2026-11-03: MISTRAS 20,18 USD vs 20,35 cash (**+0,8424% condicional**), Synaptics 117,41 vs 123 cash (**+4,7611% condicional**). SoundThinking 8 USD+CVR condicional excluido; Capri/Tapestry 2024 prueba real de riesgo de cancelación. En ticket 1300 EUR nominal MyInvestor, escenario ida/vuelta con dos FX implica ~**1,0615%** comisiones+FX sin spread/tax; MISTRAS no cubre esa fricción aun si cierra, SYNA presenta posible margen bruto pero `NO_DATA` probabilidad de cierre/precio de ruptura y esperado en varios meses. **No tratar precios contractuales como rendimientos garantizados ni usar el spread para retunear `p`/salidas**. No jobs/código.
- Se añade `docs/CAPITAL_REACH_ECONOMIC_FRONTIER_2026-11-04.md`. Regla reutilizable: cualquier señal debe explicar **cuántos euros realmente toca y cuánto retorno incremental neto por euro en riesgo necesita** para superar EUNL y compensar impuestos/rotación. Ejemplo puramente ilustrativo +2% a 13k = 260 EUR: con 1 ticket anual del 10% del patrimonio requiere **20% de exceso neto sobre el activo sustituido**, no simplemente alto CAR de un paper sobre un activo aislado. E2 ~2,125 eventos/año y w=10% exigiría ~9,41% de exceso neto por evento para +2% portfolio; no demostrado. El usuario quiere consistencia ~80% de años, no tasa de operaciones exitosas.
- **Ruta posterior:** `CAPITAL_REACH_ECONOMIC_FRONTIER_PAPER_GATE`. No anunciar otra E5 de acciones/eventos sin verificar tamaño de efecto sobre *el conjunto del patrimonio*. El cuello de botella `3/228` de capital invertible explica por qué mejorar señales/reach sin capital puede ser inútil. Priorizar hipótesis económicas de escala o reducción fiscal/operativa con efecto material demostrable, separando cualquier ahorro de costes de verdadero alpha. `LEGACY` intacto.


## 2026-11-04 — capital completo: ahorro operativo no es alfa

Cierre documental del gate transversal `CAPITAL_REACH_ECONOMIC_FRONTIER_PAPER_GATE`: `docs/WHOLE_CAPITAL_AFTER_TAX_FRICTION_PAPER_GATE_2026-11-04.md`. Comparación fuentes oficiales iShares/Fidelity/MyInvestor: EUNL MSCI World ETF 0,20% TER vs Fidelity MSCI World fondo UCITS 0,10% anunciado (PRIIPs Fidelity 2026 0,10% gastos de gestión/administración y costes de transacción adicionales estimados ~0,02%; ficha 2025 OCF 0,12%). Sobre 13k, máximo ahorro nominal comparativo **~10–13 EUR/año**, antes de tracking difference y otros costes. **Insuficiente** para explicación de ventaja de 2% cartera (~260 EUR) usada sólo como referencia de escala. El 2026 régimen español de traspasos fondos elegibles difiere impuestos cuando realmente se reasigna cartera, **no** implica diferencia fiscal frente a EUNL buy-and-hold; ejemplo 20k mercado/13k base y 10y de crecimiento 7% hipotético da ~911 EUR netos de ventaja si la alternativa ETF **se vendiera hoy**, no si se mantuviera. Cash 10% puede costar o proteger según signo de bolsa, no reinterpretar V10 FAIL.

**Estado `FULL_CAPITAL_OPERATING_EFFICIENCY_VERIFIED_SCALE_TOO_SMALL_FOR_ALPHA_TARGET`**; no añadir nuevo job ni política. El objetivo 80% años vs benchmark permanece **NO DEMOSTRADO**; no cambiar `LEGACY`. Considerar futuras ideas sólo si explican alcance material y exceso neto, con fuentes independientes y sin tuning histórico consumido.


## 2026-11-04 — eficiencia de réplica del MISMO MSCI World, 8/9 años pero edge minúsculo

**Informe:** `docs/MSCI_WORLD_SAME_INDEX_SWAP_REPLICATION_PAPER_GATE_2026-11-04.md`. Se contrastaron **fuentes originales** iShares EUNL `IE00B4L5Y983` réplica física vs Invesco `IE00B60SX394` réplica sintética Xetra EUR `SC0J`, ambos MSCI World Net USD Acc. NAV anual USD 2017–2025: **Invesco superó a EUNL 8/9 años** por retornos redondeados a centésimas, pero con ventaja total solo **+0,4208% de la riqueza acumulada al final de nueve años**, diferencia anual geométrica **+0,0467% relativo**; no considerar 8/9 probabilidad futura de éxito, ni confundir magnitud con aspiración de ~80% de años con mejora material. Histórico consumido.

Invesco recortó comisión gestión **0,19→0,05% desde 2026-04-01** y declara swap fee adicional **0,03%**, vs EUNL TER **0,20%**. Diferencia nominal `0,12 pp` anual ≈ **15,60 EUR/año al inicio por 13k**, pero retorno no garantizado ni pasado reutilizable para promoción. Emisor atribuye a retención dividendos del swap ~0,05 pp/año de ventaja estructural desde 2018 (estimación propia), NO añadir a NAV que ya contiene efecto, no ignorar swap counterparty/collateral. No hay confirmación de comercialización SC0J por ISIN en MyInvestor, spreads ni impuestos y no recomendar compras.

**Una rotación EUNL→Invesco puede perder incluso suponiendo menor fee**: ejemplo ETF valor 13k/basis10k, venta hoy grava ganancia 3k ~570 EUR al 19% español; con hipótesis 10 años 7% vs 7,12% y liquidación final ambas, EUNL mantener ≈ **22.422,64 EUR netos** vs cambiar ≈ **22.264,87 EUR** antes de comisiones, 157,77 EUR peor el cambio. No consejo personal. El fondo UCITS de acumulación **no ETF** con traspaso fiscal permitido sigue siendo alternativa operativa según plan financiero, y el acceso/disponibilidad del broker es aún no verificado.

**Decisión `SAME_INDEX_REPLICATION_DOCUMENTARY_EDGE_SMALL_NOT_PROMOTABLE`.** Aprendizaje antibucles: una **tasa de años favorables alta sin magnitud** no justifica otro motor/job ni producción. El objetivo patrimonial original está sin demostrar; conservar defaults `LEGACY`. La única aplicación potencial es una decisión de vehículo **para dinero nuevo** al que ya se ha decidido asignar MSCI World, mediante comparación coste/tracking/FX/ejecutabilidad; no un algoritmo que elija momentos de inversión.

## 2026-11-04 — hipótesis futura de rotación entre regímenes, sin EUNL como master

**Idea explícita del usuario, aún NO política autorizada:** Custodia podría identificar debilitamiento de un índice o clase de activo y desplazar exposición *antes de que pierda valor* hacia otro índice/clase con un comportamiento potencialmente mejor durante ese mismo régimen, intentando simultáneamente reducir drawdown y mejorar riqueza neta. **EUNL no es master ni activo obligatorio.** Cualquier benchmark (MSCI World, S&P 500, ACWI, 60/40, cash, u otro razonable) se elige **ex ante**, con alternativa inversora real y riesgo comparable; no perseguir el máximo benchmark conocido después ni exigir superar literalmente todos los índices en cada ventana, algo imposible de garantizar. Evaluar robustez frente a VARIOS benchmarks fijados antes, no escoger uno a favor a posteriori.

**Evidencia externa consultada:**
- ECB, Financial Stability Review (2022), `Cross-asset correlations in a more inflationary environment and challenges for diversification strategies`: https://www.ecb.europa.eu/press/financial-stability-publications/fsr/focus/2022/html/ecb.fsrbox202211_02~7abb48e333.en.html . Correlaciones acciones/bonos no estables; shocks de inflación permiten que caigan juntos.
- Fed, **16-10-2026**, `Government Bonds’ Safe-Haven Property and Inflationary Pressures`: https://www.federalreserve.gov/econres/notes/feds-notes/government-bonds-safe-haven-property-and-inflationary-pressures-20261016.html . Las propiedades defensivas de la deuda soberana dependen de los regímenes de inflación; no se presume anticorrelación permanente.
- Moskowitz/Ooi/Pedersen, `Time Series Momentum`, Journal of Financial Economics (2012): https://doi.org/10.1016/j.jfineco.2011.11.003 . Evidencia de momentum temporal en futuros de índices, bonos, divisas y materias primas con posiciones long/short, NO demuestra capacidad de ETF long-only EUR minorista post costes, **ni valida reutilizar nuestra vieja política momentum 12–2**.
- BIS (2023) stock-bond correlation: https://www.bis.org/publications/correlation-equity-and-bond-returns . Beneficios de la diversificación nominal pueden desaparecer cuando inflación eleva correlación.

**Implicaciones científicas que deben fijarse ANTES de implementar:** no confundir anticorrelación retrospectiva con cobertura operable a fecha t; cash (no subir pero poder preservar nominal) es alternativa válida a veces; shocks simultáneos o transición tardía pueden perjudicar tanto retorno como protección. Activos/regímenes a auditar sobre datos PIT: índices de acciones por geografía, bonos soberanos *duración diferente*, oro, efectivo remunerado BCE y, solo con acceso real a ETF/UCITS, posibles fondos multiactivo sistemáticos; riesgo EUR/FX y spreads reales. Ninguna clase tiene por qué subir cuando otra baja. No prometer evitar siempre pérdidas o ganar en 80% de años, y **no afirmar que pasar de dos índices de acciones sea protección anticrisis**.

**Distinción respecto del trabajo consumido:** V8 predijo caídas pero SELL/REBUY, V9 estados, V10 retrasar aportaciones y V11 sizing continuo **FAIL económicos y retirados**; momentum 12–2/ranking sector/Factor R1 consumidos. **PROHIBIDO renombrarlos como nueva estrategia y retunear ventanas/umbrales después de conocer sus resultados.** Primero revisar si existe un mecanismo económico diferente (*acceso a fuentes realmente descorrelacionadas por régimen y coste de oportunidad cuantificado*), luego congelar UNA política *antes* de datos fresh, con `NEXT_OPEN`, misma caja/flujos, impuesto/fees/FX y capital invertible; integrar en la misma cadena `CORE_ARCHITECTURE_V1` sólo si pasa filtro de literatura y ejecutabilidad, sin motor paralelo.

**Prueba económica pretendida (si existiese hipótesis/promoción futura):** patrimonio final NETO vs benchmarks múltiples **preregistrados**, max drawdown, duración de recuperación, rentabilidad por unidad de downside, años calendario superados, captura de bajadas y coste de perder rallies, presencia/ausencia de recuperación, volumen de rotación y tributación (fondos traspasables vs ETFs). Contrastar específicamente 2022 (acciones+bonos bajaron juntos) y crisis de deflación en diagnósticos CONSUMIDOS, nunca usar esas fechas para optimizar reglas de promoción. En términos de usuario, dos objetivos que pueden entrar en tensión: **menor caída** y **más rentabilidad**; ofrecer frontera, no prometer ambos siempre.

**Decisión de hoy:** `CROSS_ASSET_REGIME_ROTATION_PAPER_IDEA_RECORDED_NOT_IMPLEMENTED`. Seguir la revisión económica en curso sin código ni nuevo job, no alterar `LEGACY` ni iniciar otro backtest. Idea de investigación posterior a evaluar con evidencia independiente, no una orden de compra/venta ni una instrucción para abandonar el plan vigente.
