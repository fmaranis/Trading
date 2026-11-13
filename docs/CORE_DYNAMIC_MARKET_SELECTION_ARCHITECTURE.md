# CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE

Estado: **NORMATIVO / INVARIANTE DE PRODUCTO / IMPLEMENTADO EN CÓDIGO · VALIDACIÓN LIVE PENDIENTE**

Fecha de formalización: **2026-09-09**

Este documento define una regla estructural de la aplicación. No es una hipótesis de research ni un detalle de una validación concreta. Cualquier desarrollo futuro debe respetarlo salvo decisión explícita del usuario documentada como cambio de arquitectura.

## 1. Objetivo de producto

La app no tiene como objetivo elegir inversiones dentro de una lista fija de 64 instrumentos.

El objetivo es:

> **buscar de forma dinámica en el mercado actual, identificar los activos más atractivos y fiables disponibles en ese momento, formar una shortlist operativa dinámica y decidir después si merece la pena entrar, añadir, mantener, reducir o no hacer nada.**

La pregunta de producto es siempre:

1. **DÓNDE**: qué activos son hoy los candidatos más atractivos/fiables del mercado accesible;
2. **CUÁNDO**: si alguno de esos candidatos tiene timing y condiciones suficientes para actuar;
3. **CUÁNTO**: cuánto capital debe asignarse, si procede;
4. **POR QUÉ**: qué evidencia respalda la decisión;
5. **NO HACER NADA** debe seguir siendo una salida válida.

## 2. Los 64 son una shortlist dinámica, no un universo fijo

Cuando se utilice el número 64, significa **máximo/objetivo de candidatos operativos del momento**, no una whitelist permanente de nombres.

La identidad de los activos puede y debe cambiar entre evaluaciones.

Ejemplo conceptual:

`mercado actual -> discovery amplio -> filtros de operatividad/calidad de datos -> ranking causal -> Top 64 dinámico -> gates -> timing -> allocation -> decisión`

Un activo puede entrar hoy y salir en la siguiente revisión si deja de ser competitivo. Un activo nuevo puede entrar si pasa las mismas reglas.

Si existen menos de 64 candidatos válidos, se utilizan únicamente los válidos. Nunca se rellena la shortlist con activos inválidos sólo para alcanzar 64.

**La shortlist Top 64 no aplica una regla de “un activo por categoría”.** Su función es descubrir/rankear candidatos. La diversificación y los límites de concentración pertenecen a `PortfolioCandidateGate` y al allocator posteriores.

## 3. Qué se congela y qué no se congela

En producción y en validación prospectiva deben congelarse, cuando proceda:

- las reglas de discovery;
- los mercados/tipos de instrumento admitidos;
- los filtros de operatividad y calidad de datos;
- la fórmula de ranking;
- las variables usadas para rentabilidad potencial, fiabilidad y riesgo;
- el tamaño máximo de shortlist;
- los hard gates;
- las reglas de timing;
- las reglas de allocation;
- la semántica de ejecución y costes.

**No se congelan por defecto los nombres de los activos.**

Congelar una lista nominal de instrumentos sólo es admisible en un estudio controlado específico y debe etiquetarse expresamente como tal. Nunca puede confundirse con la arquitectura productiva de selección de mercado.

## 4. Significado de “más rentables/fiables”

No significa ordenar únicamente por rentabilidad pasada.

La shortlist debe resultar de reglas causalmente definidas que combinen, según las versiones validadas de la app:

- potencial de retorno / momentum / oportunidad;
- fiabilidad y persistencia de la señal;
- riesgo, volatilidad y drawdown;
- calidad y suficiencia de datos;
- liquidez/operatividad cuando exista esa evidencia;
- divisa y compatibilidad con el motor;
- cualquier filtro estructural productivo vigente.

### Ranking productivo vigente de la shortlist

Para cerrar la arquitectura sin promocionar indirectamente una política research no validada, la primera implementación usa:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

Orden principal:

- score scanner ya productivo = momentum 20/60/120 ponderado menos penalización por volatilidad/drawdown, con el tratamiento defensivo existente.

Desempates deterministas:

1. `reliabilityScore`;
2. `opportunityScore`;
3. ticker.

Esto es deliberado: `QUALITY_V1` / `QUALITY_ALLOCATION_BRIDGE_V1` **no se promocionan por la puerta de atrás** como nueva política de producción. Reliability/Opportunity quedan disponibles y auditables, pero no sustituyen todavía el score productivo principal.

