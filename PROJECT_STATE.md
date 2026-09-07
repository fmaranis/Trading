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
- V8: información predictiva confirmada y vintage-safe, pero gate económico FAIL y señal fragmentada; RESEARCH_ONLY.
- V9: `V9_BLIND_FAIL_RETIRE_V9_POLICY_1`; política retirada y holdout consumido.
- V10: `V10_BLIND_FAIL_RETIRE_V10_POLICY_1`; política retirada y holdout consumido.

Regla V8 congelada:
`V5 vulnerability >=80 OR V7 options >=80`.

## V8 — hechos cerrados
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

Archivos principales:
- `src/investment/decision/forwardRiskV10Policy.ts`;
- `src/investment/decision/forwardRiskV10ValidationProtocol.ts`;
- `tests/forwardRiskV10Policy.unit.ts`;
- `tests/forwardRiskV10ValidationProtocol.unit.ts`;
- `tests/forwardRiskV10BlindValidation.unit.ts`;
- `scripts/forwardRiskV10BlindValidationLive.ts`;
- `docs/forward_risk_v10_preregistration.md`.

Política: `V10_POLICY_1`.
Fingerprint: `sha256:be5dfdfb369e51d28f5e4f3ac1797f7d8bbd3ae0be625be705c9625bfbf4ae0f`.

### Contrato congelado
- riesgo: V8 congelado `V5>=80 OR V7>=80`;
- oportunidad: `PortfolioCandidateGate.status === ELIGIBLE`;
- posiciones existentes: `NEVER_SELL_OR_REDUCE`;
- aportación de investigación: 1.000 € al mes;
- baseline: desplegar cada aportación en la siguiente apertura;
- V10: sólo aplazar dinero nuevo cuando hay riesgo V8 y no hay oportunidad ELIGIBLE;
- reevaluación cada sesión;
- liberación en el primer `risk OFF / opportunity ELIGIBLE / 63 sesiones`;
- títulos enteros, MyInvestor y cash histórico ECB DFR floor 0 after-tax.

### Guard previo
Ejecutado localmente el 2026-09-07:
- `forwardRiskV10Policy.unit: PASS`;
- `forwardRiskV10ValidationProtocol.unit: PASS`;
- `tsc --noEmit: PASS`.

No cambió política, fingerprint ni holdout.

### Holdout V10 consumido
Activos:
- `VGVF.DE` — Developed World;
- `VNRA.DE` — North America;
- `VFEM.DE` — Emerging Markets;
- `VERE.DE` — Developed Europe ex UK;
- `VGEK.DE` — Asia Pacific ex Japan;
- `VJPN.DE` — Japan.

Los 6/6 superaron el gate de calidad. No hay sustituciones ni rescate por datos insuficientes.

### Resultado blind one-shot
Ejecución local completada el 2026-09-07; evaluada hasta 2026-09-01.

Veredicto:
`V10_BLIND_FAIL_RETIRE_V10_POLICY_1`.

Agregado:
- activos válidos: 6/6;
- PASS individuales: 0/6;
- aportaciones aplazadas: 71;
- mediana `finalDeltaEur = -219,25 €`;
- mediana mejora de precio aplazado = `-1,1907%`;
- `DOWN_FIRST = 34`;
- `UP_FIRST = 28`;
- `NEITHER = 9`.

Por activo:
- VGVF.DE: 8 aplazadas; delta -138,50 €; mejora mediana -1,1286%; DOWN/UP/NEITHER 5/3/0; FAIL.
- VNRA.DE: 10 aplazadas; delta -337,18 €; mejora mediana -1,2529%; 4/6/0; FAIL.
- VFEM.DE: 18 aplazadas; delta -334,85 €; mejora mediana -1,3930%; 7/7/4; FAIL.
- VERE.DE: 10 aplazadas; delta -11,58 €; mejora mediana -1,2901%; 5/4/1; FAIL.
- VGEK.DE: 8 aplazadas; delta -74,19 €; mejora mediana -1,1096%; 4/3/1; FAIL.
- VJPN.DE: 17 aplazadas; delta -300,00 €; mejora mediana +0,0391%; 9/5/3; FAIL.

### Interpretación cerrada
V10 confirma que Forward Risk conserva cierta información direccional: 34 casos alcanzan -5% antes que +5%, frente a 28 en sentido contrario. Sin embargo, esa información no se monetiza con la política binaria de aplazar el 100% y liberar después: 5/6 activos tienen peor precio mediano al liberar el cash y 6/6 terminan con delta final negativo.

La lección admisible es arquitectónica: detectar riesgo no equivale a disponer de una regla económica rentable; esperar hasta desaparición del riesgo u oportunidad confirmada puede entrar después de parte de la recuperación.

Consecuencias:
- V10_POLICY_1 retirada;
- no V10.1 ni tuning de ventanas, porcentajes, thresholds o reglas sobre estos seis activos;
- los seis quedan consumidos para cualquier blind sucesor;
- la ventana future-forward desde 2026-09-08 no se usa para promocionar V10 porque el blind ya falló;
- si Forward Risk continúa, requiere arquitectura nueva preregistrada y holdout independiente todavía no inspeccionado.

---

# Validaciones locales sin tokens de IA
Pantalla: `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

La interfaz conserva sólo validaciones vigentes como botones. V8, V9, guard V10 y blind V10 están archivados y read-only.

Estado actual: **no hay un job Forward Risk pendiente de ejecutar**.

Histórico:
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
- FRED/ALFRED API: macro point-in-time V5/V8.

Replay manual abierto puede buscar Yahoo LIVE por nombre/ticker/ISIN y registrar instrumentos dinámicos EUR.

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
1. V10 queda cerrado; no volver a ejecutar ni retunear sobre el holdout consumido.
2. No integrar V10 en producción ni en Custodia/replay/live.
3. Si se continúa Forward Risk, definir primero una arquitectura sucesora y sellar un holdout independiente antes de abrir históricos; sólo puede heredarse de V10 la lección arquitectónica, no parámetros ajustados a sus resultados.
4. Mantener `CORE_ARCHITECTURE_V1` sin Forward Risk productivo.
5. Después continuar `OPEN_MARKET_DISCOVERY_V1` y `CORE_ELIGIBILITY_V2`.