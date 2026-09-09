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

# 9. QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — ARMADO / PRE-START

Preregistro normativo:

`docs/quality_allocation_dynamic_future_forward_v1_preregistration.md`

Código:

- `scripts/qualityAllocationDynamicFutureForwardV1Protocol.ts`
- `scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts`
- `scripts/qualityAllocationDynamicFutureForwardV1StateStore.ts`
- `tests/qualityAllocationDynamicFutureForwardV1.unit.ts`
- `src/components/ResearchValidationCenter.tsx`

Estado:

**ARMED / PROSPECTIVE / NO OBSERVATION / NO OUTCOME / PRODUCTION LEGACY / NO PROMOTION FROM PHASE A**

El 2026-09-09 se realizó una segunda auditoría **antes de arrancar**. Se comprobó directamente que el archivo prospectivo no existía todavía en `replay-results`; no había muestra consumida. La auditoría detectó y corrigió omisiones de persistencia, timing, continuidad de código, madurez y pricing de outcomes.

## Pregunta

¿`QUALITY_ALLOCATION_BRIDGE_V1`, aplicado al mismo mercado dinámico y al mismo capital, distribuye prospectivamente mejor que LEGACY?

## Diseño congelado

- Phase A: allocation shots independientes;
- frecuencia: MONTHLY;
- primer mes elegible: 2026-09;
- máximo: 12 checkpoints;
- meses naturales consecutivos obligatorios;
- ventana de alta de una observación: **día 9, 22:30-24:00 Europe/Madrid**;
- no backfill ni salto de meses;
- notional research: 13.000 EUR por checkpoint;
- no es cartera real;
- no es aportación mensual;
- no se acumula;
- riesgo MEDIUM;
- horizonte 3 años;
- cash comparativo congelado 2,5%;
- discovery current/live obligatorio;
- mínimo 64 promovidos fuera del seed;
- Top64 completo;
- REAL-only;
- mínimo 252 barras;
- datos <=7 días.

Ambos brazos comparten:

`scanner -> Top64 -> PortfolioCandidateGate LEGACY -> InvestmentDecisionEngine`

Sólo cambia en el mismo `PortfolioDecisionEngine`:

- control: `LEGACY`;
- shadow: `QUALITY_ALLOCATION_BRIDGE_V1`.

## Persistencia autoritativa

El estado ya no depende de `.runtime`.

Autoridad:

- repo `fmaranis/Trading`;
- branch `replay-results` por defecto;
- `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`.

`.runtime/qualityAllocationDynamicFutureForwardV1.json` = caché local únicamente.

`GITHUB_REPLAY_SYNC_TOKEN` es obligatorio para leer/escribir el estado durable. Un fallo de credenciales/escritura impide considerar consumido el checkpoint.

La escritura usa el blob SHA previamente leído para impedir overwrite concurrente silencioso.

## Continuidad de implementación

El protocolo congela no sólo parámetros sino la implementación crítica con `QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1_FROZEN_GIT_BLOBS`.

Incluye discovery, market-data route/provider, scanner, QUALITY, gate, consensus, timing, decision engine, allocator, costes, cash, analytics/regime/alignment, runner y state-store.

Antes de cada ejecución se recalculan Git blob SHA-1. Si alguno cambia:

`QUALITY_FF_FROZEN_IMPLEMENTATION_CHANGED`

La Phase A existente se detiene; no se mezclan políticas diferentes en la misma muestra.

## Causalidad y pricing de outcomes

Entrada:

**primera apertura REAL posterior a `checkpointRunDate`**.

La ventana termina antes de medianoche para que esta regla sea inequívoca con barras diarias.

Horizontes:

- 20 sesiones;
- 60 sesiones.

Para unidades/comisión se usa el **open RAW** de la sesión de ejecución.

Para retorno posterior:

`adjustedClose_mark / adjustedOpen_entry`

Tratamiento congelado:

`RAW_NEXT_OPEN_FOR_UNIT_SIZING_PLUS_ADJUSTED_TOTAL_RETURN_FACTOR_TO_MARK`.

Cash residual:

`(1 + 0.025)^(N/252)`

Si ambos brazos quedan 100% cash, un ticker REAL del Top64 sirve sólo como calendario para comprobar que realmente han transcurrido 20/60 sesiones; no se resuelve el futuro anticipadamente.

No se fuerza outcome si falta información REAL.

## Inmutabilidad

Cada observación guarda pool, Top64, gate, decisión común, planes LEGACY/QUALITY, fingerprint de implementación, hashes propios y chain hash.

Reglas:

- una observación por mes;
- meses consecutivos;
- rerun no reemplaza snapshot;
- outcomes append-only y hasheados;
- discontinuidad/tampering => FAIL;
- baseline durable ausente después del comienzo => FAIL CLOSED;
- ventana perdida => protocolo invalidado; no backfill.

## Interpretación Phase A

No se emite veredicto económico definitivo antes de 12 checkpoints.

Después:

1. `<6` checkpoints con `planChanged` -> `INSUFFICIENT_REACH`;
2. `>=6` pero algún changed-plan outcome 60s pendiente -> `AWAITING_60_SESSION_MATURITY`;
3. todos maduros -> lectura económica final.

`DIRECTIONALLY_POSITIVE_FOR_SEPARATE_PHASE_B` exige:

- mediana QUALITY-LEGACY >0 pp;
- win rate >=60%.

Si no se cumplen ambas con reach suficiente:

`NO_DIRECTIONAL_EVIDENCE_FOR_PHASE_B`.

Ninguna etiqueta autoriza promoción directa. Producción continúa `LEGACY`.

---

# 10. Centro de validación — único job CURRENT

ID:

`quality-allocation-dynamic-future-forward-v1`

Nombre:

**QUALITY allocation · future-forward dinámico**

Orden:

1. guard `qualityAllocationDynamicFutureForwardV1.unit`;
2. guard bridge QUALITY congelado;
3. guard Top64 dinámico;
4. guard `CORE_ARCHITECTURE_V1`;
5. guard `PortfolioCandidateGate`;
6. `npm run lint` / TypeScript;
7. checkpoint REAL prospectivo.

El guard prospectivo cubre 21 invariantes, incluidos ventana fija, manifest de blobs, meses consecutivos, cadena/hash, no-rewrite, reach y madurez final.

Un guard/TypeScript FAIL impide ejecutar el checkpoint REAL.

El POST de ejecución devuelve `RESEARCH_VALIDATION_LOCAL_ONLY` si `NODE_ENV=production`; no puede consumirse una muestra prospectiva desde el despliegue público.

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

1. Sincronizar el HEAD canónico actual y abrir el único job **QUALITY allocation · future-forward dinámico**.
2. Sólo una observación nueva es válida en la ventana mensual congelada del día 9, 22:30-24:00 Europe/Madrid.
3. Guards, manifest de blobs y TypeScript deben pasar antes del snapshot REAL.
4. Si faltan/son inválidas las credenciales de persistencia durable, no se consume observación.
5. Si discovery current/live falla, puede reintentarse únicamente dentro de la misma ventana; nunca se sustituye por fallback.
6. Si el mes esperado se pierde, no se salta ni se reconstruye: esta Phase A queda invalidada y requeriría un protocolo nuevo.
7. Tras un checkpoint válido, estado `COLLECTING`; reruns posteriores sólo verifican estado/maduran outcomes.
8. Mientras Phase A madura, continuar cerrando otras partes no congeladas de la aplicación.
9. Producción permanece `LEGACY` durante toda Phase A.
