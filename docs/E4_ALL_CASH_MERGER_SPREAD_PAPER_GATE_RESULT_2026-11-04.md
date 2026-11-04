# Custodia · E4: descuentos contractuales de adquisiciones en efectivo — auditoría económica en papel

**4 de noviembre de 2026 — decisión `E4_NO_GO_STANDALONE_FOR_CUSTODIA_13K_ON_PRESENT_EVIDENCE`.** La semántica de eventos y la diferencia observable mercado–oferta **sí se pueden documentar**, pero no existe evidencia aquí de ventaja neta frente a EUNL para un minorista con 13.000 EUR. **No se abre replay, código, job ni nueva pantalla. `LEGACY` intacto.**

Fuente de trabajo: `docs/NEW_ECONOMIC_EDGE_RESEARCH_ROUTE_2026-10-28.md` §8. E1 (recompras) y E2 (escisiones two-step) ya cerrados: **no repetirlos**. No convertir un ejemplo vivo de arbitraje en recomendación de compra ni una oportunidad posterior en holdout fresh.

## 1. Qué se conoce en fecha pública y qué se paga

- Un acuerdo de compra de **todas las acciones por efectivo fijo** permite conocer una contraprestación contractual **sujeta al cierre**. No obliga al mercado a asegurar la operación. Rentabilidad bruta condicionada al éxito: `G = (precio_oferta_efectivo / precio_compra_post_publicación) - 1`. El riesgo incluye plazo, financiador, accionistas, reguladores, apelaciones, cambios contractuales y precio al que cotizaría la empresa si se rompe la transacción.
- La literatura académica sobre **risk arbitrage** no lo trata como arbitraje sin riesgo: Mitchell y Pulvino (2001), 4.750 acuerdos 1963–1998, encuentran cola negativa severa y mayor correlación con el mercado cuando este cae; la diferencia a otros estudios se explica sustancialmente por los costes. Es una **prima por asumir riesgo**, no evidencia de ventaja informativa privada para Custodia. Fuente: https://www.aqr.com/insights/research/journal-article/characteristics-of-risk-and-return-in-risk-arbitrage .
- No se usan precios **anteriores al anuncio** como precios disponibles para la estrategia. Los siguientes son cierres completos de **2026-11-03**, obtenidos de fuentes públicas y no del backend; no se ha auditado ejecución al `NEXT_OPEN`, tick bid-ask, horario de publicación ni disponibilidad MyInvestor por ticker.

## 2. Dos casos comparables con diferencia positiva — cribado de fricción, no oportunidades recomendadas

| Contrato en fuente primaria | Cierre mercado 2026-11-03 | Brecha bruta si se cierra | Riesgo pendiente |
| --- | --- | --- | --- |
| **MISTRAS / MG**, H.I.G. Capital: **20,35 USD cash/acción**, acuerdo 2026-09-17, anunciado 2026-09-18 | **20,18 USD** NYSE | **0,8424%** = 0,17 USD/acción | Voto accionistas, financiación/cierre; el go-shop venció 2026-10-27 sin propuestas rivales, NO garantiza cierre |
| **Synaptics / SYNA**, onsemi: contrato **modificado 2026-10-01** a **123 USD cash/acción** (la versión anterior era diferente) | **117,41 USD** Nasdaq | **4,7611%** = 5,59 USD/acción | Accionistas, aprobaciones regulatorias internacionales, tiempo hasta cierre previsto mediados de 2027, riesgo de ruptura y nueva revisión |

**Fuentes contrastadas:**
- MG anuncio contractual SEC DEFA14A: https://www.sec.gov/Archives/edgar/data/1436126/000114036126037117/ef20082419_defa14a.htm .
- MG expiración de go-shop SEC (28-10-2026): https://www.sec.gov/Archives/edgar/data/1436126/000114036126041054/ef20084511_ex99-1.htm .
- MG cotizaciones históricas 03-11-2026: https://stockanalysis.com/stocks/mg/history/ . Pueden variar si el proveedor revisa precios; éste es el snapshot documental anotado.
- SYNA acuerdo revisado y condiciones, 8-K y proxy SEC: https://www.sec.gov/Archives/edgar/data/1097864/000109786426000021/on-20261002.htm y https://www.sec.gov/Archives/edgar/data/817720/000114036126039983/ny20081083x2_defm14a.htm .
- SYNA precio histórico 03-11-2026: https://stockanalysis.com/stocks/syna/history/ . No utilizar el precio de 100,79 USD de **29-09-2026** que figura en proxy para medir el spread post-anuncio del 4-11: era referencia de otra fecha y antes de la revisión.

