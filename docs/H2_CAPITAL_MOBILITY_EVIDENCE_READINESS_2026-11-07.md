# H2 — Auditoría de disponibilidad de evidencia y puerta económica

Fecha: 2026-11-07. Base: `fmaranis/Trading/main`, HEAD revisado `54cdcce52f5063db39f2c76c8fc127b2d232128d`.

**Estado:** `TECHNICAL_GUARDS_PASS / SIGNAL_DIAGNOSTIC_ONLY / NET_ECONOMIC_EVIDENCE_BLOCKED / NO_POLICY_FREEZE / NO_OUTCOMES_OPENED`.

Este documento no propone una política de compraventa, no es un preregistro de un holdout económico y no modifica los protocolos F6/F7. Su única finalidad es precisar qué se puede medir hoy y qué falta antes de comprometer una nueva muestra.

## 1. Pregunta y unidad de análisis

Pregunta: cuando existen posiciones en cartera, plazas libres, una oportunidad elegible y efectivo insuficiente para una orden mínima, ¿aporta información útil comparar el challenger con el **incumbent que habría que vender**, en lugar de compararlo únicamente con cash?

La unidad descriptiva es `(informationDate, incumbentAssetId, challengerAssetId)`. No es un trade, ni un episodio independiente, ni una rentabilidad futura.

Control necesario para una eventual prueba económica: mismo patrimonio y flujos, exposición equivalente y misma fecha de información, ejecución posterior a la señal, costes e impuestos realizables, y dos alternativas mutuamente excluyentes: **mantener incumbent** frente a **vender incumbent/comprar challenger**.

## 2. Auditoría de implementación real

| Requisito | Disponible en HEAD | Límite / interpretación |
|---|---|---|
| Candidatos elegibles y motivos por etapa | Sí, `PortfolioDecisionEngine.researchReachTrace` opt-in | Solo lista/shortlist/no financiación y decisiones del estado que se ejecuta; no reconstruye retrospectivamente los motivos de un motor antiguo |
| Condición de plazas libres sin capital nuevo ejecutable | Sí, `capitalMobilityShadow` | Requiere valoraciones presentes, ausencia de estrés sistémico, posiciones y oportunidades aceptadas |
| Pares incumbent/challenger | Sí, shadow `potentialPairs` | Solo holdings `HOLD/WATCH`; `displayedOpportunityCount` puede ser menor que `comparedOpportunityCount`; no representa todas las alternativas |
| Momentum 20/60/120, volatilidad, correlación y categoría/ISIN | Sí, métricas descriptivas | Correlación PRICE-ONLY en cierres comunes <= fecha; no total return ni efecto causal de dividendos, FX o solapamiento sectorial |
| Comisiones de compra/venta | Estimación del broker para un nocional aproximado | No es el coste ejecutado; no incluye spread/slippage ni verificabilidad broker por ISIN |
| Coste fiscal de la **cartera real** | **No** | La traza usa `taxAssessment=NOT_ESTIMABLE_FROM_PORTFOLIO_STATE`: faltan lotes, base fiscal de adquisición y datos de FX/costes; prohibido inferir impuesto neto o venta fiscalmente rentable |
| Lotes y fiscalidad en el **replay histórico** | Sí, `dynamicHistoricalReplayCore.ts` modela `ReplayLot {units,costEur,acquisitionDate}`, `realizedGainEur` y `estimatedTaxEur` | La existencia de la estructura en replay no prueba que haya cobertura REAL/PIT y ejecución correcta para una nueva pareja; no sustituye la base fiscal de la cartera real |
| `NEXT_OPEN`, cash, costes, `externalCashFlows` | Infraestructura integrada en replay | Solo sirve para un A/B económico después de congelar universo, política, calendario y controles |
| Universo histórico PIT completo, incluidas bajas | **No acreditado** | `HISTORICAL_INSTRUMENT_MASTER_V1` está implementado, pero población real completa pendiente; prohibido reconstruir universo histórico con Yahoo current |
| Observaciones H2 prospectivas fresh con alcance por etapa | **No acreditadas en la evidencia consultada** | Las 329 señales/98 comparaciones guardadas pertenecen a 2019–2022 CONSUMED y no son observaciones fresh |

## 3. Resultado permitido y resultado prohibido

