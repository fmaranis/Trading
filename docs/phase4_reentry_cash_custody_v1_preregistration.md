# FASE 4 — EXIT_PROCEEDS_CUSTODY_V1 · preregistro blind

Fecha de congelación: **2026-09-12**  
Protocolo común: `ECONOMIC_VALIDATION_PROTOCOL_V1`  
Política candidata: `EXIT_PROCEEDS_CUSTODY_V1`  
Estado: **POLICY FROZEN / BLIND NOT OPENED / RESEARCH ONLY**

## Nota de corrección pre-open — 2026-09-12

Antes de descargar o abrir ningún histórico del pool blind, una revisión estática de la primera integración detectó tres problemas de implementación/metodología:

1. una rotación 1:1 con reservas activas podía superar el precheck atómico y después bloquear la compra del challenger al volver a proteger el cash reservado durante la ejecución;
2. el executor utilizaba un marcador dentro de `reason` como condición de control para reconocer un EXIT de custodia;
3. el reach agregado podía contar varias veces el mismo episodio porque las seis cohortes se solapan.

La integración defectuosa se retiró del replay antes de abrir el blind. **No se descargó ni observó ningún histórico de los 30 activos, por lo que la muestra sigue fresh/blind.**

Esta corrección no cambia la hipótesis económica ni introduce parámetros derivados de outcomes. Aclara y congela antes del blind los invariantes que la implementación corregida deberá cumplir: prioridad de financiación de rotaciones atómicas, reducción proporcional de reservas si el cash real no alcanza y reach deduplicado por episodio económico.

---

## 1. Pregunta económica

La cadena actual ya permite que un activo vendido vuelva a comprarse si, en una fecha posterior, vuelve a superar los gates normales de oportunidad, consenso y `EntryTiming`.

El problema a estudiar no es crear una señal especial de reentrada. Es otro:

> **Después de un EXIT no-core, ¿reservar causalmente sus proceeds netos para una posible primera reentrada del mismo activo mejora la riqueza terminal frente a devolver inmediatamente ese capital al core, sin relajar ningún gate de entrada?**

HFG sólo motivó esta pregunta general. No se usa para fijar esperas, thresholds, confirmaciones, sizing ni fechas.

Producción permanece sin cambios bajo `CORE_ARCHITECTURE_V1` + allocation `LEGACY`.

---

## 2. Hallazgo arquitectónico previo al blind

La auditoría del código real, realizada antes de abrir la muestra, confirma:

1. un activo vendido puede volver a entrar por la cadena ordinaria si vuelve a ser elegible;
2. `CORE_ARCHITECTURE_V1` devuelve actualmente un `REDUCE/EXIT` no-core sin destino financiado al core global sano mediante `RETURN_TO_CORE`;
3. por tanto, el cuello de botella potencial de reentrada es **financiación/custodia del capital**, no ausencia de una señal de compra especial.

La Fase 4 no modifica `PortfolioCandidateGate`, `StrategyConsensusEngine`, `EntryTimingEngine`, starter/build caps, categoría, slots, ranking, `CORE_GATE_V1` ni las reglas de salud que generan el EXIT.

---

## 3. Política exacta congelada

`EXIT_PROCEEDS_CUSTODY_V1` es un overlay research-only del replay integrado. La política queda congelada aquí; la integración ejecutable sólo podrá abrir el blind cuando los guards de la sección 11 demuestren que implementa exactamente este contrato.

### 3.1 Salida elegible

Una salida crea custodia sólo cuando:

- es un **EXIT 100% realmente ejecutado**;
- la posición no es `STRATEGIC_GROWTH_CORE`;
- el EXIT procede de la salud/arquitectura ordinaria de la posición;
- no es una rotación competitiva hacia un challenger táctico;
- si `CORE_ARCHITECTURE_V1` había convertido ese EXIT en `RETURN_TO_CORE`, el brazo candidato desacopla únicamente esa devolución automática al core y deja el EXIT como salida normal.

`REDUCE` nunca crea custodia.

Las transferencias estructurales entre cores tampoco crean custodia.

### 3.2 Importe reservado

Después de ejecutar la venta en `NEXT_OPEN`, la reserva es exactamente:

`netExitProceeds = grossSale - brokerFee - immediateTax`

Sólo se reserva un importe positivo realmente existente. No se inventa efectivo y no se utiliza el notional teórico previo a ejecución.

### 3.3 Estado del cash reservado

El cash reservado:

- sigue siendo cash real de la cartera;
- sigue remunerándose con la misma lógica histórica BCE/fiscalidad;
- sigue contando dentro del patrimonio;
- no puede financiar otros activos mientras la custodia esté activa;
- nunca permite gastar por debajo del cash objetivo de la cartera;
- queda siempre limitado por el cash realmente disponible tras retiradas u otros flujos.

