# Plan de investigación para superar al core — 2026-09-27

Estado: EJECUTADO HASTA ETAPA B / FAIL_DIAGNOSTIC / PARADA OBLIGATORIA / NO PRODUCCIÓN.
Repositorio: fmaranis/Trading, rama main. HEAD de partida: e06190921e60f338b7e2eceff1ab3ef4abfc3f04.

## 1. Objetivo y alcance

Comprobar si una estrategia compradora, sin apalancamiento, de momentum relativo de medio plazo puede superar al structural core después de costes y fiscalidad comparable. Distinguir señal, construcción de cartera y traducción económica dentro de Custodia. Un FAIL es una conclusión válida: no buscar parámetros hasta obtener un ganador.

Este encargo implementa y ejecuta investigación; no cambia LEGACY, gates productivos, políticas retiradas, ni el protocolo FUNDAMENTAL_QUALITY_VALUATION_BROAD_PIT_V1. Quality × valoración conserva su bloqueo de datos; R1 consumida y R2 parcialmente abierta no son holdouts nuevos. Las pendientes 20/60 días sobre 15 rotaciones no constituyen una réplica del momentum académico.

## 2. Hipótesis prioritaria y fuentes

Una sola familia inicial: ranking transversal por retorno de los meses 2–12, omitiendo el mes más reciente, revisión mensual y cartera diversificada de líderes. Se estudia su versión long-only, no el factor ganador-menos-perdedor como si fuese una inversión sin shorts.

Referencias primarias para leer antes del preregistro:

- Kenneth French, 10 Portfolios Formed Monthly on Momentum: https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/Data_Library/det_10_port_form_pr_12_2.html
- Kenneth French, Monthly Momentum Factor (contraste metodológico, no retorno long-only): https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library/det_mom_factor.html
- Asness, Moskowitz y Pedersen, Value and Momentum Everywhere: https://www.aqr.com/Insights/Research/Journal-Article/Value-and-Momentum-Everywhere
- Daniel y Moskowitz, Momentum Crashes: https://www.nber.org/papers/w20439

La combinación con value/quality queda diferida. No añadir de inicio medias móviles, stops, filtros de régimen, RSI, máximos, ML ni nuevas variantes de Forward Risk. Una réplica compradora operativa debe etiquetarse como adaptación si difiere de la construcción publicada.

## 3. Ejecución económica en tokens

- Leer HEAD, PROJECT_STATE.md, este plan y las secciones de investigación vigentes una vez. Buscar componentes existentes antes de programar.
- Cálculos mediante scripts deterministas y motor local/backend. La IA implementa y revisa agregados, no calcula ticker a ticker mediante conversación.
- Sin subagentes, sin GitHub Actions, sin servicios de pago nuevos, sin búsqueda masiva de estrategias.
- Cachear datos y checkpoints con hashes. Reanudar por etapas; no repetir descargas ni replays ya válidos.
- Pruebas rápidas y TypeScript antes de cada primera ejecución larga de código modificado; repetir sólo lo afectado.
- Un resumen por etapa: cobertura, resultado, limitación y siguiente acción. No volcar miles de filas al chat ni hacer polling continuo.
- No pedir al usuario ejecutar el Centro de validación. Invocar el runner del job desde el runtime disponible. Si faltan acceso/datos, registrar BLOCKED y la necesidad exacta; no consumir tokens con reintentos equivalentes ni sustituir fuentes silenciosamente.
- Persistir evidencia y actualizar main al cerrar cada etapa material. La siguiente etapa arranca automáticamente sólo si supera el gate previo.

## 4. Etapa A — inventario y preregistro antes de resultados

1. Auditar disponibilidad de datos y arquitectura existente sin inspeccionar rendimientos de las ventanas reservadas. Identificar universo PIT, delistings, dividendos/splits, calendario, moneda, precios de ejecución y costes.
2. Crear un registro único de muestras: ventanas ya usadas en el proyecto, fechas de acceso a outcomes y rol diagnóstico/confirmación. No basta que una fecha sea antigua o que un script sea nuevo para llamar fresh a una muestra.
3. Elegir una ventana de diagnóstico y una de confirmación temporal no solapada, por reglas de cobertura y registro de consumo, nunca por rentabilidad. Reservar al menos cinco años completos por ventana si hay datos; con menos, etiquetar evidencia limitada, sin promoción. Mantener al menos doce meses entre ventanas para separar los periodos de formación. Si no existe confirmación histórica defendible, preparar future-forward y declarar que no habrá demostración definitiva hoy.
4. Guardar y sellar protocolo legible + JSON + hashes de código antes de abrir resultados. Campos obligatorios: fechas exactas y warm-up; universo/identidades; fuente y versión; fórmula; número de posiciones; ponderaciones; empates/redondeo; missingness; ejecución; benchmark; costes; fiscalidad; gates; muestras; política de reanudación.
5. No ejecutar si quedan campos TBD. Las decisiones operativas se resuelven con documentación y arquitectura existente, sin pedir al usuario parámetros rutinarios y sin ver outcomes. Este plan no sustituye ese sello.

