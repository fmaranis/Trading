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
`-> plan ejecutable`
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
- `COMPRAR AHORA / VENDER AHORA / TRASPASAR AHORA` sólo puede mostrarse si existe una línea ejecutable después de los controles de ejecución disponibles; una propuesta teórica suprimida por coste, títulos enteros, cash, datos o fiscalidad debe mostrarse como `REVIEW`, no como orden.

---

# 2. Reglas no negociables

- Nunca usar GitHub Actions para replays o validaciones largas.
- Los cálculos largos los ejecuta el motor local/backend, normalmente `ResearchValidationCenter`.
- El usuario **no dispone de terminal operativo** para ejecutar comandos manualmente. No pedirle `npm`, `npx`, `tsx`, `git` ni comandos equivalentes. Las comprobaciones necesarias deben integrarse como jobs del `ResearchValidationCenter` y ejecutarse desde la propia app con un botón.
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
- La UI no puede inventar un mínimo técnico de capital. Si la liquidez real es 0 €, debe mostrarse 0 € y no generarse una orden. Un notional técnico interno sólo puede utilizarse para análisis adimensional y debe quedar explícitamente neutralizado en todos los importes monetarios visibles/productivos.

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

La UI productiva añade después un único plan de ejecución:

`buildPortfolioExecutionPlan -> applyTaxAwareExecutionOverlay`.

Ese plan puede convertir una intención teórica en `REVIEW` por ejecución/fiscalidad, pero no vuelve a seleccionar activos ni crea otra estrategia.

---

# 4. Entrada web y superficie productiva — CERRADA / PASS FINAL 2026-09-11

La ruta real de producto es:

`index.html -> src/decisionMain.tsx -> InteractiveInvestmentDecisionCenter + ResearchValidationCenter`

Hallazgo de auditoría:

- `index.html` no utilizaba el antiguo `App.tsx`;
- el `App.tsx` heredado sólo seguía siendo accesible mediante `/legacy.html`;
- `/legacy.html` era la vía restante hacia la antigua experiencia `Bot 2X / PortfolioEngine / LiveSimulationEngine`.

Corrección aplicada:

- `/legacy.html` ya no carga `src/main.tsx`; redirige a `/` y queda `noindex`;
- `decisionMain.tsx` no enlaza a Legacy;
- `/portfolio.html` se conserva como laboratorio cuantitativo separado, sin autoridad para emitir la recomendación productiva de cartera real;
- la única superficie accionable normal es `InteractiveInvestmentDecisionCenter`.

Los compatibility adapters de `GrowthTradingBot`, antiguo `InvestmentDecisionCenter` y `PortfolioOverview` permanecen como defensa adicional.

Estado de validación:

- inspección estática completada;
- `Producto · cierre rápido` ejecutado desde la app sobre el cierre de 2026-09-11: **PASSED** completo;
- tras corregir la identidad de acciones dinámicas/current-live, el mismo `Producto · cierre rápido` se volvió a ejecutar sobre HEAD `7c5004f8f8039d3cdf13c707ba0e2aa2f9c91344`: **PASSED** completo;
- resultados de esa segunda ejecución: superficie 27/27, decisión productiva 20/20, plan de ejecución 29/29, cartera 24/24, salud de posiciones 25/25, broker 7/7, fiscalidad 7/7 y `tsc --noEmit` PASS;
- prueba manual en dispositivo móvil 2026-09-11: exportación JSON y controles principales responden correctamente;
- no repetir este cierre salvo que un cambio posterior afecte materialmente a la superficie productiva, salud de posiciones, plan ejecutable, broker/fiscalidad o export móvil.

---

# 5. Acción productiva visible — CIERRE ARQUITECTÓNICO IMPLEMENTADO 2026-09-10

La auditoría posterior al primer cierre encontró tres problemas reales:

1. La tarjeta “decisión de hoy” mezclaba compras de `evaluatePortfolioDecision`, ventas directas de `positionHealth` y rotaciones de `PortfolioRotationReviewEngine`.
2. Varios componentes recalculaban `evaluatePortfolioDecision()` por separado.
3. Una contribución teórica podía mostrarse como “COMPRAR AHORA” antes de que títulos enteros, costes o fiscalidad la convirtieran en `REVIEW`.

Corrección final aplicada:

- `MarketUtilityDashboard` calcula **una sola vez** `portfolioDecision = evaluatePortfolioDecision(...)`;
- el mismo dashboard construye **un solo** `executionPlan = buildPortfolioExecutionPlan(...) -> applyTaxAwareExecutionOverlay(...)`;
- `CurrentOpportunityAlertsPanel`, `RealPurchaseRegistrationPanel` y `PortfolioExecutionPlanPanel` reciben esos mismos objetos y no vuelven a calcular cartera ni candidate gate;
- `PortfolioExecutionPlanPanel` ya no vuelve a ejecutar `PortfolioCandidateGate(..., 1000)`, `StrategyConsensusEngine` ni `evaluatePortfolioDecision`;
- `CurrentOpportunityAlertsPanel` no usa `PortfolioRotationReviewEngine` para la orden principal;
- `CurrentOpportunityAlertEngine` permanece como metadata/evidencia secundaria de oportunidad, sin autoridad para crear la orden de cartera;
- compras visibles como **COMPRAR AHORA** = líneas `BUY_ETF / SUBSCRIBE_FUND` realmente pendientes del plan ejecutable;
- ventas visibles como **REDUCIR/SALIR AHORA** = líneas `SELL_ETF / REDEEM_FUND` realmente pendientes;
- traspasos visibles = líneas `TRANSFER_FUND` realmente pendientes;
- líneas `REVIEW` quedan en un bloque explícito “no son orden ejecutable hoy”;
- la tarjeta distingue `importe teórico del motor` de `importe ejecutable`, evitando que redondeo por títulos/comisiones se confunda con sizing productivo;
- contribuciones de core añadidas o redirigidas por `CORE_GATE_V1 / CORE_ARCHITECTURE_V1` no se ocultan por faltar un `CurrentOpportunityAlert` original;
- la explicación de cadena está plegada dentro de la misma tarjeta, después de la acción;
- `UserPortfolioPanel` y `PilotOperationsPanel` ya no recalculan una segunda decisión productiva;
- `DecisionGuardrailsPanel` ya no ejecuta un mini-backtest cliente paralelo: sólo explica gates current/live y remite la investigación histórica al replay integrado;
- un instrumento marcado manualmente como no disponible en MyInvestor se convierte en `REVIEW` en el único plan ejecutable y el cambio se propaga a la superficie principal.

Jerarquía de producto:

1. controles básicos;
2. finalizar salud de posiciones;
3. **decisión ejecutable de hoy**;
4. registro de la ejecución / cartera real;
5. explicación de cash, metodología y controles técnicos.

La app no muestra órdenes mientras `PortfolioPositionHealthService` sigue calculando. Si falla la salud de cartera, la decisión operativa queda bloqueada en vez de enseñar una recomendación parcial.

El `portfolio` que alimenta el resultado canónico se memoiza mientras la misma salud/fecha siga vigente para evitar regenerar IDs de líneas de ejecución por renders secundarios.

### Capital cero

`portfolioDeployableCapital()` conserva ahora 0 € reales; ya no fuerza `Math.max(1, ...)`.

Como el `InvestmentDecisionEngine` congelado exige capital estrictamente positivo para escalar importes, la UI usa 1 € únicamente como notional analítico interno cuando la liquidez real es 0 y neutraliza inmediatamente todos los importes monetarios a 0. Ese camino queda marcado con `NO_DEPLOYABLE_CAPITAL_ANALYTICAL_WEIGHTS_ONLY` y no genera órdenes.

`DecisionGuardrailsPanel` ya no realiza replay histórico cliente ni inventa capital para hacerlo.

### Identidad de acciones dinámicas — CORREGIDA / PASS 2026-09-11

