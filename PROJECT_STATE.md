# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo primero al retomar el proyecto. El detalle histórico permanece en Git.

## Reglas no negociables
- Nunca usar GitHub Actions. Validaciones en local/AI Studio.
- ChatGPT modifica GitHub; AI Studio sincroniza `main`, ejecuta/Preview/valida y no modifica archivos salvo instrucción expresa.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No polling/agentes para procesos largos. El usuario avisa al terminar y ChatGPT revisa una vez.
- No calibrar thresholds con ventanas ya usadas para diagnóstico.
- Tras un fallo, ejecutar primero sólo el test dirigido que falla.

---

# Estado vigente — 2026-09-02

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion.

Pregunta central: **¿Muevo dinero hoy o no?**

Arquitectura:
1. DÓNDE — ranking/calidad/consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER/BUILD/sizing.
4. CÓMO GESTIONAR — HOLD/ADD/WATCH/PROTECT/REDUCE/EXIT/ROTATE.

Perfil MEDIUM: STARTER READY 3% / STRONG 5%; BUILD 8%; máximo 12 posiciones; máximo 2 nuevas/evaluación. Rotación 1:1 estricta y atómica; persistencia challenger 3/10.

Cartera real de referencia:
- Vanguard Global `IE00B03HD191`: 12.600 €.
- Vanguard Emerging `IE0031786696`: 1.400 €.
- Capital pendiente: 13.000 €; horizonte 12 meses; cash hurdle 2,5% anual.

---

# CORE_GATE_V1 — intención preservada

La concentración posterior hacia Vanguard Global/core es deliberada:
- si una posición mediocre/deteriorada libera capital y el challenger no es excepcional, se prefiere un core global diversificado antes que perseguir otra apuesta táctica o acumular cash innecesario;
- prioridad vigente: Vanguard Global → ESG Developed → EUNL/IWDA → SXR8/VUSA;
- no modificar CORE_GATE por el hecho de que concentre capital en el core.

Las grandes aportaciones tardías al Global pueden proceder de consolidar rotaciones en el core y no necesariamente de una nueva señal extrema de compra.

---

# TREND_PROTECTION_V2

Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Thresholds congelados y NO promocionados:
- ganador: MFE >=8% + giveback >=6 pp + deterioro corto;
- REDUCE inicial 25%, máximo uno por episodio realmente ejecutado;
- perdedor requiere persistencia causal;
- hard EXIT sólo para satélite profundo/persistente;
- reclaim desarma episodio;
- ETF con REDUCE25 <1 título entero se degrada a PROTECT;
- WATCH/PROTECT significan NO vender y bloquean también rotación/CORE_GATE.

Cuatro ventanas de diseño/diagnóstico:

| Ventana | CURRENT | V2 | CORE HOLD |
|---|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,6506% | +5,5133% | **+6,2181%** |
| 2021-11-01 → 2022-10-31 | +0,2208% | -0,2916% | **+0,0060%** |
| 2022-07-11 → 2023-07-10 | -0,9692% | -1,4275% | **-1,4275%** |
| 2024-04-01 → 2025-03-31 | +6,8119% | +5,1721% | **+5,2982%** |

CORE HOLD vs V2 en estas cuatro: +146,72 € y +1,1286 pp agregados; coste DD +0,4805 pp concentrado casi totalmente en 2021/22. V2 puro no se promociona como política global.

---

# Strategic growth core — rol canónico

Principio arquitectónico validado: el **strategic growth core no debe venderse por deterioro corto ordinario ni utilizarse como fuente de rotación táctica competitiva**. Una futura salida requerirá una tesis estructural independiente.

Implementación:
- `src/investment/decision/portfolioAssetRole.ts`
- `src/investment/decision/strategicCorePolicy.ts`

Roles:
- `STRATEGIC_GROWTH_CORE`
- `DIVERSIFIED_SLEEVE`
- `TACTICAL_SATELLITE`

