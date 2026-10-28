# Custodia — E1, recompras efectivas: resultado de la primera auditoría en papel

**28-10-2026. Estado: `E1_NO_GO_STANDALONE_TRADING_ON_CURRENT_EVIDENCE`. No backtest, no código, no job, no recomendación, no modificación de `LEGACY`.**

Esta conclusión es una **decisión de priorización de investigación**, no un backtest que haya refutado toda estrategia de recompra ni una afirmación de alpha negativo universal. Las fuentes se consultaron **antes de abrir precios/retornos posteriores**. Ejemplos corporativos seleccionados previamente para comprobar estructura de los reportes, **no muestra estadística de rentabilidades**.

## 1. Qué está disponible y cuándo se conoce realmente

La SEC, bajo Item 703 de Regulation S-K, exige para cada mes del trimestre una tabla de compras efectivas del emisor: número total, precio medio, compras bajo programa anunciado y capacidad remanente. Incluir compras fuera de programa y las notas relativas a naturaleza del instrumento/clase. Fuente: https://www.law.cornell.edu/cfr/text/17/229.703

La SEC anunció **2024-02-09** que la regla nueva de disclosure diario de 2023 quedó **anulada por sentencia de 2023-12-19**, volviendo al esquema mensual por informe periódico: https://www.sec.gov/newsroom/whats-new/further-announcement-regarding-share-repurchase-disclosure-modernization-rule . **No existe feed público general diario que permita copiar causalmente todas las recompras a su ejecución.**

**Timestamp verificable** — no basta fin de trimestre ni fecha de compra:
- Alphabet, accession `0001652044-26-000018`, periodo 2025-12-31, **Accepted 2026-02-04 21:56:03**, **Filing Date 2026-02-05** (distintos días, aceptado fuera del corte de fecha de presentación). Fuente SEC index: https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/0001652044-26-000018-index.html
- Palantir, accession `0001321655-26-000011`, periodo 2025-12-31, **Accepted 2026-02-17 06:14:19**, **Filing Date 2026-02-17**. Fuente SEC index: https://www.sec.gov/Archives/edgar/data/1321655/000132165526000011/0001321655-26-000011-index.html
- La SEC aclara que las presentaciones después de **17:30 ET** pueden difundirse/indexarse al siguiente día hábil y que no dispone de timestamp público que certifique el instante exacto en que el contenido apareció accesible en sec.gov: https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data ; https://www.sec.gov/files/about/webmaster-faq.htm . Por ello, si alguna vez se prueban señales PIT, **solo ejecutar desde la siguiente sesión completa posterior a `filingDate`**, sin aprovechar supuesta lectura inmediata intra-sesión, ni usar `periodEnd`.

Las APIs EDGAR y documentos fuente son gratuitos y requieren `User-Agent` identificable, acceso respetuoso (máx. 10 solicitudes/s según SEC): https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data . La existencia de `Companyfacts` **NO asegura normalización mensual de todas las tablas Item 703**, y diferentes clases/filers requieren normalización supervisada. No se ha probado la cobertura de parsing del universo histórico completo.

## 2. Casos revisados: autorización y ejecución no equivalen a reducción efectiva

**Alphabet FY2025 (10-K oficial, fuente citada arriba):**
- Recompras realmente ejecutadas en 2025: **240 millones de acciones Clase A/C**, importe aprox. **45.398 millones USD**. Q4 2025 en miles de acciones: octubre **14.146**, noviembre **6.094**, diciembre **0**. El programa autorizado seguía teniendo aprox. **69.503 millones USD** remanentes al final de diciembre, pero **no recompró nada en diciembre**.
- Fuente SEC: https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm . Contrasta un flujo efectivo material con la capacidad autorizada; el ejemplo NO implica infravaloración, ni rentabilidad positiva posterior, ni ausencia de dilución agregada.

**Palantir FY2025 (10-K oficial):**
- Q4 2025: **106.171** acciones recompradas; FY2025: **600.446** acciones Clase A recompradas (aprox. **75 millones USD**) y retiradas, programa terminado en enero de 2026.
- **Control indispensable del denominador**, usando las acciones realmente emitidas y en circulación declaradas para todas las clases (en miles):
  - 2024-12-31: A 2.242.389 + B 95.401 + F 1.005 = **2.338.795 miles**;
  - 2025-12-31: A 2.290.987 + B 99.200 + F 1.005 = **2.391.192 miles**.
  - **Variación neta +52.397.000 acciones = aproximadamente +2,24%**, pese a haber recomprado 600.446. Por sí sola, la etiqueta `BUYBACK` habría ocultado que el número de acciones aumentó. Esto no demuestra cuál fue la causa única de cada emisión/cambio (requiere conciliación stock-comp/capital).
