# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo primero al retomar el proyecto.

## Reglas no negociables
- Nunca usar GitHub Actions para replays o validaciones largas.
- ChatGPT modifica `main`; los cálculos pesados los ejecuta el motor local/backend de la app, no agentes.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No recalibrar thresholds ni políticas sobre muestras ya usadas para decidir PASS/FAIL.
- No crear motores paralelos: decisión, replay y alertas deben compartir scanner, gates y políticas productivas.
- Ningún dato financiero privado de usuario se embebe en código público.

---

# Estado vigente — 2026-09-07

## Motor productivo
La arquitectura productiva cerrada sigue siendo `CORE_ARCHITECTURE_V1`.

Flujo live:
`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> evaluatePortfolioDecision -> ejecución/seguimiento`.

Replay auditado:
- comparte `PortfolioCandidateGate`, `InvestmentDecisionEngine` y `classifyPositionHealth`;
- mantiene `Desde cero / manual / cartera actual` y `Motor Custodia / mantener cartera` dentro del mismo replay;
- cash histórico y fiscalidad siguen integrados;
- Forward Risk **no modifica** producción, Custodia, replay ni live.

---

# OPEN_MARKET_DISCOVERY_V1 — fase actual

Estado:
**IMPLEMENTED_FOR_LOCAL_VALIDATION / CURRENT_LIVE_DISCOVERY / CORE_ELIGIBILITY_V2_SHADOW / NOT_YET_PRODUCTION_PROMOTED**.

Objetivo: dejar de depender de una lista fija sin crear otro motor. La cadena sigue siendo una sola:

`current discovery -> AssetUniverseScanner -> CORE_ELIGIBILITY_V2 shadow -> PortfolioCandidateGate -> motor existente`.

Archivos principales:
- `src/investment/decision/openMarketDiscoveryV1.ts`;
- `src/investment/decision/coreEligibilityV2.ts`;
- `server/assetDiscoveryRoutes.ts`;
- `scripts/openMarketDiscoveryV1Live.ts`;
- `tests/openMarketDiscoveryV1.unit.ts`;
- `tests/coreEligibilityV2.unit.ts`;
- `tests/openMarketDiscoveryArchitecture.unit.ts`;
- `tests/openMarketReplayDiscovery.unit.ts`;
- `docs/open_market_discovery_v1.md`.

## Discovery V1 actual
Endpoint:
`GET /api/alerts/asset-discovery/open-universe`.

Hace un query sweep estructural Yahoo sobre familias de mercado, no una lista de tickers elegida por resultados:
- global/world/all-country;
- USA/S&P 500;
- Europa amplia;
- emergentes;
- Japón;
- small cap;
- tecnología;
- salud;
- energía;
- aggregate bond EUR hedged;
- money market EUR;
- oro.

Reglas:
- barrido autónomo limitado a ETF/EQUITY;
- sólo divisa real EUR;
- inspección mínima 252 barras;
- dedupe por ticker;
- caché server-side 6 h;
- los precios usados por decisiones se vuelven a cargar mediante `AssetUniverseScanner` con provenance REAL;
- discovery sólo propone candidatos: `PortfolioCandidateGate` conserva la autoridad económica.

La búsqueda manual `Buscar mercado` del replay sigue existiendo por ticker/nombre/ISIN.

## Frontera histórica no negociable
Yahoo Search es **CURRENT/LIVE**, no un instrument master histórico point-in-time.

Por tanto:
- `historicalPointInTimeSafe = false` en V1;
- `retrospectiveYahooSearchAllowed = false` en el smoke;
- el motor de replay no llama a `/asset-discovery` ni `/open-universe`;
- por cada fecha histórica ya exige las barras mínimas disponibles hasta esa fecha, evitando utilizar un activo antes de existir historia suficiente;
- `filterCatalogByHistoricalAvailability` formaliza esa disponibilidad para catálogos conocidos;
- esto evita pre-listing lookahead, pero **no elimina por completo survivorship bias** del catálogo actual.

