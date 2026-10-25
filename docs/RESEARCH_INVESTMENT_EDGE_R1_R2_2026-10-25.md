# Custodia — R1/R2: primera investigación económica y decisión sobre el experimento inicial

Fecha: 2026-10-25  
Estado: **RESEARCH SCOPING + AUDITORÍA READ-ONLY REALIZADA / SIN ALFA DEMOSTRADA**  
Canon: `fmaranis/Trading/main` · `PROJECT_STATE.md` · `docs/DECISION_FIRST_EXECUTION_PLAN_2026-10-25.md`

## RECTIFICACIÓN CANÓNICA — 2026-10-25: investigación previa verificada

**Estado de este documento: SUPERSEDED_AS_NEW_RESEARCH.** Tras consultar **todo** el historial relevante de `PROJECT_STATE.md` y `docs/OPPORTUNITY_ALPHA_RESEARCH_2026-09-24.md`, la pretendida hipótesis novedosa `H-CORE-OPPORTUNITY` **repite el mismo núcleo decisional** de investigaciones anteriores, por lo que **se retira como prioridad de experimentación**. Las secciones originales inferiores quedan como registro de cómo se detectó el error, no como una autorización de ejecución.

Investigaciones ya realizadas y **no reabribles mediante retuning sobre sus muestras**:

1. **Enrutamiento inmediato tras EXIT/REDUCE frente al structural core** (2026-09-24): 15 episodios evaluables; 9/15 mejor que core a ~6 meses; exceso ponderado +38,5 EUR sobre ~7.515 EUR de capital desviado (~0,51% bruto), dispersión alta; `ARCHIVED / NO IMPLEMENTATION`. `CORE_RELATIVE_LEADERSHIP_RESEARCH_V1` (2026-09-25) comprobó slopes 20/60, aceleración y ENTRY_STRONG sobre esos 15 episodios; evidencia insuficiente, `ARCHIVED`.
2. **Momentum 12–2 meses, long-only winner decile, revisión mensual** (`CORE_OUTPERFORMANCE_MOMENTUM_REFERENCE_V1`, 2026-09-27): CAGR candidato 16,6797%, US parent 17,5161%, URTH 14,2209%; `FAIL_DIAGNOSTIC / STOP_PRIMARY_REPLICA_NO_VARIANTS`. Resultado contrastado desde caché; confirmación reservada no abierta.
3. **Liderazgo sectorial 52-week high** (`SECTOR_52W_HIGH_LEADERSHIP_V1`, 2026-09-28, rev. técnica R3): CAGR candidato neto de modelado 20 pb/lado 10,1157%, SPY 11,3116%, basket9 10,2581%; `FAIL_DIAGNOSTIC`, replicación no abierta, sin V2 paramétrica.
4. **Operating Profitability**: señal académica `OPERATING_PROFITABILITY_DECILE_10_VW` mantiene `PASS_CONFIRMATION_SIGNAL_ONLY` (dos ventanas), **pero la traducción stock-level PIT `CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2` terminó el 2026-10-07 `FAIL_ACTIONABLE_TRANSLATION`**: candidato CAGR bruto 12,6832%, SPY 17,5698%, URTH 14,9861%, bate SPY 0/5 y URTH 1/5, `STOP_TRANSLATION_NO_RETUNING`. NO seguir describiendo Stage C1 como meramente bloqueada por User-Agent: aquella era una situación **anterior** ya resuelta para R2.
5. **Quality × valoración:** `VALUATION_AWARE_QUALITY` quedó `PROMISING_DIAGNOSTIC`, la evidencia reportada amplia obtuvo FAIL de alfa y auditoría PIT incompleta; R2 parcialmente abierta/consumida, no holdout fresh.
6. **PEAD Analyst Surprise V1** (2026-10-07): 455/470 outcomes válidos, Spearman ~0,00559 (p ~0,365), Q5 exceso medio -0,3395%, hit-rate de exceso ~46,15%; `FAIL_SIGNAL_DIAGNOSTIC_NO_POLICY`, `ARCHIVED`. No retunearlo con 2024-01→03.
7. **TimesFM relative rank/economía** (2026-10): 15/15 escenarios sin alterar operaciones de `LEGACY`, `NO_ECONOMIC_REACH`. Otras variantes económicas también cerradas/no promovidas.

