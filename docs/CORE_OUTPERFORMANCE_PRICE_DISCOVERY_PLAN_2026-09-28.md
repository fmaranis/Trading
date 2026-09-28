# Plan ejecutable: liderazgo sectorial cerca de máximos anuales

Fecha: 2026-09-28. Base main comprobada: `c282d73ec920d3bde55466c36284ad8e41195956`.
Estado: **LITERATURE_REVIEW_COMPLETE / DESIGN_FROZEN / IMPLEMENTATION_AND_ECONOMIC_TESTS_PENDING**.
ID de candidata: `SECTOR_52W_HIGH_LEADERSHIP_V1`. Research-only. Producción LEGACY.

## 1. Decisión y objetivo

Conservar Quality y Profitability como avances, distinguiendo señal, implementación y riesgo. No declarar inútil el análisis técnico por los resultados de pendientes 20/60 sobre 15 episodios. Tampoco volver a ajustar aquellos filtros ni reabrir el decil momentum12-2 cerrado.

Investigar UNA hipótesis nueva: la información sectorial puede incorporarse gradualmente a precios; la cercanía a máximos anuales puede identificar liderazgo persistente con valor adicional frente a mantener el mercado. Usar ETF sectoriales observables reduce el coste de datos y evita reconstruir fundamentales de cientos de acciones. No demuestra que la cotización «tenga que subir» ni que un soporte roto cause rentabilidad.

Objetivo económico: superar URTH y SPY, con costes comparables, y medir si se alcanza el 80% de periodos anuales pedido por el usuario. Un 80% observado no equivale a probabilidad futura del 80%. Una estrategia con menor frecuencia puede tener ventaja acumulada, pero debe etiquetarse BELOW_USER_FREQUENCY_TARGET, nunca convertirla en objetivo cumplido.

Esta entrega contiene estudio de fuentes, diseño, contratos y orden de ejecución. **No contiene un nuevo backtest rentable ni un runner de mercado ya implementado.** No se necesita esperar al experimento de Quality para ejecutar este plan desde otro chat.

## 2. Evidencia primaria revisada y límites de transferencia

| Fuente | Qué aporta | Qué no acredita |
|---|---|---|
| Lo, Mamaysky y Wang (2000), Foundations of Technical Analysis | Detección algorítmica de patrones; algunos contienen información incremental en su muestra de acciones estadounidenses. | Ni certeza de subida ni una política nuestra rentable después de costes. |
| George y Hwang (2004), The 52-Week High and Momentum Investing | Cercanía al máximo anual y capacidad predictiva distinta del mero retorno pasado. Estudia rankings, carteras compradoras/vendedoras y horizontes de tenencia. | Una ruptura literal no es la misma señal. El spread long-short no es rentabilidad long-only. |
| Hong, Jordan y Liu (2015), Industry information and the 52-week high effect | Evidencia favorable a un componente industrial del efecto; también estudia la contribución del lado comprador. | Sus industrias por capitalización no son los nueve ETF GICS ni nuestra implementación. |
| Hurst, Ooi y Pedersen (2017), A Century of Evidence on Trend-Following Investing | Evidencia amplia de persistencia de tendencias en distintos mercados y épocas. | Futuros diversificados, shorts y sizing no son una cartera minorista long-only que bata SPY el 80% de los años. |
| Novy-Marx (2015), Backtesting Strategies Based on Multiple Signals | Combinar/seleccionar señales agrava el sobreajuste. | Un conjunto de indicadores «que confirman» no es evidencia independiente por sí mismo. |
| DellaVigna y Pollet, Investor Inattention and Friday Earnings Announcements | Evidencia de reacción tardía a información de resultados; mecanismo alternativo al gráfico. | No valida compras indiscriminadas tras resultados positivos. |
| Christensen, Timmermann y Veliyev (2026), Warp speed price moves | Su preprint encuentra resultados compatibles con formación eficiente tras anuncios desde 2016 para la estrategia estudiada. | No demuestra que toda variante PEAD haya desaparecido, pero desaconseja tratar la literatura antigua como ventaja actual garantizada. |

