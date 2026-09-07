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
- V5: RETIRADO como arquitectura autónoma; sólo se conserva su señal dentro de la investigación Forward Risk.
- V6: RETIRADO. No V6.1.
- V7: RETIRADO como arquitectura autónoma; sólo se conserva su señal dentro de la investigación Forward Risk.
- V8: información predictiva confirmada y vintage-safe, pero gate económico FAIL y señal fragmentada; RESEARCH_ONLY.
- V9: `V9_BLIND_FAIL_RETIRE_V9_POLICY_1`; política retirada y holdout consumido.
- V10: `V10_BLIND_FAIL_RETIRE_V10_POLICY_1`; política retirada y holdout consumido.
- V11: **POLICY_FROZEN / HOLDOUT_SEALED_PENDING_LOCAL_IMPLEMENTATION_GATES / RESEARCH_ONLY**. No conectado a producción.

## V8 — hechos cerrados
- Regla binaria histórica: `V5 vulnerability >=80 OR V7 options >=80`.
- EUNL: 11/19 episodios anticipados = 57,89%; lead mediano 63; falsa señal 16,73%.
- Seis holdouts: 72/83 = 86,75% anticipados; lead mediano 40; falsa señal 26,33%; 6/6 PASS predictivo.
- Gate económico: 0/6 PASS; mediana `finalDeltaEur = -13.971,89 €`; mediana reducción drawdown +5,52 pp.
- Fragmentación: 3.974 sesiones, 1.059 ON (26,65%), 111 runs ON, duración mediana 2 sesiones, 222 transiciones.

Conclusión V8: contiene información anticipativa útil, pero no sirve como interruptor directo de transacciones.

## V9 — blind consumido
Política: `V9_POLICY_1`.
Fingerprint: `sha256:219a83f8ba3205c33de96a73105e31ee927312b0fc655eaf24edd3bfc8c19fb0`.

Holdout consumido:
`SPPW.DE`, `SPY5.DE`, `SPYM.DE`, `ZPRS.DE`, `VGEU.DE`, `ZPDJ.DE`.

Resultado:
- predictivo: 22/56 anticipados = 39,29% frente a gate >=50%; FAIL;
- lead mediano 39; falsa protección 26,13%;
- económico: 0/6 PASS; mediana `finalDeltaEur ~ -6.791 €`; mediana reducción drawdown ~+5,96 pp.

ZPDJ presentó una posible anomalía de corporate action, pero excluirlo no rescata V9: los otros 5 también fallan económicamente.

No V9.1 ni tuning sobre esa muestra.

---

# V10 — blind consumido y política retirada

Objetivo: probar Forward Risk como control de admisión de dinero nuevo, sin modificar posiciones existentes y usando `PortfolioCandidateGate = ELIGIBLE` como contrapeso de oportunidad.

Política: `V10_POLICY_1`.
Fingerprint: `sha256:be5dfdfb369e51d28f5e4f3ac1797f7d8bbd3ae0be625be705c9625bfbf4ae0f`.

Contrato:
- riesgo V8 binario;
- oportunidad `PortfolioCandidateGate.status === ELIGIBLE`;
- posiciones existentes `NEVER_SELL_OR_REDUCE`;
- 1.000 €/mes;
- riesgo ON + no ELIGIBLE -> aplazar 100%;
- liberación `risk OFF / opportunity ELIGIBLE / 63 sesiones`;
- NEXT_OPEN, títulos enteros, MyInvestor y cash histórico ECB DFR floor 0 after-tax.

Holdout consumido:
`VGVF.DE`, `VNRA.DE`, `VFEM.DE`, `VERE.DE`, `VGEK.DE`, `VJPN.DE`.

Resultado blind:
`V10_BLIND_FAIL_RETIRE_V10_POLICY_1`.

