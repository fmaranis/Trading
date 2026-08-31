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
- `c01a735311aeeb02e4a56c0d7062aa260488888e` — `Use causal split-adjusted scanner prices`.
- `3d72f54703f43283b847dc91e9061f4652283765` — `Assert market data prefix invariance`.
- `670c74f9081fa0fb0c6559040b5447a6bd763cc7` — `Fix prefix invariance regression types`.

La corrección temporal, el comparador por cohorte inicial y el límite 25%/50% del Entry Timing fueron **runtime-validados por el gate local completo ejecutado el 2026-08-31**. La ejecución alcanzó los tres marcadores finales (`AI_STUDIO_VALIDATION_RESULT`, `BROKER_BACKTEST_FEASIBILITY_RESULT`, `BROKER_AWARE_EXECUTION_SWEEP_RESULT`) dentro de la cadena `validate:aistudio:raw`, unida por `&&`. El warning posterior de `git add validation-results/...` se debe a que el workspace de AI Studio no contiene `.git`; no fue un fallo del gate.

La instrumentación de Fase 1 (`d8dd1986` + `c4d24fb` + `38b563d8`) y la corrección posterior de **invariancia de prefijo de datos** (`c01a7353` + `3d72f547` + `670c74f9`) requieren nueva validación. No usar el verde anterior como validación de estos commits.

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

## Instrumentación histórica de Entry Timing — implementada, pendiente de nueva validación runtime

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

# Base de precios causal / invariancia del prefijo

## Defecto detectado el 2026-08-31

Al comparar dos replays que empiezan exactamente en `2022-07-11` se detectó que el primer año no era idéntico cuando cambiaba únicamente la duración futura solicitada:

- replay 12 meses (`2022-07-11 → 2023-07-10`): capital comprometido a 60 sesiones ~40,68%;
- replay 36 meses, guardado parcial hasta `2023-07-06`: capital comprometido a 60 sesiones ~37,30%.

Ejemplo concreto: Deutsche Telekom en `2022-09-15` conservaba en ambos casos consenso `+4`, 4/5 votos favorables, `ENTRY_STRONG`, `PULLBACK_RECOVERY`, timing score 90 y fracción 50%, pero el target estratégico y la ejecución cambiaban:
- replay corto: target ~308,41 €, ejecución 9 acciones / ~152,29 €;
- replay largo parcial: target ~251,66 €, ejecución 7 acciones / ~118,45 €.

Los dos datasets contenían los mismos 58 activos. También aparecieron cambios de timing para un mismo activo/fecha. Por tanto la causa no era la composición del universo ni el gate 25%/50%, sino el **prefijo de precios** recibido por el motor.

## Causa localizada

`AssetUniverseScanner` solicitaba Yahoo con `adjusted:true`. La ruta reconstruía todo el OHLC histórico multiplicando por `Adj Close / Close`. Yahoo define `Adj Close` como cierre ajustado por splits y también por dividendos/distribuciones, aplicando multiplicadores a fechas anteriores. Al ampliar `endDate`, eventos corporativos posteriores pueden modificar retrospectivamente el prefijo usado por un replay corto.

Esto viola la propiedad requerida:

> **Mismo startDate + mismo prefijo temporal ⇒ mismas barras, señales, timing, targets y operaciones, independientemente del endDate futuro solicitado.**

## Corrección implementada

Desde `c01a7353`, `AssetUniverseScanner` pide para instrumentos listados:

- `adjusted:false`;
- base Yahoo `Close`, que mantiene el ajuste por splits del proveedor pero no añade el ajuste retrospectivo por dividendos de `Adj Close`;
- la misma base se usa tanto para decisiones actuales como históricas, evitando una distribución distinta live/replay.

Los fondos de inversión no cambian: siguen usando NAV REAL directo por ISIN mediante EODHD Fund.

La consecuencia metodológica es importante: para acciones/ETF listados, el motor pasa a trabajar con **rentabilidad de precio split-adjusted**, no con una serie de total return dividend-adjusted. Esto es deliberado para preservar causalidad. Si más adelante se quiere incorporar dividendo/total return, deberá hacerse como flujo/evento causal explícito, nunca reescribiendo el pasado con información posterior.

## Regresión obligatoria

