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
Toda la pérdida nace de V2. Primera divergencia 03/03/2026: REDUCE Intesa. Después V2 reduce Vanguard Eurozone, Vanguard Europe y Ferrovial. Total reducido en marzo ~626,25 €. Respecto a CURRENT esas ventas añaden ~28,20 € de impuesto, 2 € de comisión y ~9,62 € de coste de oportunidad bruto hasta 31/03. No aportaron mejora de DD en esta ventana.

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

Resultado agregado de la **proxy estática de la porción vendida**:
- 20 sesiones: **-27,99 €** (5 operaciones con horizonte completo).
- 60 sesiones: **-41,15 €** (5 operaciones).
- hasta fin del replay: **-46,36 €** (7 operaciones).

Esto NO contradice que el replay V2 completo gane +19,90 € a CURRENT: la proxy mantiene fija sólo la porción vendida y no reproduce los cambios causales posteriores de cash, plazas, rotaciones, ventas y nuevas entradas. Por tanto **no puede usarse como atribución exacta del P&L de la política** ni como criterio directo para filtrar REDUCE.

REDUCE 2015 destacados:
- **ISPA 05/06** — winner protection, +2,42% en señal tras MFE +12,56%. Proxy: -2,94 € a 20 sesiones, **+13,09 € a 60**, **+4,97 € a fin**. CURRENT termina reduciendo una posición mayor mucho más tarde con pérdida; es el caso más claro de protección temprana útil dentro de la trayectoria completa.
- **Inditex 07/07** — winner protection, +1,86% tras MFE +11,28%. Proxy: **-22,45 € a 20**, -7,78 € a 60, -21,55 € a fin: reducción prematura ex post.
- **4GLD 21/07** — winner protection, -0,60% tras MFE +11,35%. Proxy casi neutra a 20/60 (+0,40/-2,05 €) y **+8,38 € a fin**. CURRENT había hecho EXIT total el 17/07 y redirigido capital; no comparar como una simple venta aislada.
- **EUNL 26/08** — winner protection, -1,53% tras MFE +15,46%. El activo sube +3,45% a 20 y +15,24% a 60; proxy **-8,02 / -32,02 / -25,66 €**. CORE HOLD acierta al bloquear esta venta de strategic core.
- **Air Liquide 27/08** — loser failure, -9,87%. Evita caída a 20 sesiones (+5,02 € proxy), pero la recuperación a 60 vuelve la proxy -12,40 €; a fin casi neutral (-0,36 €).
- **4GLD 04/12** — winner protection tardía; poca muestra hasta cierre; proxy fin -1,50 €.
- **Ferrovial 09/12** — winner protection con +15,28% aún retenido tras MFE +24,86%; fricción 19,87 € y proxy hasta cierre -10,64 €. Horizonte demasiado corto para inferir una regla robusta.

Lectura conjunta:
1. El audit confirma heterogeneidad real entre REDUCE: algunos evitan deterioro, otros cortan recuperaciones.
2. `strategicCoreHold` ya corrige el caso EUNL, que es uno de los REDUCE claramente desfavorables ex post.
3. No existe todavía un separador causal simple y robusto entre “REDUCE bueno” y “REDUCE malo”. Señales como retorno actual, MFE/giveback u observaciones no bastan por sí solas: hay contraejemplos dentro de 2015.
4. La comparación relevante para cambiar la política debe seguir siendo el **replay completo causal**, usando el outcome audit sólo para formular hipótesis, nunca para optimizar directamente con datos futuros.

---

# UX / gráficas — después del motor

Pendiente cuando se cierre el motor:
- zoom/rango temporal y selector 1M/3M/6M/1A/Todo;
- mostrar/ocultar slope20/60/120, SMA20/SMA50 y señales;
- al pulsar una operación, gráfica del activo centrada en ejecución, por defecto 6 meses antes + 6 meses después, con BUY/ADD/REDUCE/EXIT, precio, timing, consenso, quality y slopes;
- opción de trayectoria completa.

---

# Próxima acción

No modificar todavía thresholds de V2. Repetir **2025-04-01 → 2026-03-31** con `V2_REDUCTION_OUTCOME_AUDIT_V1` ya presente, para obtener la misma tabla 20/60/ex-post de las cuatro reducciones que hicieron perder a V2. Comparar 2015 vs 2025 con métricas homogéneas y buscar una hipótesis causal ex ante que pueda probarse en un nuevo A/B completo sin calibrarla con el futuro.