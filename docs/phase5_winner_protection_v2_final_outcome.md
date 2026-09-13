# Fase 5 · protección de grandes ganadores · resultado blind V1

Fecha de cierre: **2026-09-14**  
Estado: **PASS_CANDIDATE_FOR_CONFIRMATION / SAMPLE CONSUMED / RESEARCH ONLY / PRODUCTION LEGACY**

## 1. Qué se validó

Se ejecutó una única validación fresh/blind/out-of-sample de `TREND_PROTECTION_V2_WINNER_ONLY` dentro del wrapper existente `runDynamicReplayWithRotationExperiment(...)`, sin crear un motor paralelo y sin modificar producción.

Baseline:

`CORE_ARCHITECTURE_V1`

Candidato:

`CORE_ARCHITECTURE_V1 + TREND_PROTECTION_V2_WINNER_ONLY`

La política exacta, la muestra, el sizing, los criterios de reach, la métrica primaria y los gates PASS/FAIL/INCONCLUSIVE quedaron congelados antes de abrir outcomes en `docs/phase5_winner_protection_v2_preopen_design.md` y en el seal `PHASE5_WINNER_PROTECTION_V2_SEAL_V1`.

## 2. Muestra consumida

Configuración ejecutada:

- data start: `1998-01-02`;
- replay: `2001-01-03 -> 2003-12-31`;
- frecuencia: `DAILY`;
- capital inicial: `13.000 EUR` por cohorte;
- estado inicial: cartera manual igual ponderada de 3 activos, cash 0;
- riesgo: `MEDIUM`;
- horizonte nominal: 3 años;
- cash: BCE DFR histórico con suelo 0%;
- sin `externalCashFlows`;
- ejecución: `NEXT_OPEN`;
- current discovery histórico: OFF;
- datos: REAL / Yahoo Finance.

Cohortes selladas:

1. `FER.MC / RHM.DE / ENEL.MI`
2. `UCG.MI / OR.PA / ASML.AS`
3. `REP.MC / DTE.DE / SAN.PA`
4. `ENI.MI / SAP.DE / SU.PA`
5. `ADS.DE / BBVA.MC / TTE.PA`
6. `AI.PA / BNP.PA / ISP.MI`

Estado de muestra tras la primera petición de datos del runner:

`PHASE5_OPENED_CONSUMED`

No puede volver a tratarse como fresh ni utilizarse para retunear thresholds, confirmaciones, sizing, ventana, muestra, frecuencia, reach o gates.

## 3. Resultado del blind

Veredicto preregistrado:

**`PASS_CANDIDATE_FOR_CONFIRMATION`**

Los seis data gates fueron válidos y el mecanismo tuvo reach económico real.

### Reach

- reducciones winner-protection únicas realmente ejecutadas: **18**;
- mínimo requerido: **6**;
- cohortes con al menos una reducción ejecutada: **6/6**;
- mínimo requerido: **4/6**.

Reach por cohorte:

| Cohorte | Reducciones ejecutadas | `finalValueDeltaEur` |
|---|---:|---:|
| C1 | 5 | -86,75 EUR |
| C2 | 1 | -5,70 EUR |
| C3 | 2 | +92,16 EUR |
| C4 | 2 | +144,76 EUR |
| C5 | 4 | +305,84 EUR |
| C6 | 4 | +286,16 EUR |

Agregado de los seis deltas: **+736,47 EUR**.

## 4. Gates económicos congelados

Todos los gates preregistrados pasaron:

1. data gate: **6/6 PASS**;
2. reach: **18 reducciones / 6 cohortes, PASS**;
3. cohortes positivas: **4/6**, requerido 4/6;
4. mediana `finalValueDeltaEur`: **+118,46 EUR**, requerida > 0;
5. materialidad: **+118,46 EUR** frente a umbral **65 EUR**; mediana de costes incrementales positivos **12,66 EUR**, PASS;
6. mediana de deterioro de max drawdown: **-1,912 pp**, límite +0,5 pp; el signo negativo representa mejora de drawdown;
7. peor delta individual: **-86,75 EUR**, límite de daño -650 EUR;
8. peor deterioro individual de max drawdown: **0 pp**, límite +3 pp;
9. dominancia: delta agregado **+736,47 EUR**; eliminando la mejor cohorte permanece **+430,63 EUR**, por tanto el resultado no depende de una única cohorte extrema.

## 5. Interpretación permitida

La evidencia apoya que, **dentro de esta muestra OOS concreta**, la política winner-only de V2 tuvo suficiente reach y mejoró la riqueza terminal con materialidad preregistrada, a la vez que no deterioró los guardrails de drawdown/daño.

Esto es evidencia favorable de la **política económica exacta probada**, no sólo de la señal.

También hay heterogeneidad real: dos cohortes fueron negativas (`-86,75 EUR` y `-5,70 EUR`). El PASS no significa que cada episodio individual de reducción sea beneficioso ni que el overlay deba vender siempre; significa que el conjunto cumplió los gates congelados de consistencia, materialidad y riesgo.

La muestra sigue sujeta a la limitación histórica ya declarada de survivorship/catalog bias porque todavía no existe un instrument master point-in-time completo.

## 6. Qué NO autoriza este PASS

`PASS_CANDIDATE_FOR_CONFIRMATION` **no promociona producción**.

Por tanto:

- producción permanece `LEGACY`;
- no se conecta `TREND_PROTECTION_V2_WINNER_ONLY` al producto live;
- no se cambian alerts/Telegram productivos por este resultado;
- no se retunea ningún parámetro con la muestra 2001–2003;
- no se crea V3/V12/V13 ni una variante reactiva;
- no se vuelve a ejecutar este blind como fresh.

## 7. Siguiente paso metodológico

Según `ECONOMIC_VALIDATION_PROTOCOL_V1`, un primer PASS sólo habilita una **confirmación independiente** con la misma política congelada sin cambios.

La confirmación debe usar una muestra distinta y preregistrada antes de abrir outcomes. Preferencia metodológica: future-forward o un holdout histórico realmente reservado e independiente que no haya sido consumido durante diseño/interpretación.

Hasta esa confirmación, el estado correcto es:

**CANDIDATE FOR CONFIRMATION / RESEARCH ONLY / NO PRODUCTION CHANGE.**

## 8. Evidencia durable

Autoridad del resultado:

- branch: `replay-results`;
- path: `validation-runs/research-validation/phase5-winner-protection-v2.json`;
- blob: `20172a1f4a144f322471a1b68d723b8a071beb9e`;
- `sampleState = PHASE5_OPENED_CONSUMED`;
- `verdict = PASS_CANDIDATE_FOR_CONFIRMATION`.

El log visible del Centro de validación puede quedar truncado por tamaño; el JSON durable anterior es la fuente autoritativa del outcome.
