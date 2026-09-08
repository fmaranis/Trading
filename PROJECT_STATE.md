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
- Forward Risk no modifica producción, Custodia, replay ni live.

---

# OPEN_MARKET_DISCOVERY_V1 — CERRADO EN PASS CURRENT/LIVE

Estado:
**CURRENT_LIVE_INTEGRATION_PASS / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED**.

Objetivo cumplido: ampliar candidatos actuales sin crear otro motor ni otra pantalla. La cadena sigue siendo una sola:

`current discovery -> AssetUniverseScanner -> CORE_ELIGIBILITY_V2 shadow -> PortfolioCandidateGate -> motor existente`.

Documento de cierre:
`docs/open_market_discovery_v1_integration_state.md`.

## Resultado final local 2026-09-08
Job:
`open-market-live-scanner-integration`.

Resultado:
- status: `PASS`;
- 12 familias estructurales de búsqueda;
- discovery intentado: sí;
- error discovery: `null`;
- universo base: 64;
- ETF current/live promovidos: 2;
- total escaneados: 66;
- aceptados scanner: 62;
- rechazados scanner: 4;
- `OPEN_*`: 2;
- `OPEN_*` aceptados con provenance REAL: 2/2;
- `PortfolioCandidateGate`: 0/2 elegibles;
- `XAD5.MI`: `REJECTED / DOES_NOT_BEAT_CASH`;
- `SGLE.MI`: `REJECTED / DOES_NOT_BEAT_CASH`;
- `CORE_ELIGIBILITY_V2`: shadow-only;
- nueva sección UI: false;
- replay histórico modificado: false.

Interpretación: discovery puede incorporar candidatos REAL al mismo scanner, pero no puede forzar compras ni saltarse el gate económico.

## Invariantes de integración
- V1 automático sólo promociona ETF current/live cotizados en EUR y con >=252 barras inspeccionadas.
- `AssetUniverseScanner` es el punto único de integración; Decisión de hoy y alertas lo heredan por su flujo existente.
- fallo temporal de discovery = fallback al catálogo validado; no bloquea decisiones.
- merge estrictamente aditivo: jamás reducir/reemplazar el catálogo base.
- se conservan aliases intencionados del catálogo aunque compartan ISIN (`IS3N/EIMI`, `DBX0AN/XEON`).
- URL interna server-side: `OPEN_MARKET_DISCOVERY_INTERNAL_BASE_URL -> ALERT_INTERNAL_BASE_URL -> http://127.0.0.1:3000`; `APP_URL` no se usa para esta llamada técnica.

## Frontera histórica
Yahoo Search sigue siendo **CURRENT/LIVE**, no un instrument master point-in-time.

Por tanto:
- replay histórico no llama `/asset-discovery` ni `/open-universe`;
- `historicalPointInTimeSafe = false` para discovery V1;
- se puede bloquear pre-listing lookahead con las barras disponibles por fecha;
- survivorship bias no queda completamente resuelto sin instrument master histórico con altas y delistings.

No afirmar “mercado abierto histórico completo” hasta resolver ese punto.

## CORE_ELIGIBILITY_V2
Estado:
`SHADOW_AUDIT_NOT_PRODUCTION_GATE`.

No sustituye `PortfolioCandidateGate`, `DynamicCoreSelectorV1` ni ninguna decisión productiva. Se mantiene para auditar EUR, provenance REAL, historia suficiente, categoría amplia, estructura y liquidez sin alterar producción.

---

# OPPORTUNITY / RANKING — COMPARACIÓN CAUSAL V1 CONSUMIDA

Documento:
`docs/opportunity_ranking_causal_comparison_v1.md`.

Políticas comparadas:
- `LEGACY` — producción actual;
- `QUALITY_V1` — Reliability/Opportunity;
- `SLOPE_V1` — estructura de pendientes.

Los tres brazos mantuvieron los mismos hard gates:
`REAL -> beats cash -> consensus BUY -> no structural downtrend -> EntryTiming != WAIT`.

Configuración consumida:
- REAL only;
- carga 2014-09-01 -> fin 2026-09-01;
- Yahoo current discovery histórico OFF;
- ventanas 10y / 6y / 3y;
- MONTHLY;
- 13.000 EUR;
- riesgo MEDIUM;
- horizonte 3 años;
- `CUSTODIA_ENGINE`;
- cash histórico BCE;
- fiscalidad actual del replay;
- `CORE_ARCHITECTURE_V1`.

## Resultado consumido 2026-09-08
Data quality:
- catálogo 64;
- scanned 64;
- accepted REAL 60;
- rejected 4;
- no `OPEN_*` histórico;
- provenance REAL-only.

LONG_10Y:
- QUALITY = LEGACY exacto;
- SLOPE = LEGACY exacto;
- final 40.365,34 EUR;
- DD 31,83%;
- diferencias de adquisiciones: 0.

MEDIUM_6Y:
- QUALITY = LEGACY exacto;
- SLOPE = LEGACY exacto;
- final 26.992,46 EUR;
- DD 20,42%;
- diferencias de adquisiciones: 0.

