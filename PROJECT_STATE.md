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
- Ningún dato financiero privado de usuario se embebe en código público.

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

## LEGACY: existe competencia real
Across 10y/6y/3y:
- gate observations: **456**;
- selection competition: **292 / 456 = 64,04%**;
- category competition: **292**;
- eligible slots excluidos: **1.695**.

Por ventana:
- LONG_10Y: 144/240 = 60,0%; mean eligible 10,0; mean selected 6,58; max eligible 31.
- MEDIUM_6Y: 94/144 = 65,28%; mean eligible 11,39; mean selected 7,55; max 29.
- RECENT_3Y: 54/72 = 75,0%; mean eligible 12,97; mean selected 8,50; max 29.

Conclusión: el escaso efecto económico del ranking **no** se debe a que nunca haya competencia de candidatos.

## QUALITY_V1 reach
- eligibility parity violations: **0**;
- rank-order changed gates: **282 / 456**;
- selected-set changed gates: **70 / 456**;
- rank changed but set unchanged: **212**;
- planned acquisition dates changed: **4**;
- executed acquisition dates changed: **2**;
- median final delta: 0 EUR;
- worst final delta: 0 EUR;
- median DD improvement: 0 pp.

Conversiones clave:
- selected-set reach tras cambiar ranking: 70/282 = **24,82%**;
- executed reach tras cambiar selected set: 2/70 = **2,86%**;
- executed reach sobre gates auditados: 2/456 = **0,44%**.

En 10y y 6y QUALITY cambió repetidamente orden y selected sets, pero cambió **cero** planes/compras y el resultado económico quedó idéntico.

## SLOPE_V1 reach
- eligibility parity violations: **0**;
- rank-order changed gates: **316 / 456**;
- selected-set changed gates: **98 / 456**;
- planned acquisition dates changed: **6**;
- executed acquisition dates changed: **3**;
- median final delta 0 EUR;
- worst final delta -275,80 EUR.

## Hallazgo arquitectónico principal
El cuello de botella está **después de la selección**.

`PortfolioDecisionEngine` vuelve a calcular prioridad de capital con una función propia basada en:
- nivel de oportunidad;
- consenso;
- exceso vs cash;
- volatilidad;
- starter/build;
- timing fraction;
- caps por activo/categoría;
- slots;
- mínimo de orden;
- rotaciones.

`CurrentOpportunityAlert` sí transporta `reliabilityScore` y `opportunityScore`, pero la fórmula productiva `LEGACY` de capital no usa esos campos directamente.

Por eso aumentar el coeficiente de ranking sería la respuesta equivocada. El siguiente test debe hacer llegar la información QUALITY a la prioridad de capital **dentro del allocator existente** y de forma acotada.

---

# FASE ACTUAL — QUALITY_ALLOCATION_BRIDGE_V1

Documento preregistrado:
`docs/opportunity_quality_allocation_bridge_v1.md`.

Objetivo:
probar si la señal QUALITY ya congelada puede influir en cuánto capital recibe una oportunidad ya elegible, sin crear otro motor ni modificar hard gates.

## Integración
`PortfolioDecisionEngine` existente acepta una opción interna:
- `LEGACY` — default/productivo;
- `QUALITY_ALLOCATION_BRIDGE_V1` — research-only.

Todos los callers normales omiten la opción y siguen en LEGACY.

El runner histórico la activa temporalmente mediante wrapper y restaura `PortfolioDecisionEngine.evaluate` en `finally`.

## Fórmula congelada antes del run
Se reutiliza **sin retuning**:
`candidateQualityAdjustment = (reliability - 50) * 0.10 + (opportunity - 50) * 0.20`.

