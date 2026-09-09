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
- Discovery/ranking sólo produce candidatos; no autoriza compras.
- Gates, cash hurdle, consenso, timing y allocation conservan autoridad.
- “No comprar nada” es una salida válida.
- En validaciones prospectivas se congelan las **reglas** de discovery/ranking/selección, no las identidades futuras de los activos.
- En cada fecha prospectiva deben registrarse los candidatos realmente descubiertos y la shortlist resultante; los snapshots ya observados no pueden reescribirse.
- Yahoo current/live discovery nunca se usa para reconstruir retrospectivamente un universo histórico.
- Para replay histórico dinámico completo sigue faltando instrument master point-in-time con altas/bajas/delistings.

Esta invariante es parte de la arquitectura de producto, no una hipótesis de research.

---

# Reglas no negociables

- Nunca usar GitHub Actions para replays o validaciones largas.
- Los cálculos pesados los ejecuta el motor local/backend de la app, normalmente desde `ResearchValidationCenter` cuando exista un job integrado.
- REAL / STATIC_REFERENCE / SYNTHETIC siempre explícito; sin fallback sintético silencioso.
- Replay causal: sólo información disponible hasta la fecha; ejecución posterior a señal; `NEXT_OPEN` cuando corresponda; sin lookahead.
- No recalibrar thresholds, coeficientes ni políticas sobre muestras consumidas.
- No crear motores paralelos: scanner, gates, decisión, allocation, replay y seguimiento comparten arquitectura.
- No crear pantallas nuevas cuando la capacidad cabe en los flujos existentes.
- `MONTHLY/WEEKLY/DAILY/QUARTERLY` controlan frecuencia de decisión, nunca crean dinero.
- `stagedCapitalPlan` es capital ya disponible para desplegar; no es una aportación recurrente.
- Aportaciones/retiradas se modelan mediante `externalCashFlows` explícitos y fechados.
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
- replay causal / `NEXT_OPEN` donde corresponde;
- modos `Desde cero / manual / cartera actual` y `Motor Custodia / mantener cartera` dentro del mismo replay;
- cash histórico BCE y fiscalidad integrados;
- Yahoo Search/Lookup current nunca reconstruye universo histórico.

---

# Selección dinámica de mercado — PIPELINE PASS / BREADTH TODAVÍA EN VALIDACIÓN

Documento del primer resultado live:

`docs/dynamic_market_top64_v1_outcome.md`

## Invariantes de código

`src/investment/decision/portfolioDiscoveryUniverse.ts`:

- `PRODUCT_MARKET_UNIVERSE_MODE = DYNAMIC_CURRENT_DISCOVERY`;
- `DYNAMIC_MARKET_SHORTLIST_TARGET = 64`;
- `FIXED_PRODUCT_UNIVERSE_FORBIDDEN = true`.

## Ranking y Top64

Versión de ranking productivo:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

Orden principal:

`0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Desempates:

1. Reliability;
2. Opportunity;
3. ticker.

Esto preserva el score productivo anterior y evita promocionar indirectamente `QUALITY_V1`.

En current/live canónico:

- los antiguos `maxSelected:8/10/12` no reducen la shortlist;
- el scanner usa target 64;
- no impone una exposición por categoría durante discovery;
- si existen menos de 64 válidos, usa sólo los válidos;
- `dynamicMarketShortlist.shortlistAssetIds` conserva los IDs originales de la shortlist.

En histórico/no-current se conserva el selector diversificado legacy previo, incluida su semántica por categoría. El Top64 current/live no reescribe replays pasados.

## Gate posterior

`PortfolioCandidateGate` consume la identidad original de la shortlist.

Un candidato aceptado por datos pero fuera del Top64 queda:

`OUTSIDE_DYNAMIC_MARKET_SHORTLIST`

Después continúan:

- cash hurdle;
- consenso;
- Entry Timing;
- ranking final LEGACY;
- diversificación/caps del gate;
- allocation.

Top64 = candidatos para evaluar, nunca autorización de compra.

---

# DYNAMIC_MARKET_TOP64_V1 — PRIMER LIVE: PIPELINE PASS / MARKET BREADTH INSUFFICIENT

Run recibido:

`dynamic-market-top64-v1-2026-09-09T15-03-07-126Z.zip`

El job terminó `PASSED` y emitió:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Ese literal se interpreta sólo como **PASS técnico de la cadena original**, no como cierre de amplitud de mercado.

## Resultado observado

Discovery:

- 24 familias de búsqueda;
- 2 fallos Yahoo 502: `EQ_FRANCE` y `EQ_DIVIDEND`;
- 24 raw candidates;
- sólo **3 candidatos EUR aceptados**;
- sólo **3 candidatos nuevos promovidos** al scanner;
- `scannerDiscoveryError = null`.

Los tres `OPEN_*` fueron:

- `XAD5.MI` — Xtrackers Physical Gold ETC (EUR);
- `XAD5.DE` — Xtrackers Physical Gold ETC (EUR);
- `SGLE.MI` — Invesco Physical Gold ETC EUR Hedged.

Los tres aportes nuevos efectivos estaban concentrados en oro. Por tanto el Search semántico no estaba enumerando un mercado suficientemente amplio.

Scanner:

- seed/fallback: 64;
- pool escaneado: 67;
- REAL aceptados: 63;
- rechazados: 4;
- shortlist: **63**;
- `OPEN_*` en shortlist: **3**;
- fingerprint: `d88b9691657ff2111f79a17f5cd493827f5ac8bf2e19d724c91a36da93256279`.

Que hubiera 63 y no 64 fue correcto: nunca rellenar con inválidos sólo para llegar al target.

PortfolioCandidateGate:

- policy: LEGACY;
- entries: 67;
- elegibles antes de diversificación final: 10;
- seleccionados después del gate: 8;
- aceptados fuera del Top64: 0;
- leak elegible fuera del Top64: **0**.

Conclusión:

- ranking: funcional;
- trazabilidad Top64: funcional;
- gates: funcional;
- no-leak: funcional;
- replay histórico: sin cambios;
- **cuello de botella actual: discovery breadth**.

Esta fase NO se archiva todavía.

---

# Discovery current/live — Yahoo Search + Lookup en la misma cadena

Tras el primer live, `/api/alerts/asset-discovery/open-universe` se amplió **sin crear un motor nuevo**.

La misma ruta combina ahora:

1. **Yahoo Search** estructural para discovery temático/categorial;
2. **Yahoo Lookup** para enumeración current/live más amplia de instrumentos.

Yahoo Lookup es sólo una fuente de candidatos del mismo `AssetUniverseScanner`; no tiene autoridad de decisión.

La enumeración prioriza listings EUR con sufijos operativos como:

- `.DE`;
- `.PA`;
- `.MC`;
- `.MI`;
- `.AS`;
- `.BR`;
- `.VI`;
- `.HE`;
- `.LS`;
- `.IR`.

Cada símbolo sigue necesitando inspección de Yahoo Chart y debe cumplir:

- moneda EUR;
- tipo ETF/EQUITY admitido;
- al menos 252 barras;
- procedencia REAL.

Search conserva categorías temáticas cuando identifica el mismo ticker; Lookup aporta amplitud de enumeración.

El seed de 64 continúa únicamente como fallback operativo ante fallo temporal del proveedor.

## Criterio de cierre endurecido

El primer PASS demostró que aceptar `>=1` candidato nuevo era demasiado débil para probar independencia del seed.

El runner live exige ahora:

- al menos **64 candidatos actuales válidos en discovery abierto**;
- al menos **64 candidatos no-seed promovidos** al scanner canónico.

Errores explícitos:

- `DYNAMIC_MARKET_DISCOVERY_BREADTH_INSUFFICIENT`;
- `DYNAMIC_MARKET_NOVEL_BREADTH_INSUFFICIENT`.

Este 64 no es un threshold de trading ni tuning económico. Es una condición arquitectónica: para afirmar que existe un Top64 dinámico independiente del bootstrap, el discovery debe poder aportar al menos una shortlist completa sin depender de los 64 nombres conocidos.

Limitación retenida:

Yahoo Search + Lookup sigue siendo discovery current/live amplio, no un instrument master mundial exhaustivo. La afirmación correcta sigue siendo:

**Top64 del pool current/live descubierto y compatible con el motor EUR.**

---

# OPEN_MARKET_DISCOVERY_V1 — INFRAESTRUCTURA

Estado histórico:

`CURRENT_LIVE_INTEGRATION_PASS / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED`

El PASS histórico demostró integración aditiva, REAL provenance y autoridad del gate.

El resultado del 2026-09-09 mostró que la amplitud basada sólo en Search era insuficiente y motivó la incorporación de Lookup dentro del mismo endpoint.

No usar los resultados current/live para inventar retrospectivamente el mercado disponible en fechas pasadas.

Sin instrument master point-in-time persiste la limitación de survivorship histórico.

---

# OPPORTUNITY / RANKING / ALLOCATION — ESTADO

Producción permanece `LEGACY`.

Histórico consumido:

- `QUALITY_V1`: mostró información pero reach/economía insuficientes para promoción;
- `SLOPE_V1`: no justificó promoción;
- `QUALITY_ALLOCATION_BRIDGE_V1`: integrado research-only dentro de `PortfolioDecisionEngine`;
- su fórmula permanece congelada y no se retunea sobre ventanas consumidas.

Hallazgo anterior:

el problema no estaba sólo en ordenar candidatos; con capital cerrado el allocator casi nunca tenía dinero nuevo que repartir.

El Top64 dinámico no promociona QUALITY. Reliability/Opportunity son sólo evidencia/desempate de shortlist; el orden principal mantiene el score scanner productivo.

---

# REPLAY_EXPLICIT_CASH_FLOWS_V1 — PASS / CONSUMIDO / ARCHIVADO

Documento:

`docs/replay_explicit_cash_flows_v1_outcome.md`

Resultado:

`PASS_EXPLICIT_CASH_FLOW_INTEGRATION`

Comprobado:

- causalidad/contabilidad de flujos: PASS;
- `MONTHLY` no crea aportaciones;
- brazo cerrado: 0 aportaciones implícitas;
- closed vs explicit LEGACY idénticos antes del primer flujo;
- externalCashFlows no cuentan como rentabilidad;
- benchmark cash independiente;
- REAL-only, sin synthetic leak ni `OPEN_*` retrospectivos.

Reach agregado 10y/6y/3y:

- gates con capital desplegable: **3 -> 22**;
- delta de notional ejecutado explicit vs closed: **+212.386,21 EUR**;
- funding reach: **3/3 ventanas**.

QUALITY con el mismo capital explícito:

- planes de allocation cambiados: **10**;
- fechas de adquisiciones ejecutadas distintas: **23**;
- diferencia absoluta de notional ejecutado: **1.969,94 EUR**.

Conclusión:

QUALITY sí alcanza ejecución cuando existe capital accionable, pero el efecto económico observado en ventanas consumidas fue pequeño y no permite promoción ni retuning.

Producción continúa LEGACY.

---

# QUALITY_ALLOCATION_FUTURE_FORWARD_V1 — VOID PRE-START

Documento histórico:

`docs/quality_allocation_future_forward_v1_preregistration.md`

Estado:

**ANULADO ANTES DE PRIMER OUTCOME / NO CONSUME MUESTRA**

Motivo:

el primer diseño congelaba nominalmente los 64 activos del catálogo y confundía shortlist dinámica con universo fijo.

Consecuencias:

- no se ejecuta;
- no genera evidencia;
- no consume muestra future-forward;
- job ARCHIVED/read-only;
- cualquier nuevo future-forward debe congelar reglas de discovery/ranking y snapshots observados, no nombres futuros.

No crear nuevo protocolo QUALITY prospectivo hasta cerrar la cobertura current/live dinámica.

---

# Forward Risk — V8 PREDICTIVO RETENIDO / V9-V11 RETIRADAS

Principio permanente:

**calidad de señal != calidad de política económica**.

V8 sí mostró capacidad de anticipar parte importante de futuras caídas.

Los FAIL económicos posteriores no anulan ese valor predictivo; fallaron políticas para monetizarlo.

- V8 no volverá a usarse como ON/OFF diario directo sin nueva justificación;
- V9 retirada;
- V10 retirada;
- V11 retirada;
- no V12/V13 como tuning retrospectivo;
- V5/V7/V8 pueden estudiarse como contexto/riesgo/ranking/stress bajo protocolos nuevos y separados.

---

# Cash, fiscalidad y benchmarks

- cash histórico: facilidad de depósito BCE con suelo nominal 0% cuando se selecciona ese modo;
- remuneración y fiscalidad integradas causalmente;
- benchmark cash con contabilidad independiente;
- no doble conteo de intereses/impuestos;
- aportaciones externas no son rentabilidad;
- con flujos externos usar métricas ajustadas por flujos;
- benchmark incapaz de recibir los mismos flujos de forma comparable => N/D.

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

Se mantiene CURRENT porque el primer run sólo cerró pipeline, no breadth.

Orden:

1. guard `dynamicMarketShortlist.unit`;
2. guard integración discovery live;
3. guard `CORE_ARCHITECTURE_V1`;
4. guard `PortfolioCandidateGate`;
5. `npm run lint` / `tsc --noEmit`;
6. validación REAL `scripts/dynamicMarketTop64Live.ts`.

El nuevo runner comprueba además:

- discovery Search + Lookup ejecutado;
- al menos 64 candidatos open válidos;
- al menos 64 candidatos no-seed promovidos;
- shortlist <=64 y tamaño correcto;
- REAL-only dentro de shortlist;
- identidad original del Top64 auditable;
- ningún candidato fuera del Top64 puede quedar ELIGIBLE;
- snapshot + hash SHA-256;
- replay histórico no se modifica.

Resultado final de cierre sólo si pasa el nuevo criterio:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Los diagnósticos anteriores permanecen ARCHIVED/read-only.

Nunca usar GitHub Actions ni agentes para esta validación.

---

# Próxima secuencia técnica

1. Sincronizar la app con el HEAD actual.
2. Ejecutar de nuevo localmente **Mercado dinámico · Top 64 current/live**.
3. Si falla un guard, corregir implementación antes del live.
4. Si falla por `DISCOVERY_BREADTH_INSUFFICIENT` o `NOVEL_BREADTH_INSUFFICIENT`, tratarlo como problema de cobertura/proveedor, no como señal para retunear ranking/gates.
5. Si pasa con >=64 candidatos nuevos, cerrar y archivar esta fase.
6. Producción continúa `LEGACY`; Top64 no cambia allocation policy.
7. Sólo después diseñar un nuevo future-forward QUALITY congelando reglas/snapshots, nunca nombres.
8. Mantener pendiente una fuente instrument-master point-in-time para survivorship histórico completo.