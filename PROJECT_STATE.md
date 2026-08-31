# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto desde otra conversación, equipo o dispositivo. El repositorio canónico es `fmaranis/Trading/main`. Este documento es la memoria operativa del proyecto y debe actualizarse cada vez que cambie código, arquitectura, conclusiones de validación o próximos pasos.

## Reglas de trabajo no negociables

- Nunca añadir ni depender de GitHub Actions. Las validaciones se ejecutan en local/AI Studio.
- ChatGPT inspecciona, desarrolla y corrige directamente sobre GitHub cuando sea posible.
- AI Studio se usa principalmente como entorno de ejecución/Preview/validación local; no delegar cambios de arquitectura o diagnósticos amplios en Gemini salvo petición expresa.
- Gate local completo: `npm run validate:aistudio`. Un verde anterior no valida cambios posteriores.
- No usar datos sintéticos como fallback silencioso. Procedencia REAL / STATIC_REFERENCE / SYNTHETIC siempre explícita.
- Replay histórico causal: solo información disponible hasta la fecha evaluada; ejecución posterior a la señal; ningún lookahead.
- Si el usuario dice “terminó, revisa la prueba”, buscar primero el resultado sincronizado en GitHub antes de pedir adjuntos.
- A partir de 2026-08-31, cada cambio de código/arquitectura debe ir acompañado de actualización de `PROJECT_STATE.md`.
- No usar un agente de AI Studio para vigilar periódicamente procesos largos. Ejecutar el proceso local sin monitorización de Gemini; el usuario avisa cuando termina y ChatGPT revisa el resultado una sola vez.

---

# Estado actual — 2026-08-31

Últimos cambios relevantes:
- `f1bb80d029f1904085e6a49db97577296086d6f9` — `Enforce requested replay decision boundary`.
- `b13d60572f430387e3eafb5ca0585d6926e11326` — `Assert strict historical replay start boundary`.
- `48de3171d6ff22682f27bf658e0fca7e9b1f0559` — `Fix initial cohort hold comparator semantics`.
- `00835f5594ffb762d91eee1d37dbe40ecdcdfe90` — `Assert initial signal cohort comparator labels`.
- `167791c35ceaddb5948ad34aac33877f9743d75a` — `Enforce entry timing fraction in capital allocation`.
- `af6c955e91379ec4d150170c5101c21d28cb2ce2` — `Align existing-position test with staged entry semantics`.
- `d265643037c026de3b095450b9d0dbfcc2f83a9c` — `Restore stable replay source and canonical project state` tras limpiar el incidente de escrituras provisionales del conector.
- `d8dd1986c1c3e4bae5de5983d75f8fe3da91a0c3` — `Instrument historical replay entry timing`.
- `c4d24fb538eee1249f37671efa257cfcfde759f2` — `Assert replay timing audit and deployment horizons`.
- `38b563d86a3d30ac8a2405281bebe3546a24df66` — `Preserve timing audit in progressive replay exports`.

La corrección temporal, el comparador por cohorte inicial y el límite 25%/50% del Entry Timing fueron **runtime-validados por el gate local completo ejecutado el 2026-08-31**. La ejecución alcanzó los tres marcadores finales (`AI_STUDIO_VALIDATION_RESULT`, `BROKER_BACKTEST_FEASIBILITY_RESULT`, `BROKER_AWARE_EXECUTION_SWEEP_RESULT`) dentro de la cadena `validate:aistudio:raw`, unida por `&&`. El warning posterior de `git add validation-results/...` se debe a que el workspace de AI Studio no contiene `.git`; no fue un fallo del gate.

La instrumentación nueva de Fase 1 (`d8dd1986` + `c4d24fb` + `38b563d8`) **todavía requiere un nuevo gate local completo** porque se implementó después del verde anterior. No usar el verde previo como validación de estos commits.

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion. Aplicación de soporte a decisiones con datos REAL, replay causal, cartera real, radar de oportunidades, fiscalidad española y ejecución condicionada por broker/costes.

Pregunta central de producto:

> **¿Muevo dinero hoy o no?**

Formato deseado:

