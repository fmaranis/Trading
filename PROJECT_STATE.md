# Trading — Estado Canónico del Proyecto

> Repositorio canónico: `fmaranis/Trading/main`.
>
> Al retomar trabajo técnico: comprobar HEAD, leer este archivo y después consultar los documentos enlazados. Si un chat antiguo contradice el repo actual, manda el repo.

# INVARIANTE PRINCIPAL DE PRODUCTO — NO VOLVER A CONFUNDIR

Documento normativo:

`docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`

La app **NO** tiene como objetivo invertir dentro de una whitelist fija de 64 activos.

El objetivo central es:

> **buscar dinámicamente el mercado actual, identificar los activos más atractivos y fiables disponibles en ese momento, formar una shortlist dinámica de hasta 64 candidatos y decidir después si merece la pena entrar en alguno, cuánto asignar y por qué.**

Cadena conceptual:

`mercado actual`
`-> AssetUniverseScanner [current/live discovery + calidad de datos + ranking]`
`-> Top 64 dinámico`
`-> PortfolioCandidateGate`
`-> InvestmentDecisionEngine`
`-> PortfolioDecisionEngine/evaluatePortfolioDecision`
`-> ejecución/seguimiento`

Reglas permanentes:

- **64 = máximo/objetivo de shortlist dinámica, no 64 nombres permanentes.**
- La identidad de los candidatos puede cambiar en cada evaluación.
- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` es bootstrap/seed/fallback operativo; no es la definición conceptual del mercado.
- Discovery/ranking produce candidatos; **no autoriza compras**.
- Cash hurdle, consenso, timing, gates y allocation conservan autoridad.
- “No comprar nada” es una salida válida.
- En validaciones prospectivas se congelan **reglas**, no nombres futuros.
- Los snapshots prospectivos ya observados no pueden reescribirse.
- Yahoo current/live discovery nunca reconstruye retrospectivamente un universo histórico.
- Sin instrument master point-in-time con altas/bajas/delistings persiste la limitación de survivorship histórico.

Esta invariante es arquitectura de producto, no hipótesis de research.

---

# Reglas no negociables

- Nunca usar GitHub Actions para replays o validaciones largas.
- Los cálculos largos los ejecuta el motor local/backend de la app, normalmente desde `ResearchValidationCenter`.
- Guards/unit tests/TypeScript deben pasar antes del cálculo largo.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; `NEXT_OPEN` cuando corresponda; sin lookahead.
- No recalibrar thresholds, coeficientes ni políticas sobre muestras consumidas.
- No crear motores paralelos: scanner, gates, decisión, allocation, replay y seguimiento comparten arquitectura.
- `DAILY/WEEKLY/MONTHLY/QUARTERLY` controlan frecuencia de decisión; nunca crean dinero.
- `stagedCapitalPlan` = capital ya disponible para desplegar; no aportación recurrente.
- Aportaciones/retiradas = `externalCashFlows` explícitos y fechados.
- Ningún dato financiero privado del usuario se embebe en código público.

---

# Estado vigente — 2026-09-09

## Motor productivo

Arquitectura productiva cerrada:

`CORE_ARCHITECTURE_V1`

Cadena productiva:

`AssetUniverseScanner -> PortfolioCandidateGate -> InvestmentDecisionEngine -> PortfolioDecisionEngine/evaluatePortfolioDecision -> ejecución/seguimiento`

Producción mantiene:

- allocation de oportunidad: **LEGACY**;
- `CORE_ELIGIBILITY_V2`: shadow;
- Forward Risk: no modifica producción;
- replay causal / `NEXT_OPEN`;
- modos integrados `Desde cero / manual / cartera actual`;
- modos integrados `Motor Custodia / mantener cartera`;
- cash histórico BCE y fiscalidad causalmente integrados;
- Yahoo Search/Lookup current nunca reconstruye universo histórico.

---

# Selección dinámica de mercado — BREADTH PASS / TOP64 PASS / RECHECK FINAL DE GATE PENDIENTE

Documentos:

- `docs/dynamic_market_top64_v1_outcome.md` — primer live insuficiente de breadth.
- `docs/dynamic_market_top64_v1_final_outcome.md` — runs de cierre y corrección posterior.

## Invariantes de código

`src/investment/decision/portfolioDiscoveryUniverse.ts`:

- `PRODUCT_MARKET_UNIVERSE_MODE = DYNAMIC_CURRENT_DISCOVERY`;
- `DYNAMIC_MARKET_SHORTLIST_TARGET = 64`;
- `FIXED_PRODUCT_UNIVERSE_FORBIDDEN = true`.

## Discovery actual

Endpoint canónico:

`/api/alerts/asset-discovery/open-universe`

La misma cadena combina:

1. Yahoo Search estructural como complemento temático/categorial;
2. Yahoo Lookup para enumeración current/live más amplia de listings EUR.

Mercados/listings EUR operativos incluyen sufijos como:

`.DE`, `.PA`, `.MC`, `.MI`, `.AS`, `.BR`, `.VI`, `.HE`, `.LS`, `.IR`.

Cada candidato sigue necesitando:

- moneda EUR;
- tipo ETF/EQUITY admitido;
- al menos 252 barras;
- procedencia REAL;
- datos suficientemente recientes.

El seed de 64 es sólo fallback/bootstrap ante degradación temporal del proveedor.

## Resultado live definitivo de breadth recibido

Archivo:

`d791ca51-7cdc-47dd-b071-81576792d407.json`

Job:

`dynamic-market-top64-v1`

Resultado:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Discovery:

- 24 familias Search;
- 36 consultas Lookup;
- 26 consultas fallback Lookup;
- 178 raw candidates;
- 112 candidatos EUR aceptados;
- 49 ETF;
- 63 EQUITY;
- 96 candidatos nuevos promovidos fuera del seed;
- `scannerDiscoveryError = null`.

Fallos parciales tolerados sin pérdida de breadth:

- `SMALL_CAP -> aborted`;
- `LOOKUP_PREFIX_M -> Yahoo 502`.

Scanner:

- seed/fallback: 64;
- pool escaneado: 160;
- REAL aceptados: 155;
- rechazados: 5;
- shortlist: **64**;
- `OPEN_*` en Top64: **29**;
- fingerprint: `e50aa8580459b50c032ad669e386dd1150a945d1406db869ae7f5853ed656c0f`.

PortfolioCandidateGate en ese run:

- policy: LEGACY;
- entries: 160;
- elegibles antes de diversificación final: 11;
- seleccionados: 9;
- aceptados fuera del Top64: 91;
- auditados fuera del Top64: 91;
- leak elegible fuera del Top64: **0**.

Conclusión:

**la cobertura actual ya demuestra independencia del seed.**

La afirmación válida es:

> **Top64 de los activos current/live EUR-compatible descubiertos y validados con datos REAL en esa evaluación.**

No se afirma que Yahoo sea un instrument master global exhaustivo.

---

# Identidad económica y diversificación current/live

El run de breadth reveló aliases/cross-listings del mismo producto, por ejemplo `VUSA.DE/VUSA.AS` y `XEON.DE/XEON.MI`.

Corrección aplicada:

- dedupe por ticker/ISIN cuando existe;
- coincidencia fuerte de nombre/producto;
- mismo root + prefijo de identidad cuando procede;
- guard específico evita fusionar activos distintos como Santander `SAN.MC` y Sanofi `SAN.PA`.

El run posterior al dedupe mantuvo Top64 completo y breadth suficiente.

## Corrección posterior al último run: acciones individuales

Yahoo Lookup clasifica muchas compañías individuales con la etiqueta amplia `EUROPE_EQUITY`.

El gate legacy histórico limitaba a 2 seleccionados por categoría. Aplicarlo literalmente a current/live haría que docenas de acciones diferentes compitiesen por sólo 2 plazas antes del allocator.

Corrección estructural implementada:

- el merge conserva transitoriamente el Yahoo `quoteType` de candidatos current/live;
- en current/live una **acción individual** usa bucket de diversificación por identidad de activo;
- ETF/fondos mantienen el cap de 2 por categoría en `PortfolioCandidateGate`;
- en histórico/research se conserva exactamente el comportamiento anterior;
- los caps monetarios posteriores de `PortfolioDecisionEngine` siguen limitando concentración por categoría/activo y número de posiciones.

No se ha cambiado ningún score, threshold económico ni política QUALITY para corregir este punto.

Guards añadidos:

- 3 acciones current/live de la misma categoría amplia pueden llegar al allocator si superan gates;
- 3 ETF de la misma categoría siguen limitados a 2;
- histórico conserva cap legacy previo.

Esta corrección necesita el último recheck integrado del job current antes de archivarlo.

---

# Ranking productivo Top64 — congelado durante esta fase

Versión:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

Score principal:

`0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Donde:

