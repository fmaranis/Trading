# FASE 4 — EXIT_PROCEEDS_CUSTODY_V1 · preregistro blind

Fecha de congelación de política: **2026-09-12**  
Protocolo común: `ECONOMIC_VALIDATION_PROTOCOL_V1`  
Política candidata: `EXIT_PROCEEDS_CUSTODY_V1`  
Sample seal vigente: `PHASE4_REENTRY_BLIND_R2`  
Estado: **POLICY FROZEN / R1 VOID PRE-OPEN / R2 SEALED / BLIND NOT OPENED / RESEARCH ONLY**

## 0. Correcciones pre-open y trazabilidad

La primera revisión de Fase 4 detectó errores antes de descargar o abrir ningún histórico blind. Por tanto, **ninguna muestra de Fase 4 ha sido consumida**.

### R1 — VOID PRE-OPEN

La primera propuesta queda anulada sin valor probatorio por cuatro motivos:

1. la integración inicial podía romper la atomicidad de una rotación 1:1: el `SELL` podía ejecutarse y el `BUY` pareado quedar bloqueado después por la protección de reservas;
2. el executor usaba texto de `reason` como autoridad lógica para reconocer un EXIT de custodia;
3. las seis cohortes se solapaban y podían contar varias veces el mismo episodio de EXIT/reentrada;
4. la muestra no era fresh:
   - **18/30** tickers ya estaban en `EUR_PORTFOLIO_EXPANSION_UNIVERSE` antes del preregistro;
   - la ventana propuesta `2016-09-01 -> 2026-09-01` coincide con la ventana de 10 años ya consumida por Opportunity/Allocation y registrada como consumida en `ECONOMIC_VALIDATION_PROTOCOL_V1`.

Los 18 nombres contaminados eran: `SAP.DE`, `SIE.DE`, `ALV.DE`, `DTE.DE`, `DB1.DE`, `ADS.DE`, `AIR.PA`, `MC.PA`, `OR.PA`, `AI.PA`, `SU.PA`, `SAN.PA`, `BNP.PA`, `ITX.MC`, `IBE.MC`, `ENEL.MI`, `ISP.MI`, `ENI.MI`.

La integración defectuosa fue retirada de `dynamicHistoricalReplayCore.ts` y el archivo volvió al blob productivo/replay conocido anterior a Fase 4 antes de abrir datos.

### Infraestructura corregida antes de R2

La revisión también detectó que `ECB_DEPOSIT_FACILITY_RATE_HISTORY` empezaba en diciembre de 2011 y, para fechas anteriores, retrocedía incorrectamente ese 0,25% como si hubiese sido siempre el DFR histórico.

Se completó la tabla oficial de facilidad de depósito del BCE desde 1999. Esto es una corrección general de infraestructura, no un ajuste de la política Fase 4. El suelo nominal 0% del proxy minorista se mantiene sin cambios.

---

## 1. Pregunta económica

La cadena actual ya permite que un activo vendido vuelva a comprarse si posteriormente vuelve a superar los gates normales de oportunidad, consenso y `EntryTiming`.

La hipótesis no crea una señal especial de reentrada. Pregunta únicamente:

> **Después de un EXIT no-core, ¿reservar causalmente sus proceeds netos para una posible primera reentrada normal del mismo activo mejora la riqueza terminal frente a devolver inmediatamente ese capital al core, sin relajar ningún gate?**

HFG sólo motivó esta pregunta general. No fija esperas, thresholds, confirmaciones, sizing ni fechas.

Producción permanece sin cambios bajo `CORE_ARCHITECTURE_V1` + allocation `LEGACY`.

---

## 2. Hallazgo arquitectónico previo al blind

Antes de abrir la muestra se verificó que:

1. un activo vendido puede volver a entrar por la cadena ordinaria;
2. `CORE_ARCHITECTURE_V1` devuelve normalmente un `REDUCE/EXIT` no-core sin destino financiado al core global sano mediante `RETURN_TO_CORE`;
3. por tanto, el cuello de botella potencial es de **financiación/custodia del capital**, no de ausencia de señal.

