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
- `lint`: PASS antes del último rediseño A/B.

---

# Replay REAL 12m recibido — hallazgo metodológico crítico

ZIP revisado: `trading-replay-2022-07-11-2023-07-10 (3).zip`.

Baseline CURRENT_POLICY:
- 13.000 € iniciales;
- final 12.873,999 €;
- retorno **-0,969238%**;
- DD máx. **3,230298%**;
- fees **46,6343 €**;
- exact hold **+2,064928%**;
- 56 ejecuciones, 7.923 señales, 257 sesiones.

El antiguo A/B `FIXED_BASELINE_ENTRIES` se calculó, pero quedó **inválido**:
- `valid=false`;
- entradas baseline 41 / reproducidas 39;
- dos divergencias de cash:
  - 2023-07-03 `FUND_VANGUARD_GLOBAL` ADD: shortfall ~963,87 €;
  - 2023-07-05 `VVSM` BUY: shortfall ~53,57 €.

Causa exacta: el baseline vende Xetra-Gold el 2023-07-03 por ~1.018,44 € y usa ese capital para añadir ~1.017,09 € al Vanguard Global. V2 conserva Xetra-Gold, por lo que no puede copiar simultáneamente esa entrada sin inventar financiación.

Además el camino de entradas fijas llegó diagnósticamente a **21 posiciones activas**, mientras la arquitectura MEDIUM permite 12. Por tanto el problema no es sólo cash: copiar todas las nuevas entradas baseline mientras V2 conserva incumbents viola también las plazas.

Antes de la primera divergencia (hasta 2023-06-30), cuando las entradas todavía eran idénticas:
- baseline equity ~13.122,58 € / **+0,943%**;
- V2 fixed-entry equity ~13.218,63 € / **+1,682%**;
- ventaja provisional V2 ~**+0,739 pp / +96,05 €**;
- DD baseline 3,2303% vs V2 3,1625%.

Esto es evidencia útil de dirección, pero no se acepta como resultado final porque el método deja de ser una cartera ejecutable al divergir cash/plazas.

---

# Nuevo A/B económico principal — FULL_CAUSAL_REPLAY

Se sustituye la comparación económica principal por dos replays completos y ejecutables:

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

Consecuencia metodológica deliberada: después de una diferencia de gestión, cash/plazas pueden cambiar y las entradas posteriores pueden divergir. Esa divergencia ya **no invalida** el A/B; es una consecuencia económica real de la política. La paridad de entradas queda como diagnóstico.

Implementación añadida:
- `src/investment/decision/replayTrendProtectionV2Experiment.ts`
  - inyecta V2 dentro del mismo `PortfolioDecisionEngine` usado por el replay;
  - mantiene estado causal armed/observations/reference/MFE/reductionExecuted;
  - un REDUCE consume idempotencia sólo cuando la siguiente evaluación confirma caída real de unidades;
  - ADD o reducción no-V2 reinician el episodio/tramo correspondiente;
  - PROTECT no puede causar venta por salud ni rotación competitiva indirecta.
- `src/investment/decision/trendProtectionReplayComparison.ts`
  - compara los dos replays completos;
  - validez exige cash nunca negativo, trayectoria finita y máximo de plazas respetado;
  - entrada exacta queda sólo como diagnóstico;
  - calcula retorno, DD, fees/tax, turnover, REDUCE/EXIT, capture ratio, pérdidas de cola, ledger y restricciones.
- `historicalReplayAudit.worker.ts`
  - baseline sigue siendo el actual;
  - sólo en checkpoint final ejecuta el segundo replay V2 completo y adjunta el A/B.
- `HistoricalAuditJsonControls.tsx`
  - distingue FULL_CAUSAL_REPLAY del antiguo fixed-entry;
  - un A/B full causal puede ser válido aunque las entradas diverjan;
  - muestra plazas máximas y cash no negativo.
- `tests/trendProtectionCounterfactual.unit.ts`
  - ahora valida el replay A/B completo, no sólo el fixed-entry.

El antiguo `trendProtectionCounterfactual.ts` se conserva como diagnóstico histórico de entradas fijas, pero **ya no alimenta el A/B económico principal**.

---

# Próxima acción

1. Sincronizar `main` al HEAD actual.
2. Ejecutar únicamente:
   - `npm run lint`
   - si PASS: `npm run test:trend-protection-counterfactual`
3. El test debe devolver metodología `FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE`, `valid=true`, cash no negativo y máximo MEDIUM <=12.
4. Si falla, corregir sólo el primer fallo exacto; no lanzar replay todavía.
5. Si ambos pasan, repetir una sola sesión REAL: `2022-07-11`, 12 meses, DAILY, 13.000 €.
6. En el JSON nuevo, interpretar `valid` por restricciones del full causal replay; `entryParity.exact` será diagnóstico y puede ser false.
7. Comparar retorno, DD, turnover, fees, número/timing de REDUCE/EXIT, capture ratio, pérdidas de cola, plazas/cash y entradas divergentes.
8. No recalibrar thresholds con este mismo 12m. Después usar 24/36m y holdouts independientes.
