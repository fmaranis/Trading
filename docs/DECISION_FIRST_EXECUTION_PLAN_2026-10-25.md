# Custodia — CAMBIO DE RUMBO: investigación de ventaja económica verificable

Actualizado: 2026-10-25 · Fuente canónica: `fmaranis/Trading/main` + `PROJECT_STATE.md`

> **Esta revisión sustituye la priorización inicial H0/H1 de este documento.**
> **Kronos NO es la prioridad ni un prerrequisito del nuevo rumbo.**
> Este plan tiene por finalidad descubrir, construir y comprobar una forma económicamente mejor de decidir inversiones con Custodia. Mantener una app web accesible desde el móvil es una restricción, no el objeto principal de la investigación.

## R0 — revisión de investigaciones existentes (obligatoria antes de proponer más pruebas)

**Rectificación 2026-10-25:** se habían omitido resultados importantes de septiembre/octubre al definir R1–R3. En particular, `CORE_RELATIVE_LEADERSHIP_RESEARCH_V1` y ruta tras EXIT, `CORE_OUTPERFORMANCE_MOMENTUM_REFERENCE_V1`, `SECTOR_52W_HIGH_LEADERSHIP_V1`, `CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2` y `PEAD_ANALYST_SURPRISE_V1` **ya fueron ejecutados/cerrados con los estados del repositorio**. La supuesta investigación novedosa `H-CORE-OPPORTUNITY` **NO procede** por duplicar el enrutamiento core-vs-satélite y no demostrar diferencia sustantiva respecto a pruebas consumidas. No reabrir esos estudios ni buscar una victoria cambiando parámetros.

Antes de R1/R2/R3:
- Leer `PROJECT_STATE.md`, `docs/OPPORTUNITY_ALPHA_RESEARCH_2026-09-24.md` y los registros de experimentos con resultados machine-readable; no limitar la revisión a fechas recientes.
- Crear inventario de las preguntas **efectivamente probadas**, estado técnico/económico, tamaño de muestra, autoridad, disponibilidad de datos, muestras consumidas y razones exactas del STOP. Reutilizar evidencia ya persistida.
- Elegir, como máximo, una hipótesis nueva sólo si difiere económicamente de todas las pruebas previas: nueva información predictiva independiente, mecanismo de asignación/ejecución distinto, o universo/datos nuevos y válidos; demostrar esa diferencia **antes** de programar. Un nombre o score distinto no basta.
- La antigua auditoría opt-in `researchCoreOpportunityReferenceAssetId` añadida en el turno anterior **se ha revertido**, junto con su test no ejecutado, para no acumular instrumentación sin pregunta ni prueba. La lógica productiva recupera exactamente el blob anterior.
- No pedir al usuario repetir largos jobs ni abandonar el nuevo rumbo. El objetivo permanece encontrar valor económico neto sostenible; no convertir una lista de modelos en trabajo.

**Registro de verificación y rectificación:** `docs/RESEARCH_INVESTMENT_EDGE_R1_R2_2026-10-25.md` (apartado superior RECTIFICACIÓN CANÓNICA). Las prioridades R1/R2 y el viejo `H-CORE-OPPORTUNITY` de las secciones siguientes tienen carácter **histórico/supeditado a R0**, no constituyen orden de ejecución vigente.

---

## Objetivo económico

Responder de forma causal y demostrable a la pregunta: **¿cuándo, qué activo y qué importe merece apartarse de una cartera global indexada, y cuándo conviene no hacerlo?**

Medir patrimonio neto después de costes, impuestos y flujos externos, valor incremental frente a `LEGACY` y al `structural core`, rentabilidad/riesgo, drawdown, estabilidad temporal y frecuencia de decisiones realmente ejecutables (`reach`). Una tasa de acierto elevada aislada no equivale a ventaja económica.

**Principio de investigación:** no limitarse a pequeñas correcciones de LEGACY. Buscar **hipótesis económicas distintas** (calidad/valoración, liderazgo relativo y tendencia, y uso de riesgo predictivo sólo cuando tenga causalidad y utilidad incremental). Usar bibliografía, metodologías open source y modelos ML ligeros, pero no asumir que una técnica tiene alfa por ser conocida.