No afirmar “mercado abierto histórico completo” hasta disponer de instrument master point-in-time con altas y delistings/bajas.

## CORE_ELIGIBILITY_V2
Estado:
`SHADOW_AUDIT_NOT_PRODUCTION_GATE`.

No sustituye todavía `PortfolioCandidateGate`, `DynamicCoreSelectorV1` ni ninguna decisión productiva.

Criterios estructurales fijados antes del smoke REAL:
- EUR;
- provenance REAL;
- scanner ACCEPTED;
- >=756 barras;
- categoría amplia `GLOBAL_EQUITY / US_EQUITY / EUROPE_EQUITY / JAPAN_EQUITY / EMERGING_EQUITY`;
- una acción individual `EQ_*` nunca es core;
- `OPEN_*` / `DYNAMIC_*` necesita evidencia explícita `BROAD`; sin metadata -> `REVIEW_REQUIRED`;
- listados: >=80% de cobertura de volumen positiva en 60 barras y mediana de negociación diaria >=250.000 EUR;
- fondos NAV REAL directos no se rechazan por carecer de volumen bursátil; disponibilidad de broker es otra comprobación.

El criterio de liquidez V2 es por ahora estructural/shadow, no un threshold de rentabilidad promovido.

## Validación preparada
Único job vigente en `ResearchValidationCenter`:

**Mercado abierto · V1 · discovery + core shadow**.

Ejecuta:
1. `openMarketDiscoveryV1.unit`;
2. `coreEligibilityV2.unit`;
3. `openMarketDiscoveryArchitecture.unit`;
4. `openMarketReplayDiscovery.unit`;
5. `npm run lint` / `tsc --noEmit`;
6. smoke REAL `openMarketDiscoveryV1Live`.

Smoke REAL:
`Yahoo current discovery -> merge catálogo existente -> AssetUniverseScanner -> CORE_ELIGIBILITY_V2 shadow -> PortfolioCandidateGate`.

No compra, no vende y no cambia cartera.

Semántica:
- `PASS`: infraestructura current/live coherente, candidatos EUR únicos y al menos un descubierto aceptado con provenance REAL;
- `INCONCLUSIVE_EXTERNAL_DISCOVERY_COVERAGE`: Yahoo no aportó cobertura suficiente en esa ejecución;
- guard/TypeScript/runner roto: fallo técnico a corregir.

Un PASS **no demuestra rentabilidad** y no promociona automáticamente CORE_ELIGIBILITY_V2 ni discovery a decisiones productivas.

Tras PASS técnico: revisar cobertura/anomalías y sólo entonces integrar el snapshot current/live en universo compartido de decisión de hoy + alertas. Replay histórico abierto queda condicionado a catálogo point-in-time.

---

# Forward Risk — estado cerrado hasta V11

## PRINCIPIO PERMANENTE DE CONTINUIDAD — NO PERDER V8

**V8 sí mostró capacidad útil para anticipar futuras caídas relevantes.**

Los FAIL económicos de V8/V9/V10/V11 **no deben reinterpretarse como “Forward Risk no sirve”**. Lo que falló hasta V11 fueron las políticas ensayadas para monetizar/ejecutar esa información: venta/recompra, espera binaria y sizing posterior al gate.

La evidencia V8 se preserva como **activo predictivo reutilizable** para investigación futura en riesgo, oportunidad, ranking, alertas, stress, margen de seguridad, priorización, asignación o modelos conjuntos.

Antes de cualquier trabajo futuro relacionado con esas áreas, consultar:
- `docs/forward_risk_v8_retained_predictive_value.md`;
- `docs/forward_risk_retained_research_findings_v8_v11.md`.

Regla conceptual:
> **separar siempre calidad de señal y calidad de política económica. V8 puede contener información valiosa aunque una regla que actúe sobre ella pierda dinero.**

