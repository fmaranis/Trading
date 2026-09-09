# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`. Leer este archivo y comprobar HEAD antes de retomar trabajo técnico.

## Reglas no negociables
- Nunca usar GitHub Actions para replays o validaciones largas.
- ChatGPT modifica `main`; los cálculos pesados los ejecuta el motor local/backend de la app.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; sin lookahead.
- No recalibrar thresholds, coeficientes ni políticas sobre muestras consumidas.
- No crear motores paralelos: scanner, gates, decisión, allocation, replay y seguimiento comparten arquitectura.
- No crear pantallas nuevas cuando la capacidad cabe en los flujos existentes.
- Ningún dato financiero privado del usuario se embebe en código público.

---

# Estado vigente — 2026-09-09

## Motor productivo
Arquitectura productiva cerrada:

`CORE_ARCHITECTURE_V1`

Cadena:

`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine/evaluatePortfolioDecision -> ejecución/seguimiento`

Producción mantiene:

- allocation de oportunidad: **LEGACY**;
- `CORE_ELIGIBILITY_V2`: shadow;
- Forward Risk: no modifica producción;
- replay causal / NEXT_OPEN donde corresponde;
- modos `Desde cero / manual / cartera actual` y `Motor Custodia / mantener cartera` dentro del mismo replay;
- cash histórico BCE y fiscalidad integrados;
- Yahoo Search current nunca reconstruye universo histórico.

---

# OPEN_MARKET_DISCOVERY_V1 — CERRADO EN PASS CURRENT/LIVE

Estado:

`CURRENT_LIVE_INTEGRATION_PASS / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED`

El discovery current/live se integra en el scanner existente. No existe un segundo motor.

Limitación retenida: no existe todavía instrument master point-in-time completo con altas, bajas y delistings históricos.

---

# OPPORTUNITY / RANKING — HISTÓRICO CONSUMIDO

Se compararon:

- `LEGACY`;
- `QUALITY_V1`;
- `SLOPE_V1`.

Conclusiones cerradas:

- producción permanece LEGACY;
- QUALITY mostró información pero efecto económico/reach insuficiente en la comparación inicial;
- SLOPE no justificó promoción;
- las ventanas 10y / 6y / 3y utilizadas quedan consumidas;
- no QUALITY_V1.1 ni SLOPE_V1.1 retuneados sobre esas ventanas.

La auditoría de reach confirmó que QUALITY cambiaba ranking/selección con frecuencia, pero con capital cerrado casi nunca llegaba a compras ejecutadas.

---

# QUALITY_ALLOCATION_BRIDGE_V1 — CONGELADO / RESEARCH-ONLY

Integrado dentro del `PortfolioDecisionEngine` existente.

Default productivo:

`LEGACY`

Opción research-only:

`QUALITY_ALLOCATION_BRIDGE_V1`

Fórmula congelada:

`candidateQualityAdjustment = (reliability - 50) * 0.10 + (opportunity - 50) * 0.20`

`qualityMultiplier = clamp(1 + candidateQualityAdjustment / 100, 0.85, 1.15)`

`bridgePriority = legacyOpportunityPriority * qualityMultiplier`

No se modifican hard gates, cash hurdle, consenso, timing, starter/build, timing fractions, caps, slots, minimum order, rotaciones ni fiscalidad.

El primer diagnóstico cerrado mostró que el bridge llegaba al allocator, pero el capital cerrado sólo era desplegable en 3/228 decisiones. Esa muestra quedó consumida y el bridge no se promocionó.

---

# REPLAY_EXPLICIT_CASH_FLOWS_V1 — PASS / CONSUMIDO / ARCHIVADO

Documento de cierre:

`docs/replay_explicit_cash_flows_v1_outcome.md`

Resultado local: **2026-09-09**.

Estado:

`PASS_EXPLICIT_CASH_FLOW_INTEGRATION`

## Causalidad / contabilidad

- `accountingAndCausalChecksPass: true`;
- 64 activos escaneados;
- 60 REAL aceptados;
- 4 rechazados;
- synthetic leak: 0;
- `OPEN_*` histórico: 0;
- brazo cerrado: 0 aportaciones implícitas;
- closed vs explicit LEGACY idénticos antes del primer flujo;
- aportaciones externas no cuentan como rentabilidad;
- benchmark cash con acumulador independiente;
- benchmark estructural bajo flujos: N/D.

## Hallazgo de capital

Agregado 10y / 6y / 3y:

- gates con capital desplegable closed: **3**;
- gates con capital desplegable explicit LEGACY: **22**;
- gates con plan de contribución closed: **3**;
- gates con plan explicit LEGACY: **12**;
- delta de notional ejecutado explicit vs closed: **+212.386,21 EUR**;
- funding reach: **3/3 ventanas**.

Conclusión:

**la falta de capital nuevo era un cuello de botella real del reach económico del allocator.**

## QUALITY con capital explícito

Con los mismos flujos externos en LEGACY y QUALITY:

- planes de allocation cambiados: **10**;
- fechas de adquisiciones ejecutadas distintas: **23**;
- delta absoluto de notional ejecutado: **1.969,94 EUR**.

QUALITY sí puede alcanzar ejecución cuando existe capital accionable.

Economía observada, sólo diagnóstica porque las ventanas están consumidas:

- 10y: +40,93 EUR; +0,0310 pp retorno ajustado; DD igual;
- 6y: -0,82 EUR; -0,0010 pp; DD prácticamente igual;
- 3y: +4,74 EUR; +0,0099 pp; DD +0,0055 pp mejor.

No permite promoción ni retuning.

Producción continúa LEGACY.

---

# FASE ACTUAL — QUALITY_ALLOCATION_FUTURE_FORWARD_V1

Documento preregistrado:

`docs/quality_allocation_future_forward_v1_preregistration.md`

Código de protocolo:

`src/investment/decision/qualityAllocationFutureForwardV1.ts`

Runner:

`scripts/qualityAllocationFutureForwardV1CheckpointLive.ts`

Guard:

`tests/qualityAllocationFutureForwardV1.unit.ts`

Job CURRENT del `ResearchValidationCenter`:

**QUALITY allocation · future-forward V1**

ID:

`quality-allocation-future-forward-v1`

## Congelación

- fecha de preregistro: **2026-09-09**;
- primera fecha elegible de outcome: **2026-09-10**;
- HEAD previo al preregistro: `479b1a1efa2576caf2be11790d9fc9a6cd2fb10c`;
- control/productivo: `LEGACY`;
- candidato shadow: `QUALITY_ALLOCATION_BRIDGE_V1`;
- arquitectura: `CORE_ARCHITECTURE_V1`;
- QUALITY no se retunea;
- Forward Risk no entra en esta hipótesis.

## Universo prospectivo congelado

Se congeló una copia independiente de los **64 activos** que constituían `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` el 2026-09-09.

No entran después de la congelación:

- nuevos `OPEN_*`;
- `EUR_VALIDATION_HOLDOUT_UNIVERSE`;
- nuevas altas del catálogo productivo.

Esto impide alterar retrospectivamente la muestra por cambios futuros del catálogo.

Las barras anteriores al 2026-09-10 son sólo warmup causal de features. No cuentan como outcome Phase A.

## Continuidad prospectiva inmutable

Estado runtime local:

`.runtime/quality-allocation-future-forward-v1-state.json`

`.runtime/` está ignorado por Git. Este mecanismo no utiliza GitHub Actions, agentes ni auto-commits.

El baseline debe crearse antes de que existan datos REAL posteriores a la primera fecha elegible. Si el baseline falta una vez empezados los outcomes, la fase se invalida y no se permite reconstrucción retrospectiva.

El estado conserva:

- SHA-256 del protocolo congelado;
- SHA-256 del universo congelado;
- última fecha de datos bloqueada;
- hash del prefijo LEGACY ya observado;
- hash del prefijo QUALITY ya observado.

Cada checkpoint posterior debe reproducir exactamente el prefijo ya visto. Si cambia una decisión, plan o ejecución que ya era observable hasta la fecha cerrada, el runner no sobreescribe el lock y devuelve:

`PHASE_A_INVALIDATED_FORWARD_HISTORY_DRIFT_KEEP_LEGACY`

Una señal del último día puede ejecutarse después vía NEXT_OPEN sin provocar falso drift: sólo se congelan hechos de ejecución que ya eran observables en la fecha bloqueada.

Otros estados de integridad:

- protocolo/universo cambiado: `PHASE_A_INVALIDATED_FROZEN_CONTRACT_DRIFT_KEEP_LEGACY`;
- baseline ausente después de comenzar outcomes: `PHASE_A_INVALIDATED_MISSING_FORWARD_BASELINE_KEEP_LEGACY`.

