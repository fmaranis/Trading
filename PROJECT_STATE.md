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
- Yahoo Search current nunca reconstruye universo histórico.

## Selección dinámica de mercado — IMPLEMENTADA EN CÓDIGO / VALIDACIÓN REAL PENDIENTE

La deuda arquitectónica principal ha sido implementada dentro de la misma cadena productiva.

### Invariantes de código

`src/investment/decision/portfolioDiscoveryUniverse.ts`:

- `PRODUCT_MARKET_UNIVERSE_MODE = DYNAMIC_CURRENT_DISCOVERY`;
- `DYNAMIC_MARKET_SHORTLIST_TARGET = 64`;
- `FIXED_PRODUCT_UNIVERSE_FORBIDDEN = true`.

### Discovery current/live

`OPEN_MARKET_DISCOVERY_V1` sigue integrado en `AssetUniverseScanner` y ahora el sweep estructural incluye:

- ETF/ETC amplios, sectoriales y defensivos;
- acciones/listings EUR de mercados europeos;
- familias de tecnología, semiconductores, salud, energía y dividendo;
- búsqueda de listings EUR de grandes compañías US cuando Yahoo los exponga.

Promoción automática current/live admitida:

- `ETF` EUR;
- `EQUITY` EUR;
- >= 252 barras inspeccionadas;
- `historicalPointInTimeSafe: false` explícito.

El seed conocido continúa como fallback si Yahoo discovery falla temporalmente.

### Ranking y Top64

Versión de ranking productivo:

`MARKET_SHORTLIST_LEGACY_SCORE_V1`

El orden principal conserva el score scanner productivo existente:

`0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

Desempates:

1. Reliability;
2. Opportunity;
3. ticker.

Esto evita promocionar indirectamente `QUALITY_V1` como política productiva.

En current/live canónico:

- los antiguos `maxSelected:8/10/12` ya no reducen la shortlist;
- el scanner usa target 64;
- no impone una exposición por categoría en discovery;
- si existen menos de 64 válidos, utiliza sólo los válidos;
- `dynamicMarketShortlist.shortlistAssetIds` conserva los IDs exactos del Top64 original.

### Gate posterior

`PortfolioCandidateGate` consume los IDs originales del Top64.

Un candidato REAL aceptado por el scanner pero fuera de Top64 recibe:

`OUTSIDE_DYNAMIC_MARKET_SHORTLIST`

Después continúan sin cambios:

- cash hurdle;
- consenso;
- Entry Timing;
- ranking final LEGACY;
- diversificación/caps del gate;
- allocation.

Por tanto Top64 = **candidatos para evaluar**, no compras.

### Límite de cobertura declarado

Yahoo Search es discovery amplio current/live, pero no un instrument master exhaustivo mundial.

La afirmación correcta es:

**Top64 del pool current/live descubierto y compatible con el motor EUR.**

La arquitectura permite ampliar/cambiar el proveedor de discovery sin crear otro motor.

---

# OPEN_MARKET_DISCOVERY_V1 — INFRAESTRUCTURA PASS / AMPLITUD ACTUALIZADA

Estado histórico de infraestructura:

`CURRENT_LIVE_INTEGRATION_PASS / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED`

El PASS previo demostró integración aditiva y gates. Desde 2026-09-09 la amplitud de discovery se ha extendido a `ETF + EQUITY` EUR y se usa para construir la shortlist Top64 current/live.

La nueva amplitud/Top64 debe validarse con el job vigente `dynamic-market-top64-v1` antes de marcar esta fase como PASS final.

Limitación retenida: sin instrument master point-in-time no existe reconstrucción histórica abierta completa.

---

# OPPORTUNITY / RANKING / ALLOCATION — ESTADO

Producción permanece `LEGACY`.

Histórico consumido:

- `QUALITY_V1`: mostró información pero reach/economía insuficientes para promoción;
- `SLOPE_V1`: no justificó promoción;
- `QUALITY_ALLOCATION_BRIDGE_V1`: integrado research-only dentro de `PortfolioDecisionEngine`;
- su fórmula permanece congelada y no se retunea sobre las ventanas ya vistas.

Hallazgo importante:

el problema no estaba sólo en ordenar candidatos; con capital cerrado el allocator casi nunca tenía dinero nuevo que repartir.

El nuevo Top64 dinámico **no promociona QUALITY**. Reliability/Opportunity son sólo evidencia/desempate de shortlist; el orden principal mantiene el score scanner productivo.

---

# REPLAY_EXPLICIT_CASH_FLOWS_V1 — PASS / CONSUMIDO / ARCHIVADO

Documento:

`docs/replay_explicit_cash_flows_v1_outcome.md`

Resultado 2026-09-09:

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

QUALITY sí alcanza ejecución cuando existe capital accionable, pero el efecto económico observado en esas ventanas consumidas fue pequeño y no permite promoción ni retuning.

Producción continúa LEGACY.

---

# QUALITY_ALLOCATION_FUTURE_FORWARD_V1 — VOID PRE-START

Documento histórico:

`docs/quality_allocation_future_forward_v1_preregistration.md`

Estado:

**ANULADO ANTES DE PRIMER OUTCOME / NO CONSUME MUESTRA**

Motivo:

el primer diseño congelaba nominalmente los 64 activos del catálogo y por tanto confundía una shortlist dinámica con un universo fijo.

Eso contradice `CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE`.

Consecuencias:

- no se ejecuta;
- no genera evidencia;
- no consume muestra future-forward;
- el job está `ARCHIVED` y read-only;
- el código ejecutable específico de ese diseño fijo fue retirado;
- cualquier nuevo future-forward debe congelar reglas de discovery/ranking y snapshots observados, no nombres futuros.

No crear otro protocolo QUALITY prospectivo hasta cerrar en PASS la validación live del Top64 dinámico.

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

Orden:

1. guard `dynamicMarketShortlist.unit`;
2. guard integración discovery live;
3. guard `CORE_ARCHITECTURE_V1`;
4. guard `PortfolioCandidateGate`;
5. `npm run lint` / `tsc --noEmit`;
6. validación REAL `scripts/dynamicMarketTop64Live.ts`.

El runner comprueba:

- discovery actual ejecutado;
- pool current/live;
- shortlist <=64 y tamaño correcto;
- REAL-only dentro de shortlist;
- identidad original del Top64 auditable;
- ningún candidato fuera del Top64 puede quedar ELIGIBLE;
- snapshot + hash SHA-256;
- replay histórico no se modifica.

Resultado esperado si pasa:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`

Todos los diagnósticos anteriores permanecen `ARCHIVED` / read-only.

Nunca usar GitHub Actions ni agentes para esta validación.

---

# Próxima secuencia técnica

1. Sincronizar app con HEAD actual.
2. Ejecutar localmente **Mercado dinámico · Top 64 current/live** desde `ResearchValidationCenter`.
3. Si falla un guard, corregir implementación antes de ejecutar el live.
4. Si el resultado REAL es `PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`, cerrar esta fase como PASS y archivar el job.
5. Producción continúa `LEGACY`; Top64 no cambia allocation policy.
6. Sólo después diseñar el nuevo future-forward QUALITY congelando reglas/snapshots, nunca nombres.
7. Mantener pendiente una fuente instrument-master más exhaustiva para mejorar cobertura current/live y resolver survivorship histórico point-in-time cuando sea posible.