- Datos directamente del 10-K: https://www.sec.gov/Archives/edgar/data/1321655/000132165526000011/pltr-20251231.htm . Esta es una comprobación contable documental **ex post publicación**, no dato conocido a cierre 2025 ni señal prefiling.

**Consecuencia:** E1 tendría que calcular **cambio neto de acciones por clase y dilución**, cambios de deuda/caja/FCF y precio pagado, no limitarse a `Total Number of Shares Purchased`. Una recompra mayor no es creación automática de valor: distribuir efectivo y recomprar es económicamente comparable, con condicionantes de precios y financiación. CFA Institute: https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/analysis-of-dividends-and-share-repurchases .

## 3. Literatura contradictoria: la supuesta ventaja no está probada tras publicación y costes

1. **Gunn (2017, tesis doctoral University of Chicago)** `Share Repurchases: Market Timing and Abnormal Returns`: extracción mensual de informes 10-Q/10-K, rentabilidades anormales en compañías pequeñas y medianas **no grandes**, además de reacción positiva **en torno a** anuncio de earnings y fecha de presentación. **Una rentabilidad del día de filing no es rendimiento ejecutable `NEXT_OPEN` tras disclosure**. https://knowledge.uchicago.edu/records/0hm3v-qx219
2. **Li, Naidu, Navissi y Ranjeeni (2018), Australian Journal of Management**, `Net stock issuance anomaly and cash flow explanation`: al descomponer emisión neta, la anomalía estudiada estaba impulsada por **emisiones**, no por recompras aisladas. Contraevidencia directa a replicar indiscriminadamente los `BUYBACK`. https://research.monash.edu/en/publications/net-stock-issuance-anomaly-and-cash-flow-explanation-a-research-n/
3. **Bargeron, Bonaimé y Thomas (2017), JFQA**, `The Timing and Source of Long-Run Returns Following Repurchases`: retornos anormales principalmente **después de anunciar finalización** y concentrados en futuros **anuncios de nuevas autorizaciones/takeovers**, no una deriva temporal persistente tras autorización. No justificar comprar simplemente porque el emisor tenga un plan. https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/timing-and-source-of-longrun-returns-following-repurchases/3A0AA39EF30BB41483794352CDB40BAC
4. **Dittmann, Li, Obernberger y Zheng (2025), J. Accounting & Economics**, `Equity-based compensation and the timing of share repurchases`: el calendario corporativo explica la coincidencia de compensación y recompras; cuando CEO vende equity, las empresas son **menos** propensas a recomprar. Evitar afirmar sin respaldo que toda recompra coincidente es manipulación. https://doi.org/10.1016/j.jacceco.2025.101798
5. **Mashruwala y Mashruwala (2025), JBFA**, `EPS-motivated share repurchases and wealth transfer`: recompras motivadas por EPS pueden transferir riqueza a vendedores; aunque hay asociación con futuro desempeño operativo, eso **no equivale a alpha accesible post filing**. https://doi.org/10.1111/jbfa.12826

**Ninguna fuente encontrada en esta revisión certifica una política long-only concreta, comprada al `NEXT_OPEN` después del filing, que supere a EUNL en EUR neto con nuestros tickets y fiscalidad, ni el objetivo del 80% de años.** Puede existir información predictiva a corto/medio plazo; la política para monetizarla aún no está demostrada. Es una ausencia de evidencia suficiente para invertir en software, no prueba de inexistencia.

## 4. Fricciones cuantificables (sin optimización retrospectiva)

MyInvestor, tarifa pública de acciones USA: **0,12% de comisión por orden, mínimo 3 EUR, máximo 25 EUR**, y **0,30% FX por conversión EUR/USD**, sin acciones fraccionarias. Fuente https://myinvestor.es/inversion/broker/ . El broker permite cuenta en dólares en ciertas condiciones; no contabilizar dos conversiones si se mantiene realmente cash USD, ni omitir costes de apertura/conversión inicial.

