# Asset Universe Scanner

Estado: **current/live dinámico**.

Documento normativo relacionado:

`docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`

## Objetivo

`AssetUniverseScanner` no selecciona inversiones dentro de una lista fija.

En current/live su función es:

`seed/fallback operativo + discovery abierto actual -> datos REAL -> ranking -> Top 64 dinámico`

Ese Top 64 se entrega a `PortfolioCandidateGate`. El scanner **no autoriza compras**.

## Universo y discovery

`EUR_PORTFOLIO_DISCOVERY_UNIVERSE` es seed/bootstrap/fallback, no whitelist productiva.

Cuando la evaluación usa el universo canónico y `endDate` está a <= 7 días de hoy, el scanner intenta `OPEN_MARKET_DISCOVERY_V1` mediante:

`/api/alerts/asset-discovery/open-universe`

La búsqueda current/live usa familias estructurales para ETF/ETC y acciones. Actualmente pueden promocionarse automáticamente:

- ETF EUR;
- acciones/listings EUR;

con >= 252 barras inspeccionadas.

El merge es aditivo: un fallo temporal de discovery no borra el seed validado.

Yahoo Search no es un instrument master exhaustivo. Por ello Top64 significa **Top64 del pool current/live descubierto y compatible con el motor EUR**, no “los 64 mejores valores de todo el planeta” como afirmación de cobertura completa.

## Fuente de datos

### Instrumentos listados

Proveedor primario: Yahoo Finance mediante `/api/market-data/history`.

El scanner usa `adjusted:false` para conservar `Close` ajustado por splits pero evitar que dividendos futuros reescriban retrospectivamente prefixes anteriores.

### Fondos directos del catálogo

Los fondos con `marketDataProvider: EODHD_FUND` usan NAV directo por ISIN, no proxy ETF.

### Procedencia

- `REAL` obligatorio para candidatos aceptados;
- sin fallback sintético silencioso;
- dataset fingerprint cuando corresponde.

## Rechazos previos al ranking

Un candidato se rechaza si, entre otros:

- la carga falla;
- proveedor reporta divisa distinta de EUR;
- hay menos de `minimumBars`;
- no existe histórico válido;
- el último dato supera `maxDataAgeDays`.

Los descartes conservan motivo explícito.

## Métricas por activo

El scanner calcula causalmente con el prefix disponible:

- momentum 20 sesiones;
- momentum 60 sesiones;
- momentum 120 sesiones;
- volatilidad anualizada;
- max drawdown;
- `reliabilityScore`;
- `opportunityScore`;
- drawdown actual;
- persistencia de retornos rolling 60/120.

## Ranking current/live

Versión:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

Score principal:

`score = 0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

`defensiveBonus = 2.5` cuando el instrumento seed/discovered está marcado defensivo.

Desempates deterministas:

1. mayor `reliabilityScore`;
2. mayor `opportunityScore`;
3. ticker ascendente.

La prioridad principal continúa siendo el score scanner ya productivo. Esto evita convertir `QUALITY_V1` en producción sin una promoción metodológica válida.

## Top 64 dinámico

Constante canónica:

`DYNAMIC_MARKET_SHORTLIST_TARGET = 64`

En current/live canónico:

- se consideran todos los candidatos REAL aceptados del pool expandido;
- se ordenan por el ranking anterior;
- se conservan hasta 64;
- si hay menos de 64 válidos, se conservan únicamente esos;
- no se impone una sola posición por categoría en esta fase;
- no se rellena con candidatos rechazados.

La diversificación no pertenece al discovery: se aplica después en `PortfolioCandidateGate` / allocator.

Los antiguos `maxSelected: 8/10/12` no reducen la shortlist current/live. Se conservan únicamente para scans no-current/históricos/research y así no se modifica silenciosamente el replay histórico.

## Auditoría de shortlist

El resultado current/live contiene:

`dynamicMarketShortlist`

con:

- `mode: DYNAMIC_CURRENT_DISCOVERY`;
- `rankingVersion`;
- target 64;
- tamaño del pool escaneado;
- tamaño del pool aceptado;
- tamaño de shortlist;
- `shortlistAssetIds` exactos.

Los IDs originales quedan guardados porque después del gate `scan.selected` pasa a significar la selección operativa final.

## Relación con PortfolioCandidateGate

Si `dynamicMarketShortlist.applied === true`, `PortfolioCandidateGate` sólo permite que los `shortlistAssetIds` del Top64 entren en:

- cash hurdle;
- consenso;
- Entry Timing;
- ranking final;
- allocation.

Un activo aceptado por datos pero fuera del Top64 recibe:

`OUTSIDE_DYNAMIC_MARKET_SHORTLIST`

Esto impide que un candidato excluido reaparezca después por accidente.

El gate puede reducir posteriormente la shortlist a un número menor por elegibilidad, timing, diversificación/caps o falta de oportunidad.

`NO COMPRAR NADA` sigue siendo un resultado correcto.

## Replay histórico

El Top64 current/live **no usa Yahoo Search retrospectivamente**.

Para fechas históricas el scanner conserva la semántica previa de catálogo conocido + barras causales. La reconstrucción completa de “mercado disponible en cada fecha” sigue limitada por la ausencia de instrument master point-in-time con listings/delistings.

## Validación

Guard funcional:

`tests/dynamicMarketShortlist.unit.ts`

Guard de integración:

`tests/openMarketLiveScannerIntegration.unit.ts`

Runner REAL:

`scripts/dynamicMarketTop64Live.ts`

Job `ResearchValidationCenter`:

`dynamic-market-top64-v1`

Resultado esperado si toda la cadena pasa:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`