Referencias consultadas (preferencia por autores/editoriales; no se usan testimonios de traders como prueba):
1. https://www.mit.edu/~alo/Papers/techanal.html
2. https://www.bauer.uh.edu/tgeorge/papers/gh4-paper.pdf
3. https://gattonweb.uky.edu/faculty/lium/52weekhigh.pdf
4. https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing
5. https://www.nber.org/papers/w21329
6. https://www.nber.org/papers/w11683
7. https://arxiv.org/abs/2601.08962
8. Universo/fechas de lanzamiento: https://www.ssga.com/library-content/pdfs/etf/us/target-a-lower-cost-of-ownership-with-sector-etfs.pdf (tabla histórica fechada 2019, no rendimiento futuro de este plan).

Interpretación propia: estos trabajos justifican pagar por UNA prueba controlada del mecanismo de máximos/industria. No justifican prometer rentabilidad, ni descartar Quality, ni seleccionar un ganador entre múltiples variantes. Evidencia publicada y éxito replicable en Custodia se evalúan por separado.

## 3. Qué aprovechamos del código existente

- `src/investment/decision/strategyConsensusEngine.ts`: `assessTrendStructure`, regresiones log-precio20/60/120, aceleración y ruptura20 causal que excluye la sesión actual del máximo previo.
- `src/investment/decision/entryTiming.ts`: `BREAKOUT_CONFIRMATION`, pullback y continuación; la regla actual permite precio >=0,997×máximo20 y añade filtros. NO es una ruptura estricta a máximos anuales y NO se modifica.
- `src/investment/decision/causalUniverseBacktestEngine.ts`, `dynamicHistoricalReplayCore.ts` y `src/investment/portfolioBacktesting/`: reutilizar contabilidad, ejecución, series, costes y métricas donde sus contratos sean compatibles. El aligner existente no sustituye la exigencia de cobertura completa de este estudio.
- `scripts/coreOutperformanceHitRateAudit.py`: reutilizar el criterio de victorias/ties y separación de ventanas solapadas; no mezclar outcomes entre estudios.
- Slope20/60, aceleración, breakout20 y setup productivo se guardarán sólo como columnas descriptivas con prefix causal. No entran en pesos, elegibilidad o salidas de V1. Las interacciones que parezcan buenas después no generan V2.

No construir un motor de recomendaciones alternativo. Un módulo puro de señal/estadística offline está permitido. Una traducción futura a Custodia debe recorrer scanner -> gate -> decisión -> allocator -> ejecución en research/shadow explícito.

## 4. Una sola construcción primaria congelada

### Universo y alcance

Nueve ETF originales de Select Sector con lanzamiento en 1998, en USD:
`XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV, XLY`.

Se escogen como conjunto histórico completo definido por lanzamiento, no por retornos. Registrar identidad, exchange, launch y continuidad desde fuentes oficiales antes de precios. No añadir XLRE/XLC, ni reemplazar sectores tras resultados. Las reorganizaciones sectoriales dentro de fondos son parte de su historia real: no reconstruir sus holdings actuales hacia atrás. Si existió un vehículo del conjunto original omitido o una discontinuidad no resuelta, bloquear y corregir el inventario antes de outcomes; después no cambiar la muestra silenciosamente.

Son instrumentos de investigación USA; no se afirma disponibilidad retail española ni equivalencia con UCITS. Son 9 unidades correlacionadas, no 500 acciones independientes.

### Señal de cierre mensual

Para cada ETF, en la última sesión real de cada mes t:
`H_i,t = adjustedClose_i,t / max(adjustedClose_i,s)`
para las **252 sesiones** terminadas en t, incluida t. Es una adaptación total-return-aware; no réplica exacta de máximos intradía o de capitalización industrial de los papers.

Orden descendente de H. Seleccionar `ceil(0,30×9)=3`. Empates por ticker ASCII ascendente, sin desempate usando rentabilidad posterior, pendiente o capitalización. No omitir enero. Sin periodo adicional de espera; siempre NEXT_OPEN después del cierre de señal.

### Persistencia y pesos exactos

En cada mes usar las seis selecciones mensuales más recientes (t, t−1,...,t−5). Cada selección aporta 1/6 del peso y sus tres ETF aportan 1/3 dentro de esa selección:
`targetWeight_i,t = count(i in last6Top3)/18`.

