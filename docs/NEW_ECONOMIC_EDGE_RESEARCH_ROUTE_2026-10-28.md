# Custodia · Ruta nueva: ventaja económica verificable (28-10-2026)

**Estado: PAPER_RESEARCH_ONLY. Ninguna pantalla, job, motor, backtest, orden ni cambio de LEGACY autorizado.**
Fuente canónica de arquitectura/estudios consumidos: `fmaranis/Trading/main`, `PROJECT_STATE.md` y `docs/INVESTMENT_EDGE_RESEARCH_LEDGER_AND_NEXT_GATE_2026-10-25.md`.

## 1. Qué cambia y qué NO volveremos a hacer

El objetivo verdadero es **obtener más patrimonio neto después de gastos, spreads, FX e impuestos que invertir el mismo capital/flujos en el índice global**; medir por separado consistencia anual y drawdown. El objetivo aspiracional del usuario (~80% años por encima de índice) no es porcentaje prometido ni licencia para retunear una muestra.

**Cierre definitivo de familias en sus formas probadas:** factor UCITS estático R1 (−464,1056 EUR netos vs 100% EUNL sobre capital 13.000 EUR y 4/9 años), Quality/Slope/Quality allocation bridge, Forward Risk V8–V11 *como políticas económicas*, PEAD analyst-surprise V1, profitability direct-stock, momentum 12–2, sector 52W y TimesFM ya documentados. El poder predictivo de Forward Risk V8 se conserva como información, no se usa para encender/apagar cartera. No construir V12, «insiders V2», nuevas mezclas de ETFs o filtros de gráficos sobre los mismos outcomes.

**Cambio en el orden de trabajo:** literatura independiente + explicación de quién paga la prima -> identidad/fechas de disponibilidad del dato -> costes y tamaño de cartera -> criterio de descarte previo -> sólo entonces UNA hipótesis congelada y su validación en el motor existente. Un candidato que falla el preflight queda `PAPER_REJECTED` sin código. No hay obligación de lanzar siempre un estudio.

## 2. Tres mecanismos reales contrastados (alternativas SECUENCIALES, no tres jobs)

| Candidato | Por qué alguien podría pagar esa rentabilidad | Evidencia favorable y contraria | Bloqueo principal |
| --- | --- | --- | --- |
| **E1 · Recompras de acciones REALMENTE ejecutadas y reducción neta del capital** — primera prioridad de análisis documental | Una sociedad utiliza recursos propios para retirar acciones; si recompra por debajo de su valor y no lo neutralizan emisiones/dilución/deuda, cada acción retenida puede representar más negocio. Se observa un uso de capital, no una figura técnica. | Estudios de 2025 asocian **recompras ejecutadas** a mejores resultados operativos o rendimientos posteriores; otro estudio de 2025 muestra que algunas recompras buscan manipular EPS y el mercado las descuenta. **Asociación publicada no es alfa realizable tras la publicación del 10-Q**. | El mercado conoce compras agregadas con retraso, costes EUR/USD, recompra puede estar financiada con deuda, planes no ejecutados y stock compensation. |
| **E2 · Escisiones (spin-offs) y ventas forzadas de la nueva entidad**, segunda sólo si E1 no pasa | Accionistas del negocio matriz reciben títulos ajenos a sus mandatos; algunos venden por motivos de tamaño, índice o cartera, generando presión transitoria. La señal es un evento y una contraparte real. | Un artículo de *Journal of Financial Markets* (2025) sobre **two-step spin-offs** documenta bajadas iniciales y CAR positivos hasta +60 días del 8,31–9,65% en su muestra específica. Un estudio US más amplio 2010–2022 no encuentra retornos anormales persistentes de 36 meses. No extrapolar a toda escisión. | Identificar la fecha operable, corporate actions, compañías escindidas delistadas, liquidez; el efecto puede ocurrir antes de ejecutar y hay poca frecuencia anual. |
| **E3 · Compras personales discrecionales de insiders (Form 4 código P)**, *observación secundaria*, no producto autónomo de momento | Directivos/consejeros arriesgan dinero propio bajo información específica; compras no rutinarias pueden revelar expectativas sobre negocio. | Datos oficiales SEC estructurados 2006–2026. *Finance Research Letters* 2025: la ventaja por copiar filings disminuye o se vuelve negativa al imponer tamaño de operación razonable, antes de costes totales. Investigación 2025 sobre complejidad contable sugiere que puede existir información diferenciada, pero no acredita que el minorista pueda copiarla. | Costes, iliquidez y reacción pre/post publicación; muchos P incluyen compra privada, no toda transacción es mercado abierto. Distinguir 10b5-1 sólo desde la fecha con disclosure disponible. |

