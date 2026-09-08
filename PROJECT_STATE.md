# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo primero al retomar el proyecto.

## Reglas no negociables
- Nunca usar GitHub Actions para replays o validaciones largas.
- ChatGPT modifica `main`; los cálculos pesados los ejecuta el motor local/backend de la app, no agentes.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No recalibrar thresholds ni políticas sobre muestras ya usadas para decidir PASS/FAIL.
- No crear motores paralelos: decisión, replay y alertas deben compartir scanner, gates y políticas productivas.
- No crear apartados/pantallas nuevos cuando una capacidad puede integrarse en los flujos existentes.
- Ningún dato financiero privado del usuario se embebe en código público.

---

# Estado vigente — 2026-09-08

## Motor productivo
La arquitectura productiva cerrada sigue siendo `CORE_ARCHITECTURE_V1`.

Flujo live:
`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> evaluatePortfolioDecision -> ejecución/seguimiento`.

Replay auditado:
- baseline productivo/replay: `CORE_ARCHITECTURE_V1`;
- comparte `PortfolioCandidateGate`, `InvestmentDecisionEngine` y `classifyPositionHealth`;
- mantiene `Desde cero / manual / cartera actual` y `Motor Custodia / mantener cartera` dentro del mismo replay;
- ejecución causal posterior a señal / NEXT_OPEN;
- cash histórico BCE y fiscalidad siguen integrados;
- el replay histórico no usa Yahoo Search actual para inventar el universo pasado;
- Forward Risk no modifica producción, Custodia, replay ni live;
- la asignación productiva de oportunidad permanece `LEGACY`.

---

# OPEN_MARKET_DISCOVERY_V1 — CERRADO EN PASS CURRENT/LIVE

Estado:
**CURRENT_LIVE_INTEGRATION_PASS / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED**.

Objetivo cumplido: ampliar candidatos actuales sin crear otro motor ni otra pantalla. La cadena sigue siendo una sola:

`current discovery -> AssetUniverseScanner -> CORE_ELIGIBILITY_V2 shadow -> PortfolioCandidateGate -> motor existente`.

Documento de cierre:
`docs/open_market_discovery_v1_integration_state.md`.

Resultado final local 2026-09-08:
- status `PASS`;
- 12 familias estructurales de búsqueda;
- universo base 64;
- 2 ETF current/live promovidos;
- 66 escaneados;
- 62 aceptados;
- 2 `OPEN_*` aceptados con provenance REAL;
- ambos quedaron `REJECTED / DOES_NOT_BEAT_CASH`;
- `CORE_ELIGIBILITY_V2` siguió shadow;
- replay histórico no modificado;
- ninguna nueva sección UI.

Invariantes:
- automático V1 sólo ETF current/live EUR con >=252 barras inspeccionadas;
- `AssetUniverseScanner` es el único punto de integración;
- fallo temporal discovery -> fallback al catálogo validado;
- merge estrictamente aditivo;
- aliases base con mismo ISIN se conservan;
- Yahoo Search actual nunca reconstruye universos históricos.

Limitación histórica pendiente:
no afirmar “mercado abierto histórico completo” hasta disponer de instrument master point-in-time con altas y delistings.

## CORE_ELIGIBILITY_V2
Estado:
`SHADOW_AUDIT_NOT_PRODUCTION_GATE`.

No sustituye `PortfolioCandidateGate`, `DynamicCoreSelectorV1` ni decisiones productivas.

---

# OPPORTUNITY / RANKING — COMPARACIÓN CAUSAL V1 CONSUMIDA

Documento:
`docs/opportunity_ranking_causal_comparison_v1.md`.

Políticas comparadas:
- `LEGACY`;
- `QUALITY_V1`;
- `SLOPE_V1`.

Hard gates idénticos:
`REAL -> beats cash -> consensus BUY -> no structural downtrend -> EntryTiming != WAIT`.

Configuración consumida:
- REAL only;
- carga 2014-09-01 -> 2026-09-01;
- Yahoo current discovery histórico OFF;
- ventanas 10y / 6y / 3y;
- MONTHLY;
- 13.000 EUR;
- MEDIUM;
- horizonte 3 años;
- `CUSTODIA_ENGINE`;
- cash histórico BCE;
- fiscalidad actual;
- `CORE_ARCHITECTURE_V1`.

Resultado:
- LONG_10Y: QUALITY = LEGACY; SLOPE = LEGACY; final 40.365,34 EUR; DD 31,83%; diferencias adquisiciones 0.
- MEDIUM_6Y: QUALITY = LEGACY; SLOPE = LEGACY; final 26.992,46 EUR; DD 20,42%; diferencias adquisiciones 0.
- RECENT_3Y: LEGACY 20.779,26 EUR; QUALITY +291,24 EUR con DD ligeramente peor; SLOPE -275,80 EUR y DD peor.
- QUALITY agregado: 1/3 wins, 2 ties, mediana delta 0 EUR.
- SLOPE agregado: 0/3 wins, 2 ties, mediana delta 0 EUR.