> **ACCIÓN → IMPORTE → ACTIVO → POR QUÉ → DETALLE TÉCNICO**

Acciones objetivo:
- INVERTIR X €
- REDUCIR / SALIR
- ROTAR
- NO MOVER DINERO
- REORDENAR CARTERA

Principio clave: tener efectivo no implica que haya que invertirlo.

---

# Cartera real de referencia

- Vanguard Global Stock Index Fund EUR Acc — `IE00B03HD191` — 12.600 € — adquisición 2026-08-11 — 196,59 participaciones — MyInvestor — traspasable.
- Vanguard Emerging Markets Stock Index Fund EUR Acc — `IE0031786696` — 1.400 € — adquisición 2026-08-12 — 4,61 participaciones — MyInvestor — traspasable.
- Capital pendiente: 13.000 €.
- Horizonte de despliegue: 12 meses.
- Cash hurdle: 2,5% anual salvo cambio explícito.

Constantes canónicas: `USER_REAL_FUND_POSITIONS`, `USER_REAL_STAGED_CAPITAL_PLAN`.

Política MyInvestor: asumir disponibilidad salvo que el usuario marque expresamente un instrumento como no disponible; no presentarlo como confirmación oficial del broker.

---

# Arquitectura de decisión objetivo

Separar claramente:

1. **DÓNDE** — calidad / ranking / consenso.
2. **CUÁNDO** — timing causal de entrada.
3. **CUÁNTO HOY** — sizing / construcción progresiva; target estratégico ≠ orden inmediata.
4. **CÓMO GESTIONAR** — HOLD / ADD / WATCH / REDUCE / EXIT.

Máquina de estados objetivo:

> **CANDIDATE → WAIT → ENTER → BUILD → HOLD → WATCH → REDUCE → EXIT**

No usar stops rígidos universales ni take-profit fijo.

---

# Entry Timing — implementación actual

Archivos principales:
- `src/investment/decision/entryTiming.ts`
- `src/investment/decision/portfolioCandidateGate.ts`
- `src/investment/decision/currentOpportunityAlerts.ts`
- `src/investment/decision/portfolioDecisionEngine.ts`
- `src/investment/decision/dynamicHistoricalReplay.ts`
- `src/components/HistoricalReplayProgressivePanel.tsx`

Estados:
- `WAIT`
- `ENTRY_READY`
- `ENTRY_STRONG`

Setups:
- `BREAKOUT_CONFIRMATION`
- `PULLBACK_RECOVERY`
- `TREND_CONTINUATION`
- `NONE`

Variables causales principales:
- SMA20 / SMA50 / SMA200
- distancia a medias
- retorno 5 sesiones
- máximo previo 20 sesiones
- drawdown desde máximo 60 sesiones
- momentum 20/60/120
- volatilidad
- tendencia estructural
- consenso y votos favorables/adversos

Reglas actuales:
- un activo bueno puede quedar en `WAIT`;
- no perseguir activos demasiado extendidos;
- `ENTRY_READY` autoriza como máximo 25% del target estratégico;
- `ENTRY_STRONG` autoriza como máximo 50%;
- el target estratégico permanece separado del target ejecutable;
- una posición ya por encima del tramo autorizado no se completa automáticamente desde el flujo de entrada; un incremento posterior debe venir de lógica ADD/confirmación;
- timing nunca autoriza 100% del target de una vez.

`ContributionRecommendation` expone:
- `targetAssetValueEur` — target estratégico estable;
- `executableTargetAssetValueEur` — target máximo autorizado por timing hoy;
- `suggestedInitialFraction` — 0,25 o 0,50;
- `timingState` — estado causal que justifica el tramo.

Contrato de `currentCapitalAllocation.unit.ts` exige que:
- la orden nunca supere el tramo temporal autorizado;
- ejecutar completamente ese tramo no vuelva a recomendarlo mientras el timing no cambie;
- una ejecución parcial deje únicamente el resto del mismo tramo;
- una posición existente por encima del tramo temporal no sea completada automáticamente por el new-money entry gate.

## Instrumentación histórica de Entry Timing — implementada, pendiente de gate runtime

