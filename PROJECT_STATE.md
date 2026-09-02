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

Perfil MEDIUM: STARTER READY 3% / STRONG 5%; BUILD 8%; máximo 12 posiciones; máximo 2 nuevas/evaluación. Rotación 1:1 estricta y atómica; persistencia challenger 3/10. Sin deuda/cash negativo.

Cartera real de referencia:
- Vanguard Global `IE00B03HD191`: 12.600 €.
- Vanguard Emerging `IE0031786696`: 1.400 €.
- Capital pendiente: 13.000 €; horizonte 12 meses; cash hurdle 2,5% anual.

---

# Políticas / experimentos — situación actual

## Strategic growth core
Hallazgo estructural validado: el strategic growth core no debe venderse por deterioro corto ordinario ni financiar rotación táctica competitiva. Roles canónicos: `STRATEGIC_GROWTH_CORE`, `DIVERSIFIED_SLEEVE`, `TACTICAL_SATELLITE`. Core explícito: `FUND_VANGUARD_GLOBAL`, `FUND_VANGUARD_ESG_DEVELOPED`, `FUND_VANGUARD_US500`, `VWCE`, `EUNL`, `IWDA`, `SXR8`, `VUSA`.

CORE_GATE_V1 permanece intencional: capital liberado por una posición mediocre puede consolidarse en core global cuando no existe challenger excepcional.

## TREND_PROTECTION_V2
Flujo: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**. Winner: MFE >=8%, giveback >=6 pp; REDUCE 25%, uno por episodio; perdedor exige persistencia; hard EXIT sólo satélite profundo/persistente; reclaim desarma; WATCH/PROTECT no venden y bloquean rotación/CORE_GATE.

La política es causal y ejecutable, pero su valor económico es mixto. El nuevo bloque de atribución se centra ahora en entender exactamente cuándo ayuda o perjudica.

## SELECTION_QUALITY_V1
No promocionado. 2017-18 +0,5581 pp vs CORE; 2025-26 -0,0059 pp; 2015 igualdad económica. Conservar scores como diagnósticos.

## QUALITY_SIZING_V1
No promocionado. Cap persistente por quality, tiers 100/90/80/65%. 2017-18 +0,1051 pp; 2014 +0,199 pp; 2016 -1,7431 pp por exceso de cash durante recuperación. No recalibrar con ventanas usadas.

## SELECTION_SLOPE_V1
No promocionado. SlopeQuality usa regresión 20/60/120, SMA20/SMA50 y aceleración 20-60 con normalización `tanh`, ajuste limitado ±10.
- 2013: +0,4804 pp vs CORE, DD/turnover peores.
- 2012: -0,5699 pp, DD/turnover mejores.
- 2025-26: +0,1151 pp, DD/turnover ligeramente mejores.
Agregado de tres ventanas ~+0,0256 pp: neutralidad económica. Conservar como diagnóstico/tie-breaker potencial.

---

# CURRENT_VS_CORE_CAUSAL_ATTRIBUTION_V1

Implementado tras cerrar los experimentos de scores. **No es un séptimo brazo y no ejecuta replays adicionales**: reutiliza CURRENT, TREND_PROTECTION_V2 y STRATEGIC_CORE_HOLD ya calculados.

Identidad obligatoria:
`CORE−CURRENT = (V2−CURRENT) + (CORE−V2)`.

Exporta:
- primera divergencia CURRENT→V2;
- primera divergencia V2→CORE;
- primera divergencia CURRENT→CORE;
- BUY/ADD/REDUCE/EXIT por activo;
- diferencias de entradas, ventas y ganancias realizadas;
- cash/exposición media y final;
- máxima ventaja temporal de CURRENT y CORE.

Backup previo a instrumentación:
`backup/main-pre-current-core-attribution-2026-09-02` → `f99120829df6db078519c5b02d82e1abb403430e`.

## Primera atribución — 2025-04-01 → 2026-03-31

CURRENT:
- final **14.489,42 €**;
- retorno **+11,4571%**;
- DD 6,5053%;
- fees 33 €; tax 4,50 €.

TREND_PROTECTION_V2 = STRATEGIC_CORE_HOLD:
- final **14.450,08 €**;
- retorno **+11,1545%**;
- DD 6,7131%;
- fees 35 €; tax 32,70 €.

Atribución exacta:
- `V2 − CURRENT = -39,3362 € / -0,302586 pp`.
- `CORE − V2 = 0,00 € / 0,00 pp`.
- `CORE − CURRENT = -39,3362 € / -0,302586 pp`.
- residual contable = 0; `valid=true`.

**Conclusión causal:** en esta ventana el strategic-core hold no interviene. Toda la pérdida nace de TREND_PROTECTION_V2.

Primera divergencia: **03/03/2026**, V2 ejecuta REDUCE de Intesa; CURRENT no vende. Después V2 ejecuta otras tres reducciones de ganadores:
- Intesa: 110,60 €, ganancia realizada 18,68 €.
- Vanguard Eurozone: 145,32 €, ganancia 15,05 €.
- Vanguard Europe: 106,73 €, ganancia 9,13 €.
- Ferrovial: 263,60 €, ganancia 51,14 €.

Total reducido en marzo: **626,25 €**. Esas cuatro ventas añaden respecto a CURRENT:
- **+28,20 € de impuesto estimado**;
- **+2,00 € de comisión**;
- aproximadamente **9,62 € de coste de oportunidad bruto** hasta el 31/03 al comparar los títulos vendidos con su precio final si se hubieran conservado.

Esto explica prácticamente toda la brecha final de 39,34 €. Intesa aislada fue una reducción de precio favorable (vendió por encima del precio final), pero el conjunto no compensó impuestos, comisiones y recuperación posterior de Ferrovial/Europa/Eurozona.

Path exposure:
- cash medio CORE/V2 ~22,64 € superior a CURRENT;
- exposición media ~23,62 € inferior;
- cash final ~596,54 € superior;
- máxima ventaja de CURRENT ~40,23 € el 25/03/2026;
- CORE/V2 sólo llega a aventajar CURRENT ~2,55 € el 19/03/2026.

Lectura: el problema observado no es selección ni strategic-core hold; es que **V2 cristaliza parcialmente ganadores cuando el ahorro de drawdown esperado no supera el coste fiscal/operativo y el riesgo de recuperación**. No cambiar thresholds todavía con una sola ventana de atribución.

---

# UX / gráficas — pendiente posterior al motor

Cuando el motor quede cerrado:
- zoom/rango temporal y selector 1M/3M/6M/1A/Todo;
- mostrar/ocultar slope20/60/120, SMA20/SMA50 y señales;
- al pulsar una operación/posición comprada, abrir gráfica del activo centrada en ejecución, por defecto 6 meses antes + 6 meses después, con BUY/ADD/REDUCE/EXIT, precio, timing, consenso, quality y slopes;
- opción de trayectoria completa.

No implementar esta UI hasta cerrar políticas del motor.

---

# Próxima acción

No modificar aún TREND_PROTECTION_V2 con la evidencia 2025-26. Ejecutar la misma atribución en una ventana donde sabemos que la cadena mejoró CURRENT para comprobar el signo contrario y evitar sobreajuste. Preferencia: **2015-01-02 → 2015-12-31**, DAILY, 13.000 €, automático, tramo 30 días. Allí conocemos previamente CURRENT +4,1638%, V2 +4,3168% y CORE +4,5046%; la atribución debe separar cuánto mejora V2 y cuánto añade STRATEGIC_CORE_HOLD y localizar las operaciones responsables.