Definición que debe conservar el preregistro de la adaptación:

- Señal al cierre del mes t: retorno total acumulado desde cierre t-12 hasta cierre t-1; omite el mes t. Documentar índices y probar un ejemplo de calendario para evitar errores de un mes.
- Selección: decil superior del universo elegible PIT; ceil(N/10), empates por identificador estable. Menos de 100 elegibles => cobertura insuficiente para esta réplica, sin reducir discrecionalmente la cartera.
- Ponderación por capitalización causal dentro del decil, consistente con la referencia value-weighted. Si falta capitalización histórica, no reemplazarla por capitalización actual o equal-weight. Un piloto con carteras publicadas queda sólo como diagnóstico externo.
- Revisión mensual, sin apalancamiento/shorts, sin aportaciones implícitas. Ejecución NEXT_OPEN posterior a la señal en el replay accionable. No asumir ejecución al cierre usado para seleccionar.
- Congelar antes de resultados el tratamiento económico de delistings, fusiones y efectivo residual. No eliminar pérdidas o renormalizar supervivientes por falta de datos.

## 5. Etapa B — diagnóstico externo barato

Utilizar, si están accesibles, las carteras publicadas long-only de French para comprobar la familia y la implementación aritmética. Limitar el análisis a la ventana diagnóstica sellada; no mostrar ni utilizar outcomes de confirmación en tablas, selección o gráficos. Conservar exactamente qué datos se descargaron/accedieron; si se abrió la reserva, declararla consumida.

Comparar decil ganador value-weighted con su mercado estadounidense correspondiente. En la intersección disponible añadir el proxy global congelado; no extender URTH antes de su existencia ni empalmar sintéticos. No presentar series académicas brutas como rentabilidad neta invertible en Custodia ni un factor long-short como retorno de la rama compradora.

Gate de continuidad económico mínimo: exceso de CAGR bruto > 0 frente al parent y al proxy global cuando ambos sean comparables. Si falta el segundo benchmark, el diagnóstico puede informarse pero no declara superioridad al core. FAIL => documentar y parar esta réplica; no probar deciles/lookbacks alternativos. Un PASS sólo permite pasar a datos accionables, no confirma alpha.

## 6. Etapa C — réplica accionable y alcance en Custodia

Integrar un modo research-only explícito en el replay causal existente y un job en ResearchValidationCenter. No crear otro motor productivo. El diagnóstico puro de la señal no debe confundirse con órdenes del motor productivo.

Brazos, con igual capital inicial, flujos, moneda, calendario y tratamiento de costes/impuestos:

- CORE_HOLD: structural core canónico; identificar instrumento exacto en el sello. URTH es sólo proxy USD cuando corresponda, nunca equivalencia silenciosa con la cartera EUR del usuario.
- MOMENTUM_REFERENCE: cartera de la réplica congelada, dentro del harness existente, para medir la señal/construcción de cartera.
- CUSTODIA_RESEARCH_MOMENTUM: misma señal como opción research en la cadena scanner -> gate -> decisión -> allocator -> ejecución, conservando reglas productivas de seguridad. Ejecutar este brazo sólo si MOMENTUM_REFERENCE supera los gates netos en diagnóstico.

Si los filtros/catálogos de Custodia reducen el universo, informar la diferencia; no llamarlo réplica académica exacta. Medir reach: ranking cambiado -> selección cambiada -> asignación cambiada -> compras ejecutadas, capital desplegable y días en efectivo. Comparar rendimientos y explicar pérdidas de ventaja entre brazos. No desbloquear caps ni retocar salidas tras observar el diagnóstico.

Guardrails previos a outcomes: datos REAL, universo histórico (incluidas bajas), causalidad y prefix invariance, NEXT_OPEN, reconciliación contable, costes y cash/fiscalidad independientes. Filas faltantes implican la política preregistrada o INCONCLUSIVE, nunca selección retrospectiva. Guard fallido o TypeScript fallido bloquean el cálculo largo.

## 7. Métricas, gates y confirmación