## Prioridad real y orden de trabajo

### R1 — Evidencia, referencia y problemas decisionales [PRIMERO]

1. Recuperar la definición exacta del `structural core`, `LEGACY`, política fiscal y costes en el replay ya integrado; evitar benchmarks sin flujos comparables.
2. Reutilizar auditorías y resultados existentes, distinguiendo la evidencia predictiva de políticas que monetizan mal la señal. Investigar decisiones fallidas y también qué inversiones realmente funcionaron.
3. Identificar clases de decisiones con impacto económico y alcance operativo: elegir acción en vez de core, entrar/salir, rotar, asignar el efectivo que sí existe y abstenerse.
4. Detectar ausencia de datos PIT, muestras consumidas, universo no histórico y errores de atribución antes de formular conclusiones.

**Salida:** una matriz corta de oportunidades de investigación priorizadas por plausibilidad económica, alcance, disponibilidad causal de datos y coste de verificación. Ningún cambio productivo.

### R2 — Nuevas hipótesis de inversión [PARALELO A AUDITORÍA, SIN KRONOS]

Preparar y documentar un pequeño número de familias **conceptualmente diferentes**, aprovechando literatura publicada y lo ya aprendido:

- **Liderazgo relativo y tendencia:** fuerza frente al core, persistencia, calidad de pendiente y confirmación de ruptura/continuación, no sólo un umbral aislado.
- **Calidad fundamental × valoración:** rentabilidad del capital, márgenes, crecimiento, balances y precio pagado, usando fundamentales únicamente con `filed <= informationDate` y cobertura PIT acreditable.
- **Riesgo contextual:** preservar la evidencia predictiva Forward Risk V8, pero investigar sólo contribuciones no redundantes a ranking, sizing, alertas o escenarios; nunca resurrectar V8/V9/V10/V11 como interruptor directo o retuning de muestras consumidas.

No montar tres motores. Priorizar UNA familia comprobable tras auditar cobertura real y reach. Las otras se documentan y aparcan.

**Salida:** hipótesis falsable, features disponibles **hasta** cada fecha, benchmarks simples y qué experimento podría invalidarla. El informe histórico exploratorio NO promociona.

### R3 — Experimento research-only integrado [DESPUÉS DE R1/R2]

Introducir sólo la capacidad mínima de investigación/shadow en la cadena existente:

`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine/evaluatePortfolioDecision -> ejecución y seguimiento`.

El único replay actual reproduce la política A=`LEGACY` y B=candidata **prerregistrada**, con mismo universo causal, cash, costes, impuestos, `NEXT_OPEN`, `externalCashFlows`, selección y disponibilidad de datos. Sin alternativas adivinadas retrospectivamente. Registrar decisiones que realmente cambian y presupuesto disponible. El `ResearchValidationCenter` es la superficie de ejecución.

**Salida:** comparativa económica y alcance operativo reproducibles, métricas de riesgo/consistencia, posibles `FAIL`/`INCONCLUSIVE`. La muestra utilizada para construir o interpretar la política queda `CONSUMED`, no se retunea para convertirla en PASS.

### R4 — Confirmación independiente [GATE PARA PRODUCCIÓN]

Congelar política/algoritmo/parámetros y criterios *antes* de abrir un holdout fresh/blind con datos PIT y universo válido, conforme al protocolo económico. Ninguna confirmación retrospectiva sobre los datos consumidos. Si no hay muestra independiente suficiente, mantener investigación prospectiva/shadow y comunicar `NO PROMOTION EVIDENCE`.

**Salida:** sólo un resultado robusto y repetido, neto frente a `LEGACY` y a un core comparable, permite **proponer** un cambio productivo; `LEGACY` continúa por defecto mientras tanto.

### R5 — IA y producto [SEGÚN EVIDENCIA, NO COMO PRIMERA TAREA]

