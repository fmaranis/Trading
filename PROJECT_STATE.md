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

# Cuatro ventanas FULL_CAUSAL cerradas con arquitectura V2 actual

| Ventana | CURRENT_POLICY | V2 actual | Δ retorno V2 | Δ DD V2 | Δ final € |
|---|---:|---:|---:|---:|---:|
| 2020-02-03 → 2021-02-02 | +3,6506% | +5,5133% | **+1,8627 pp** | +0,0917 pp peor | **+242,15 €** |
| 2021-11-01 → 2022-10-31 | +0,2208% | -0,2916% | **-0,5124 pp** | **-0,4230 pp mejor** | **-66,62 €** |
| 2022-07-11 → 2023-07-10 | -0,9692% | -1,4275% | **-0,4583 pp** | **-0,0275 pp mejor** | **-59,58 €** |
| 2024-04-01 → 2025-03-31 | +6,8119% | +5,1721% | **-1,6398 pp** | +0,4060 pp peor | **-213,18 €** |

Agregado:
- V2 gana en retorno sólo **1 de 4** ventanas;
- suma de diferencias finales: **-97,22 €** sobre cuatro pruebas de 13.000 €;
- suma de Δ retorno: **-0,7478 pp**, media **-0,1870 pp por ventana**;
- DD mejora en 2/4 y empeora en 2/4;
- V2 no muestra robustez suficiente para sustituir CURRENT_POLICY.

Conclusión: **TREND_PROTECTION_V2 no se promociona y no se reajustan sus thresholds con estas mismas ventanas**.

---

# CORE_GATE_V1 — intención estratégica preservada

La concentración posterior hacia Vanguard Global no se considera por sí misma un defecto. Fue una decisión deliberada:
- cuando una posición mediocre/deteriorada libera capital y el challenger no es excepcional, se prefiere mantener exposición de largo plazo en un core global diversificado antes que perseguir otra apuesta táctica o acumular cash innecesario;
- `CORE_GATE_V1` sigue siendo el embudo deliberado hacia ese núcleo;
- no se modifica su lógica ni sus thresholds en el siguiente experimento.

La observación del usuario sobre grandes aportaciones a partir de meses 7-9 se interpreta parcialmente por este mecanismo: varias rotaciones terminan consolidando capital en Vanguard Global. Esto puede ser comportamiento deseado y se evaluará aparte en la futura fase de selección/sizing.

---

# Diagnóstico específico — vender el core acumulado

Se aislaron las REDUCE V2 directas sobre el núcleo estratégico de crecimiento (Vanguard Global, ESG Developed, US500 y equivalentes amplios).

Evidencia observada:
- 8 REDUCE directas de core en las cuatro ventanas;
- en 6 de 8, el activo terminó recuperando más que el cash desde el precio de venta hasta el final de la ventana;
- COVID 2020-03-16: US500, ESG Developed y Vanguard Global se redujeron cerca del suelo; un mes después habían recuperado aprox. +20,6%, +18,2% y +18,7% desde el precio de venta; al final de la ventana estaban aprox. +50,0%, +53,9% y +50,5%;
- 2021/22: tras las reducciones de junio, Vanguard Global recuperó aprox. +5,5% hasta final de ventana y US500 +11,9%; ESG Developed de mayo fue el contraejemplo, terminando ~-3,6% desde la venta;
- 2024/25: el REDUCE de Vanguard Global del 2025-03-12 sólo explica una parte pequeña del déficit total; a 2025-03-31 el fondo estaba ~+0,85% sobre el precio de venta.

Diagnóstico simple hold-vs-cash sobre los importes vendidos, sin pretender sustituir el replay FULL_CAUSAL:
- COVID: conservar esas tres fracciones de core habría aportado aprox. +136 € frente a dejarlas en cash hasta final;
- 2021/22: aprox. +27 € netos en conjunto, con dos reducciones ESG parcialmente favorables al cash pero Global/US500 desfavorables;
- 2024/25: aprox. +6,5 €;
- suma diagnóstica aproximada: +169 € a favor de conservar las fracciones de core frente a cash.

Este cálculo NO es evidencia económica final porque los proceeds pueden ser reutilizados de forma causal. Sólo justifica probar la hipótesis con un tercer replay completo.

