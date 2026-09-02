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
- No seguir añadiendo scores/capas desconectadas: integrar y atribuir antes de cambiar políticas.

---

# Estado vigente — 2026-09-03

Pregunta central: **¿Muevo dinero hoy o no?**

Arquitectura:
1. DÓNDE — ranking/calidad/consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER/BUILD/sizing.
4. CÓMO GESTIONAR — HOLD/ADD/WATCH/PROTECT/REDUCE/EXIT/ROTATE.

Perfil MEDIUM: STARTER READY 3% / STRONG 5%; BUILD 8%; máximo 12 posiciones; máximo 2 nuevas/evaluación. Rotación 1:1 estricta y atómica. Sin deuda/cash negativo.

Cartera real de referencia:
- Vanguard Global `IE00B03HD191`: 12.600 €.
- Vanguard Emerging `IE0031786696`: 1.400 €.
- Capital pendiente: 13.000 €; horizonte 12 meses; cash hurdle 2,5% anual.

---

# Políticas vigentes / hallazgos estructurales

## Strategic growth core
Hallazgo estructural validado: el strategic growth core no debe venderse por deterioro corto ordinario ni financiar rotación táctica competitiva.

Core explícito: `FUND_VANGUARD_GLOBAL`, `FUND_VANGUARD_ESG_DEVELOPED`, `FUND_VANGUARD_US500`, `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

`CORE_GATE_V1` permanece: capital liberado por una posición mediocre puede consolidarse en core global cuando no existe challenger excepcional.

## TREND_PROTECTION_V2
Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Winner: MFE >=8%, giveback >=6 pp; REDUCE 25%, uno por episodio. Perdedor exige persistencia. Hard EXIT sólo satélite profundo/persistente. Reclaim desarma. WATCH/PROTECT no venden y bloquean rotación/CORE_GATE.

La política sigue siendo causal y ejecutable. Su valor económico es mixto; no se modifica todavía.

---

# Experimentos de DÓNDE / CUÁNTO cerrados

## SELECTION_QUALITY_V1
No promocionado. 2017-18 +0,5581 pp vs CORE; 2025-26 -0,0059 pp; 2015 igualdad económica. Conservar scores como diagnóstico.

## QUALITY_SIZING_V1
No promocionado. 2017-18 +0,1051 pp; 2014 +0,199 pp; 2016 -1,7431 pp por exceso de cash durante recuperación. No recalibrar.

## SELECTION_SLOPE_V1
No promocionado. 2013 +0,4804 pp vs CORE; 2012 -0,5699 pp; 2025-26 +0,1151 pp. Agregado ~+0,0256 pp: neutralidad económica. Conservar `SlopeQuality` como diagnóstico/tie-breaker potencial.

---

# CURRENT_VS_CORE_CAUSAL_ATTRIBUTION_V1

No añade otro brazo. Reutiliza CURRENT, V2 y STRATEGIC_CORE_HOLD.

Identidad obligatoria:
`CORE−CURRENT = (V2−CURRENT) + (CORE−V2)`.

## 2025-04-01 → 2026-03-31
- CURRENT: 14.489,42 €, +11,4571%, DD 6,5053%.
- V2 = CORE: 14.450,08 €, +11,1545%, DD 6,7131%.
- `V2 − CURRENT = -39,3362 € / -0,302586 pp`.
- `CORE − V2 = 0`.

Toda la pérdida nace de V2. Primera divergencia 03/03/2026: REDUCE Intesa. Después V2 reduce Vanguard Eurozone, Vanguard Europe y Ferrovial.

## 2015-01-02 → 2015-12-31
- CURRENT: 13.541,29 €, +4,1638%, DD 10,2068%.
- V2: 13.561,19 €, +4,3168%, DD 8,2863%.
- CORE: 13.585,60 €, +4,5046%, DD 8,2863%.
- `V2 − CURRENT = +19,90 € / +0,1531 pp`.
- `CORE − V2 = +24,41 € / +0,1878 pp`.

Primera divergencia CURRENT→V2: 05/06/2015, REDUCE ISPA. Primera divergencia V2→CORE: 26/08/2015, REDUCE EUNL bloqueado por CORE HOLD.

---

# V2_REDUCTION_OUTCOME_AUDIT_V1

Auditoría **ex post exclusivamente diagnóstica**. Usa precios futuros sólo para analizar decisiones pasadas y está prohibido usar sus salidas como input causal del motor.

Registra por REDUCE: causa, retorno/MFE/giveback en señal, fricción, retorno posterior 20/60 sesiones/fin, caída/recuperación máxima y proxy mark-to-market de vender frente a mantener la porción.

Archivos:
- `src/investment/decision/v2ReductionOutcomeAudit.ts`
- `tests/v2ReductionOutcomeAudit.unit.ts`

Gates: lint PASS; test dirigido PASS tras corregir tolerancia IEEE-754; regresión counterfactual sin incidencias reportadas.

Lectura 2015: heterogeneidad real entre REDUCE. ISPA fue útil; Inditex/EUNL/Ferrovial muestran ventas prematuras. La proxy estática no equivale al P&L causal completo porque vender cambia cash, plazas y operaciones posteriores.

Lectura 2025-26: las cuatro ventas de marzo tenían slope20 muy negativa pero slope60 aún positiva y consenso constructivo. La proxy agregada hasta final (~-39,83 €) casi explica toda la pérdida real de V2 vs CURRENT (-39,34 €).

---

# TREND_PROTECTION_V2_MEDIUM_TERM_WINNER_CONFIRM — CERRADO / NO PROMOCIONADO

Experimento dirigido, causal y aislado. **No modifica `classifyTrendProtectionV2` productivo.**

Regla probada: si V2 base intenta `REDUCE` por `WINNER_PROTECTION`, mantener `PROTECT` mientras simultáneamente:
- `regressionSlope60AnnualizedPct > 0`;
- `consensusScore > 0`;
- `unfavorableVotes < 2`.

El REDUCE se mantiene cuando hay al menos una confirmación adicional: slope60 <=0, consenso <=0 o >=2 votos adversos.

No toca LOSER_FAILURE, hard EXIT, reclaim, MFE/giveback, tamaño 25%, selección, sizing, Entry Timing, cash ni CORE_GATE.

Implementación:
- `trendProtectionV2MediumTermConfirm.ts`;
- clasificador inyectado en `replayTrendProtectionV2Experiment.ts`;
- brazo `mediumTermWinnerConfirmExperiment` en worker;
- `tests/trendProtectionV2MediumTermConfirm.unit.ts`.

Backup previo: `backup/main-pre-v2-medium-term-confirm-2026-09-02` → `a6d68dd4fcdb71a93955a4c3b2780bd06f95e58d`.

## Evidencia 1 — 2015
- V2: 13.561,19 €, +4,3168%, DD 8,2863%.
- MEDIUM_TERM_CONFIRM: 13.560,27 €, +4,3098%, DD 8,2741%.
- vs V2: **-0,92 € / -0,0070 pp**; DD -0,0121 pp mejor; turnover -34,31 €.
- Mantiene REDUCE útil de ISPA; retrasa Inditex y Ferrovial. Economía esencialmente neutra, ligeramente peor.

## Evidencia 2 — 2025-04-01 → 2026-03-31
- V2: 14.450,08 €, +11,1545%, DD 6,7131%.
- MEDIUM_TERM_CONFIRM: **14.456,73 €, +11,2056%, DD 6,5461%**.
- vs V2: **+6,65 € / +0,0512 pp**; DD -0,1670 pp mejor.
- Sigue ~32,69 € por debajo de CURRENT.
- No elimina las cuatro ventas: las retrasa entre 1 y 7 días para exigir confirmación media.

## Holdout independiente — 2020-02-03 → 2021-02-02
- CURRENT: 13.474,58 €, +3,6506%, DD 13,5340%.
- V2: **13.716,73 €, +5,5133%, DD 13,6257%**.
- MEDIUM_TERM_CONFIRM: **13.713,35 €, +5,4873%, DD 13,6257%**.
- CORE HOLD: 13.808,35 €, +6,2181%, DD 13,6835%.
- `MEDIUM_TERM_CONFIRM − V2 = -3,38 € / -0,0260 pp`.
- DD idéntico a V2; turnover -10,57 €; tax +0,16 €.
- Conserva las tres reducciones `LOSER_FAILURE` del 16/03/2020 exactamente igual que V2.
- Único cambio económico relevante: retrasa el REDUCE de 4GLD del 24/09/2020 al 10/11/2020; el retraso termina ligeramente peor.
- Restricciones: máximo 12 posiciones; cash nunca negativo.

## Decisión final
**NO PROMOCIONAR.**

Motivo:
- 2015: -0,92 € vs V2.
- 2025-26: +6,65 € vs V2.
- holdout 2020-21: -3,38 € vs V2.

El patrón tiene sentido causal y puede reducir ventas prematuras, pero no demuestra un edge económico robusto fuera de las ventanas que originaron la hipótesis. No ajustar thresholds ni añadir condiciones para intentar salvarlo.

Conservar la idea como diagnóstico sobre “pullback corto vs deterioro medio”, pero mantener V2 productivo sin este filtro.

---

# UX / gráficas — después del motor

Cuando el motor quede cerrado:
- zoom/rango temporal 1M/3M/6M/1A/Todo;
- slope20/60/120, SMA20/SMA50 y señales activables;
- gráfica por operación centrada en ejecución con BUY/ADD/REDUCE/EXIT, timing, consenso, quality, slopes y trayectoria posterior;
- opción de trayectoria completa.

---

# Próxima acción

No crear otro score ni retocar `MEDIUM_TERM_WINNER_CONFIRM`.

La evidencia actual apunta a que la principal mejora estructural validada sigue siendo `STRATEGIC_CORE_HOLD`, mientras que los intentos de ranking, sizing, slope y confirmación media no muestran robustez suficiente.

Siguiente bloque recomendado: **consolidar el motor y decidir si V2 debe permanecer como política experimental de gestión o si conviene comparar directamente CURRENT + STRATEGIC_CORE_HOLD sin la semántica V2 completa**, usando un A/B causal limpio antes de tocar UX.