**Corrección al desarrollo efectuado el 2026-10-25:** se añadió a `dynamicHistoricalReplayCore.ts` una traza opt-in de momentum120/core, propuestas de cash y un test sin ejecutar, presentada como primer paso H-CORE. **Se ha revertido exactamente el archivo del replay a su blob anterior** y borrado el test nuevo. Era una duplicación metodológica que no acreditaba una pregunta nueva; además su guard no había pasado pruebas runtime. No creó un resultado económico; no se ha reabierto ninguna muestra.

**Siguiente paso válido:** antes de elegir otra hipótesis y programarla, producir un **inventario antirrepetición** de líneas ya cerradas, evidencia conservada/consumida, huecos que son únicamente de datos, y posibles hipótesis *materialmente ortogonales*. Para cada propuesta, exigir una diferencia económica explícita respecto a los experimentos anteriores; si no se puede explicar, `DUPLICATE_STOP`. El próximo trabajo debe partir de evidencia histórica verificada, no de literatura genérica presentada como hallazgo nuevo. Producción `LEGACY` intacta, Kronos aparcado.

Fuentes internas de autoridad: `PROJECT_STATE.md` (secciones 12–13, desarrollo 2026-10-07), `docs/OPPORTUNITY_ALPHA_RESEARCH_2026-09-24.md`, `docs/CORE_OUTPERFORMANCE_RESEARCH_PLAN_2026-09-27.md`, `docs/CORE_OUTPERFORMANCE_PROFITABILITY_V1_EXECUTION_2026-09-27.md`, `docs/CORE_OUTPERFORMANCE_PROFITABILITY_EXUS_GENERALIZATION_V1_EXECUTION_2026-09-27.md` y los resultados `validation-runs/diagnostics/*` allí referenciados.

---

## Pregunta del proyecto

**¿Cuándo tiene justificación económica invertir un euro adicional en una oportunidad en lugar de mantenerlo en el núcleo global indexado?** Y, si el dinero ya está invertido, ¿qué evidencia justificaría la venta/traspaso de una posición para financiar esa oportunidad **después** de costes, impuestos, riesgo y las pérdidas potenciales de no mantener el core?

No buscamos una estrategia con muchas operaciones ni la mayor tasa bruta de acierto. Buscamos patrimonio terminal neto y robustez superiores al core con una cadena causal única.

## 1. Estado técnico REAL de Custodia

Comprobado en el HEAD de `main` del 2026-10-25:

- `src/investment/decision/assetUniverseScanner.ts`: scanner de momentum absoluto **20/60/120 sesiones**, con score penalizado por riesgo/volatilidad; `src/investment/decision/assetSelectionQuality.ts` ya calcula persistencia, drawdown y score de oportunidad. No ganaremos nada creando «Momentum V2» que replique lo existente.
- `src/investment/decision/portfolioCandidateGate.ts`: ranking `LEGACY`, `QUALITY_V1` y `SLOPE_V1` opcionales; `QUALITY` y `SLOPE` no tienen autoridad productiva. Existen señales de timing y consenso.
- `src/investment/decision/portfolioDecisionEngine.ts`: la prioridad de nuevas oportunidades pondera `excessVsCashPctPoints`, consenso y volatilidad. También hay posiciones actuales y `DYNAMIC_CORE_SELECTOR_V1`; no afirmar que el core esté ausente del motor.
- `src/investment/decision/portfolioAssetRole.ts`: el núcleo de crecimiento estratégico se identifica explícitamente; su selección real no es una prioridad fija, sino `DYNAMIC_CORE_SELECTOR_V1`.
- `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`: shortlist **dinámica actual** Top64. Yahoo discovery actual **no** reconstruye un universo historical point-in-time; persistirá survivorship hasta disponer de un master histórico válido.
- `docs/ECONOMIC_VALIDATION_PROTOCOL_V1.md`: no retune sobre datos consumidos; benchmark con los mismos flujos/capital; `NEXT_OPEN`, cash BCE, costes e impuestos causales.
- `PROJECT_STATE.md`: previous `QUALITY_V1/SLOPE_V1` sin evidencia de promoción; `QUALITY_ALLOCATION_BRIDGE_V1` tenía reach limitado porque el allocator carecía de capital nuevo libre. Riesgo V8 con señal predictiva útil no equivale a éxito económico de V8-V11.

