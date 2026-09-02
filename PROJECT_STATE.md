# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto. Repositorio canónico y línea viva: `fmaranis/Trading/main`. El detalle histórico anterior permanece en Git.

## Reglas no negociables

- Nunca usar GitHub Actions. Validaciones en local/AI Studio.
- ChatGPT modifica GitHub; AI Studio trabaja sobre `main` para ejecutar/Preview/validar.
- Antes de cambios sustanciales, conservar backup cuando sea útil; revertir sólo deltas incorrectos, no volver atrás todo el proyecto.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha, ejecución posterior a señal y sin lookahead.
- No polling/agentes para procesos largos. El usuario avisa al terminar y ChatGPT revisa una vez.
- Cada cambio de código/arquitectura actualiza este archivo.

---

# Estado vigente — 2026-09-02

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion.

Pregunta central: **¿Muevo dinero hoy o no?**

Arquitectura:
1. DÓNDE — ranking/calidad/consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER/BUILD/sizing.
4. CÓMO GESTIONAR — HOLD/ADD/WATCH/PROTECT/REDUCE/EXIT/ROTATE.

Máquina: **CANDIDATE → STARTER → BUILD → CORE/HOLD → WATCH/PROTECT → ROTATE/REDUCE → EXIT**.

No take-profit fijo ni stop rígido universal.

## Cartera real de referencia

- Vanguard Global Stock Index Fund EUR Acc — `IE00B03HD191` — 12.600 € — 196,59 participaciones — MyInvestor — traspasable.
- Vanguard Emerging Markets Stock Index Fund EUR Acc — `IE0031786696` — 1.400 € — 4,61 participaciones — MyInvestor — traspasable.
- Capital pendiente: 13.000 €.
- Horizonte: 12 meses.
- Cash hurdle: 2,5% anual salvo cambio explícito.

## Integridad causal ya cerrada

- Yahoo listados: `adjusted:false` para evitar reescritura retrospectiva por dividendos.
- Fondos: NAV REAL por ISIN.
- Invariancia REAL short-vs-long confirmada.
- STARTER MEDIUM READY 3% / STRONG 5%; BUILD MEDIUM 8%; máximo 12 posiciones; máximo 2 nuevas plazas/evaluación.
- Rotación 1:1 estricta y atómica; persistencia challenger congelada 3/10.
- Estrés sistémico conserva core READY y bloquea rotación competitiva mientras la amplitud sea sistémica.

---

# TREND_PROTECTION_V2

V2 vive en `trendProtectionPolicy.ts`; V1 queda como referencia diagnóstica.

Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Hipótesis actuales, todavía no calibradas definitivamente:
- ganador: MFE >=8% + giveback >=6 pp + deterioro corto;
- REDUCE inicial 25%; máximo un REDUCE por episodio realmente ejecutado;
- ganador puede confirmar REDUCE tras persistencia/empeoramiento desde armado;
- perdedor necesita >=5 sesiones de deterioro para REDUCE 25%;
- hard EXIT satélite aproximadamente <=-18% + DOWNTREND + >=10 sesiones + consenso/votos adversos fuertes;
- reclaim claro desarma episodio;
- PROTECT no debe vender ni convertirse indirectamente en una rotación competitiva.

Tests previos:
- `test:trend-protection`: PASS, incluida idempotencia (`repeatWinner=PROTECT`, `repeatLoser=PROTECT`).

---

# A/B económico principal — FULL_CAUSAL_REPLAY

Se comparan dos replays completos y ejecutables:

**CURRENT_POLICY vs TREND_PROTECTION_V2**, ambos con exactamente:
- mismo universo y datos REAL;
- mismo scanner/ranking;
- mismo Entry Timing;
- mismo STARTER/BUILD/sizing;
- mismo CORE_GATE_V1 / rotación 3/10;
- mismo cash inicial;
- mismas reglas de comisiones/fiscalidad;
- mismo máximo de posiciones y atomicidad.

Única diferencia: la política protectora de posición.

La paridad de entradas es diagnóstica, no requisito de validez. Después de una diferencia de gestión, cash/plazas pueden cambiar y las entradas posteriores divergir causalmente.

Implementación:
- `replayTrendProtectionV2Experiment.ts`: inyecta V2 dentro del mismo `PortfolioDecisionEngine` y mantiene estado armed/observations/reference/MFE/reductionExecuted.
- `trendProtectionReplayComparison.ts`: compara ambos caminos; `valid=true` exige trayectoria finita, cash nunca negativo y máximo de plazas respetado.
- `historicalReplayAudit.worker.ts`: ejecuta el brazo V2 sólo en el checkpoint final.
- `HistoricalAuditJsonControls.tsx`: exporta/muestra el A/B FULL_CAUSAL_REPLAY.
- `trendProtectionCounterfactual.ts`: fixed-entry antiguo queda sólo como diagnóstico histórico.

---

