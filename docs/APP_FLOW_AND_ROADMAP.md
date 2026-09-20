# APP TRADING — FLUJO MAESTRO Y ROADMAP DE CIERRE

Estado: **CANÓNICO PARA ORGANIZACIÓN DEL TRABAJO**  
Actualizado: **2026-09-20**  
Repositorio: `fmaranis/Trading`  
Rama: `main`

Este documento organiza el producto y la secuencia de cierre. La fuente técnica inmediata sigue siendo `main` + `PROJECT_STATE.md`.

---

# 1. Objetivo final

La app debe responder de forma integrada:

- qué hacer hoy;
- qué activo;
- qué importe;
- por qué;
- cómo está la cartera;
- qué oportunidades existen;
- qué riesgo existe;
- cómo ejecutar considerando cash, broker, títulos enteros, costes y fiscalidad;
- cómo registrar y seguir la operación;
- cómo habría actuado históricamente la misma arquitectura de forma causal.

No debe convertirse en una colección de motores o recomendaciones paralelas.

---

# 2. Arquitectura productiva cerrada

```text
mercado actual REAL
-> AssetUniverseScanner
-> Top64 dinámico
-> PortfolioCandidateGate
-> InvestmentDecisionEngine
-> PortfolioDecisionEngine / evaluatePortfolioDecision
-> CORE_GATE_V1
-> CORE_ARCHITECTURE_V1
-> buildPortfolioExecutionPlan
-> applyTaxAwareExecutionOverlay
-> COMPRAR / VENDER / TRASPASAR / REVIEW / NO HACER NADA
-> ejecución manual
-> registro
-> seguimiento
```

Invariantes:

- allocation/opportunity productivo `LEGACY`;
- `CORE_ELIGIBILITY_V2` shadow;
- una sola `portfolioDecision` y un solo plan ejecutable;
- Forward Risk sin autoridad productiva;
- `NO HACER NADA` es decisión válida;
- research valida la cadena, no crea otra.

---

# 3. Replay y datos

Replay integrado:

```text
Desde cero / manual / cartera actual
-> Motor Custodia / mantener cartera
-> DAILY / WEEKLY / MONTHLY / QUARTERLY
-> información disponible hasta decisionDate
-> decisión causal
-> NEXT_OPEN cuando corresponde
-> BCE histórico + fiscalidad + externalCashFlows
-> métricas / JSON / auditoría
```

Reglas:

- frecuencia no crea dinero;
- `stagedCapitalPlan` no es aportación recurrente;
- aportaciones/retiradas sólo mediante `externalCashFlows` fechados;
- `REAL / STATIC_REFERENCE / SYNTHETIC` explícito;
- cero fallback sintético silencioso;
- current Yahoo discovery no reconstruye el universo histórico;
- survivorship permanece hasta Fase 8.

---

# 4. ResearchValidationCenter

Punto normal para:

- guards;
- TypeScript;
- quick closure;
- validaciones de investigación;
- replays integrados;
- Future Forward.

No usar GitHub Actions para cálculos largos.

Los trabajos consumidos pasan a `ARCHIVED / READ_ONLY` y no se relanzan como si fueran fresh.

---

# 5. Ruta de cierre

| Fase | Estado | Siguiente condición |
|---|---|---|
| F0 mapa/estado | DONE | mantener docs coherentes |
| F1 base productiva | DONE | sólo bugs/regresiones |
| F2 usuarios/seguridad/autonomía | DONE | sólo bugs/regresiones |
| F3 protocolo económico | DONE / FROZEN | gobierna F4–F6 |
| F4 reentrada | CLOSED / INCONCLUSIVE REACH | no R4 reactivo |
| F5 protección ganadores | CLOSED / CONFIRMATION FAIL | no promoción/retune |
| **F6 Forward Risk contexto** | **STAGE A FROZEN + SEALED PRE-OPEN / NOT OPENED** | **static seal/readiness PASS antes de habilitar collector REAL** |
| F7 QUALITY future-forward | WAITING/COLLECTING | maduración calendario |
| F8 universo PIT histórico | ARCHITECTURE IMPLEMENTED / DATA COVERAGE PENDING | poblar master histórico REAL/STATIC_REFERENCE |
| F9 auditoría end-to-end | PENDING | cerrar carriles previos |
| F10 expansiones V2 | DEFERRED | después de V1 |