**Permitido ahora:** diagnóstico read-only de alcance por etapa en snapshots prospectivos REAL, calidad de datos, número de fechas/pares realmente evaluables y motivos explícitos de `N/D`. El flag opt-in no puede emitir órdenes. La ejecución de validación técnica H2 superó TypeScript, guard 951a y resto de cierre rápido en el backend del usuario (log aportado 2026-11-07).

**No permitido:** atribuir alpha a diferencias de pendiente; tratar 98 pares como 98 operaciones; usar 2019–2022 para fijar threshold; inventar beneficios, impuestos o spreads; confundir una plaza disponible con efectivo; retunear V8/V9/V10/V11; modificar `LEGACY` o implementar una venta competitiva automática.

## 4. Puerta previa a un futuro experimento económico

Todos los puntos siguientes requieren evidencia verificable **antes de abrir outcomes**:

1. **Población y fechas**: definir universo instrumentado PIT/REAL, instrumentos, fechas de información, reglas de inclusión y exclusión y horizonte; conservar historial de delistings/alias cuando se afirme PIT completo; de lo contrario etiquetar cobertura parcial y limitar conclusiones.
2. **Datos de decisión**: capturar prospectivamente con `researchDecisionReachTrace=true` el `gateStatus`, shortlist, efectivo desplegable, holdings y parejas, sin filtrar fechas por rentabilidad posterior. Dedupe por fecha/identidad económica; nunca confundir señales repetidas con observaciones independientes.
3. **Datos económicos**: asegurar lotes fiscales as-of para la simulación de ambos brazos, divisa/FX, precio negociable NEXT_OPEN o NAV causal según instrumento, corporate actions/dividendos, comisiones, spread/slippage y elegibilidad broker. Si algún coste no puede estimarse de manera defendible, el contraste NETO queda `N/D`, no cero.
4. **Comparabilidad**: A = mantener y seguir la política canónica; B = **una** intervención explícita y precongelada dentro del mismo motor/replay; igual capital, flujos, reglas de cash BCE, fiscalidad, exposición/riesgo y calendario de revisión. Control adicional = structural core cuando los mismos flujos sean replicables. No doble contabilización de impuestos o rentas.
5. **Regla económica y guardrails**: congelar **antes** de outcomes la definición de «cuándo cambiar», criterio de selección de un solo incumbent/challenger si hay varios, mínimo de ventaja neta, límites de concentración/solapamiento, criterio de downside, mínimo de reach, métricas y condición de FAIL. Ningún parámetro se elige desde los 98 pares históricos.
6. **Evidencia**: persistir manifiesto/seal, hashes de fuentes, apertura de muestra antes de primera lectura de mercado y resultados sin selección por desenlace. Exigir validación fresh/blind y confirmación independiente antes de cualquier promoción.

**Decisión en esta revisión:** la puerta 1/2/3 no está acreditada para H2; por tanto **no se congela una política ni se ejecuta un A/B económico**. No se añaden jobs, pantallas, señales ni motores. Se conserva la infraestructura shadow actual y la prioridad de la cadena económica existente.

## 5. Siguiente acción específica

Cuando exista un snapshot prospectivo REAL utilizable en el runtime local, **auditar read-only** su trazabilidad H2 (fechas, pares, datos faltantes y razones `N/D`) antes de abrir resultados futuros. Separar calidad de señal y política económica. Si no hay datos suficientes, registrar `INSUFFICIENT_REAL_PIT_OR_TAX_LOT_EVIDENCE` y no iniciar ningún replay largo.

F6/F7 mantienen sus calendarios y sellos propios; `LEGACY` permanece en producción. Ruptura de precio/volumen continúa como backlog independiente, sin desplazar H2.

## 2026-11-08 — diagnóstico del snapshot real 2026-11-06: presupuesto de entradas, no H2

Fuente: JSON compartido por el usuario `h2-research-2026-11-06.json`, leído como evidencia **de una decisión contemporánea**, no como historial de resultados ni como autorización para operar. `informationDate=2026-11-06`, `source=CANONICAL_DECISION_OPT_IN`, `productionAuthority=false`, `outcomeAccessed=false`.