`dynamicHistoricalReplay.unit.ts` incorpora desde `3d72f547`/`670c74f9` un proveedor simulado que reproduce exactamente el fallo: si se solicita una serie dividend-adjusted y se amplía el `endDate`, altera el prefijo anterior. El contrato exige:
- que `AssetUniverseScanner` solicite `adjusted:false`;
- que el prefijo OHLC de un scan corto sea exactamente idéntico al prefijo del scan largo para las mismas fechas;
- que el test siga formando parte del gate existente `test:dynamic-historical-replay` / `validate:aistudio:raw`.

**Estado:** código implementado; pendiente validación manual/runtime y repetición de los replays reales. Los resultados numéricos anteriores siguen siendo útiles como diagnóstico histórico, pero no deben usarse como benchmark exacto después de cambiar la base de precios.

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

Resultado previo a la corrección de base de precios:
- capital inicial: 1.000 €;
- motor: 1.188,96 € / +18,90%;
- DD máx.: ~5,49%;
- mantener cohorte inicial corregida: 1.191,41 € / +19,14%;
- diferencia total vs cohorte inicial: -2,45 € / -0,245 pp;
- el límite temporal está correcto: no hay señales anteriores a 2025-03-27.

Despliegue medido:
- ~39,18% tras 1 sesión;
- ~39,18% tras 5;
- ~39,67% tras 20;
- ~39,67% tras 60.

Conclusión diagnóstica: desaparecía el patrón de entrada inicial del 80–90%, pero estas cifras deben repetirse con la nueva base causal `adjusted:false` antes de considerarlas benchmark definitivo.

## 2022-07-11 → 2023-07-10 — repetido tras Fase 0 / Entry Timing vinculante

Archivo revisado: `trading-replay-2022-07-11-2023-07-10.zip`.

Resultado previo a la corrección de base de precios:
- capital inicial: 1.000 €;
- motor: ~995,00 € / -0,50%;
- DD máx.: ~3,94%;
- mantener cohorte inicial corregida: ~1.011,23 € / +1,12%;
- diferencia total: ~-16,23 € / -1,623 pp;
- todo cash: ~+2,49%.

Despliegue:
- ~14,07% tras 1 sesión;
- ~14,07% tras 5;
- ~25,35% tras 20;
- ~40,68% tras 60.

## Replay largo instrumentado — intento parcial que descubrió el defecto de prefijo

Archivo: `trading-replay-2022-07-11-2023-07-06.zip`, configurado realmente a 36 meses pero guardado tras 12 checkpoints.

Hasta `2023-07-06`, antes de la corrección de base de precios:
- motor: ~998,32 € / -0,17%;
- DD máx.: ~3,04%;
- cohorte inicial: ~1.012,68 € / +1,27%;
- diferencia: ~-14,36 € / -1,44 pp;
- 6 compras ejecutadas, todas `ENTRY_STRONG`;
- WAIT ~76,6%, READY ~18,7%, STRONG ~4,7%;
- despliegue 1/5/20/60: ~14,07 / 14,07 / 25,35 / 37,30%.

Este resultado **no debe continuarse hasta 2025** desde el dataset antiguo. Debe iniciarse una nueva sesión tras sincronizar la corrección causal.

### Conclusión sobre los replays previos

La evidencia sigue apoyando que el 25%/50% evita la entrada inicial del 80–90%, pero tras descubrir la dependencia del prefijo con `endDate` se exige reconfirmarlo con la nueva base causal antes de cerrar Fase 1. No recalibrar thresholds con los periodos diagnósticos.

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
- en horizonte largo la gestión dinámica puede aportar valor, pero la cifra exacta debe recalcularse con el comparador y la base de precios causal corregidos;
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
- [x] Detectar dependencia del prefijo de datos respecto a `endDate`.
- [x] Cambiar el scanner listado a `adjusted:false` para eliminar ajuste retrospectivo de dividendos.
- [x] Añadir regresión de invariancia short-vs-long del prefijo.
- [ ] Validar runtime la nueva base de precios y confirmar con datos reales que el prefijo short/long es idéntico.
- [ ] Separar progresivamente:
  - diferencia total vs mantener cartera inicial;
  - valor por nuevas selecciones/recomposición posterior;
  - valor por gestión de posiciones existentes (ADD/REDUCE/EXIT).

## Fase 1 — validar Entry Timing actual

