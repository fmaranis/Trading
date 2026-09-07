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
- Forward Risk no modifica todavía el replay productivo.

No reintroducir la salida reactiva tardía del core.

---

# Forward Risk — decisiones vigentes
- V3.1: RETIRADO. No V3.2 ni tuning.
- V4: RESEARCH_ONLY.
- V5: RETIRADO como arquitectura autónoma; sólo se conserva su señal congelada `>=80` dentro de V8.
- V6: RETIRADO. No V6.1.
- V7: RETIRADO como arquitectura autónoma; sólo se conserva su señal congelada `>=80` dentro de V8.
- V8: **información predictiva confirmada y vintage-safe, pero política transaccional económica FALLIDA y señal diaria demasiado fragmentada; RESEARCH_ONLY**.
- V9: **BLIND FAIL / RETIRADO**. No V9.1 sobre la muestra abierta.
- V10: **POLICY_FROZEN / HOLDOUT_SEALED_PENDING_LOCAL_IMPLEMENTATION_GATES / RESEARCH_ONLY**.

Regla V8 permanece congelada:
`V5 vulnerability >=80 OR V7 options >=80`.

## V8 — confirmación predictiva vintage-safe
Macro source `FRED_API_ALFRED_REALTIME_PERIODS`, `macroPointInTimeVintageSafe=true`.

Resultado 2011–2026:
- EUNL: 11/19 episodios anticipados = 57,89%; lead mediano 63; falsa señal 16,73%; PASS.
- Seis holdouts: 72/83 = 86,75% anticipados.
- Lead mediano holdout: 40 sesiones.
- Falsa señal holdout: 26,33%.
- 6/6 benchmarks PASS.

Veredicto:
`V8_VINTAGE_SAFE_CONFIRMATION_PASS_READY_FOR_CAUSAL_ECONOMIC_GATE`.

Cobertura ALFRED parcial queda explícita y no se rellena con current-vintage:
- T10Y2Y/T10Y3M/BAA10Y: sin archivo ALFRED utilizable en 2008–2010 y 2011–2013.
- WALCL: sin archivo ALFRED utilizable en 2008–2010.

## V8 — gate económico causal FAIL
Política fijada antes del resultado:
- capital 13.000 €;
- OFF->ON: vender 25% NEXT_OPEN;
- ON->OFF: recomprar 25% NEXT_OPEN;
- títulos enteros;
- comisiones MyInvestor existentes;
- cash `HISTORICAL_ECB_DFR_FLOOR_0` after-tax;
- fiscalidad española existente;
- baseline buy-and-hold;
- sin grid ni ajuste posterior.

Resultado EUNL:
- hold final ~76.805 €;
- protegido final ~38.181 €;
- delta final ~-38.624 €;
- max drawdown 33,63% -> 27,19% = +6,44 pp de reducción;
- 95 reducciones + 95 recompras;
- turnover ~1,13 M€;
- comisiones ~1.360 €;
- impuestos estimados ~11.429 €;
- tiempo protegido 25,67%;
- `netBreachProtectionEur` ~-176.811 €.

Holdouts:
- 6 válidos;
- 0/6 pasan el gate económico;
- mediana `finalDeltaEur` = -13.971,89 €;
- mediana reducción drawdown = +5,52 pp.

Veredicto:
`V8_CAUSAL_ECONOMIC_GATE_FAIL_RESEARCH_ONLY`.

Interpretación cerrada:
- V8 contiene información anticipativa útil;
- no puede usarse como interruptor directo de venta/recompra.

## V8 — fragmentación confirmada
Sobre 3.974 sesiones reales:
- V8 ON: 1.059 = 26,65%;
- 111 runs ON;
- 222 transiciones;
- duración mediana ON: 2 sesiones;
- 46/111 runs de 1 sesión;
- 80/111 = 72,1% <=3 sesiones;
- 91/111 = 82,0% <=5 sesiones;
- 2022: 19 activaciones.

Veredicto:
`V8_SIGNAL_FRAGMENTATION_CONFIRMED_DIAGNOSTIC_ONLY`.

---

# V9 — blind consumido y política retirada

Política congelada:
`V9_POLICY_1`.

Fingerprint:
`sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0`.

Holdout V9 ya abierto y permanentemente contaminado:
- `SPPW.DE`;
- `SPY5.DE`;
- `SPYM.DE`;
- `ZPRS.DE`;
- `VGEU.DE`;
- `ZPDJ.DE`.

Estos seis no pueden reutilizarse como blind de un sucesor.