### Hallazgo matemático esencial

Si dos activos se comparan el mismo día y mismo horizonte con un core de retorno común `r_core`, ordenar por `r_asset - r_core` produce **exactamente el mismo ranking que ordenar por `r_asset`**. El retorno relativo compuesto `(1 + r_asset)/(1 + r_core) - 1` también preserva ese orden si el benchmark es idéntico y su retorno > -100%.

**Consecuencia:** un ranking de precios con «core relativo» puede ser sólo una transformación de nuestro momentum. El valor diferencial debe venir de alguna de estas cuestiones verificables: (i) el hurdle para decidir **core o satélite**, (ii) persistencia y horizontes temporales con resultados predictivos, (iii) un ajuste causal de riesgo o (iv) información adicional verdaderamente nueva —beneficios, valoración, etc.—. No presentar un cambio nominal como una estrategia innovadora.

## 2. Evidencia académica contrastada (externa, no evidencia de Custodia)

| Línea | Resultados publicados | Limitación relevante |
| --- | --- | --- |
| Momentum | Jegadeesh y Titman (1993) hallan persistencia del retorno relativo de ganadores en horizontes de 3–12 meses. | La prima de estrategias de factores, muchas veces long-short, no demuestra que una cartera europea long-only supere un fondo global tras impuestos. |
| Valor + momentum | Asness, Moskowitz y Pedersen (2013) documentan primas de valor y momentum en distintos mercados/activos y correlación negativa entre ambas. | Diversificación de factores no implica una regla óptima ni alfa neta para Custodia; ninguna calibración puede importarse sin prueba causal. |
| Calidad y valoración | Novy-Marx (2013) encuentra poder explicativo de la rentabilidad bruta sobre activos; Fama–French (2015) encuentran relevancia de rentabilidad e inversión en un modelo de cinco factores. | En acciones históricas se necesitan fundamentales `filed <= informationDate`, precio/acciones/divisa correctos y universo PIT; cobertura de hoy no basta. |
| Riesgo de momentum | Daniel y Moskowitz (2016) documentan *momentum crashes* en pánicos y rebotes, incluso cuando el factor funciona de media. | Una protección mecánica ante caídas puede ser peor que mantener en una recuperación rápida. |
| Riesgo de sobreajuste | McLean y Pontiff (2016), 97 predictores: medias de cartera 26% más bajas OOS y 58% más bajas tras publicación. | El artículo no cuantifica la caída esperable específica de nuestra estrategia. Las muestras ya inspeccionadas no pueden promocionar. |
| Automatización ML | Microsoft Qlib proporciona benchmark reproducible LightGBM, métricas IC/RankIC y backtests. | Sus benchmarks usan otros mercados/datos, no la cartera de Custodia. Modelos grandes no equivalen necesariamente a ventaja neta. |

**Fuentes primarias:**

- Jegadeesh–Titman 1993: https://doi.org/10.1111/j.1540-6261.1993.tb04702.x
- Asness–Moskowitz–Pedersen 2013: https://www.aqr.com/Insights/Research/Journal-Article/Value-and-Momentum-Everywhere
- Novy-Marx 2013: https://www.nber.org/papers/w15940
- Fama–French 2015: https://doi.org/10.1016/j.jfineco.2014.10.010
- Daniel–Moskowitz 2016: https://www.nber.org/papers/w20439
- McLean–Pontiff 2016: https://doi.org/10.1111/jofi.12365
- Qlib oficial y ejemplos: https://github.com/microsoft/qlib