1. [x] Instrumentar WAIT / ENTRY_READY / ENTRY_STRONG de forma explícita en replay/export.
2. [x] Instrumentar %/€ de capital desplegado en 1, 5, 20 y 60 sesiones.
3. [x] Hacer vinculante y runtime-validar la fracción 25%/50% sobre la orden real.
4. [~] La desaparición del 80–90% inicial se observó en dos replays, pero debe reconfirmarse después del cambio de base de precios.
5. [ ] Ejecutar primero la prueba de invariancia REAL: mismo `2022-07-11`, replay 12m y replay 36m; el tramo compartido debe ser idéntico.
6. [ ] Repetir después un replay corto y el largo `2022-07-11 → 2025-07-10` desde sesión nueva.
7. [ ] Medir con la base causal WAIT/READY/STRONG, despliegue 1/5/20/60, cash medio, turnover, acciones y retorno/DD.
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

No continuar el replay parcial antiguo de 36 meses.

Después de sincronizar el HEAD con la corrección causal:

1. Iniciar **sesión nueva** de replay `2022-07-11`, duración 12 meses, DAILY, 1.000 € y exportar al terminar.
2. Iniciar otra **sesión nueva** con el mismo `2022-07-11`, duración 36 meses, DAILY, 1.000 €. Basta inicialmente con calcular hasta superar julio de 2023 y exportar el parcial.
3. Comparar automáticamente ambos exports en el periodo compartido: barras implícitas/operaciones, señales, `timingState/setup/score`, targets, ejecuciones y `deploymentHorizons`. Deben ser idénticos hasta el final del replay corto.
4. Solo si esa invariancia queda demostrada, continuar el replay 36m hasta `2025-07-10` y retomar la evaluación de Fase 1.
5. No recalibrar Entry Timing ni avanzar a Fase 2 mientras la invariancia de prefijo no esté confirmada con datos REAL.

---

# ACTUALIZACIÓN VIGENTE — 2026-09-01 — CARTERA DINÁMICA POR PLAZAS

> Esta sección **sustituye la “Próxima acción concreta” anterior**. Se conserva el texto histórico superior para trazabilidad, pero el plan vigente es el descrito aquí.

## Invariancia causal REAL — CONFIRMADA

Tras `c01a7353` + `3d72f547` + `670c74f9` se repitieron desde cero dos sesiones con `startDate=2022-07-11`, DAILY y 1.000 €:

- replay corto 12 meses hasta `2023-07-10`;
- replay 36 meses guardado parcial hasta `2023-07-06`.

Comparación automática del tramo común:
- 255 sesiones de trayectoria patrimonial compartida: **idénticas**;
- cash, valor invertido y benchmark: **idénticos fecha a fecha**;
- 12 checkpoints compartidos: **idénticos**;
- 5 operaciones ejecutadas compartidas: **idénticas** en fecha, activo, unidades, precio, comisión, target y motivo;
- 7.366 señales anteriores a `2023-07-06`: **idénticas campo por campo**;
- `WAIT/ENTRY_READY/ENTRY_STRONG`, setup, score, 0/25/50 y targets: idénticos;
- deployment 1/5/20/60: **0 / 0 / 30,126 / 43,666%** en ambos.

Las 36 señales adicionales del replay corto están exclusivamente en la propia fecha límite `2023-07-06`: el parcial usa esa fecha como frontera del checkpoint y el corto continúa después. No es divergencia causal.

**Conclusión:** ampliar `endDate` ya no reescribe el pasado. El defecto short-vs-long queda cerrado con evidencia REAL.

Replay corto causal 2022-07-11 → 2023-07-10:
- motor ~985,15 € / **-1,485%**;
- cohorte inicial ~1.005,04 € / **+0,504%**;
- diferencia motor vs cohorte ~**-1,989 pp**;
- cash final ~42,18%;
- WAIT ~78,68%, READY ~16,92%, STRONG ~4,40%;
- sólo 5 compras ejecutadas.

## Nuevos replays de estrés — evidencia que motiva la arquitectura por plazas

### 2021-11-01 → 2022-10-31 — completo

- motor: **-3,28%**;
- mantener cohorte inicial: **+1,06%**;
- cash: **+2,49%**;
- ventaja motor vs hold: **-4,34 pp**;
- DD máximo: **10,31%**;
- cash medio ~47,3%;
- 7 BUY + 2 EXIT;
- ENTRY_READY observados ~1.189, pero **0 compras READY ejecutadas**;
- todas las compras ejecutadas fueron ENTRY_STRONG;
- despliegue 1/5/20/60: **21,6 / 39,1 / 55,6 / 55,6%**.