Desde `d8dd1986`:
- cada `DynamicReplaySignal` conserva explícitamente `timingState`, `timingSetup`, `timingScore` y `suggestedInitialFraction`;
- las señales BUY/ADD conservan el estado que autorizó el tramo real;
- REDUCE/EXIT llevan timing de entrada a `null` porque es un concepto no aplicable a la salida;
- todos los activos que alcanzan Entry Timing generan traza no operativa si no hay movimiento, de modo que `WAIT`, `ENTRY_READY` y `ENTRY_STRONG` quedan medibles en la misma cronología, sin crear un motor paralelo;
- un `WAIT` se conserva como `AVOID/NO COMPRAR` con sus campos de timing explícitos;
- el resultado devuelve `timingStateCounts` reconciliado con las señales de timing.

El replay devuelve además `deploymentHorizons` para **1 / 5 / 20 / 60 sesiones transcurridas desde la fecha inicial**. Cada horizonte separa:
- `netCommittedEur` y `%` sobre capital inicial: flujo neto realmente comprometido por operaciones hasta esa fecha;
- `investedMarketValueEur` y `%` sobre equity: valor de mercado invertido, que puede diferir por rentabilidad.

Desde `38b563d8`, `HistoricalReplayProgressivePanel` ya no recorta `DynamicReplaySignal` al persistir: conserva el objeto completo. Por tanto el JSON/ZIP exportado mantiene también consenso, votos y campos Entry Timing. El resumen persistido incorpora `timingStateCounts` y `deploymentHorizons` sin romper el envelope v3; los ficheros v3 anteriores siguen siendo importables.

Regresión `c4d24fb` exige:
- reconciliación exacta de WAIT + READY + STRONG con señales que contienen timing;
- toda BUY/ADD financiada debe estar autorizada por READY o STRONG;
- fracciones 0 / 0,25 / 0,50 coherentes con WAIT / READY / STRONG;
- setup y score explícitos;
- horizontes canónicos 1/5/20/60 y valores no negativos;
- aislamiento causal futuro también para timing state/setup/score/fraction.

---

# Evidencia histórica revisada

## 2022-04-13 → 2023-04-12 — replay antiguo

- motor: -5,2383%
- hold inicial mostrado: -5,2581%
- ventaja mostrada: +1,78 € / +0,0198 pp
- DD máx.: -10,48%
- 5 compras; 0 REDUCE; 0 EXIT

Ejemplos:
- AIGC: MFE +7,73%, MAE -18,55%, final ~-16,29% neto.
- WCOA: MFE +7,16%, MAE -17,07%, final ~-14,36%.
- Sanofi llegó a ~-21,70% y terminó positiva: prueba de que un stop fijo puede destruir recuperaciones válidas.

## 2023-04-13 → 2024-04-12 — replay antiguo

- motor: +7,1278%
- hold inicial: +7,1208%
- ventaja: +0,62 € / +0,0069 pp
- DD máx.: -7,28%
- 4 compras; 0 REDUCE; 0 EXIT

Air Liquide y Vanguard Eurozone muestran que dejar correr ganadores es correcto; Deutsche Telekom e Iberdrola muestran que un drawdown aislado no debe obligar a vender.

## 2024-07-12 → 2025-07-11 — replay antiguo

- motor: +7,7268%
- hold inicial mostrado: +3,7679%
- ventaja mostrada: +356,30 € / +3,9588 pp
- DD máx.: -17,86%
- 5 compras; 0 REDUCE; 0 EXIT

La cartera pasó de ~+12,79% en febrero de 2025 a ~-3,21% en abril sin reducción. EQQQ/SXR8/SXRV/VUSA devolvieron gran parte de MFE de +13/+14% y aun así permanecieron en HOLD.

Parte importante de la ventaja mostrada proviene de Xetra-Gold, incorporado después de las primeras compras; por tanto la métrica antigua no equivalía a “alpha por gestionar posiciones”. Este caso debe repetirse con el comparador corregido.

## 2025-03-27 → 2026-03-26 — repetido tras Fase 0 / Entry Timing vinculante

Archivo revisado: `trading-replay-2025-03-27-2026-03-26 (2).zip`.

