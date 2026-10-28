# Custodia — E2: escisiones empresariales (auditoría en papel)
Fecha: 2026-10-29. Resultado: E2_NO_GO_STANDALONE_ON_CURRENT_EVIDENCE.
Sin código, backtest, nueva pantalla ni cambios de LEGACY.

## Delimitación del mecanismo

Amihud, Huh y Subrahmanyam (Journal of Financial Markets, 2025, DOI 10.1016/j.finmar.2025.101000) estudiaron 68 escisiones de dos etapas entre 1986 y 2017: primero una IPO de hasta 20% de la filial; después una distribución mayoritaria que eleva súbitamente el capital libre en circulación. Reportaron CAR anormal 8,31–9,65% desde evento a +60 sesiones, con caída de la filial hasta +5 días. El objetivo central del artículo era el contagio de liquidez/valoraciones a empresas relacionadas, no demostrar un sistema minorista rentable. Una CAR desde día 0 NO es retorno negociable entrando tras observar caída, y no incorpora necesariamente costes/fiscalidad.
Fuente: https://www.sciencedirect.com/science/article/pii/S1386418125000400

La muestra supone 68/32=2,125 eventos/año histórico seleccionado. NO significa que solo existan 2 escisiones al año: escisiones ordinarias y operaciones dos etapas son categorías diferentes. El master del estudio parte de SDC Platinum y usa datos CRSP/TAQ/ISSM. No se ha identificado un master público completo as-of de la misma categoría, con delistings.

## Comprobaciones documentales independientes

Kenvue/J&J (2023): filial colocada en bolsa en mayo y después oferta de CANJE VOLUNTARIA de JNJ por KVUE. El canje de agosto fue sobresuscrito, prorrateado (23,231832% a participantes sujetos a prorrateo), con ~9,5% de KVUE retenido por JNJ. No equivale a distribución automática a todos los accionistas, ni garantiza venta forzada. Fuentes:
https://www.jnj.com/media-center/press-releases/johnson-johnson-launches-exchange-offer-for-separation-of-kenvue-inc
https://www.jnj.com/media-center/press-releases/johnson-johnson-announces-final-results-of-exchange-offer-and-finalizes-separation-of-kenvue-inc

Qnity/DuPont (2025): distribución ordinaria pro-rata de acciones Qnity a accionistas DuPont (1 por 2), documentada en SEC, sin IPO minoritaria previa de la misma filial. El documento declara endeudamiento significativo de Qnity. NO es el mismo tipo de operación del artículo:
https://www.sec.gov/Archives/edgar/data/2058873/000119312525240313/d21160dex991.htm

Los calendarios públicos de 2025/2026 recogen numerosas escisiones genéricas, pero no prueban cuántas fueron del subtipo exacto dos etapas. Resultado: NO_DATA para tasa contemporánea estrictamente comparable.

## Evidencia contraria y diferencia mediana vs cartera ponderada

Aalto (tesis 2023, 140 casos 2010–2022) no halló abnormal returns persistentes a 36 meses para matriz/filial; es evidencia secundaria, no réplica del subtipo dos etapas:
https://aaltodoc.aalto.fi/items/2205e355-7665-4f76-94ff-034354473fd6

Spinoff Tracker, seguimiento independiente NO revisado por pares, publica 103 operaciones cotizadas recientes (2020–2026), 33 superaron S&P500, mediana de exceso anualizado −12,3 pp. Sus ventanas difieren, no ajusta por industria y el propio autor advierte de problemas de corporate actions y delistings. No presentar como replicación de Custodia ni como muestra dos etapas:
https://spinofftracker.com/research/
https://spinofftracker.com/methodology/

El mismo seguimiento señala una rentabilidad más favorable del ETF ponderado por capitalización. No hay contradicción: la media ponderada por dinero puede ser positiva mientras la operación típica decepciona. S&P U.S. Spin-Off Index incluye empresas escindidas en cuatro años, market cap flotante >=1.000 millones USD; NO es índice dos etapas. Invesco CSD es un ETF estadounidense, ISIN US46137V1594, ratio de gastos publicado aprox 0,65%. Elegibilidad minorista España y comparación EUR/EUNL no confirmadas:
https://www.spglobal.com/spdji/en/indices/dividends-factors/sp-us-spin-off-index/
https://www.invesco.com/us/en/financial-products/etfs/invesco-sp-spin-off-etf.html

## Causalidad, capital y veto económico

La fecha de distribución es pública con antelación. No conocer antes de ocurrir la intensidad de la presión vendedora ni la reversión; nunca confundir precio when-issued, regular-way o ajuste de corporate action por dividendos en acciones. Tomar los adjusted closes previos de Yahoo como si pertenecieran a la misma empresa puede duplicar distribuciones.

La frecuencia de solo 2,125 operaciones dos etapas anuales en la muestra seleccionada plantea problema de reach. Ilustración de capacidad (NO forecast): con ~60 sesiones por oportunidad y un 10% del capital por ticket, exposición media aproximada 2,125*60/252*10%=5,1% del capital-año si no hay solapamiento; el resto no puede suponerse invertido ni remunerado mágicamente. Si se financia vendiendo el índice, hay más costes, FX, impuestos y riesgo de quedarse fuera de su subida. Las operaciones sobre pequeñas filiales añaden horquilla y whole shares.

No existe evidencia encontrada de política definida ex ante y ejecutada al NEXT_OPEN post evento que supere MSCI World/EUNL en EUR NETO, con costos, delistings, fiscalidad y el tamaño normal de cartera. La muestra histórica del estudio no puede reconstruirse limpiamente con Yahoo current discovery.

## Decisión

E2_NO_GO_STANDALONE_ON_CURRENT_EVIDENCE. Se conserva el mecanismo plausible de presión vendedora/efecto de liquidez, NO se desarrolla ahora. Veto de investigación por insuficiente frecuencia, fuentes PIT, retorno neto ejecutable y riesgo, sin afirmar que el fenómeno académico es falso. No probar variaciones de tiempos de espera/peso a posteriori.

Siguiente hipótesis paper-only E4: spreads contractuales de ofertas de adquisición anunciadas en EFECTIVO. Mecanismo diferente: descuento frente a precio de oferta por riesgo de fracaso, retrasos, financiación y regulación. El margen visible NO es arbitraje sin riesgo; una cancelación puede producir una pérdida desproporcionada. Se comprobará primero semántica SEC y costos sin abrir precios futuros ni ejecutar backtests.
Fuentes:
https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/Speculation-spreads-and-the-market-pricing/991021881497804721
https://doi.org/10.1080/15427560.2025.2563883

Estado: E1_NO_GO, E2_NO_GO_STANDALONE, E3_FORM4_CONTEXT_ONLY, E4_PAPER_GATE_NEXT. Producción LEGACY intacta.