RECENT_3Y:
- LEGACY final 20.779,26 EUR; retorno 59,84%; CAGR 16,93%; DD 21,17%;
- QUALITY final 21.070,50 EUR; delta +291,24 EUR; retorno +2,2403 pp; DD ligeramente peor en -0,0578 pp; diferencia de adquisiciones 2;
- SLOPE final 20.503,47 EUR; delta -275,80 EUR; retorno -2,1215 pp; DD peor en -0,1748 pp; diferencia de adquisiciones 3.

Agregado:
- QUALITY: 1/3 wins, 2/3 ties, 0/3 DD wins, mediana delta 0 EUR;
- SLOPE: 0/3 wins, 2/3 ties, 0/3 DD wins, mediana delta 0 EUR.

Conclusión cerrada:
- producción permanece `LEGACY`;
- `QUALITY_V1` = research-only / informativamente interesante pero efecto insuficiente;
- `SLOPE_V1` = no candidato de promoción en su forma actual;
- no `QUALITY_V1.1`, no `SLOPE_V1.1`, no aumento de coeficientes ni tuning sobre estas ventanas consumidas.

Hallazgo arquitectónico:
`PortfolioCandidateGate` puede cambiar el orden de candidatos ya `ELIGIBLE`, pero si el conjunto seleccionado no cambia, `InvestmentDecisionEngine` vuelve a calcular pesos sobre el mismo conjunto y el ranking puede desaparecer antes de llegar al capital.

---

# FASE ACTUAL — OPPORTUNITY_RANKING_REACH_AUDIT_V1

Objetivo:
medir exactamente dónde llega o se pierde la información del ranking dentro de la arquitectura existente.

Documento preregistrado:
`docs/opportunity_ranking_reach_audit_v1.md`.

No se crea ninguna pantalla nueva. Se reutiliza `ResearchValidationCenter` y el mismo replay `CORE_ARCHITECTURE_V1`.

Cadena auditada:
`rank cambia -> conjunto seleccionado cambia -> plan BUY/ADD cambia -> compra ejecutada cambia`.

## Protocolo congelado
Misma configuración histórica ya consumida para evitar introducir nuevas elecciones oportunistas:
- 3 ventanas: 10y / 6y / 3y;
- 3 políticas: LEGACY / QUALITY_V1 / SLOPE_V1;
- 9 replays;
- REAL only;
- Yahoo discovery histórico OFF;
- monthly;
- 13.000 EUR;
- MEDIUM;
- horizonte 3 años;
- cash BCE;
- fiscalidad actual;
- `CORE_ARCHITECTURE_V1`;
- `maxSelected = 12`.

Métricas principales:
- gates totales;
- candidatos ELIGIBLE por gate;
- gates donde `eligibleCount > selectedCount` y por tanto existe competencia real de selección;
- competición por categoría (>2 ELIGIBLE en una categoría);
- cambios de orden QUALITY/SLOPE vs LEGACY;
- cambios del conjunto seleccionado;
- cambios de ranking que mueren antes de cambiar el conjunto;
- cambios de plan BUY/ADD;
- cambios de compras BUY/ADD ejecutadas;
- delta final y DD sólo como trazabilidad, no para tuning.

Invariante crítica:
**QUALITY/SLOPE deben producir exactamente el mismo conjunto ELIGIBLE que LEGACY en cada gate.**
Cualquier `eligibleSetParityViolations > 0` significa que una política supuestamente ranking-only contaminó elegibilidad y la interpretación queda invalidada.

Contrato:
- producción permanece `LEGACY`;
- este audit no puede promover ninguna política;
- no tuning en las ventanas consumidas;
- el siguiente diseño arquitectónico deberá apoyarse en lo que revele este audit, no en subir pesos de QUALITY hasta que el backtest mejore.

Job local vigente en `ResearchValidationCenter`:
**Oportunidad · auditoría de alcance del ranking**.

Pasos:
1. `opportunityRankingArchitecture.unit`;
2. `opportunityRankingReachAudit.unit`;
3. `portfolioCandidateGate.unit`;
4. guard replay histórico;
5. `tsc --noEmit`;
6. auditoría REAL 3 políticas x 3 ventanas.

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

V5/V7 se conservan como features potenciales: curva de tipos, crédito, liquidez/régimen y estrés de opciones. No asumir que cada componente individual tenga valor autónomo demostrado.

## V9 — retirada
Veredicto:
`V9_BLIND_FAIL_RETIRE_V9_POLICY_1`.

Holdout consumido:
`SPPW.DE`, `SPY5.DE`, `SPYM.DE`, `ZPRS.DE`, `VGEU.DE`, `ZPDJ.DE`.

- predictivo: 22/56 = 39,29% frente a gate >=50%; FAIL;
- económico: 0/6 PASS;
- mediana final delta ~ -6.791 EUR;
- mediana reducción DD ~ +5,96 pp.

No V9.1 ni tuning.

## V10 — retirada
Veredicto:
`V10_BLIND_FAIL_RETIRE_V10_POLICY_1`.

Holdout consumido:
`VGVF.DE`, `VNRA.DE`, `VFEM.DE`, `VERE.DE`, `VGEK.DE`, `VJPN.DE`.