Resultado:
- capital inicial: 1.000 €;
- motor: 1.188,96 € / +18,90%;
- DD máx.: ~5,49%;
- mantener cohorte inicial corregida: 1.191,41 € / +19,14%;
- diferencia total vs cohorte inicial: -2,45 € / -0,245 pp;
- el límite temporal está correcto: no hay señales anteriores a 2025-03-27.

Despliegue medido manualmente sobre este export anterior a la instrumentación explícita:
- ~39,18% tras 1 sesión;
- ~39,18% tras 5;
- ~39,67% tras 20;
- ~39,67% tras 60.

Conclusión: desaparece el patrón de entrada inicial del 80–90%. El nuevo sizing mejora claramente la prudencia de entrada, pero este periodo **no demuestra mejora de rentabilidad**: el motor queda ligeramente por debajo de mantener la cohorte inicial. EXH1 salió rápidamente con deterioro fuerte (~-17,4% neto), mientras que Xetra-Gold, Enel, Eni, Ferrovial e Iberdrola fueron ganadores relevantes.

## 2022-07-11 → 2023-07-10 — repetido tras Fase 0 / Entry Timing vinculante

Archivo revisado: `trading-replay-2022-07-11-2023-07-10.zip`. Es un replay de un año; **no sustituye** al replay largo 2022-07-11 → 2025-07-10 pendiente.

Resultado:
- capital inicial: 1.000 €;
- motor: ~995,00 € / -0,50%;
- DD máx.: ~3,94%;
- mantener cohorte inicial corregida: ~1.011,23 € / +1,12%;
- diferencia total: ~-16,23 € / -1,623 pp;
- todo cash: ~+2,49%;
- límite temporal correcto desde 2022-07-11.

Despliegue manual:
- ~14,07% tras 1 sesión;
- ~14,07% tras 5;
- ~25,35% tras 20;
- ~40,68% tras 60.

Conclusión: la entrada inicial deja de ser agresiva, pero la selección/timing de incorporaciones posteriores no compensó el cash ni la cohorte inicial en este periodo. El problema observable pasa de “invertir demasiado al empezar” a estudiar **dónde y cuándo se siguen añadiendo posiciones**.

### Conclusión conjunta de los dos replays nuevos

Con dos fechas de inicio muy diferentes, el patrón del 80–90% inicial ya no aparece. Se considera **evidencia suficiente para cerrar el defecto concreto de despliegue inicial excesivo**, no para afirmar que los umbrales actuales maximizan rentabilidad.

No recalibrar todavía 25%/50% ni thresholds con estos mismos periodos: son periodos diagnósticos y no holdout de calibración.

## Replay largo antiguo — 2022-07-11 → 2025-07-10

Archivo revisado anteriormente: `trading-replay-2022-07-11-2025-07-10.zip`.

Resumen previo a las correcciones de Fase 0:
- capital inicial: 9.000 €
- motor: 13.274,61 € / +47,4957%
- hold inicial mostrado: 12.203,96 € / +35,5996%
- diferencia mostrada: +1.070,65 € / +11,8961 pp
- DD máx. motor: -8,7697%
- 8.101 señales totales
- 6.098 HOLD
- 1.937 AVOID
- 35 BUY
- 23 ADD
- 5 EXIT
- 3 REDUCE
- operaciones ejecutadas: 15 BUY, 1 ADD, 1 REDUCE, 5 EXIT

Operaciones relevantes:
- AIGC: entra 2022-07-12 y sale 2023-07-20 con ~-16,46% neto; MFE +8,04%, MAE -19,56%.
- WCOA: sale 2023-11-15 con ~-12,87%; MFE +5,83%, MAE -16,89%.
- ENI: REDUCE en 2024-12-18 y EXIT 2024-12-27, pérdida final ~-9,63%.
- TotalEnergies: EXIT 2024-12-13, ~-11,49%.
- Airbus: EXIT 2025-04-10 con beneficio todavía positivo; MFE +31,34%, neto ~+8,71%, lo que muestra devolución grande de beneficio antes de salir.
- Ganadores retenidos: 4GLD ~+65,5%, DTE ~+74,7%, SAP ~+108,6%, UniCredit ~+198,9%, Intesa ~+127%.