---

# Nuevo tercer brazo — STRATEGIC_CORE_HOLD_V1

Implementado como experimento, no como política productiva.

Archivo: `src/investment/decision/replayStrategicCoreHoldExperiment.ts`.

Hipótesis exacta:
- conservar `CORE_GATE_V1` intacto como destino de capital;
- conservar TREND_PROTECTION_V2 intacto para satélites y sleeves;
- no cambiar ningún threshold de MFE/giveback/streak, Entry Timing, STARTER/BUILD o challenger;
- una vez que el capital está en el **core estratégico de crecimiento**, las señales de corto plazo pueden seguir diagnosticándose, pero REDUCE/EXIT se degradan a WATCH y no se ejecutan;
- el core estratégico tampoco puede convertirse en fuente de una rotación competitiva de corto plazo;
- las reglas normales de ADD/entrada siguen vigentes.

Core estratégico experimental:
- `FUND_VANGUARD_GLOBAL`
- `FUND_VANGUARD_ESG_DEVELOPED`
- `FUND_VANGUARD_US500`
- `VWCE`
- `EUNL`
- `IWDA` (compatibilidad futura si entra en universo)
- `SXR8`
- `VUSA`

Regionales, emerging, bonos y activos tácticos NO se convierten en strategic core por este experimento.

El worker ejecuta en el checkpoint final tres brazos causales:
1. CURRENT_POLICY + CORE_GATE_V1.
2. TREND_PROTECTION_V2 actual.
3. `STRATEGIC_CORE_HOLD_V1` = mismo V2, pero sin ventas/rotaciones de corto plazo del core estratégico acumulado.

El tercer resultado se exporta en:
`summary.trendProtectionV2Counterfactual.strategicCoreHoldExperiment`
con `deltaVsCurrentPolicy` y `deltaVsTrendProtectionV2`.

Regresión añadida a `test:trend-protection-counterfactual`:
- Global/US500/EUNL reconocidos como strategic core;
- EQQQ y Vanguard Emerging no lo son;
- REDUCE de strategic core se convierte en WATCH sin venta;
- satélite conserva REDUCE;
- fixture sin strategic core debe producir economía exactamente idéntica entre V2 y STRATEGIC_CORE_HOLD_V1;
- siguen vigentes cash no negativo y máximo 12 posiciones.

Backup previo:
`backup/main-pre-strategic-core-hold-2026-09-02` → `7c5a77b237d576c4bc3949350229c4c138e7fc71`.

---

# Hipótesis observada sobre generación de alfa — aparcada para fase posterior

El usuario observa que la estrategia suele empezar a destacar frente a mantener la cohorte inicial cuando, tras varios meses, detecta una oportunidad persistente y concentra mucho capital en ella.

Lectura provisional:
- el motor ya despliega bastante capital temprano, pero muy repartido entre STARTER pequeños;
- cuando genera alfa de forma clara, con frecuencia coincide con concentraciones posteriores de alta convicción y múltiples ADD/rotaciones hacia una posición dominante;
- no es una regla universal de “mes 7-8”;
- conservar esta observación para `ReliabilityScore / OpportunityScore / sizing`, sin mezclarla con el experimento actual de gestión del core.

---

# Próxima acción

1. Sincronizar `main` y ejecutar `npm run lint`.
2. Si PASS, ejecutar `npm run test:trend-protection-counterfactual`.
3. No ejecutar aún las cuatro ventanas si falla alguno de esos gates.
4. Si ambos pasan, probar primero **2021-11-01 → 2022-10-31**, porque contiene varias REDUCE de core y es la mejor ventana para comprobar la hipótesis sin usar COVID como único caso favorable.
5. Comparar los tres brazos: CURRENT_POLICY vs V2 actual vs STRATEGIC_CORE_HOLD_V1.
6. Si STRATEGIC_CORE_HOLD mejora 2021/22 sin romper DD/cash/plazas, probar COVID y 2024/25; 2022/23 debería ser casi/necesariamente neutra porque no tuvo REDUCE directas del core estratégico.
7. No promocionar el tercer brazo ni cambiar thresholds hasta completar esa validación.