Hallazgo: el 25/50 por activo evita el antiguo 80–90% inmediato, pero varias medias posiciones STRONG consecutivas pueden llenar rápidamente la cartera. Además varias posiciones de noviembre de 2021 permanecen durante meses tras deteriorarse. QDVE, por ejemplo, pasó de MFE aproximado +10,8% a salida cerca de -15%, con deterioro visible meses antes del EXIT.

### 2024-04-01 → 2024-11-27 — parcial suficiente para diagnóstico

- motor: **+5,56%**;
- mantener cohorte inicial: **+3,93%**;
- cash: **+1,63%**;
- ventaja motor vs hold: **+1,63 pp**;
- DD máximo: **5,81%**;
- cash medio ~42,7%;
- 7 BUY; sin ventas en el tramo;
- ENTRY_READY observados ~1.253, pero **0 compras READY ejecutadas**;
- todas las compras ejecutadas fueron ENTRY_STRONG;
- despliegue 1/5/20/60: **30,7 / 39,1 / 49,2 / 56,7%**.

Lectura conjunta:
- el scanner/ranking encuentra candidatos útiles y el caso favorable de 2024 funciona;
- el problema ya no es simplemente “entra demasiado el primer día”;
- la debilidad principal es **cartera pegajosa**: una vez ocupada, el motor tarda demasiado en liberar capital para oportunidades nuevas;
- el porcentaje agregado desplegado converge a ~50–57% con rapidez tanto en entorno malo como favorable;
- `ENTRY_READY` existe y se instrumenta, pero en estos replays no llega a ejecución porque STRONG domina selección/ranking/capacidad;
- no forzar READY artificialmente sólo para usar la rama: primero probar cartera dinámica y competencia relativa.

## Decisión de arquitectura acordada

Nueva filosofía:

> **más starters pequeños + ganadores que construyen posición + incumbents que compiten continuamente contra challengers nuevos.**

No convertir la cartera en “estática con mejores stops”. Aprovechar la fortaleza de selección actual.

Máquina conceptual:

> **CANDIDATE → STARTER → BUILD → CORE/HOLD → WATCH → ROTATE/REDUCE → EXIT**

Un activo no necesita convertirse en “malo” para liberar parte de su plaza si un challenger es materialmente superior, pero un ganador sano no se vende por diferencias marginales de ranking.

## Primera implementación — rama `chatgpt/dynamic-slot-rotation`

Commits de código/test previos a esta actualización:
- `363439fe0a27ef492f4230ff67d2887be42d0415` — `Add slot-aware starters and challenger rotation`.
- `8e30caf882bed8c81b14d25606de5a00e9998ae6` — `Assert confirmed build stage` (incluye las regresiones añadidas después del commit intermedio de tests).

Archivo de producción modificado:
- `src/investment/decision/portfolioDecisionEngine.ts`.

No se crea un motor paralelo. `DynamicHistoricalReplayEngine` seguirá invocando el mismo `PortfolioDecisionEngine`, por lo que la nueva lógica entra automáticamente en el replay causal existente.

### Plazas

Máximo de posiciones:
- LOW: 8;
- MEDIUM: **12**;
- HIGH: 16.

Nuevas plazas máximas por evaluación:
- LOW: 1;
- MEDIUM: **2**;
- HIGH: 3.

Las posiciones existentes fuera del universo también cuentan como plazas ocupadas para impedir que el sistema ignore exposiciones reales no clasificadas.

### STARTER

El 25%/50% de Entry Timing **se conserva como techo**, pero deja de ser el sizing principal.

Caps de starter sobre patrimonio total:
- LOW: READY 2%, STRONG 3,5%;
- MEDIUM: **READY 3%, STRONG 5%**;
- HIGH: READY 4%, STRONG 7%.

Orden ejecutable = mínimo entre:
- target estratégico × fracción timing 25/50;
- cap STARTER/BUILD sobre patrimonio;
- capacidad de categoría;
- efectivo realmente desplegable;
- gate mínimo de orden/comisión.

Por tanto una señal STRONG ya no implica automáticamente construir media posición estratégica.

### BUILD

En MEDIUM una posición puede crecer hasta **8%**; LOW 6%, HIGH 12%.