Strategic core explícito:
- `FUND_VANGUARD_GLOBAL`
- `FUND_VANGUARD_ESG_DEVELOPED`
- `FUND_VANGUARD_US500`
- `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

La categoría amplia por sí sola NO concede rol estratégico. Vanguard Emerging y holdouts GLOBAL_EQUITY son sleeves; EQQQ es táctico.

Semántica:
- REDUCE/EXIT táctico del strategic core → WATCH sin venta;
- el strategic core no financia una rotación táctica ordinaria;
- salida estructural futura deberá ser una política distinta.

`replayStrategicCoreHoldExperiment.ts` es arnés de validación de esta semántica.

Validación independiente:
- 2019: CORE HOLD = V2 al último decimal; no hubo intervención.
- 2017-01-02 → 2018-12-31 (24m): CORE HOLD +0,0657%, V2 -1,7666%, CURRENT -0,9874%; CORE HOLD mejora V2 +238,19 € / +1,8323 pp con DD sólo +0,0459 pp peor; también supera CURRENT +136,90 € con DD 0,72 pp mejor.
- Hallazgo 2017: V2 vendía SXR8/EUNL para rotar a Intesa/Repsol; CORE HOLD conserva el núcleo. Intesa terminó posteriormente con REDUCE ~-18,8% y EXIT ~-21,3%.

Refactor de rol validado en AI Studio el 2026-09-02: `npm run lint` PASS y `npm run test:trend-protection-counterfactual` PASS, cero errores.

Backup previo al refactor de rol:
`backup/main-pre-portfolio-role-core-2026-09-02` → `1e3f0ab22b868fe608b11e0aaac92c52fb289070`.

---

# SELECTION_QUALITY_V1 — cuarto brazo causal

Objetivo: atacar **selección/composición** sin mezclar todavía sizing.

Implementación:
- `src/investment/decision/assetSelectionQuality.ts`
- `AssetUniverseScanner` expone `reliabilityScore`, `opportunityScore`, `currentDrawdownPct`, `positiveRolling60Pct`, `positiveRolling120Pct`.
- `PortfolioCandidateGate` incorpora `LEGACY | QUALITY_V1`.
- `CurrentOpportunityAlertEngine` expone ambos scores.
- `replaySelectionQualityExperiment.ts` ejecuta QUALITY_V1 sobre STRATEGIC_CORE_HOLD_V1.
- `historicalReplayAudit.worker.ts` exporta `trendProtectionV2Counterfactual.selectionQualityExperiment`.

## ReliabilityScore 0–100
- 45% persistencia rolling 60 positiva;
- 25% persistencia rolling 120 positiva;
- 20% calidad de drawdown histórico;
- 10% calidad de volatilidad.

## OpportunityScore 0–100
- 30% ReliabilityScore;
- 25% momentum 120;
- 15% momentum 60;
- 10% momentum 20;
- 10% aceleración simple corto/medio plazo;
- 10% drawdown actual.

QUALITY_V1 no salta ningún gate: REAL + cash + consenso BUY + Entry Timing siguen obligatorios. Sólo modifica ranking relativo entre elegibles. **Todavía NO cambia sizing**.

Backup previo:
`backup/main-pre-selection-quality-v1-2026-09-02` → `a04905336a96a0056b81836a914672f8e58756cf`.

Gates AI Studio 2026-09-02: `lint`, `test:portfolio-candidate-gate`, `test:current-opportunity-alerts` y `test:trend-protection-counterfactual` PASS, cero errores.

## Primera prueba 2017-01-02 → 2018-12-31 — 24 meses
- CURRENT: final 12.871,64 €; retorno -0,9874%; DD 14,8945%.
- V2: final 12.770,34 €; retorno -1,7666%; DD 14,1286%.
- CORE HOLD: final 13.008,53 €; retorno +0,0657%; DD 14,1745%; turnover 28.774,22 €.
- SELECTION_QUALITY_V1: final **13.081,09 €**; retorno **+0,6238%**; DD **14,3187%**; turnover 32.116,64 €.

QUALITY_V1 vs CORE HOLD:
- **+72,56 € / +0,5581 pp** de retorno;
- DD +0,1442 pp peor;
- turnover +3.342,42 €;
- management turnover +2.264,58 €;
- fees +5,16 €;
- fiscalidad estimada +128,65 €.

QUALITY_V1 vs CURRENT:
- **+209,45 € / +1,6112 pp**;
- DD **0,5758 pp mejor**.

Exact initial hold sigue en +6,2247%, aproximadamente **5,601 pp por encima de QUALITY_V1**. La mejora de selección es material pero todavía no explica todo el gap.

Lectura provisional: primera señal favorable a QUALITY_V1, pero no promocionar ni tocar sizing con una sola ventana; además el incremento de turnover/fiscalidad debe vigilarse.

---

# Pendientes / slopes — estado

El motor ya calcula causalmente:
- pendiente de regresión log-precio 20/60/120 sesiones;
- aceleración de pendiente 20 vs 60;
- pendiente de SMA20 y SMA50;
- breakout/breakdown 20.

Hoy estas pendientes se usan en diagnóstico/estructura de tendencia y Trend Protection. `OpportunityScore` usa por ahora momentum y una aceleración simple basada en momentum, no un peso explícito de las pendientes de regresión.

Plan: probar una variante aislada posterior que añada **slope quality / slope acceleration** al score de selección u oportunidad, sin mezclarla simultáneamente con cambios de sizing. Sólo se integrará si mejora evidencia causal/OOS y no aumenta churn de forma injustificada.

---

# Próxima acción

1. Mantener thresholds y sizing congelados.
2. Validar SELECTION_QUALITY_V1 en otra ventana independiente antes de promoverlo.
3. Después decidir entre:
   - experimento de slopes dentro de selección;
   - experimento `QUALITY_SIZING_V1` de concentración/sizing.
4. No combinar slopes y sizing en el mismo primer A/B: atribución antes que optimización conjunta.