El diagnóstico HFG detectó que una acción individual descubierta dinámicamente podía heredar `isDiversifiedCore=true` por su categoría amplia `EUROPE_EQUITY`.

Corrección integrada, sin crear módulos ni políticas nuevas:

- `dynamicPortfolioDiscovery` conserva `currentDiscoveryQuoteType` de Yahoo para activos `DYNAMIC_*` y migra de forma compatible los ya persistidos;
- `PortfolioPositionHealthService` reconoce acciones dinámicas `DYNAMIC_*` por identidad y acciones current/live `OPEN_*` mediante la metadata `EQUITY` ya existente;
- una acción individual ya no hereda protección de core por una categoría amplia;
- un ETF dinámico mantiene tratamiento diversificado/core cuando corresponde;
- el replay existente reutiliza la misma `classifyPositionHealth`, por lo que la clasificación auditada `positionIsDiversifiedCore` queda corregida sin crear un replay paralelo.

Guards actuales relevantes:

- `tests/productDecisionSurface.unit.ts`: **20 invariantes**;
- `tests/productSurfaceClosureV1.unit.ts`: **27 invariantes**;
- `tests/userPortfolio.unit.ts`: **24 invariantes**;
- `tests/portfolioPositionHealth.unit.ts`: **25 invariantes**.

### Job integrado de cierre

`ResearchValidationCenter` expone el mismo job existente:

`Producto · cierre rápido`

Ejecuta, en backend local y sin intervención de terminal del usuario:

- `productSurfaceClosureV1`;
- `productDecisionSurface`;
- `portfolioExecutionPlan`;
- `userPortfolio`;
- `portfolioPositionHealth`;
- `brokerAvailability`;
- `taxAwareExecutionOverlay`;
- TypeScript (`npm run lint`).

No ejecuta replay, no consulta Yahoo live, no ejecuta Future Forward, no crea checkpoint y no escribe en `replay-results`.

Resultado final tras la corrección de identidad dinámica, 2026-09-11: **PASSED**. No debe repetirse mientras no cambie materialmente esta superficie.

---

# 6. JSON y móvil — PASS FINAL / Future Forward — COLLECTING

## Centro de validación

La descarga del `ResearchValidationCenter` no crea Blob ni simula un click desde React.

Ruta nativa:

`GET /api/alerts/research-validation/jobs/:id/result.json`

El backend responde con:

- JSON del resultado registrado;
- `Content-Disposition: attachment`;
- `Cache-Control: no-store`.

La UI utiliza un `<a href=.../result.json>` normal y lo presenta como **Evidencia JSON**, no como la única respuesta comprensible.

### Resultado humano de Future Forward

`ResearchValidationCenter` interpreta en pantalla el resultado de `QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1`:

- observaciones actuales / 12;
- si esta ejecución creó o no una observación;
- estado `ALREADY_RECORDED / PROSPECTIVE_STATE_VERIFIED_NO_REWRITE / BEFORE_WINDOW / AFTER_WINDOW`;
- outcomes 20s y 60s maduros;
- persistencia durable;
- número de fuentes congeladas/fingerprint;
- próxima ventana esperada (`día 9, 22:30–24:00 Madrid`).

Para el caso ya observado el 2026-09-10 debe mostrar de forma legible **ESTADO VERIFICADO · SIN REESCRIBIR**, **NO CREÓ OBSERVACIÓN**, 1/12 y la siguiente ventana de octubre. El ZIP/JSON queda como evidencia secundaria.

El botón se denomina `Comprobar / ejecutar checkpoint` para reflejar que, fuera de una ventana válida o si el mes ya existe, la acción puede limitarse a verificar estado sin consumir una observación.

## Replay histórico

La sesión del replay vive en `localStorage`, por lo que la exportación continúa siendo client-side mediante:

`src/jsonDownload.ts`.

Auditoría correctiva 2026-09-10:

- `exportSession` es síncrono;
- serialización + `downloadJsonFile(...)` ocurren dentro de la tarea original del toque;
- no existe `await` ni `requestAnimationFrame` antes de iniciar la descarga;
- la Blob URL no se revoca inmediatamente y se conserva 30 s.