Conclusión cerrada:
- producción permanece `LEGACY`;
- `QUALITY_V1` = research-only / información interesante pero efecto insuficiente;
- `SLOPE_V1` = no candidato de promoción en forma actual;
- no `QUALITY_V1.1`, no `SLOPE_V1.1`, no tuning sobre estas ventanas.

---

# OPPORTUNITY_RANKING_REACH_AUDIT_V1 — CONSUMIDO

Documento:
`docs/opportunity_ranking_reach_audit_v1.md`.

Objetivo:
medir `rank cambia -> conjunto cambia -> plan BUY/ADD cambia -> compra ejecutada cambia`.

Resultado local:
`PASS_REACH_DIAGNOSTIC_ONLY`.

Data quality:
- catálogo 64;
- scanned 64;
- accepted REAL 60;
- rejected 4;
- provenance REAL-only;
- Yahoo current discovery histórico OFF;
- `OPEN_*` leak 0.

LEGACY sí tuvo competencia real:
- gate observations: 456;
- selection competition: 292/456 = 64,04%;
- eligible slots excluidos: 1.695.

QUALITY_V1 reach:
- eligibility parity violations: 0;
- rank-order changed gates: 282/456;
- selected-set changed gates: 70/456;
- planned acquisition dates changed: 4;
- executed acquisition dates changed: 2;
- executed reach sobre gates auditados: 2/456 = 0,44%.

SLOPE_V1 reach:
- eligibility parity violations: 0;
- rank-order changed gates: 316/456;
- selected-set changed gates: 98/456;
- planned acquisition dates changed: 6;
- executed acquisition dates changed: 3;
- worst final delta: -275,80 EUR.

Hallazgo arquitectónico principal:
el cuello de botella está después de la selección, dentro de la prioridad/capacidad efectiva de asignación de capital del `PortfolioDecisionEngine`.

---

# QUALITY_ALLOCATION_BRIDGE_V1 — CONSUMIDO / ARCHIVADO

Documento preregistrado:
`docs/opportunity_quality_allocation_bridge_v1.md`.

Objetivo probado:
hacer llegar la señal QUALITY ya congelada a cuánto capital recibe una oportunidad elegible, dentro del allocator existente y sin tocar hard gates.

Integración research-only:
- `LEGACY` = default/productivo;
- `QUALITY_ALLOCATION_BRIDGE_V1` = opción interna de investigación;
- callers normales siguen omitiendo la opción y por tanto usan `LEGACY`;
- wrapper histórico restaura `PortfolioDecisionEngine.evaluate` en `finally`.

Fórmula congelada:
`candidateQualityAdjustment = (reliability - 50) * 0.10 + (opportunity - 50) * 0.20`.

