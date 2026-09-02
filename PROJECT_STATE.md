# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto. Repositorio canónico y línea viva: `fmaranis/Trading/main`. El detalle histórico permanece en Git.

## Reglas no negociables

- Nunca usar GitHub Actions. Validaciones en local/AI Studio.
- ChatGPT modifica GitHub; AI Studio trabaja sobre `main` para ejecutar/Preview/validar.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No polling/agentes para procesos largos. El usuario avisa al terminar y ChatGPT revisa una vez.
- No calibrar thresholds sobre ventanas usadas ya para diagnóstico.
- Mantener `PROJECT_STATE.md` como memoria canónica del proyecto.

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

Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Hipótesis actuales, NO promocionadas:
- ganador: MFE >=8% + giveback >=6 pp + deterioro corto;
- REDUCE inicial 25%, máximo uno por episodio realmente ejecutado;
- perdedor requiere persistencia causal antes de REDUCE;
- hard EXIT sólo para fallo satélite profundo/persistente;
- reclaim claro desarma episodio;
- ETF con REDUCE25 inferior a 1 título entero se degrada a PROTECT;
- **WATCH y PROTECT significan NO vender todavía**.

A/B principal: `FULL_CAUSAL_REPLAY_SAME_DECISION_ENGINE`.
- mismo universo, scanner, Entry Timing, sizing, CORE_GATE_V1, cash, fiscalidad y máximo de plazas;
- sólo cambia la política de protección;
- divergencia posterior de entradas por cash/plazas es causal y no invalida el A/B;
- `valid=true` exige cash no negativo, trayectoria finita y plazas respetadas.

Corrección semántica cerrada:
- `[TREND_PROTECTION_V2:WATCH]` y `:PROTECT` bloquean rotación competitiva/CORE_GATE;
- sólo REDUCE/EXIT autorizan venta por V2;
- el cambio mejoró materialmente 2024/25 y fue prácticamente neutro en COVID y 2021/22.

Backup previo: `backup/main-pre-v2-watch-protect-rotation-2026-09-02` → `dbe5a1ebd5e8f8cec8dedcb25cda518e0168bb6c`.

---

# Cuatro ventanas FULL_CAUSAL cerradas con arquitectura actual

| Ventana | CURRENT_POLICY | V2 actual | Δ retorno V2 | Δ DD V2 | Δ final € |
|---|---:|---:|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,6506% | +5,5133% | **+1,8627 pp** | +0,0917 pp peor | **+242,15 €** |
| 2021-11-01 → 2022-10-31 | +0,2208% | -0,2916% | **-0,5124 pp** | **-0,4230 pp mejor** | **-66,62 €** |
| 2022-07-11 → 2023-07-10 | -0,9692% | -1,4275% | **-0,4583 pp** | **-0,0275 pp mejor** | **-59,58 €** |
| 2024-04-01 → 2025-03-31 | +6,8119% | +5,1721% | **-1,6398 pp** | +0,4060 pp peor | **-213,18 €** |

Agregado de las cuatro ventanas de 12 meses:
- V2 gana en retorno sólo **1 de 4** ventanas;
- suma de diferencias finales: **-97,22 €** sobre cuatro pruebas de 13.000 €;
- suma de Δ retorno: **-0,7478 pp**, media **-0,1870 pp por ventana**;
- DD mejora en 2/4 y empeora en 2/4;
- V2 no muestra robustez suficiente para sustituir CURRENT_POLICY.

Lectura por régimen:
- COVID: V2 gana por conservar/reconstruir exposición durante el rebote; no evita mejor el trough.
- 2021/22: mejora DD pero reduce cores diversificados durante la caída y queda demasiado defensivo durante rebotes.
- 2022/23: el bloqueo WATCH/PROTECT no cambia ninguna decisión; el replay nuevo es legítimamente idéntico al anterior. V2 queda ~59,6 € peor.
- 2024/25: el bloqueo WATCH/PROTECT corrige varias rotaciones indebidas y mejora V2 de +4,723% a +5,172%, pero sigue -1,640 pp por debajo del baseline.

Conclusión: **TREND_PROTECTION_V2 no se promociona y no se reajustan sus thresholds con estas mismas ventanas**.

---

# Hipótesis observada sobre generación de alfa — aparcada para fase posterior

El usuario observa que la estrategia suele empezar a destacar frente a mantener la cohorte inicial cuando, tras varios meses, detecta una oportunidad persistente y concentra mucho capital en ella.

Lectura provisional:
- el motor ya despliega bastante capital temprano, pero muy repartido entre STARTER pequeños;
- cuando genera alfa de forma clara, con frecuencia coincide con concentraciones posteriores de alta convicción y múltiples ADD/rotaciones hacia una posición dominante;
- no es una regla universal de “mes 7-8”, pero sí una hipótesis fuerte sobre selección + sizing;
- conservar esta observación para el bloque futuro de `ReliabilityScore / OpportunityScore / sizing`, sin actuar sobre ella durante el cierre de V2.

---

# Próxima acción

1. Dar por cerrada la validación de mecanismo de TREND_PROTECTION_V2 en estas cuatro ventanas.
2. No tocar thresholds MFE/giveback/streak/hard EXIT.
3. No promocionar V2 como política global.
4. Siguiente bloque del plan: analizar la separación de gestión entre **core diversificado** y **posiciones tácticas/satélite**, porque los datos muestran que reducir cores durante shocks puede proteger DD pero perder recuperación.
5. Diseñar la siguiente hipótesis de forma arquitectónica y causal antes de escribir código; no optimizarla contra estas cuatro ventanas.
6. Después volver a validar con holdouts independientes/24-36m antes de cualquier promoción.