El score de discovery/ranking selecciona **candidatos para estudiar**. No autoriza una compra por sí mismo.

## 5. Cadena productiva canónica

La arquitectura productiva continúa siendo `CORE_ARCHITECTURE_V1` y debe mantenerse integrada.

Conceptualmente:

`AssetUniverseScanner [current/live discovery + filtros + ranking Top64 dinámico]`
`-> PortfolioCandidateGate`
`-> InvestmentDecisionEngine`
`-> PortfolioDecisionEngine/evaluatePortfolioDecision`
`-> ejecución y seguimiento`

No crear un segundo motor de discovery, ranking, decisión o replay.

El discovery amplía/renueva candidatos; no puede saltarse `PortfolioCandidateGate`, cash hurdle, consenso, timing, allocation, fiscalidad ni reglas de ejecución.

## 6. Implementación current/live vigente

`EUR_PORTFOLIO_DISCOVERY_UNIVERSE` es una **base operativa/seed/fallback validada**, no la definición conceptual del mercado disponible.

Puede proporcionar candidatos conocidos y robustos cuando el discovery abierto falle temporalmente, pero no debe convertirse en una whitelist que impida considerar activos nuevos.

### Discovery

`OPEN_MARKET_DISCOVERY_V1` continúa integrado dentro del `AssetUniverseScanner` existente.

La búsqueda current/live incluye familias estructurales para:

- ETF/ETC amplios, sectoriales y defensivos;
- acciones cotizadas EUR por grandes mercados europeos;
- tecnología, semiconductores, salud, energía y dividendo;
- búsquedas de listados EUR de grandes compañías US cuando Yahoo los exponga.

Los tipos promocionables automáticamente son actualmente:

- `ETF`;
- `EQUITY`;

siempre que:

- coticen en EUR;
- dispongan de >= 252 barras inspeccionadas;
- procedan del snapshot current/live;
- `historicalPointInTimeSafe === false` quede declarado explícitamente.

Los fondos directos existentes pueden seguir entrando por el seed/catálogo y su ruta NAV específica.

### Ranking y Top 64

En una evaluación current/live canónica:

- el scanner no obedece los antiguos `maxSelected: 8/10/12` heredados de consumidores previos;
- utiliza `DYNAMIC_MARKET_SHORTLIST_TARGET = 64`;
- ordena todo candidato REAL aceptado por `MARKET_SHORTLIST_LEGACY_SCORE_V1`;
- conserva hasta 64;
- si hay menos de 64 válidos, conserva sólo los válidos;
- registra `dynamicMarketShortlist`, incluido el listado inmutable de `shortlistAssetIds` de esa evaluación.

Ese listado de IDs es importante: después del gate `scan.selected` pasa a significar selección final. La auditoría conserva separadamente los IDs del Top64 original para que un paso posterior nunca confunda ambas capas.

### PortfolioCandidateGate

Cuando `dynamicMarketShortlist.applied === true`:

- sólo los IDs del Top64 original pueden someterse a cash hurdle, consenso y timing como candidatos de dinero nuevo;
- un candidato REAL aceptado que quedó fuera del Top64 recibe `OUTSIDE_DYNAMIC_MARKET_SHORTLIST`;
- después el gate mantiene su diversificación/caps y puede reducir a la selección operativa final;
- ningún activo del pool amplio puede reaparecer por accidente después del Top64.

### Limitación de cobertura actual

Yahoo Search es un **discovery current/live amplio**, pero no un instrument master exhaustivo de todos los valores del mundo.

Por tanto, la formulación correcta es:

> **Top 64 de los candidatos current/live descubiertos y operables por el motor EUR.**

No se debe afirmar “Top 64 de todos los activos mundiales” mientras no exista una fuente exhaustiva de instrumentos elegibles.

La arquitectura está preparada para sustituir/ampliar el proveedor de discovery sin cambiar scanner, gates, decisión ni allocator.

## 7. Validación operativa de esta implementación

Job current del `ResearchValidationCenter`:

`dynamic-market-top64-v1`

Nombre UI:

**Mercado dinámico · Top 64 current/live**

Orden:

1. `tests/dynamicMarketShortlist.unit.ts`;
2. `tests/openMarketLiveScannerIntegration.unit.ts`;
3. `tests/coreArchitectureV1.unit.ts`;
4. `tests/portfolioCandidateGate.unit.ts`;
5. `npm run lint` / `tsc --noEmit`;
6. `scripts/dynamicMarketTop64Live.ts` con datos REAL current/live.

El resultado live esperado es:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

El runner registra:

- tamaño seed/fallback;
- pool escaneado;
- pool REAL aceptado;
- número de candidatos descubiertos/promovidos;
- Top64 resultante con ranking y métricas;
- hash SHA-256 del snapshot;
- candidates fuera del Top64 y su auditoría;
- leak de elegibles fuera del Top64, que debe ser 0.

Hasta ejecutar esta validación local, el estado es **implementado en código / validación REAL pendiente**, no PASS final.

## 8. Regla para futuras validaciones prospectivas

Una validación future-forward de selección/ranking debe congelar **las reglas**, no los nombres.

En cada fecha de decisión debe registrar de forma auditable:

- snapshot de candidatos descubiertos ese día;
- procedencia y timestamp del discovery;
- candidatos rechazados y motivo;
- ranking completo o suficiente para reproducir la shortlist;
- Top 64 dinámico resultante;
- decisiones posteriores de gates/timing/allocation;
- huella/hash que impida reescribir retrospectivamente una observación ya cerrada.

Si una futura versión de código cambia una decisión ya observada, esa evidencia prospectiva no puede sobrescribirse silenciosamente.

## 9. Replay histórico y survivorship

El discovery actual de Yahoo es current/live y **no puede utilizarse para inventar retrospectivamente el mercado disponible en 2018, 2020, etc.**

Para reconstruir históricamente un universo dinámico de mercado completo hace falta un instrument master point-in-time con, como mínimo:

- altas/listings;
- bajas/delistings;
- cambios de ticker/mercado cuando proceda;
- disponibilidad histórica por fecha.

Hasta disponer de ello:

- los replays históricos mantienen su comportamiento previo y catálogos conocidos con disponibilidad causal de barras;
- deben declarar la limitación de survivorship;
- no deben presentarse como prueba completa de “elegir los mejores del mercado de cada fecha”.

La implementación Top64 actual se activa sólo en current/live canónico; no modifica silenciosamente el replay histórico.

## 10. QUALITY, LEGACY y allocation

El universo/shortlist dinámico responde a **DÓNDE**.

`LEGACY` vs `QUALITY_ALLOCATION_BRIDGE_V1` responde principalmente a cómo priorizar/asignar capital **después** de que existan candidatos válidos.

No deben mezclarse ambos problemas metodológicos.

Producción permanece `LEGACY` mientras QUALITY no tenga evidencia fresh suficiente.

Una validación de QUALITY no debe convertir una lista fija de activos en arquitectura de producto.

## 11. Invariantes que futuros cambios no pueden violar

1. **No whitelist fija como universo productivo.**
2. **64 = shortlist dinámica máxima/objetivo, no 64 nombres permanentes.**
3. **Discovery actual debe poder incorporar candidatos nuevos bajo reglas explícitas.**
4. **Ranking sólo crea candidatos; los gates/timing/allocation conservan autoridad.**
5. **La app puede concluir “no comprar nada”.**
6. **No usar Yahoo current discovery para reconstrucción histórica retrospectiva.**
7. **Las validaciones prospectivas congelan reglas y snapshots observados, no identidades futuras.**
8. **No crear motores paralelos para resolver discovery/ranking.**
9. **Producción y replay comparten la misma cadena conceptual, respetando las limitaciones de datos de cada modo.**
10. **El Top64 original debe permanecer auditable aunque `scan.selected` sea reducido posteriormente por gates.**
11. **Cualquier desviación de estas reglas debe documentarse como cambio explícito de arquitectura antes de implementarse.**

## 12. Criterio de cierre de esta parte de la app

La implementación de código ya cubre:

1. discovery current/live que puede incorporar ETF y acciones EUR nuevas;
2. datos REAL + rechazo de fallos de procedencia/calidad;
3. ranking reproducible y determinista;
4. shortlist dinámica de hasta 64;
5. entrega explícita del Top64 a `PortfolioCandidateGate`;
6. auditoría de incluidos/excluidos;
7. posibilidad de que gates posteriores rechacen todos los activos;
8. replay histórico aislado del Yahoo current discovery.