En cualquier invalidación producción sigue LEGACY y no se permite tuning/promoción.

## Configuración congelada

- frecuencia: MONTHLY;
- capital inicial: 13.000 EUR;
- riesgo: MEDIUM;
- horizonte: 3 años;
- cash: histórico BCE;
- fiscalidad existente;
- minimumBars: 252;
- current Yahoo discovery: OFF.

Fixture de reach:

**1.000 EUR/mes research-only**, igual en LEGACY y QUALITY.

No es default de producción ni supuesto sobre el ahorro real del usuario.

`MONTHLY` sigue siendo sólo frecuencia de decisión.

## Madurez Phase A

No existe interpretación económica antes de:

**252 sesiones forward**.

Hasta entonces:

`ACCUMULATING_FUTURE_DATA`

Los deltas económicos previos pueden almacenarse como telemetría, pero no usarse para PASS/FAIL ni para tuning.

## Gate de reach congelado

A partir de 252 sesiones deben cumplirse simultáneamente:

- >= 3 gates con plan de allocation distinto;
- >= 8 fechas con adquisiciones ejecutadas distintas;
- >= 1.000 EUR de diferencia absoluta de notional ejecutado.

Si no:

`PHASE_A_INCONCLUSIVE_INSUFFICIENT_REACH_KEEP_LEGACY`

No se retunea.

## Gate económico congelado

Sólo si reach pasa:

- delta de retorno ajustado QUALITY - LEGACY >= **+0,50 pp**;
- delta de valor final > **0 EUR**;
- max drawdown de QUALITY no puede empeorar más de **1,0 pp**.

FAIL:

`PHASE_A_FAIL_KEEP_LEGACY`

PASS de Phase A:

`PHASE_A_CANDIDATE_FOR_CONFIRMATION`

Importante:

**Phase A no puede promocionar QUALITY directamente.** Un PASS sólo permitiría diseñar una segunda confirmación fresh separada y congelada.

Producción permanece LEGACY durante toda la fase.

---

# Forward Risk — VALOR V8 RETENIDO / V9-V11 RETIRADAS

Principio permanente:

**calidad de señal != calidad de política económica**.

V8 sí anticipó una parte importante de futuras caídas y su información debe conservarse.

Los FAIL de V8/V9/V10/V11 corresponden a políticas de monetización probadas, no a ausencia de información predictiva.

- V8 ON/OFF diario: no reutilizar directamente;
- V9: retirada;
- V10: retirada;
- V11: retirada;
- no crear V12/V13 como tuning retrospectivo.

Posibles usos futuros de V5/V7/V8 requieren protocolo separado. No se mezclan con `QUALITY_ALLOCATION_FUTURE_FORWARD_V1`.

---

# Centro de validación

Pantalla:

`ResearchValidationCenter`

Backend:

`/api/alerts/research-validation/*`

Único job ejecutable vigente:

`quality-allocation-future-forward-v1`

Todos los diagnósticos anteriores están `ARCHIVED` y son read-only; sus comandos largos ya no forman parte de los jobs ejecutables.

Orden del job vigente:

1. guard protocolo future-forward + continuidad inmutable;
2. guard QUALITY bridge congelado;
3. guard contabilidad de flujos;
4. guard replay dinámico existente;
5. guard PortfolioCandidateGate;
6. `npm run lint` / `tsc --noEmit`;
7. sólo después: checkpoint REAL future-forward.

Nunca usar Gemini, agentes ni GitHub Actions para esta ejecución.

---

# Próxima secuencia

1. Sincronizar la app con HEAD actual.
2. Ejecutar localmente **QUALITY allocation · future-forward V1** desde `ResearchValidationCenter` antes de que existan outcomes posteriores al 2026-09-10, para crear el baseline prospectivo de continuidad.
3. El resultado inicial esperado es `ACCUMULATING_FUTURE_DATA`; eso no es FAIL.
4. Conservar `.runtime/quality-allocation-future-forward-v1-state.json` entre actualizaciones de la app; no borrarlo mientras Phase A esté activa.
5. En checkpoints posteriores, exigir continuidad del prefijo histórico antes de añadir nueva evidencia.
6. No cambiar parámetros ni universo mientras acumula evidencia.
7. No interpretar económicamente antes de 252 sesiones forward.
8. Producción permanece LEGACY.
9. Mantener `CORE_ELIGIBILITY_V2` shadow.
10. Mantener pendiente instrument master point-in-time para eliminar survivorship histórico residual.
