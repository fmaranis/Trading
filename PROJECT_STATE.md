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
- V8: **información predictiva confirmada y vintage-safe confirmada, pero política transaccional económica FALLIDA; RESEARCH_ONLY**.

Regla V8 permanece congelada:
`V5 vulnerability >=80 OR V7 options >=80`.

### Confirmación vintage-safe — PASS
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

### Gate económico causal — FAIL
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
- No probar ahora 10/25/50, nuevos thresholds, nuevas duraciones ni gates sobre esta misma muestra.
- El fallo económico no invalida la capacidad anticipativa; invalida **usar el booleano V8 ON/OFF como interruptor transaccional directo**.

### Diagnóstico de fragmentación/chattering — EN CURSO
El ZIP del gate económico ya muestra indicios fuertes sin cambiar ninguna regla:
- EUNL: **95 ciclos ON**;
- duración mediana ON por días naturales: **3 días**;
- 54/95 ciclos duran <=3 días;
- 68/95 duran <=5 días;
- 2022 concentra 19 activaciones.

Estos conteos del ZIP son preliminares porque usan fechas naturales. Se ha creado un diagnóstico reproducible sobre **sesiones reales de mercado**, sin simular trades ni optimizar nada:
- `scripts/forwardRiskV8FragmentationDiagnosticLive.ts`;
- `tests/forwardRiskV8FragmentationDiagnostic.unit.ts`.

El diagnóstico mide:
- sesiones V8 ON y porcentaje de tiempo activo;
- número de transiciones ON/OFF;
- duración de runs ON/OFF en sesiones de mercado;
- runs ON de 1, <=3 y <=5 sesiones;
- gaps OFF cortos;
- fuente de señal `V5_ONLY / V7_ONLY / BOTH`;
- activaciones por año.

Flag diagnóstico predeclarado, no gate productivo:
`>=20 runs ON AND >=40% de runs ON duran <=3 sesiones de mercado`.

Un diagnóstico positivo sólo permitiría concluir que V8 puede ser evidencia de régimen informativa pero demasiado fragmentada para trading directo. Cualquier futura máquina de estados/histeresis tendría que validarse con un protocolo nuevo y predeclarado; no puede optimizarse sobre esta muestra.

---

# Validaciones sin tokens de IA
Pantalla: `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

Job visible vigente:
`forward-risk-v8-fragmentation-diagnostic` — **Forward Risk V8 · diagnóstico de fragmentación**.

Ejecuta:
1. Guard V8 fragmentación.
2. `npm run lint`.
3. V8 diagnóstico ON/OFF sobre sesiones reales de EUNL.

Marker: `FORWARD_RISK_V8_FRAGMENTATION_RESULT`.
Requiere `FRED_API_KEY`. No usa Gemini ni GitHub Actions.

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
1. Ejecutar **Forward Risk V8 · diagnóstico de fragmentación**.
2. Si confirma chattering, cerrar V8 como señal transaccional directa y conservarla sólo como posible evidencia de régimen para investigación futura con protocolo nuevo.
3. Completar `OPEN_MARKET_DISCOVERY_V1`.
4. Diseñar `CORE_ELIGIBILITY_V2` y seguir simplificando UI/ranking/controles.