**Excluir contratos con contingencias en la contraprestación**: SoundThinking / SSTI: 8 USD efectivo + **un CVR no transferible de hasta 3 USD**, sujeto a hitos, no equivale a 11 USD efectivos ciertos. SEC: https://www.sec.gov/Archives/edgar/data/1351636/000114036126040176/ny20082824x1_exa1a.htm .

## 3. Tamaño de las operaciones: el coste puede absorber el spread

Comisión pública de MyInvestor para **acciones**: 0,12%/orden, mínimo 3 EUR, máximo 25 EUR, más 0,30% por cada conversión EUR/USD efectiva y diferencial bid-ask y cánones. No aplicar cambio de divisa dos veces si se retiene saldo en USD; tampoco suponer sin verificar que liquidación corporativa cobra idéntica comisión a una venta de mercado. https://myinvestor.es/inversion/broker/ .

**Cálculo ilustrativo, no operación real ni cotización EUR/USD;** usa misma base nominal entrada y salida y cobro en efectivo en la fecha prevista, más dos conversiones FX en el supuesto:

| Ticket EUR | Coste aproximado de orden+FX ida/vuelta | MG: beneficio si cierra al precio pactado, antes del resto | SYNA: beneficio si cierra al precio pactado, antes del resto |
| ---: | ---: | ---: | ---: |
| 1.300 | **13,80 EUR (1,0615%)** | 10,95 EUR bruto → **−2,85 EUR** después de fricción ilustrativa | 61,89 EUR bruto → **48,09 EUR** después de fricción ilustrativa |
| 2.600 | **21,84 EUR (0,84%)** | 21,90 EUR bruto → **0,06 EUR** después de fricción ilustrativa | 123,79 EUR bruto → **101,95 EUR** después de fricción ilustrativa |

Estas diferencias **presuponen que el acuerdo se cierra exactamente como se anunció**, que la posición se puede comprar al cierre de 03-11 (no ejecutable retroactivamente), y **NO** incluyen el riesgo de fracaso, plazo, intereses sobre cash alternativo, impuestos, slippage, horquilla real, dividendos, FX de mercado ni el tratamiento real de la contraprestación en bróker. No son retornos esperados ni oportunidades detectadas por Custodia.

En la cartera de 13.000 EUR, un ticket de 1.300 EUR concentra el **10%** en un único evento; una pérdida fuerte por ruptura puede borrar el pequeño beneficio de varios cierres. El resto del patrimonio debe estar explícitamente invertido en EUNL o en cash remunerado, y cualquier venta del índice para financiar la posición genera impuestos y coste de oportunidad. No asumir rotación continua ni dinero creado por review cadence.

## 4. La cola de pérdida no es hipotética como fenómeno (aunque el escenario exacto sí lo sea)

**Capri / Tapestry** firmaron una adquisición en efectivo anunciada en 2023; la **FTC** obtuvo medidas judiciales para impedirla y ambas partes rescindieron el acuerdo el **13-11-2024**. El 8-K de Capri confirma la terminación y reembolso de ~45 millones USD de gastos **a la empresa**, no compensación personal a quienes habían comprado sus acciones esperando el cierre. Fuentes SEC https://www.sec.gov/Archives/edgar/data/1530721/000119312524258691/d841802d8k.htm y FTC https://www.ftc.gov/legal-library/browse/cases-proceedings/231-0133-tapestry-inccapri-holdings-limited-matter . El ejemplo fue elegido como comprobación de **riesgo de no cierre**, no como muestra para calibrar `breakPrice`.

