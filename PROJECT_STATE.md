# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto. Repositorio canónico y línea viva: `fmaranis/Trading/main`. El detalle histórico permanece en Git.

## Reglas no negociables

- Nunca usar GitHub Actions. Validaciones en local/AI Studio.
- ChatGPT modifica GitHub; AI Studio trabaja sobre `main` para ejecutar/Preview/validar.
- Antes de cambios sustanciales, conservar backup cuando sea útil; revertir sólo deltas concretos, no volver atrás todo el proyecto.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No polling/agentes para procesos largos. El usuario avisa al terminar y ChatGPT revisa una vez.
- No calibrar thresholds sobre una ventana usada ya para diagnóstico.

---

# Estado vigente — 2026-09-02

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion.

Pregunta central: **¿Muevo dinero hoy o no?**

Arquitectura:
1. DÓNDE — ranking/calidad/consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER/BUILD/sizing.
4. CÓMO GESTIONAR — HOLD/ADD/WATCH/PROTECT/REDUCE/EXIT/ROTATE.

Máquina: **CANDIDATE → STARTER → BUILD → CORE/HOLD → WATCH/PROTECT → REDUCE/EXIT/ROTATE**.

Cartera real de referencia:
- Vanguard Global `IE00B03HD191`: 12.600 €.
- Vanguard Emerging `IE0031786696`: 1.400 €.
- Capital pendiente: 13.000 €; horizonte 12 meses; cash hurdle 2,5% anual.

Integridad cerrada:
- Yahoo listados `adjusted:false`; fondos NAV REAL por ISIN.
- STARTER MEDIUM READY 3% / STRONG 5%; BUILD 8%; máximo 12 posiciones; máximo 2 nuevas/evaluación.
- Rotación 1:1 estricta y atómica; persistencia challenger 3/10.
- Estrés sistémico conserva core READY y bloquea rotación competitiva.

---

# TREND_PROTECTION_V2

V2 vive en `trendProtectionPolicy.ts`; V1 queda como referencia diagnóstica.

Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Hipótesis actuales, todavía no promocionadas:
- ganador: MFE >=8% + giveback >=6 pp + deterioro corto;
- REDUCE inicial 25%, máximo uno por episodio realmente ejecutado;
- perdedor necesita persistencia causal antes de REDUCE;
- hard EXIT sólo para fallo satélite profundo/persistente;
- reclaim claro desarma episodio;
- ETF con REDUCE25 inferior a 1 título entero se degrada a PROTECT;
- **WATCH y PROTECT significan NO vender todavía**.

A/B principal: `FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE`.
- mismo universo, scanner, Entry Timing, sizing, CORE_GATE_V1, cash, fiscalidad y máximo de plazas;
- sólo cambia la política de protección;
- divergencia posterior de entradas por cash/plazas es causal y no invalida el A/B;
- `valid=true` exige cash no negativo, trayectoria finita y plazas respetadas.

---

# Evidencia FULL_CAUSAL 12 meses acumulada

| Ventana | Baseline | V2 | Δ retorno V2 | Δ DD V2 |
|---|---:|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,651% | +5,517% | **+1,866 pp** | +0,092 pp peor |
| 2021-11-01 → 2022-10-31 | +0,221% | -0,292% | **-0,512 pp** | **-0,423 pp mejor** |
| 2022-07-11 → 2023-07-10 | -0,969% | -1,428% | **-0,458 pp** | **-0,027 pp mejor** |
| 2024-04-01 → 2025-03-31 | +6,812% | +4,723% | **-2,089 pp** | +1,425 pp peor |

Lectura:
- V2 gana claramente sólo en COVID, principalmente por conservar/reconstruir exposición durante el rebote; no mejora el trough inicial.
- En 2021/22 reduce DD ~0,42 pp pero acaba ~66,6 € peor; reduce varios cores diversificados durante mayo-junio y queda con más cash durante rebotes.
- En 2022/23 queda ~59,6 € peor aunque DD/fees/turnover mejoran ligeramente.
- En 2024/25 queda ~271,6 € peor y DD también empeora; la divergencia comienza antes del REDUCE de marzo de 2025 por cambios de rotación/composición.
- Resultado agregado: V2 no es todavía robusto y **no debe promocionarse ni ajustarse por thresholds con estas ventanas**.

---

# Defecto arquitectónico detectado: prioridad WATCH/PROTECT vs rotación

Los replays 2024/25 y 2021/22 muestran que una posición etiquetada por V2 como WATCH podía seguir entrando en la lista de incumbents rotables del motor base. CORE_GATE_V1 se ejecuta después sobre esa rotación.

Eso contradice la semántica definida: **WATCH/PROTECT = observar/proteger, pero NO vender aún**.

Corrección implementada en `replayTrendProtectionV2Experiment.ts`:
- nueva función `isTrendProtectionV2RotationBlockedReason()` reconoce `[TREND_PROTECTION_V2:WATCH]` y `[TREND_PROTECTION_V2:PROTECT]`;
- cualquier rotación competitiva generada para esos estados se elimina antes de que CORE_GATE_V1 pueda procesarla;
- se elimina también la `ROTATION_ENTRY` pareja y se recalculan proceeds/deployable/recommended/residual cash;
- sólo `V2:REDUCE` o `V2:EXIT` autorizan una venta protectora;
- baseline no cambia porque esas etiquetas sólo existen en el brazo V2.

Regresión añadida en `tests/trendProtectionCounterfactual.unit.ts`:
- WATCH → rotationBlocked=true;
- PROTECT → rotationBlocked=true;
- HOLD/REDUCE/EXIT → false;
- ninguna venta ejecutada del replay V2 puede conservar una etiqueta WATCH/PROTECT;
- se mantienen gates de cash no negativo y máximo MEDIUM <=12.

Backup previo al cambio:
`backup/main-pre-v2-watch-protect-rotation-2026-09-02` → `dbe5a1ebd5e8f8cec8dedcb25cda518e0168bb6c`.

No se ha cambiado ningún threshold MFE/giveback/streak/hard EXIT ni ninguna regla de entrada.

---

# Próxima acción

1. Sincronizar `main` al HEAD actual.
2. Ejecutar `npm run lint`.
3. Si PASS, ejecutar `npm run test:trend-protection-counterfactual`.
4. El test debe devolver `valid=true`, cash no negativo, max positions <=12, `wholeShareBlockedAction=PROTECT`, `watchRotationBlocked=true` y `protectRotationBlocked=true`.
5. Si ambos gates pasan, repetir **sólo** la ventana contaminada por este defecto: `2024-04-01 → 2025-03-31`, DAILY, 12 meses, 13.000 €.
6. No tocar thresholds antes de ver ese replay corregido.
7. Si la pérdida de 2024/25 se reduce materialmente, repetir después 2021/22 y COVID para comprobar que el bloqueo semántico no destruye la mejora previa.