No usar esta conclusión para retunear políticas sobre holdouts consumidos. Cualquier nuevo uso económico requiere hipótesis distinta, preregistro y muestra virgen.

## V8 — información predictiva, no ejecutable directamente
Regla histórica congelada:
`V5 vulnerability >=80 OR V7 options >=80`.

Hechos cerrados:
- EUNL: 11/19 episodios anticipados = 57,89%; lead mediano 63; falsa señal 16,73%.
- Seis holdouts: 72/83 = 86,75% anticipados; lead mediano 40; falsa señal 26,33%; 6/6 PASS predictivo.
- Gate económico: 0/6 PASS; mediana `finalDeltaEur = -13.971,89 €`; mediana reducción drawdown +5,52 pp.
- Fragmentación: 3.974 sesiones, 1.059 ON (26,65%), 111 runs ON, duración mediana 2 sesiones, 222 transiciones.
- 72,1% de los runs ON duraron <=3 sesiones y 82,0% <=5 sesiones: el ON/OFF diario es una mala interfaz ejecutiva aunque el score subyacente pueda ser informativo.

Conclusión: V8 contiene información anticipativa útil sobre caídas futuras, pero no sirve como interruptor directo de transacciones.

V5/V7 se conservan como inputs/features de investigación. No asumir que cada componente individual tiene valor autónomo demostrado, pero tampoco eliminarlos: curva de tipos, crédito, liquidez/régimen y estrés de opciones pueden volver a ser útiles en modelos futuros.

## V9 — máquina de estados retirada
Veredicto:
`V9_BLIND_FAIL_RETIRE_V9_POLICY_1`.

Holdout consumido:
`SPPW.DE`, `SPY5.DE`, `SPYM.DE`, `ZPRS.DE`, `VGEU.DE`, `ZPDJ.DE`.

Resultado:
- predictivo: 22/56 anticipados = 39,29% frente a gate >=50%; FAIL;
- económico: 0/6 PASS;
- mediana `finalDeltaEur ~ -6.791 €`;
- mediana reducción drawdown ~+5,96 pp.

No V9.1 ni tuning sobre esa muestra.

## V10 — aplazamiento binario de dinero nuevo retirado
Veredicto:
`V10_BLIND_FAIL_RETIRE_V10_POLICY_1`.

Holdout consumido:
`VGVF.DE`, `VNRA.DE`, `VFEM.DE`, `VERE.DE`, `VGEK.DE`, `VJPN.DE`.

Resultado:
- 6/6 válidos;
- 0/6 PASS;
- 71 aportaciones aplazadas;
- mediana `finalDeltaEur = -219,25 €`;
- mediana mejora de precio aplazado `-1,1907%`;
- `DOWN_FIRST=34`, `UP_FIRST=28`, `NEITHER=9`.

Interpretación: la política de espera falló, pero `DOWN_FIRST > UP_FIRST` es evidencia compatible con que la señal conservaba información direccional bajista. No valida V10 ni autoriza tuning; sí es un hallazgo que debe recordarse.

No V10.1 ni tuning sobre esa muestra.

## V11 — sizing continuo retirado
Objetivo probado: usar Forward Risk sólo para modular cuánto dinero nuevo desplegar cuando `PortfolioCandidateGate` ya es `ELIGIBLE`, sin vender ni reducir posiciones.

Política:
`V11_POLICY_1`.

Fingerprint:
`sha256:945f39501b58c40735eeb9fc7dbd7ea128985e45b991f3c947c925cbc5cb94c1`.

Sizing congelado:
- score <=80 -> 100%;
- 85 -> 87,5%;
- 90 -> 75%;
- 95 -> 62,5%;
- 100 -> 50%;
- fórmula `score<=80 ? 1 : 1 - 0.5*((score-80)/20)`.

Sin timer de 63 sesiones, sin waiting state, sin ventas. Cash no desplegado remunerado y siguiente revisión mensual normal.

