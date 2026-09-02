# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo primero al retomar el proyecto.

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

La concentración de capital hacia Vanguard Global/core es deliberada, no un defecto por sí misma:
- si una posición mediocre/deteriorada libera capital y el challenger no es excepcional, se prefiere un core global diversificado antes que perseguir otra apuesta táctica o acumular cash innecesario;
- prioridad: Vanguard Global → ESG Developed → EUNL/IWDA → SXR8/VUSA;
- challenger excepcional requiere persistencia STRONG fuerte y ventajas claras de consenso/score/cash;
- no modificar CORE_GATE durante el experimento actual.

La observación del usuario de que el motor suele destacar más a partir de meses 7-9 se mantiene aparcada para la futura fase `ReliabilityScore / OpportunityScore / sizing`: parte de esas grandes aportaciones tardías procede de la consolidación deliberada de rotaciones en el core.

---

# TREND_PROTECTION_V2

Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Thresholds actuales congelados y NO promocionados:
- ganador: MFE >=8% + giveback >=6 pp + deterioro corto;
- REDUCE inicial 25%, máximo uno por episodio realmente ejecutado;
- perdedor requiere persistencia causal;
- hard EXIT sólo para satélite profundo/persistente;
- reclaim desarma episodio;
- ETF con REDUCE25 <1 título entero se degrada a PROTECT;
- WATCH/PROTECT significan NO vender.

Corrección cerrada: WATCH/PROTECT bloquean también rotación/CORE_GATE; sólo REDUCE/EXIT autorizan venta V2.

Cuatro ventanas FULL_CAUSAL actuales:

| Ventana | CURRENT_POLICY | V2 | Δ retorno V2 | Δ DD V2 | Δ final € |
|---|---:|---:|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,6506% | +5,5133% | +1,8627 pp | +0,0917 pp peor | +242,15 € |
| 2021-11-01 → 2022-10-31 | +0,2208% | -0,2916% | -0,5124 pp | -0,4230 pp mejor | -66,62 € |
| 2022-07-11 → 2023-07-10 | -0,9692% | -1,4275% | -0,4583 pp | -0,0275 pp mejor | -59,58 € |
| 2024-04-01 → 2025-03-31 | +6,8119% | +5,1721% | -1,6398 pp | +0,4060 pp peor | -213,18 € |

Agregado: V2 gana 1/4; suma Δ final -97,22 €; media Δ retorno -0,187 pp. No promocionar ni recalibrar thresholds.

---

# Tercer brazo — STRATEGIC_CORE_HOLD_V1

Objetivo: conservar CORE_GATE_V1 intacto, pero probar si el core de crecimiento ya acumulado debe evitar ventas por deterioro de corto plazo.

Strategic core experimental:
- `FUND_VANGUARD_GLOBAL`
- `FUND_VANGUARD_ESG_DEVELOPED`
- `FUND_VANGUARD_US500`
- `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

No incluye regionales, emerging, bonos ni activos tácticos.

Semántica:
- V2 sigue diagnosticando el core;
- REDUCE/EXIT V2 del strategic core se degradan a WATCH;
- el core tampoco se usa como fuente de rotación táctica por esa señal corta;
- reglas de ADD/entrada, CORE_GATE y todos los thresholds siguen iguales;
- satélites/sleeves usan V2 sin cambios.

Implementación: `src/investment/decision/replayStrategicCoreHoldExperiment.ts`.
Export: `summary.trendProtectionV2Counterfactual.strategicCoreHoldExperiment`.

Backup previo: `backup/main-pre-strategic-core-hold-2026-09-02` → `7c5a77b237d576c4bc3949350229c4c138e7fc71`.

## Replay 2021-11-01 → 2022-10-31 — primer resultado

Archivo revisado: `trading-replay-2021-11-01-2022-10-31 (4).zip`.

CURRENT_POLICY:
- final 13.028,71 €;
- retorno +0,22083%;
- DD 5,93938%;
- exact initial hold +3,24161%.

TREND_PROTECTION_V2:
- final 12.962,09 €;
- retorno -0,29160%;
- DD 5,51634%;
- turnover 12.731,54 €;
- 6 REDUCE / 4 EXIT;
- final cash 5.644,54 €;
- Δ vs CURRENT: -66,62 € / -0,51243 pp; DD mejora 0,42304 pp.

STRATEGIC_CORE_HOLD_V1:
- `valid=true`; cash nunca negativo; máximo 12/12 posiciones;
- final **13.000,78 €**;
- retorno **+0,00603%**;
- DD **5,93898%**;
- turnover **12.038,05 €**;
- 2 REDUCE / 4 EXIT;
- final cash **4.945,07 €**;
- Δ vs V2: **+38,69 € / +0,29763 pp**;
- turnover vs V2: **-693,49 €**;
- Δ DD vs V2: **+0,42264 pp peor**;
- Δ vs CURRENT: **-27,92 € / -0,21480 pp**; DD prácticamente igual a CURRENT (-0,00040 pp).

Ventas de core eliminadas respecto a V2:
- 2022-05-12 ESG Developed REDUCE ~139,02 € a retorno ~-14,22%;
- 2022-06-15 Vanguard Global REDUCE ~232,45 € a ~-12,32%;
- 2022-06-17 Vanguard US500 REDUCE ~219,01 € a ~-14,40%;
- 2022-10-10 ESG Developed REDUCE ~103,01 € a ~-15,67%.

Lectura:
- impedir ventas del core recupera una parte importante de la pérdida V2: mejora +38,69 €;
- pero sacrifica casi toda la mejora de drawdown de V2: el DD vuelve prácticamente al baseline;
- confirma la hipótesis de que V2 estaba reduciendo demasiado core antes de rebotes, pero también confirma que esas reducciones sí aportaban amortiguación de caída;
- STRATEGIC_CORE_HOLD aún queda 27,92 € por debajo de CURRENT y muy por debajo de exact hold (+3,24%), por lo que no se promociona;
- este resultado favorece una solución más matizada que “core nunca se vende” si las siguientes ventanas muestran el mismo trade-off.

---

# Próxima acción

1. No cambiar código ni thresholds con este único resultado.
2. Ejecutar la misma comparación de tres brazos en **COVID 2020-02-03 → 2021-02-02** para comprobar qué pasa cuando V2 ya ganaba claramente y las ventas del core ocurrieron cerca del suelo.
3. Después ejecutar **2024-04-01 → 2025-03-31** para medir el único REDUCE tardío de Vanguard Global en mercado alcista.
4. 2022/23 puede quedar para el final: se espera efecto pequeño/nulo porque no tuvo las reducciones principales del strategic core.
5. Sólo después decidir si conviene HOLD total del core, protección parcial más suave o una regla explícita de reentrada/reconstrucción tras REDUCE.