- 6/6 válidos;
- 0/6 PASS;
- 71 aportaciones aplazadas;
- mediana `finalDeltaEur = -219,25 €`;
- mediana mejora de precio aplazado `-1,1907%`;
- `DOWN_FIRST=34`, `UP_FIRST=28`, `NEITHER=9`.

Interpretación cerrada: Forward Risk conserva cierta información direccional, pero la política binaria de esperar no la monetiza; frecuentemente entra después de parte de la recuperación.

Consecuencias:
- V10 retirada;
- no V10.1 ni retuning sobre esos seis activos;
- los seis quedan consumidos para sucesores;
- no integrar V10 en producción.

---

# V11 — sizing continuo de dinero nuevo

Objetivo: comprobar si Forward Risk mejora la **relación retorno/riesgo** cuando deja de decidir vender/esperar y se limita a modular cuánto cash nuevo despliega el motor existente.

Archivos:
- `src/investment/decision/forwardRiskV11SizingOverlay.ts`;
- `src/investment/decision/forwardRiskV11ValidationProtocol.ts`;
- `tests/forwardRiskV11SizingOverlay.unit.ts`;
- `tests/forwardRiskV11ValidationProtocol.unit.ts`;
- `tests/forwardRiskV11BlindValidation.unit.ts`;
- `scripts/forwardRiskV11BlindValidationLive.ts`;
- `docs/forward_risk_v11_preregistration.md`.

Política congelada:
`V11_POLICY_1`.

Fingerprint:
`sha256:945f39501b58c40735eeb9fc7dbd7ea128985e45b991f3c947c925cbc5cb94c1`.

## Arquitectura V11 congelada
El motor existente conserva la autoridad de compra:

`PortfolioCandidateGate.status === ELIGIBLE`

Forward Risk **no puede convertir un REJECTED en compra** y **no vende ni reduce posiciones existentes**.

Score continuo:
`riskScore = max(V5 vulnerability score, V7 options score)`.

Sizing:
- score <=80 -> 100%;
- 85 -> 87,5%;
- 90 -> 75%;
- 95 -> 62,5%;
- 100 -> 50%;
- fórmula: `score<=80 ? 1 : 1 - 0.5*((score-80)/20)`.

La parte no desplegada permanece en cash remunerado. No existe timer de 63 sesiones, máquina de espera ni liberación diaria V11. Se vuelve a evaluar en la siguiente revisión mensual normal.

Semántica:
- 1.000 €/mes;
- primera sesión del mes como fecha de decisión;
- ejecución NEXT_OPEN;
- títulos enteros;
- MyInvestor;
- cash histórico ECB DFR floor 0 after-tax;
- sin ventas causadas por V11.

## Baseline V11
Mismos flujos y mismo `PortfolioCandidateGate`:
- si ELIGIBLE -> despliega 100% del cash disponible NEXT_OPEN;
- si REJECTED -> conserva cash.

## V11 experimental
Mismos flujos y gate:
- si REJECTED -> exactamente igual que baseline;
- si ELIGIBLE -> despliega sólo la fracción continua V11 del cash disponible.

Así el único delta experimental es Forward Risk como sizing overlay.

## Holdout V11 — SELLADO, NO ABIERTO
Seleccionado exclusivamente por metadata estructural antes de cualquier histórico V11:
- `IUSQ.DE` — MSCI ACWI — IE00B6R52259;
- `IUSA.DE` — S&P 500 — IE0031442068;
- `EUNM.DE` — MSCI Emerging Markets — IE00B4L5YC18;
- `EUNK.DE` — MSCI Europe — IE00B4K48X80;
- `SXR1.DE` — MSCI Pacific ex Japan — IE00B52MJY50;
- `IQQJ.DE` — MSCI Japan — IE00B02KXH56.

No aparecen en los universos de producción/holdout existentes ni en V9/V10. No sustituir después de abrir.