Lectura:
- en horizonte largo la gestión dinámica puede aportar valor, pero la cifra exacta debe recalcularse con el comparador corregido;
- el patrón de salida sigue siendo tardío en varios activos;
- el sistema conserva bien grandes ganadores, por lo que no debe introducirse take-profit fijo;
- sigue haciendo falta memoria de high-water mark y transición WATCH/REDUCE antes del deterioro severo.

### Comparador de cohorte inicial — CORREGIDO EN CÓDIGO Y VALIDADO

Desde `48de3171`:
- las compras iniciales se agrupan por **primera `signalDate`**;
- todas las ejecuciones nacidas de esa señal se incluyen aunque tengan distintas `executionDate`;
- el efectivo residual remunera entre las fechas reales de ejecución y hasta el final;
- cada activo mantiene exactamente las unidades realmente compradas en esa cohorte;
- no se incorporan selecciones posteriores.

La UI muestra:

> **Diferencia total vs mantener cohorte inicial**

Semántica: `engineFinalEur - holdCohorteInicialFinalEur`. Incluye nuevas selecciones, ADD/REDUCE/EXIT y diferencias de liquidez; **no es alpha aislada de las operaciones de compraventa**.

### Límite temporal — CORREGIDO EN CÓDIGO Y VALIDADO

Desde `f1bb80d0`:
- `decisionDate = requestedDate`;
- el `asOfDate` de los datos puede ser anterior y representa solo la frescura de la información;
- la señal nunca se desplaza hacia atrás por ese motivo;
- NEXT_OPEN ejecuta después de la señal.

Regresión `b13d6057` exige que `startDate`, señales y equity path no precedan la fecha solicitada en DAILY y MONTHLY.

---

# Gestión de posiciones — dirección acordada

Estados:
- ADD
- HOLD
- WATCH
- REDUCE
- EXIT
- DATA_MISSING

Factores a combinar:
- tendencia larga
- momentum 20/60/120
- SMA / ruptura / recuperación
- volatilidad y régimen
- consenso y votos adversos
- MFE / high-water mark desde entrada
- drawdown desde máximo de posición
- drawdown desde coste
- velocidad de deterioro
- costes/fiscalidad de rotación

Objetivo: permitir que ganadores sanos corran, pero evitar pasar de +10/+15% a -15/-20% sin atravesar WATCH/REDUCE cuando además se deteriora la evidencia.

No vender solo por overweight. No vender solo por perder contra cash. No vender por un porcentaje fijo aislado.

---

# Fiscalidad española — pendiente importante

El replay todavía descuenta `estimatedTaxEur` de forma inmediata en ventas. Pendiente modelar disponibilidad del efectivo hasta liquidación fiscal anual:
- beneficio/pérdida realizable neta por año;
- `pendingTaxLiabilityEur` vs `taxPaidEur`;
- pago en fecha de simulación del año siguiente, no en cada venta;
- respetar traspaso fiscalmente diferido.

No considerar cerrado.

---

# Replay histórico / persistencia

UI: `HistoricalReplayProgressivePanel.tsx`.
Worker: `src/workers/historicalReplayAudit.worker.ts`.
Storage: `historical_progressive_audit_v3`.

Export/import JSON completo disponible. Desde `38b563d8`, las señales persistidas/exportadas conservan el `DynamicReplaySignal` completo, incluyendo consenso/votos y diagnóstico Entry Timing. El `summary` del mismo envelope v3 incorpora `timingStateCounts` y `deploymentHorizons`. Se mantiene compatibilidad de importación con v3 antiguos.

Resultados del gate local previstos en el workspace:
- `validation-results/latest-aistudio-run.json`
- `validation-results/latest-aistudio.json`
- `validation-results/latest-broker-backtest-feasibility.json`
- `validation-results/latest-broker-aware-execution-sweep.json`

Problema de persistencia confirmado: AI Studio puede ejecutar y escribir los JSON, pero su workspace puede carecer de `.git`; `git add` falla después del gate. No confundir con fallo de tests. No usar monitorización periódica del agente para esperar procesos.

---

# Plan de implementación vigente