Ejemplos de coste mínimo por compra y venta de un mismo valor con entrada/salida nominal iguales, sin spread/deslizamiento/impuestos, convirtiendo divisa en ambos sentidos:
- **Ticket 1.300 EUR**: 2×3 EUR de comisión, o **0,4615% del ticket**, + **0,60%** FX = **aprox. 1,0615%** roundtrip.
- **Ticket 2.600 EUR**: 2×3,12 EUR de comisión, o **0,24% del ticket**, + **0,60%** FX = **aprox. 0,84%** roundtrip.
- Para 13.000 EUR distribuidos en diez posiciones de unos 1.300 EUR, la fricción de entrada y salida es del orden de **138 EUR**, antes de todos los otros gastos, si se realizan las dos conversiones y el nocional no cambia. Esta cifra ilustra escala, **no backtest**.

El supuesto alpha académico en pequeñas/medianas compañías debe ser **incremental al índice y económicamente superior a este coste más spread, riesgo y fiscalidad**. `NO_DATA` para dicha ventaja realizable; no inferirla de abnormal returns around filing.

## 5. Veredicto antirrepetición

| Pregunta de gate | Hallazgo | Decisión |
| --- | --- | --- |
| Fuente pública y contenido | SEC Item703 mensual 10-Q/10-K verificable, aceptaciones/indexes oficiales | PASS sólo para muestra documental |
| Información conocida en fecha operable | Datos con retraso; filingDate y recepción SEC identificables; acceso exacto al contenido no timestamped | CAUSAL_PENDING (usar siguiente sesión completa) |
| Señal económica neta de dilución | Recompras nominales pueden coexistir con **+2,24%** acciones netas (caso Palantir), no hay normalización/universo PIT auditado | NOT_PROVEN |
| Prima tras publicación | Literatura da reacción alrededor de filing y resultados heterogéneos; no certifica compra posterior con beneficio neto | NOT_PROVEN |
| Costes para 13k EUR | ~0,84–1,06% roundtrip sólo comisiones/FX para tickets 1300–2600 EUR | HIGH_FRICTION |
| Alcance y robustez | Estudios favorables sobre todo en firmas pequeñas/medianas, con costes, liquidez, delistings y cobertura histórica sin demostrar | NOT_PROVEN |

**Decisión: `E1_NO_GO_STANDALONE_TRADING_ON_CURRENT_EVIDENCE`.** Detener inversión en un detector de buybacks/selector/replay; no ejecutar simulaciones ni ajustar indicadores para rescatar E1. Conservar solamente el criterio contable de **dilución neta** como posible contexto informativo futuro; **NO** es una feature de producción autorizada ni un nuevo `QUALITY_V2`. Si aparece evidencia independiente de ventaja post-filing neta con instrumentos/tickets realizables, reabrir metodología con nueva fuente y muestras frescas, nunca reciclar 2025.

## 6. Alternativa siguiente E2 — primera refutación en papel antes de desarrollar

No confundir **escisión ordinaria** con **escisión en dos etapas**. El artículo de 2025 `Liquidity spillovers: Evidence from two-step spinoffs`, de Amihud, Huh y Subrahmanyam, estudia **68 eventos entre 1986 y 2017**: una subsidiaria sale primero a bolsa con una minoría y después se distribuye el resto, aumentando el free float. Encuentra CAR positivos **8,31–9,65% entre día 0 y +60** para esas filiales, **después de caída inicial hasta +5**, sin costes de trading ni prueba de NEXT_OPEN EUR. También estudia derrames de liquidez a empresas afines, NO una cartera minorista de escisiones generales. Fuente: https://www.sciencedirect.com/science/article/pii/S1386418125000400 .

Un análisis de **140 escisiones 2010–2022** (tesis de grado Aalto, menor jerarquía probatoria) no encuentra abnormal long-term returns de 36 meses de filiales y matrices: https://aaltodoc.aalto.fi/items/2205e355-7665-4f76-94ff-034354473fd6 .

**Concentración de oportunidades**: 68/32 años ≈ **2,1 eventos de dos etapas/año en esa muestra histórica**, tamaño medio reducido para mantener 13k EUR invertidos de forma diversificada. Por tanto, incluso aunque exista CAR positivo por evento, **no está demostrado que pueda superar indexación global de modo continuado y en el 80% de los años**. La primera comprobación E2 deberá averiguar si existen eventos actuales suficientes, datos de corporate actions **as-of** y una operativa con caja/despliegue compatible; si no, `E2_PAPER_REJECTED` sin code.

**Estado de continuidad**: `E1_PAPER_CLOSED_NO_GO_STANDALONE`; `E2_PAPER_LIQUIDITY_AND_EVENT_FREQUENCY_GATE_NEXT`; `E3_INSIDER_CONTEXT_ONLY`. Todas las rutas de producción permanecen intactas.