- `mom20` ≈ 1 mes;
- `mom60` ≈ 3 meses;
- `mom120` ≈ 6 meses;
- volatilidad: anualizada sobre 60 sesiones;
- maxDrawdown: sobre 252 sesiones;
- bonus defensivo: +2,5 cuando aplica.

Desempates:

1. Reliability;
2. Opportunity;
3. ticker.

**Reliability y Opportunity NO forman parte del score productivo principal del Top64; sólo desempatan.**

Eso significa que un activo de momentum extremo puede quedar arriba aunque su Reliability sea mediocre. El ejemplo observado de Verimatrix es diagnóstico, no autorización para retunear sobre esta misma muestra.

## Reliability

Diagnóstico causal absoluto 0..100:

- persistencia de ventanas 60 sesiones positivas: 45%;
- persistencia de ventanas 120 sesiones positivas: 25%;
- calidad de drawdown: 20%;
- calidad de volatilidad: 10%.

## Opportunity

Diagnóstico causal 0..100 que combina:

- Reliability: 30%;
- momentum120: 25%;
- momentum60: 15%;
- momentum20: 10%;
- aceleración: 10%;
- drawdown actual: 10%.

`QUALITY_V1` permanece research-only. No introducirlo en producción por la puerta trasera.

---

# Autoridad posterior al Top64