- 6/6 válidos;
- 0/6 PASS;
- 71 aportaciones aplazadas;
- mediana final delta -219,25 EUR;
- mediana mejora de precio aplazado -1,1907%;
- `DOWN_FIRST=34`, `UP_FIRST=28`, `NEITHER=9`.

Hallazgo retenido: `DOWN_FIRST > UP_FIRST` es compatible con información bajista útil, aunque la política de aplazamiento falló.

No V10.1 ni tuning.

## V11 — retirada
Política:
`V11_POLICY_1`.

Fingerprint:
`sha256:945f39501b58c40735eeb9fc7dbd7ea128985e45b991f3c947c925cbc5cb94c1`.

Holdout consumido:
`IUSQ.DE`, `SXR4.DE`, `EUNM.DE`, `EUNK.DE`, `SXR1.DE`, `SXRZ.DE`.

Veredicto:
`V11_BLIND_FAIL_RETIRE_V11_POLICY_1`.

Agregado:
- 6/6 válidos;
- 0/6 PASS;
- mediana final delta -313,29 EUR;
- mediana delta / contribuciones -0,17229%;
- mediana reducción DD +0,00906 pp;
- mediana wealthEfficiencyRatio 0,999413.

Hallazgo estructural muy importante:
- 272 decisiones `ELIGIBLE`;
- sólo 51 también tenían riesgo >80;
- solapamiento = **18,75%**.

Interpretación: `PortfolioCandidateGate` ya excluía muchas situaciones de alto riesgo; poner Forward Risk sólo después del gate deja poco margen incremental. No usar esto para V11.1; sí conservarlo para arquitecturas futuras distintas.

Documento:
`docs/forward_risk_v11_blind_outcome.md`.

## Conclusión V8 -> V11
1. V8 anticipa caídas con información útil y debe conservarse.
2. ON/OFF diario es demasiado fragmentado.
3. Sell/rebuy V8/V9 destruye upside.
4. Espera binaria V10 pierde recuperación.
5. Sizing V11 posterior al gate casi no reduce DD.
6. No crear V12/V13 como variaciones paramétricas del mismo overlay.
7. Usos futuros posibles: ranking, contexto de riesgo, alertas, stress, margen de seguridad, priorización y modelos conjuntos.

En el audit actual **V8 no se usa todavía** para no mezclar hipótesis. Tras entender dónde llega el ranking podrá estudiarse en shadow si discrimina downside entre candidatos elegibles, con metodología causal separada.

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
- Ranking causal V1 LEGACY vs QUALITY vs SLOPE consumido.

Job vigente:
- `opportunity-ranking-reach-audit-v1` — **Oportunidad · auditoría de alcance del ranking**.

Nunca usar Gemini, agentes ni GitHub Actions para estas ejecuciones largas.

---

# Datos de mercado
- Yahoo Finance: primario para acciones/ETF y discovery current/live.
- EODHD: secundario y NAV de fondos por ISIN cuando está configurado.
- Alpha Vantage: contraste secundario cuando está configurado.
- Cboe: VIX/VIX9D/VVIX de V7/V8.
- FRED/ALFRED: macro point-in-time V5/V8; `FRED_API_KEY` server-side.

Búsqueda manual del replay puede registrar instrumentos EUR por ticker/nombre/ISIN, pero eso no autoriza a usar Yahoo Search actual como catálogo histórico point-in-time.

---

# Próxima secuencia
1. Ejecutar localmente **Oportunidad · auditoría de alcance del ranking**.
2. Exigir `eligibleSetParityViolations = 0`; cualquier valor distinto invalida el supuesto ranking-only.
3. Medir cuántas veces QUALITY/SLOPE cambian orden, conjunto, plan y compra ejecutada.
4. Mantener producción `LEGACY` y no retunear QUALITY/SLOPE.
5. Si el audit confirma que el ranking cambia mucho el orden pero rara vez el conjunto/pesos, diseñar una nueva hipótesis preregistrada para que Opportunity pueda influir de forma acotada en asignación dentro de `CORE_ARCHITECTURE_V1`, no un motor paralelo.
6. Sólo después considerar V8 como contexto/downside feature separada y shadow.
7. Mantener `CORE_ELIGIBILITY_V2` shadow hasta evidencia suficiente para promoción estructural.
8. Instrument master point-in-time sigue pendiente para un replay verdaderamente open-market histórico sin survivorship bias residual.

---

# Producto / UI — núcleo a mantener
- Decisión de hoy.
- Registrar compra ejecutada.
- Mi cartera real / salud.
- Estudio individual.
- Replay histórico auditado.
- Alarmas backend.
- Centro de validación existente.

No crear nuevos apartados para discovery, core eligibility ni ranking si pueden vivir bajo estos flujos.

Pendiente de simplificación:
- fusionar ranking técnico con ranking del estudio cuando haya evidencia suficiente;
- consolidar cobertura/proveedores y controles técnicos en un bloque avanzado.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca evento como entregado.
- Para autonomía WATCH/REDUCE/EXIT con app cerrada, backend debe reconstruir cartera privada por UID y usar clasificación compartida.