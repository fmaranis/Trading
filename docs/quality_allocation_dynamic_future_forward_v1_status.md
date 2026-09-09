# QUALITY_ALLOCATION_DYNAMIC_FUTURE_FORWARD_V1 — estado prospectivo

## 2026-09-09 · primer checkpoint válido

Estado: **COLLECTING / 1 DE 12 OBSERVACIONES / 0 OUTCOMES MADUROS / PRODUCCIÓN LEGACY**

Fuente autoritativa del snapshot:

- branch: `replay-results`
- path: `validation-runs/quality-allocation-dynamic-future-forward-v1-state.json`
- durable commit: `fbae24fd46c751a71e059bb4f99b2de73c784dae`
- remote blob: `4006754a0d627f0846ef6d21a340f7c2ea9c633f`
- state SHA-256: `f3fd8e4d7ce4825351a23908c460285431abb751851ed9034ac2ff903a7e2bec`

La observación fue creada el 2026-09-09 a las 23:37 Europe/Madrid, dentro de la ventana preregistrada del día 9, 22:30-24:00.

## Integridad

- `stateExistedBeforeRun = false`
- `observationRecordedThisRun = true`
- observation id: `QUALITY_FF_2026-09`
- protocol fingerprint: `1220601b4d5fead26b68c48a198c7a5bac2220898c99fef1171452653d8ac82b`
- implementation fingerprint: `ba1b286ac6920495b7b5d853b6ca78fb5e1de356fc5ab3d4fb56bc34e1e51bff`
- frozen implementation sources: 25
- observations immutable: PASS
- outcomes immutable: PASS
- duplicate month overwrite guard: PASS
- skipped month / no-backfill guard: PASS
- durable optimistic concurrency: PASS
- RAW next-open sizing rule: PASS
- adjusted total-return mark rule: PASS

## Mercado current/live observado

- discovery promoted assets: 99
- scanned: 163
- REAL accepted: 158
- rejected: 5
- dynamic shortlist: 64
- gate LEGACY eligible: 11
- gate selected: 11
- production policy: `LEGACY`
- ranking: `MARKET_SHORTLIST_LEGACY_SCORE_V1`

La observación no congela nombres futuros; sólo las reglas. El Top64 de los meses siguientes puede cambiar.

## Allocation probe

Research fixture independiente:

- capital: 13.000 EUR
- risk: MEDIUM
- horizon: 3 años
- cash benchmark: 2,5%
- cartera inicial vacía
- no es cartera privada del usuario
- no es una aportación mensual

LEGACY:

- recommended new investment: 1.728,4054 EUR
- residual planned cash: 11.271,5946 EUR
- contributions: 4

QUALITY_ALLOCATION_BRIDGE_V1:

- recommended new investment: 1.726,1896 EUR
- residual planned cash: 11.273,8104 EUR
- contributions: 4

`planChanged = true`

Absolute planned notional delta: **2,6887 EUR**.

EXV1.DE apareció en ambos brazos como:

- `HIGH_CONVICTION`
- `ENTRY_STRONG`
- suggested initial fraction: 50%
- amount: 650 EUR

QUALITY elevó su prioridad relativa, pero el sizing quedó limitado por los mismos caps productivos y no cambió su importe en este checkpoint.

## Interpretación permitida

Este Phase A es deliberadamente un **allocator probe**. El preregistro compara LEGACY frente a QUALITY dentro del mismo `PortfolioDecisionEngine`; no pretende validar por sí solo la política end-to-end de `CORE_ARCHITECTURE_V1` y no puede promocionar producción.

No hay todavía ningún resultado económico: los horizons 20/60 sesiones siguen pendientes de madurez. No se concluye que QUALITY gane o pierda.

La siguiente observación nueva sólo puede abrirse el **2026-10-09 entre 22:30 y 24:00 Europe/Madrid**. Antes de esa fecha los reruns sólo pueden verificar estado o resolver outcomes ya maduros; nunca sustituir septiembre.