## Resultado predictivo V9 blind
- 6 activos evaluados;
- 56 episodios;
- 22 anticipados;
- anticipation rate = 39,29% frente a gate >=50% -> FAIL;
- lead mediano = 39 sesiones frente a gate >=10 -> PASS;
- false protected time = 26,13% frente a gate <=35% -> PASS.

Conclusión: la histéresis eliminó parte del chattering, pero filtró demasiadas señales verdaderas.

## Resultado económico V9 blind
Gate requerido: >=4/6 PASS individuales, mediana `finalDeltaEur >=0` y mediana reducción DD >=1 pp.

Resultado:
- 0/6 PASS económicos;
- mediana `finalDeltaEur` ~-6.791 €;
- mediana reducción drawdown ~+5,96 pp.

Resumen aproximado por activo:
- SPPW.DE: delta ~-6.616 €, reducción DD +6,41 pp;
- SPY5.DE: delta ~-37.288 €, reducción DD +5,52 pp;
- SPYM.DE: delta ~-6.966 €, reducción DD 0 pp;
- ZPRS.DE: delta ~-11.929 €, reducción DD +7,88 pp;
- VGEU.DE: delta ~-4.411 €, reducción DD +6,65 pp;
- ZPDJ.DE: delta 0 €, reducción DD 0 pp, serie sospechosa.

Veredicto final:
`V9_BLIND_FAIL_RETIRE_V9_POLICY_1`.

### Anomalía ZPDJ
La serie usada en el blind presenta comportamiento incompatible con un ETF normal alrededor del inicio del histórico: max drawdown ~68,94%, un único episodio y cero entradas de protección. Se considera posible problema de corporate action/ajuste de precios.

Esto no rescata V9: excluyendo ZPDJ, los otros 5 activos también obtuvieron `economicPass=false`.

Consecuencia:
- V9 queda retirado;
- no probar V9.1, 3/4/5 confirmaciones, otros porcentajes, otras ventanas o nuevos thresholds sobre este holdout;
- el aprendizaje admisible para un sucesor es arquitectónico: una señal de riesgo no debe implicar automáticamente vender posiciones existentes.

---

# V10 — riesgo + oportunidad aplicado sólo a dinero nuevo

Objetivo:
probar si Forward Risk puede mejorar **el momento de entrada del dinero nuevo** sin vender posiciones existentes y sin ignorar la posibilidad de subida.

Archivos:
- `src/investment/decision/forwardRiskV10Policy.ts`;
- `src/investment/decision/forwardRiskV10ValidationProtocol.ts`;
- `tests/forwardRiskV10Policy.unit.ts`;
- `tests/forwardRiskV10ValidationProtocol.unit.ts`;
- `docs/forward_risk_v10_preregistration.md`.

Política congelada:
`V10_POLICY_1`.

Fingerprint:
`sha256:be5dfdfb369e51d28f5e4f3ac1797f7d8bbd3ae0be625be705c9625bfbf4ae0f`.

## Inputs V10 congelados
Riesgo:
`V8 = V5>=80 OR V7>=80`.
No se retoca ningún threshold V8.

Oportunidad positiva:
`PortfolioCandidateGate.status === ELIGIBLE`.

No se crea un predictor alcista V10 ni un nuevo threshold de oportunidad. Se reutiliza el booleano productivo causal ya existente.

## Regla V10 congelada
Posiciones existentes:
`NEVER_SELL_OR_REDUCE`.

Para cada nueva aportación:
1. V8 OFF -> invertir 100% NEXT_OPEN.
2. V8 ON + oportunidad ELIGIBLE -> invertir 100% NEXT_OPEN. La oportunidad prevalece sobre el riesgo.
3. V8 ON + oportunidad no elegible -> aplazar 100% en cash remunerado.
4. Revaluar el cash aplazado cada sesión.
5. Liberar 100% NEXT_OPEN en el primer evento entre:
   - V8 OFF;
   - activo pasa a ELIGIBLE;
   - 63 sesiones de aplazamiento.
6. Nunca vender una posición existente.

Semántica económica:
- aportación 1.000 €;
- primera sesión de mercado de cada mes;
- baseline = invertir cada aportación inmediatamente NEXT_OPEN;
- títulos enteros;
- MyInvestor;
- cash histórico ECB DFR floor 0 after-tax;
- V10 no genera ventas, por lo que no genera plusvalías realizadas por su propia acción; sí fiscalidad del interés de cash.