Top64 = candidatos para evaluar, nunca compra.

`PortfolioCandidateGate` exige después:

1. candidato dentro del Top64 auditable;
2. superar cash hurdle;
3. consenso `BUY`;
4. no structural downtrend;
5. Entry Timing distinto de `WAIT`;
6. ranking final LEGACY entre elegibles;
7. diversificación/caps;
8. allocator/PortfolioDecisionEngine decide capital y puede decidir no invertir.

Cash hurdle actual usa un proxy anualizado causal del momentum120:

`(1 + momentum120)^(252/120) - 1`

Es un proxy histórico anualizado para comparar con cash, no una previsión de rentabilidad futura anual.

Producción continúa `LEGACY`.

---

# Replay histórico — aislamiento obligatorio

Current Yahoo discovery no participa en replay histórico.

En histórico/no-current:

- se conserva selector diversificado legacy anterior;
- no se llama `/open-universe`;
- no se llama current Yahoo Search/Lookup para inventar el pasado;
- mínimo histórico por fecha sigue bloqueando pre-listing lookahead;
- survivorship no queda resuelto sin instrument master point-in-time.

---

# OPPORTUNITY / RANKING / ALLOCATION — historial metodológico

Producción permanece `LEGACY`.

Consumido:

- `QUALITY_V1`: mostró información pero reach/economía insuficientes para promoción;
- `SLOPE_V1`: no justificó promoción;
- `QUALITY_ALLOCATION_BRIDGE_V1`: integrado research-only dentro de `PortfolioDecisionEngine`;
- sus coeficientes y bounds permanecen congelados.

Fórmula bridge congelada:

`candidateQualityAdjustment = (reliability - 50)*0.10 + (opportunity - 50)*0.20`

`qualityMultiplier = clamp(1 + adjustment/100, 0.85, 1.15)`

No retunear sobre ventanas históricas ya observadas.

---

# REPLAY_EXPLICIT_CASH_FLOWS_V1 — PASS / CONSUMIDO / ARCHIVADO

Documento:

`docs/replay_explicit_cash_flows_v1_outcome.md`

Resultado:

`PASS_EXPLICIT_CASH_FLOW_INTEGRATION`

Comprobado:

- causalidad/contabilidad externalCashFlows: PASS;
- `MONTHLY` no crea aportaciones;
- brazo cerrado: 0 aportaciones implícitas;
- closed vs explicit LEGACY idénticos antes del primer flujo;
- aportaciones no cuentan como rentabilidad;
- benchmark cash independiente;
- REAL-only, sin synthetic leak ni `OPEN_*` retrospectivos.

Reach agregado 10y/6y/3y:

- gates con capital desplegable: **3 -> 22**;
- delta notional ejecutado explicit vs closed: **+212.386,21 EUR**;
- funding reach: **3/3 ventanas**.

QUALITY con mismo capital explícito:

- planes cambiados: 10;
- fechas ejecutadas distintas: 23;
- diferencia absoluta notional: 1.969,94 EUR.

Efecto económico pequeño en muestras consumidas; no permite promoción ni retuning.

---

# QUALITY_ALLOCATION_FUTURE_FORWARD_V1 — VOID PRE-START

Estado:

**ANULADO ANTES DE PRIMER OUTCOME / NO CONSUME MUESTRA**

Motivo:

el diseño inicial congelaba 64 nombres y confundía shortlist dinámica con universo fijo.

Consecuencias:

- no genera evidencia;
- no consume muestra;
- job archivado/read-only;
- cualquier nuevo future-forward debe congelar reglas de discovery/ranking y snapshots observados, nunca nombres futuros.

No crear nuevo future-forward QUALITY hasta archivar formalmente la integración Top64 current/live.

---

# Forward Risk — V8 predictivo retenido / V9-V11 retiradas

Principio permanente:

**calidad de señal != calidad de política económica**.

V8 mostró anticipación real de futuras caídas.

Los FAIL económicos V8/V9/V10/V11 no anulan ese valor predictivo; fallaron políticas de monetización.

- V8 no volverá a usarse como ON/OFF diario directo sin nueva justificación;
- V9 retirada;
- V10 retirada;
- V11 retirada;
- no crear V12/V13 como tuning retrospectivo;
- V5/V7/V8 pueden estudiarse como contexto/riesgo/ranking/stress bajo protocolos nuevos.

---

# Cash, fiscalidad y benchmarks

- cash histórico: facilidad de depósito BCE con suelo nominal 0% cuando se selecciona ese modo;
- remuneración y fiscalidad causalmente integradas;
- benchmark cash con contabilidad independiente;
- no doble conteo de intereses/impuestos;
- aportaciones externas no son rentabilidad;
- con externalCashFlows usar métricas ajustadas por flujos;
- benchmark incapaz de recibir los mismos flujos comparables => N/D.

---

# Centro de validación

Pantalla:

`ResearchValidationCenter`

Backend:

`/api/alerts/research-validation/*`

Único job CURRENT:

`dynamic-market-top64-v1`

Nombre:

**Mercado dinámico · Top 64 current/live**

Se mantiene CURRENT únicamente para revalidar la corrección downstream de diversificación de acciones.

Orden:

1. `dynamicMarketShortlist.unit`;
2. `openMarketLiveScannerIntegration.unit`;
3. `coreArchitectureV1.unit`;
4. `portfolioCandidateGate.unit`;
5. `npm run lint` / `tsc --noEmit`;
6. validación REAL `dynamicMarketTop64Live.ts`.

El job debe seguir comprobando:

- Search + Lookup current/live;
- >=64 candidatos open válidos;
- >=64 candidatos no-seed promovidos;
- Top64 REAL;
- dedupe económico;
- identidad original del Top64 auditable;
- 0 candidatos elegibles fuera del Top64;
- replay histórico intacto.

Nunca usar GitHub Actions ni agentes para esta validación.

---

# Próxima secuencia técnica

1. Sincronizar con HEAD actual.
2. Ejecutar **una última vez** `Mercado dinámico · Top 64 current/live`.
3. Si guards + TypeScript + live pasan, archivar `dynamic-market-top64-v1` como **PASS final**.
4. No volver a modificar discovery/Top64 salvo bug o cambio explícito de producto.
5. Producción continúa `LEGACY`.
6. Después diseñar el siguiente protocolo de selección/calidad de forma metodológicamente limpia, sin retunear la fórmula Top64 con los snapshots 2026-09-09 ya observados.
7. Mantener pendiente instrument master point-in-time para survivorship histórico completo.