Investigar LightGBM/boosting, Qlib u otros modelos ligeros para ranking relativo si hay datos PIT suficientes y una pregunta predictiva que métodos simples no resuelvan. Medir *incremental* signal + economic reach. Cada capacidad aprobada responde integrado a «qué hacer hoy / activo / importe / por qué» sin nuevos paneles, variantes de replay o motores desconectados.

### Infraestructura y Kronos — TAREAS DE SOPORTE, FUERA DE RUTA CRÍTICA

- **Kronos aparcado:** conservar checkpoint duradero confirmado de 680/5.580 trayectorias en `replay-results`. No relanzarlo ni reducir su protocolo congelado por impulso; sólo trabajar en aislamiento/ejecución por unidades si se decide reactivarlo y existe una infraestructura capaz. Ni Kronos ni TimesFM bloquean R1–R4.
- **Web permanece:** GitHub `main` canónico, acceso móvil/navegador y backend existente. Evaluar alojamiento/worker alternativo *cuando una prueba de la nueva investigación lo necesite* o la fiabilidad de uso diario lo exija. No migrar por moda.
- **Coste incremental objetivo 0 EUR:** software abierto, Yahoo REAL cuando corresponde, datasets ya disponibles y cálculo en backend local/app. El hosting permanentemente disponible y CPU intensiva ilimitada no están garantizados gratis; no contratar sin propuesta concreta y aprobación expresa.
- **Cálculo largo:** motor propio de la app; jamás GitHub Actions ni agentes gastando tokens durante horas. Guards/unit/TypeScript antes de arrancar trabajos caros.

## Qué hace ChatGPT y cuándo interviene el usuario

**ChatGPT:** inspecciona HEAD y fuentes, prepara investigación crítica, implementa cambios **directamente en main** cuando estén justificados, añade tests rápidos/contratos, prepara ejecuciones en el Centro de validación, interpreta resultados persistidos, registra límites y actualiza `PROJECT_STATE.md`.

**Usuario:** no tiene que supervisar diariamente ni explicar de nuevo decisiones anteriores. Sólo actúa ante permisos externos, secretos/credenciales que ChatGPT no puede administrar, sincronización/despliegue necesario, o ejecución manual de un job cuya máquina/backend no sea accesible desde GitHub. En esos casos, dar una sola instrucción concreta; jamás pedir claves en el chat.

## Estado inicial (2026-10-25)

- Existe auditoría consumida 2019–2022: engine 17.572,29 EUR vs structural core 20.365,50 EUR, brecha -2.793,21 EUR; **no demuestra** una causa ni ventaja de hipotética corrección.
- 1.024 señales originales contabilizadas, 34 señales diagnósticas legibles en export parcial: no imputar las 861 `AVOID` sin trazas completas.
- El cuello de botella documentado de algunas políticas de ranking es la **falta de capital nuevo desplegable**, no sólo ordenar candidatos.
- Forward Risk V8 conserva evidencia predictiva histórica, distinta del FAIL económico de monetizaciones V8–V11.
- TimesFM tuvo FAIL económico de políticas probadas; Kronos sigue sin evidencia económica final.
- `LEGACY` continúa íntegro, `CORE_ELIGIBILITY_V2` sigue shadow.

## Primera próxima entrega real

**R1+R2:** diagnóstico consolidado de los resultados existentes y selección crítica de la primera hipótesis alternativa con fuentes PIT y reach verificables. Debe producir una respuesta sobre **qué decisión mejorará** y **cómo falsarla**, no otra lista de modelos ni una nueva pantalla. Después implementar el experimento mínimo research-only si la hipótesis y los datos lo permiten.


## R2 prioridad de investigación: máximos históricos, estrés de mercado y decisiones durante un desplome

**Motivo (2026-10-25):** el usuario plantea exposición a máximos y riesgo de caída sincronizada. Esto es **un caso de uso central** del nuevo rumbo de inversión, NO un mandato de predecir un crash ni de activar un ON/OFF anticipatorio. Las cotizaciones altas y el sentimiento mediático no justifican por sí solos vender. Congelar cualquier política antes de abrir un holdout.

