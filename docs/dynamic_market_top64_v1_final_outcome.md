# DYNAMIC_MARKET_TOP64_V1 — resultado de cierre de breadth

Fecha: **2026-09-09**

Job: `dynamic-market-top64-v1`

## Estado

**DISCOVERY BREADTH PASS / TOP64 PASS / ECONOMIC-IDENTITY DEDUPE PASS / FINAL GATE-INTEGRATION RECHECK PENDING**

Este documento complementa `docs/dynamic_market_top64_v1_outcome.md`, que conserva el primer run insuficiente como historial metodológico.

## Secuencia de validación

### Run 1 — Search-only

Resultado técnico: `PASSED`.

Interpretación correcta: **PIPELINE PASS / MARKET BREADTH INSUFFICIENT**.

Sólo aparecieron 3 candidatos nuevos y los tres estaban concentrados en oro. Ese resultado consumió únicamente el diagnóstico de cobertura y llevó a ampliar el mismo endpoint con Yahoo Lookup. No se retuneó el ranking.

### Run 2 — Search + Lookup

La cobertura pasó ampliamente el criterio endurecido:

- discovery EUR aceptado: **112**;
- nuevos promovidos fuera del seed: **102**;
- pool escaneado: **166**;
- REAL aceptados: **161**;
- Top64: **64**;
- `OPEN_*` dentro del Top64: **32**;
- leak elegible fuera del Top64: **0**.

El snapshot reveló representaciones económicas duplicadas por listing, por ejemplo `VUSA.DE/VUSA.AS` y `XEON.DE/XEON.MI`. Eso no es señal económica ni tuning: es un problema de identidad de instrumento.

### Run 3 — Search + Lookup + dedupe económico

Archivo recibido: `d791ca51-7cdc-47dd-b071-81576792d407.json`

Resultado:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Discovery:

- query families: **24**;
- Search raw: **24**;
- Lookup raw: **167**;
- raw total deduplicado: **178**;
- candidatos EUR aceptados: **112**;
- Search aceptados: **3**;
- Lookup aceptados: **109**;
- ETF: **49**;
- EQUITY: **63**;
- candidatos nuevos promovidos al scanner: **96**;
- `scannerDiscoveryError = null`;
- un fallo Search aislado: `SMALL_CAP -> aborted`;
- un fallo Lookup aislado: `LOOKUP_PREFIX_M -> Yahoo 502`;
- pese a esos fallos parciales la cobertura supera holgadamente el criterio de independencia del seed.

Scanner:

- seed/fallback: **64**;
- pool escaneado: **160**;
- REAL aceptados: **155**;
- rechazados: **5**;
- shortlist: **64**;
- `OPEN_*` dentro del Top64: **29**;
- fingerprint: `e50aa8580459b50c032ad669e386dd1150a945d1406db869ae7f5853ed656c0f`.

PortfolioCandidateGate:

- policy: **LEGACY**;
- entries: **160**;
- elegibles antes de diversificación final: **11**;
- seleccionados: **9**;
- aceptados fuera del Top64: **91**;
- auditados fuera del Top64: **91**;
- leak elegible fuera del Top64: **0**.

## Qué queda demostrado

1. El seed de 64 ya no define el mercado.
2. Yahoo Search + Lookup puede aportar por sí mismo más de una shortlist completa de candidatos EUR actuales.
3. El Top64 se forma dinámicamente sobre datos REAL.
4. Ningún candidato fuera del Top64 puede reaparecer como elegible downstream.
5. El dedupe económico reduce aliases/cross-listings evidentes antes del ranking.
6. Producción continúa `LEGACY`.
7. `QUALITY_V1` no ha sido promocionado indirectamente.
8. Replay histórico permanece aislado de Yahoo current discovery.

## Hallazgo downstream posterior al run 3

Lookup clasifica muchas acciones individuales con la categoría amplia `EUROPE_EQUITY`.

El `PortfolioCandidateGate` histórico tenía una regla de máximo 2 seleccionados por categoría. Aplicada literalmente al mercado dinámico, esa regla convertiría una limitación de metadatos en un cuello artificial: docenas de compañías distintas competirían por sólo dos plazas antes de llegar al allocator.

Corrección estructural aplicada después del run 3:

- en **current/live** las acciones individuales usan un bucket de diversificación por identidad de activo;
- ETF/fondos mantienen el cap histórico de 2 por categoría en el gate;
- en **historical/research** se conserva exactamente el comportamiento anterior;
- los caps monetarios y de número de posiciones del `PortfolioDecisionEngine` siguen controlando concentración downstream;
- no se modifica el score de ranking ni ningún threshold económico.

Esta corrección necesita únicamente el recheck integrado de guards + TypeScript + mismo live job antes de archivar definitivamente `dynamic-market-top64-v1`.

## Ranking congelado durante esta fase

Top64 productivo:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

`score = 0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Reliability/Opportunity siguen siendo sólo desempates del Top64 productivo. El hecho de que activos de momentum extremo aparezcan arriba se considera evidencia diagnóstica; no se retunea esta fórmula usando los snapshots ya observados.

## Limitación retenida

Yahoo Search + Lookup es un discovery current/live amplio, pero no un instrument master global exhaustivo ni point-in-time.

La afirmación válida es:

> **Top64 de los activos actuales EUR-compatible que el sistema ha descubierto y validado con datos REAL en esa evaluación.**

No utilizar este discovery actual para reconstruir retrospectivamente el universo histórico.