Se distinguen **publicaciones externas**, **hechos auditados de nuestro motor** e **hipótesis propuestas**. Nada de ello certifica alfa de Custodia.

## 3. Primera auditoría económica nueva: margen efectivo de capital (muestra consumida)

Artefacto reproducible: `replay-results/validation-runs/diagnostics/investment-pivot-reach-audit-2019-2022-v1.json`.

Origen leído sin generar un replay nuevo: `replay-results/validation-runs/latest-chatgpt.json`, exportación publicada el 2026-09-11 de 2019-01-01 a 2022-12-30, capital inicial **13.000 €**. Ésta es una **muestra CONSUMED para diagnósticos**, NO para promoción.

Datos directamente calculados de las 1.028 filas diarias con régimen distinto de `PRE_DECISION`:

| Año | Filas | Cash medio / equity |
| --- | ---: | ---: |
| 2019 | 256 | 20,37% (incluye meses de entrada desde 100% cash) |
| 2020 | 257 | 4,90% |
| 2021 | 258 | 3,97% |
| 2022 | 257 | 3,50% |

Desde **2019-04-01**, 0 de 965 filas observadas supera el 20% cash/equity. La cartera comprometió ~93,50% del capital inicial a la sesión 60. De sus **18 operaciones ejecutadas**, hubo 7 BUY, 7 ADD y 4 EXIT. La posición Vanguard Global explica **4.077,30 €** de los 4.572,29 € de beneficio neto total reportado; que concentre ese beneficio **NO** es una contribución contrafactual. El resultado global fue **17.572,29 €** frente a **20.365,50 €** del benchmark structural core, brecha de **−2.793,21 €**. Esta diferencia no demuestra que una alternativa concreta hubiera ganado 2.793 € más.

**Diagnóstico:** con este perfil operativo, mejorar el ranking exclusivamente sobre efectivo disponible podría tener poco alcance incremental. Estudiar un cambio de selección **sin estudiar el coste de oportunidad de mantener el core y su eventual sustitución parcial** deja el problema principal sin resolver. Aun así, que no haya cash libre NO autoriza automáticamente rotar desde el núcleo.

## 4. Priorización de hipótesis económicas NUEVAS

| Prioridad | Hipótesis | Viabilidad causal/coste | Riesgo de resultado engañoso |
| --- | --- | --- | --- |
| **1** | **H-CORE-OPPORTUNITY:** elegir entre mantener core y financiar una exposición satélite cuando existe información incremental con ventaja neta y capacidad de ejecución. | Herramientas de cartera, core, replay y precios ya integrados. Falta cuantificar reach real y cobertura PIT para el universo evaluado. | **Alto** si se vende el core en retrospectiva al conocer qué satélites ganaron; evitarlo con política preregistrada/holdout. |
| 2 | Calidad/profitabilidad × valoración como señal diferencial respecto a precio pasado. | Fundamentos académicos sólidos, pero SEC EDGAR y otros fundamentales deben llevar fechas efectivas de publicación y master histórico; no hay cobertura PIT completa certificada. | **Muy alto** si se rellena historia con fundamentals de hoy o sólo supervivientes. |
| 3 | Ranking ML ligero (LightGBM) para valor añadido de features mixtas. | Requiere panel amplio y limpio con outcomes independent, buena cobertura PIT y control de train/validation/test por fecha; **NO** prioridad inicial. | **Muy alto** por fuga de datos y aprendizaje de artefactos del catálogo. |
| 4 | Modelos de secuencias TimesFM/Kronos o V8 como contexto. | Datos/cutoff y costes de inferencia; los FAIL económicos previos no recomiendan autoridad. | No cambiar el rumbo hacia más cómputo pesado. |

### Decisión metodológica R1

