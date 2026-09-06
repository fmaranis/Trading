# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo primero al retomar el proyecto. El detalle histórico permanece en Git; este documento contiene sólo el estado vigente.

## Reglas no negociables
- Nunca usar GitHub Actions para replays o validaciones largas.
- ChatGPT modifica `main`; los cálculos pesados los ejecuta el motor de la propia app/backend, no un agente consumiendo tokens.
- AI Studio se usa como entorno/preview, no como terminal asistida para lanzar cálculos repetitivos.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No recalibrar thresholds sobre ventanas ya usadas para decidir si una arquitectura pasa o falla.
- No crear motores paralelos: decisión actual, replay y alertas deben compartir scanner, gates y políticas productivas.
- Ningún dato financiero privado de un usuario se embebe en código público.

---

# Estado vigente — 2026-09-07

## Motor productivo
La arquitectura productiva cerrada sigue siendo `CORE_ARCHITECTURE_V1`.

Flujo live principal:
`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> evaluatePortfolioDecision -> ejecución/seguimiento`.

Replay auditado:
- usa el mismo `PortfolioCandidateGate` e `InvestmentDecisionEngine`;
- usa `classifyPositionHealth` compartido con cartera real;
- `Desde cero / manual / cartera actual` y `Motor Custodia / mantener cartera` pertenecen al mismo replay;
- cash histórico y fiscalidad siguen integrados;
- Forward Risk no modifica el replay productivo.

No reintroducir la salida reactiva tardía del core.

## Forward Risk — decisiones congeladas
- **V3.1: RETIRADO.** No V3.2 ni tuning.
- **V4: RESEARCH_ONLY.** Dirección razonable, anticipación insuficiente.
- **V5: RETIRADO como arquitectura autónoma.** 7/19 = 36,84%; lead 58; falsa vulnerabilidad 14,62%. Sólo se conserva su señal congelada `>=80` dentro de V8.
- **V6: RETIRADO.** 2/19 = 10,53%. No V6.1.
- **V7: RETIRADO como arquitectura autónoma.** 6/19 = 31,58%; lead 43; falsa señal 7,35%. Sólo se conserva su señal congelada `>=80` dentro de V8.
- **V8: COMPLEMENTARIEDAD CONFIRMADA Y VINTAGE-SAFE CONFIRMADA; NO PROMOVIDA.** Regla fija `V5 >=80 OR V7 >=80`, sin pesos ni retuning.

### Confirmación inicial / cross-benchmark
EUNL con macro current-vintage: 11/19 = 57,89%, lead mediano 52, falsa señal 19,06%.

Seis benchmarks global-equity holdout predeclarados:
- 83 episodios;
- 68 anticipados = 81,93%;
- lead mediano 40;
- falsa señal 20,52%;
- 6/6 benchmarks pasaron.

### Confirmación macro point-in-time — RESUELTA
El gate ALFRED/FRED real-time-period pasó sin cambiar V5/V7/V8.

Resultado vintage-safe 2011–2026:
- macro source `FRED_API_ALFRED_REALTIME_PERIODS`;
- `macroPointInTimeVintageSafe=true`;
- cargadas `T10Y2Y`, `T10Y3M`, `BAA10Y`, `WALCL`;
- no fallback a FRED current-vintage ni a datos sintéticos;
- EUNL: 11/19 = **57,89%**, lead mediano **63**, falsa señal **16,73%**, PASS;
- seis holdouts: **72/83 = 86,75%** anticipados;
- lead mediano holdout **40**;
- falsa señal holdout **26,33%**;
- **6/6 benchmarks PASS**;
- veredicto `V8_VINTAGE_SAFE_CONFIRMATION_PASS_READY_FOR_CAUSAL_ECONOMIC_GATE`.

Cobertura ALFRED parcial, explícita y no rellenada:
- T10Y2Y/T10Y3M/BAA10Y: sin archivo ALFRED utilizable en ventanas 2008–2010 y 2011–2013;
- WALCL: sin archivo ALFRED utilizable en 2008–2010.
Eso explica ausencia de señal macro vintage-safe en parte del tramo temprano; no se sustituye por datos conocidos hoy.

V1/V2/V3/V3.1 están retirados del worker automático. V4/V5/V6/V7/V8 siguen sin alimentar decisiones productivas.

## Bloqueo metodológico vigente: utilidad económica causal
El bloqueo ya no es el vintage macro. Ahora V8 debe demostrar que una acción ejecutable mejora dinero/riesgo después de comisiones, impuestos, cash remunerado y coste de oportunidad.

Política económica **congelada antes del resultado**:
- capital: **13.000 €**;
- señal: `V5>=80 OR V7>=80`, sin cambios;
- transición OFF→ON: vender **25%** de las participaciones/títulos al primer open posterior a la fecha de información;
- transición ON→OFF: recomprar con ese cash al primer open posterior;
- ejecución: **NEXT_OPEN** estricta; una señal de la misma fecha nunca puede usar ese open;
- títulos enteros;
- comisión: `brokerCommission` / perfil MyInvestor existente;
- cash: `HISTORICAL_ECB_DFR_FLOOR_0`, remuneración after-tax mediante `accrueRemuneratedCashScenarioAfterTax`;
- fiscalidad: modelo español existente; contexto no confirmado => reserva conservadora 30% sobre plusvalías positivas y 19% sobre intereses de cash;
- baseline: buy-and-hold del mismo activo con la misma compra inicial y comisión; no se liquida al final, de modo que el diferimiento fiscal del hold es una penalización realista contra la estrategia protegida;
- sin grid de 10/25/50 ni ajuste posterior.

