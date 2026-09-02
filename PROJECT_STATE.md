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

# Strategic growth core — rol canónico

Principio validado: el **strategic growth core no debe venderse por deterioro corto ordinario ni utilizarse como fuente de rotación táctica competitiva**. Una futura salida requiere una tesis estructural independiente.

Implementación:
- `src/investment/decision/portfolioAssetRole.ts`
- `src/investment/decision/strategicCorePolicy.ts`

Roles:
- `STRATEGIC_GROWTH_CORE`
- `DIVERSIFIED_SLEEVE`
- `TACTICAL_SATELLITE`

Strategic core explícito:
`FUND_VANGUARD_GLOBAL`, `FUND_VANGUARD_ESG_DEVELOPED`, `FUND_VANGUARD_US500`, `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

Semántica:
- REDUCE/EXIT táctico del strategic core → WATCH sin venta;
- el strategic core no financia una rotación táctica ordinaria;
- salida estructural futura deberá ser una política distinta.

Validación destacada:
- 2019: CORE HOLD = V2 al último decimal; no hubo intervención.
- 2017-01-02 → 2018-12-31: CORE HOLD +0,0657%, V2 -1,7666%, CURRENT -0,9874%; CORE HOLD mejora V2 +238,19 € / +1,8323 pp.
- 2015-01-02 → 2015-12-31: CURRENT +4,164%, V2 +4,317%, CORE HOLD +4,505%; CORE HOLD mejora V2 +24,41 € / +0,188 pp con el mismo DD.

CORE_GATE_V1 permanece intencional: si una posición mediocre libera capital y no existe challenger excepcional, se prefiere el core global diversificado antes que perseguir otra apuesta táctica o acumular cash innecesario.

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

---

# SELECTION_QUALITY_V1 — cuarto brazo causal

Objetivo: probar si Reliability/Opportunity mejoran **DÓNDE** sin tocar sizing.

Implementación:
- `src/investment/decision/assetSelectionQuality.ts`
- `PortfolioCandidateGate`: `LEGACY | QUALITY_V1 | SLOPE_V1`.
- `CurrentOpportunityAlertEngine` expone Reliability/Opportunity.
- `replaySelectionQualityExperiment.ts`.

ReliabilityScore 0–100:
- 45% persistencia rolling 60 positiva;
- 25% persistencia rolling 120 positiva;
- 20% calidad de drawdown histórico;
- 10% calidad de volatilidad.

OpportunityScore 0–100:
- 30% ReliabilityScore;
- 25% momentum 120;
- 15% momentum 60;
- 10% momentum 20;
- 10% aceleración simple corto/medio plazo;
- 10% drawdown actual.

QUALITY_V1 no salta REAL + cash + consenso BUY + Entry Timing; sólo modifica ranking relativo entre elegibles.

Evidencia:
- 2017-01-02 → 2018-12-31: +72,56 € / +0,5581 pp vs CORE HOLD, pero DD +0,1442 pp y turnover +3.342 €.
- 2025-04-01 → 2026-03-31: -0,77 € / -0,0059 pp, prácticamente empate.
- 2015-01-02 → 2015-12-31: igualdad económica exacta.

Conclusión: **no promocionar como ranking productivo**. Mantener scores como diagnósticos causales reutilizables.

---

# QUALITY_SIZING_V1 — quinto brazo causal

Objetivo: aislar **CUÁNTO** de **DÓNDE**. Selección = LEGACY; gestión = STRATEGIC_CORE_HOLD_V1. ROTATION_ENTRY no se toca.

Composite: 45% Reliability + 55% Opportunity.

Tiers experimentales:
- >=80 → 100% del cap anterior;
- >=70 → 90%;
- >=60 → 80%;
- <60 → 65%.

La primera implementación era incorrecta: reducía la orden del día y generaba reintentos posteriores del hueco LEGACY. Ese replay se considera inválido para decisión.

Corrección vigente: **cap persistente por calidad**. Para STARTER/BUILD el objetivo máximo de etapa pasa a ser `cap LEGACY × multiplicador quality`. Si ya se alcanza, no vuelve a recomendar el resto LEGACY; si quality mejora, puede crecer sólo dentro del cap original; si empeora, no vende por este motivo.

Gates tras la corrección: `lint`, `qualitySizingPolicy.unit` y `current-capital-allocation` PASS. Invariantes: sin deuda, cash no negativo, caps originales nunca aumentan, rotación intacta.

## Evidencia válida de sizing

### 2017-01-02 → 2018-12-31 — 24m
CORE HOLD: +0,0657%; QUALITY_SIZING_V1: +0,1707%.
- +13,66 € / +0,1051 pp.
- DD +0,4099 pp peor, aunque el trough absoluto fue ligeramente mejor por haber alcanzado un pico previo más alto.
- turnover -653,91 €.
- fiscalidad estimada -12,99 €.
- BUY/ADD 67 → 64; desaparece el churn artificial de la versión previa.

### 2014-01-02 → 2014-12-31 — holdout OOS
CORE HOLD: +6,607%; SIZING: +6,806%.
- +25,86 € / +0,199 pp.
- DD -0,216 pp.
- turnover -828 €.
- supera también a SELECTION_QUALITY_V1 (+41,26 € / +0,317 pp).

### 2016-01-04 → 2017-01-03 — segundo holdout OOS
CURRENT: +8,4145%; CORE HOLD = V2: +7,6298%; QUALITY ranking +7,6859%; QUALITY_SIZING_V1: **+5,8867%**.

SIZING vs CORE HOLD:
- **-226,61 € / -1,7431 pp**.
- DD mejora de 2,8523% a **1,9354%** (-0,9169 pp).
- turnover baja de 11.078,71 € a **8.884,72 €** (-2.193,98 €).
- cash final: 6.593,34 € vs 5.139,89 € en CORE; exposición final ~52,1% invertida vs ~63,3% en CORE.

Mecanismo causal 2016: el coste aparece progresivamente al mantener más cash durante la recuperación de la segunda mitad del año. El cash remunerado no compensa el coste de oportunidad.

Conclusión: **QUALITY_SIZING_V1 no es robusto y no debe promocionarse**. No recalibrar los tiers usando estas ventanas; conservar el experimento como evidencia negativa/diagnóstica.

---

# SELECTION_SLOPE_V1 — sexto brazo causal

Objetivo: probar si la **forma, continuidad y aceleración de la tendencia** mejoran DÓNDE sin repetir el experimento de sizing.

Arquitectura:
- base económica = `STRATEGIC_CORE_HOLD_V1`;
- sizing = **LEGACY** completo; no usa QUALITY_SIZING_V1;
- caps STARTER/BUILD, slots, cash, Entry Timing, CORE_GATE y Trend Protection no cambian;
- REAL + cash + consenso BUY + Entry Timing siguen siendo gates obligatorios;
- `SLOPE_V1` sólo modifica el ranking relativo entre candidatos ya elegibles.

Implementación:
- `StrategyConsensusEngine.assessTrendStructure()` sigue siendo la única fuente de pendientes; no se duplica cálculo.
- `assetSelectionQuality.ts` añade `assessSlopeSelectionQuality()`.
- `PortfolioCandidateGate` añade política explícita `SLOPE_V1` y `slopeQualityScore` auditable.
- `replaySlopeSelectionExperiment.ts` fuerza SLOPE_V1 sobre STRATEGIC_CORE_HOLD_V1.
- `historicalReplayAudit.worker.ts` exporta `trendProtectionV2Counterfactual.slopeSelectionExperiment` como sexto brazo.

SlopeQuality 0–100:
- 25% regresión log-precio 120 sesiones;
- 25% regresión 60;
- 15% regresión 20;
- 15% pendiente SMA20;
- 10% pendiente SMA50;
- 10% aceleración slope20 - slope60.

Normalización:
- transformación suave y acotada `50 + 50*tanh(slope/scale)`;
- valores extremos saturan y no dominan el ranking;
- missing = neutral 50/100, no se inventa pendiente;
- el ajuste final de ranking queda limitado a **±10 puntos**: `(SlopeQuality - 50) × 0,20` con clamp.

Rationale: no usar breakout/breakdown como peso adicional en este primer A/B para evitar mezclar slopes con otro trigger discreto; tampoco se reutiliza el momentum 20/60/120 dentro de SlopeQuality.

Backup previo:
`backup/main-pre-selection-slope-v1-2026-09-02` → `aaaaa51a1f03c02e7887e889a3f1daa1b8b12a9b`.

Estado: implementación terminada; **gates AI Studio pendientes**. Los pesos/escalas son diseño ex ante y no se han calibrado con los resultados históricos ya observados.

---

# Próxima acción

1. Sincronizar `main`.
2. Ejecutar `npm run lint`.
3. Si PASS, ejecutar `npm run test:portfolio-candidate-gate`.
4. Si PASS, ejecutar `npm run test:current-opportunity-alerts`.
5. Si PASS, ejecutar `npm run test:trend-protection-counterfactual`.
6. Detenerse en el primer fallo y corregir sólo ese gate.
7. Si todos pasan, ejecutar una primera ventana de replay con el sexto brazo y comparar principalmente **CORE HOLD vs SELECTION_SLOPE_V1**.