Elegir **H-CORE-OPPORTUNITY** para especificación técnica *research-only*, no para producción. Su novedad no es la palabra momentum: es exigir rentabilidad esperada **frente a la alternativa concreta de mantener el core**, considerando el capital ya invertido y su coste fiscal/de transacción. Calidad/valoración queda como segunda investigación formal condicionada por master PIT.

## 5. Qué experimento H-CORE-OPPORTUNITY sería falsable

Separar estrictamente:

**A. Calidad de señal (sin órdenes ni ventas):**

- A cada fecha de decisión, comparar la serie de un candidato y la del core usando datos disponibles **hasta esa fecha**, misma moneda, tratamiento de dividendos/ajustes, y lag explícito para NAV de fondos.
- Familia inicial no ajustada con outcomes: *momentum académico intermedio* aproximado 12–1 meses (252 a 21 sesiones anteriores a la decisión), comparado con el retorno correspondiente del core; analizar también el score actual `LEGACY` y comprobar si la nueva medición ofrece alguna información **incremental**, no sólo ranking idéntico.
- Outcome de señal separado: exceso de retorno futuro del candidato frente al core a un horizonte previamente declarado, sujeto a calendarios/ejecución posterior a señal. Evaluar RankIC/IC, cobertura, incertidumbre y estabilidad cronológica. **El número de sesiones y los criterios de evaluación se congelan antes de abrir confirmación OOS**.
- Ante falta de serie core/candidato comparable, `UNAVAILABLE`. No interpolar resultados con lookahead, no usar Yahoo *current universe discovery* para reconstruir empresas pasadas, no ocultar instrumentos delistados. Casos con survivorship se marcan **diagnósticos condicionados**.

**B. Calidad de la política económica (UNA alternativa, replay único):**

- Control A=`LEGACY` real y control pasivo con un core compatible con los mismos `externalCashFlows`.
- Política candidata B, una vez redactada y congelada ex ante, sólo puede cambiar una decisión sobre `core vs satélite` para capital realmente disponible, o justificar una rotación que incluya explícitamente coste, impuesto y riesgo de permanencia fuera del core.
- Conservar `NEXT_OPEN` y todas las invariantes del replay, medir órdenes **distintas** entre A/B, valor terminal neto y drawdown, costes fiscales, exposición, retornos sacrificados en rebotes y reach. No usar como benchmark un core incapaz de recibir los mismos flujos.
- El estudio 2019–2022 ya consumido es sólo un ensayo diagnóstico para detectar faltas de datos, incompatibilidades e instrumentación. **No entrenar/ajustar política sobre él y presentarla como éxito.**
- Bloqueo de promoción hasta inventario PIT suficiente, freeze explícito y holdout verdaderamente fresco. Si el holdout disponible no alcanza decisiones ejecutables, marcar `INCONCLUSIVE_INSUFFICIENT_REACH`.

## 6. Tarea técnica siguiente, sin trabajo del usuario

1. Revisar en la cadena existente dónde se conservan exactamente por fecha `candidate`, `core`, `cash`, `cost`, `tax` y `available-to-rotate capital`; cuantificar cobertura del core en `AssetUniverseScanResult` y trazas de `DynamicHistoricalReplayCore`.
2. Preparar **un diagnóstico research-only** de `core-vs-satellite` dentro del flujo/resultado de replay actual: evidencia y decisiones que cambian; no crear pantalla, motor, job largo ni gate productivo.
3. Guard con tres pruebas obligatorias: (i) cálculo sólo usa precios <= fecha, (ii) si falta serie comparable devuelve `UNAVAILABLE`, (iii) cuando no hay capital o un ajuste no cambia órdenes declara reach cero. Después pruebas rápidas de arquitectura y `tsc --noEmit`.
4. **Sólo después** definir y congelar la fórmula de una única política B, verificar viabilidad de universo historical/PIT y ejecutar el backtest pareado mediante `ResearchValidationCenter` en la propia aplicación. Nunca con GitHub Actions.

## Estado

