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

## Primera evidencia — 2013-01-02 → 2013-12-31 — holdout no usado previamente

CURRENT:
- final 13.850,98 €; retorno +6,5460%; DD 6,7436%.

CORE HOLD:
- final 13.721,83 €; retorno +5,5525%; DD 6,6968%; turnover 21.571,31 €; cash final 2.574,30 €.

SELECTION_SLOPE_V1:
- final **13.784,28 €**; retorno **+6,0329%**; DD **7,4902%**; turnover **23.229,91 €**; cash final **1.745,65 €**.
- valid=true; cash nunca negativo; max posiciones 12/12.

SLOPE vs CORE HOLD:
- **+62,45 € / +0,4804 pp** de retorno;
- DD **+0,7934 pp peor**;
- turnover **+1.658,61 €**;
- fees -1,59 €, tax estimado +3,98 €;
- mismos 24 BUY y 35 ADD; 12 EXIT; REDUCE 3 → 1.

SLOPE vs CURRENT:
- **-66,70 € / -0,5130 pp** aproximadamente;
- DD ~+0,7466 pp peor.

Mecanismo observado: el ranking slope cambia composición/orden y termina más invertido. Frente a CORE, acumuló aproximadamente +789 € de entradas en EUNL y +412 € en Siemens, además de más SXRV/L'Oréal; evitó LVMH y redujo entradas en Inditex/Airbus. Cash final baja ~829 € vs CORE. El resultado favorable contra CORE puede estar parcialmente ligado al régimen alcista y a mayor despliegue de capital, por lo que **una sola ventana no justifica promoción**.

Exact initial hold 2013: +3,3364%; todos los brazos dinámicos principales lo superan.

Conclusión provisional: primera señal favorable vs CORE, pero con mayor DD/turnover y sin superar CURRENT. **Mantener pesos congelados y validar en otro holdout independiente antes de decidir.**

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

Validar `SELECTION_SLOPE_V1` en un segundo holdout independiente sin cambiar pesos/escalas. Preferencia: **2012-01-03 → 2012-12-31**, DAILY, 13.000 €, automático, tramo 30 días, si el dataset dispone de cobertura suficiente. Comparación principal CORE HOLD vs SLOPE V1; CURRENT sigue siendo referencia secundaria.