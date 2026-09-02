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

Pregunta central: **¿Muevo dinero hoy o no?**

Arquitectura:
1. DÓNDE — ranking/calidad/consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER/BUILD/sizing.
4. CÓMO GESTIONAR — HOLD/ADD/WATCH/PROTECT/REDUCE/EXIT/ROTATE.

Perfil MEDIUM: STARTER READY 3% / STRONG 5%; BUILD 8%; máximo 12 posiciones; máximo 2 nuevas/evaluación. Rotación 1:1 estricta y atómica; persistencia challenger 3/10. Sin deuda/cash negativo.

Cartera real de referencia:
- Vanguard Global `IE00B03HD191`: 12.600 €.
- Vanguard Emerging `IE0031786696`: 1.400 €.
- Capital pendiente: 13.000 €; horizonte 12 meses; cash hurdle 2,5% anual.

---

# Strategic growth core

Principio validado: el **strategic growth core no debe venderse por deterioro corto ordinario ni utilizarse como fuente de rotación táctica competitiva**. Una futura salida requiere tesis estructural independiente.

Roles canónicos: `STRATEGIC_GROWTH_CORE`, `DIVERSIFIED_SLEEVE`, `TACTICAL_SATELLITE`.
Strategic core explícito: `FUND_VANGUARD_GLOBAL`, `FUND_VANGUARD_ESG_DEVELOPED`, `FUND_VANGUARD_US500`, `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

Semántica: REDUCE/EXIT táctico del strategic core → WATCH sin venta; el core no financia rotación táctica ordinaria.

Validación destacada:
- 2019: CORE HOLD = V2; no hubo intervención.
- 2017-01-02 → 2018-12-31: CORE HOLD +0,0657%, V2 -1,7666%, CURRENT -0,9874%; CORE mejora V2 +1,8323 pp.
- 2015: CURRENT +4,164%, V2 +4,317%, CORE HOLD +4,505% con mismo DD que V2.

CORE_GATE_V1 permanece intencional: capital liberado por una posición mediocre puede consolidarse en el core global si no existe challenger excepcional.

---

# TREND_PROTECTION_V2

Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Thresholds congelados/no promocionados: MFE ganador >=8%, giveback >=6 pp; REDUCE inicial 25%, uno por episodio; perdedor exige persistencia; hard EXIT sólo satélite profundo/persistente; reclaim desarma; WATCH/PROTECT no venden y bloquean rotación/CORE_GATE.

---

# SELECTION_QUALITY_V1 — cuarto brazo

Objetivo: probar Reliability/Opportunity en **DÓNDE** sin tocar sizing.

ReliabilityScore: persistencia rolling 60/120 + calidad DD + volatilidad.
OpportunityScore: Reliability + momentum 120/60/20 + aceleración simple + DD actual.

No salta REAL + cash + consenso BUY + Entry Timing.

Evidencia:
- 2017-18: +0,5581 pp vs CORE, DD +0,1442 pp, turnover +3.342 €.
- 2025-26: -0,0059 pp, empate práctico.
- 2015: igualdad económica exacta.

Conclusión: **no promocionar**; conservar scores auditables.

---

# QUALITY_SIZING_V1 — quinto brazo

Objetivo: aislar **CUÁNTO**. Selección LEGACY + STRATEGIC_CORE_HOLD; ROTATION_ENTRY intacto.
Composite 45% Reliability +55% Opportunity; tiers experimentales 100/90/80/65% del cap LEGACY.

Corrección importante: la primera versión reducía la orden diaria y generaba reintentos. La versión válida usa **cap persistente por calidad**.

Evidencia válida:
- 2017-18: +0,1051 pp vs CORE; turnover -654 €.
- 2014 OOS: +0,199 pp; DD -0,216 pp; turnover -828 €.
- 2016 OOS: **-1,7431 pp / -226,61 €** vs CORE, aunque DD -0,9169 pp y turnover -2.194 €. Mantuvo demasiado cash durante la recuperación.

Conclusión: **no robusto; no promocionar ni recalibrar tiers con estas ventanas**.

---

# SELECTION_SLOPE_V1 — sexto brazo causal

Objetivo: probar si la **forma, continuidad y aceleración de la tendencia** mejoran DÓNDE, aislado del sizing.

Arquitectura:
- base económica `STRATEGIC_CORE_HOLD_V1`;
- sizing LEGACY completo; no usa QUALITY_SIZING_V1;
- caps STARTER/BUILD, slots, cash, Entry Timing, CORE_GATE y Trend Protection congelados;
- REAL + cash + consenso BUY + Entry Timing siguen siendo obligatorios;
- sólo cambia ranking relativo entre elegibles.

Implementación:
- única fuente de pendientes: `StrategyConsensusEngine.assessTrendStructure()`;
- `assetSelectionQuality.ts`: `assessSlopeSelectionQuality()`;
- `PortfolioCandidateGate`: política `SLOPE_V1` + `slopeQualityScore` auditable;
- `replaySlopeSelectionExperiment.ts`;
- `historicalReplayAudit.worker.ts`: sexto brazo `slopeSelectionExperiment`.

SlopeQuality 0–100:
- 25% regresión log-precio 120;
- 25% regresión 60;
- 15% regresión 20;
- 15% pendiente SMA20;
- 10% pendiente SMA50;
- 10% aceleración slope20-slope60.

Normalización: `50 + 50*tanh(slope/scale)`, missing neutral 50; ajuste de ranking limitado a ±10 puntos: `(SlopeQuality-50)*0,20` con clamp. No se incluyen breakout/breakdown ni momentum en este score para mantener atribución limpia.

Backup previo: `backup/main-pre-selection-slope-v1-2026-09-02` → `aaaaa51a1f03c02e7887e889a3f1daa1b8b12a9b`.

Gates AI Studio previos al replay: lint, candidate gate, current opportunity alerts y trend-protection-counterfactual PASS.

## Primera evidencia — 2013-01-02 → 2013-12-31

CURRENT: final 13.850,98 €; +6,5460%; DD 6,7436%.
CORE HOLD: final 13.721,83 €; +5,5525%; DD 6,6968%; turnover 21.571,31 €; cash final 2.574,30 €.
SLOPE: final **13.784,28 €**; **+6,0329%**; DD **7,4902%**; turnover **23.229,91 €**; cash final **1.745,65 €**.

SLOPE vs CORE:
- **+62,45 € / +0,4804 pp**;
- DD **+0,7934 pp peor**;
- turnover **+1.658,61 €**.

Mecanismo: termina más invertido y cambia composición: aproximadamente +789 € de entradas EUNL, +412 € Siemens, más SXRV/L'Oréal; evita LVMH y reduce Inditex/Airbus. Señal favorable vs CORE, pero no supera CURRENT y puede estar ligada al régimen alcista.

## Segunda evidencia — 2012-01-03 → 2013-01-02

CURRENT:
- final **14.464,48 €**; retorno **+11,2652%**; DD **5,5113%**; turnover ~20.154,22 €.

CORE HOLD:
- final **14.449,52 €**; retorno **+11,1502%**; DD **5,3374%**; turnover **19.786,74 €**; cash final **2.862,48 €**.

SELECTION_SLOPE_V1:
- final **14.375,44 €**; retorno **+10,5803%**; DD **4,5491%**; turnover **19.105,24 €**; cash final **3.262,75 €**.
- valid=true; cash nunca negativo; restricciones de cartera respetadas.

SLOPE vs CORE:
- **-74,08 € / -0,5699 pp** de retorno;
- DD **-0,7883 pp mejor**;
- turnover **-681,49 €**;
- tax estimado ~-2,21 €; fees ~+2,05 €.

SLOPE vs CURRENT:
- ~**-89,04 € / -0,6849 pp**;
- DD ~**-0,9622 pp mejor**.

Composición causal destacada vs CORE:
- +927,79 € de entradas en L'Oréal;
- +387,04 € en Repsol;
- -746,99 € en EUNL;
- -390 € Airbus;
- -371,91 € 4GLD.

La primera divergencia es inmediata: CORE compra 4GLD el 04/01/2012 mientras SLOPE prioriza Repsol; Repsol acaba en EXIT con ~-25,4%. SLOPE compensa parcialmente más adelante con L'Oréal, pero reduce de forma material EUNL. La diferencia frente a CORE es negativa durante prácticamente todo el año (~-50 € fin de enero, -173 € fin de marzo, -190 € fin de abril, -155 € fin de agosto, -74 € al cierre).

Lectura acumulada de SLOPE: **2013 mejora retorno vs CORE pero empeora DD/turnover; 2012 reduce claramente DD/turnover pero pierde retorno.** Hay evidencia de que el score aporta una señal real y cambia composición, pero todavía no demuestra edge robusto de rentabilidad. Mantener pesos congelados; no recalibrar con estas dos ventanas.

---

# UX / gráficas — pendiente posterior al motor

Cuando el motor quede cerrado, revisar la UX de gráficas:
- zoom/rango temporal y selector 1M/3M/6M/1A/Todo;
- mostrar/ocultar slope20/60/120, SMA20/SMA50 y señales;
- al pulsar una operación/posición comprada, abrir gráfica del activo centrada en la ejecución, por defecto 6 meses antes + 6 meses después, con BUY/ADD/REDUCE/EXIT, precio, timing, consenso, quality y slopes;
- opción de trayectoria completa.

No implementar esta UI hasta cerrar políticas del motor.

---

# Próxima acción

No tocar pesos de `SELECTION_SLOPE_V1`. Ejecutar un tercer holdout independiente antes de decidir. Preferencia: **2025-04-01 → 2026-03-31**, DAILY, 13.000 €, automático, tramo 30 días. Aunque esa ventana se utilizó como holdout de QUALITY, no se utilizó para diseñar ni ajustar SLOPE y ofrece un régimen reciente muy distinto de 2012/2013. Comparación principal CORE HOLD vs SLOPE V1; CURRENT como referencia secundaria.