**Hechos observados:** `availablePortfolioSlots=10`; `baseDeployableToAssetsEur=7661.790234153747`; `opportunityCount=6`; `allocatorShortlistCount=6`; `plannedContributionCount=2`; `capitalCondition=NO_H2_PAIR_CONDITION`; `pairCount=0`; `netEconomicVerdict=N_D`. No afirmar que el efectivo entero se invirtió ni que dos compras se ejecutaron; son contribuciones planeadas.

`nonFundingReasonByAssetId` informa: `OPEN_BTS_VI`, `OPEN_VIG_VI`, `OPEN_BIRG_IR` => `NEW_POSITION_DECISION_BUDGET`; `EQ_ALLIANZ` => `BELOW_MINIMUM_ORDER_GAP`. La lista exacta de las dos contribuciones financiadas, ranking, importes por activo y descomposición monetaria del gap no están en este **readout resumido**, por lo que no se puede establecer rendimiento relativo ni coste de oportunidad de los rechazados.

**Código comprobado en `src/investment/decision/portfolioDecisionEngine.ts`:**
- `maxNewPositionsPerDecision('MEDIUM') = 2` y `maxBootstrapNewPositionsPerDecision('MEDIUM') = 4`.
- El bootstrap exige capital invertido sobre patrimonio planificado `<0.50`, valoraciones completas, sin estrés, plazas libres y dinero >= mínima orden. La restricción `NEW_POSITION_DECISION_BUDGET` de tres candidatos, junto con solo dos propuestas, es consistente con `newPositionDecisionLimit=2` en esta evaluación; no inferir el porcentaje exacto invertido sin patrimonio.
- El shortlist se ordena por `rankingScore` (LEGACY), pero el presupuesto de entradas se cuenta **solo después de asignaciones nuevas con importe viable**; un candidato que falla la mínima orden no ocupa plaza presupuestaria. La razón `NEW_POSITION_DECISION_BUDGET` no implica calidad baja ni que tres activos debieran ser comprados.
- `BELOW_MINIMUM_ORDER_GAP` usa `targetGapEur < max(executionPolicy.minimumOrderNotionalEur, lastClose + brokerCommission(lastClose))`; puede deberse a starter/timing y/o coste de una participación completa, no necesariamente al efectivo bruto disponible.
- H2 está correctamente inactivo en esta fecha: requiere `baseDeployableToAssetsEur < minimumOrderNotionalEur`, entre otras condiciones; aquí hay capital desplegable y dos aportaciones propuestas.

**Veredicto:** `H2_NO_REACH_ON_THIS_DATE / ALLOCATION_BUDGET_CONSTRAINT_OBSERVED / RELATIVE_OPPORTUNITY_VALUE_UNKNOWN`. No inferir fallo productivo ni cambiar de 2 a 3/4 nuevas entradas usando este snapshot ya visto. Para estudiar si las tres quedaron injustificadamente fuera, comparar los scores/volatilidad/timing/categoría, la capacidad residual y el portfolio resultante frente a las dos elegidas **en una muestra prospectiva diseñada antes de outcomes**, con mismas entradas externas y costes/riesgo. El JSON actual no contiene esas cifras, así que queda bloqueada cualquier conclusión de coste de oportunidad. El trabajo de captura económica de H2 sigue en espera de días con reach real; no crear una policy paralela para compensar un snapshot sin pares.

## 2026-11-13 — siguiente puerta: distinguir capital disponible sin asignar de H2 real

**Contexto:** tras completar las pruebas de H2, comprobar la selección/financiación de oportunidades y separar una rama de análisis USD que queda pendiente de prueba, el plan principal sigue siendo medir valor de la decisión y de la política económica SIN multiplicar motores ni retunear las muestras vistas.

### Auditoría de lógica actual, solo lectura

