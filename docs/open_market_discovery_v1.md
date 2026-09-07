# OPEN_MARKET_DISCOVERY_V1 + CORE_ELIGIBILITY_V2

Estado: **IMPLEMENTED_FOR_LOCAL_VALIDATION / CORE_V2_SHADOW / NOT_YET_PRODUCTION_PROMOTED**  
Fecha: **2026-09-07**

## 1. Objetivo

Salir del catálogo fijo sin crear un segundo motor de inversión.

La arquitectura objetivo sigue siendo una sola cadena:

`current market discovery -> AssetUniverseScanner -> structural/core audit -> PortfolioCandidateGate -> InvestmentDecisionEngine / alerts / replay`

`OPEN_MARKET_DISCOVERY_V1` sólo amplía candidatos. No decide comprar.

`CORE_ELIGIBILITY_V2` sólo audita si un instrumento tiene estructura suficiente para ser considerado core. Durante esta fase funciona en `SHADOW_AUDIT_NOT_PRODUCTION_GATE`: no sustituye al gate ni al selector productivo.

## 2. Discovery actual

El endpoint server-side:

`GET /api/alerts/asset-discovery/open-universe`

realiza un barrido de familias estructurales Yahoo, no de una lista de tickers elegidos por rentabilidad:

- global/world/all-country;
- S&P 500 / USA;
- Europa amplia;
- emergentes;
- Japón;
- small cap;
- tecnología;
- salud;
- energía;
- aggregate bond EUR hedged;
- money market EUR;
- oro físico.

Reglas:

- sólo `ETF` y `EQUITY` en el barrido autónomo V1;
- sólo candidatos cuya divisa real reportada es EUR;
- al menos 252 barras en la inspección de cobertura;
- deduplicación por símbolo;
- caché server-side de seis horas;
- los datos de precios que después usa el motor se vuelven a cargar mediante `AssetUniverseScanner`, no desde el resultado de búsqueda;
- `AssetUniverseScanner` conserva autoridad REAL/provenance y `PortfolioCandidateGate` conserva autoridad de elegibilidad económica.

La búsqueda manual existente por nombre/ticker/ISIN permanece para el replay y no se sustituye.

## 3. Frontera histórica crítica

Yahoo Search es una fuente **CURRENT/LIVE**. No es un instrument master histórico point-in-time.

Por tanto:

- `historicalPointInTimeSafe = false` está fijado en V1;
- un replay histórico **no puede** llamar hoy a Yahoo Search y presentar ese resultado como el universo que existía años atrás;
- el replay existente sí trunca precios por fecha y exige barras mínimas, lo que impide usar un activo antes de disponer de historia suficiente;
- `filterCatalogByHistoricalAvailability` formaliza esta regla para catálogos conocidos;
- esto elimina pre-listing look-ahead, pero **no elimina por completo survivorship bias** del catálogo actual.

Para poder afirmar en el futuro “mercado abierto histórico completo” hará falta un instrument master point-in-time con altas y bajas/delistings. Hasta entonces cualquier replay ampliado debe declarar esa limitación.

## 4. CORE_ELIGIBILITY_V2 — shadow

No se considera automáticamente core todo lo que Yahoo encuentre.

Política estructural inicial, fijada antes del smoke REAL:

- divisa EUR;
- provenance REAL;
- scanner `ACCEPTED`;
- >=756 barras;
- categoría amplia: `GLOBAL_EQUITY`, `US_EQUITY`, `EUROPE_EQUITY`, `JAPAN_EQUITY` o `EMERGING_EQUITY`;
- acciones individuales `EQ_*`: nunca core;
- discovery `OPEN_*` / `DYNAMIC_*`: necesita evidencia explícita `BROAD`; sin metadata estructural -> `REVIEW_REQUIRED`;
- ETF/listado: cobertura de volumen positiva >=80% en últimas 60 barras y mediana de negociación diaria >=250.000 EUR;
- fondos con NAV REAL directo: no se rechazan por ausencia de volumen bursátil; la disponibilidad en broker sigue siendo un gate operativo separado.

El umbral de liquidez es un **criterio estructural shadow**, no un threshold de rentabilidad ni una regla promovida a producción. Se validará primero su comportamiento/cobertura.

## 5. Validación local preparada

Job visible en `ResearchValidationCenter`:

**Mercado abierto · V1 · discovery + core shadow**

Ejecuta:

1. `tests/openMarketDiscoveryV1.unit.ts`;
2. `tests/coreEligibilityV2.unit.ts`;
3. `tests/openMarketDiscoveryArchitecture.unit.ts`;
4. `tests/openMarketReplayDiscovery.unit.ts`;
5. `npm run lint` / `tsc --noEmit`;
6. `scripts/openMarketDiscoveryV1Live.ts`.

El smoke REAL ejecuta:

`Yahoo current discovery -> merge con catálogo productivo -> AssetUniverseScanner -> CORE_ELIGIBILITY_V2 shadow -> PortfolioCandidateGate`

No compra ni vende y no modifica cartera.

Resultado:

- `PASS`: la infraestructura current/live ha devuelto candidatos EUR únicos, al menos uno ha superado scanner con provenance REAL y toda la cadena se ha ejecutado coherentemente;
- `INCONCLUSIVE_EXTERNAL_DISCOVERY_COVERAGE`: Yahoo no ha aportado cobertura suficiente en esa ejecución;
- un error de guards/TypeScript es fallo técnico que debe corregirse antes de cualquier integración productiva.

Un `PASS` de este job **no demuestra rentabilidad** y no autoriza por sí solo a convertir CORE_ELIGIBILITY_V2 en gate productivo.

## 6. Secuencia tras PASS técnico

1. Registrar cobertura y anomalías del smoke REAL.
2. Integrar el snapshot current/live en la construcción de universo compartido de alertas y decisión de hoy, manteniendo fallback explícito al catálogo conocido si discovery externo no está disponible.
3. Mantener `CORE_ELIGIBILITY_V2` en shadow y comparar qué acepta/rechaza frente a los cores actuales.
4. Sólo después de comprobar que no degrada cobertura válida, promoverlo a pre-gate estructural compartido.
5. Para replay histórico abierto, conseguir o construir un catálogo point-in-time con altas/delistings; no usar Yahoo Search actual como sustituto.
6. Una vez ampliado el universo de forma causal, validar ranking/oportunidad sobre candidatos no seleccionados retrospectivamente.

## 7. Forward Risk preservado

Esta fase no elimina Forward Risk. Se mantiene como hallazgo reutilizable que V8 anticipó caídas con evidencia predictiva fuerte; simplemente no se usa como política de ejecución demostrada. Más adelante puede entrar como feature/telemetría en ranking, alertas o stress, siempre con validación separada.