Suma=1; peso máximo por ETF=1/3. Rebalancear el vector agregado mensualmente al siguiente open común. Son votos de seis cohortes rebalanceadas, **no** seis carteras buy-and-hold que retienen pesos por deriva. Primera asignación usa seis señales históricas causales anteriores al start; no reconoce ganancias ficticias de warm-up. Mismo diseño en ambos bloques, sin stop-loss, apalancamiento, shorts, cash timing, volumen, Quality, valoración ni filtro de régimen.

30% y seis meses están motivados por construcciones de la literatura de máximos; 252, ETF, ajustes, redondeo a tres y rebalanceo agregado son decisiones de adaptación declaradas antes de outcomes. No se prueban 2/4 sectores ni 3/9/12 meses para rescatar.

### Fechas

- Descargar calendario/precios necesarios desde 2011-07-01 hasta 2026-01-07, pero separar vistas/salidas por etapa.
- Diagnóstico: primer common tradable open >=2013-01-01 hasta primer common open >=2019-01-01.
- Replicación temporal: primer common open >=2019-01-01 hasta primer common open >=2026-01-01; sólo interpretar tras gate diagnóstico. Comparten precio frontera, no retornos. Arranque de cada bloque independiente con 1 unidad de capital y targets de sus seis señales previas.
- Bloques seleccionados por disponibilidad de URTH y duración razonable, no por ranking retrospectivo. Sus mercados **ya fueron vistos** en el proyecto; ninguno se llama fresh/blind. Descargar un fichero completo cuenta como acceso; un flag no convierte en blind datos ya descargados.
- Warm-up: al menos 252 observaciones por ETF para cada una de las seis primeras señales. Precios URTH pre-inception nunca se fabrican. 2011 sólo es warm-up sectorial.
- Checkpoints de frecuencia: intervalos de 12 ejecuciones mensuales desde start y todos los rolling12m con paso mensual; 6 años completos en diagnóstico y 7 en replicación. Diarios para métricas de riesgo. Nada se extiende porque el resultado no guste.

## 5. Captura, causalidad y controles antes de interpretar rentabilidad

Primero congelar y commitear protocolo máquina + runner/test hashes antes de descargar outcomes de candidato. Crear marcador de apertura antes de consulta y manifiesto source/date/hash. Los outcomes de esta nueva candidata NO se han calculado en este encargo; se vieron incidentalmente retornos públicos de algunos sectores en documentación, por lo que tampoco se afirma selección totalmente blind.

Fuente primaria prevista: Yahoo chart REAL reutilizando proveedor y caché existentes. Guardar respuesta original, raw OHLC, adjusted close, currency, exchange timezone, distributions y splits. Benchmark idéntico proveedor/vintage/calendario: SPY y URTH. Si fuente primaria bloquea, registrar BLOCKED; alternativa documentada antes de calcular candidate returns, jamás escoger por rentabilidad. No reutilizar sin reconciliar las series de Wolfram con discrepancias NAV conocidas.

- Cobertura 100%: 9 ETF + SPY + URTH en cada sesión necesaria tras inicio, identidades exactas, monedas USD, sin huecos/duplicados/renormalización. Calendario no se infiere de una intersección que borre huecos.
- Execution adjusted open = raw open × adjusted close / raw close de esa sesión. Señal sólo usa barras <=t. El open posterior sólo materializa ejecución, nunca ranking de t.
- Pruebas de prefix invariance y de exclusión de futuro: añadir retornos futuros no cambia H/tie/selección/pesos. Factores de ajuste deben ser compatibles dentro de cada prefijo; no contar dividendos dos veces.
- Revisar splits, distribuciones extraordinarias, escisiones, cambios de mandato y de identidad. Un vendor adjusted close por sí solo no demuestra accounting correcto. Documentar eventos y fechas antes de medir el basket; la muestra histórica es conocida, por lo que accounting retrospectivo se etiqueta diagnóstico y no validación prospectiva. Información insuficiente => INCONCLUSIVE_CORPORATE_ACTIONS, nunca terminal values inventados.
- Contrastación anual contra NAV oficial; divergencia material no explicada => detener claims económicos hasta reconciliar. Guardar ambos valores y la causa; no sustituir una serie por otra para obtener PASS.
- Preflight sin descargar todos los años: un lote de metadatos + un intervalo común pequeño por símbolo. Máximo dos vías de fuente documentadas, sin credenciales inventadas ni servicios de pago nuevos. Fallo equivalente no se reintenta en bucle.