BUILD sólo se activa si simultáneamente:
- la posición ya existe;
- sigue `ENTRY_STRONG`;
- `PortfolioPositionHealth` confirma independientemente `ADD`;
- la posición ya ha llenado al menos ~80% de su cap STARTER.

Una posición que simplemente sigue STRONG al día siguiente, sin `ADD` independiente, **no vuelve a recibir capital**. Una ejecución parcial sólo completa el starter pendiente.

### Challenger vs incumbent / ROTACIÓN

Máximo **1 rotación competitiva parcial por evaluación** para introducir histéresis y limitar turnover.

Challenger exigido:
- no estar ya en cartera;
- `ENTRY_STRONG`;
- consenso ≥ +3;
- ≥4/5 votos favorables.

Incumbent elegible:
- `WATCH`; o
- `HOLD` débil con consenso ≤0.

Nunca se rota por esta vía una posición `ADD` o un HOLD sano sólo porque otra esté un puesto por encima.

Ventaja mínima de ranking challenger-incumbent:
- LOW: 15 puntos;
- MEDIUM: **12 puntos**;
- HIGH: 10 puntos.

Además el challenger debe superar al incumbent frente a cash por al menos:
- 2 pp; o
- 2× el drag estimado de comisión ida/vuelta,
lo que sea mayor.

La primera rotación es **REDUCE 50%**, no EXIT completo. Libera una plaza/capital parcial para probar el challenger. El replay vende antes de comprar y aplica después sus comisiones/fiscalidad reales; el presupuesto de rotación del decision engine es sólo teórico.

### Sin fallback operativo

Se elimina la compra fallback que podía convertir pesos teóricos en aportaciones cuando `opportunities.length === 0`.

Regla nueva:

> **sin oportunidad que pase cash + consenso + timing ⇒ cero órdenes de capital nuevo.**

Los gaps teóricos permanecen sólo como diagnóstico.

## Regresiones añadidas a `currentCapitalAllocation.unit.ts`

El contrato ahora exige, además de las invariantes anteriores:
- STARTER explícito para posiciones nuevas;
- STRONG starter MEDIUM ≤5% del patrimonio;
- máximo 2 nuevas plazas por evaluación MEDIUM;
- cartera con 12 plazas ocupadas no puede abrir una 13.ª sin liberar hueco;
- WATCH débil puede REDUCE 50% sólo ante challenger STRONG claramente superior;
- proceeds de rotación quedan explícitos;
- challenger emparejado se marca `ROTATION_ENTRY`;
- máximo una rotación competitiva por evaluación;
- sin oportunidades no existe compra fallback;
- starter lleno no vuelve a recibir capital sin confirmación ADD;
- con ADD independiente + STRONG puede pasar a BUILD;
- BUILD MEDIUM ≤8% y es incremental.

## Estado de validación

**IMPLEMENTADO EN RAMA, TODAVÍA NO RUNTIME-VALIDADO.**

No usar el gate verde anterior para validar esta arquitectura. Antes de calibrar thresholds o interpretar rentabilidades debe pasar el gate local actual.

## Próxima acción vigente

1. Revisar diff final de `chatgpt/dynamic-slot-rotation` frente a `main` y hacer fast-forward sólo si no hay cambios accidentales.
2. Sincronizar el nuevo `main` en el entorno local/AI Studio.
3. Ejecutar localmente `npm run validate:aistudio` **una sola vez**, sin Scheduled Task, sin GitHub Actions y sin agente de Gemini monitorizando.
4. Si falla, corregir la causa exacta; no debilitar regresiones para obtener verde.
5. Si queda verde, repetir A/B como mínimo estas mismas ventanas ya conocidas, no buscar fechas nuevas todavía:
   - `2021-11-01`, 12 meses, DAILY;
   - `2022-07-11`, 12 meses, DAILY;
   - `2024-04-01`, 12 meses o hasta el límite disponible equivalente.
6. Comparar motor anterior vs cartera dinámica en retorno, DD, cash medio, turnover, comisiones, número de posiciones, STARTER/BUILD, REDUCE/ROTATE/EXIT y MFE cedido antes de rotar.
7. No recalibrar todavía 3%/5%/8%, 12 plazas ni margen de rotación usando esos mismos periodos; primero comprobar comportamiento y después usar holdout independiente.
