# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar primero el HEAD real, leer este archivo y después consultar los documentos enlazados. Si un chat antiguo contradice el repositorio actual, manda el repositorio.

# 1. Invariante principal de producto

Documento normativo:

`docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`

La aplicación **NO** invierte dentro de una whitelist fija de 64 nombres.

Objetivo:

> buscar dinámicamente el mercado actual, identificar los activos más atractivos y fiables disponibles en ese momento, formar una shortlist dinámica de hasta 64 candidatos y decidir después si merece la pena entrar en alguno, cuánto asignar y por qué.

Cadena canónica productiva:

`mercado actual`
`-> AssetUniverseScanner`
`-> Top64 dinámico`
`-> PortfolioCandidateGate`
`-> InvestmentDecisionEngine`
`-> PortfolioDecisionEngine`
`-> evaluatePortfolioDecision`
`-> CORE_GATE_V1`
`-> CORE_ARCHITECTURE_V1`
`-> ejecución y seguimiento`

Reglas permanentes:

- 64 = target/máximo dinámico, no nombres permanentes.
- Las identidades pueden cambiar en cada evaluación.
- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` = seed/bootstrap/fallback, no definición del mercado.
- Top64 no autoriza compra.
- Cash hurdle, consenso, timing, gates y allocation mantienen autoridad.
- “No comprar nada” sigue siendo una salida válida.
- Yahoo Search/Lookup actual nunca reconstruye retrospectivamente el universo histórico.
- No deben existir superficies productivas capaces de emitir recomendaciones por una cadena paralela.

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

Entrada productiva de cartera:

`evaluatePortfolioDecision(...)`

Esta función ejecuta:

`PortfolioDecisionEngine.evaluate -> applyCoreGateV1 -> applyCoreArchitectureV1`.

---

# 4. Mercado dinámico current/live — CERRADO / PASS FINAL

Documentos:

- `docs/dynamic_market_top64_v1_outcome.md`
- `docs/dynamic_market_top64_v1_final_outcome.md`

Estado:

**DISCOVERY PASS / BREADTH PASS / TOP64 PASS / DEDUPE PASS / GATE-INTEGRATION PASS / ARCHIVED**

Run final 2026-09-09:

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

Ranking congelado durante esa fase:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

`0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Reliability/Opportunity sólo desempatan el Top64 productivo.

No utilizar snapshots del 2026-09-09 para retunear esa fórmula.

Identidad/diversificación current/live:

- aliases/cross-listings evidentes se deduplican antes del Top64;
- acciones individuales current/live no quedan limitadas por la etiqueta amplia `EUROPE_EQUITY` en `PortfolioCandidateGate`;
- ETF/fondos conservan cap legacy de 2 por categoría;
- histórico/research conserva semántica anterior.

El job `dynamic-market-top64-v1` está ARCHIVED/read-only.

### Limitación de metadata detectada

Yahoo Lookup no aporta todavía una taxonomía sectorial robusta para todos los ETF/acciones descubiertos. En el snapshot prospectivo 2026-09, por ejemplo, `OPEN_EXV1_DE` apareció con categoría genérica `GLOBAL_EQUITY` aunque económicamente es un ETF sectorial bancario europeo.

Esto **no** puede convertirlo en core estructural porque `STRATEGIC_GROWTH_CORE_ASSET_IDS` es una lista explícita y EXV1 no pertenece a ella. Sí puede afectar comparaciones/caps de categoría. No inventar sectores sin metadata fiable. Esta limitación queda registrada para una corrección separada; no se modifica ahora ninguno de los 25 archivos congelados del future-forward.

---

# 5. Replay histórico — causal, con limitación de universo

El replay decide en cada fecha histórica usando sólo datos disponibles hasta ese día.

En cada `decisionDate`:

- trunca barras a `<= decisionDate`;
- exige mínimo histórico;
- calcula momentum/volatilidad/drawdown causalmente;
- aplica `PortfolioCandidateGate`;
- llama `InvestmentDecisionEngine` con timestamp histórico;
- llama la cadena de portfolio correspondiente;
- ejecuta después de señal.

No reconstruye todavía el mercado completo point-in-time de aquella fecha.

Yahoo Search/Lookup actual **no participa** en replay histórico.

Persiste survivorship hasta disponer de instrument master point-in-time con altas/bajas/delistings históricos.

---

# 6. External cash flows — PASS / CONSUMIDO / ARCHIVADO

Documento:

`docs/replay_explicit_cash_flows_v1_outcome.md`

Resultado:

`PASS_EXPLICIT_CASH_FLOW_INTEGRATION`

Comprobado:

- `MONTHLY` no crea aportaciones;
- brazo cerrado: 0 flujos implícitos;
- `externalCashFlows` explícitos y causales;
- aportaciones no cuentan como rentabilidad;
- benchmark cash independiente;
- REAL-only;
- sin `OPEN_*` retrospectivos.

Reach agregado 10y/6y/3y:

- gates con capital desplegable: 3 -> 22;
- notional ejecutado adicional: +212.386,21 EUR;
- QUALITY cambió 10 planes y 23 fechas ejecutadas;
- efecto económico observado pequeño.

Producción sigue LEGACY.

---

# 7. Opportunity / QUALITY — historial metodológico

Consumido:

- `QUALITY_V1`: información útil, reach/economía insuficientes para promoción;
- `SLOPE_V1`: no justificó promoción;
- `QUALITY_ALLOCATION_BRIDGE_V1`: research-only dentro de `PortfolioDecisionEngine`.

Fórmula congelada:

`candidateQualityAdjustment = (reliability - 50)*0.10 + (opportunity - 50)*0.20`

`qualityMultiplier = clamp(1 + adjustment/100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

No retunear 0.10 / 0.20 / 0.85 / 1.15 usando ventanas observadas.

Producción continúa `LEGACY`.

---

# 8. Antiguo future-forward fijo — VOID PRE-START

Documento:

`docs/quality_allocation_future_forward_v1_preregistration.md`

Estado:

**ANULADO ANTES DE PRIMER OUTCOME / NO CONSUMIÓ MUESTRA**

Motivo: congelaba 64 nombres y confundía shortlist dinámica con universo fijo.

No se reactiva.

---

# 9. QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — COLLECTING

Preregistro normativo congelado:

`docs/quality_allocation_dynamic_future_forward_v1_preregistration.md`

Estado corriente separado del preregistro:

`docs/quality_allocation_dynamic_future_forward_v1_status.md`

Código:

- `scripts/qualityAllocationDynamicFutureForwardV1Protocol.ts`
- `scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts`
- `scripts/qualityAllocationDynamicFutureForwardV1StateStore.ts`
- `tests/qualityAllocationDynamicFutureForwardV1.unit.ts`
- `src/components/ResearchValidationCenter.tsx`

Estado actual:

**COLLECTING / 1 DE 12 OBSERVACIONES / 0 OUTCOMES MADUROS / PRODUCTION LEGACY / NO PROMOTION FROM PHASE A**

### Primer checkpoint válido

Fecha local: **2026-09-09 23:37 Europe/Madrid**.

Persistencia autoritativa:

- repo: `fmaranis/Trading`;
- branch: `replay-results`;
- path: `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`;
- durable commit: `fbae24fd46c751a71e059bb4f99b2de73c784dae`;
- remote blob: `4006754a0d627f0846ef6d21a340f7c2ea9c633f`;
- state SHA-256: `f3fd8e4d7ce4825351a23908c460285431abb751851ed9034ac2ff903a7e2bec`.

Fingerprints:

- protocol: `1220601b4d5fead26b68c48a198c7a5bac2220898c99fef1171452653d8ac82b`;
- implementation: `ba1b286ac6920495b7b5d853b6ca78fb5e1de356fc5ab3d4fb56bc34e1e51bff`;
- frozen critical sources: 25.

Snapshot:

- discovery promoted: 99;
- scanned: 163;
- accepted REAL: 158;
- rejected: 5;
- Top64: 64;
- gate LEGACY eligible/selected: 11/11;
- market regime: `BULL_LOW_VOL`;
- decision confidence: HIGH 95;
- production policy remains LEGACY.

Allocator probe:

LEGACY:

- new investment: 1.728,4054 EUR;
- residual planned cash: 11.271,5946 EUR;
- contributions: 4.

QUALITY:

- new investment: 1.726,1896 EUR;
- residual planned cash: 11.273,8104 EUR;
- contributions: 4.

`planChanged = true`.

Absolute planned notional delta: 2,6887 EUR.

EXV1.DE en ambos brazos:

- `HIGH_CONVICTION`;
- `ENTRY_STRONG`;
- initial fraction 50%;
- amount 650 EUR.

QUALITY elevó prioridad relativa pero no cambió el importe por caps compartidos.

No existe todavía outcome 20/60 sesiones; no hay conclusión económica.

### Alcance metodológico

Phase A es deliberadamente un **allocation probe**:

`Yahoo current/live -> scanner -> Top64 -> PortfolioCandidateGate LEGACY -> InvestmentDecisionEngine -> PortfolioDecisionEngine`

El mismo `PortfolioDecisionEngine.evaluate(...)` se ejecuta con:

- `LEGACY`;
- `QUALITY_ALLOCATION_BRIDGE_V1`.

Sólo cambia `opportunityAllocationPolicy`.

No es una validación end-to-end de `CORE_ARCHITECTURE_V1`; no puede promocionar producción. Una eventual Phase B separada sería necesaria incluso con evidencia direccional positiva.

### Ventana y continuidad

- cadencia MONTHLY;
- máximo 12 checkpoints;
- meses consecutivos;
- nueva observación sólo día 9, 22:30-24:00 Europe/Madrid;
- no backfill;
- una observación por mes;
- duplicate month no overwrite;
- hash-chain;
- outcomes append-only;
- estado durable en GitHub;
- RAW next-open para unidades/comisión;
- adjusted total-return factor para 20/60 sesiones.

Siguiente observación nueva válida: **2026-10-09 22:30-24:00 Europe/Madrid**.

No repetir septiembre.

---

# 10. Superficie productiva de recomendaciones — UNIFICACIÓN CORREGIDA 2026-09-09

Se detectó que `App.tsx` todavía montaba componentes heredados capaces de mantener una arquitectura paralela de producto, aunque la cadena canónica nueva ya existía.

Problema encontrado:

- `GrowthTradingBot` usaba `ALL_AVAILABLE_ASSETS + LiveSimulationEngine`;
- antiguo `InvestmentDecisionCenter` escaneaba su propio universo y llamaba directamente a `InvestmentDecisionEngine`;
- `PortfolioOverview` mostraba un estado `PortfolioEngine` simulado distinto de `UserPortfolioService`.

Esto era incompatible con la regla de una sola cadena productiva.

Corrección aplicada sin tocar los 25 blobs congelados del future-forward:

- `GrowthTradingBot.tsx` = compatibility adapter -> `InteractiveInvestmentDecisionCenter`;
- `InvestmentDecisionCenter.tsx` = compatibility adapter -> `InteractiveInvestmentDecisionCenter`;
- `PortfolioOverview.tsx` = compatibility adapter -> `InteractiveInvestmentDecisionCenter`.

Las superficies operativas del centro canónico usan:

- `CurrentOpportunityAlertsPanel -> evaluatePortfolioDecision`;
- `RealPurchaseRegistrationPanel -> evaluatePortfolioDecision`;
- `PortfolioExecutionPlanPanel -> evaluatePortfolioDecision`.

Por tanto las recomendaciones productivas convergen en:

`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> evaluatePortfolioDecision -> ejecución/seguimiento`.

Guard añadido:

`tests/productDecisionSurface.unit.ts`

Protege 15 invariantes y falla si se vuelve a activar `LiveSimulationEngine`, `ALL_AVAILABLE_ASSETS` o un scanner/decision center paralelo en esas superficies.

### Deuda residual de producto

`App.tsx`, `Navbar`, `RiskAnalysisCenter`, `MarketTracker`, `AlertsManager` y algunos modales conservan todavía tipos/estado heredados de simulación para funciones secundarias. Tras la corrección anterior **ya no deben ser fuente de una recomendación productiva de compra**, pero la limpieza visual/estado secundario queda pendiente para evitar etiquetas como “Bot 2X” y métricas de la antigua cartera simulada.

No reintroducir ninguna recomendación desde esos módulos. La única recomendación accionable debe venir del centro canónico.

---

# 11. Centro de validación — único job CURRENT

ID:

`quality-allocation-dynamic-future-forward-v1`

Nombre:

**QUALITY allocation · future-forward dinámico**

El job ejecuta guards rápidos, TypeScript/lint y el checkpoint REAL prospectivo. No usar GitHub Actions ni agentes.

Tras el checkpoint 2026-09 ya registrado, un rerun en el mismo mes nunca crea otra observación; sólo puede verificar estado o madurar outcomes.

---

# 12. Forward Risk

V8 conserva valor predictivo de downside.

Los FAIL económicos V8/V9/V10/V11 no borran esa información; fallaron políticas de monetización.

- V8 no vuelve como ON/OFF diario directo sin nueva justificación;
- V9/V10/V11 retiradas;
- no V12/V13 como tuning retrospectivo;
- V5/V7/V8 pueden reutilizarse más adelante sólo bajo protocolos nuevos.

No se mezclan en el future-forward QUALITY actual.

---

# 13. Mejoras futuras explícitamente DEFERRED

No abrir hasta cerrar la secuencia vigente:

- USD/Nasdaq/NYSE discovery;
- detección temprana de multibaggers/SNDK-like;
- reducción del requisito de 252 sesiones para listings jóvenes;
- fundamentales/revisiones de beneficios/volumen como nuevas features;
- retuning de Reliability/Opportunity/Top64;
- nuevos Forward Risk V12/V13.

---

# 14. Próxima secuencia técnica

1. Verificar una sola vez la corrección de superficie productiva con `tests/productDecisionSurface.unit.ts` + TypeScript/lint en local.
2. No repetir el checkpoint de septiembre: ya está persistido y consumido como primera observación.
3. Mientras madura el future-forward, terminar la limpieza de UI/estado heredado sin tocar los 25 blobs metodológicos congelados.
4. No ejecutar una recomendación real si la pantalla no permite identificar que procede del centro canónico y del `evaluatePortfolioDecision` actual.
5. Registrar como deuda separada la taxonomía genérica de algunos `OPEN_*` descubiertos por Lookup; no inventar sectores ni modificar discovery congelado dentro de Phase A.
6. Próximo checkpoint nuevo: 2026-10-09, 22:30-24:00 Europe/Madrid.
7. Producción permanece `LEGACY` durante toda Phase A.
