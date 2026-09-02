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
- 2015-01-02 → 2015-12-31: CURRENT +4,164%, V2 +4,317%, CORE HOLD +4,505%; CORE HOLD mejora V2 +24,41 € / +0,188 pp con el mismo DD 8,286%. El REDUCE de EUNL del 2015-08-25 desaparece bajo CORE HOLD.
- Hallazgo 2017: V2 vendía SXR8/EUNL para rotar a Intesa/Repsol; CORE HOLD conserva el núcleo. Intesa terminó posteriormente con REDUCE ~-18,8% y EXIT ~-21,3%.

Refactor de rol validado en AI Studio el 2026-09-02: `npm run lint` PASS y `npm run test:trend-protection-counterfactual` PASS, cero errores.

Backup previo al refactor de rol:
`backup/main-pre-portfolio-role-core-2026-09-02` → `1e3f0ab22b868fe608b11e0aaac92c52fb289070`.

---

# SELECTION_QUALITY_V1 — cuarto brazo causal

Objetivo: atacar **selección/composición** sin mezclar sizing.

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

QUALITY_V1 no salta ningún gate: REAL + cash + consenso BUY + Entry Timing siguen obligatorios. Sólo modifica ranking relativo entre elegibles. No cambia sizing.

Backup previo:
`backup/main-pre-selection-quality-v1-2026-09-02` → `a04905336a96a0056b81836a914672f8e58756cf`.

Gates AI Studio 2026-09-02: `lint`, `test:portfolio-candidate-gate`, `test:current-opportunity-alerts` y `test:trend-protection-counterfactual` PASS, cero errores.

## Evidencia QUALITY vs CORE HOLD

### 2017-01-02 → 2018-12-31 — 24m
- CORE HOLD +0,0657%; QUALITY +0,6238%.
- QUALITY: **+72,56 € / +0,5581 pp**.
- DD +0,1442 pp peor; turnover +3.342,42 €; fiscalidad estimada +128,65 €.

### 2025-04-01 → 2026-03-31 — holdout independiente
- CURRENT +11,457%; CORE HOLD +11,154%; QUALITY +11,149%.
- QUALITY vs CORE HOLD: **-0,77 € / -0,0059 pp**, prácticamente empate.
- DD ~0,053 pp mejor y turnover ~103 € menor.
- Cambios principales: orden inicial Allianz/Deutsche Telekom y ausencia de un ADD posterior a IS3N.

### 2015-01-02 → 2015-12-31 — holdout independiente
- CORE HOLD +4,505%; QUALITY +4,505%.
- **Igualdad económica exacta**: mismo final 13.585,60 €, retorno, DD 8,286%, turnover, REDUCE/EXIT y trayectoria.
- Sólo cambia un objetivo teórico interno de un ADD de SXR8; la orden ejecutable acaba siendo la misma.

Lectura: QUALITY ranking mejora una ventana y queda esencialmente neutro en dos holdouts independientes. No se promociona todavía como ranking productivo. Los scores permanecen útiles y auditables como posible señal de sizing.

---

# QUALITY_SIZING_V1 — quinto brazo causal

Objetivo: aislar **CUÁNTO** de **DÓNDE**. Se prueba si Reliability/Opportunity sirven mejor para modular tamaño que para cambiar el ranking.

Implementación:
- `src/investment/decision/qualitySizingPolicy.ts`
- `src/investment/decision/replayQualitySizingExperiment.ts`
- `tests/qualitySizingPolicy.unit.ts`
- `historicalReplayAudit.worker.ts` exporta `trendProtectionV2Counterfactual.qualitySizingExperiment`.

Arquitectura del brazo:
- selección vuelve a **LEGACY**; no usa `SELECTION_QUALITY_V1`;
- gestión = `STRATEGIC_CORE_HOLD_V1`;
- Entry Timing, cash, slots, CORE_GATE, Trend Protection y caps STARTER/BUILD permanecen sin ampliar;
- el overlay actúa sólo después de que el allocator haya decidido candidato, etapa e importe base;
- `ROTATION_ENTRY` queda sin cambios para no mezclar sizing con semántica de rotación.

Composite causal: **45% ReliabilityScore + 55% OpportunityScore**.

Sizing conservador sobre el importe ya autorizado:
- composite >=80 → 100% del importe/cap anterior;
- >=70 → 90%;
- >=60 → 80%;
- <60 → 65%.

Reglas de seguridad:
- nunca aumenta un importe o cap preexistente;
- nunca crea deuda ni cash negativo;
- si la reducción deja una orden por debajo del mínimo económicamente ejecutable, se elimina la orden y el capital queda en cash;
- quality no disponible conserva explícitamente LEGACY y emite warning: no hay fallback silencioso;
- los thresholds anteriores son tiers de diseño del experimento, no optimizados con resultados históricos.

Backup previo:
`backup/main-pre-quality-sizing-v1-2026-09-02` → `fddeb14755f889ed9229d61a15051e71f1174cb0`.

Estado: implementación terminada en `main`; **gates AI Studio pendientes**. No ejecutar replay hasta que pasen `lint`, unit de quality sizing y regresiones de cartera/trend protection.

---

# Pendientes / slopes — estado

El motor ya calcula causalmente:
- pendiente de regresión log-precio 20/60/120 sesiones;
- aceleración de pendiente 20 vs 60;
- pendiente de SMA20 y SMA50;
- breakout/breakdown 20.

Hoy estas pendientes se usan en diagnóstico/estructura de tendencia y Trend Protection. `OpportunityScore` usa por ahora momentum y una aceleración simple basada en momentum, no un peso explícito de las pendientes de regresión.

Plan posterior: probar una variante aislada que añada **slope quality / slope acceleration** a selección/oportunidad, sin mezclarla con el primer A/B de sizing.

---

# Próxima acción

1. Sincronizar `main`.
2. Ejecutar `npm run lint`.
3. Si PASS, ejecutar `npx tsx tests/qualitySizingPolicy.unit.ts`.
4. Si PASS, ejecutar `npm run test:current-capital-allocation`.
5. Si PASS, ejecutar `npm run test:trend-protection-counterfactual`.
6. Si falla alguno, parar y corregir sólo el gate concreto.
7. Si todos pasan, ejecutar replay con quinto brazo y comparar **CORE HOLD vs QUALITY_SIZING_V1** antes de tocar slopes.
