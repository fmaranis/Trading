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
- `PortfolioCandidateGate`: `LEGACY | QUALITY_V1`
- `CurrentOpportunityAlertEngine` expone ambos scores.
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
- fiscalidad estimada -4,14 €.
- fees +3 €.
- cash final: 6.593,34 € vs 5.139,89 € en CORE; exposición final ~52,1% invertida vs ~63,3% en CORE.

Mecanismo causal 2016:
- el coste aparece progresivamente al mantener más cash durante la recuperación de la segunda mitad del año;
- diferencia de equity vs CORE: ~-72 € fin de junio, -123 € fin de julio, -117 € fin de septiembre, -155 € fin de noviembre y -227 € al cierre;
- se infraponderan, entre otros, EUNL (~-472 € de entradas), EQQQ (~-419 €), IS3N (~-361 €), 4GLD (~-241 €), SAP (~-236 €), además de Adidas; el cash remunerado no compensa el coste de oportunidad.

Conclusión: **QUALITY_SIZING_V1 no es robusto y no debe promocionarse**. Ayuda en 2014 y ligeramente en 2017-18, pero falla materialmente en 2016 al ser demasiado conservador en un régimen de recuperación. No recalibrar los tiers usando estas ventanas; conservar el experimento como evidencia negativa/diagnóstica.

---

# Pendientes / slopes — siguiente bloque

El motor ya calcula causalmente:
- pendiente de regresión log-precio 20/60/120 sesiones;
- aceleración de pendiente 20 vs 60;
- pendiente de SMA20 y SMA50;
- breakout/breakdown 20.

Actualmente estas pendientes se usan en diagnóstico de tendencia y Trend Protection, pero **no tienen peso explícito propio dentro del score de selección/oportunidad**.

Próximo experimento recomendado: `SELECTION_SLOPE_V1`, aislado de sizing.
- mantener LEGACY/CORE HOLD como base;
- no cambiar STARTER/BUILD, caps, slots, cash, CORE_GATE ni Trend Protection;
- añadir únicamente una capa causal de slope quality / slope acceleration al ranking u OpportunityScore;
- evitar duplicar momentum: la pendiente debe aportar forma/continuidad/aceleración de tendencia, no repetir el retorno 20/60/120;
- validar en holdouts no usados para calibrar thresholds.

No combinar slopes y sizing en el mismo primer A/B.