## Holdout histórico V10 — SELLADO, NO ABIERTO
Selección sólo estructural, sin consultar rentabilidades/drawdowns/volatilidad/resultados V10:
- `V10_BLIND_VGVF` — `VGVF.DE` — IE00BK5BQV03 — Developed World;
- `V10_BLIND_VNRA` — `VNRA.DE` — IE00BK5BQW10 — North America;
- `V10_BLIND_VFEM` — `VFEM.DE` — IE00B3VVMM84 — Emerging Markets;
- `V10_BLIND_VERE` — `VERE.DE` — IE00BK5BQY34 — Developed Europe ex UK;
- `V10_BLIND_VGEK` — `VGEK.DE` — IE00BK5BQZ41 — Asia Pacific ex Japan;
- `V10_BLIND_VJPN` — `VJPN.DE` — IE00B95PGT31 — Japan.

No aparecen en `EUR_ASSET_UNIVERSE`, `EUR_VALIDATION_HOLDOUT_UNIVERSE` ni V9.
No sustituir activos después de abrir el holdout.

## Gate de calidad V10 predeclarado
Antes de evaluar:
- >=756 barras;
- >=36 aportaciones mensuales;
- >=6 aportaciones efectivamente aplazadas por activo;
- fechas únicas;
- open/close positivos;
- ningún salto close-to-close absoluto >40% en una sesión.

Fallo de calidad -> `INVALID_DATA`.
Menos de 6 activos válidos -> agregado `INCONCLUSIVE`.
No reemplazar el activo.

## Gate caída vs subida
Para cada aportación aplazada se observa el baseline inmediato durante 63 sesiones:
- `DOWN_FIRST`: toca -5% antes que +5%;
- `UP_FIRST`: toca +5% antes que -5%;
- `NEITHER`: ninguno.

Así V10 mide explícitamente ambos lados: caída evitada y subida perdida.

## Gate económico V10
PASS individual:
`finalDeltaEur >= 0 AND medianDeferredExecutionPriceImprovementPct >= 0 AND downFirstCount >= upFirstCount`.

PASS agregado:
- 6/6 activos válidos;
- >=4/6 PASS individuales;
- mediana `finalDeltaEur >=0`;
- mediana de mejora del precio de ejecución aplazada >=0%;
- agregado `DOWN_FIRST >= UP_FIRST`.

Sin grid ni tuning tras abrir el holdout.

## Confirmación temporal futura V10
Reservada desde 2026-09-08 inclusive.
No puede usarse para tuning.

---

# Validaciones locales sin tokens de IA
Pantalla: `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

Jobs relevantes:

### `forward-risk-v8-fragmentation-diagnostic`
Diagnóstico V8 real-session.

### `forward-risk-v9-policy-guard`
Guard histórico V9; V9 ya está retirado.

### `forward-risk-v9-blind-validation`
Blind V9 one-shot ya consumido. No volver a usarlo como nueva evidencia.

### `forward-risk-v10-policy-guard`
**Forward Risk V10 · guard de política riesgo + oportunidad**.
Ejecuta únicamente:
1. `npx tsx tests/forwardRiskV10Policy.unit.ts`;
2. `npx tsx tests/forwardRiskV10ValidationProtocol.unit.ts`;
3. `npm run lint`.

No descarga ni abre los seis activos V10 blind. No usa Gemini, agentes ni GitHub Actions.

---

# Datos de mercado
- Yahoo Finance: primario para acciones/ETF y búsqueda abierta.
- EODHD: secundario y NAV de fondos por ISIN si hay API key.
- Alpha Vantage: contraste secundario si hay API key.
- Cboe: VIX/VIX9D/VVIX de V7/V8.
- FRED/ALFRED API: macro point-in-time V5/V8.

Replay manual abierto puede buscar Yahoo LIVE por nombre/ticker/ISIN y registrar instrumentos dinámicos EUR.

Pendientes estructurales después de cerrar V10:
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
1. Sincronizar `main` y ejecutar por botón **Forward Risk V10 · guard de política riesgo + oportunidad**.
2. Si PASS, registrar `localImplementationGates.status = PASS` sin cambiar `V10_POLICY_1` ni fingerprint.
3. Sólo después construir el runner blind V10 one-shot y su guard.
4. Exponer un botón blind separado que ejecute guards + TypeScript antes de abrir históricos.
5. Ejecutar el blind V10 una sola vez en el backend local.
6. Registrar PASS / FAIL / INCONCLUSIVE sin retuning.
7. Si pasa, mantener además confirmación future-forward desde 2026-09-08 antes de considerar cualquier integración productiva.
8. Después continuar `OPEN_MARKET_DISCOVERY_V1` y `CORE_ELIGIBILITY_V2`.