Prueba física en móvil 2026-09-11: **PASS**. La exportación JSON funciona en el dispositivo real y los controles principales responden correctamente al toque.

## Base móvil

`src/index.css` y la superficie principal incluyen:

- `touch-action: manipulation`;
- `touch-target` mínimo 44 px en controles principales;
- inputs/selects a 16 px en móvil para evitar zoom de foco;
- safe-area inferior;
- scrolling táctil horizontal;
- header principal compacto;
- botones importantes apilados cuando procede.

El tamaño táctil es ergonomía; el cierre móvil final se apoya además en la prueba física PASS de 2026-09-11.

---

# 7. Mercado dinámico current/live — CERRADO / PASS FINAL

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

Ranking:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

`0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Reliability/Opportunity sólo desempatan el Top64 productivo.

No utilizar snapshots del 2026-09-09 para retunear esa fórmula.

### Limitación de metadata

Yahoo Lookup no aporta todavía una taxonomía sectorial robusta para todos los activos descubiertos. En 2026-09 `OPEN_EXV1_DE` apareció como `GLOBAL_EQUITY` aunque económicamente es un ETF sectorial bancario europeo.

Esto no puede convertirlo en core estructural porque el core utiliza IDs explícitos, pero sí puede afectar caps/comparaciones de categoría. Queda como deuda separada y no se toca durante el future-forward congelado.

La corrección de 2026-09-11 de identidad de acciones `OPEN_*` no modifica el discovery ni su ranking: únicamente impide que una acción individual ya identificada como `EQUITY` herede semántica de core diversificado en salud de posiciones.

---

# 8. Replay histórico — causal, con limitación de universo

En cada `decisionDate`:

- usa sólo barras `<= decisionDate`;
- calcula señales con histórico disponible;
- aplica `PortfolioCandidateGate`;
- llama `InvestmentDecisionEngine` con timestamp histórico;
- aplica la cadena de portfolio correspondiente;
- ejecuta después de señal.

Yahoo Search/Lookup **actual** no reconstruye el universo histórico.

Persiste survivorship hasta disponer de instrument master point-in-time con altas, bajas y delistings.

La corrección de identidad `DYNAMIC_*`/`OPEN_*` no crea un nuevo replay: la salud histórica sigue usando la misma función pura `classifyPositionHealth` del flujo integrado.

---

# 9. External cash flows — PASS / CONSUMIDO / ARCHIVADO

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

# 10. Opportunity / QUALITY — historial metodológico

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

# 11. QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — COLLECTING

Preregistro:

`docs/quality_allocation_dynamic_future_forward_v1_preregistration.md`

Estado corriente:

`docs/quality_allocation_dynamic_future_forward_v1_status.md`

Estado:

**COLLECTING / 1 DE 12 OBSERVACIONES / 0 OUTCOMES MADUROS / PRODUCTION LEGACY / NO PROMOTION FROM PHASE A**

Primer checkpoint válido:

**2026-09-09 23:37 Europe/Madrid**.

Persistencia autoritativa:

- branch `replay-results`;
- path `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`;
- durable commit `fbae24fd46c751a71e059bb4f99b2de73c784dae`;
- remote blob `4006754a0d627f0846ef6d21a340f7c2ea9c633f`;
- state SHA-256 `f3fd8e4d7ce4825351a23908c460285431abb751851ed9034ac2ff903a7e2bec`.

Fingerprints:

- protocol `1220601b4d5fead26b68c48a198c7a5bac2220898c99fef1171452653d8ac82b`;
- implementation `ba1b286ac6920495b7b5d853b6ca78fb5e1de356fc5ab3d4fb56bc34e1e51bff`;
- **25 archivos metodológicos congelados**.

Snapshot inicial:

- discovery promoted: 99;
- scanned: 163;
- REAL accepted: 158;
- rejected: 5;
- Top64: 64;
- gate LEGACY 11/11;
- market regime `BULL_LOW_VOL`;
- production `LEGACY`.

Allocator probe:

- LEGACY: 1.728,4054 EUR de inversión nueva;
- QUALITY: 1.726,1896 EUR;
- `planChanged = true`;
- delta absoluto de notional planificado: 2,6887 EUR;
- EXV1.DE: `HIGH_CONVICTION`, `ENTRY_STRONG`, fracción inicial 50%, 650 EUR en ambos brazos.

No hay todavía conclusión económica.

Phase A es deliberadamente un **allocation probe** y no una validación end-to-end suficiente para promoción.

### Verificación adicional 2026-09-10

El usuario ejecutó de nuevo el job desde la app y aportó su artefacto. La ejecución terminó `PASSED` con:

- `PROSPECTIVE_STATE_VERIFIED_NO_REWRITE`;
- `observationRecordedThisRun = false`;
- `observationStatus = ALREADY_RECORDED`;
- observaciones = 1/12;
- sin nueva escritura/observación de septiembre;
- outcomes 20/60 todavía pendientes;
- token durable disponible en ese runtime.

Por tanto, el problema previo de `GITHUB_REPLAY_SYNC_TOKEN` estaba resuelto en esa ejecución. No asumir que un secreto estará disponible en otro runtime sin comprobar el preflight.

Siguiente observación nueva válida:

**2026-10-09 22:30-24:00 Europe/Madrid**.

No repetir septiembre.

### Integridad tras cambios de producto 2026-09-11

La comparación GitHub desde el estado canónico anterior al arreglo HFG muestra sólo:

- `dynamicPortfolioDiscovery.ts`;
- `portfolioPositionHealth.ts`;
- tests existentes de cartera/salud/cierre;
- la lista de pasos del mismo `Producto · cierre rápido`.

**Ninguno de los 25 archivos metodológicos congelados del Future Forward aparece modificado.**

No modificar durante Phase A:

- `scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts`;
- `scripts/qualityAllocationDynamicFutureForwardV1StateStore.ts`;
- `currentOpportunityAlerts.ts`;
- scanner/gate/entry timing/decision/allocator ni las demás fuentes incluidas en el manifiesto.

### Token / preflight

`server/researchValidationRoutes.ts` hace el preflight antes de lanzar guards o TypeScript:

- si falta token: HTTP 412 + `QUALITY_FF_DURABLE_GITHUB_TOKEN_REQUIRED`;
- el botón queda bloqueado y la UI muestra `FALTA TOKEN`;
- no se inicia cálculo ni se consume observación.

El runner/state store congelados no se modificaron para solucionar este problema.

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

# 13. Diagnóstico HFG / grandes ganadores — MUESTRA CONSUMIDA / BUG DE IDENTIDAD CORREGIDO

Casos diagnósticos aportados por el usuario, ejecutados con el replay existente:

### Caso A — inicio 2019-01-01

- 26.000 EUR iniciales;
- 13.000 EUR HFG.DE + 13.000 EUR cash;
- `MONTHLY`;
- Motor Custodia;
- BCE histórico.

Hallazgos:

- Custodia ejecuta salida de HFG prácticamente al inicio: señal estructural muy negativa (`structuralDowntrend=true`, consenso -5, 5 señales adversas);
- el streak de deterioro no fue la causa del EXIT completo;
- HFG reaparece posteriormente con tendencia favorable;
- en 2021 alcanza `ENTRY_READY`, pero no recibe compra financiada;
- en ese momento el cash estaba por debajo de la reserva operativa MEDIUM y gran parte del capital se encontraba en un core sano, por lo que la política económica no financiaba la reentrada;
- este caso separa tres problemas distintos: salida inicial alrededor de un punto de inflexión, latencia de reentrada y reach/financiación del allocator.

### Caso B — HFG ya dentro durante la tendencia sana

Replay iniciado alrededor de septiembre de 2019 con HFG + cash como estado inicial y extendido a través del boom/crash.

Hallazgos:

- Custodia sí fue capaz de mantener HFG durante la mayor parte del multibagger;
- la posición llegó a un MFE de aproximadamente +700%;
- `TREND_PROTECTION_V1` detectó deterioro antes de la salida real: WATCH y posteriormente REDUCE diagnósticos durante 2021/inicios de 2022;
- esa capa seguía siendo diagnóstica y no ejecutaba directamente operaciones;
- la orden económica real terminó llegando con el EXIT estructural de 2022, ejecutado aproximadamente a 59,20 EUR por acción, conservando todavía una gran parte de la ganancia desde la entrada;
- en el replay aportado, Custodia terminó claramente por encima de mantener HFG+cash hasta 2023, confirmando que el motor puede dejar correr un gran ganador y evitar una parte importante del crash cuando la posición ya está dentro durante la tendencia sana.

### Bug objetivo detectado y corregido

El replay mostró `positionIsDiversifiedCore=true` para `DYNAMIC_HFG_DE`, pese a tratarse de una acción individual.

Causa:

- Yahoo identificaba correctamente HFG como `EQUITY`;
- el registro dinámico reducía esa identidad a una categoría amplia `EUROPE_EQUITY`;
- la salud de posiciones podía interpretar esa categoría como core diversificado.

Corrección cerrada en HEAD `7c5004f8f8039d3cdf13c707ba0e2aa2f9c91344`:

- se preserva `currentDiscoveryQuoteType` en activos `DYNAMIC_*`;
- se soporta migración de activos dinámicos ya persistidos;
- las acciones `DYNAMIC_*` se clasifican como satélite por identidad;
- las acciones `OPEN_*` current/live se clasifican como satélite cuando el discovery ya las identifica como `EQUITY`;
- los ETF dinámicos no se convierten por error en acciones tácticas;
- no se creó ningún nuevo motor, pantalla, apartado ni job;
- el mismo `Producto · cierre rápido` pasó completo después del arreglo, incluido `portfolioPositionHealth` 25/25 y TypeScript PASS.

**La muestra HFG está consumida.** Esta corrección es de identidad/semántica de instrumento, no un retuning de política. No ajustar thresholds de MFE, giveback, streak, Entry Timing, allocation o protección usando estos resultados.

Siguiente comprobación HFG: repetir el mismo replay existente del Caso B con el HEAD corregido y verificar que HFG exporta `positionIsDiversifiedCore=false`; comparar el resultado únicamente para medir el impacto de corregir el bug, no para promover una política.

---

# 14. Mejoras futuras DEFERRED

No abrir como tuning productivo hasta cerrar la secuencia vigente:

- USD/Nasdaq/NYSE discovery con FX explícito;
- listings jóvenes / requisito de 252 sesiones;
- multibaggers/SNDK-like;
- fundamentales, revisiones de beneficios y volumen;
- taxonomía sectorial robusta de `OPEN_*`;
- retuning de Reliability/Opportunity/Top64;
- nuevas políticas Forward Risk V12/V13.

---

# 15. Próxima secuencia técnica

1. **Producto / JSON / móvil y corrección de identidad dinámica: PASS FINAL 2026-09-11.** No repetir `Producto · cierre rápido` salvo cambio material posterior.
2. Repetir únicamente el replay HFG existente del Caso B con el HEAD corregido; comprobar que `positionIsDiversifiedCore=false` y medir si cambia la trayectoria económica. No crear un replay/job/apartado nuevo.
3. Interpretar cualquier diferencia sólo como efecto de corregir la clasificación de instrumento. La muestra HFG sigue consumida y no autoriza tuning ni promoción.
4. Mantener producción `LEGACY` y los 25 archivos metodológicos del Future Forward intactos.
5. Si del diagnóstico HFG surge una hipótesis de política, congelarla primero y validarla después en datos fresh/blind/out-of-sample adecuados.
6. No repetir septiembre del Future Forward. Próximo checkpoint prospectivo nuevo: **2026-10-09 22:30-24:00 Europe/Madrid**.
7. Mantener diferidas las mejoras de discovery/metadata y cualquier nueva política Forward Risk mientras no exista un protocolo separado que las justifique.