Gate individual congelado:
`finalDeltaEur >= 0 AND drawdownReductionPctPoints >= 1 AND netBreachProtectionEur > 0`.

Gate global congelado:
- EUNL debe pasar individualmente;
- los 6 holdouts deben ser válidos;
- al menos **4/6** holdouts deben pasar individualmente;
- mediana holdout de `finalDeltaEur >= 0`;
- mediana holdout de reducción de drawdown `>=1 pp`.

Incluso con PASS:
- `productionPromotionAllowed=false`;
- el siguiente estado sería shadow/paper validation, no integración automática en Custodia.

Implementado:
- `scripts/forwardRiskV8EconomicGateLive.ts`;
- `tests/forwardRiskV8EconomicGate.unit.ts`.

---

# Validaciones sin tokens de IA
La pantalla incluye `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

Job automático vigente: `forward-risk-v8-economic-gate` — **Forward Risk V8 · gate económico causal**.

Ejecuta:
1. `Guard V8 económico`;
2. TypeScript (`npm run lint`);
3. `V8 contrafactual económico NEXT_OPEN`.

Marker de resultado: `FORWARD_RISK_V8_ECONOMIC_RESULT`.
Requiere `FRED_API_KEY`. No llama a Gemini y no usa GitHub Actions.

El resultado reporta por EUNL y cada holdout:
- valor final hold vs protegido;
- delta final y rentabilidad;
- drawdown hold vs protegido y reducción;
- dinero ganado/perdido en fechas de breach;
- beneficio/coste marginal por ciclo de protección;
- tiempo protegido;
- comisiones, turnover, impuestos sobre plusvalías e intereses de cash;
- auditoría de cada trade con `signalDate` y `executionDate`.

---

# Datos de mercado y descubrimiento

## Proveedores
- **Yahoo Finance**: primario para acciones/ETF y búsqueda abierta.
- **EODHD**: secundario para contraste y NAV de fondos por ISIN si hay API key.
- **Alpha Vantage**: contraste secundario si hay API key.
- **Cboe**: históricos VIX/VIX9D/VVIX de V7/V8.
- **FRED/ALFRED API**: macro point-in-time V5/V8 con `FRED_API_KEY`.

## Replay manual abierto
El replay manual puede buscar Yahoo LIVE por nombre/ticker/ISIN, validar histórico REAL y registrar instrumentos dinámicos EUR. El estudio individual acepta ticker directo y fondos/ISIN mediante `FundMarketDataService`.

### Pendiente estructural de descubrimiento
La decisión automática y las alarmas backend todavía parten de `EUR_PORTFOLIO_DISCOVERY_UNIVERSE`; aún no escanean todo Yahoo. Pendiente `OPEN_MARKET_DISCOVERY_V1` server-side compartido.

## CORE
`STRATEGIC_GROWTH_CORE_ASSET_IDS` sigue siendo una lista explícita. Pendiente `CORE_ELIGIBILITY_V2` con criterios auditables de índice amplio/diversificado, no sectorial, histórico suficiente y divisa controlada.

---

# Producto / web

## Mantener como núcleo
- Decisión de hoy.
- Registrar compra ejecutada.
- Mi cartera real / salud de posiciones.
- Estudio individual.
- Replay histórico auditado.
- Alarmas backend.

## Reorganizado
`MarketUtilityDashboard` prioriza:
1. Decisión de hoy.
2. Registrar ejecución si existe compra pendiente.
3. Cartera real.
4. Seguimiento operativo e historial (plegado).
5. Explicación/consenso/plan operativo (plegado).

El antiguo panel Forward Risk V1 fue retirado y sustituido por `ResearchValidationCenter`.

## Pendiente de simplificación
- fusionar ranking técnico con ranking del estudio;
- consolidar cobertura/proveedores + controles técnicos en un único bloque avanzado.

---

# Alertas / persistencia
- Dedupe durable en Firestore cuando Firebase está configurado.
- Webhook/Telegram fallido no marca evento como entregado.
- EODHD/Alpha son secundarios y no bloquean Yahoo.
- Para autonomía WATCH/REDUCE/EXIT con app cerrada, backend debe reconstruir cartera privada por UID y usar clasificación compartida.

---

# Próxima secuencia
1. Ejecutar `Forward Risk V8 · gate económico causal` desde `Validaciones de investigación -> Ejecutar sin IA`.
2. Si PASS: preparar shadow/paper validation manteniendo V8 fuera de producción.
3. Si FAIL: mantener V8 research-only y **no** retocar 25%, 80/80 ni el gate usando esta muestra.
4. Completar `OPEN_MARKET_DISCOVERY_V1`.
5. Diseñar `CORE_ELIGIBILITY_V2` y seguir simplificando UI/ranking/controles.
