# DYNAMIC_MARKET_TOP64_V1 — CIERRE FINAL

Fecha de cierre: **2026-09-09**

Job: `dynamic-market-top64-v1`

## Estado final

**PASS FINAL / ARCHIVADO**

Resultado canónico:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Esta fase queda cerrada. No volver a modificar discovery/Top64 salvo bug demostrado o cambio explícito de producto.

Este documento complementa `docs/dynamic_market_top64_v1_outcome.md`, que conserva el primer run insuficiente como historial metodológico.

---

# Qué se pretendía demostrar

La aplicación no debe invertir dentro de una whitelist fija de 64 nombres.

La arquitectura productiva exige:

`mercado current/live`
`-> Yahoo Search + Lookup`
`-> AssetUniverseScanner`
`-> ranking reproducible`
`-> Top64 dinámico`
`-> PortfolioCandidateGate`
`-> InvestmentDecisionEngine`
`-> PortfolioDecisionEngine`
`-> ejecución/seguimiento`

Los 64 son una shortlist dinámica de candidatos, nunca 64 activos permanentes ni una autorización de compra.

---

# Secuencia de validación

## Run 1 — Search-only

Resultado técnico: `PASSED`.

Interpretación correcta:

**PIPELINE PASS / MARKET BREADTH INSUFFICIENT**.

Sólo aparecieron 3 candidatos nuevos y estaban concentrados en oro. El hallazgo se interpretó como problema de cobertura de discovery, no como señal para retunear ranking/gates.

Se amplió el mismo endpoint canónico con Yahoo Lookup; no se creó un segundo scanner ni otro motor.

## Run 2 — Search + Lookup

La cobertura superó el criterio endurecido:

- discovery EUR aceptado: **112**;
- nuevos promovidos fuera del seed: **102**;
- pool escaneado: **166**;
- REAL aceptados: **161**;
- Top64: **64**;
- `OPEN_*` dentro del Top64: **32**;
- leak elegible fuera del Top64: **0**.

El snapshot reveló aliases/cross-listings del mismo instrumento económico, por ejemplo `VUSA.DE/VUSA.AS` y `XEON.DE/XEON.MI`.

Se corrigió la identidad económica antes del ranking. Esta corrección no fue tuning económico.

## Run 3 — Search + Lookup + dedupe económico

Archivo:

`d791ca51-7cdc-47dd-b071-81576792d407.json`

Resultado:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Discovery:

- 112 candidatos EUR aceptados;
- 49 ETF;
- 63 EQUITY;
- 96 candidatos nuevos promovidos;
- `scannerDiscoveryError = null`.

Scanner:

- seed/fallback: 64;
- pool escaneado: 160;
- REAL aceptados: 155;
- Top64: 64;
- `OPEN_*` dentro del Top64: 29;
- fingerprint: `e50aa8580459b50c032ad669e386dd1150a945d1406db869ae7f5853ed656c0f`.

Gate:

- elegibles: 11;
- seleccionados: 9;
- leak elegible fuera del Top64: 0.

Ese run confirmó breadth + dedupe, pero reveló un defecto downstream de clasificación: Yahoo Lookup etiqueta muchas acciones individuales como `EUROPE_EQUITY`, y el cap histórico de máximo 2 por categoría podía reducir artificialmente docenas de compañías a sólo dos plazas antes del allocator.

Corrección estructural aplicada:

- current/live: acción individual usa bucket de diversificación por identidad de activo;
- ETF/fondos conservan máximo 2 por categoría en `PortfolioCandidateGate`;
- histórico/research conserva exactamente la semántica legacy anterior;
- `PortfolioDecisionEngine` conserva caps monetarios por activo/categoría y número de posiciones;
- no se modificó score, cash hurdle, timing, consenso ni QUALITY.

## Run 4 — cierre integrado tras corrección de acciones

Archivo recibido:

`33648dc8-6a96-4eb9-b7b0-64e3f64c27d6.json`

Job:

`Mercado dinámico · Top 64 current/live`

Estado:

`PASSED`

Resultado:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

### Discovery

- Search queries: **24**;
- Search failures: **0**;
- Lookup queries: **36**;
- Lookup fallback queries: **26**;
- Lookup failures: **0**;
- raw candidates: **180**;
- Search raw: **37**;
- Lookup raw: **168**;
- EUR aceptados: **113**;
- ETF: **50**;
- EQUITY: **63**;
- promovidos fuera del seed: **98**;
- `scannerDiscoveryError = null`.

El criterio arquitectónico de independencia del seed era >=64 candidatos actuales no-seed. Resultado: **98**.

### Scanner

- seed/fallback: **64**;
- pool escaneado: **162**;
- REAL aceptados: **157**;
- rechazados: **5**;
- Top64: **64**;
- `OPEN_*` dentro del Top64: **29**;
- ranking: `MARKET_SHORTLIST_LEGACY_SCORE_V1`;
- fingerprint: `e50aa8580459b50c032ad669e386dd1150a945d1406db869ae7f5853ed656c0f`.

### PortfolioCandidateGate

- policy: **LEGACY**;
- entries: **162**;
- elegibles antes de diversificación final: **11**;
- seleccionados después del gate: **11**;
- aceptados fuera del Top64: **93**;
- auditados fuera del Top64: **93**;
- leak elegible fuera del Top64: **0**.

La transición **11 elegibles -> 11 seleccionados** confirma que las acciones individuales ya no quedan truncadas artificialmente por compartir la etiqueta amplia `EUROPE_EQUITY`.

### Arquitectura

El propio resultado confirmó:

- una sola cadena productiva;
- `noParallelEngine = true`;
- replay histórico no modificado;
- `noActionRemainsValid = true`;
- producción continúa `LEGACY`;
- Top64 no autoriza compras.

---

# Qué queda demostrado y cerrado

1. El seed de 64 es bootstrap/fallback, no universo productivo fijo.
2. Yahoo Search + Lookup aporta por sí mismo más de una shortlist completa de candidatos EUR current/live.
3. Los candidatos deben tener datos REAL y cumplir los requisitos de calidad/antigüedad vigentes.
4. El scanner construye un Top64 dinámico reproducible.
5. Los aliases/cross-listings económicos evidentes se deduplican antes de competir por plazas.
6. Ningún candidato fuera del Top64 puede reaparecer como elegible downstream.
7. Las acciones individuales current/live no quedan artificialmente limitadas por una categoría geográfica genérica.
8. ETF/fondos conservan los caps categoriales legacy del gate.
9. El allocator conserva sus caps monetarios y autoridad económica.
10. `QUALITY_V1` sigue research-only y no ha sido promocionado indirectamente.
11. Replay histórico permanece aislado de Yahoo current discovery.
12. “No comprar nada” sigue siendo una salida válida.

---

# Ranking productivo congelado en esta fase

Versión:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

Fórmula:

`score = 0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Reliability y Opportunity permanecen como desempates del Top64 productivo. Los snapshots observados el 2026-09-09 no pueden usarse para retunear retrospectivamente esta fórmula.

---

# Limitaciones retenidas

Yahoo Search + Lookup es discovery current/live amplio, pero:

- no es un instrument master global exhaustivo;
- no es point-in-time histórico;
- no resuelve survivorship en replay;
- esta fase sólo valida el universo compatible con el motor EUR actual.

La afirmación correcta es:

> **Top64 de los activos current/live EUR-compatible descubiertos y validados con datos REAL en esa evaluación.**

Nunca utilizar este discovery actual para reconstruir retrospectivamente el universo disponible en fechas históricas.

---

# Decisión de cierre

`dynamic-market-top64-v1` pasa a **ARCHIVED / read-only** en `ResearchValidationCenter`.

No se requieren más repeticiones de este job para cerrar esta fase.

Cualquier mejora futura del universo, monedas, señales o ranking deberá abrirse como trabajo nuevo después de completar la secuencia vigente del proyecto, sin reabrir este PASS salvo bug objetivo.