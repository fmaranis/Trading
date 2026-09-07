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

# Forward Risk — estado cerrado hasta V11

## V8 — información predictiva, no ejecutable directamente
Regla histórica congelada:
`V5 vulnerability >=80 OR V7 options >=80`.

Hechos cerrados:
- EUNL: 11/19 episodios anticipados = 57,89%; lead mediano 63; falsa señal 16,73%.
- Seis holdouts: 72/83 = 86,75% anticipados; lead mediano 40; falsa señal 26,33%; 6/6 PASS predictivo.
- Gate económico: 0/6 PASS; mediana `finalDeltaEur = -13.971,89 €`; mediana reducción drawdown +5,52 pp.
- Fragmentación: 3.974 sesiones, 1.059 ON (26,65%), 111 runs ON, duración mediana 2 sesiones, 222 transiciones.

Conclusión: V8 contiene información anticipativa, pero no sirve como interruptor directo de transacciones.

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

Interpretación: la señal conservaba algo de dirección, pero esperar al 100% tendía a reentrar después de parte de la recuperación.

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

1. Forward Risk sí ha mostrado información anticipativa en investigación predictiva.
2. Convertirla en venta/recompra (V8/V9) destruyó demasiado upside y generó coste/rotación.
3. Convertirla en espera binaria de dinero nuevo (V10) también perdió recuperación.
4. Convertirla en sizing continuo 100%→50% (V11) redujo muy poco la exposición efectiva y no produjo una mejora material de drawdown.
5. Por tanto, **no seguir encadenando V12/V13 como variaciones del mismo overlay** sin una hipótesis arquitectónica realmente distinta y un nuevo holdout virgen.

Forward Risk queda como investigación no productiva. La evidencia predictiva V8 puede conservarse como diagnóstico/telemetría, pero no como orden ni overlay productivo demostrado.

---

# Validaciones locales
Pantalla: `ResearchValidationCenter`.
Ruta backend: `/api/alerts/research-validation/*`.

Estado actual:
- V8 diagnóstico: archivado.
- V9 guard/blind: archivados; V9 retirada.
- V10 guard/blind: archivados; V10 retirada.
- V11 guard/blind: archivados; V11 retirada.
- **No hay un job Forward Risk pendiente de ejecutar.**

No usar Gemini, agentes ni GitHub Actions para cálculos largos.

---

# Datos de mercado
- Yahoo Finance: primario para acciones/ETF y búsqueda abierta.
- EODHD: secundario y NAV de fondos por ISIN si hay API key.
- Alpha Vantage: contraste secundario si hay API key.
- Cboe: VIX/VIX9D/VVIX de V7/V8.
- FRED/ALFRED API: macro point-in-time V5/V8/V11; `FRED_API_KEY` es secreto server-side.

Replay manual abierto puede buscar Yahoo LIVE por nombre/ticker/ISIN y registrar instrumentos dinámicos EUR.

---

# Próxima secuencia recomendada

1. **No crear V11.1 ni un V12 paramétrico.**
2. Mantener `CORE_ARCHITECTURE_V1` sin Forward Risk productivo.
3. Volver al lado de generación de rentabilidad/oportunidades y cerrar `OPEN_MARKET_DISCOVERY_V1` server-side compartido por decisión/alertas/replay/estudio.
4. Después cerrar `CORE_ELIGIBILITY_V2` con criterios auditables de índice amplio/diversificado, histórico, liquidez/divisa y calidad de datos.
5. Integrar mejor `OPPORTUNITY_THRESHOLD_RESEARCH` con el motor existente sólo si holdout + walk-forward justifican promoción, sin crear un motor paralelo.
6. Forward Risk sólo se retoma si aparece una hipótesis realmente distinta y preregistrable que no sea otra variante de vender/esperar/escalar la misma señal.

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