**Ecuación de riesgo imprescindible antes de hablar de rentabilidad esperada:** precio compra tras anuncio `P`, pago cash condicionado al cierre `O`, valor **no observado anticipadamente** si el trato se rompe `B`, costes `C` por acción, probabilidad de cierre `p`. Umbral sin intereses/impuestos/coste oportunidad: `p_min = (P + C - B) / (O - B)` si `O>B`. No interpretar `p` como frecuencia histórica de cierres ni estimarla a partir del tamaño del spread sin un modelo independiente.

Ejemplo estrictamente **hipotético**: `O=20`, `P=19`, `B=14`, `C=0,20 USD/acción` -> **p_min ≈86,67%**, solo para que la expectativa no sea negativa **antes de competir con EUNL o cash**. Una probabilidad alta no convierte por sí sola la operación en atractiva frente a mantener la cartera.

## 5. Decisión de puerta y qué tendría que cambiar para reabrir E4

| Gate | Estado verificable al 04-11-2026 |
| --- | --- |
| Contrato fijo en cash, ISIN/ticker, fuente y revisión de términos | **PASS_DOCUMENTAL** en MG/SYNA; SSTI excluido por CVR |
| Precio *después* del anuncio (no premio preanuncio) | **PASS_DOCUMENTAL** con 2 cierres 03-11, **NO** ejecución NEXT_OPEN |
| Un spread positivo supera por sí mismo fricciones de 1.300 EUR | **FAIL** en MG (~0,84% vs ~1,06% fricción simplificada) |
| Existe margen bruto tras coste ilustrativo en otro acuerdo | **CONDICIONAL** en SYNA (~4,76% vs ~1,06%) pero sujeto a meses de espera y pérdida por ruptura |
| Estimación de probabilidad de cierre y `breakPrice` defendibles as-of | **NO_DATA** |
| Universo point-in-time exhaustivo con cancelaciones, acuerdos revisados, CVR y delistings | **NO_DATA** |
| Elegibilidad exacta por valores en MyInvestor, cierre corporativo y tratamiento fiscal/FX | **NO VERIFICADO** |
| Evidencia fresh neta superior a EUNL con iguales flujos, riesgo, cash y 80% años | **NO DEMOSTRADO** |

**Veredicto:** `E4_NO_GO_STANDALONE_FOR_CUSTODIA_13K_ON_PRESENT_EVIDENCE`. No se cumple el filtro de valor esperado neto y riesgo defendible para crear un módulo/producto, aunque sí existe un mercado con primas por soportar riesgo de cierre. La rentabilidad académica de merger arbitrage no demuestra alfa minorista contemporáneo frente a un índice global; con poco capital se añaden tickets mínimos, FX y concentración.

**No desarrollar un detector de spreads, no lanzar un replay de capital fijo ni inventar probabilidades de éxito por confianza verbal.** Tampoco declarar que el mecanismo económico es falso o que toda adquisición en efectivo fracasa. La señal observable puede conservarse como contexto de riesgo de posiciones existentes (p.ej., no confundir rebote limitado a oferta con una oportunidad de crecimiento ilimitada), sin convertirlo en una política de Custodia.

Para reabrir serían requisitos nuevos **independientes**: fuente PIT completa de operaciones anunciadas y finalmente canceladas, `p` y `B` estimables sin información futura, evidencia de rentabilidad después de ejecución/financiación/FX/tax y contratos por importe negociable con bajo coste. Los dos ejemplos contemporáneos de este documento no deben servir después para retunear un modelo de riesgo.

**Siguiente trabajo de IA recomendado**: dejar de perseguir oportunidades bursátiles nuevas sólo porque sean interesantes sobre el papel. La revisión cruzada E1/E2/E4 revela un patrón: fuentes que muestran primas/ineficiencias **brutas** pero no una ventaja neta defendible por un inversor individual de 13.000 EUR con requisitos de 80% de años mejores que EUNL. Antes de abrir otra familia, evaluar y cuantificar *la frontera de rentabilidad realmente necesaria para superar EUNL después de riesgo, rotación, impuestos y tamaño de ticket*, y decidir si una estrategia complementaria puede siquiera mover el patrimonio lo suficiente. Esto es investigación económica de restricciones del usuario, no otra versión de los motores anteriores.
