# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar primero el HEAD real, leer este archivo y después consultar los documentos enlazados. Si un chat antiguo contradice el repositorio actual, manda el repositorio.

# 1. Invariante principal de producto

Documento normativo:

`docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`

La aplicación **NO** invierte dentro de una whitelist fija de 64 nombres.

Objetivo:

> **buscar dinámicamente el mercado actual, identificar los activos más atractivos y fiables disponibles en ese momento, formar una shortlist dinámica de hasta 64 candidatos y decidir después si merece la pena entrar en alguno, cuánto asignar y por qué.**

Cadena canónica:

`mercado actual`
`-> AssetUniverseScanner`
`-> Top64 dinámico`
`-> PortfolioCandidateGate`
`-> InvestmentDecisionEngine`
`-> PortfolioDecisionEngine/evaluatePortfolioDecision`
`-> ejecución y seguimiento`

Reglas permanentes:

- 64 = target/máximo de shortlist dinámica, no nombres permanentes.
- La identidad de los candidatos puede cambiar en cada evaluación.
- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` = seed/bootstrap/fallback operativo, no definición del mercado.
- Top64 sólo identifica candidatos; no autoriza compra.
- Cash hurdle, consenso, timing, gates y allocation mantienen autoridad.
- “No comprar nada” sigue siendo una salida válida.
- En validación prospectiva se congelan reglas, no nombres futuros.
- Yahoo current/live nunca se utiliza para inventar retrospectivamente el universo histórico.

---

# 2. Reglas no negociables

- Nunca usar GitHub Actions para replays o validaciones largas.
- Los cálculos largos los ejecuta el motor local/backend, normalmente `ResearchValidationCenter`.
- Guards/unit tests/TypeScript deben pasar antes del cálculo live/largo.
- Procedencia siempre explícita: `REAL / STATIC_REFERENCE / SYNTHETIC`.
- Sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha de decisión; ejecución posterior a señal / `NEXT_OPEN` cuando corresponda.
- No retunear thresholds, coeficientes o políticas usando una muestra ya observada.
- No crear motores paralelos.
- `DAILY/WEEKLY/MONTHLY/QUARTERLY` = frecuencia de revisión, nunca generación automática de dinero.
- `stagedCapitalPlan` = capital ya disponible; no aportación recurrente.
- Aportaciones/retiradas = `externalCashFlows` explícitos y fechados.
- Ningún dato financiero privado del usuario se embebe en código público.

---

# 3. Motor productivo vigente

Arquitectura:

`CORE_ARCHITECTURE_V1`

Producción mantiene:

- opportunity/allocation: **LEGACY**;
- `CORE_ELIGIBILITY_V2`: shadow;
- Forward Risk: no modifica producción;
- replay causal / `NEXT_OPEN`;
- modos integrados `Desde cero / manual / cartera actual`;
- modos integrados `Motor Custodia / mantener cartera`;
- cash histórico BCE y fiscalidad causalmente integrados.

---

# 4. Mercado dinámico current/live — CERRADO / PASS FINAL

Documentos:

- `docs/dynamic_market_top64_v1_outcome.md`
- `docs/dynamic_market_top64_v1_final_outcome.md`

Estado:

**DISCOVERY PASS / BREADTH PASS / TOP64 PASS / DEDUPE PASS / GATE-INTEGRATION PASS / ARCHIVED**

Run final de cierre del 2026-09-09:

- Search queries: 24; failures: 0;
- Lookup queries: 36 + 26 fallback; failures: 0;
- raw candidates: 180;
- EUR aceptados: 113;
- ETF: 50;
- EQUITY: 63;
- nuevos promovidos fuera del seed: 98;
- scanner pool: 162;
- REAL aceptados: 157;
- rechazados: 5;
- Top64: 64;
- `OPEN_*` dentro del Top64: 29;
- gate LEGACY: 11 elegibles -> 11 seleccionados;
- leak elegible fuera del Top64: 0.

Ranking productivo congelado durante esa fase:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

`0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Reliability/Opportunity sólo desempatan el Top64 productivo.

No utilizar los snapshots del 2026-09-09 para retunear esa fórmula.

Identidad/diversificación current/live:

- aliases/cross-listings evidentes se deduplican antes de competir por Top64;
- acciones individuales current/live no quedan limitadas artificialmente por la etiqueta amplia `EUROPE_EQUITY`;
- ETF/fondos conservan el cap legacy de 2 por categoría en `PortfolioCandidateGate`;
- histórico/research conserva su semántica anterior.

El job `dynamic-market-top64-v1` está ARCHIVED/read-only.

---

# 5. Replay histórico — causal, con limitación de universo

