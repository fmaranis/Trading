# DYNAMIC_MARKET_TOP64_V1 — outcome live

Fecha: **2026-09-09**

Job: `dynamic-market-top64-v1`

## Estado actual

**PIPELINE PASS / MARKET BREADTH PASS / ECONOMIC-IDENTITY DEDUPE ADDED / FINAL RECHECK PENDING**

Producción continúa `LEGACY`. Este protocolo valida discovery/ranking/shortlist current-live; no promociona QUALITY ni cambia replay histórico.

## Run 1 — Search-only: pipeline PASS, breadth insuficiente

Archivo: `dynamic-market-top64-v1-2026-09-09T15-03-07-126Z.zip`

Resultado técnico: `PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`.

Observado:

- 24 familias Search;
- 24 raw candidates;
- 3 candidatos EUR aceptados;
- 3 candidatos nuevos promovidos;
- pool escaneado 67;
- REAL aceptados 63;
- shortlist 63;
- 3 `OPEN_*` en shortlist;
- gate: 10 elegibles, 8 seleccionados;
- leak fuera del Top64: 0.

Los tres candidatos nuevos efectivos estaban concentrados en oro. Conclusión: la tubería funcionaba, pero Yahoo Search semántico no enumeraba un mercado suficientemente amplio.

## Corrección de breadth

El mismo endpoint `/api/alerts/asset-discovery/open-universe` pasó a combinar:

1. Yahoo Search estructural;
2. Yahoo Lookup como enumeración current/live amplia de listings EUR.

No se creó un segundo motor. Ambos mecanismos alimentan el mismo `AssetUniverseScanner` y siguen sujetos a datos REAL, ranking, `PortfolioCandidateGate`, cash hurdle, consenso, timing y allocation.

El criterio de cierre se endureció a:

- >=64 candidatos actuales válidos en discovery abierto;
- >=64 candidatos no-seed promovidos al scanner.

Ese 64 es una condición arquitectónica de independencia respecto al bootstrap, no un threshold de trading.

## Run 2 — Search + Lookup: breadth PASS

Archivo recibido: `15c4cb14-9831-4dfd-b122-e26caab3eb9b.json`.

Resultado: `PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`.

Discovery:

- Search query count: **24**;
- Search failures: **0**;
- Lookup query count: **36**;
- Lookup fallback queries: **26**;
- Lookup failures: **1** (`LOOKUP_PREFIX_U -> YAHOO_LOOKUP_HTTP_502`);
- raw candidates: **177**;
- Search raw: **25**;
- Lookup raw: **166**;
- candidatos EUR aceptados: **112**;
- mecanismos aceptados: **3 Search + 109 Lookup**;
- tipos: **49 ETF + 63 EQUITY**;
- candidatos nuevos promovidos al scanner: **102**;
- scanner discovery error: `null`.

El fallo puntual del prefijo U no impidió cobertura suficiente y no justifica relajar ningún guard.

Scanner:

- seed/fallback: **64**;
- pool escaneado: **166**;
- REAL aceptados: **161**;
- rechazados: **5**;
- shortlist: **64/64**;
- `OPEN_*` dentro del Top64: **32**;
- fingerprint: `7196c7891ca09476a3d2eba47bb0c79b8d4e846196240235989edd7e9a588b02`.

PortfolioCandidateGate:

- policy: **LEGACY**;
- entries: **166**;
- elegibles antes de diversificación final: **10**;
- seleccionados tras gate: **9**;
- aceptados fuera del Top64: **97**;
- fuera del Top64 auditados: **97**;
- leak elegible fuera Top64: **0**.

Conclusión: la amplitud current/live ya demuestra independencia material del seed. El Top64 no está formado por una whitelist fija y el discovery abierto puede aportar más de una shortlist completa por sí mismo.

## Hallazgo de identidad económica en el snapshot

El snapshot del run 2 mostró que Yahoo puede devolver el mismo producto en distintas bolsas, por ejemplo:

- `VUSA.DE` y `VUSA.AS`;
- `XEON.DE` y `XEON.MI`;
- variantes de listing/nombre truncado del mismo iShares Core MSCI World.

Eso no invalida el PASS de breadth, pero sí es un defecto de producto si dos representaciones del mismo instrumento pueden ocupar dos plazas del Top64 o recibir doble allocation.

Se añadió deduplicación current/live antes del ranking por:

- ticker exacto;
- ISIN cuando existe;
- nombre de producto claramente idéntico/casi idéntico por truncado corto;
- misma raíz de ticker + prefijo de nombre compatible para cross-listings.

La regla evita falsos positivos obvios: `SAN.MC` Banco Santander y `SAN.PA` Sanofi siguen siendo instrumentos distintos aunque compartan raíz `SAN`.

El guard `dynamicMarketShortlist.unit` verifica estas invariantes de comportamiento.

## Qué queda validado

- mercado productivo = discovery current/live dinámico, no whitelist;
- breadth independiente del seed: PASS en run 2;
- datos REAL dentro del scanner;
- Top64 auditable y <=64;
- gate posterior conserva autoridad;
- ningún candidato exterior al Top64 puede reaparecer como elegible;
- producción continúa LEGACY;
- QUALITY permanece research-only;
- replay histórico permanece aislado de Yahoo current discovery;
- `no action` sigue siendo salida válida.

## Qué sigue limitado

Yahoo Search + Lookup es discovery amplio current/live, no un instrument master mundial exhaustivo.

La categoría de algunos listings de acciones descubiertos por Lookup puede ser genérica hasta disponer de metadata de issuer/sector más robusta. No se retunea ni se inventa esa metadata a partir de este snapshot.

Para replay histórico completo sigue faltando instrument master point-in-time con listings/delistings; persiste survivorship.

## Cierre pendiente

Como la deduplicación de identidad económica se añadió después del run 2, se requiere **una única reejecución final del mismo job** para comprobar guards, TypeScript y breadth con el código final.

Si vuelve a emitir `PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE` manteniendo >=64 candidatos no-seed, la fase puede archivarse sin más tuning.