Fase 4 no modifica `PortfolioCandidateGate`, `StrategyConsensusEngine`, `EntryTimingEngine`, starter/build caps, categorías, slots, ranking, `CORE_GATE_V1` ni las reglas de salud que generan el EXIT.

---

## 3. Política exacta congelada

`EXIT_PROCEEDS_CUSTODY_V1` es un overlay research-only del replay integrado. Sólo podrá volver a conectarse al replay cuando los guards de la sección 11 prueben que implementa exactamente este contrato.

### 3.1 EXIT elegible

Crea custodia únicamente un EXIT que sea simultáneamente:

- **100% realmente ejecutado**;
- de una posición no `STRATEGIC_GROWTH_CORE`;
- originado por salud/arquitectura ordinaria de esa posición;
- no una rotación competitiva hacia un challenger táctico.

Si `CORE_ARCHITECTURE_V1` había transformado ese EXIT en `RETURN_TO_CORE`, el candidato desacopla sólo esa devolución automática al core y conserva el EXIT normal.

`REDUCE` nunca crea custodia. Las transferencias estructurales entre cores tampoco.

### 3.2 Importe reservado

Después de la venta `NEXT_OPEN`:

`netExitProceeds = grossSale - brokerFee - immediateTax`

La reserva sólo puede contener efectivo positivo realmente obtenido. No usa notional teórico ni crea dinero.

### 3.3 Estado del cash reservado

El importe reservado:

- sigue siendo cash real de la cartera;
- sigue remunerándose con la misma lógica BCE y fiscalidad de cash;
- sigue formando parte del patrimonio;
- no puede financiar otros activos mientras la custodia esté activa;
- nunca autoriza gastar por debajo del cash objetivo;
- queda limitado por el cash realmente existente.

Si varias reservas están activas y el cash real protegible es insuficiente, **todas se reducen pro-rata respecto a sus importes nominales**. No hay FIFO/LIFO ni prioridad por antigüedad.

### 3.4 Condición de reentrada

No existe gate nuevo.

El activo sólo puede utilizar su propia reserva si la cadena canónica vuelve a generar una contribución normal:

`REAL -> PortfolioCandidateGate -> consenso -> EntryTiming != WAIT -> PortfolioDecisionEngine -> CORE_GATE_V1 -> CORE_ARCHITECTURE_V1`

La custodia:

- no convierte `REJECTED` en compra;
- no cambia `WAIT`;
- no aumenta el sizing por encima del ya autorizado;
- sólo aporta financiación hasta el importe ordinariamente recomendado.

### 3.5 Fin de custodia

La custodia termina en la **primera BUY realmente ejecutada** del mismo activo después del EXIT.

En esa ejecución:

- se registra la reentrada;
- se consume como máximo la parte de reserva necesaria para la compra y comisión reales;
- cualquier remanente se libera como cash general.

Si nunca reaparece una BUY válida, la reserva no caduca: permanece como cash remunerado hasta el final del caso. Ese coste de oportunidad forma parte del resultado.

No existe waiting period, expiry, número de confirmaciones ni porcentaje de reserva ajustable.

---

## 4. Asignación y atomicidad

Con reservas activas:

1. una rotación 1:1 conserva como financiación dedicada los proceeds de su propia venta; una reserva preexistente nunca puede producir `SELL` sin el `BUY` pareado;
2. una contribución al activo reservado puede usar su propia reserva hasta el sizing ordinario;
3. el cash libre restante se reparte proporcionalmente entre las demás contribuciones ya autorizadas;
4. ningún importe puede superar la recomendación baseline;
5. una orden que deje de cumplir mínimo económico/título entero se elimina y el cash queda sin invertir;
6. elegibilidad de custodia, origen del EXIT y emparejamiento de reentrada deben viajar en estado estructurado/telemetría. `reason` es sólo auditoría y nunca autoridad de ejecución.