**Fuentes académicas/primarias comprobadas (no son backtests de Custodia):**

E1:
- Actual repurchases y mejores rendimientos futuros: *EPS-motivated share repurchases and wealth transfer*, J. Business Finance & Accounting (2025): https://doi.org/10.1111/jbfa.12826
- Ejecución efectiva y precio: *Equity-based compensation and the timing of share repurchases*, J. Accounting & Economics (2025): https://doi.org/10.1016/j.jacceco.2025.101798
- Contraevidencia por incentivo EPS: *Mandatory disclosures and opportunism: Evidence from repurchases*, J. Accounting & Economics (2025): https://doi.org/10.1016/j.jacceco.2025.101783
- SEC, `Item 703`, tabla **mensual** de recompra en 10-Q/10-K (número, precio medio, compras en programas, capacidad remanente): https://www.law.cornell.edu/cfr/text/17/229.703
- **ATENCIÓN:** la norma nueva de disclosure diario de recompra propuesta/adoptada en 2023 fue **anulada** en diciembre 2023: https://www.sec.gov/rules-regulations/2024/03/s7-21-21 . No inventar que existe serie pública diaria universal.

E2:
- Two-step spin-offs y presión de liquidez: *Liquidity spillovers: Evidence from two-step spinoffs*, Journal of Financial Markets (2025): https://doi.org/10.1016/j.finmar.2025.101000
- Estudio sin retornos anormales largos 2010–2022, tesis Aalto (2023): https://aaltodoc.aalto.fi/items/2205e355-7665-4f76-94ff-034354473fd6
- Efecto del índice S&P 500 en gran parte desaparecido: Greenwood y Sammon, Journal of Finance (2025): https://doi.org/10.1111/jofi.13410 . No confundir escisión con adición/deleción de índice.

E3:
- SEC repositorio oficial **as-filed** Form 3/4/5, ficheros trimestrales enero 2006–septiembre 2026: https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets
- SEC instrucciones: `P` = compra **en mercado o privada**, `M` = ejercicio/convertible, `F` = retención de títulos para pagar impuestos; sólo P no acredita mercado abierto sin leer detalles: https://www.sec.gov/files/form4data.pdf
- *Insider filings as trading signals — Does it pay to be fast?*, Finance Research Letters (2025): https://doi.org/10.1016/j.frl.2024.106514
- *Accounting Reporting Complexity as a Source of Insider Information Advantage*, JBFA (2025): https://doi.org/10.1111/jbfa.12845
- SEC introdujo identificación 10b5-1 en Form 4 en abril de 2023; **no atribuir ese campo retroactivamente**: https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/insider-trading-arrangements-and-related-disclosures

## 3. Realidad española: cuantificar fricción ANTES de invertir en software

MyInvestor publica **acciones 0,12% por orden con mínimo 3 EUR, máximo 25 EUR** y **0,30% por cambio EUR/USD** (más spread y posibles tasas reales): https://myinvestor.es/inversion/broker/ .