---

# 6. Fase 4 — cierre

`EXIT_PROCEEDS_CUSTODY_V1` quedó research-only.

R2/R3 consumidas. R3 obtuvo coverage REAL válido pero 0 EXIT reserves / 0 reentries, por lo que terminó:

`INCONCLUSIVE_INSUFFICIENT_REENTRY_REACH`.

No se fuerza R4 ni se retunea sobre esas muestras.

---

# 7. Fase 5 — cierre

`TREND_PROTECTION_V2_WINNER_ONLY`:

- primer blind 2001–2003: PASS candidate for confirmation;
- confirmación 2005–2007: `CONFIRMATION_FAIL_NO_PROMOTION`;
- 63 reducciones y reach 6/6 en confirmación, pero sólo 2/6 cohortes mejoraron riqueza terminal;
- max drawdown mediano mejoró, demostrando que señal/política de protección no son la misma pregunta;
- exact policy retirada para promoción;
- no V3 paramétrica;
- producción `LEGACY`.

---

# 8. Fase 6 — Forward Risk V8 como contexto

## 8.1 Principio

V8 conserva valor predictivo retenido. V9/V10/V11 fallaron como políticas económicas y siguen retiradas.

Fase 6 no crea V12/V13 ni reinstala un ON/OFF diario.

Stage A pregunta:

> ¿V8 aporta información incremental sobre downside futuro dentro del contexto que ya atraviesa `PortfolioCandidateGate`?

## 8.2 Feature shadow

`FORWARD_RISK_CONTEXT_V1`:

```text
contextScore = max(V5 vulnerability, V7 options stress)
highRisk = contextScore >= 80
```

Ambas ramas son obligatorias. Missing/invalid => `UNAVAILABLE`.

Autoridad:

- eligibility: no;
- ranking: no;
- sizing: no;
- existing holdings: no;
- sell/reduce: no;
- production: no.

## 8.3 Stage A future-forward

Ventana congelada:

`2026-09-16 -> 2027-03-31`

Warm-up:

`2022-01-03`

Activos exactos:

`EUNL, SXR8, EXSA, IS3N, IUSN, QDVE, VVSM, XDWH, EXH1, ISPA`.

Población primaria:

`PortfolioCandidateGate ELIGIBLE + context AVAILABLE`.

Outcome:

- NEXT_OPEN posterior a `informationDate`;
- 63 sesiones;
- máximo peak-to-trough drawdown;
- downside material >=5%.

Reach mínimo:

- 200 evaluables ELIGIBLE;
- 30 high-risk;
- 100 normal;
- high-risk en 4 activos;
- high-risk en 6 semanas;
- ningún activo >35% del high-risk reach.

PASS predictivo exige simultáneamente:

- event-rate lift >=10 pp;
- risk ratio >=1,5;
- severity lift mediana >=1 pp.

PASS sólo autoriza diseñar Stage B; no promociona producción y Stage A no puede validar económicamente esa futura policy.

## 8.4 Continuidad prospectiva congelada pre-open

Modo:

`DETERMINISTIC_POST_FREEZE_CAUSAL_CATCH_UP`.

Motivo: una validación DAILY no debe depender de que el applet permanezca encendido cada sesión.

Reglas:

- ningún backfill anterior al 16/09/2026;
- todas las sesiones completadas posteriores al freeze se registran una vez;
- missing sessions se procesan oldest-first;
- prohibido escoger/omitir fechas por outcome;
- candidate prefix termina en `informationDate`;
- V5/V7 cortan en `informationDate`;
- la sesión sucesora EUNL sólo prueba cierre de la anterior;
- collector no lee outcomes;
- 5 fechas por ejecución = batching, no selección;
- observaciones durables inmutables.

## 8.5 Persistencia y seal

Estado durable futuro:

`replay-results/validation-runs/phase6-forward-risk-context-stage-a-state.json`.

Antes de la primera lectura de mercado el collector debe escribir durablemente:

`sampleState = OPENED_COLLECTING`.

Seal pre-open:

`validation-runs/preregistration/phase6-forward-risk-context-stage-a-seal.json`.

Guard:

`tests/phase6ForwardRiskContextStageASeal.unit.ts`.

El seal fingerprinta 20 archivos críticos y comprueba además:

- apertura durable antes del primer market scan;
- causalidad por `informationDate`;
- ausencia de evaluator/outcomes dentro del collector;
- `currentOpenDiscovery=false`;
- hash-chain/inmutabilidad;
- evaluator puro;
- producción `LEGACY`;
- collector live todavía no cableado.

## 8.6 Estado exacto y siguiente acción

Estado:

**FROZEN / SEALED FOR STATIC VALIDATION / NOT OPENED / NO MARKET OUTCOMES OPENED.**

El job visible sigue siendo:

`Fase 6 · Forward Risk V8 como contexto · readiness`.

Su test principal importa primero el seal guard. Por tanto la siguiente ejecución estática debe mostrar:

1. `PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_SEAL_PASS`;
2. `PHASE6_FORWARD_RISK_CONTEXT_STAGE_A_FREEZE_PASS`;
3. arquitectura/gate/paridad/superficie PASS;
4. TypeScript PASS.

Ese job **no ejecuta** `scripts/phase6ForwardRiskContextStageACollectorLive.ts` y no consume Stage A.

Sólo después de ese PASS se hará un cambio posterior para habilitar el collector REAL con `GITHUB_REPLAY_SYNC_TOKEN`.

---

# 9. Fase 7 — QUALITY Future Forward

Continúa en paralelo bajo su protocolo prospectivo propio.

No usar outcomes de F7 para retunear F6 ni viceversa.

Producción de allocation sigue `LEGACY`.

---

# 10. Fase 8 — histórico point-in-time

Arquitectura implementada:

`HISTORICAL_INSTRUMENT_MASTER_V1`

integrada opcionalmente en `CausalUniverseBacktestEngine`.

El contrato cubre:

- altas/listings;
- bajas/delistings;
- cambios de ticker/mercado mediante alias con intervalos;
- identidad económica estable;
- existencia verificada por fecha;
- horizonte máximo de evidencia;
- autoridad/fuente y procedencia `STATIC_REFERENCE`;
- cobertura declarada `CURRENT_REFERENCE_ONLY / PARTIAL_POINT_IN_TIME / COMPLETE_POINT_IN_TIME`.

Regla dura:

> una lista actual o la mera existencia de barras antiguas no demuestra pertenencia al universo histórico de una fecha.

El catálogo actual sólo puede convertirse a `CURRENT_REFERENCE_ONLY` y el replay causal rechaza ese estado si se intenta usar como instrument master PIT.

Con master parcial, el replay usa sólo identidades verificadas y conserva la etiqueta de cobertura parcial. Sólo un master `COMPLETE_POINT_IN_TIME` permite una afirmación de cobertura completa del universo objetivo.

Guard estructural:

`tests/historicalInstrumentMaster.unit.ts`

Job:

`Fase 8 · universo histórico PIT · cierre estructural`

Documento:

`docs/PHASE8_HISTORICAL_INSTRUMENT_MASTER_V1.md`.

Pendiente real de Fase 8: poblar el master con una fuente histórica suficientemente exhaustiva de listings/delistings/ticker history. Mientras falte, survivorship sigue explícito y no se usa Yahoo current discovery retrospectivamente.


---

# 11. Fase 9 — cierre V1

Auditoría final debe comprobar conjuntamente:

- cadena productiva única;
- usuarios/seguridad/persistencia;
- alertas coherentes con la misma cadena;
- replay causal;
- cash/costes/fiscalidad/flujos;
- evidencia F4/F5/F6;
- estado F7;
- limitaciones/PIT histórico;
- deuda V2 clasificada.

---

# 12. Prohibiciones de continuidad

No:

- reabrir muestras consumidas como fresh;
- retunear tras mirar outcomes;
- forzar eventos en F4;
- retunear F5 después de confirmación FAIL;
- convertir V8 en orden diaria ON/OFF;
- revivir V9/V10/V11 con otro nombre;
- crear V12/V13 paramétrica sobre esos resultados;
- ejecutar collector F6 antes de seal/readiness static PASS;
- leer outcomes F6 durante collection;
- utilizar current discovery para reconstrucción histórica;
- crear motores/recomendaciones productivas paralelas.