El replay sí decide en cada fecha histórica usando sólo datos disponibles hasta ese día.

En cada `decisionDate`:

- trunca barras a `<= decisionDate`;
- exige mínimo histórico;
- calcula momentum/volatilidad/drawdown causalmente;
- aplica `PortfolioCandidateGate`;
- llama `InvestmentDecisionEngine` con timestamp histórico;
- llama `PortfolioDecisionEngine`;
- ejecuta después de señal.

Pero no reconstruye todavía el mercado completo point-in-time de aquella fecha.

Yahoo Search/Lookup actual **no participa** en replay histórico.

El replay usa el catálogo conocido más la disponibilidad causal de barras. Persiste survivorship hasta disponer de instrument master point-in-time con listings/delistings históricos.

---

# 6. External cash flows — PASS / CONSUMIDO / ARCHIVADO

Documento:

`docs/replay_explicit_cash_flows_v1_outcome.md`

Resultado:

`PASS_EXPLICIT_CASH_FLOW_INTEGRATION`

Comprobado:

- `MONTHLY` no crea aportaciones;
- brazo cerrado: 0 flujos implícitos;
- externalCashFlows explícitos y causales;
- aportaciones no cuentan como rentabilidad;
- benchmark cash independiente;
- REAL-only;
- sin `OPEN_*` retrospectivos.

Reach agregado 10y/6y/3y:

- gates con capital desplegable: 3 -> 22;
- notional ejecutado adicional con flujos explícitos: +212.386,21 EUR;
- QUALITY cambió 10 planes y 23 fechas ejecutadas;
- efecto económico observado pequeño, sin base para promoción ni retuning.

Producción sigue LEGACY.

---

# 7. Opportunity / QUALITY — historial metodológico

Consumido:

- `QUALITY_V1`: información útil, reach/economía insuficientes para promoción;
- `SLOPE_V1`: no justificó promoción;
- `QUALITY_ALLOCATION_BRIDGE_V1`: research-only dentro de `PortfolioDecisionEngine`.

Fórmula bridge congelada:

`candidateQualityAdjustment = (reliability - 50)*0.10 + (opportunity - 50)*0.20`