Holdout V11 consumido:
`IUSQ.DE`, `SXR4.DE`, `EUNM.DE`, `EUNK.DE`, `SXR1.DE`, `SXRZ.DE`.

Resultado blind ejecutado localmente el 2026-09-07, evaluado hasta 2026-09-01:

`V11_BLIND_FAIL_RETIRE_V11_POLICY_1`.

Agregado:
- activos válidos: **6/6**;
- PASS individuales: **0/6**;
- mediana `finalDeltaEur = -313,29 €`;
- mediana `finalDeltaPctOfContributions = -0,17229%`;
- mediana reducción de drawdown = **+0,00906 pp**;
- mediana `wealthEfficiencyRatio = 0,999413`;
- gate agregado: FAIL.

Gate congelado exigía:
- 6/6 válidos;
- >=4/6 PASS individuales;
- mediana reducción DD >=0,5 pp;
- mediana delta final >=-0,5% del capital aportado;
- mediana wealth-efficiency ratio >=1.

Por activo:
- IUSQ.DE: delta -422,28 €; DD +0,0013 pp; efficiency 0,999092; FAIL.
- SXR4.DE: delta -1.741,70 €; DD +0,0208 pp; efficiency 0,997421; FAIL.
- EUNM.DE: delta -204,30 €; DD +0,2192 pp; efficiency 1,001070; FAIL.
- EUNK.DE: delta -106,42 €; DD -0,00003 pp; efficiency 0,999734; FAIL.
- SXR1.DE: delta -83,53 €; DD +0,0156 pp; efficiency 0,999867; FAIL.
- SXRZ.DE: delta -3.238,24 €; DD +0,0025 pp; efficiency 0,993119; FAIL.

### Hallazgo estructural V11 que debe conservarse
En los seis activos hubo:
- 272 decisiones `ELIGIBLE`;
- sólo 51 decisiones `ELIGIBLE` con riesgo >80 realmente moduladas;
- solapamiento = **18,75%**.

Por activo: IUSQ 9/52, SXR4 10/53, EUNM 7/35, EUNK 8/55, SXR1 8/40, SXRZ 9/37.

Interpretación: `PortfolioCandidateGate` ya excluye muchas situaciones de riesgo alto. Colocar Forward Risk sólo **después** de que el gate haya dicho `ELIGIBLE` deja poco margen incremental para cambiar el resultado. Esto probablemente contribuye a que V11 apenas redujera drawdown. No usar esta observación para retocar V11; sí conservarla para diseñar arquitecturas futuras realmente distintas.

Interpretación cerrada:
- V11 logra que el coste de rentabilidad mediano sea pequeño, pero prácticamente **no reduce drawdown**.
- Sólo EUNM mejora ligeramente wealth-efficiency, pero su reducción DD (+0,219 pp) sigue muy por debajo del mínimo preregistrado (+0,5 pp).
- No hay problema de calidad que permita declarar INCONCLUSIVE: 6/6 activos son válidos.
- El fallo es económico/metodológico, no técnico.

Consecuencias:
- `V11_POLICY_1` retirada;
- no V11.1 ni tuning de threshold 80, pendiente de sizing, floor 50%, cadence o gates sobre estos seis activos;
- los seis quedan consumidos para cualquier sucesor;
- future-forward V11 desde 2026-09-08 cancelado para promoción porque el blind histórico ya falló;
- V11 no se integra en producción.

Documento de cierre:
`docs/forward_risk_v11_blind_outcome.md`.

---

# Qué hemos aprendido de V8 → V11

