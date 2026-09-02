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

Conclusión: en este caso V2 cristaliza ganadores demasiado tarde/cerca del final y el ahorro de riesgo no compensa fricción + recuperación posterior. No cambiar thresholds con una sola ventana.

## Atribución 2015-01-02 → 2015-12-31

CURRENT:
- final **13.541,2879 €**; retorno **+4,163753%**; DD **10,206783%**; fees 36,51 €; tax 8,77 €.

V2:
- final **13.561,1879 €**; retorno **+4,316830%**; DD **8,286265%**; turnover 10.235,66 €; tax 24,42 €.

CORE HOLD:
- final **13.585,5963 €**; retorno **+4,504587%**; DD **8,286265%**; turnover 10.005,50 €; tax 24,42 €.

Atribución exacta:
- `V2 − CURRENT = +19,8999 € / +0,153076 pp`.
- `CORE − V2 = +24,4084 € / +0,187757 pp`.
- `CORE − CURRENT = +44,3084 € / +0,340834 pp`.
- residual = 0; `valid=true`.

Primera divergencia CURRENT→V2: **05/06/2015**, V2 ejecuta REDUCE 25% de ISPA (~188,30 €) cuando la posición todavía estaba +2,42% tras MFE +12,56%; CURRENT espera y termina reduciendo más tarde con retorno ~-9,06%. Esto es un ejemplo de protección temprana potencialmente útil.

Primera divergencia V2→CORE: **26/08/2015**, V2 reduce 6 EUNL (~203,52 €) con retorno ~-1,53% tras MFE +15,46%; CORE HOLD bloquea esa venta. Es la intervención strategic-core que explica el incremento principal de CORE sobre V2; después sólo aparece una pequeña diferencia causal de ADD en Iberdrola.

Otras diferencias relevantes CURRENT vs CORE:
- CORE ejecuta menos entrada en EUNL (~-884,50 € acumulados) por la trayectoria de cash/plazas;
- CURRENT rota completamente 4GLD el 17/07; V2/CORE gestionan esa exposición mediante reducciones parciales, evitando parte de la trayectoria posterior de CURRENT;
- V2 paga ~15,65 € más de impuesto que CURRENT y aun así mejora +19,90 € y reduce DD ~1,92 pp: la fricción fiscal por sí sola no invalida una reducción cuando evita deterioro suficiente.

Lectura conjunta 2015 vs 2025-26:
- no es correcto bloquear genéricamente todos los REDUCE de ganadores;
- en 2015 varias reducciones tempranas/pequeñas ayudan a contener deterioro;
- en 2025-26 cuatro reducciones de ganadores en marzo no compensan impuestos/comisiones/recuperación posterior;
- necesitamos medir el resultado posterior de cada REDUCE antes de diseñar un guard causal nuevo.

---

# V2_REDUCTION_OUTCOME_AUDIT_V1

Implementado como **auditoría ex post exclusivamente diagnóstica**. No cambia V2 ni ejecuta otro brazo.

Para cada REDUCE V2 registra:
- causa `WINNER_PROTECTION / LOSER_FAILURE / OTHER`;
- retorno de la posición, MFE y giveback en señal;
- comisión + impuesto realizado;
- retorno del activo 20 y 60 sesiones después y hasta fin de replay;
- máxima caída y máxima recuperación posteriores;
- proxy mark-to-market del beneficio/coste de vender el notional reducido frente a mantenerlo.

Regla crítica: usa precios futuros deliberadamente para auditoría histórica, por lo que **está prohibido usar cualquier salida de este audit como input del motor causal**.

Archivos:
- `src/investment/decision/v2ReductionOutcomeAudit.ts`
- `tests/v2ReductionOutcomeAudit.unit.ts`
- persistido como `trendProtectionV2Counterfactual.v2ReductionOutcomeAudit`.

Backup: `backup/main-pre-v2-reduction-outcome-audit-2026-09-02` → `389533a97f769767f438169a67d372c1b7795698`.

Estado: implementación terminada; gates locales/AI Studio pendientes.

---

# UX / gráficas — después del motor

Pendiente cuando se cierre el motor:
- zoom/rango temporal y selector 1M/3M/6M/1A/Todo;
- mostrar/ocultar slope20/60/120, SMA20/SMA50 y señales;
- al pulsar una operación, gráfica del activo centrada en ejecución, por defecto 6 meses antes + 6 meses después, con BUY/ADD/REDUCE/EXIT, precio, timing, consenso, quality y slopes;
- opción de trayectoria completa.

---

# Próxima acción

1. Validar `V2_REDUCTION_OUTCOME_AUDIT_V1` con `lint`, test dirigido y regresión counterfactual.
2. Si PASS, repetir una ventana conocida con el nuevo audit. Preferencia inicial: **2015-01-02 → 2015-12-31**, DAILY, 13.000 €, automático, tramo 30 días, para caracterizar las reducciones que sí aportaron valor.
3. Después contrastar sólo si es necesario contra 2025-04-01 → 2026-03-31.
4. No modificar todavía thresholds de V2.