`qualityMultiplier = clamp(1 + adjustment/100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

No retunear 0.10 / 0.20 / 0.85 / 1.15 sobre ventanas ya observadas.

Hallazgo de los diagnósticos consumidos:

- QUALITY sí llega al allocator;
- con capital cerrado apenas había reach económico;
- externalCashFlows demostraron que, cuando existe capital, QUALITY puede cambiar planes/ejecución;
- todavía no existe evidencia fresh suficiente para cambiar producción.

---

# 8. Antiguo future-forward fijo — VOID PRE-START

Documento:

`docs/quality_allocation_future_forward_v1_preregistration.md`

Estado:

**ANULADO ANTES DE PRIMER OUTCOME / NO CONSUMIÓ MUESTRA**

Motivo:

congelaba 64 nombres y confundía shortlist dinámica con universo fijo.

El job antiguo continúa ARCHIVED/read-only y no se reactiva.

---

# 9. QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — ARMADO / SIN PRIMER OUTCOME

Preregistro normativo:

`docs/quality_allocation_dynamic_future_forward_v1_preregistration.md`

Código:

- `scripts/qualityAllocationDynamicFutureForwardV1Protocol.ts`
- `scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts`
- `tests/qualityAllocationDynamicFutureForwardV1.unit.ts`

Estado actual:

**ARMED / PROSPECTIVE / PRODUCTION LEGACY / NO PROMOTION FROM PHASE A**

La primera ejecución todavía debe pasar el job integrado antes de crear la primera observación.

## Pregunta

¿El bridge congelado `QUALITY_ALLOCATION_BRIDGE_V1`, aplicado al mismo mercado dinámico y al mismo capital, distribuye prospectivamente mejor que LEGACY?

## Diseño congelado

- Phase A: allocation shots prospectivos independientes;
- frecuencia: MONTHLY;
- primer mes elegible: 2026-09;
- máximo: 12 checkpoints;
- notional de investigación: 13.000 EUR por checkpoint independiente;
- no es cartera real del usuario;
- no es aportación mensual;
- no se acumula entre meses;
- riesgo: MEDIUM;
- horizonte de decisión: 3 años;
- cash benchmark comparativo congelado: 2,5%;
- current dynamic discovery obligatorio;
- mínimo 64 candidatos promovidos fuera del seed;
- Top64 completo;
- REAL-only;
- mínimo 252 barras;
- datos <=7 días.

Ambos brazos comparten:

`scanner -> Top64 -> PortfolioCandidateGate LEGACY -> InvestmentDecisionEngine`

Sólo difiere la opción pasada al mismo `PortfolioDecisionEngine`:

- control: `LEGACY`;
- shadow: `QUALITY_ALLOCATION_BRIDGE_V1`.

## Causalidad de outcomes

Entrada económica:

**primera apertura REAL estrictamente posterior a la fecha real del checkpoint**.

Outcomes:

- 20 sesiones;
- 60 sesiones.

ETF/acciones bajo la semántica `ETF_ETC`:

- unidades enteras;
- comisión existente del broker;
- cash no ejecutado permanece cash.

Mutual funds:

- fraccionables según semántica vigente.

Cash residual:

`(1 + 0.025)^(N/252)`

No se fuerza un outcome si faltan datos REAL; queda pending.

## Inmutabilidad

Estado local:

`.runtime/qualityAllocationDynamicFutureForwardV1.json`

Cada observación contiene:

- pool descubierto;
- aceptados/rechazados;
- Top64 + hash;
- gate;
- decisión común + hash;
- plan LEGACY + hash;
- plan QUALITY + hash;
- hash de observación;
- hash encadenado con observación anterior.

Reglas:

- una observación por mes natural;
- rerun del mismo mes no puede sobreescribirla;
- outcomes resueltos son append-only y hasheados;
- manipulación o discontinuidad de cadena => FAIL;
- si falta la baseline después del primer mes elegible => FAIL CLOSED; no backfill.

## Interpretación Phase A

Phase A nunca puede promover producción.

Lectura direccional sólo con >=6 outcomes de 60 sesiones de checkpoints donde QUALITY cambió el plan.

`DIRECTIONALLY_POSITIVE_FOR_SEPARATE_PHASE_B` exige:

- mediana QUALITY-LEGACY > 0 pp;
- win rate >=60%.

Si no se cumple con reach suficiente:

`NO_DIRECTIONAL_EVIDENCE_FOR_PHASE_B`.

Si tras 12 observaciones no hay 6 outcomes changed-plan:

`INSUFFICIENT_REACH`.

Un resultado positivo sólo permitiría diseñar después otro Phase B blind; nunca promoción directa.

---

# 10. Centro de validación — job CURRENT

Único job CURRENT:

`quality-allocation-dynamic-future-forward-v1`

Nombre:

**QUALITY allocation · future-forward dinámico**

Orden de ejecución:

1. guard `qualityAllocationDynamicFutureForwardV1.unit`;
2. guard bridge QUALITY congelado;
3. guard Top64 dinámico;
4. guard `CORE_ARCHITECTURE_V1`;
5. guard `PortfolioCandidateGate`;
6. `npm run lint` / TypeScript;
7. checkpoint REAL prospectivo.

Un guard/TypeScript FAIL impide grabar el checkpoint.

No usar GitHub Actions ni agentes para este job.

---

# 11. Forward Risk

V8 conserva valor predictivo de downside.

Los FAIL económicos V8/V9/V10/V11 no borran esa información; fallaron políticas de monetización.

- V8 no vuelve como ON/OFF diario directo sin nueva justificación;
- V9/V10/V11 retiradas;
- no V12/V13 como tuning retrospectivo;
- V5/V7/V8 pueden reutilizarse más adelante sólo bajo protocolos nuevos.

No se mezclan en el future-forward QUALITY actual.

---

# 12. Mejoras futuras explícitamente DEFERRED

No abrir durante la fase actual de cierre del producto:

- USD/Nasdaq/NYSE discovery;
- detección temprana de multibaggers/SNDK-like;
- reducción del requisito de 252 sesiones para listings jóvenes;
- fundamentales/revisiones de beneficios/volumen como nuevas features;
- retuning de Reliability/Opportunity/Top64;
- nuevos Forward Risk V12/V13.

Estas ideas pueden estudiarse después de terminar la secuencia vigente de la app.

---

# 13. Próxima secuencia técnica

1. Ejecutar una única vez el job **QUALITY allocation · future-forward dinámico** para armar la primera observación prospectiva de 2026-09.
2. Si falla un guard o TypeScript, corregir implementación antes de consumir snapshot.
3. Si falla discovery current/live, no consumir el mes con fallback.
4. Si pasa, guardar la primera observación hasheada y dejar Phase A en `COLLECTING`.
5. No repetir el checkpoint durante el mismo mes salvo para verificar estado/resolver outcomes; nunca reemplaza la observación.
6. Mientras Phase A madura, continuar cerrando otras partes de la aplicación; no esperar meses bloqueando desarrollo.
7. Producción permanece `LEGACY` durante toda Phase A.