Ejemplo aritmético de **una ida y vuelta** en acciones EEUU, con divisa convertida en compra y venta, **sin spread, impacto, impuestos ni deslizamiento**:
- Ticket 1.300 EUR: coste compra/venta `2×3 / 1300 = 0,4615%` más `2×0,30%=0,60%`; **≈1,0615%** del ticket, mínimo aproximado, antes de precio de salida real.
- Ticket 2.600 EUR: comisiones `2×3,12 / 2600 = 0,24%`, más `0,60%`; **≈0,84%**.
- El tipo de cambio puede evitarse por operación usando cuenta USD, pero el coste/condiciones concretas de compra/conversión siguen necesitando verificación; **no** aplicar FX por duplicado. Estas son aproximaciones de entrada/salida al mismo nocional para decisión de viabilidad, no costes exactos de una operación real.

Si la supuesta prima mensual o a tres meses es del mismo orden, **STOP antes de implementar**. El hecho de que el 2025 académico observe alpha bruto no garantiza que sobreviva el broker, FX o impuestos. Acceso a los ISIN/tickers concretos debe verificarse antes de declarar ejecutabilidad.

## 4. ÚNICA primera investigación a realizar: E1 — auditoría documental de recompras ejecutadas

**No abrir precios futuros ni equity outcomes en esta fase.** El producto inmediato es **un informe corto de viabilidad con evidencia inspectable**, no software.

1. **Contrastar acceso y semántica**: revisar informes 10-Q/10-K de emisores de varios tamaños, seleccionados por criterios independientes de sus rentabilidades. Confirmar `Item 703`, números de títulos efectivamente retirados, valoración, fechas de publicación EDGAR, modificaciones y si aparecen emisiones simultáneas/stock-based compensation. Diferenciar programa anunciado, ejecución mensual, cambio neto de acciones y recompra para sostener EPS. **El indicador bruto no puede ser una sola noticia sobre recompra.**
2. **Causalidad del dato**: fecha de decisión = **posterior a aceptación/publicación EDGAR del filing**, con margen observable y orden `NEXT_OPEN`; el fin del trimestre nunca es señal operable. Registros as-filed, filing IDs, versión, correcciones, CIK+clase/ticker point-in-time. SEC limita acceso automatizado y requiere User-Agent identificable: https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data . El proyecto documentó anteriormente ausencia de `SEC_EDGAR_USER_AGENT`; esta ruta no implica prometer capturas automáticas hasta comprobar la configuración.
3. **Comprobar qué significa económicamente**: una recompra sólo tiene sentido si puede generar **reducción neta de acciones** y no se anula por emisiones, precio pagado excesivo, deuda, recortes de inversión o compensaciones. Estos datos necesitan procedencia PIT; no usar Yahoo current discovery para reconstruir universo histórico. Revisar si se trata de versión renombrada de profitability/quality/valuation, y exigir evidencia incremental fuera de esa familia.
4. **Criterio de STOP ANTES del replay**: `PAPER_REJECTED` si disclosure tardío, falta de datos PIT de acciones/emisiones, incidencia elevada de registros no conciliables, instrumentos no negociables o prima bruta publicada demasiado pequeña para fricciones realistas. No ajustar ventanas por outcomes que ya conocemos.
5. **Si el mecanismo y datos superan el veto**: definir UNA política, capital, tamaño de órdenes, ventana, benchmark EUNL en EUR, mercado de valores EEUU/FX, comisiones, caja, impuestos, riesgo, universo PIT con delistings y controles sector/tamaño/calidad. Congelar **antes** de resultados. Integrar como research/shadow en la cadena `AssetUniverseScanner → PortfolioCandidateGate → InvestmentDecisionEngine → PortfolioDecisionEngine/evaluatePortfolioDecision → replay`, sin motor independiente. Ejecutar guard/TypeScript antes del cálculo y solo desde `ResearchValidationCenter` cuando esté listo. Histórico inspeccionado sirve para diagnóstico y no promoción; confirmación fresh prospectiva.
6. **Si E1 se descarta en papel**, sin ejecutar código ni reconsiderar los umbrales, pasar a la auditoría documental de **E2 spin-offs**, no a afinar insider clusters. E3 permanece observación contextual hasta que aparezca evidencia independiente económica clara.