- **DONE:** revisión de fuentes y literatura; lectura de componentes canónicos; cálculo de reach/cash de replay archivado, con artefacto persistido en rama `replay-results`; priorización H-CORE-OPPORTUNITY.
- **NOT DONE:** feature completa, pruebas TypeScript/guards, contrafactual y primer backtest A/B; rendimiento incremental no demostrado.
- **BLOQUEOS POTENCIALES:** master de universo histórico PIT, NAV/fundamentales comparables, falta de sample fresh, y financiación efectiva de operaciones.
- **PRODUCCIÓN:** sin cambios, `LEGACY`; Kronos sigue aparcado.


## 7. Entrega técnica R3-A · trazabilidad opt-in de core frente a satélite (2026-10-25)

**Implementación en main:** `src/investment/decision/dynamicHistoricalReplayCore.ts` ahora acepta opcionalmente `researchCoreOpportunityReferenceAssetId` para emitir `researchCoreOpportunityAudit` sólo en `CUSTODIA_ENGINE`. Si no se activa, el replay/producto no añade datos ni cambia selección, órdenes, cash, tasas, fiscalidad o cifras finales. Se reutilizan el `dateScan`, `PortfolioCandidateGate`, `PortfolioDecisionEngine`, `holdings` y el dinero **previo** a la fecha de decisión; no existe otro motor, job de cálculo largo o pantalla.

Por **cada fecha**, audita: core global de referencia solicitado explícitamente (nunca infiere retrospectivamente el seleccionado por DYNAMIC_CORE_SELECTOR), disponibilidad y fecha de sus precios/retorno 120 sesiones, valor del core ya poseído, equity, cash, `baseDeployableEur` (separado de `plannedRotationProceedsEur`), propuestas no-core, cantidad de órdenes propuestas y si su origen se corresponde con `ROTATION_ENTRY`. Lista candidatos que ya pasan el gate y **sólo** si core y candidato tienen el mismo `asOfDate` no futuro y moneda EUR; ofrece exceso de momentum 120 sesiones **descriptivo**, no promesa de retorno ni criterio de trading.

- Falta el core causal o el ID no representa un core estratégico: `UNAVAILABLE`; jamás fallback o core histórico inventado.
- Fechas de NAV distintas, series insuficientes, señales future-dated: excluir candidato, informar ausencia de comparables.
- Si la política vigente no propone ninguna compra no-core, `proposedOrderReach=ZERO` aunque haya señales elegibles. Si propone compra, `PROPOSED_NOT_EXECUTED`; no confundir una propuesta con una orden real ni con valor ganado.
- Esta auditoría es **opt-in**; una referencia seleccionada para comparar no concede autoridad para rotar la cartera ni altera `LEGACY`.

**Guards añadidos:** `tests/dynamicReplayCoreOpportunityAudit.unit.ts` prueba core inexistente/futuro, fechas NAV desalineadas, satélite futuro, cero capital, datos descriptivos, inmovilidad del input y paridad completa entre el replay canónico sin auditoría y con auditoría. Pruebas deterministas sintéticas se usan **sólo como fixtures de contrato**, no como validación económica con datos reales.

**Estado al commit:** fuente y tests registrados en GitHub y comprobación de contratos por inspección de fuente, pero **`tsx`/TypeScript y pruebas de runtime aún NO EJECUTADAS** porque la herramienta GitHub no ejecuta comandos en el backend de la app. No declarar `PASS` ni abrir un holdout. Comandos rápidos necesarios en el runtime antes de trabajos largos:

```bash
npx tsx tests/dynamicReplayCoreOpportunityAudit.unit.ts
npx tsx tests/coreArchitectureV1.unit.ts
npm run lint
```

**Siguiente paso tras PASS técnico:** obtener un replay real/corpus PIT con ambas series comparables; auditar propuestas vs ejecuciones y rotaciones realmente financiadas; únicamente entonces especificar/fijar una regla B susceptible de test A/B neto contra `LEGACY` y core compatible. No usar como validación el sample consumido 2019–2022.
