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

# FASE ACTUAL — OPPORTUNITY / RANKING CAUSAL COMPARISON V1

Objetivo: mejorar **qué comprar**, no seguir creando overlays de Forward Risk.

No se crea pantalla nueva. Se reutiliza `ResearchValidationCenter`, el mismo replay y `PortfolioCandidateGate`.

Documento preregistrado:
`docs/opportunity_ranking_causal_comparison_v1.md`.

## Políticas existentes comparadas
`PortfolioCandidateGate` ya contiene:
- `LEGACY` — producción actual;
- `QUALITY_V1` — ranking adicional por Reliability/Opportunity;
- `SLOPE_V1` — ranking adicional acotado por estructura de pendientes.

Los tres brazos mantienen exactamente los mismos hard gates:
`REAL -> beats cash -> consensus BUY -> no structural downtrend -> EntryTiming != WAIT`.

`QUALITY_V1` y `SLOPE_V1` sólo pueden cambiar el orden relativo entre candidatos ya `ELIGIBLE`; no cambian gates ni sizing.

Antes de ejecutar la comparación, los dos wrappers experimentales fueron alineados al replay productivo actual `CORE_ARCHITECTURE_V1`; dejaron de usar como baseline el wrapper antiguo `STRATEGIC_CORE_HOLD_V1`.

## Protocolo congelado antes de resultados
Versión:
`OPPORTUNITY_RANKING_CAUSAL_COMPARISON_V1`.

Dataset:
- REAL only;
- carga desde 2014-09-01;
- fin fijo 2026-09-01;
- Yahoo current open discovery desactivado;
- mínimo 30 activos REAL aceptados;
- mínimo 252 barras por decisión.

Tres ventanas:
1. 2016-09-01 -> 2026-09-01 (`LONG_10Y`);
2. 2020-09-01 -> 2026-09-01 (`MEDIUM_6Y`);
3. 2023-09-01 -> 2026-09-01 (`RECENT_3Y`).

Ajustes comunes:
- MONTHLY;
- 13.000 EUR;
- riesgo MEDIUM;
- horizonte 3 años;
- `CUSTODIA_ENGINE`;
- cash histórico BCE DFR con suelo 0%;
- fiscalidad del replay actual;
- `CORE_ARCHITECTURE_V1`.

Ejecuciones: **3 políticas x 3 ventanas = 9 replays**, todos sobre el mismo dataset y configuración.

Métricas:
- final value / retorno / CAGR;
- max drawdown;
- fees / tax / cash interest;
- BUY / ADD / REDUCE / EXIT;
- benchmark structural core y exceso;
- diferencia de adquisiciones frente a LEGACY.

Interpretación:
- diagnóstico histórico בלבד; no blind de promoción;
- producción permanece `LEGACY` aunque un brazo gane;
- no tuning después de ver el resultado;
- cualquier candidato útil requiere future-forward antes de proponer promoción;
- limitación residual: catálogo conocido actual, survivorship bias no completamente eliminado.

Job local vigente en `ResearchValidationCenter`:
**Oportunidad · ranking causal · LEGACY vs QUALITY vs SLOPE**.

Pasos automáticos:
1. `opportunityRankingArchitecture.unit`;
2. `opportunityRankingComparison.unit`;
3. `portfolioCandidateGate.unit`;
4. guard del replay histórico existente;
5. `tsc --noEmit`;
6. comparación REAL 3 políticas x 3 ventanas.

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

En la fase ranking actual **V8 no se usa todavía** para no mezclar hipótesis. Después de entender LEGACY vs QUALITY vs SLOPE podrá estudiarse en shadow si discrimina downside entre candidatos ya elegibles/rankeados, con nueva metodología causal.

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
- Mercado abierto V1 integración live PASS.

Job vigente:
- `opportunity-ranking-causal-comparison-v1` — **Oportunidad · ranking causal · LEGACY vs QUALITY vs SLOPE**.

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
1. Ejecutar localmente **Oportunidad · ranking causal · LEGACY vs QUALITY vs SLOPE**.
2. Si falla guard/TypeScript, corregir infraestructura antes de interpretar resultados.
3. Si completa, analizar diferencias reales de compras y economía entre los tres brazos sin retunear.
4. Mantener producción `LEGACY`.
5. Si QUALITY o SLOPE muestra señal consistente, reservar confirmación future-forward; no promover desde las ventanas históricas conocidas.
6. Después evaluar, como hipótesis separada, si V8 aporta información de downside para desempate/contexto entre oportunidades ya elegibles.
7. Mantener `CORE_ELIGIBILITY_V2` shadow hasta disponer de evidencia suficiente para una promoción estructural.
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
