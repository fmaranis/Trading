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

---

# Estado actual — 2026-08-31

Últimos cambios implementados:
- `f1bb80d029f1904085e6a49db97577296086d6f9` — `Enforce requested replay decision boundary`.
- `b13d60572f430387e3eafb5ca0585d6926e11326` — `Assert strict historical replay start boundary`.
- `48de3171d6ff22682f27bf658e0fca7e9b1f0559` — `Fix initial cohort hold comparator semantics`.
- `00835f5594ffb762d91eee1d37dbe40ecdcdfe90` — `Assert initial signal cohort comparator labels`.
- `167791c35ceaddb5948ad34aac33877f9743d75a` — `Enforce entry timing fraction in capital allocation`.
- `af6c955e91379ec4d150170c5101c21d28cb2ce2` — `Align existing-position test with staged entry semantics`.

La corrección temporal, el comparador por cohorte inicial y el límite 25%/50% del Entry Timing están implementados y **runtime-validados por el gate local completo ejecutado el 2026-08-31**. La ejecución alcanzó los tres marcadores finales (`AI_STUDIO_VALIDATION_RESULT`, `BROKER_BACKTEST_FEASIBILITY_RESULT`, `BROKER_AWARE_EXECUTION_SWEEP_RESULT`) dentro de la cadena `validate:aistudio:raw`, que está unida por `&&`; por tanto los tests anteriores también finalizaron correctamente. El único error posterior fue `VALIDATION_RESULTS_GIT_WARNING` al ejecutar `git add` porque el workspace de AI Studio no contiene un repositorio `.git`. Es un problema de persistencia/sincronización del entorno, no un fallo del gate. No se ha usado GitHub Actions.

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

Commits relevantes:
- `1952fb07...` — Add causal entry timing gate
- `7ea0e87c...` — Gate current opportunities by entry timing
- `53805ade...` — Export entry timing engine
- `6b3b7223...` — Assert causal entry timing on alerts
- `5a577907...` — Apply entry timing before new-money allocation
- `9061b077...` — Assert timing gate before portfolio allocation
- `167791c3...` — Enforce entry timing fraction in capital allocation
- `af6c955e...` — Align existing-position test with staged entry semantics

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

`ContributionRecommendation` expone ahora:
- `targetAssetValueEur` — target estratégico estable;
- `executableTargetAssetValueEur` — target máximo autorizado por timing hoy;
- `suggestedInitialFraction` — 0,25 o 0,50;
- `timingState` — estado causal que justifica el tramo.

Contrato de `currentCapitalAllocation.unit.ts` exige que:
- la orden nunca supere el tramo temporal autorizado;
- ejecutar completamente ese tramo no vuelva a recomendarlo mientras el timing no cambie;
- una ejecución parcial deje únicamente el resto del mismo tramo;
- una posición existente por encima del tramo temporal no sea completada automáticamente por el new-money entry gate.

Estas invariantes han pasado el gate local completo del 2026-08-31. **Pendiente ahora:** medir su comportamiento real en replays históricos y no modificar umbrales hasta disponer de esa evidencia.

---

# Evidencia histórica revisada

## 2022-04-13 → 2023-04-12

- motor: -5,2383%
- hold inicial mostrado: -5,2581%
- ventaja mostrada: +1,78 € / +0,0198 pp
- DD máx.: -10,48%
- 5 compras; 0 REDUCE; 0 EXIT

Ejemplos:
- AIGC: MFE +7,73%, MAE -18,55%, final ~-16,29% neto.
- WCOA: MFE +7,16%, MAE -17,07%, final ~-14,36%.
- Sanofi llegó a ~-21,70% y terminó positiva: prueba de que un stop fijo puede destruir recuperaciones válidas.

## 2023-04-13 → 2024-04-12

- motor: +7,1278%
- hold inicial: +7,1208%
- ventaja: +0,62 € / +0,0069 pp
- DD máx.: -7,28%
- 4 compras; 0 REDUCE; 0 EXIT

Air Liquide y Vanguard Eurozone muestran que dejar correr ganadores es correcto; Deutsche Telekom e Iberdrola muestran que un drawdown aislado no debe obligar a vender.

## 2024-07-12 → 2025-07-11

- motor: +7,7268%
- hold inicial mostrado: +3,7679%
- ventaja mostrada: +356,30 € / +3,9588 pp
- DD máx.: -17,86%
- 5 compras; 0 REDUCE; 0 EXIT

La cartera pasó de ~+12,79% en febrero de 2025 a ~-3,21% en abril sin reducción. EQQQ/SXR8/SXRV/VUSA devolvieron gran parte de MFE de +13/+14% y aun así permanecieron en HOLD.

Parte importante de la ventaja mostrada proviene de Xetra-Gold, incorporado después de las primeras compras; por tanto la métrica antigua no equivalía a “alpha por gestionar posiciones”. Este caso debe repetirse con el comparador corregido.

## 2025-03-27 → 2026-03-26

Se detectó anomalía temporal: el replay contenía señales/operaciones anteriores a la fecha inicial solicitada. La causa ya se ha corregido en `f1bb80d0`; este caso debe repetirse antes de usarlo para calibrar.

Diagnóstico previo útil: Deutsche Börse llegó aprox. a MFE +8,23% y salió cerca de -23%, mostrando que EXIT existe pero puede llegar demasiado tarde.

## Replay largo — 2022-07-11 → 2025-07-10

Archivo revisado: `trading-replay-2022-07-11-2025-07-10.zip`.