Para declarar esta fase **cerrada en PASS** falta únicamente ejecutar el job REAL current/live y confirmar sus guards y la ausencia de leaks.

La ampliación futura hacia un instrument master más exhaustivo mejora cobertura de discovery, pero no cambia esta arquitectura.

## 13. USD research · fase A (2026-11-13)

La app permitía teclear cualquier ticker en `Estudio de inversiones y señales → Analizar cualquier valor`, pero su análisis asumía EUR incluso para una cotización USD. **Eso no era una evaluación correcta para un patrimonio EUR.** Se aprovecha la superficie y el `SingleAssetResearchEngine` ya existentes: **no** se crea un segundo scanner, allocator, replay o pantalla.

- **Modo opt-in por símbolo**: `NVDA`, `MSFT`, `AAPL` son accesos rápidos ilustrativos, no un universo cerrado. Se acepta cualquier ticker que el proveedor identifique con `currency=USD` o EUR; otras monedas o currency desconocida fallan explícitamente. Los ISIN de fondos EODHD siguen usando su NAV y moneda explícita. No se añade USD al `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` de producción.
- **Fuente REAL**: Yahoo a través del `HistoricalMarketDataService` y del proxy ya existente, `adjusted:false` para no reescribir el pasado por dividendos posteriores; USD cotizado se convierte con `EURUSD=X` REAL (USD por EUR). Se exige `provenance.sourceType=REAL` para precio listado y FX. No se inventa FX ni se usa fallback sintético.
- **Causalidad conservadora**: por cada barra de acción en fecha D, se usa exclusivamente el **último cierre FX estrictamente anterior a D** (`fxDate < D`), con máximo de 5 días naturales. Se convierten OHLC en EUR, conservando el volumen en títulos originales. Nunca se usa el cierre FX del mismo día para simular la entrada `NEXT_OPEN`; si faltan barras válidas se bloquea el análisis. El FX aplicado es una aproximación causal, **no** el tipo de cambio negociable del bróker en el instante real.
- Las gráficas, drawdown, retornos e indicadores se calculan en EUR desde la serie convertida, no comparando rentabilidad USD directa con el efectivo remunerado en EUR. `SingleAssetResearchEngine` incorpora una lectura **informativa** del `PortfolioCandidateGate.apply` ya existente sobre el último estado: `ELIGIBLE/REJECTED`, motivo, timing y ranking. Esta lectura no reemplaza la decisión portfolio y nunca autoriza una orden.
- El panel existente identifica moneda original, moneda de análisis, origen y fecha del último FX, y advierte que la barra del día puede ser provisional. La caché de análisis se limita a 5 minutos para no conservar toda la sesión un estado intradía potencialmente obsoleto.
- **Frontera deliberada**: no hay ejecuciones USD, compra automática, ETF en moneda extranjera a cartera, cash USD, brokerage FX/spread, accounting multimoneda, fiscalidad ni backtest USD completo. El replay unitario de señales sigue siendo **diagnóstico bruto** sin comisiones/impuestos; no equivale a rentabilidad neta real. Producción `LEGACY` permanece EUR y sin cambios.
- Pruebas en `tests/singleAssetResearch.unit.ts`: transformación numérica EUR, uso de FX anterior para `NEXT_OPEN`, cambio del FX futuro sin efecto previo, missing/invalid FX fail closed, y lectura del gate canónico. Se incorpora el archivo de tests como puerta rápida en el job existente `product-surface-closure-v1`; no se ejecutan replays históricos largos.
- **Siguiente etapa separada (no habilitada)**: FX diario/ejecutable con cotización real y costes reales de intermediación, compra en títulos enteros USD, registro de coste de adquisición/fiscalidad y valoración en EUR, paridad del `PortfolioExecutionPlan`, guards causalidad, backtest multicurrency con benchmarks y flujos; solo entonces USD podrá competir con EUR en el allocator productivo. No promover sin esa cobertura.

## 14. 2026-11-13 — integración conjunta H1/H2 y mercado USD en la cadena canónica

La fase USD **ya no queda aparcada como analizador externo**. Se integra en el escaneo current/live de la misma aplicación y en la misma traza H1/H2, aunque sus órdenes productivas continúan bloqueadas mientras no existan costes y fiscalidad multimoneda verificados.

