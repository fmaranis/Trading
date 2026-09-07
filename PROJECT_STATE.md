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
- Forward Risk no modifica el replay productivo.

No reintroducir la salida reactiva tardía del core.

## Forward Risk — decisiones congeladas
- V3.1: RETIRADO. No V3.2 ni tuning.
- V4: RESEARCH_ONLY.
- V5: RETIRADO como arquitectura autónoma; sólo se conserva su señal congelada `>=80` dentro de V8.
- V6: RETIRADO. No V6.1.
- V7: RETIRADO como arquitectura autónoma; sólo se conserva su señal congelada `>=80` dentro de V8.
- V8: **información predictiva confirmada y vintage-safe confirmada, pero política transaccional económica FALLIDA y señal diaria demasiado fragmentada; RESEARCH_ONLY**.
- V9: **POLICY_FROZEN / HOLDOUT_SEALED_PENDING_LOCAL_IMPLEMENTATION_GATES / RESEARCH_ONLY**.

Regla V8 permanece congelada:
`V5 vulnerability >=80 OR V7 options >=80`.

### Confirmación vintage-safe V8 — PASS
Macro source `FRED_API_ALFRED_REALTIME_PERIODS`, `macroPointInTimeVintageSafe=true`.

Resultado 2011–2026:
- EUNL: 11/19 episodios anticipados = 57,89%; lead mediano 63; falsa señal 16,73%; PASS.
- Seis holdouts: 72/83 = **86,75%** anticipados.
- Lead mediano holdout: **40 sesiones**.
- Falsa señal holdout: **26,33%**.
- **6/6 benchmarks PASS**.
- Veredicto: `V8_VINTAGE_SAFE_CONFIRMATION_PASS_READY_FOR_CAUSAL_ECONOMIC_GATE`.

Cobertura ALFRED parcial queda explícita y no se rellena con current-vintage:
- T10Y2Y/T10Y3M/BAA10Y: sin archivo ALFRED utilizable en 2008–2010 y 2011–2013.
- WALCL: sin archivo ALFRED utilizable en 2008–2010.

### Gate económico causal V8 — FAIL
Política fijada antes del resultado:
- capital 13.000 €;
- OFF→ON: vender 25% NEXT_OPEN;
- ON→OFF: recomprar 25% NEXT_OPEN;
- títulos enteros;
- comisiones MyInvestor existentes;
- cash `HISTORICAL_ECB_DFR_FLOOR_0` after-tax;
- fiscalidad española existente;
- baseline buy-and-hold del mismo activo;
- sin grid ni ajuste posterior.

Resultado EUNL:
- hold final: **76.805 €** aprox.;
- protegido final: **38.181 €** aprox.;
- delta final: **−38.624 €**;
- max drawdown: 33,63% → 27,19% (**+6,44 pp de reducción**);
- reducciones: 95;
- recompras: 95;
- turnover: ~1,13 M€;
- comisiones: ~1.360 €;
- impuestos estimados sobre plusvalías: ~11.429 €;
- tiempo protegido: 25,67%;
- `netBreachProtectionEur`: ~−176.811 €.

Holdouts:
- 6 válidos;
- **0/6 pasan** el gate económico;
- mediana `finalDeltaEur`: **−13.971,89 €**;
- mediana reducción drawdown: **+5,52 pp**.

Veredicto:
`V8_CAUSAL_ECONOMIC_GATE_FAIL_RESEARCH_ONLY`.

Consecuencia metodológica:
- V8 no entra en Custodia, sizing, recomendaciones ni alertas.
- No probar 10/25/50, nuevos thresholds, nuevas duraciones ni gates sobre esta misma muestra como corrección retrospectiva de V8.
- El fallo económico no invalida la capacidad anticipativa; invalida **usar el booleano V8 ON/OFF como interruptor transaccional directo**.

### Diagnóstico de fragmentación/chattering V8 — CONFIRMADO
Diagnóstico reproducible sobre **3.974 sesiones reales de mercado**, sin simular trades ni optimizar reglas:
- sesiones V8 ON: **1.059 = 26,65%**;
- runs ON: **111**;
- transiciones ON/OFF: **222**;
- duración mediana ON: **2 sesiones**;
- runs ON de 1 sesión: **46/111**;
- runs ON <=3 sesiones: **80/111 = 72,1%**;
- runs ON <=5 sesiones: **91/111 = 82,0%**;
- 2022: **19 activaciones**.