Resumen del replay antiguo, previo a las correcciones de Fase 0:
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

El helper `buildExactInitialHold(...)` antiguo definía “cartera inicial” como solo las compras positivas ejecutadas en la primera fecha de ejecución. Eso excluía operaciones nacidas de la misma decisión inicial cuando su ejecución se retrasaba uno o varios días.

Desde `48de3171`:
- las compras iniciales se agrupan por **primera `signalDate`**;
- todas las ejecuciones nacidas de esa señal se incluyen aunque tengan distintas `executionDate`;
- el efectivo residual remunera entre las fechas reales de ejecución y hasta el final;
- cada activo mantiene exactamente las unidades realmente compradas en esa cohorte;
- no se incorporan selecciones posteriores.

La UI ya no muestra “Valor aportado por mover la cartera”. Ahora muestra:

> **Diferencia total vs mantener cohorte inicial**

Semántica: `engineFinalEur - holdCohorteInicialFinalEur`. Si es positiva, el motor completo terminó con más patrimonio que mantener congelada la cohorte inicial. Incluye nuevas selecciones, ADD/REDUCE/EXIT y diferencias de liquidez; **no es alpha aislada de las operaciones de compraventa**.

Contrato UI reforzado en `00835f55` para impedir volver a la semántica antigua. Gate local completo verde el 2026-08-31.

### Límite temporal — CORREGIDO EN CÓDIGO Y VALIDADO

La causa estaba en `DynamicHistoricalReplayEngine.run`: `requestedDate` respetaba `startDate`, pero luego `decisionDate` se sustituía por `firstDecision.asOfDate`, que podía ser anterior.

Desde `f1bb80d0`:
- `decisionDate = requestedDate`;
- el `asOfDate` de los datos puede ser anterior y sigue representando solo la frescura de la información;
- la señal nunca debe desplazarse hacia atrás por ese motivo;
- NEXT_OPEN continúa ejecutando después de la señal.

Regresión en `b13d6057` exige:
- `result.startDate >= requested startDate`;
- todas las `signalDate >= startDate`;
- toda la `equityPath >= startDate`;
- DAILY y MONTHLY respetan el mismo límite.

Gate local completo verde el 2026-08-31.

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

El replay todavía descuenta `estimatedTaxEur` de forma inmediata en ventas. El usuario quiere modelar disponibilidad del efectivo hasta la liquidación fiscal anual.

Pendiente:
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

Export/import JSON completo disponible.

Resultados del gate local previstos en el workspace:
- `validation-results/latest-aistudio-run.json`
- `validation-results/latest-aistudio.json`
- `validation-results/latest-broker-backtest-feasibility.json`
- `validation-results/latest-broker-aware-execution-sweep.json`

Flujo objetivo:

> App/AI Studio ejecuta → registra resultado → sincroniza a GitHub → ChatGPT lee directamente GitHub.

Problema confirmado el 2026-08-31: el workspace de AI Studio puede ejecutar y escribir los JSON, pero no contiene `.git`; por ello `runRecordedValidation.ts` termina con `VALIDATION_RESULTS_GIT_WARNING Command failed: git add ...`. Los resultados runtime no se sincronizaron automáticamente a GitHub. No confundir este warning con un fallo del gate. Hasta resolver la persistencia, el usuario puede pegar la salida final y ChatGPT la audita sin pedir que AI Studio la interprete.

---

# Plan de implementación vigente

## Fase 0 — hacer fiable la auditoría antes de calibrar

Estado:
- [x] Corregir límite temporal en motor.
- [x] Añadir regresión de límite temporal.
- [x] Corregir hold inicial por cohorte de primera señal.
- [x] Cambiar etiqueta ambigua “valor aportado por mover la cartera”.
- [x] Blindar semántica del comparador en contrato UI.
- [x] Ejecutar validación local completa de todos estos cambios — verde el 2026-08-31; warning posterior únicamente de persistencia Git.
- [ ] Separar progresivamente:
  - diferencia total vs mantener cartera inicial;
  - valor por nuevas selecciones/recomposición posterior;
  - valor por gestión de posiciones existentes (ADD/REDUCE/EXIT).

## Fase 1 — validar Entry Timing actual

1. [ ] Repetir replays después de Fase 0.
2. [ ] Medir WAIT / ENTRY_READY / ENTRY_STRONG.
3. [ ] Medir % de capital desplegado en 1, 5, 20 y 60 sesiones.
4. [ ] Confirmar que ya no entra 80–90% simplemente por empezar en una fecha arbitraria.
5. [x] Hacer vinculante y runtime-validar la fracción 25%/50% sobre la orden real. Falta medir su efecto en replay real.
6. [ ] No ajustar umbrales usando los mismos periodos que originaron el diagnóstico; usar holdout.

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

Fase 0 cerrada. Repetir ahora un replay corto y uno largo con el Entry Timing ya vinculante y comparar contra los resultados anteriores. Medir especialmente:
1. WAIT / ENTRY_READY / ENTRY_STRONG;
2. capital realmente desplegado tras 1/5/20/60 sesiones;
3. si desaparece el patrón de entrada inicial del 80–90%;
4. retorno, drawdown, cash medio y turnover;
5. BUY/ADD/REDUCE/EXIT y cualquier cambio en la cohorte inicial.

No reajustar todavía los umbrales del Entry Timing. Primero obtener esta evidencia y después decidir si procede sizing sensible a volatilidad/régimen o avanzar a construcción progresiva/ADD.