Bridge:
`qualityMultiplier = clamp(1 + candidateQualityAdjustment / 100, 0.85, 1.15)`.

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`.

Interpretación:
- QUALITY 50/50 -> 1,00x;
- mínimo teórico -> 0,85x;
- máximo teórico -> 1,15x.

No se cambian:
- cash hurdle;
- consenso;
- timing;
- gate selection policy, que en este diagnóstico sigue LEGACY;
- starter/build;
- timing fractions;
- caps;
- slots;
- minimum order;
- rotaciones;
- fiscalidad;
- `CORE_ARCHITECTURE_V1`.

## Protocolo del diagnóstico
Mismas ventanas consumidas, sólo para reach/arquitectura:
- 10y / 6y / 3y;
- LEGACY vs QUALITY bridge;
- 6 replays;
- REAL only;
- Yahoo discovery histórico OFF;
- monthly;
- 13.000 EUR;
- MEDIUM;
- horizonte 3 años;
- cash BCE;
- fiscalidad actual;
- CORE_ARCHITECTURE_V1.

Métricas:
- planes de contribución modificados;
- amount-only vs asset-set changes;
- planned/executed acquisition dates changed;
- total absolute executed notional delta;
- multiplier observations min/mean/median/max;
- final value / return / DD / fees / tax como diagnóstico económico;
- parity de decisiones.

Contrato:
- producción sigue `LEGACY`;
- estas ventanas están consumidas y **no pueden promocionar** el bridge;
- no tocar coeficientes 0.10/0.20 ni bounds 0.85/1.15 tras ver resultados;
- si demuestra reach significativo sin daño estructural evidente, el siguiente paso es fresh future-forward;
- si sigue sin llegar al capital, no amplificarlo hasta que funcione.

Job local vigente en `ResearchValidationCenter`:
**Oportunidad · QUALITY bridge de asignación**.

Pasos:
1. `opportunityQualityAllocationBridge.unit`;
2. `portfolioCandidateGate.unit`;
3. guard replay histórico;
4. `tsc --noEmit`;
5. diagnóstico REAL LEGACY vs QUALITY bridge en 3 ventanas.

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

## V8 — valor predictivo retenido
Regla histórica:
`V5 vulnerability >=80 OR V7 options >=80`.

Evidencia:
- EUNL: 11/19 anticipados = 57,89%; lead mediano 63 sesiones; falsa señal 16,73%.
- seis holdouts: 72/83 = 86,75%; lead mediano 40; falsa señal 26,33%; 6/6 PASS predictivo.
- señal fragmentada: 3.974 sesiones; 1.059 ON (26,65%); 111 runs ON; duración mediana 2 sesiones; 222 transiciones.
- gate económico V8: 0/6 PASS; la traducción sell/rebuy perdió demasiado upside.

Conclusión: V8 contiene información anticipativa útil, pero no debe usarse como interruptor transaccional directo.

V5/V7 se conservan como features potenciales. No asumir que cada componente tenga valor autónomo demostrado.

## V9 — retirada
`V9_BLIND_FAIL_RETIRE_V9_POLICY_1`.
- holdout: SPPW.DE, SPY5.DE, SPYM.DE, ZPRS.DE, VGEU.DE, ZPDJ.DE;
- predictivo 22/56 = 39,29%, FAIL;
- económico 0/6 PASS;
- mediana final delta ~-6.791 EUR;
- no V9.1/tuning.

## V10 — retirada
`V10_BLIND_FAIL_RETIRE_V10_POLICY_1`.
- holdout: VGVF.DE, VNRA.DE, VFEM.DE, VERE.DE, VGEK.DE, VJPN.DE;
- 6/6 válidos, 0/6 PASS;
- 71 aportaciones aplazadas;
- mediana final delta -219,25 EUR;
- mejora precio aplazado -1,1907%;
- DOWN_FIRST=34, UP_FIRST=28, NEITHER=9.

Hallazgo retenido: DOWN_FIRST > UP_FIRST es compatible con información bajista útil, aunque la política falló.

## V11 — retirada
`V11_BLIND_FAIL_RETIRE_V11_POLICY_1`.
- holdout: IUSQ.DE, SXR4.DE, EUNM.DE, EUNK.DE, SXR1.DE, SXRZ.DE;
- 6/6 válidos, 0/6 PASS;
- mediana final delta -313,29 EUR;
- mediana delta/contribuciones -0,17229%;
- mediana reducción DD +0,00906 pp;
- mediana wealthEfficiencyRatio 0,999413.

Hallazgo estructural:
- 272 decisiones ELIGIBLE;
- sólo 51 con riesgo >80;
- overlap **18,75%**.

Interpretación: poner Forward Risk después del gate deja poco margen incremental.

## Conclusión V8 -> V11
1. V8 anticipa caídas con información útil y debe conservarse.
2. ON/OFF diario es demasiado fragmentado.
3. Sell/rebuy V8/V9 destruye upside.
4. Espera binaria V10 pierde recuperación.
5. Sizing V11 posterior al gate casi no reduce DD.
6. No crear V12/V13 como variaciones paramétricas del mismo overlay.
7. Posibles usos futuros: ranking, contexto de riesgo, alertas, stress, margen de seguridad, priorización y modelos conjuntos.

En `QUALITY_ALLOCATION_BRIDGE_V1` **V8 no se usa** para no mezclar hipótesis. Podrá estudiarse después como contexto/downside feature con metodología separada.

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
- Ranking reach audit V1 consumido.

Job vigente:
- `opportunity-quality-allocation-bridge-v1` — **Oportunidad · QUALITY bridge de asignación**.

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
1. Ejecutar localmente **Oportunidad · QUALITY bridge de asignación**.
2. Exigir guards + `tsc --noEmit` PASS antes de interpretar economía.
3. Medir cuánto aumenta el reach desde plan hasta compra ejecutada sin cambiar gates ni selección LEGACY.
4. Mantener producción `LEGACY` independientemente del resultado histórico consumido.
5. No retunear coefficients/bounds con estas ventanas.
6. Si el bridge demuestra reach suficiente y comportamiento razonable, preparar validación fresh future-forward desde la fecha posterior al cierre del diagnóstico.
7. Sólo después considerar V8 como feature de downside separada.
8. Mantener `CORE_ELIGIBILITY_V2` shadow.
9. Instrument master point-in-time sigue pendiente para replay open-market histórico sin survivorship residual.

---

# Producto / UI — núcleo a mantener
- Decisión de hoy.
- Registrar compra ejecutada.
- Mi cartera real / salud.
- Estudio individual.
- Replay histórico auditado.
- Alarmas backend.
- Centro de validación existente.

No crear nuevos apartados para discovery, core eligibility, ranking o allocation research si pueden vivir bajo estos flujos.

Pendiente de simplificación:
- fusionar ranking técnico con ranking del estudio cuando haya evidencia suficiente;
- consolidar cobertura/proveedores y controles técnicos en bloque avanzado.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca evento como entregado.
- Para autonomía WATCH/REDUCE/EXIT con app cerrada, backend debe reconstruir cartera privada por UID y usar clasificación compartida.