Flag predeclarado:
`>=20 runs ON AND >=40% de runs ON duran <=3 sesiones de mercado`.

Resultado: ampliamente positivo.
Veredicto: `V8_SIGNAL_FRAGMENTATION_CONFIRMED_DIAGNOSTIC_ONLY`.

Interpretación cerrada:
- V8 puede contener evidencia anticipativa útil;
- el booleano diario está demasiado fragmentado para operar directamente;
- no se corrige V8 retocando la propia señal;
- V9 es una capa temporal con histéresis sobre la señal V8 congelada.

Archivos:
- `scripts/forwardRiskV8FragmentationDiagnosticLive.ts`;
- `tests/forwardRiskV8FragmentationDiagnostic.unit.ts`.

## Forward Risk V9 — protocolo y política congelados antes de abrir holdout
Objetivo V9:
`NORMAL -> ALERTA -> PROTECCION -> RECUPERACION`, usando V8 como evidencia congelada y memoria causal del propio estado. V9 no puede retocar V5/V7 ni introducir resultados futuros como inputs.

### Muestra de desarrollo
Todo lo inspeccionado hasta 2026-09-01 se considera **contaminado pero válido para diseño**. Nunca cuenta como evidencia OOS imparcial de V9.

El actual `EUR_VALIDATION_HOLDOUT_UNIVERSE` tampoco es virgen: `scripts/brokerAwareExecutionSweepLive.ts` ya escanea todo ese catálogo y calcula pérdidas, volatilidad, drawdowns y peores ventanas históricas. Queda excluido como holdout V9.

### Holdout histórico V9 — SELLADO
Fijado antes de diseñar la política, por criterios estructurales y diversificación de exposición:
- `V9_BLIND_SPPW` — `SPPW.DE` — global equity;
- `V9_BLIND_SPY5` — `SPY5.DE` — US equity;
- `V9_BLIND_SPYM` — `SPYM.DE` — emerging equity;
- `V9_BLIND_ZPRS` — `ZPRS.DE` — global small cap;
- `V9_BLIND_VGEU` — `VGEU.DE` — Europe equity;
- `V9_BLIND_ZPDJ` — `ZPDJ.DE` — Japan equity.

No se han incorporado estos seis activos a `EUR_ASSET_UNIVERSE` ni a `EUR_VALIDATION_HOLDOUT_UNIVERSE`.
No abrir/descargar sus series para la validación V9 hasta que los guards locales queden registrados PASS.
No sustituir activos después de abrir el holdout; tampoco sustituir un caso por datos insuficientes.

### Política V9 congelada — `V9_POLICY_1`
Implementación:
`src/investment/decision/forwardRiskV9StateMachine.ts`.

Transiciones:
1. Primer V8 ON: `NORMAL -> ALERTA`; sin trade.
2. Segundo ON dentro de una ventana total de 3 sesiones: `ALERTA -> PROTECCION`; una sola venta 25% `NEXT_OPEN`.
3. Si vence la ventana de 3 sesiones sin segundo ON: `ALERTA -> NORMAL`; sin trade.
4. En `PROTECCION`, ON mantiene estado; no vuelve a vender.
5. Primer OFF: `PROTECCION -> RECUPERACION`; sin recomprar todavía.
6. Cinco OFF consecutivos en total: `RECUPERACION -> NORMAL`; una sola recompra `NEXT_OPEN`.
7. Cualquier ON durante `RECUPERACION`: vuelve a `PROTECCION` sin venta adicional, porque la cartera ya sigue reducida.

Parámetros congelados:
- hits ON para proteger: **2**;
- ventana ALERTA: **3 sesiones**;
- streak OFF para recuperar: **5 sesiones**;
- reducción: **25%**, heredada del gate V8; no se retunea;
- ejecución: **NEXT_OPEN**.

Fingerprint congelado:
`sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0`.

### Gate predictivo V9 congelado
- evento: caída >=5%;
- lookback pre-pico: 63 sesiones;
- se considera anticipación la entrada real a `PROTECCION`, no `ALERTA`;
- anticipation rate >=50%;
- lead mediano >=10 sesiones;
- false protected time <=35%;
- `PROTECCION + RECUPERACION` cuentan como tiempo protegido;
- los 6 activos blind deben ser válidos para PASS; menos de 6 = INCONCLUSIVE, sin reemplazo.