## Fase 0 — hacer fiable la auditoría antes de calibrar

- [x] Corregir límite temporal en motor.
- [x] Añadir regresión de límite temporal.
- [x] Corregir hold inicial por cohorte de primera señal.
- [x] Cambiar etiqueta ambigua “valor aportado por mover la cartera”.
- [x] Blindar semántica del comparador en contrato UI.
- [x] Ejecutar validación local completa — verde 2026-08-31; warning posterior sólo de persistencia Git.
- [ ] Separar progresivamente:
  - diferencia total vs mantener cartera inicial;
  - valor por nuevas selecciones/recomposición posterior;
  - valor por gestión de posiciones existentes (ADD/REDUCE/EXIT).

## Fase 1 — validar Entry Timing actual

1. [x] Repetir dos replays después de Fase 0: 2025-03-27→2026-03-26 y 2022-07-11→2023-07-10.
2. [x] Instrumentar WAIT / ENTRY_READY / ENTRY_STRONG de forma explícita en replay/export. **Pendiente validar runtime y volver a medir con export nuevo.**
3. [x] Instrumentar %/€ de capital desplegado en 1, 5, 20 y 60 sesiones. **Pendiente validar runtime y volver a medir con export nuevo.**
4. [x] Confirmar que ya no entra 80–90% simplemente por empezar en una fecha arbitraria: dos replays reales muestran ~39,2% y ~14,1% tras la primera sesión, respectivamente.
5. [x] Hacer vinculante y runtime-validar la fracción 25%/50% sobre la orden real.
6. [ ] Ejecutar `npm run validate:aistudio` después de la nueva instrumentación.
7. [ ] Repetir con export instrumentado al menos un replay corto y el replay largo 2022-07-11→2025-07-10.
8. [ ] No ajustar umbrales usando los mismos periodos diagnósticos; usar holdout para calibración.

## Fase 2 — target estratégico vs tramo ejecutable

1. [x] Hacer vinculante `suggestedInitialFraction`: target ejecutable = target estratégico × 25%/50%, y la exposición existente cuenta contra ese tramo.
2. [ ] Añadir sizing sensible a volatilidad/régimen.
3. [ ] Construcción progresiva de posición más allá de ENTRY_READY/ENTRY_STRONG.
4. [ ] ADD solo por confirmación, nunca por promediar pérdidas automáticamente.

## Fase 3 — máquina de estados de posición

1. High-water mark persistente/MFE.
2. Drawdown desde máximo.
3. WATCH real.
4. REDUCE por deterioro combinado + devolución de beneficio.
5. EXIT estructural antes de deterioros extremos cuando la evidencia lo justifique.
6. Mantener ganadores sanos sin take-profit fijo.

## Fase 4 — fiscalidad temporal realista

Separar impuesto estimado, pasivo pendiente y pago anual.

## Fase 5 — validación robusta

Comparar antes/después en múltiples ventanas y holdout:
- retorno
- drawdown
- cash medio
- turnover
- BUY/ADD/WATCH/REDUCE/EXIT
- MFE cedido antes de salida
- capital desplegado por horizonte
- valor total vs hold
- costes/fiscalidad

Objetivo: conducta más racional y robusta, no maximizar los mismos backtests usados para descubrir los problemas.

---

# Próxima acción concreta

1. Ejecutar **una sola vez** `npm run validate:aistudio` sobre el HEAD que contiene `d8dd1986`, `c4d24fb` y `38b563d8`. No usar Scheduled Task/agent polling para vigilarlo.
2. Si el gate queda verde, ejecutar un replay instrumentado corto y exportarlo. El JSON debe contener en cada señal aplicable `timingState`, `timingSetup`, `timingScore`, `suggestedInitialFraction`, y en `summary` los bloques `timingStateCounts` y `deploymentHorizons`.
3. Después repetir el replay largo **2022-07-11 → 2025-07-10** con la instrumentación nueva.
4. Con esos datos decidir si Fase 1 puede cerrarse y si el siguiente cambio debe ser sizing sensible a régimen/volatilidad o construcción progresiva/ADD. No recalibrar todavía los thresholds con los periodos diagnósticos.
