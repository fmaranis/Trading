# H2 — inventario directo de evidencia prospectiva disponible

Fecha de comprobación: 2026-11-07. Repo canónico `fmaranis/Trading`. Se inspeccionaron `main` y la rama durable `replay-results` mediante GitHub, sin ejecutar código ni abrir datos de rentabilidad futura H2.

## Fuentes realmente encontradas

1. **`replay-results:validation-runs/phase6-forward-risk-context-stage-a-r2-state.json`**. Blob `3446da76a37a9d85626dc3795fb6a21091b43dd2`, 517 bytes. `sampleState=OPENED_COLLECTING`, apertura `2026-09-20T19:22:33.001Z`, `lastInformationDate=null`, `observationCount=0`, `observations=[]`. No hay dato H2 aquí. **No** ejecutar evaluator F6 para obtener outcomes.

2. **`replay-results:validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`**. Blob `4006754a0d627f0846ef6d21a340f7c2ea9c633f`, 83.488 bytes. Un checkpoint: `calendarMonth=2026-09`, `marketAsOfDate=2026-09-08`, `checkpointRunDate=2026-09-09`, `observations.length=1`, `outcomes.length=0`. Es un fixture research `capitalEur=13000`, `noUserPortfolioData=true`, con `gate`, `scanner`, `decision` y brazos `legacy/quality`. **No** es un snapshot de cartera real ni de parejas H2 `capitalMobilityShadow`; no debe reutilizarse para decidir H2, tocar F7 ni anticipar sus outcomes.

3. **`replay-results:validation-runs/latest-chatgpt-full.json`**. Blob `5cdb13dbf4bf83fc4b92a6045f361ae5474c4050`, 2.570.444 bytes. Contiene la muestra 2019–2022 **CONSUMED** que motivó H1/H2; no contiene la traza prospectiva nueva necesaria para inferir alcance causal neto. No volver a tratar sus 98 comparaciones históricas como fresh.

4. **`replay-results:validation-runs/diagnostics/`**. Tres artefactos listados: `decision-audit-pilot-2019-2022-v1.json`, `decision-audit-trace-2019-2022-v1.json` e `investment-pivot-reach-audit-2019-2022-v1.json`. Son diagnósticos ya consumidos del mismo período.

5. Listado raíz `replay-results:validation-runs/`: no aparece un estado/checkpoint específico H2, ni evidencia con un par `(informationDate, incumbent, challenger)` registrado prospectivamente. Esta es una constatación de **archivos disponibles en esa ubicación**, no prueba de inexistencia absoluta de datos en todos los posibles servicios locales.

## Veredicto práctico

`H2_FRESH_PAIR_EVIDENCE_NOT_PRESENT_IN_DURABLE_BRANCH`.

El guard 951a y TypeScript del cierre rápido H2 ya están PASSED, pero validan **no intervención y paridad del código**, no eficacia económica. Los dos checkpoints prospectivos existentes pertenecen a F6/F7 y no deben contaminar H2. La rama `replay-results` no contiene un dataset H2 fresco para verificar reach, fiscalidad, comparabilidad ni riqueza relativa neta.

**No procede** iniciar A/B, retocar umbrales, realizar replay largo, usar los resultados de F6/F7 o abrir un nuevo job de investigación sin definir primero un mecanismo de observación H2 aceptable y una política precongelada.

## Acción de continuidad

No exigir al usuario repetir `Producto · cierre rápido`. La siguiente tarea técnica, cuando se continúe el desarrollo, es inspeccionar el *punto de captura prospectiva read-only* dentro de la cadena actual y comprobar si puede registrar únicamente fecha, identidad de activos, estado real de la cartera, `gateStatus`, `capitalMobilityShadow`, incertidumbres de datos y hash sin introducir motor, pantalla ni decisión paralelos. Cualquier futura captura debe ser opt-in, privada, con procedencia REAL y sin historial reconstruido a posteriori. Si ese punto no existe, documentar bloqueo y diseñar un cambio mínimo sujeto a guards y autorización de persistencia privada; no inferir consentimiento para subir posiciones personales al repositorio público/compartido.

No se ha ejecutado ningún colector ni abierto outcomes. Producción `LEGACY` intacta.

## 6. Revisión del punto de captura actual y matiz fiscal

- `src/components/MarketUtilityDashboard.tsx` llama a `evaluatePortfolioDecision({ portfolio, scan, decision, positionHealth, cashBenchmarkAnnualPct })` **sin activar `researchReachTrace`**. Por tanto las decisiones productivas actuales no generan, por defecto, `capitalMobilityShadow`. El replay histórico soporta el flag opt-in `researchDecisionReachTrace`, pero no consta una captura live H2 durable instalada.
- Existe `src/investment/decision/spanishTaxModel.ts` con **`TaxLotLedgerService`**, que registra compras y ventas por ticker y estima base FIFO con `fifoCostBasis(ticker,totalCurrentShares,sharesToSell)`. Devuelve `UNKNOWN` si los lotes no cubren la posición. La contabilidad **sí existe en la aplicación**: la limitación H2 no es ausencia total de lotes fiscales, sino que `PortfolioDecisionEngine.researchReachTrace.capitalMobilityShadow` **no los recibe ni acredita su cobertura** y marca siempre `NOT_ESTIMABLE_FROM_PORTFOLIO_STATE`. El estado `UserPortfolioState` tampoco incorpora esa información por sí mismo.
- El libro FIFO es dato privado guardado en el estado del navegador; no debe volcarse a GitHub ni deducirse que todas las compras históricas están registradas. Tampoco basta para estimar spread/FX o impuestos de fondos sin comprobar sus reglas.
- **Conclusión técnica precisa**: no crear un segundo ledger ni una nueva contabilidad fiscal; cuando proceda habilitar un diagnóstico prospectivo, reutilizar la contabilidad existente bajo una opción research explícita, comprobando cobertura completa antes de exponer un estado `FISCAL_DATA_AVAILABLE`. El evento no debe emitir ninguna acción.