- `PortfolioDecisionEngine.evaluate` define `baseDeployableToAssetsEur = max(0, currentCashEur + pendingCapitalEur - targetCashEur)`. Aquí `pendingCapitalEur` es capital disponible ya declarado, NO aportación recurrente. Si este valor es positivo y sobran plazas, H2 `FREE_SLOTS_NO_DEPLOYABLE_NEW_MONEY` **no es aplicable**.
- Las oportunidades se ordenan por `rankingScore`; `opportunityPriority` dimensiona la proporción teórica, pero no es automáticamente el orden de compra. Cada nueva posición consume presupuesto sólo después de superar objetivos autorizados, mínimos de orden y límites aplicables.
- En MEDIUM, `maxNewPositionsPerDecision=2` salvo bootstrap (4), condicionado por `investedShareOfPlanned<0.5`, valoraciones completas, ausencia de estrés y cash suficiente. Las plazas libres de cartera NO anulan el presupuesto de entradas por evaluación.
- El starter MEDIUM `ENTRY_READY` tiene cap del 3% del capital planificado, y el timing puede autorizar el 25%; estas restricciones son INDEPENDIENTES del efectivo bruto. El término `NEW_POSITION_DECISION_BUDGET` aparece **antes** de calcular `targetGapEur` para ese activo, por lo que la cantidad económicamente realizable de un excluido NO se conoce.
- En el snapshot revisado 2026-11-06, cuatro alertas eran `GOOD_ENTRY/ENTRY_READY`, dos propuestas y dos bloqueadas por presupuesto. La lectura del importe usado frente a `baseDeployableToAssetsEur` solo puede evaluarse en el contexto privado del usuario; la existencia de remanente no significa que debiera invertirse ni demuestra que extender el límite produzca beneficio. **No publicar el nominal de la cartera privada o valores monetarios del usuario en documentos públicos.**
- Distinción ineludible: `baseDeployableToAssetsEur` ya descuenta `targetCashEur`; `residualPlannedCashEur` es contabilidad posterior y no debe mezclarse para duplicar capital. Las `contributions` son órdenes teóricas antes del filtro final de broker/impuestos/ejecución.

### Hipótesis y observaciones a seguir sin retuning

**H1 — presupuesto de entradas con efectivo suficiente**: capturar el alcance de `NEW_POSITION_DECISION_BUDGET` y distinguirlo del importe restante por cap starter, categoría, mínimo de orden, riesgo y timing. Medidas causalmente observables: oportunidades/shortlist, `baseDeployableToAssetsEur`, `plannedContributionCount`, importes propuestos, `newPositionDecisionLimit`, `bootstrapDeploymentActive`, motivos y gaps medidos; reportar gaps `null` cuando no fueron calculados. Esto es **calidad de ejecución de la política**, no validez predictiva del activo excluido.

**H2 — sustitución de capital ya invertido**: observar sólo si hay posiciones existentes y `baseDeployableToAssetsEur` insuficiente para una orden, manteniendo los gates de estrés/valoraciones. Evaluar pares challenger-incumbent, FIFO, costes, divisa y oportunidad de **no vender**. Si `pairCount=0`, la respuesta correcta es `NO_REACH`, no inventar parejas.

### Regla para cualquier contraste económico posterior

- **No abrir un A/B económico todavía**: falta una secuencia durable de snapshots REAL/fresh con identidad de universo/datos, cobertura de ejecución NEXT_OPEN, fiscalidad y costes. Los JSON del 2026-11-06 se usaron para diagnóstico y quedan CONSUMED para promoción. La rama `replay-results` revisada no aporta un nuevo H2 prospective seal/outcome; no extrapolar.
- Antes de abrir un holdout, definir y congelar la política experimental **independiente de las fechas consumidas**, su universo elegible y calendario, exposición/riesgo, spread+comisiones+fiscalidad reales, mínimos, definición de éxito/fallo y tratamiento de datos ausentes. Comparador primario: mantener `LEGACY` con el mismo capital/cash, flujos y fechas; cualquier brazo extra debe ejecutarse dentro de la misma cadena y del replay causal. No introducir dinero por frecuencia ni por `stagedCapitalPlan`.
- Las señales de las oportunidades financiadas y excluidas pueden compararse en su **calidad predictiva** sin asumir que la política de compra que las use sea rentable. Evaluaciones de retorno neto requieren comparabilidad económica; de otro modo `N/D`, no cero.
- Siguiente paso programático SOLO cuando un conjunto fresh apto esté realmente sellado/persistido: usar el mismo `ResearchValidationCenter` y el replay integrado, con guards/TypeScript antes de abrir un cálculo largo. No utilizar GitHub Actions, no repetir el FULL 2019–2022 y no ajustar parámetros desde el 6/11.
- No quedan tests ni capturas adicionales exigibles al usuario para **esta** auditoría de solo lectura. El código USD research es una tarea lateral con validación rápida pendiente, separada de H1/H2.
