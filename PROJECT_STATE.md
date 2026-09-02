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

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion.

Pregunta central: **¿Muevo dinero hoy o no?**

Arquitectura:
1. DÓNDE — ranking/calidad/consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER/BUILD/sizing.
4. CÓMO GESTIONAR — HOLD/ADD/WATCH/PROTECT/REDUCE/EXIT/ROTATE.

Perfil MEDIUM: STARTER READY 3% / STRONG 5%; BUILD 8%; máximo 12 posiciones; máximo 2 nuevas/evaluación. Rotación 1:1 estricta y atómica; persistencia challenger 3/10.

Cartera real de referencia:
- Vanguard Global `IE00B03HD191`: 12.600 €.
- Vanguard Emerging `IE0031786696`: 1.400 €.
- Capital pendiente: 13.000 €; horizonte 12 meses; cash hurdle 2,5% anual.

---

# CORE_GATE_V1 — intención preservada

La concentración posterior hacia Vanguard Global/core es deliberada:
- si una posición mediocre/deteriorada libera capital y el challenger no es excepcional, se prefiere un core global diversificado antes que perseguir otra apuesta táctica o acumular cash innecesario;
- prioridad: Vanguard Global → ESG Developed → EUNL/IWDA → SXR8/VUSA;
- no modificar CORE_GATE por el hecho de que concentre capital en el core.

La observación de grandes aportaciones a partir de meses 7-9 se conserva para la futura fase `ReliabilityScore / OpportunityScore / sizing`: parte procede de consolidar rotaciones en el core y no necesariamente de una nueva señal de oportunidad extrema.

---

# TREND_PROTECTION_V2

Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Thresholds congelados y NO promocionados:
- ganador: MFE >=8% + giveback >=6 pp + deterioro corto;
- REDUCE inicial 25%, máximo uno por episodio realmente ejecutado;
- perdedor requiere persistencia causal;
- hard EXIT sólo para satélite profundo/persistente;
- reclaim desarma episodio;
- ETF con REDUCE25 <1 título entero se degrada a PROTECT;
- WATCH/PROTECT significan NO vender y bloquean también rotación/CORE_GATE.

Cuatro ventanas de diseño/diagnóstico:

| Ventana | CURRENT | V2 | CORE HOLD |
|---|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,6506% | +5,5133% | **+6,2181%** |
| 2021-11-01 → 2022-10-31 | +0,2208% | -0,2916% | **+0,0060%** |
| 2022-07-11 → 2023-07-10 | -0,9692% | -1,4275% | **-1,4275%** |
| 2024-04-01 → 2025-03-31 | +6,8119% | +5,1721% | **+5,2982%** |

CORE HOLD vs V2 en estas cuatro:
- mejora 3/4 y queda exactamente neutro en 1/4;
- suma Δ final +146,72 €;
- suma Δ retorno +1,1286 pp;
- coste agregado DD +0,4805 pp, concentrado casi totalmente en 2021/22.

V2 puro no se promociona como política global.

---

# STRATEGIC_CORE_HOLD_V1

Implementación experimental: `src/investment/decision/replayStrategicCoreHoldExperiment.ts`.
Export: `summary.trendProtectionV2Counterfactual.strategicCoreHoldExperiment`.