## 7. Captura local opt-in integrada (cambio técnico posterior a este inventario)

- `PortfolioDecisionEngine.buildH2CapitalMobilityReadout` construye un informe **desde el `researchReachTrace` de la misma decisión**. No llama a un segundo motor, no crea órdenes, no lee outcomes, mantiene `netEconomicVerdict=N_D` y marca `productionAuthority=false`.
- `MarketUtilityDashboard` incorpora dentro del desplegable **Controles y detalle de ejecución** un control «Activar diagnóstico H2 (solo local)», apagado por defecto. El mismo `evaluatePortfolioDecision` recibe `researchReachTrace: true` solo durante el opt-in. Muestra resumen de alcance y permite descargar el JSON **únicamente tras pulsar el botón** mediante `downloadJsonFile`. No escribe en GitHub ni persiste observaciones automáticamente; el usuario decide si conserva el archivo, que puede contener identificadores/valores de posiciones.
- El dashboard consulta el ledger **existente** `TaxLotLedgerService.fifoCostBasis` para evaluar, por posición bursátil, cobertura FIFO completa; transmite solo `FIFO_TRACKED/UNKNOWN`, **nunca lotes ni costes de adquisición**. Los fondos o identidades sin cobertura explícita quedan `UNKNOWN`. Aun con FIFO completo, spreads/FX y tributación final no están demostrados; la rentabilidad neta permanece N/D.
- Se añadieron guards 951b/951c/951d al test **existente** `tests/currentCapitalAllocation.unit.ts`: paridad y opt-in, desconocimiento económico incluso con FIFO y ausencia de lectura sin flag. No se han ejecutado los guards ni `tsc --noEmit` tras estas modificaciones desde este chat; el cierre rápido H2 anterior corresponde al commit anterior y no valida este nuevo HEAD. **No declarar PASS** hasta ejecución local de `Producto · cierre rápido`.
- Esta es una **captura manual local**, no un collector persistente prospectivo, y por tanto no aporta por sí misma una muestra fresh completa ni prueba de rentabilidad. Para pruebas económicas sigue faltando protocolo/holdout precongelado; no se habilita política de rotación.

## 2026-11-08 — auditoría de las seis oportunidades sin alterar el asignador

Tras el snapshot del 2026-11-06 (6 oportunidades, 2 contribuciones propuestas, 3 `NEW_POSITION_DECISION_BUDGET`, 1 `BELOW_MINIMUM_ORDER_GAP`), se amplía **la misma traza opt-in** `PortfolioDecisionEngine.researchReachTrace` con:

- `opportunityAllocationAudit` sobre todas las alertas actuales: identidad, categoría, `rankingScore` de shortlist, `allocationPriority` efectivo del allocator (LEGACY en producción), estado de timing y fracción autorizada, consenso/votos, momentum 20/60/120, volatilidad, diferencial contra cash, condición de shortlist, importe propuesto y motivo exacto de no financiación.
- `targetGapEur` y `minimumMeaningfulGapEur` **solo cuando el flujo llegó a calcular ambos**, nunca inventar un gap si el budget rechazó antes; el presupuesto usado `newPositionDecisionLimit` y `bootstrapDeploymentActive` se conservan como contexto as-of.
- El mismo `buildH2CapitalMobilityReadout` lleva los nuevos campos a la descarga manual local y el **mismo desplegable ya existente** `MarketUtilityDashboard → Controles y detalle de ejecución` muestra una tabla compacta. La exportación puede contener datos privados y no se transmite automáticamente a GitHub.
- Pruebas 951e/f añadidas al fichero de unit tests de asignación **existente**, para comprobar observación financiada, ausencia de pares H2, ranking, prioridad, motivos no financiados y paridad sin generar órdenes ni outcomes.

**Importante:** esto solo explica por qué se financiaron unos activos en la decisión actual. No reproduce los scores exactos del 6/11 a partir del JSON anterior (no estaban), no ordena candidatos por retornos futuros y no prueba que comprar 3 o 4 hubiese sido mejor. El límite normal `MEDIUM=2` y `LEGACY` no se modifican. No replays largos.

**Validación**: se comprobó con `tsc --strict --noEmit --target ES2022` un fragmento aislado representativo de las nuevas expresiones tipadas de la auditoría; **no es un PASS del proyecto completo**. Para validar el HEAD nuevo, se necesita una sola ejecución local de `Producto · cierre rápido`; sin su log no declarar TypeScript/guards PASS.
