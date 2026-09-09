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
- Gates, cash hurdle, timing y allocation conservan autoridad.
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

## Deuda arquitectónica actual de selección de mercado

El objetivo final ya está fijado en `CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE`, pero la implementación actual todavía no lo completa:

- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` contiene una base operativa de 64 instrumentos;
- `OPEN_MARKET_DISCOVERY_V1` puede añadir candidatos current/live;
- el scanner actual limita `selected` a un máximo de **10**;
- el automatic discovery V1 promociona automáticamente sólo ETF EUR aunque la ruta pueda inspeccionar también equities;
- por tanto todavía **no existe un verdadero Top 64 dinámico de mercado amplio**.

Siguiente trabajo arquitectónico: cerrar esta diferencia sin crear un segundo motor.

---

# OPEN_MARKET_DISCOVERY_V1 — PASS DE INFRAESTRUCTURA CURRENT/LIVE

Estado:

`CURRENT_LIVE_INTEGRATION_PASS / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED`

El discovery current/live está integrado en `AssetUniverseScanner` de forma aditiva.

La validación consumida demostró que candidatos descubiertos pueden entrar al scanner con datos REAL y seguir sujetos a `PortfolioCandidateGate`.

Este PASS valida infraestructura, no demuestra que la amplitud actual de discovery sea suficiente para el objetivo Top 64 dinámico.

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

No crear otro protocolo QUALITY prospectivo hasta que la selección dinámica de mercado esté correctamente integrada y auditable.

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

Estado actual:

- diagnósticos consumidos: `ARCHIVED` / read-only;
- `quality-allocation-future-forward-v1`: `ARCHIVED / VOID PRE-START`;
- no debe existir por ahora un job largo CURRENT de QUALITY con universo fijo.

El siguiente job CURRENT deberá aparecer sólo cuando esté implementada y guardada la arquitectura de shortlist dinámica de mercado.

---

# Próxima secuencia técnica

1. Mantener producción `LEGACY`.
2. Implementar dentro de `AssetUniverseScanner`/flujo existente la selección **Top 64 dinámica**, sin whitelist productiva.
3. Definir y congelar explícitamente las reglas de discovery/ranking que producen esa shortlist.
4. Ampliar current/live discovery hasta una cobertura de mercado suficientemente amplia y auditable; no confundir el seed de 64 con el mercado.
5. Registrar para cada evaluación: pool descubierto, rechazos, scores, ranking y shortlist final.
6. Mantener `PortfolioCandidateGate`, timing y allocation como filtros posteriores; Top 64 no implica compra.
7. Añadir guards que impidan volver a convertir los 64 nombres actuales en universo productivo fijo.
8. Sólo después preregistrar una validación future-forward QUALITY sobre **reglas dinámicas congeladas**.
9. Para replay histórico completo de selección dinámica, mantener pendiente instrument master point-in-time.

---

# Regla de continuidad para chats futuros

Antes de proponer cambios en discovery, ranking, opportunity o allocation:

1. leer `PROJECT_STATE.md`;
2. leer `docs/CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE.md`;
3. comprobar el HEAD real de `main`;
4. no inferir que “64 activos” significa universo fijo;
5. recordar que el objetivo de producto es **mercado dinámico -> Top 64 dinámico -> decidir si alguno merece capital**.
