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

# Estado vigente — 2026-09-02

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

# Políticas / experimentos

## Strategic growth core
Hallazgo estructural validado: el strategic growth core no debe venderse por deterioro corto ordinario ni financiar rotación táctica competitiva. Core explícito: `FUND_VANGUARD_GLOBAL`, `FUND_VANGUARD_ESG_DEVELOPED`, `FUND_VANGUARD_US500`, `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

CORE_GATE_V1 permanece: capital liberado por una posición mediocre puede consolidarse en core global cuando no existe challenger excepcional.

## TREND_PROTECTION_V2
Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**. Winner: MFE >=8%, giveback >=6 pp; REDUCE 25%, uno por episodio; perdedor exige persistencia; hard EXIT sólo satélite profundo/persistente; reclaim desarma; WATCH/PROTECT no venden y bloquean rotación/CORE_GATE.

La política es causal y ejecutable, pero su valor económico es mixto. La prioridad actual es entender cuándo un REDUCE aporta protección neta y cuándo sólo cristaliza ganancias/costes.

## SELECTION_QUALITY_V1
No promocionado. 2017-18 +0,5581 pp vs CORE; 2025-26 -0,0059 pp; 2015 igualdad económica. Conservar scores como diagnóstico.

## QUALITY_SIZING_V1
No promocionado. 2017-18 +0,1051 pp; 2014 +0,199 pp; 2016 -1,7431 pp por exceso de cash durante recuperación. No recalibrar.

## SELECTION_SLOPE_V1
No promocionado. 2013 +0,4804 pp vs CORE con peor DD/turnover; 2012 -0,5699 pp con mejor DD/turnover; 2025-26 +0,1151 pp con DD/turnover ligeramente mejores. Agregado ~+0,0256 pp: neutralidad económica. Conservar `SlopeQuality` como diagnóstico/tie-breaker potencial.

---

# CURRENT_VS_CORE_CAUSAL_ATTRIBUTION_V1

No es otro brazo: reutiliza CURRENT, TREND_PROTECTION_V2 y STRATEGIC_CORE_HOLD.

Identidad obligatoria:
`CORE−CURRENT = (V2−CURRENT) + (CORE−V2)`.

Exporta primera divergencia CURRENT→V2, V2→CORE y CURRENT→CORE; acciones/entradas/ventas por activo; ganancias realizadas; cash/exposición; máximas ventajas temporales. La identidad debe reconciliar al céntimo.

Backup previo: `backup/main-pre-current-core-attribution-2026-09-02` → `f99120829df6db078519c5b02d82e1abb403430e`.

## Atribución 2025-04-01 → 2026-03-31
CURRENT: 14.489,42 €, +11,4571%, DD 6,5053%.
V2 = CORE HOLD: 14.450,08 €, +11,1545%, DD 6,7131%.
- `V2 − CURRENT = -39,3362 € / -0,302586 pp`.
- `CORE − V2 = 0,00 €`.
- residual = 0.
Toda la pérdida nace de V2. Primera divergencia 03/03/2026: REDUCE Intesa. Después V2 reduce Vanguard Eurozone, Vanguard Europe y Ferrovial. Total reducido en marzo ~626,25 €.

## Atribución 2015-01-02 → 2015-12-31
CURRENT: 13.541,2879 €, +4,163753%, DD 10,206783%.
V2: 13.561,1879 €, +4,316830%, DD 8,286265%.
CORE HOLD: 13.585,5963 €, +4,504587%, DD 8,286265%.
- `V2 − CURRENT = +19,8999 € / +0,153076 pp`.
- `CORE − V2 = +24,4084 € / +0,187757 pp`.
- `CORE − CURRENT = +44,3084 € / +0,340834 pp`.
- residual = 0.
Primera divergencia CURRENT→V2: 05/06/2015, REDUCE 25% ISPA (~188,30 €) aún en +2,42% tras MFE +12,56%; CURRENT espera y termina reduciendo más tarde alrededor de -9,06%.
Primera divergencia V2→CORE: 26/08/2015, V2 reduce EUNL (~203,52 €) con retorno ~-1,53% tras MFE +15,46%; CORE HOLD bloquea esa venta.

---

# V2_REDUCTION_OUTCOME_AUDIT_V1

Auditoría **ex post exclusivamente diagnóstica**. No cambia V2 ni ejecuta otro brazo. Usa precios futuros sólo para evaluar decisiones pasadas y está prohibido usar sus salidas como input del motor causal.

Para cada REDUCE registra causa, retorno/MFE/giveback en señal, comisión+impuesto, retorno posterior 20/60 sesiones y hasta fin de replay, máxima caída/recuperación posteriores y una proxy mark-to-market de vender el notional reducido frente a mantenerlo.

Archivos:
- `src/investment/decision/v2ReductionOutcomeAudit.ts`
- `tests/v2ReductionOutcomeAudit.unit.ts`
- persistido como `trendProtectionV2Counterfactual.v2ReductionOutcomeAudit`.

Backup: `backup/main-pre-v2-reduction-outcome-audit-2026-09-02` → `389533a97f769767f438169a67d372c1b7795698`.

Gates: `lint` PASS; test dirigido corregido por tolerancia IEEE-754 y PASS reportado por usuario; regresión counterfactual ejecutada antes del replay sin incidencias reportadas.

## Resultado audit 2015
7 REDUCE V2: 6 `WINNER_PROTECTION`, 1 `LOSER_FAILURE`. Notional total reducido: **1.328,59 €**; fricción realizada: **31,42 €**.

Proxy estática de la porción vendida:
- 20 sesiones: **-27,99 €**.
- 60 sesiones: **-41,15 €**.
- hasta fin: **-46,36 €**.

No contradice que V2 completo gane +19,90 € a CURRENT: la proxy no reproduce cambios posteriores de cash, plazas, rotaciones y entradas.

Casos destacados:
- ISPA 05/06: slope60 ~**-14,4% anualizada**; proxy **+13,09 € a 60 sesiones**. Protección temprana útil.
- Inditex 07/07: slope60 ~**+4,49%**; proxy **-22,45 € a 20**. Prematura.
- EUNL 26/08: proxy **-32,02 € a 60**; CORE HOLD bloquea correctamente esa venta.
- Ferrovial 09/12: slope60 ~**+10,03%**; reducción tardía/prematura con horizonte corto.

## Resultado audit 2025-04-01 → 2026-03-31
4 REDUCE V2, todos `WINNER_PROTECTION`, total **626,25 €**. Fricción total ~**30,20 €**.

Todos muestran ruptura corta fuerte pero **pendiente 60d todavía positiva y consenso claramente constructivo**:
- Intesa: slope60 ~+9,31%, consenso +4, proxy fin ~+0,78 €.
- Vanguard Eurozone: slope60 ~+1,43%, consenso +5, proxy fin ~-6,89 €.
- Vanguard Europe: slope60 ~+4,69%, consenso +4, proxy fin ~-3,87 €.
- Ferrovial: slope60 ~+12,49%, consenso +4, proxy fin ~-29,84 €.

Proxy agregada hasta final ~**-39,83 €**, prácticamente igual a la pérdida real de V2 vs CURRENT (**-39,34 €**) en esta ventana.

Hipótesis causal surgida del contraste 2015/2025-26: una ruptura 20d debe poder armar `PROTECT`, pero un `REDUCE` de ganador parece necesitar confirmación adicional de horizonte medio o consenso. El rasgo más consistente observado es slope60 <=0 en el caso útil ISPA, frente a slope60 >0 en varios recortes prematuros; EUNL es excepción cubierta por Strategic Core Hold.

---

# TREND_PROTECTION_V2_MEDIUM_TERM_WINNER_CONFIRM — experimento dirigido

**Implementado, todavía NO validado ni promocionado.** No modifica `classifyTrendProtectionV2` productivo.

Regla experimental: cuando V2 base intenta `REDUCE` por `WINNER_PROTECTION`, mantener `PROTECT` si simultáneamente:
- `regressionSlope60AnnualizedPct > 0`;
- `consensusScore > 0`;
- `unfavorableVotes < 2`.

El REDUCE se conserva si hay al menos una evidencia adicional causal: slope60 <=0, consenso <=0 o >=2 votos adversos.

No toca `LOSER_FAILURE`, hard EXIT, reclaim, MFE/giveback, tamaño 25%, selección, sizing, Entry Timing, cash ni CORE_GATE.

Implementación integrada:
- `trendProtectionV2MediumTermConfirm.ts`: wrapper causal sobre V2 base.
- `replayTrendProtectionV2Experiment.ts`: mismo motor/estado reutilizado mediante clasificador inyectado; sin duplicar replay.
- `historicalReplayAudit.worker.ts`: brazo `mediumTermWinnerConfirmExperiment` con delta vs V2 y CORE HOLD.
- `tests/trendProtectionV2MediumTermConfirm.unit.ts`: invariantes de confirmación y preservación de LOSER_FAILURE.

Backup previo: `backup/main-pre-v2-medium-term-confirm-2026-09-02` → `a6d68dd4fcdb71a93955a4c3b2780bd06f95e58d`.

Estado: implementación terminada; gates locales pendientes. No interpretar económicamente hasta PASS.

---

# UX / gráficas — después del motor

Pendiente cuando se cierre el motor:
- zoom/rango temporal y selector 1M/3M/6M/1A/Todo;
- mostrar/ocultar slope20/60/120, SMA20/SMA50 y señales;
- al pulsar una operación, gráfica del activo centrada en ejecución, por defecto 6 meses antes + 6 meses después, con BUY/ADD/REDUCE/EXIT, precio, timing, consenso, quality y slopes;
- opción de trayectoria completa.

---

# Próxima acción

1. Validar el experimento dirigido: `lint`, test específico `trendProtectionV2MediumTermConfirm.unit.ts` y regresión `test:trend-protection-counterfactual`.
2. Si PASS, ejecutar primero replay 2015-01-02 → 2015-12-31 y después 2025-04-01 → 2026-03-31 sin tocar parámetros entre ambos.
3. Comparar `mediumTermWinnerConfirmExperiment` principalmente contra V2; CORE HOLD como referencia secundaria.
4. Sólo si la hipótesis sobrevive esas dos ventanas, usar una tercera ventana independiente antes de considerar promoción.
