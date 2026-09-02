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

La concentración posterior hacia Vanguard Global/core es deliberada:
- si una posición mediocre/deteriorada libera capital y el challenger no es excepcional, se prefiere un core global diversificado antes que perseguir otra apuesta táctica o acumular cash innecesario;
- prioridad: Vanguard Global → ESG Developed → EUNL/IWDA → SXR8/VUSA;
- no modificar CORE_GATE durante el cierre del experimento actual.

La observación del usuario de grandes aportaciones a partir de meses 7-9 se mantiene para la futura fase `ReliabilityScore / OpportunityScore / sizing`: parte de esas aportaciones procede de consolidar rotaciones en el core y no necesariamente de una nueva señal de oportunidad extrema.

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

Cuatro ventanas FULL_CAUSAL de referencia:

| Ventana | CURRENT_POLICY | V2 | Δ retorno V2 | Δ DD V2 | Δ final € |
|---|---:|---:|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,6506% | +5,5133% | +1,8627 pp | +0,0917 pp peor | +242,15 € |
| 2021-11-01 → 2022-10-31 | +0,2208% | -0,2916% | -0,5124 pp | -0,4230 pp mejor | -66,62 € |
| 2022-07-11 → 2023-07-10 | -0,9692% | -1,4275% | -0,4583 pp | -0,0275 pp mejor | -59,58 € |
| 2024-04-01 → 2025-03-31 | +6,8119% | +5,1721% | -1,6398 pp | +0,4060 pp peor | -213,18 € |

Agregado V2 vs CURRENT: suma Δ final -97,22 €; media Δ retorno -0,187 pp. V2 no se promociona ni se recalibran thresholds con estas ventanas.

---

# STRATEGIC_CORE_HOLD_V1 — tercer brazo experimental

Implementación: `src/investment/decision/replayStrategicCoreHoldExperiment.ts`.
Export: `summary.trendProtectionV2Counterfactual.strategicCoreHoldExperiment`.

Objetivo: conservar CORE_GATE_V1 intacto, pero comprobar si el core de crecimiento ya acumulado debe evitar ventas por deterioro de corto plazo.

Strategic core experimental:
- `FUND_VANGUARD_GLOBAL`
- `FUND_VANGUARD_ESG_DEVELOPED`
- `FUND_VANGUARD_US500`
- `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

No incluye regionales, emerging, bonos ni tácticos.

Semántica:
- V2 sigue diagnosticando el core;
- REDUCE/EXIT V2 del strategic core se degradan a WATCH;
- el core no se usa como fuente de rotación táctica por esa señal corta;
- ADD/entrada, CORE_GATE y todos los thresholds siguen iguales;
- satélites/sleeves usan V2 sin cambios.

Backup previo: `backup/main-pre-strategic-core-hold-2026-09-02` → `7c5a77b237d576c4bc3949350229c4c138e7fc71`.

## Cuatro ventanas cerradas — CURRENT vs V2 vs CORE HOLD

| Ventana | CURRENT | V2 | CORE HOLD | CORE vs V2 € | CORE vs V2 retorno | CORE vs V2 DD |
|---|---:|---:|---:|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,6506% | +5,5133% | **+6,2181%** | **+91,63 €** | **+0,7048 pp** | +0,0578 pp peor |
| 2021-11-01 → 2022-10-31 | +0,2208% | -0,2916% | **+0,0060%** | **+38,69 €** | **+0,2976 pp** | +0,4226 pp peor |
| 2022-07-11 → 2023-07-10 | -0,9692% | -1,4275% | **-1,4275%** | **0,00 €** | **0,0000 pp** | 0,0000 pp |
| 2024-04-01 → 2025-03-31 | +6,8119% | +5,1721% | **+5,2982%** | **+16,40 €** | **+0,1261 pp** | 0,0000 pp |

Agregado CORE HOLD vs V2:
- mejora en retorno en 3/4 ventanas y queda exactamente neutro en 1/4;
- suma Δ final: **+146,72 €**;
- suma Δ retorno: **+1,1286 pp**, media **+0,2821 pp por ventana**;
- suma Δ DD: **+0,4805 pp**, media **+0,1201 pp peor por ventana**;
- el coste de DD se concentra casi por completo en 2021/22 (+0,4226 pp); COVID sólo +0,0578 pp y 2022/23 y 2024/25 son neutras.

Agregado CORE HOLD vs CURRENT:
- suma Δ final: **+49,50 €**;
- suma Δ retorno: **+0,3808 pp**, media **+0,0952 pp por ventana**;
- sólo supera a CURRENT claramente en COVID; queda por debajo en las otras tres.

Lectura por régimen:
- **COVID:** V2 reducía US500/ESG Developed/Global una semana antes del suelo. CORE HOLD mejora +91,63 € frente a V2 con sólo +0,0578 pp de DD; conserva el rebote.
- **2021/22:** CORE HOLD mejora +38,69 € frente a V2, pero pierde casi toda la amortiguación de DD de V2. Mercado bajista lento/persistente: aquí las reducciones sí protegían caída.
- **2022/23:** CORE HOLD es idéntico a V2 hasta el último decimal. No había venta de strategic core que interceptar; esto confirma ausencia de efectos laterales del experimento.
- **2024/25:** elimina únicamente el REDUCE de Vanguard Global del 12/03/2025 (~908 €). Mejora +16,40 € sin cambiar el DD; demuestra que esa venta tardía no protegía el riesgo máximo de la ventana.

Conclusión del mecanismo:
- la evidencia favorece **no vender el strategic core por una señal corta ordinaria** frente a V2 puro;
- sin embargo, CORE HOLD total no resuelve la inferioridad frente a CURRENT en 2021/22, 2022/23 y 2024/25;
- el gran déficit de 2024/25 ocurre antes del REDUCE tardío del core y pertenece principalmente a selección/composición/rotaciones, no a esta protección;
- no promocionar todavía CORE HOLD a producción: estas cuatro ventanas ya han servido para diseñar/diagnosticar el mecanismo.

---

# Próxima acción

1. Congelar código y thresholds de CURRENT, V2 y STRATEGIC_CORE_HOLD_V1.
2. Validar STRATEGIC_CORE_HOLD_V1 en **ventanas independientes no usadas para diseñarlo**, preferiblemente incluyendo un periodo lateral/alcista normal y una validación 24-36m.
3. Si confirma la ventaja, decidir si el strategic core adopta HOLD estructural o una defensa más matizada sólo ante deterioro prolongado/sistémico; no calibrar esta decisión sobre las cuatro ventanas anteriores.
4. Después volver al problema de mayor impacto: selección/composición/rotaciones y la hipótesis `ReliabilityScore / OpportunityScore / sizing`, especialmente porque 2024/25 sigue ~1,51 pp por debajo de CURRENT incluso tras conservar Vanguard Global.