`qualityMultiplier = clamp(1 + candidateQualityAdjustment / 100, 0.85, 1.15)`.

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`.

No se modificaron cash hurdle, consenso, timing, gates, starter/build, timing fractions, caps, slots, minimum order, rotaciones, fiscalidad ni `CORE_ARCHITECTURE_V1`.

Resultado consumido:
- technical pass;
- el bridge sí llegó al allocator;
- el replay cerrado tuvo capital desplegable en sólo 3/228 decisiones;
- por tanto el reach económico quedó insuficiente;
- no promoción a producción;
- no retuning de coeficientes ni bounds sobre estas ventanas.

Interpretación retenida:
la ausencia de efecto no demuestra que QUALITY carezca de información; demuestra que, con capital cerrado, el allocator casi nunca tuvo capital nuevo que repartir.

El job anterior queda archivado:
`opportunity-quality-allocation-bridge-v1` — **Oportunidad · QUALITY bridge de asignación**.

---

# FASE ACTUAL — REPLAY_EXPLICIT_CASH_FLOWS_V1

Job local vigente en `ResearchValidationCenter`:
**Replay · flujos externos explícitos**

ID:
`replay-explicit-cash-flows-v1`.

Objetivo:
validar dentro del replay existente que la frecuencia `MONTHLY` sea únicamente frecuencia de decisión y que aportaciones/retiradas fechadas entren causalmente como flujos externos explícitos. Después se usa ese capital externo sólo como brazo de investigación para comprobar si QUALITY alcanza realmente planes y compras cuando sí existe capital nuevo que repartir.

## Semántica que no debe confundirse
- `MONTHLY` = frecuencia de revisión/decisión; **no crea dinero**.
- `stagedCapitalPlan` = capital ya disponible para despliegue escalonado; **no es una aportación recurrente**.
- `externalCashFlows` = dinero que entra o sale de la cuenta por fecha explícita.

## Fixture de investigación
El runner usa **1.000 EUR/mes únicamente como fixture de investigación** para dar suficiente capital al allocator y medir reach.

Esto queda explícitamente congelado como:
- `researchContributionFixtureEurPerMonth: 1000`;
- `researchContributionFixtureIsProductionDefault: false`;
- `researchContributionFixtureIsUserCashFlowAssumption: false`;
- `monthlyDecisionCadenceCreatesImplicitCash: false`.

Por tanto:
**1.000 EUR/mes no es una aportación predeterminada de la aplicación y no presupone que el usuario vaya a aportar esa cantidad.**

## Brazos del diagnóstico
Por cada ventana:
1. `CLOSED_LEGACY` — capital cerrado, producción LEGACY.
2. `EXPLICIT_LEGACY` — mismo replay con aportaciones externas explícitas, LEGACY.
3. `EXPLICIT_QUALITY` — mismo flujo explícito con `QUALITY_ALLOCATION_BRIDGE_V1` research-only.

Todos usan:
- mismo dataset REAL;
- mismo catálogo histórico actual con la limitación de survivorship ya conocida;
- Yahoo current discovery histórico OFF;
- `CORE_ARCHITECTURE_V1`;
- MONTHLY;
- 13.000 EUR iniciales;
- MEDIUM;
- horizonte 3 años;
- cash histórico BCE;
- fiscalidad actual;
- ventanas 10y / 6y / 3y ya consumidas.

Estas ventanas **no pueden promocionar QUALITY** y no autorizan retuning.

## Causalidad y contabilidad
Contrato implementado:
- flujos se normalizan por fecha y signo;
- una aportación/retirada se aplica antes de la siguiente decisión/ejecución que pueda observarla;
- closed y explicit LEGACY deben ser idénticos antes del primer flujo externo;
- las aportaciones no cuentan como rentabilidad;
- existe `cashFlowAdjustedProfitEur` / `cashFlowAdjustedReturnPct` para separar P/L de dinero aportado;
- retiradas V1 consumen sólo cash disponible;
- si una retirada supera el cash, el replay falla explícitamente;
- no hay ventas forzadas ocultas para financiar retiradas;
- el benchmark de cash con flujos usa acumulador independiente para no contaminar el contexto fiscal/contable del portfolio;
- el benchmark estructural one-shot queda N/D cuando hay flujos externos si no puede recibir los mismos flujos fechados de forma comparable.

## Guards del job vigente
1. `tests/replayExternalCashFlows.unit.ts`;
2. `tests/replayExternalCashFlowIntegration.unit.ts`;
3. `tests/dynamicHistoricalReplay.unit.ts`;
4. `tests/replayInitialPortfolioModes.unit.ts`;
5. `tests/portfolioCandidateGate.unit.ts`;
6. `npm run lint`;
7. sólo después: `scripts/replayExplicitCashFlowsV1Live.ts`.

El paso 7 es el diagnóstico REAL largo y debe ejecutarse desde el Centro de validación/local backend, nunca mediante GitHub Actions o agentes.

## Qué medirá el resultado
- causalidad y contabilidad de flujos;
- que el brazo cerrado tenga cero aportaciones implícitas;
- ventanas donde el capital explícito aumente compras ejecutadas;
- delta de notional ejecutado explicit vs closed;
- gates con capital desplegable;
- planes modificados por QUALITY con capital explícito;
- fechas de compras ejecutadas modificadas por QUALITY;
- delta absoluto de notional ejecutado;
- economía final sólo como diagnóstico, no como permiso de promoción.

Interpretación preregistrada:
- si los flujos explícitos aumentan materialmente el reach del allocator, se podrá diseñar después una validación fresh future-forward de allocation;
- si ni con capital explícito llega a compras, no amplificar QUALITY ni retunear parámetros;
- producción permanece `LEGACY` en cualquier caso hasta nueva evidencia válida.

---

# Forward Risk — CERRADO HASTA V11, PERO V8 SE CONSERVA

## PRINCIPIO PERMANENTE — NO PERDER V8

**V8 sí mostró capacidad útil para anticipar futuras caídas relevantes.**

Los FAIL económicos de V8/V9/V10/V11 no significan “Forward Risk no sirve”. Fallaron las políticas probadas para monetizar/ejecutar esa información: venta/recompra, máquina de estados, espera binaria y sizing posterior al gate.

Separar siempre:
**calidad de señal != calidad de política económica**.

Documentos permanentes:
- `docs/forward_risk_v8_retained_predictive_value.md`;
- `docs/forward_risk_retained_research_findings_v8_v11.md`.

V8 — valor predictivo retenido:
- EUNL: 11/19 anticipados = 57,89%; lead mediano 63 sesiones; falsa señal 16,73%.
- seis holdouts: 72/83 = 86,75%; lead mediano 40; falsa señal 26,33%; 6/6 PASS predictivo.
- señal fragmentada: 3.974 sesiones; 1.059 ON (26,65%); 111 runs ON; duración mediana 2 sesiones; 222 transiciones.
- gate económico V8: 0/6 PASS; la traducción sell/rebuy perdió demasiado upside.

V9:
`V9_BLIND_FAIL_RETIRE_V9_POLICY_1`.
- predictivo 22/56 = 39,29%, FAIL;
- económico 0/6 PASS;
- no V9.1/tuning.

V10:
`V10_BLIND_FAIL_RETIRE_V10_POLICY_1`.
- 6/6 válidos, 0/6 PASS;
- 71 aportaciones aplazadas;
- mediana final delta -219,25 EUR;
- DOWN_FIRST=34, UP_FIRST=28, NEITHER=9.

V11:
`V11_BLIND_FAIL_RETIRE_V11_POLICY_1`.
- 6/6 válidos, 0/6 PASS;
- mediana final delta -313,29 EUR;
- overlap riesgo >80 con decisiones ELIGIBLE: 18,75%.

Conclusión V8 -> V11:
1. V8 anticipa caídas con información útil y debe conservarse.
2. ON/OFF diario es demasiado fragmentado.
3. Sell/rebuy V8/V9 destruye upside.
4. Espera binaria V10 pierde recuperación.
5. Sizing V11 posterior al gate casi no reduce DD.
6. No crear V12/V13 como variaciones paramétricas del mismo overlay.
7. Posibles usos futuros: ranking, contexto de riesgo, alertas, stress, margen de seguridad, priorización y modelos conjuntos.

En `REPLAY_EXPLICIT_CASH_FLOWS_V1` V8 no se usa para no mezclar hipótesis.

---

# Validaciones locales
Pantalla existente:
`ResearchValidationCenter`.

Backend:
`/api/alerts/research-validation/*`.

Archivado:
- V8 diagnóstico;
- V9 guard/blind;
- V10 guard/blind;
- V11 guard/blind;
- Mercado abierto V1 infraestructura PASS;
- Mercado abierto V1 integración live PASS;
- Ranking causal V1 consumido;
- Ranking reach audit V1 consumido;
- `opportunity-quality-allocation-bridge-v1` consumido/archivado.

Único job vigente:
- `replay-explicit-cash-flows-v1` — **Replay · flujos externos explícitos**.

Nunca usar Gemini, agentes ni GitHub Actions para estas ejecuciones largas.

---

# Datos de mercado
- Yahoo Finance: primario para acciones/ETF y discovery current/live.
- EODHD: secundario y NAV de fondos por ISIN cuando está configurado.
- Alpha Vantage: contraste secundario cuando está configurado.
- Cboe: VIX/VIX9D/VVIX de V7/V8.
- FRED/ALFRED: macro point-in-time V5/V8; `FRED_API_KEY` server-side.

Búsqueda manual del replay puede registrar instrumentos EUR por ticker/nombre/ISIN, pero Yahoo Search actual no es un catálogo histórico point-in-time.

---

# Próxima secuencia
1. No modificar parámetros del fixture, QUALITY ni reglas financieras antes de la ejecución.
2. Ejecutar localmente **Replay · flujos externos explícitos** desde `ResearchValidationCenter`.
3. Exigir PASS de todos los guards y `npm run lint` antes de interpretar el diagnóstico REAL.
4. Verificar primero causalidad/contabilidad y ausencia de aportación implícita en el brazo cerrado.
5. Después medir si el capital explícito llega a compras y si QUALITY modifica realmente planes/compras cuando existe capital nuevo.
6. Mantener producción `LEGACY` independientemente del resultado de estas ventanas consumidas.
7. No retunear coefficients/bounds con estas ventanas.
8. Si el reach queda demostrado, diseñar validación fresh future-forward separada.
9. Sólo después considerar V8 como feature de downside separada.
10. Mantener `CORE_ELIGIBILITY_V2` shadow.
11. Instrument master point-in-time sigue pendiente para replay open-market histórico sin survivorship residual.

---

# Producto / UI — núcleo a mantener
- Decisión de hoy.
- Registrar compra ejecutada.
- Mi cartera real / salud.
- Estudio individual.
- Replay histórico auditado.
- Alarmas backend.
- Centro de validación existente.

No crear nuevos apartados para discovery, core eligibility, ranking, allocation research o flujos de validación si pueden vivir bajo estos flujos.

Pendiente de simplificación:
- fusionar ranking técnico con ranking del estudio cuando haya evidencia suficiente;
- consolidar cobertura/proveedores y controles técnicos en bloque avanzado.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca evento como entregado.
- Para autonomía WATCH/REDUCE/EXIT con app cerrada, backend debe reconstruir cartera privada por UID y usar clasificación compartida.