---

## 5. Baseline emparejado

### Control

`CORE_ARCHITECTURE_V1` sin custodia.

### Candidato

La misma cadena, mismas series, estado inicial, fechas, cash, costes, impuestos y sizing, cambiando sólo la custodia descrita arriba.

La política productiva sigue siendo `LEGACY`; el candidato sólo existe dentro de la validación research.

---

## 6. Sample seal R2 — pool histórico fresh

R2 sustituye completamente a R1 antes de cualquier apertura de históricos.

La selección usa únicamente criterios estructurales:

- acción individual con cotización EUR;
- identidad `EQ_PH4_R2_*` para que nunca se confunda con core diversificado;
- nombre/ticker ausente del catálogo productivo y de los holdouts históricos registrados en el repositorio en el momento del seal;
- cotización estructuralmente antigua, buscando que el proveedor pueda cubrir el bloque temporal sin seleccionar por rentabilidad;
- diversificación geográfica.

Una búsqueda de código previa a añadir estos nombres R2 no devolvió coincidencias para sus tickers. No se han descargado sus históricos para Fase 4.

### 6.1 Pool R2 — 30 acciones

**Alemania**

- `EQ_PH4_R2_BAS` — `BAS.DE`
- `EQ_PH4_R2_BMW` — `BMW.DE`
- `EQ_PH4_R2_MUV2` — `MUV2.DE`
- `EQ_PH4_R2_HEN3` — `HEN3.DE`
- `EQ_PH4_R2_BEI` — `BEI.DE`
- `EQ_PH4_R2_RWE` — `RWE.DE`
- `EQ_PH4_R2_IFX` — `IFX.DE`
- `EQ_PH4_R2_VOW3` — `VOW3.DE`
- `EQ_PH4_R2_MRK` — `MRK.DE`
- `EQ_PH4_R2_CON` — `CON.DE`

**Francia**

- `EQ_PH4_R2_DG` — `DG.PA`
- `EQ_PH4_R2_CAP` — `CAP.PA`
- `EQ_PH4_R2_RI` — `RI.PA`
- `EQ_PH4_R2_KER` — `KER.PA`
- `EQ_PH4_R2_HO` — `HO.PA`
- `EQ_PH4_R2_EN` — `EN.PA`
- `EQ_PH4_R2_VIV` — `VIV.PA`
- `EQ_PH4_R2_CS` — `CS.PA`
- `EQ_PH4_R2_GLE` — `GLE.PA`
- `EQ_PH4_R2_RNO` — `RNO.PA`

**España**

- `EQ_PH4_R2_ACS` — `ACS.MC`
- `EQ_PH4_R2_TEF` — `TEF.MC`
- `EQ_PH4_R2_ELE` — `ELE.MC`
- `EQ_PH4_R2_ANA` — `ANA.MC`
- `EQ_PH4_R2_ACX` — `ACX.MC`
- `EQ_PH4_R2_FCC` — `FCC.MC`

**Italia**

- `EQ_PH4_R2_G` — `G.MI`
- `EQ_PH4_R2_TIT` — `TIT.MI`
- `EQ_PH4_R2_LDO` — `LDO.MI`
- `EQ_PH4_R2_STM` — `STM.MI`

Para no introducir una taxonomía sectorial inventada, todos los holdout equities R2 se etiquetan `EUROPE_EQUITY`. La identidad `EQ_*` hace que la salud los trate como acciones individuales/tácticas, no como core.

### 6.2 Core estructural común

Cada cohorte incluye además:

- `FUND_VANGUARD_GLOBAL` — `IE00B03HD191` — Vanguard Global Stock Index Fund EUR Acc.

Es contexto productivo conocido, no evidencia fresh. Su clase EUR fue lanzada en diciembre de 2002, por lo que puede servir como core estructural desde el comienzo del bloque si el proveedor REAL confirma cobertura suficiente. Si no dispone de datos REAL suficientes, R2 queda `INCONCLUSIVE_INVALID_DATA`; no se sustituye retrospectivamente por otro core.