## Gate de calidad V11 predeclarado
- >=756 barras;
- >=36 decisiones mensuales;
- >=12 decisiones ELIGIBLE;
- >=4 decisiones ELIGIBLE realmente moduladas por riesgo >80;
- fechas únicas;
- open/close positivos;
- salto close-to-close absoluto <=40%.

Fallo -> `INVALID_DATA`; menos de 6 válidos -> `INCONCLUSIVE`; sin reemplazos.

## Drawdown V11
Se usa `FLOW_ADJUSTED_UNIT_NAV_MAX_DRAWDOWN` mediante unitización de cartera para que las aportaciones externas no creen picos artificiales de equity.

## Gate retorno/riesgo congelado
PASS individual:
`drawdownReductionPctPoints >= 0.5 AND finalDeltaPctOfContributions >= -0.5 AND wealthEfficiencyRatio >= 1`.

`wealthEfficiency = (finalValue/aportacionesTotales)/(1+maxDrawdownPct/100)`.

PASS agregado:
- 6/6 válidos;
- >=4/6 PASS individuales;
- mediana reducción DD >=0,5 pp;
- mediana delta final >=-0,5% del capital aportado;
- mediana wealth-efficiency ratio >=1.

No hay grid ni tuning después de abrir el holdout.

## Estado de preregistro V11
- política: FROZEN;
- holdout: SEALED;
- runner blind: implementado pero bloqueado por protocolo;
- localImplementationGates: **PENDING**;
- producción: desconectada;
- future-forward: reservado desde 2026-09-08 sólo si el histórico blind pasa.

---

# Validaciones locales sin tokens de IA
Pantalla: `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

La interfaz muestra un único job Forward Risk vigente; los anteriores son archivo read-only.

Job visible actual:

### `forward-risk-v11-policy-guard`
**Forward Risk · V11 · guard de sizing continuo**.

Ejecuta únicamente:
1. `npx tsx tests/forwardRiskV11SizingOverlay.unit.ts`;
2. `npx tsx tests/forwardRiskV11ValidationProtocol.unit.ts`;
3. `npx tsx tests/forwardRiskV11BlindValidation.unit.ts`;
4. `npm run lint`.

No abre ni descarga los seis históricos V11 blind. El runner completo ya existe, pero `assertForwardRiskV11HistoricalHoldoutUnlocked()` lo bloquea mientras el PASS local no quede registrado.

Histórico archivado:
- V8 · diagnóstico completado;
- V9 · guard completado;
- V9 · blind FAIL · retirada;
- V10 · guard PASS;
- V10 · blind FAIL · retirada.

No usar Gemini, agentes ni GitHub Actions para cálculos largos.

---

# Datos de mercado
- Yahoo Finance: primario para acciones/ETF y búsqueda abierta.
- EODHD: secundario y NAV de fondos por ISIN si hay API key.
- Alpha Vantage: contraste secundario si hay API key.
- Cboe: VIX/VIX9D/VVIX de V7/V8.
- FRED/ALFRED API: macro point-in-time V5/V8/V11.

Replay manual abierto puede buscar Yahoo LIVE por nombre/ticker/ISIN y registrar instrumentos dinámicos EUR.

Pendientes estructurales después de cerrar Forward Risk V11:
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
1. Sincronizar `main`.
2. Ejecutar el único botón visible **Forward Risk · V11 · guard de sizing continuo**.
3. Si PASS, registrar `localImplementationGates.status=PASS` sin modificar política, fingerprint, holdout ni gates.
4. Sustituir el mismo bloque visible por **Forward Risk · V11 · validación blind**; el runner ya está implementado.
5. Ejecutar blind V11 una sola vez en backend local.
6. Registrar PASS / FAIL / INCONCLUSIVE sin retuning y consumir los seis activos.
7. Sólo si PASS, mantener confirmación future-forward desde 2026-09-08 antes de cualquier integración productiva.
8. Mantener `CORE_ARCHITECTURE_V1` sin Forward Risk productivo hasta completar esa secuencia.