# Replay REAL FULL_CAUSAL 12m — 2022-07-11 → 2023-07-10

ZIP revisado: `trading-replay-2022-07-11-2023-07-10 (4).zip`.

CURRENT_POLICY:
- final **12.873,999 €**;
- retorno **-0,969238%**;
- DD máx. **3,230298%**;
- fees **46,6343 €**.

TREND_PROTECTION_V2:
- `valid=true`; cash nunca negativo; máximo **12/12 posiciones**;
- final **12.814,424 €**;
- retorno **-1,427509%**;
- DD máx. **3,202818%**;
- fees **40,3981 €**;
- turnover total **18.495,19 €**.

Delta V2 vs baseline:
- final **-59,58 €**;
- retorno **-0,45827 pp**;
- DD **-0,02748 pp** (ligeramente mejor);
- fees **-6,24 €**;
- turnover **-3.725,44 €**.

Conclusión: V2 no mejora económicamente este 12m. No ajustar thresholds con esta ventana.

Operaciones V2 directamente atribuibles observadas:
- AIGC: REDUCE 25% ~-9,0%;
- DTE: REDUCE 25% ~+6,24% tras MFE ~17,9%;
- IQQH: hard EXIT ~-20,72%.

---

# Corrección de REDUCE no materializable en ETF

El replay 2022/23 mostró muchos `REDUCE` diagnósticos frente a pocas reducciones ejecutadas. Se corrigió el caso inequívoco de ETF/ETC donde `floor(units × 25%) = 0`:
- se degrada a PROTECT;
- no se declara venta ficticia;
- fondos fraccionarios mantienen REDUCE válido.

No se cambió ningún threshold V2.

---

# Holdout COVID FULL_CAUSAL — 2020-02-03 → 2021-02-02

ZIP revisado: `trading-replay-2020-02-03-2021-02-02 (2).zip`.

## CURRENT_POLICY

- inicial 13.000 €;
- final **13.474,575 €**;
- retorno **+3,650577%**;
- DD máx. **13,533982%**;
- fees **30,1908 €**;
- tax estimado **1,8152 €**;
- exact hold **+3,189422%**.

## TREND_PROTECTION_V2

- metodología `FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE`;
- `valid=true`;
- cash nunca negativo;
- máximo observado **12/12 posiciones**;
- final **13.717,150 €**;
- retorno **+5,516541%**;
- DD máx. **13,625680%**;
- fees **24,00 €**;
- tax estimado **9,9034 €**;
- turnover total **15.024,59 €**;
- 4 REDUCE y 5 EXIT ejecutados.

Delta V2 vs baseline:
- final **+242,58 €**;
- retorno **+1,865964 pp**;
- DD **+0,09170 pp** (ligeramente peor);
- fees **-6,19 €**;
- turnover **+317,05 €**.

Lectura causal:
- en el trough del 2020-03-23 V2 no evita la caída: ~11.399,69 € frente a ~11.411,79 € baseline;
- la ventaja aparece durante la recuperación: diferencia V2-baseline ~+14 € a 2020-04-30, +90 € a 2020-06-30, +186 € a 2020-09-01 y +243 € al final;
- V2 recupera 13.000 € el **2020-08-26**, mientras baseline no lo hace hasta **2020-11-16**;
- por tanto la mejora COVID procede principalmente de conservar/reconstruir exposición durante el rebote, no de reducir el drawdown inicial.

Operaciones V2 relevantes alrededor del shock:
- 2020-03-16: REDUCE parcial de Vanguard US500 ~-19,5%;
- 2020-03-16: REDUCE parcial de Vanguard ESG Developed ~-22,5%;
- 2020-03-16: REDUCE parcial de Vanguard Global ~-23,2%;
- V2 no replica el EXIT completo de EUNL que CURRENT_POLICY ejecuta el mismo 2020-03-16.

El campo `actionCounts.REDUCE=139` NO significa 139 ventas: son observaciones/decisiones V2 etiquetadas durante el replay; sólo **4 REDUCE** se ejecutaron económicamente. Mantener separados conteos diagnósticos y operaciones reales al interpretar el JSON.

Conclusión holdout COVID: **evidencia favorable a V2 en retorno y velocidad de recuperación, pero no en DD**. No tocar thresholds: debe contrastarse en las otras ventanas independientes antes de decidir.

---

# Próxima acción

1. No recalibrar V2 con 2022/23 ni con COVID.
2. Ejecutar siguiente holdout: **2024-04-01 → 2025-03-31**, DAILY, 12 meses, 13.000 €.
3. Objetivo principal: comprobar que V2 no recorta ganadores en un entorno alcista y comparar retorno, DD, turnover, cash/exposición y ventas V2.
4. Después ejecutar **2021-11-01 → 2022-10-31** con la misma configuración.
5. Sólo después de las tres ventanas (2022/23 + COVID + 2024/25 + 2021/22 como estrés adverso adicional) decidir si V2 merece 24/36m y calibración independiente.