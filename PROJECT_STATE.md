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

# 4. Entrada web y superficie productiva — CERRADA 2026-09-10

La ruta real de producto es:

`index.html -> src/decisionMain.tsx -> InteractiveInvestmentDecisionCenter + ResearchValidationCenter`

Hallazgo importante de auditoría:

- `index.html` **no** utilizaba el antiguo `App.tsx`;
- el `App.tsx` heredado sólo seguía siendo accesible mediante `/legacy.html`;
- `/legacy.html` era la vía restante hacia la antigua experiencia `Bot 2X / PortfolioEngine / LiveSimulationEngine`.

Corrección:

- `/legacy.html` ya no carga `src/main.tsx`; redirige a `/` y queda `noindex`;
- `decisionMain.tsx` no enlaza a Legacy;
- `/portfolio.html` se conserva como laboratorio cuantitativo separado, sin autoridad para emitir la recomendación productiva de cartera real;
- la única superficie accionable normal es `InteractiveInvestmentDecisionCenter`.

Los compatibility adapters previamente aplicados a `GrowthTradingBot`, antiguo `InvestmentDecisionCenter` y `PortfolioOverview` se conservan como defensa adicional, pero ya no constituyen una ruta productiva normal.

Guard de cierre:

`tests/productSurfaceClosureV1.unit.ts`

Protege 15 invariantes de entrypoint, retirada de Legacy, descarga JSON, preflight, trazabilidad y móvil.

El guard anterior `tests/productDecisionSurface.unit.ts` sigue protegiendo que no reaparezcan `LiveSimulationEngine`, `ALL_AVAILABLE_ASSETS` o un decision center paralelo en las superficies adaptadas.

---

# 5. Trazabilidad visible de cada recomendación — CERRADA 2026-09-10

Componente:

`src/components/ProductDecisionTracePanel.tsx`

Se muestra antes de las recomendaciones accionables dentro de `MarketUtilityDashboard`.

La pantalla declara explícitamente:

`AssetUniverseScanner -> Top64 dinámico -> PortfolioCandidateGate -> InvestmentDecisionEngine -> evaluatePortfolioDecision -> CORE_GATE_V1 -> CORE_ARCHITECTURE_V1`

Y muestra:

- `PRODUCCIÓN · LEGACY`;
- capital disponible;
- inversión total recomendada ahora;
- cash objetivo;
- cash previsto después del plan;
- para cada activo: `amountEur`, timing, etapa `STARTER/BUILD/ROTATION_ENTRY`, fracción inicial, cap de cartera, valor ya invertido, objetivo estratégico, objetivo ejecutable y orden pendiente;
- explicación `reason` generada por el mismo `PortfolioDecisionEngine`.

El panel **no crea otra recomendación**: vuelve a llamar a `evaluatePortfolioDecision(...)` con la misma cartera, scan, decision, salud de posiciones y cash benchmark para explicar el mismo sizing.

Objetivo de producto: si aparece `EXV1 · 603 €`, el usuario puede comprobar en la propia app de dónde sale el importe sin inferir qué motor lo produjo.

---

# 6. JSON y usabilidad móvil — CERRADO FUNCIONALMENTE 2026-09-10

## Centro de validación

El antiguo `Descargar JSON` generaba un Blob en frontend y simulaba un `anchor.click()`. En algunos navegadores/WebViews móviles podía no producir una descarga visible.

Ahora el Centro usa descarga HTTP nativa:

`GET /api/alerts/research-validation/jobs/:id/result.json`

El backend responde con:

- JSON del resultado registrado;
- `Content-Disposition: attachment`;
- `Cache-Control: no-store`.

`ResearchValidationCenter` utiliza un `<a href=.../result.json>` normal. Ya no usa `Blob`, `URL.createObjectURL` ni `downloadResultJson` para esa descarga.

## Replay histórico

El replay sí guarda su sesión completa en `localStorage`, por lo que su exportación sigue siendo client-side.

Helper:

`src/jsonDownload.ts`

Reglas:

- no revocar la Blob URL inmediatamente tras `click()`;
- mantenerla 30 s para que navegadores móviles puedan consumirla;
- mostrar feedback `Preparando JSON… / Descarga iniciada`;
- fallback a nueva pestaña si el navegador lanza error al iniciar la descarga.

`HistoricalAuditJsonControls` utiliza este helper y mantiene separados `Guardar + publicar para ChatGPT`, `Exportar prueba JSON` e `Importar prueba JSON`.

## Base móvil

`src/index.css` y `decisionMain.tsx` incorporan:

- `touch-action: manipulation`;
- utilidad `touch-target` de 44 px;
- inputs/selects a 16 px en móvil para evitar zoom de foco;
- safe-area inferior;
- scrolling táctil horizontal;
- header principal compacto;
- acceso directo móvil a Validación y Lab;
- botones relevantes del Centro/JSON apilados a ancho completo en teléfono.

No se ha modificado lógica financiera para estos cambios.

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

### Integridad tras cierre de producto 2026-09-10

El diff de cierre de producto fue auditado contra el manifiesto de 25 blobs. **Ninguno de los 25 archivos congelados fue modificado.**

En particular permanecen intactos:

- `scripts/qualityAllocationDynamicFutureForwardV1CheckpointLive.ts`;
- `scripts/qualityAllocationDynamicFutureForwardV1StateStore.ts`;
- scanner/gate/entry timing/decision/allocator y fuentes de mercado incluidas en el manifiesto.

### Token / preflight

El entorno local/AI Studio debe proporcionar `GITHUB_REPLAY_SYNC_TOKEN` para el estado durable.

Tras el fallo observado el 2026-09-10 por token ausente, `server/researchValidationRoutes.ts` hace ahora el preflight **antes de lanzar guards o TypeScript**:

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

Hallazgos preliminares observados en el replay:

- Custodia liquida HFG casi inmediatamente al comienzo;
- posteriormente HFG reaparece repetidamente como candidato durante la gran tendencia;
- en una fecha llega a `ENTRY_READY` pero no recibe compra financiada;
- existe una posible cuestión semántica sobre el streak de deterioro aplicado a una posición inicial y otra sobre capital atrapado en core/reentrada.

**No se modifica producción ni se retunea nada con esta muestra.**

Este diagnóstico queda aparcado hasta terminar/verificar el cierre de producto. Después se estudiará como problema de calidad de política económica: salida inicial, reentrada, financiación de oportunidades y protección de ganancias.

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

1. Ejecutar **una sola comprobación local de cierre**: `npx tsx tests/productSurfaceClosureV1.unit.ts` + `npm run lint`. No ejecutar replays ni future-forward para esta comprobación.
2. Comprobar manualmente en móvil, sin relanzar ninguna validación, que el enlace `Descargar JSON` del resultado existente responde como descarga HTTP cuando existe un resultado en memoria.
3. Restaurar `GITHUB_REPLAY_SYNC_TOKEN` en el entorno antes de necesitar escritura future-forward; no hace falta relanzar septiembre.
4. Mantener producción `LEGACY` y los 25 blobs congelados intactos.
5. Una vez cerrado lo anterior, retomar el diagnóstico económico HFG y otros boom->crash sin retunear sobre la muestra consumida.
6. Próximo checkpoint prospectivo nuevo: 2026-10-09 22:30-24:00 Europe/Madrid.