- `AssetUniverseItem.currency` distingue explícitamente EUR y USD. El seed operativo incorporó una pequeña cobertura `USD_NVDA/USD_MSFT/USD_AAPL` **solo como resiliencia de investigación**, y `OPEN_MARKET_DISCOVERY_V1_QUERIES` amplió Search a familias estructurales de acciones estadounidenses Nasdaq/NYSE (current/live exclusivamente). Las búsquedas no equivalen al instrument master exhaustivo. El servidor verifica `currency=USD`, `quoteType=EQUITY`, barra histórica suficiente y queryFamily US; responde `acceptedEurCandidates` y `acceptedUsdCandidates` por separado. No se utilizan estos resultados para reconstruir un universo PIT pasado.
- `AssetUniverseScanner` carga Yahoo REAL `EURUSD=X` **una sola vez por escaneo** si existen candidatos USD, y convierte series diarias REAL a EUR con `convertUsdBarsToEurCausally` (cierre FX estrictamente anterior a cada sesión, antigüedad máxima 5 días). `adjusted:false`, nunca usar dividendos futuros ni FX sintético/fijo silencioso. Los fallos de FX provocan `REJECTED:USD_FX_UNAVAILABLE` únicamente en USD; no contaminan el EUR validado. Conservar moneda original `asset.currency='USD'`, metadatos de FX, huellas de serie original y normalizada, serie de valoración de scanner en EUR. `SingleAssetResearchEngine` reutiliza el conversor compartido.
- **Autoridad productiva**: mientras no estén resueltos cambio del bróker, spreads, tipo negociable, comisión, liquidación, lotes FIFO en divisa y replay multimoneda, el Top64 productivo selecciona **solo EUR**. `PortfolioCandidateGate` rechaza explícitamente USD con `USD_RESEARCH_ONLY_FX_EXECUTION_UNVERIFIED`; `PortfolioExecutionPlan` tiene doble guard que transforma hipotéticas compras/ventas USD inyectadas en `REVIEW`, no `BUY_ETF/SELL_ETF`. `LEGACY`, reglas de cash, cartera, sizing y órdenes EUR no se reajustan.
- **Misma superficie de estudio**: `InvestmentResearchLab` muestra las candidatas USD investigables (con variaciones valoradas en EUR) como `USD · INVESTIGACIÓN`, nunca `CARTERA` ejecutable. El H2 desplegable existente muestra `usdResearchCandidates` junto a H1 `newMoneyAllocationAudit`: capital base disponible, propuestas y remanente `null` si hay rotaciones y no es descomponible. Un remanente **NO** es una predicción de beneficio perdido ni una autorización para invertirlo. El H2 readout mantiene fingerprint y metadatos source/FX, no extrae lotes fiscales ni transmite datos a GitHub.
- **Duplicados cross-currency**: una cotización USD de una compañía no debe ocultar una cotización EUR de esa misma compañía en el discovery productivo. Se conservan las dos representaciones identificadas por su divisa; ninguna dupla USD/EUR puede dar dos órdenes porque el USD sigue research-only.
- **Pruebas extendidas** dentro de `Producto · cierre rápido`: `singleAssetResearch.unit` conversion/causalidad, `portfolioCandidateGate.unit` rechazo USD, `dynamicMarketShortlist.unit` descubrimiento/duplicados, `currentCapitalAllocation.unit` identidad H1/H2 + remanente y `portfolioExecutionPlan.unit` bloqueo órdenes de compra/venta USD. Todas unitarias; no backtest largo ni GitHub Actions.
- **Estado**: implementación multi-archivo en `main`, todavía sin cierre técnico `tsc --noEmit` ni guards del HEAD nuevo. No hay validación live actual de NVDA ni autorización de ejecutar USD. La siguiente puerta técnica es `ResearchValidationCenter → Producto · cierre rápido`; solo después abrir captura REAL current para comprobar proveedor FX, datos y fallos, evitando replays de muestras consumidas.

La fase productiva real USD será una continuación de esta misma arquitectura, **no otra app**: FX negociable con bróker y costes completos, valoración/ejecución de títulos enteros, cartera y FIFO por divisa, fiscalidad española, replay `NEXT_OPEN` causal, cash independiente y pruebas de paridad; exigir datos verificables, nunca inventar un spread ni una comisión universal.