1. **V8 sí mostró información anticipativa útil sobre futuras caídas y debe preservarse como activo de investigación.**
2. La señal binaria V8 es muy fragmentada; usar cada ON/OFF como orden destruye utilidad económica.
3. Convertir la señal en venta/recompra (V8/V9) destruyó demasiado upside y generó coste/rotación.
4. Convertirla en espera binaria de dinero nuevo (V10) perdió recuperación, aunque `DOWN_FIRST > UP_FIRST` mantuvo una pequeña evidencia direccional bajista.
5. Convertirla en sizing continuo 100%→50% después de `PortfolioCandidateGate` (V11) tuvo poca capacidad marginal: sólo 18,75% de las decisiones ELIGIBLE fueron realmente moduladas por riesgo >80.
6. Por tanto, **no seguir encadenando V12/V13 como variaciones del mismo overlay**. Si se reutiliza V8, debe ser mediante una hipótesis arquitectónica realmente distinta y un nuevo holdout virgen.
7. Posibles usos futuros a investigar: ranking, penalización de riesgo relativo, confianza de oportunidad, alertas adelantadas, stress, margen de seguridad, priorización de revisión/rebalanceo y features de un modelo conjunto riesgo+oportunidad.

Forward Risk queda fuera de producción, pero **V8/V5/V7 no se consideran conocimiento descartado**. Se conservan como información/telemetría/features potenciales hasta que un uso futuro sea preregistrado y validado.

---

# Validaciones locales
Pantalla: `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

Archivado:
- V8 diagnóstico;
- V9 guard/blind; V9 retirada;
- V10 guard/blind; V10 retirada;
- V11 guard/blind; V11 retirada.

Job vigente:
- `open-market-discovery-v1-validation` — **Mercado abierto · V1 · discovery + core shadow**.

No usar Gemini, agentes ni GitHub Actions para cálculos largos.

---

# Datos de mercado
- Yahoo Finance: primario para acciones/ETF, búsqueda manual y `OPEN_MARKET_DISCOVERY_V1` current/live.
- EODHD: secundario y NAV de fondos por ISIN si hay API key.
- Alpha Vantage: contraste secundario si hay API key.
- Cboe: VIX/VIX9D/VVIX de V7/V8.
- FRED/ALFRED API: macro point-in-time V5/V8/V11; `FRED_API_KEY` es secreto server-side.

Replay manual abierto puede buscar Yahoo LIVE por nombre/ticker/ISIN y registrar instrumentos dinámicos EUR.

---

# Próxima secuencia recomendada

1. Ejecutar localmente **Mercado abierto · V1 · discovery + core shadow**.
2. Corregir cualquier fallo de guards/TypeScript antes de interpretar cobertura externa.
3. Si el smoke REAL es PASS, registrar cobertura y revisar candidatos/anomalías sin usar rentabilidad futura para seleccionar.
4. Integrar el snapshot `OPEN_MARKET_DISCOVERY_V1` current/live en el universo compartido de decisión de hoy y alertas; mantener fallback explícito al catálogo conocido si Yahoo discovery no está disponible.
5. Mantener `CORE_ELIGIBILITY_V2` en shadow hasta comprobar que sus reglas estructurales no eliminan cores válidos por errores de metadata/liquidez.
6. Sólo después promover V2 a pre-gate estructural compartido, sin sustituir `PortfolioCandidateGate`.
7. Para replay histórico abierto: obtener/construir un instrument master point-in-time con altas y delistings. No sustituirlo por Yahoo Search actual.
8. Con universo causal ampliado, volver a oportunidad/ranking y validar qué comprar sobre candidatos no elegidos retrospectivamente.
9. Al diseñar ranking/oportunidad, **recordar V8 como feature/contexto de riesgo candidato**, no como orden automática; cualquier integración requiere validación nueva y causal.
10. No crear V11.1 ni un V12 paramétrico.

---

# Producto / web
Núcleo a mantener:
- Decisión de hoy.
- Registrar compra ejecutada.
- Mi cartera real / salud.
- Estudio individual.
- Replay histórico auditado.
- Alarmas backend.

Pendiente de simplificación:
- fusionar ranking técnico con ranking del estudio;
- consolidar cobertura/proveedores y controles técnicos en un bloque avanzado.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca evento como entregado.
- Para autonomía WATCH/REDUCE/EXIT con app cerrada, backend debe reconstruir cartera privada por UID y usar clasificación compartida.