Strategic core:
- `FUND_VANGUARD_GLOBAL`
- `FUND_VANGUARD_ESG_DEVELOPED`
- `FUND_VANGUARD_US500`
- `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

No incluye regionales, emerging, bonos ni tácticos.

Semántica experimental:
- V2 sigue diagnosticando el core;
- REDUCE/EXIT por deterioro corto se degradan a WATCH;
- el strategic core tampoco se usa como fuente de una rotación competitiva táctica ordinaria;
- ADD/entrada, CORE_GATE y thresholds siguen iguales;
- satélites/sleeves usan V2 sin cambios.

Backup previo: `backup/main-pre-strategic-core-hold-2026-09-02` → `7c5a77b237d576c4bc3949350229c4c138e7fc71`.

## Validaciones independientes — no usadas para diseñar la regla

### 2019-01-02 → 2019-12-31
- CURRENT: +15,045%, final 14.955,86 €.
- V2: +15,225%, final 14.979,25 €.
- CORE HOLD: +15,225%, final 14.979,25 €.
- DD de V2 y CORE HOLD idéntico: 2,261%.
- CORE HOLD = V2 al último decimal: no hubo venta de strategic core que interceptar.
- V2/CORE HOLD superan CURRENT en +23,39 € / +0,180 pp.

### 2017-01-02 → 2018-12-31 — 24 meses
CURRENT:
- final 12.871,64 €;
- retorno -0,9874%;
- DD 14,8945%;
- fees 104,22 €; tax 194,75 €.

V2:
- final 12.770,34 €;
- retorno -1,7666%;
- DD 14,1286%;
- turnover 36.303,10 €;
- 10 REDUCE / 17 EXIT.

STRATEGIC_CORE_HOLD_V1:
- final **13.008,53 €**;
- retorno **+0,0657%**;
- DD **14,1745%**;
- turnover **28.774,22 €**;
- 9 REDUCE / 12 EXIT;
- cash nunca negativo; máximo 12/12 posiciones.

CORE HOLD vs V2:
- **+238,19 € / +1,8323 pp**;
- DD sólo +0,0459 pp peor;
- turnover **-7.528,88 €**;
- fees -18,78 €;
- tax -12,81 €.

CORE HOLD vs CURRENT:
- **+136,90 € / +1,0530 pp**;
- DD **0,7200 pp mejor**;
- turnover -11.386,93 €;
- fees -15,70 €;
- tax -72,47 €.

Hallazgo causal principal:
- la divergencia empieza 2017-08-08/09;
- V2 permite vender `SXR8` (S&P 500) a ~-2,73% para rotar hacia Intesa y vender `EUNL` (MSCI World) a ~+0,35% para rotar hacia Repsol;
- CORE HOLD conserva ambos strategic cores;
- Intesa termina posteriormente con REDUCE alrededor de -18,8% y EXIT alrededor de -21,3%;
- a final de 2017 CORE HOLD ya aventaja V2 ~185 €; a septiembre de 2018 ~279 €; tras la caída de Q4 2018 termina todavía +238 € por encima;
- el beneficio no procede sólo de impedir REDUCE V2: también de impedir que un core estructural sea vaciado para perseguir challengers tácticos.

Exact initial hold 2017-18 termina +6,2247%, muy por encima incluso de CORE HOLD (+0,0657%). Por tanto, proteger el core corrige una pieza importante, pero **no resuelve el problema principal de selección/composición/rotaciones**.

## Conclusión tras validación independiente

La hipótesis queda reforzada fuera de las ventanas de diseño:
- 2019: CORE HOLD es neutro frente a V2 cuando no debe intervenir;
- 2017-18: CORE HOLD mejora materialmente retorno con coste de DD casi nulo frente a V2 y además supera CURRENT con menor DD.

Esto justifica adoptar como principio arquitectónico que el **strategic growth core no debe venderse por deterioro corto ordinario ni utilizarse como fuente de rotación táctica competitiva**. Esto NO significa “nunca vender bajo ninguna circunstancia”: una futura salida del core requerirá una tesis estructural/objetivo de cartera distinta de las señales tácticas actuales.

---

# Próxima acción

1. No calibrar thresholds con las ventanas anteriores.
2. Convertir `STRATEGIC_CORE_HOLD_V1` de experimento de replay a rol explícito de cartera/semántica base, conservando una vía futura para fallo estructural distinto de la tendencia corta.
3. Ejecutar regresiones dirigidas para demostrar que satélites/sleeves no cambian y que CURRENT histórico queda auditable.
4. Después volver al bloque de mayor impacto: **selección/composición/rotaciones + ReliabilityScore / OpportunityScore / sizing**, porque incluso en 2017-18 el exact hold (+6,22%) queda muy por encima de CORE HOLD (+0,07%).
