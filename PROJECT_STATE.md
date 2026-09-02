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

Principio validado: el strategic growth core no debe venderse por deterioro corto ordinario ni utilizarse como fuente de rotación táctica competitiva. Una futura salida requiere tesis estructural independiente.

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

Objetivo: probar Reliability/Opportunity en DÓNDE sin tocar sizing.

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

Objetivo: aislar CUÁNTO. Selección LEGACY + STRATEGIC_CORE_HOLD; ROTATION_ENTRY intacto.
Composite 45% Reliability +55% Opportunity; tiers experimentales 100/90/80/65% del cap LEGACY.

Corrección importante: la primera versión reducía la orden diaria y generaba reintentos. La versión válida usa cap persistente por calidad.

Evidencia válida:
- 2017-18: +0,1051 pp vs CORE; turnover -654 €.
- 2014 OOS: +0,199 pp; DD -0,216 pp; turnover -828 €.
- 2016 OOS: **-1,7431 pp / -226,61 €** vs CORE, aunque DD -0,9169 pp y turnover -2.194 €. Mantuvo demasiado cash durante la recuperación.

Conclusión: **no robusto; no promocionar ni recalibrar tiers con estas ventanas**.

---

# SELECTION_SLOPE_V1 — sexto brazo causal

Objetivo: probar si la forma, continuidad y aceleración de la tendencia mejoran DÓNDE, aislado del sizing.

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

## Evidencia 1 — 2013-01-02 → 2013-12-31
- CORE HOLD: 13.721,83 €, +5,5525%, DD 6,6968%, turnover 21.571,31 €.
- SLOPE: 13.784,28 €, +6,0329%, DD 7,4902%, turnover 23.229,91 €.
- SLOPE vs CORE: **+62,45 € / +0,4804 pp**, pero DD +0,7934 pp y turnover +1.658,61 €.
- CURRENT sigue por encima de SLOPE (~+66,70 €).
- Mecanismo: más despliegue y cambio de composición, especialmente +EUNL/+Siemens; menos LVMH/Inditex/Airbus.

## Evidencia 2 — 2012-01-03 → 2013-01-02
- CORE HOLD: 14.449,52 €, +11,1502%, DD 5,3374%, turnover 19.786,74 €.
- SLOPE: 14.375,44 €, +10,5803%, DD 4,5491%, turnover 19.105,24 €.
- SLOPE vs CORE: **-74,08 € / -0,5699 pp**, pero DD -0,7883 pp y turnover -681,49 €.
- Primera divergencia: CORE compra 4GLD y SLOPE prioriza Repsol; Repsol termina EXIT ~-25,4%. Después SLOPE compensa parcialmente con más L'Oréal pero reduce mucho EUNL.

## Evidencia 3 — 2025-04-01 → 2026-03-31
- CURRENT: 14.489,42 €, +11,4571%, DD 6,5053%.
- CORE HOLD = V2: 14.450,08 €, +11,1545%, DD 6,7131%, turnover 14.062,42 €.
- QUALITY: 14.449,32 €, +11,1486%.
- SIZING: 14.354,40 €, +10,4185%.
- SLOPE: **14.465,05 €, +11,2696%, DD 6,6920%, turnover 13.987,70 €**.

SLOPE vs CORE:
- **+14,97 € / +0,1151 pp**;
- DD **-0,0211 pp mejor**;
- turnover **-74,72 €**;
- fees +1 €, fiscalidad prácticamente idéntica;
- cash nunca negativo; máximo 12/12 posiciones.

SLOPE vs CURRENT:
- ~**-24,37 € / -0,1874 pp**;
- DD ~+0,1867 pp peor.

Mecanismo 2025-26:
- primera divergencia 01/04/2025: CORE prioriza Deutsche Telekom como segunda entrada; SLOPE prioriza Allianz y compra DTE al día siguiente;
- en septiembre SLOPE sustituye el bloque Vanguard ESG Developed (~331,70 € de entradas en CORE) por IUSN (~401,72 €), y omite un ADD posterior de IS3N (~151,32 €);
- Vanguard Emerging recibe ~7,62 € más de entradas; resto del camino es casi idéntico;
- equity SLOPE vs CORE oscila aproximadamente entre -14,94 € y +20,40 €, cerrando +14,97 €.

## Lectura conjunta de SLOPE
- 2013: +0,4804 pp vs CORE, con más DD/turnover.
- 2012: -0,5699 pp vs CORE, con menos DD/turnover.
- 2025-26: +0,1151 pp vs CORE, con DD y turnover ligeramente mejores.

Agregado nominal de las tres ventanas vs CORE: aproximadamente **+3,34 € y +0,0256 pp de retorno**, esencialmente neutro; DD agregado prácticamente neutro. CURRENT supera a SLOPE en las tres ventanas.

Conclusión: `SELECTION_SLOPE_V1` **sí aporta una señal causal real y cambia composición de manera explicable, pero no demuestra un edge robusto de rentabilidad**. No promocionarlo como ranking productivo global y no recalibrar pesos con estas ventanas. Conservar `SlopeQuality` como diagnóstico auditable y posible tie-breaker futuro, no como política principal por ahora.

---

# UX / gráficas — pendiente posterior al motor

Cuando el motor quede cerrado:
- zoom/rango temporal y selector 1M/3M/6M/1A/Todo;
- mostrar/ocultar slope20/60/120, SMA20/SMA50 y señales;
- al pulsar una operación/posición comprada, abrir gráfica del activo centrada en ejecución, por defecto 6 meses antes + 6 meses después, con BUY/ADD/REDUCE/EXIT, precio, timing, consenso, quality y slopes;
- opción de trayectoria completa.

No implementar esta UI hasta cerrar políticas del motor.

---

# Próxima acción

Cerrar el bloque de experimentos de `SELECTION_SLOPE_V1` sin modificar pesos. El motor conserva CORE HOLD como hallazgo estructural validado; QUALITY ranking, QUALITY_SIZING y SLOPE quedan como diagnósticos experimentales no promocionados. El siguiente paso debe centrarse en consolidar el motor y atacar la brecha que sigue mostrando CURRENT frente a los brazos experimentales, sin añadir otra capa de scoring desconectada.