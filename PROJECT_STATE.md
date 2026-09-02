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

## CURRENT_POLICY

- inicial: 13.000 €;
- final: **12.873,999 €**;
- retorno: **-0,969238%**;
- DD máx.: **3,230298%**;
- fees: **46,6343 €**;
- tax estimado: **13,2774 €**;
- ejecuciones: 24 BUY / 17 ADD / 3 REDUCE / 12 EXIT;
- cash final ~30,93%; exposición final ~69,07%.

## TREND_PROTECTION_V2 FULL_CAUSAL

- `methodology=FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE`;
- `valid=true`;
- cash nunca negativo;
- máximo observado **12/12 posiciones**;
- final: **12.814,424 €**;
- retorno: **-1,427509%**;
- DD máx.: **3,202818%**;
- fees: **40,3981 €**;
- tax estimado: **13,6444 €**;
- turnover total: **18.495,19 €**;
- turnover de gestión: **5.232,86 €**;
- 20 BUY / 19 ADD / 2 REDUCE / 8 EXIT;
- cash final ~39,70%; exposición final ~60,30%.

Delta V2 vs baseline:
- final **-59,58 €**;
- retorno **-0,45827 pp**;
- DD **-0,02748 pp** (ligeramente mejor);
- fees **-6,24 €**;
- turnover **-3.725,44 €**.

Conclusión de esta ventana: **V2 no mejora económicamente al baseline en 12m**, aunque reduce ligeramente DD, fees y turnover. No ajustar thresholds usando esta misma ventana.

La divergencia de entradas aparece ya después de las primeras diferencias de gestión y es esperada en FULL_CAUSAL_REPLAY: 41 entradas baseline, 39 entradas V2, sólo 20 firmas exactamente coincidentes. No es fallo de validez.

Operaciones V2 directamente atribuibles a protección observadas:
- AIGC: REDUCE 25% ejecutado ~2022-12-09 con retorno de posición ~-9,0%;
- DTE: REDUCE 25% ejecutado ~2023-06-02 con retorno ~+6,24% tras MFE ~17,9%;
- IQQH: hard EXIT ~2023-03-28 con retorno ~-20,72%.

El resto de EXIT del brazo V2 observado en el ledger procede principalmente de rotación/core existente, no de hard EXIT V2.

---

# Nuevo defecto de ejecución descubierto y corregido

El A/B REAL devolvió `actionCounts.REDUCE=202` pero sólo **2 REDUCE ejecutados**. La causa es que V2 podía insistir diariamente en REDUCE25 sobre ETFs con muy pocos títulos cuando `floor(units × 25%) = 0`; el broker no podía materializar la orden, por lo que nunca se consumía la idempotencia y la señal reaparecía.

Esto es un defecto de ejecución/auditoría, no una calibración económica.

Corrección implementada en `replayTrendProtectionV2Experiment.ts`:
- si V2 decide REDUCE sobre ETF/ETC y el 25% equivale a menos de 1 título entero, la decisión operativa se degrada a **PROTECT**;
- no se declara una venta ficticia;
- no se reserva cash/plaza teórica por una reducción imposible;
- `pendingReduction` sólo se arma para REDUCE realmente materializable por número entero de títulos;
- fondos siguen permitiendo reducción fraccionaria.

Regresión añadida en `trendProtectionCounterfactual.unit.ts`:
- 3 títulos ETF + REDUCE25 → PROTECT;
- 4 títulos ETF + REDUCE25 → REDUCE;
- fondo fraccionario → REDUCE permanece válido.

No se han cambiado MFE, giveback, streak, hard EXIT ni ningún threshold V2.

---

# Próxima acción

1. Sincronizar `main` al HEAD actual.
2. Ejecutar sólo:
   - `npm run lint`
   - si PASS: `npm run test:trend-protection-counterfactual`
3. Confirmar que el test devuelve `wholeShareBlockedAction=PROTECT`, `valid=true`, cash no negativo y máximo MEDIUM <=12.
4. No repetir aún 12m sólo para mejorar su resultado: el cambio corrige una orden imposible, no calibra la estrategia.
5. Si los gates pasan, siguiente evidencia debe venir de una ventana independiente/holdout antes de tocar thresholds V2.
6. Comparar en holdout retorno, DD, turnover, cash/exposición, REDUCE/EXIT realmente ejecutables y número de PROTECT por whole-share blocking.