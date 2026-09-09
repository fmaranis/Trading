# DYNAMIC_MARKET_TOP64_V1 — primer resultado live

Fecha del run: **2026-09-09**

Job: `dynamic-market-top64-v1`

Archivo recibido: `dynamic-market-top64-v1-2026-09-09T15-03-07-126Z.zip`

## Estado metodológico

**PIPELINE PASS / MARKET BREADTH INSUFFICIENT / NO CIERRE DE FASE**

El job terminó técnicamente con:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Ese PASS confirma la cadena de ejecución y sus guards, pero el resultado observado demuestra que la amplitud real del discovery vigente era todavía insuficiente para considerar cerrada la arquitectura de mercado dinámico.

No se interpreta como FAIL de ranking, gate o allocation. El cuello de botella observado es **discovery breadth**.

## Resultado observado

### Discovery

- query families: **24**;
- query failures: **2**;
  - `EQ_FRANCE -> YAHOO_SEARCH_HTTP_502`;
  - `EQ_DIVIDEND -> YAHOO_SEARCH_HTTP_502`;
- raw candidates: **24**;
- candidatos EUR aceptados por discovery: **3**;
- candidatos nuevos promovidos al scanner canónico: **3**;
- error del scanner discovery: `null`;
- tipos reportados: **2 ETF + 1 EQUITY**.

Los tres candidatos `OPEN_*` que llegaron a la shortlist fueron:

1. `XAD5.MI` — Xtrackers Physical Gold ETC (EUR);
2. `XAD5.DE` — Xtrackers Physical Gold ETC (EUR);
3. `SGLE.MI` — Invesco Physical Gold ETC EUR Hedged.

Por tanto, aunque el mecanismo aceptó técnicamente ETF y EQUITY, la aportación nueva efectiva quedó concentrada en tres exposiciones de oro. Esto no representa un discovery suficientemente amplio del mercado actual.

### Scanner / Top64

- seed/fallback conocido: **64**;
- pool escaneado: **67**;
- candidatos REAL aceptados: **63**;
- rechazados: **4**;
- shortlist final del scanner: **63**;
- candidatos nuevos `OPEN_*` dentro de shortlist: **3**;
- ranking: `MARKET_SHORTLIST_LEGACY_SCORE_V1`;
- fingerprint snapshot: `d88b9691657ff2111f79a17f5cd493827f5ac8bf2e19d724c91a36da93256279`.

Que la shortlist tenga 63 y no 64 es correcto: el scanner no rellena con candidatos inválidos sólo para alcanzar el objetivo.

### PortfolioCandidateGate

- policy: **LEGACY**;
- entries auditadas: **67**;
- elegibles antes de diversificación final: **10**;
- seleccionados tras gate: **8**;
- aceptados fuera de Top64: **0**;
- leak de elegibles fuera del Top64: **0**.

Esto confirma que la autoridad económica posterior funciona y que ningún candidato exterior a la shortlist puede reaparecer después.

## Qué queda validado

1. Top64 significa shortlist dinámica y no whitelist fija.
2. La cadena current/live está integrada en `AssetUniverseScanner`.
3. La shortlist conserva identidad auditable.
4. Los datos seleccionados son REAL.
5. `PortfolioCandidateGate` conserva autoridad.
6. Producción continúa `LEGACY`.
7. El replay histórico no fue modificado.
8. `no action` sigue siendo una salida válida.

## Qué NO queda validado

No queda demostrado que el discovery abierto pueda encontrar por sí mismo un conjunto suficientemente amplio para que la selección de mercado sea independiente del seed de 64 nombres.

Con sólo **3 candidatos nuevos**, el Top64 observado seguía dependiendo casi por completo del bootstrap conocido.

Por tanto este run **no autoriza archivar la fase de selección dinámica como cerrada**.

## Corrección posterior al resultado

Se mantiene el mismo endpoint y la misma arquitectura. No se crea ningún motor paralelo.

`/api/alerts/asset-discovery/open-universe` se amplía para combinar:

- Yahoo Search estructural, como complemento temático;
- Yahoo Lookup current/live, como mecanismo de enumeración amplia de listings EUR primarios.

El criterio de cierre de la validación se endurece:

- el discovery abierto debe devolver al menos **64 candidatos actuales válidos**;
- el scanner debe promover al menos **64 candidatos no-seed**;
- sólo entonces puede emitirse el PASS final de breadth.

Este umbral no es un threshold económico ni un parámetro de estrategia. Es una condición arquitectónica de independencia respecto al bootstrap, derivada directamente del objetivo de producto `Top64 dinámico`.

## Siguiente paso

Sincronizar el nuevo HEAD y volver a ejecutar el mismo job:

**Mercado dinámico · Top 64 current/live**

No diseñar todavía un nuevo future-forward QUALITY. Primero debe cerrarse esta cobertura current/live.