Publicar por brazo y ventana: cobertura/exclusiones, riqueza terminal, retorno total, CAGR, exceso de CAGR frente al core y parent USA, max drawdown diario, volatilidad, Sharpe con cash causal común, peor año, rotación, costes, impuestos, concentración sectorial y beta al benchmark. Con flujos externos, usar métricas ajustadas; las aportaciones no son beneficio.

Gate de candidato (condiciones conjuntas, no promoción):

1. Exceso neto de CAGR > 0 frente a core y parent USA.
2. Exceso neto > 0 también con costes de transacción duplicados; no duplicar impuestos en ese stress.
3. Max drawdown de la estrategia, expresado como pérdida positiva, <= max drawdown del core, y Sharpe >= core.
4. Repetición de 1–3 en la confirmación temporal preregistrada sin cambiar nada.

Estos son criterios conservadores del proyecto, no resultados ni umbrales deducidos de un backtest. Mostrar asimismo incertidumbre de la ventaja: bootstrap por bloques conjuntos de meses (bloques de 12 meses, 2.000 réplicas, seed 20260927), sin tratar observaciones correlacionadas como independientes. Límite inferior unilateral 95% de exceso de CAGR <= 0 => evidencia estadística insuficiente; no afirmar superioridad demostrada. Bootstrap no corrige sesgo de selección, survivorship ni múltiples pruebas. Sólo se prueba la réplica primaria; diagnósticos adicionales no pueden rescatar un FAIL.

Los gates de riesgo con drawdown diario requieren serie diaria; no aplicarlos a drawdown mensual como si fuese el mismo. Mayor retorno con peor riesgo se informa como tradeoff y no cumple este objetivo conservador. Diferenciar exceso de benchmark de alpha ajustado por factores.

Tras PASS diagnóstico, sellar el mismo código/configuración antes de abrir confirmación. Cualquier cambio motivado por lo observado consume la muestra y exige un nuevo diseño independiente; no generar V2 paramétrica. PASS de señal con FAIL de Custodia significa traducción económica fallida, no inutilidad automática de la señal. PASS de ambos significa candidato para revisión explícita de promoción, no cambio automático de LEGACY.

## 8. Entregables y parada

- Preregistro/sello + registro de muestras.
- Runner/job reproducible con caché, checkpoint y un comando documentado.
- Inputs/manifest con identidad y procedencia, asignaciones anteriores a outcomes, precios fechados, exclusiones y resultados exactos; no guardar sólo resúmenes sin etiquetas.
- JSON y tabla pequeña de métricas y gates, costes de ejecución y tiempos.
- Actualización de PROJECT_STATE.md y docs/OPPORTUNITY_ALPHA_RESEARCH_2026-09-24.md; commits a main, producción intacta.

Estados permitidos: BLOCKED_DATA_ACCESS, INCONCLUSIVE_COVERAGE, FAIL_DIAGNOSTIC, FAIL_CONFIRMATION, INCONCLUSIVE_STATISTICAL_EVIDENCE, PASS_CANDIDATE_NO_PROMOTION. No etiquetar PASSED por terminar un proceso si el resultado económico falla.

Detener trabajo costoso al primer bloqueo material o FAIL de etapa. No relanzar las investigaciones archivadas ni seguir probando variantes para encontrar un ganador. El resultado deseado es evidencia válida de superioridad; el resultado aceptable incluye demostrar que esta candidata no la proporciona.


## 9. Execution outcome — 2026-09-27

The plan was executed through Stage B and stopped at the first economic FAIL as required.

- diagnostic: 2016-01 -> 2021-12;
- winner 12-2 value-weighted momentum CAGR: **16.68%**;
- US parent CAGR: **17.52%**;
- URTH global proxy CAGR: **14.22%**;
- excess vs US parent: **-0.84 pp/year**;
- excess vs URTH: **+2.46 pp/year**;
- Stage B gate: **FAIL_DIAGNOSTIC**.

Consequences mandated by this plan:

- confirmation 2009-01 -> 2014-12 remains unopened;
- Stage C is not implemented or executed;
- no parameter/grid/decile/lookback rescue search;
- production stays `LEGACY`.

Durable evidence:

- `docs/CORE_OUTPERFORMANCE_MOMENTUM_V1_EXECUTION_2026-09-27.md`;
- `docs/CORE_OUTPERFORMANCE_SAMPLE_REGISTRY_2026-09-27.md`;
- `validation-runs/diagnostics/core-outperformance-momentum-v1-result.json`.

Methodological note: the windows were declared in the working chat before outcomes, but the repository seal was not committed pre-outcome. The run is therefore retained as a diagnostic FAIL rather than described as a valid repository-level preregistered confirmation.