## 6. Comparaciones que evitan engañarnos

Primaria: portfolio long-only anterior frente a SPY y URTH, mismo start/end, misma moneda y flujos nulos.

Controles obligatorios, no candidatos alternativos elegibles para promoción:
1. basket equiponderado de los nueve ETF, rebalanceo mensual: ¿hay selección informativa o sólo exposición sectorial USA?;
2. señal 12-2 sobre los mismos nueve ETF con exactamente las mismas reglas de tres seleccionados/seis votos/costes, **sólo ablación contemporánea**, no reapertura o candidato sustituto del estudio momentum cerrado;
3. anulación del ranking: scores idénticos produce selección por empate conocida en unit fixtures; no se usa ese fixture sintético como evidencia económica;
4. tendencia/slope20/60/breakout20/breakout252 descriptivos en los mismos eventos. Breakout252 = close[t] > máximo de las 252 sesiones ANTERIORES, excluye t; necesita 253 barras. Un empate no es ruptura. No llamarlo equivalente a H ni añadirlo como gate.

Evaluar adicionalmente si el diferencial mensual de V1 frente al basket9 persiste tras exposición lineal al retorno de SPY (intercepto descriptivo con errores HAC12). Nueve ETF comparten riesgos; no llamar alpha puro a una exposición tech más alta. Si V1 no mejora basket9, no atribuirle valor al selector aunque el bloque estadounidense bata URTH.

## 7. Métricas y reglas de decisión

Reportar por bloque: cobertura, meses, años completos, selección mensual, pesos, turnover, CAGR/retorno total, excesos vs ambos y basket9, volatilidad diaria anualizada sqrt252, max drawdown diario, Sharpe diario con RF=0 común (convención research, no efectivo económico), peor12m, tamaño medio de victorias/derrotas, pérdida relativa máxima, hit-rates SPY/URTH/juntos y concentración.

Signal reference: unidades fraccionarias brutas y capital normalizado, sin atribuir ejecutabilidad retail. Añadir stress fijo **10 pb por lado negociado**, duplicado a20 pb, como hurdle de investigación, no tarifa real de broker. Cargos sobre notional comprado/vendido, incluida entrada y liquidación; turnover por drift real, no diferencias de targets solamente. TER no se resta de nuevo si está embebido en precios. Benchmarks pagan sus respectivas entradas/salidas, no el turnover de V1. Estado nunca «neto retail» en esta etapa.

Gate de continuidad al bloque de replicación, sin cambios tras diagnóstico:
- cobertura y accounting completos;
- excess CAGR >0 vs SPY y URTH incluso con20 pb por lado;
- exceso >0 frente a basket9 bajo misma convención de costes;
- max drawdown diario no peor que URTH y Sharpe no menor que URTH.

Si falla cualquiera: FAIL_DIAGNOSTIC o INCONCLUSIVE_DATA según causa; no abrir económicamente replicación para rescatar. Si pasa, abrir replicación sin ajustes. El 80% NO exige descartar una señal rentable sólo por seis observaciones: se reporta aparte como objetivo del usuario, no se oculta.

Tras ambos bloques:
- exigir los mismos gates en cada uno;
- bootstrap pareado de bloques mensuales circulares de12 meses, 2000 réplicas, seed20260928; no mezclar bloques históricos separados. Inferencia de exceso conjunto mediante mínimo de los dos excesos CAGR; límite inferior unilateral95% >0 en cada bloque para evidencia estadística de continuidad. Si no: INCONCLUSIVE_STATISTICAL_EVIDENCE, no buscar otra partición;
- >=80% victorias anuales conjuntas en **cada** bloque => MEETS_OBSERVED_80PCT_TARGET, sin convertirlo en probabilidad futura;
- positivo económico pero frecuencia <80% => PROMISING_ECONOMICS_BELOW_USER_FREQUENCY_TARGET. No equivale a objetivo cumplido;
- incluso PASS completo = PASS_RESEARCH_CANDIDATE_NO_PROMOTION; mercados consumidos y adaptación de implementación exigen evidencia independiente posterior.

