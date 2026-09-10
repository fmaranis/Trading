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

# 4. Entrada web y superficie productiva — IMPLEMENTADA / PENDIENTE VERIFICACIÓN FINAL

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
- falta una única ejecución local de guards + TypeScript y una comprobación manual móvil antes de declararlo cerrado.

---

# 5. Acción productiva visible — AUDITORÍA CORRECTIVA 2026-09-10

Durante la revisión posterior al primer cierre se detectó un problema real en `CurrentOpportunityAlertsPanel`:

- compras: procedían de `evaluatePortfolioDecision`;
- ventas: se tomaban directamente de `positionHealth`;
- rotaciones: podían proceder de `PortfolioRotationReviewEngine` separado.

Eso mezclaba tres fuentes en la tarjeta que afirmaba ser la “decisión de hoy”.

Corrección aplicada:

- compras visibles = `portfolioDecision.contributions` del resultado final;
- ventas/reducciones visibles = `portfolioDecision.existingPositions` con acción `REDUCE/EXIT`;
- WATCH visible = `portfolioDecision.existingPositions` con acción `WATCH`;
- rotaciones visibles = únicamente rotaciones presentes en ese mismo `portfolioDecision` final;
- `PortfolioRotationReviewEngine` ya no puede emitir la acción principal;
- contribuciones añadidas/reencaminadas por `CORE_GATE_V1` o `CORE_ARCHITECTURE_V1` ya no quedan ocultas por faltar un `CurrentOpportunityAlert` original.

La explicación de cadena se integra plegada dentro de la misma tarjeta y utiliza **el mismo `portfolioDecision`**, en lugar de recalcular la decisión en un componente paralelo:

`AssetUniverseScanner -> Top64 dinámico -> PortfolioCandidateGate -> InvestmentDecisionEngine -> evaluatePortfolioDecision -> CORE_GATE_V1 -> CORE_ARCHITECTURE_V1`

Política visible:

`PRODUCCIÓN · LEGACY`.

Jerarquía de producto corregida:

1. controles básicos;
2. finalizar salud de posiciones;
3. **qué hacer hoy**;
4. registro/cartera;
5. cash y controles técnicos como explicación secundaria.

La app ya no muestra órdenes mientras `PortfolioPositionHealthService` sigue calculando. Si la salud de cartera falla, la decisión operativa queda bloqueada en vez de enseñar una recomendación parcial que pueda cambiar segundos después.

El antiguo `ProductDecisionTracePanel.tsx` se eliminó porque duplicaba el cálculo y además colocaba metodología antes que la acción.

Guards:

- `tests/productDecisionSurface.unit.ts`: 18 invariantes estáticos;
- `tests/productSurfaceClosureV1.unit.ts`: 19 invariantes estáticos.

Pendiente: ejecución local única antes de marcar PASS final.

---

# 6. JSON y móvil — IMPLEMENTADO / PENDIENTE PRUEBA REAL

## Centro de validación

`Descargar JSON` del `ResearchValidationCenter` ya no crea Blob ni simula un click desde React.

Ruta nativa:

`GET /api/alerts/research-validation/jobs/:id/result.json`

El backend responde con:

- JSON del resultado registrado;
- `Content-Disposition: attachment`;
- `Cache-Control: no-store`.

La UI utiliza un `<a href=.../result.json>` normal.

## Replay histórico

La sesión del replay vive en `localStorage`, por lo que la exportación continúa siendo client-side mediante:

`src/jsonDownload.ts`.

Auditoría correctiva 2026-09-10:

Se detectó que la primera mejora móvil había convertido `exportSession` en `async` e introducido un `await requestAnimationFrame()` antes de `anchor.click()`. En Safari/WebView eso puede hacer perder la activación transitoria originada por el toque y bloquear precisamente la descarga.

Corrección:

- `exportSession` vuelve a ser síncrono;
- serialización + `downloadJsonFile(...)` ocurren dentro de la tarea original del toque;
- no existe `await` ni `requestAnimationFrame` antes de iniciar la descarga;
- la Blob URL no se revoca inmediatamente y se conserva 30 s.

No afirmar todavía que el export móvil está cerrado hasta probarlo físicamente en el navegador/WebView donde fallaba.

## Base móvil

`src/index.css` y la superficie principal incluyen:

- `touch-action: manipulation`;
- `touch-target` mínimo 44 px en controles principales;
- inputs/selects a 16 px en móvil para evitar zoom de foco;
- safe-area inferior;
- scrolling táctil horizontal;
- header principal compacto;
- botones importantes apilados cuando procede.

El tamaño táctil es ergonomía; no se considera solución por sí sola a fallos de ejecución.

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

Siguiente observación nueva válida:

**2026-10-09 22:30-24:00 Europe/Madrid**.

No repetir septiembre.

### Integridad tras cambios de producto 2026-09-10

Los cambios de producto/UI posteriores al checkpoint se mantienen fuera del manifiesto de 25 blobs metodológicos congelados.

No modificar durante Phase A:

- `scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts`;
- `scripts/qualityAllocationDynamicFutureForwardV1StateStore.ts`;
- `currentOpportunityAlerts.ts`;
- scanner/gate/entry timing/decision/allocator ni las demás fuentes incluidas en el manifiesto.

### Token / preflight

El entorno local/AI Studio debe proporcionar `GITHUB_REPLAY_SYNC_TOKEN` para el estado durable.

`server/researchValidationRoutes.ts` hace ahora el preflight antes de lanzar guards o TypeScript:

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

# 13. Diagnóstico HFG / grandes ganadores — DEFERRED

Replay aportado por el usuario para diagnóstico:

- ventana 2019-01-01 -> 2022-12-30;
- 26.000 EUR iniciales;
- 13.000 EUR HFG.DE + 13.000 EUR cash;
- frecuencia mensual;
- Motor Custodia.

Hallazgos preliminares:

- Custodia liquida HFG casi inmediatamente al comienzo;
- posteriormente HFG reaparece repetidamente como candidato durante la gran tendencia;
- en una fecha llega a `ENTRY_READY` pero no recibe compra financiada;
- existe una posible cuestión semántica sobre el streak de deterioro aplicado a una posición inicial y otra sobre capital atrapado en core/reentrada.

**No se modifica producción ni se retunea nada con esta muestra.**

Este diagnóstico queda aparcado hasta verificar el cierre de producto. Después se estudiará como problema de calidad de política económica: salida inicial, reentrada, financiación de oportunidades y protección de ganancias.

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

1. Ejecutar **una sola comprobación local de cierre**: `npx tsx tests/productSurfaceClosureV1.unit.ts` + `npx tsx tests/productDecisionSurface.unit.ts` + `npm run lint`. No ejecutar replay ni future-forward.
2. Comprobar manualmente en móvil, sin relanzar validaciones, dos cosas: el enlace HTTP `Descargar JSON` del Centro cuando haya resultado en memoria y `Exportar prueba JSON` del replay existente.
3. Sólo después marcar entrada productiva/JSON/móvil como PASS final.
4. Restaurar `GITHUB_REPLAY_SYNC_TOKEN` antes de necesitar escritura future-forward; no relanzar septiembre.
5. Mantener producción `LEGACY` y los 25 blobs congelados intactos.
6. Una vez cerrado lo anterior, retomar el diagnóstico económico HFG y otros boom->crash sin retunear sobre la muestra consumida.
7. Próximo checkpoint prospectivo nuevo: 2026-10-09 22:30-24:00 Europe/Madrid.