Si existen varias reservas activas y el cash real por encima del objetivo es insuficiente para protegerlas íntegramente, la parte económicamente efectiva de **todas** las reservas se reduce **proporcionalmente a su importe nominal**. No existe prioridad FIFO/LIFO ni preferencia por antigüedad.

No existe una aportación implícita ni una segunda cuenta económica.

### 3.4 Condición de reentrada

No existe un gate de reentrada nuevo.

El activo sólo puede reutilizar su reserva cuando la cadena canónica, sin ninguna relajación, vuelve a generar para él una contribución normal:

`REAL data -> PortfolioCandidateGate -> consenso -> EntryTiming != WAIT -> PortfolioDecisionEngine -> CORE_GATE_V1 -> CORE_ARCHITECTURE_V1`

La reserva:

- no convierte un candidato rechazado en elegible;
- no cambia `WAIT` a entrada;
- no aumenta el sizing por encima de lo que la cadena ordinaria ya autorizó;
- sólo aporta financiación hasta el importe ordinariamente recomendado.

### 3.5 Fin de la custodia

La custodia termina en la **primera BUY realmente ejecutada** del mismo activo después del EXIT.

En ese momento:

- se contabiliza como reentrada;
- se considera utilizado, como máximo, el cash reservado necesario para la operación real incluida su comisión;
- cualquier remanente de la reserva se libera como cash general para decisiones posteriores.

Si el activo nunca vuelve a ser elegible, la reserva no caduca arbitrariamente: permanece como cash remunerado hasta el final del caso. Ese coste de oportunidad forma parte del resultado económico.

No hay waiting period, expiry, número de confirmaciones ni porcentaje de reserva ajustable.

---

## 4. Asignación cuando existe cash reservado

Para impedir que la reserva se filtre a otros activos sin crear una segunda cadena de decisión:

1. las rotaciones 1:1 ya financiadas por proceeds de su propia venta conservan primero esa financiación dedicada; una reserva preexistente no puede provocar `SELL` del incumbent y después bloquear su `BUY` pareado;
2. una contribución al activo que posee la reserva puede usar su propia reserva hasta su sizing ordinario;
3. el cash libre restante se distribuye entre las demás contribuciones ya autorizadas preservando proporcionalmente sus importes relativos;
4. ningún importe final puede superar el recomendado por la cadena baseline;
5. si tras el ajuste una orden no supera el mínimo económico/una unidad entera aplicable, se elimina y el cash permanece sin invertir;
6. la elegibilidad de custodia y la atomicidad de ejecución deben viajar como estado estructurado/telemetría; los textos de `reason` son sólo auditoría y **no pueden ser autoridad lógica del executor**.

Así, la única diferencia experimental es la custodia de proceeds de un EXIT no-core y su disponibilidad exclusiva para la primera reentrada normal del mismo activo.

---

## 5. Baseline

Control:

`CORE_ARCHITECTURE_V1` actual, sin custodia.

Cuando un EXIT no-core queda sin destino táctico financiado y existe un core sano, la arquitectura actual puede devolver sus proceeds al core mediante `RETURN_TO_CORE`.

Candidato:

la misma cadena, mismos datos, mismas fechas, mismo cash, costes, impuestos y sizing, pero el neto de ese EXIT se custodia según la sección 3.

No cambia ninguna otra regla.

---

## 6. Muestra blind histórica reservada antes de abrir precios

La muestra fresh se selecciona por identidad estructural y diversificación geográfica, no por rendimiento histórico. Una búsqueda previa del repositorio no encontró uso de estos tickers en los protocolos/holdouts existentes. No se han descargado ni observado sus históricos para diseñar esta política.

### 6.1 Pool fresh congelado — 30 acciones EUR

Alemania:

- `EQ_PH4_SAP` — `SAP.DE`
- `EQ_PH4_SIE` — `SIE.DE`
- `EQ_PH4_ALV` — `ALV.DE`
- `EQ_PH4_BAS` — `BAS.DE`
- `EQ_PH4_DTE` — `DTE.DE`
- `EQ_PH4_DB1` — `DB1.DE`
- `EQ_PH4_ADS` — `ADS.DE`
- `EQ_PH4_BMW` — `BMW.DE`
- `EQ_PH4_MUV2` — `MUV2.DE`
- `EQ_PH4_HEN3` — `HEN3.DE`
- `EQ_PH4_BEI` — `BEI.DE`
- `EQ_PH4_RWE` — `RWE.DE`
- `EQ_PH4_IFX` — `IFX.DE`
- `EQ_PH4_VOW3` — `VOW3.DE`
- `EQ_PH4_MRK` — `MRK.DE`

Francia:

- `EQ_PH4_AIR` — `AIR.PA`
- `EQ_PH4_OR` — `OR.PA`
- `EQ_PH4_SAN` — `SAN.PA`
- `EQ_PH4_MC` — `MC.PA`
- `EQ_PH4_SU` — `SU.PA`
- `EQ_PH4_BNP` — `BNP.PA`
- `EQ_PH4_DG` — `DG.PA`
- `EQ_PH4_CAP` — `CAP.PA`
- `EQ_PH4_RI` — `RI.PA`
- `EQ_PH4_AI` — `AI.PA`

Italia:

- `EQ_PH4_ENEL` — `ENEL.MI`
- `EQ_PH4_ISP` — `ISP.MI`
- `EQ_PH4_ENI` — `ENI.MI`

España:

- `EQ_PH4_IBE` — `IBE.MC`
- `EQ_PH4_ITX` — `ITX.MC`

Todos se tratan como acciones individuales mediante identidad `EQ_*`; nunca como core diversificado por pertenecer a una categoría regional amplia.

### 6.2 Contexto estructural común

Cada caso incluye además dos instrumentos ya conocidos, utilizados únicamente para que la arquitectura productiva disponga de un core global real:

- `EUNL`;
- `VWCE`.

No son parte del pool fresh ni cuentan como evidencia fresh de reentrada. `EXIT_PROCEEDS_CUSTODY_V1` no crea reservas para miembros de `STRATEGIC_GROWTH_CORE`.

### 6.3 Seis casos de robustez deterministas

Se crean **6 cohortes**. Cada cohorte contiene:

- `EUNL` + `VWCE`;
- 12 de las 30 acciones fresh.

Para la cohorte `i = 0..5`, las 30 acciones se ordenan por:

`SHA256("PHASE4_REENTRY_BLIND_V1:<i>:<assetId>")`

y se toman las 12 primeras.

La selección es determinista, previa a datos y no depende de rentabilidad. Las cohortes pueden solaparse y se interpretan como **casos de robustez de cartera**, no como seis muestras estadísticamente independientes.

No se sustituyen nombres después de abrir el blind.

---

## 7. Ventana y datos congelados

- data request start: `2014-09-01`;
- replay start: `2016-09-01`;
- end fijo: `2026-09-01`;
- frecuencia: `MONTHLY`;
- capital inicial por caso: **13.000 EUR**;
- riesgo: `MEDIUM`;
- horizonte: 3 años;
- modo: `CUSTODIA_ENGINE`;
- cash: `HISTORICAL_ECB_DFR_FLOOR_0`;
- fallback de interfaz: 2,5% sólo donde el contrato existente lo exija;
- fiscalidad: semántica conservadora actual del replay, `contextConfirmed:false`;
- `externalCashFlows`: ninguno;
- current Yahoo discovery histórico: **OFF**;
- datos: **REAL-only**;
- mínimo causal por decisión: 252 barras.

Usar las mismas fechas ya vistas en otras líneas no convierte estas acciones fresh en muestra de promoción consumida: el holdout es cross-sectional y los 30 instrumentos no se utilizaron para diseñar esta política. Se mantiene explícita la limitación de survivorship del catálogo elegido.

---

## 8. Gate de calidad de datos

Cada cohorte es válida sólo si:

- `EUNL` y `VWCE` tienen datos REAL válidos;
- al menos 10 de sus 12 acciones fresh pasan el scanner REAL;
- no aparece `SYNTHETIC`;
- no aparece ningún `OPEN_*` de current discovery;
- cada activo aceptado dispone de historia suficiente para el mínimo causal;
- no se reemplaza ningún activo rechazado.

Las seis cohortes deben ser válidas. Si alguna no lo es:

`INCONCLUSIVE_INVALID_DATA`.

---

## 9. Reach mínimo congelado

Para emitir un juicio económico se exige, entre las seis cohortes, reach **deduplicado por episodio económico**:

- al menos **12 EXIT-reservas únicas realmente ejecutadas**;
- al menos **6 reentradas únicas realmente ejecutadas** usando la política de custodia.

Una reserva única se identifica por `assetId + exitExecutionDate`. Si el mismo activo y la misma fecha aparecen en varias cohortes solapadas, cuentan **una sola vez** para el gate de reach.

Una reentrada única se identifica por `assetId + sourceExitExecutionDate + reentryExecutionDate`. La repetición del mismo episodio en varias cohortes cuenta **una sola vez**.

El runner debe reportar además los conteos brutos por cohorte para auditoría, pero sólo los conteos deduplicados deciden el reach.

Si la integridad técnica pasa pero no se alcanza este reach:

`INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

No se baja el mínimo después de ver el resultado.

---

## 10. Métrica primaria y guardrails

Métrica primaria:

`finalValueDeltaEur = finalValue_candidate - finalValue_baseline`

Todo se mide neto de las mismas comisiones y fiscalidad modeladas.

También se reportan:

- retorno total/ajustado;
- max drawdown;
- fees;
- impuesto estimado;
- cash interest;
- BUY/ADD/REDUCE/EXIT;
- reservas creadas;
- reentradas ejecutadas;
- proceeds netos reservados;
- cash reservado usado en reentrada;
- pico y saldo final reservado;
- delta de número de operaciones.

### PASS_CANDIDATE_FOR_CONFIRMATION

Sólo se obtiene si simultáneamente:

1. 6/6 cohortes válidas;
2. reach deduplicado de la sección 9 cumplido;
3. al menos **4/6** cohortes tienen `finalValueDeltaEur > 0`;
4. mediana de `finalValueDeltaEur > 0`;
5. mediana de `finalValueDeltaEur` supera el mayor de:
   - **65 EUR** (= 0,5% de 13.000 EUR); o
   - la mediana del incremento positivo de `fees + estimatedTax` del candidato frente al baseline;
6. mediana del deterioro de max drawdown no supera **+0,5 pp**;
7. ninguna cohorte presenta:
   - `finalValueDeltaEur < -650 EUR` (-5% del capital inicial); o
   - deterioro de max drawdown > **+3,0 pp**.

Si hay reach suficiente y cualquiera de estos gates falla:

`FAIL_RETIRED_AS_TESTED`.

Un PASS sólo habilita una segunda confirmación independiente con la política sin cambios. No promociona producción.

---

## 11. Integridad y fingerprint

Antes de abrir el blind deben pasar:

1. unit test de `EXIT_PROCEEDS_CUSTODY_V1`;
2. guard `CORE_ARCHITECTURE_V1`;
3. guard `PortfolioCandidateGate`;
4. guard de cierre de superficie productiva;
5. TypeScript / `tsc --noEmit`;
6. verificación de que producción/default sigue sin custodia;
7. guard explícito de atomicidad: una rotación 1:1 no puede ejecutar el `SELL` si su `BUY` pareado no será ejecutable respetando simultáneamente reservas preexistentes y proceeds dedicados de la propia venta;
8. guard de control estructurado: el executor no puede decidir elegibilidad de custodia mediante `reason.includes(...)` ni otro texto de auditoría;
9. guard de shortfall: varias reservas activas con cash insuficiente deben reducirse pro-rata, sin FIFO/LIFO oculto.

El runner registra SHA/identidad de los archivos metodológicamente críticos del candidato y del preregistro. Si cambia la implementación después de abrir la muestra, esta corrida no puede mezclarse con otra bajo el mismo V1.

---

## 12. Ejecución

La validación se integrará en el `ResearchValidationCenter` existente como el **único job económico de la fase actual**.

La primera integración ejecutable fue retirada durante la revisión pre-open por incumplir los invariantes 7–8 de la sección 11. Mientras la integración corregida no pase todos los guards, el job blind **no debe estar disponible para ejecución**.

Los guards rápidos se ejecutan primero. Sólo si pasan se abre por primera vez el histórico blind REAL.

La prueba larga corre en el backend/local de la app. Nunca GitHub Actions ni agentes prolongados.

En el momento en que el runner descargue/abra los históricos de las 30 acciones, esta muestra quedará consumida, independientemente de PASS/FAIL/INCONCLUSIVE.

---

## 13. Prohibiciones post-open

Después de abrir el blind no se puede:

- añadir expiry a la reserva;
- reservar sólo una fracción elegida retrospectivamente;
- exigir N meses/días de espera;
- alterar gates/timing/sizing;
- cambiar el pool de 30 acciones;
- sustituir activos rechazados;
- cambiar cohortes;
- cambiar start/end;
- rebajar el reach;
- cambiar los 65 EUR / 0,5 pp / 3 pp / -650 EUR;
- retocar la política por lo que ocurra en una cohorte;
- usar HFG para justificar una V1.1.

Cualquier política futura distinta exige preregistro y muestra fresh nueva.

---

## Contrato final

`EXIT_PROCEEDS_CUSTODY_V1` prueba una sola hipótesis:

> **Conservar temporalmente los proceeds netos de un EXIT no-core para la primera reentrada normal del mismo activo puede evitar que una recuperación válida quede sin financiación, a cambio de asumir explícitamente el coste de oportunidad de mantener ese cash reservado.**

No crea señal de reentrada, no cambia el gate, no crea dinero, no protege strategic cores y no añade autoridad productiva.

**BLIND NO ABIERTO EN EL MOMENTO DE ESTE PREREGISTRO Y DE SU CORRECCIÓN PRE-OPEN.**