No sumar ventanas móviles a años independientes. No confundir high hit-rate de retornos positivos con batir el core. No cambiar calendario, benchmark, ratio, nºsectores o salidas tras ver resultados.

## 8. Sólo después: implementación real y unión con Quality

Si no pasa señal, no construir UI ni allocator. Si pasa, estudiar instrumentos UCITS disponibles elegidos por exposición/metodología/acceso ANTES de mirar sus retornos; eso no reemplaza el ETF Quality ya cerrado ni autoriza buscar el ETF ganador. Costes reales, capital normal, títulos enteros, look-through y fiscalidad española comparada con core, mediante módulos existentes. Barrera de acceso retail de ETF USA explícita. La conversión EUR no elimina FX subyacente.

Mantener Quality congelada en paralelo. No mezclar score Quality×slope×breakout hoy. Una combinación sólo podría plantearse después de evidencia independiente de ambos componentes, con pesos/exposición registrados antes de una muestra nueva. La muestra actual no puede confirmar la combinación diseñada al verla.

## 9. Alternativa distinta, fuera de la cola de backtests automática

PEAD: reacción tardía a una sorpresa de resultados verificable, no a que EPS sea positivo. Mecanismo diferente al gráfico. Prioridad menor por necesidad de consenso anterior al anuncio, timestamp/timezone de publicación y tratamiento after-hours; datos actuales de «earnings surprise» pueden estar revisados. La evidencia contemporánea revisada es mixta.

Sólo inventario de disponibilidad de eventos/expectativas, sin outcomes ni selección de ganadores. No implementar hasta preregistro propio y fuente causal demostrada. No hereda automáticamente fechas/gates de V1 ni se activa como rescate tras FAIL. Es la segunda dirección razonada, no promesa de que funcionará.

## 10. Ejecución económica en tokens y entregables

Un solo agente. Sin Actions. Sin polling ni procesos que busquen indefinidamente una política ganadora. Reutilizar caché con hash. Scripts hacen aritmética y generan JSON; chat sólo resume cobertura/gates. No pedir al usuario lanzar el Centro de validación.

Orden para siguiente chat:
1. fetch main, leer PROJECT_STATE + este plan + JSON y verificar sello;
2. implementar módulo puro de señal/votos y guard de causalidad; no producción;
3. integrar adaptador research dentro del harness existente, provider/caché/calendario/costes, tests y seal pre-open; no motor paralelo;
4. preflight REAL y auditoría de eventos; bloquear si no se completa;
5. ejecutar una vez diagnóstico y todos sus controles; publicar resultados exactos y estado;
6. sólo tras gates, replicación temporal sin cambios; luego economía retail si procede;
7. conservar todas las pruebas fallidas y el número de variantes. Sin «seguir hasta que salga rentable» mediante búsquedas sobre el mismo histórico.

Tests necesarios: máximo252 causal, empate y símbolo deterministas, no futuro, seis votos/18 con suma1 y max1/3, warm-up no genera ganancias, NEXT_OPEN, coste de entrada/salida/turnover neteado, calendario completo, benchmark idéntico, corporate-action fail-closed, indicadores descriptivos no cambian pesos, producción LEGACY, tsc y guards afectados.

Archivos previstos por implementar: `scripts/sector52WeekHighLeadershipV1Protocol.mjs`, runner local + adaptador research compatible, tests correspondientes, `validation-runs/preregistration/...execution-seal.json`, cache manifest y diagnóstico/resultados. El nombre previsto no implica que ya existan.

Entregable de esta sesión: plan, especificación JSON, sello documental y prompt de traspaso. Estado económico actual de la nueva candidata: **NOT_RUN**. Si el chat siguiente carece de acceso necesario, debe devolver bloqueo concreto y trabajo persistido, no inventar resultado ni trasladar pruebas manuales al usuario.