## 5. Regla de esfuerzo / evidencia que debe aportarnos IA

**No se autoriza programación automática porque un paper encuentre alfa.** Para cada mecanismo, exigir una respuesta cuantificada o declaración de `NO_DATA` a estas seis preguntas:

- **Quién paga:** ¿qué actor vende/comete un error estructuralmente y por qué no puede eliminarlo un arbitrajista?
- **Cuándo se sabe:** timestamp accesible al minorista; ejecución nunca anterior.
- **Qué compra realmente Custodia:** activo elegible, profundidad, precio/FX/whole shares, emisión/delisting/sector.
- **Cuánto queda después de costes:** benchmark en EUR con mismos flujos, FX, cash remunerado e impuestos; pérdidas y cola de retornos.
- **Qué tendría que fallar:** hipótesis falsable sin elegir sobre los mismos returns.
- **Qué no sabemos todavía:** calidad y alcance del universo histórico, survivorship, muestra consumida, validez prospectiva y nula garantía de 80%.

**Decisión del 28-10:** `E1_PAPER_SOURCE_FEASIBILITY_OPEN`; `E2_BACKUP_PAPER_ONLY`; `E3_CONTEXT_ONLY_HIGH_IMPLEMENTATION_FRICTION`. **Hoy no se inicia ningún replay, no se altera ningún producto.** Este documento sustituye la prioridad antigua del ETF factorial, cerrada `FAIL_DIAGNOSTIC` en `docs/STATIC_UCITS_FACTOR_ECONOMIC_R1_RESULT_REVIEW_2026-10-28.md`.


## 6. Primera comprobación real de expedientes SEC (sin precios/outcomes)

Ya se ha iniciado la auditoría documental de **existencia y significado del dato** sobre dos documentos 10-K reales. Estos casos son **ejemplos no aleatorizados de esquema**, NO un muestreo de rentabilidad, ni sirven para inferir alpha, frecuencia o selección de activos:

- **Alphabet, 10-K FY2025** `CIK 1652044`, `accession 000165204426000018`: en el último trimestre 2025 publicó compras **20,240 miles de acciones** A/C en total (Oct **14,146 miles**, Nov **6,094 miles**, Dic **0**), pese a grandes autorizaciones agregadas. **Primera lección tangible**: una autorización de recompra y una recompra efectivamente ejecutada NO son equivalentes, y no hay por qué asumir compras continuadas. Fuente original HTML SEC: https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm
- **Palantir, 10-K FY2025** `CIK 1321655`, `accession 000132165526000011`: informó **106.171 acciones** recompradas en Q4 (oct 37.533, nov 32.630, dic 36.008) bajo su programa; declaró que el programa se **terminó en enero 2026**. **Segunda lección**: la actividad debe relacionarse con fechas de publicación, vigencia/terminación y denominador de shares outstanding, no sólo número nominal. Fuente SEC: https://www.sec.gov/Archives/edgar/data/1321655/000132165526000011/pltr-20251231.htm

**Aún NO verificado**: hora de aceptación EDGAR de ambos acccesions, cifra de dilución neta, retorno posterior, sesgo de selección, aptitud de compra MyInvestor y cobertura PIT del universo histórico. Nada de esto debe reconstruirse por suposición ni extrapolarse desde estos dos casos. Siguiente tarea en papel: documentar un método de muestreo **definido sin observar rentabilidades**, y establecer cómo medir neto de emisión/compras de forma causal. Estado `E1_DOCUMENT_SCHEMA_OBSERVED_PAPER_SOURCE_GATE_OPEN`.