### 6.3 Seis cohortes disjuntas

Las 30 acciones se ordenan una sola vez por:

`SHA256("PHASE4_REENTRY_BLIND_R2:" + assetId)`

La lista ordenada se divide secuencialmente en **6 grupos disjuntos de 5**.

Cada cohorte contiene:

- `FUND_VANGUARD_GLOBAL`;
- exactamente 5 acciones R2 de su grupo.

Ninguna acción puede aparecer en dos cohortes. No hay sustituciones después de abrir el blind.

---

## 7. Ventana temporal R2

La primera ventana `2016-09-01 -> 2026-09-01` queda **VOID PRE-OPEN** porque estaba consumida.

R2 usa el bloque inmediatamente anterior y no solapado con los datos de las ventanas Opportunity/Allocation consumidas:

- data request start: `2002-12-10`;
- replay start: `2004-01-02`;
- end fijo: `2014-08-31`;
- primer día de decisión real: el primero >= replay start con >=252 barras causales;
- frecuencia: `MONTHLY`;
- capital inicial: **13.000 EUR** por cohorte;
- riesgo: `MEDIUM`;
- horizonte: 3 años;
- modo: `CUSTODIA_ENGINE`;
- cash: `HISTORICAL_ECB_DFR_FLOOR_0` usando la tabla BCE ya completada desde 1999;
- fiscalidad: **misma semántica conservadora del replay en ambos brazos**, `contextConfirmed:false`;
- `externalCashFlows`: ninguno;
- current Yahoo discovery histórico: **OFF**;
- datos: **REAL-only**;
- mínimo causal: 252 barras.

La fiscalidad del replay es un modelo conservador común a ambos brazos; R2 no pretende reconstruir la legislación fiscal española histórica año por año. La comparación económica es válida bajo la misma semántica modelada para control y candidato y debe declararse así en el resultado.

El final `2014-08-31` se fija porque `2014-09-01` es el comienzo de datos del bloque Opportunity/Allocation consumido. No se eligió por la rentabilidad posterior de R2.

Persiste la limitación de survivorship: sin instrument master point-in-time, este holdout no representa todo el mercado disponible de 2004–2014. Un PASS sólo puede habilitar confirmación independiente; nunca promoción directa.

---

## 8. Gate de calidad de datos

Una cohorte es válida sólo si:

- `FUND_VANGUARD_GLOBAL` tiene datos REAL suficientes para el replay;
- al menos **4/5** de sus acciones R2 tienen datos REAL y alcanzan el mínimo causal;
- no aparece `SYNTHETIC`;
- no aparece ningún `OPEN_*` de current discovery;
- fechas/OHLC cumplen los guards normales;
- ningún activo fallido se reemplaza.

Las **6/6** cohortes deben ser válidas. Si alguna falla:

`INCONCLUSIVE_INVALID_DATA`.

---

## 9. Reach congelado

Para emitir juicio económico se exige, en las seis cohortes:

- al menos **12 EXIT-reservas únicas realmente ejecutadas**;
- al menos **6 reentradas únicas realmente ejecutadas** usando custodia.

Una reserva única se identifica por:

`assetId + exitExecutionDate`

Una reentrada única se identifica por:

`assetId + sourceExitExecutionDate + reentryExecutionDate`

Aunque R2 usa cohortes disjuntas, el runner deduplica por estas claves como guard permanente.

Si la integridad pasa pero no se alcanza reach:

`INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

No se rebaja después de abrir resultados.

---

## 10. Métrica primaria y PASS/FAIL

Métrica primaria:

`finalValueDeltaEur = finalValue_candidate - finalValue_baseline`

Se reportan además:

- retorno total/ajustado;
- max drawdown;
- fees;
- impuesto estimado;
- cash interest;
- BUY/ADD/REDUCE/EXIT;
- reservas creadas;
- reentradas ejecutadas;
- proceeds netos reservados;
- cash reservado usado;
- pico y saldo final reservado;
- delta de operaciones.

### `PASS_CANDIDATE_FOR_CONFIRMATION`

Exige simultáneamente:

1. 6/6 cohortes válidas;
2. reach de sección 9;
3. al menos **4/6** cohortes con `finalValueDeltaEur > 0`;
4. mediana `finalValueDeltaEur > 0`;
5. mediana `finalValueDeltaEur` superior al mayor de:
   - **65 EUR** (=0,5% de 13.000 EUR);
   - mediana del incremento positivo de `fees + estimatedTax` candidato vs baseline;
6. mediana del deterioro de max drawdown <= **+0,5 pp**;
7. ninguna cohorte con:
   - `finalValueDeltaEur < -650 EUR`; o
   - deterioro de max drawdown > **+3,0 pp**.

Con reach suficiente, incumplir cualquiera => `FAIL_RETIRED_AS_TESTED`.

Un PASS sólo habilita segunda confirmación independiente con política congelada. No promociona producción.

---

## 11. Gates técnicos antes de abrir R2

Antes de cualquier descarga de los 30 históricos deben pasar:

1. unit test `EXIT_PROCEEDS_CUSTODY_V1`;
2. guard `CORE_ARCHITECTURE_V1`;
3. guard `PortfolioCandidateGate`;
4. guard de superficie productiva;
5. guard de cash histórico BCE, incluidos puntos pre-2011;
6. TypeScript / `tsc --noEmit`;
7. default/producción sigue `LEGACY` y sin custodia;
8. atomicidad: una rotación 1:1 ejecuta ambos lados o ninguno incluso con reservas activas;
9. control estructurado: el executor no usa `reason.includes(...)` ni texto equivalente como autoridad de custodia;
10. shortfall: múltiples reservas se reducen pro-rata;
11. una reentrada nunca supera el sizing canónico ni atraviesa `WAIT/REJECTED`;
12. una reserva se crea sólo después de un EXIT realmente ejecutado y usando proceeds netos reales.

El runner fingerprintará política, preregistro y archivos críticos antes de abrir la muestra.

---

## 12. Ejecución

La primera integración ejecutable fue retirada pre-open. Mientras la nueva integración no pase todos los gates anteriores, **no existe job blind ejecutable**.

Cuando se cierre técnicamente:

- se integrará como el único job económico activo de Fase 4 dentro del `ResearchValidationCenter` existente;
- guards rápidos primero;
- sólo después se descargarán por primera vez los históricos R2;
- cálculo largo en backend/local de la app;
- nunca GitHub Actions ni agentes prolongados.

En el instante de la primera descarga histórica R2, esta muestra quedará consumida aunque el resultado termine PASS, FAIL o INCONCLUSIVE.

---

## 13. Prohibiciones post-open

Después de abrir R2 no se puede:

- cambiar los 30 activos;
- sustituir un ticker con datos insuficientes;
- cambiar las cohortes;
- cambiar fechas;
- añadir expiry/waiting period/confirmaciones;
- reservar una fracción elegida retrospectivamente;
- alterar gate/timing/sizing;
- rebajar reach;
- cambiar 65 EUR / +0,5 pp / +3 pp / -650 EUR;
- retocar la política por un caso observado;
- usar HFG o R1 para justificar una variante paramétrica.

Cualquier política distinta exige preregistro y muestra fresh nueva.

---

## Contrato final

`EXIT_PROCEEDS_CUSTODY_V1` prueba una sola hipótesis:

> **Conservar temporalmente los proceeds netos de un EXIT no-core para la primera reentrada normal del mismo activo puede evitar que una recuperación válida quede sin financiación, asumiendo explícitamente el coste de oportunidad del cash reservado.**

No crea señal, no relaja gates, no crea dinero, no protege strategic cores y no añade autoridad productiva.

**R1 VOID PRE-OPEN. R2 SEALED. NINGÚN HISTÓRICO R2 HA SIDO ABIERTO.**