**Lo que ya hace la app:** `PortfolioDecisionEngine` calcula `systemicStress` si detecta >=3 posiciones con consenso <=-3 y >=3 votos negativos, representando >=50% de posiciones observables. En estrés, convierte ciertos `EXIT` individuales en `REDUCE` hasta `ENTRY_READY` o `WATCH`, y bloquea la rotación competitiva. También tiene evaluación de salud de posiciones, rotación y cash. Esta protección contra liquidaciones sincronizadas **no es un presupuesto de riesgo agregado probado** y puede dejar exposición en un mercado bajista prolongado. `Forward Risk V8` conserva evidencia de señal predictiva, pero no tiene autoridad productiva y sus monetizaciones probadas fracasaron.

**Investigación dentro de R1-R4, no nueva pantalla/motor:**

1. Auditar exposición actual si existen datos de cartera REAL disponibles: beta y concentración, solapamiento de fondos/acciones, exposición sectorial y divisa, correlaciones en estrés, importe de capital verdaderamente disponible, y pérdidas hipotéticas por shocks (-20%, -35%, -50% como **escenarios**, no pronósticos). Si no hay cartera actual accesible, marcar `NOT_AVAILABLE`, no inventar exposición.
2. Separar tres preguntas: (a) señales **anticipatorias** con calidad fuera de muestra; (b) reglas de **contención** cuando el deterioro ya es observable; (c) oportunidad de **reentrada/despliegue** sin adivinar mínimos. Nunca confundir minimizar drawdown con maximizar riqueza final.
3. Proponer medidas descriptivas PIT de amplitud, momentum/ruptura, concentración, volatilidad y spreads de crédito cuando haya fuente y licencia/serie histórica válidas; valuation/CAPE sólo contexto de rentabilidad esperada de largo plazo, no disparador diario. Identificar la disponibilidad real de datos antes de programar features.
4. Reutilizar el replay causal para contrastar `LEGACY`, core pasivo compatible y UNA candidata preregistrada en episodios de estrés (p.ej. 2000-03, 2007-09, 2020, 2022) **sólo si existen datos y universo PIT válidos**. Caso contrario reportar límites y realizar únicamente simulación de escenarios sobre cartera fija, sin atribuirla como validación de alfa.
5. Para cualquier regla de defensa, medir errores de falsa alarma, retorno sacrificado en recuperaciones, impuestos, coste de salida/reentrada, oportunidad perdida, pérdidas máximas y final wealth. No optimizar umbrales tras observar las mismas crisis; usar bloques cronológicos independientes y prospective/shadow si se agotaron los holdouts.

**No hacer:** vender todo por noticias, abrir apalancamiento/cortos/opciones como primera respuesta, prometer ganar durante desplomes, ni activar V8 diariamente de forma binaria. Antes de aconsejar una operación individual, confirmar cartera, necesidades de liquidez y tolerancia real al riesgo.


## Primera entrega R1/R2 completada · 2026-10-25

- Investigación científica y auditoría del motor actual: `docs/RESEARCH_INVESTMENT_EDGE_R1_R2_2026-10-25.md`.
- Evidencia cuantitativa reproducible de reach/cash 2019–2022: `replay-results/validation-runs/diagnostics/investment-pivot-reach-audit-2019-2022-v1.json` (**CONSUMED**, sólo diagnóstico).
- Decisión de investigación: primer candidato `H-CORE-OPPORTUNITY` — coste de oportunidad de sustituir/rotar exposición desde core hacia oportunidades realmente ejecutables. No crear «momentum» cosmético: restar un retorno benchmark común preserva el ranking de un mismo horizonte. Calidad/valoración será segunda línea si se acredita cobertura PIT.
- Próxima entrega: alcance instrumental del replay canónico para core vs satélite, capital rotatable, FX/corporate actions, guards missing/future/zero-reach y diseño congelable del primer test. **No nueva estrategia aprobada**, no variante de replay ni cambio a `LEGACY`.