### Gate económico V9 congelado
Misma base del gate V8 para aislar el efecto de la histéresis:
- capital 13.000 €;
- 25% de reducción;
- whole shares;
- comisiones MyInvestor existentes;
- cash histórico ECB DFR floor 0 after-tax;
- fiscalidad española existente;
- `NEXT_OPEN` causal;
- baseline buy-and-hold del mismo activo.

PASS individual:
`finalDeltaEur >= 0 AND drawdownReductionPctPoints >= 1 AND netBreachProtectionEur > 0`.

PASS agregado:
- 6/6 blind válidos;
- >=4/6 PASS individual;
- mediana `finalDeltaEur >= 0`;
- mediana reducción drawdown >=1 pp.

### Candado local antes del holdout
La política está congelada, pero el holdout sigue bloqueado porque:
- `localImplementationGates.status = PENDING`.

Antes de abrirlo deben pasar localmente:
1. `npx tsx tests/forwardRiskV9StateMachine.unit.ts`;
2. `npx tsx tests/forwardRiskV9ValidationProtocol.unit.ts`;
3. `npm run lint`.

Mientras no conste PASS, abrirlo falla con:
`V9_BLIND_HOLDOUT_LOCKED_LOCAL_GATES_NOT_RECORDED`.

Archivos V9:
- `src/investment/decision/forwardRiskV9ValidationProtocol.ts`;
- `src/investment/decision/forwardRiskV9StateMachine.ts`;
- `tests/forwardRiskV9ValidationProtocol.unit.ts`;
- `tests/forwardRiskV9StateMachine.unit.ts`;
- `docs/forward_risk_v9_preregistration.md`.

### Confirmación temporal futura V9
Reservada desde **2026-09-08** inclusive.
No se puede usar para tuning. Es la confirmación temporal realmente virgen porque esas observaciones no existían al sellar el protocolo.

---

# Validaciones sin tokens de IA
Pantalla: `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

Jobs disponibles:

### `forward-risk-v8-fragmentation-diagnostic`
**Forward Risk V8 · diagnóstico de fragmentación**.
- guard V8;
- `npm run lint`;
- diagnóstico V8 real-session.
Marker: `FORWARD_RISK_V8_FRAGMENTATION_RESULT`.
Requiere `FRED_API_KEY`.

### `forward-risk-v9-policy-guard`
**Forward Risk V9 · guard de política congelada**.
Ejecuta únicamente:
1. test unitario de máquina V9;
2. test unitario de protocolo/sellado;
3. `npm run lint`.

No descarga ni inspecciona los seis activos blind, no ejecuta replay largo, no usa Gemini ni GitHub Actions.

Todavía NO existe job de blind validation V9; se creará sólo después de registrar PASS de este guard.

---

# Datos de mercado y descubrimiento
- Yahoo Finance: primario para acciones/ETF y búsqueda abierta.
- EODHD: secundario y NAV de fondos por ISIN si hay API key.
- Alpha Vantage: contraste secundario si hay API key.
- Cboe: VIX/VIX9D/VVIX de V7/V8.
- FRED/ALFRED API: macro point-in-time V5/V8.

Replay manual abierto ya puede buscar Yahoo LIVE por nombre/ticker/ISIN y registrar instrumentos dinámicos EUR.

Pendientes estructurales:
- `OPEN_MARKET_DISCOVERY_V1` server-side compartido por decisión/alertas/replay/estudio.
- `CORE_ELIGIBILITY_V2` con criterios auditables de índice amplio/diversificado, histórico y divisa.

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

---

# Próxima secuencia
1. Ejecutar localmente **Forward Risk V9 · guard de política congelada**. No toca holdout.
2. Si PASS, registrar `localImplementationGates.status = PASS` sin cambiar política ni fingerprint.
3. Sólo después crear el runner blind V9, con los seis activos sellados y gates ya congelados.
4. Ejecutar el blind histórico una única vez en el motor local; no sustituir casos ni retocar V9 tras ver el resultado.
5. Si V9 pasa, mantener además confirmación future-forward desde 2026-09-08; no promover directamente a producción.
6. Después de cerrar este bloque, continuar `OPEN_MARKET_DISCOVERY_V1` y `CORE_ELIGIBILITY_V2`.
