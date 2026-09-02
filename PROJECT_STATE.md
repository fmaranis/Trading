# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto desde otra conversación, equipo o dispositivo. Repositorio canónico: `fmaranis/Trading`. El detalle histórico anterior permanece en Git.

## Reglas de trabajo no negociables

- Nunca añadir ni depender de GitHub Actions. Validaciones en local/AI Studio.
- ChatGPT inspecciona y modifica GitHub directamente cuando sea posible.
- AI Studio se usa para ejecución/Preview/validación; no delegar arquitectura ni correcciones amplias en Gemini salvo petición expresa.
- No usar datos sintéticos como fallback silencioso. Procedencia REAL / STATIC_REFERENCE / SYNTHETIC siempre explícita.
- Replay causal: sólo información disponible hasta la fecha evaluada; ejecución posterior a señal; ningún lookahead.
- Si el usuario dice “terminó”, revisar una sola vez el resultado disponible. No agentes de monitorización ni polling.
- Cada cambio de código/arquitectura debe actualizar este archivo.
- No promover cambios experimentales a `main` antes de validarlos.

---

# Estado vigente — 2026-09-02

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion.

Pregunta central: **¿Muevo dinero hoy o no?**

Salida objetivo: **ACCIÓN → IMPORTE → ACTIVO → POR QUÉ → DETALLE TÉCNICO**.

Arquitectura:
1. DÓNDE — ranking / calidad / consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER / BUILD / sizing.
4. CÓMO GESTIONAR — HOLD / ADD / WATCH / REDUCE / EXIT / ROTATE.

Máquina vigente: **CANDIDATE → STARTER → BUILD → CORE/HOLD → WATCH → ROTATE/REDUCE → EXIT**.

No usar take-profit fijo universal ni stop rígido universal.

---

# Cartera real de referencia

- Vanguard Global Stock Index Fund EUR Acc — `IE00B03HD191` — 12.600 € — adquisición 2026-08-11 — 196,59 participaciones — MyInvestor — traspasable.
- Vanguard Emerging Markets Stock Index Fund EUR Acc — `IE0031786696` — 1.400 € — adquisición 2026-08-12 — 4,61 participaciones — MyInvestor — traspasable.
- Capital pendiente: 13.000 €.
- Horizonte de despliegue: 12 meses.
- Cash hurdle: 2,5% anual salvo cambio explícito.

Constantes: `USER_REAL_FUND_POSITIONS`, `USER_REAL_STAGED_CAPITAL_PLAN`.

---

# Integridad causal y datos

- Yahoo listados usa `adjusted:false` para evitar reescritura retrospectiva del prefijo.
- Fondos usan NAV REAL directo por ISIN.
- Invariancia REAL short-vs-long confirmada para mismo prefijo temporal.
- No añadir total return salvo dividendos/distribuciones como eventos causales explícitos.
- REAL / STATIC_REFERENCE / SYNTHETIC visible siempre.

---

# Entry Timing y cartera dinámica

Estados: `WAIT / ENTRY_READY / ENTRY_STRONG`.

STARTER sobre patrimonio total:
- LOW: READY 2%, STRONG 3,5%.
- MEDIUM: READY 3%, STRONG 5%.
- HIGH: READY 4%, STRONG 7%.

BUILD máximo: LOW 6% / MEDIUM 8% / HIGH 12%.
Máximo posiciones: LOW 8 / MEDIUM 12 / HIGH 16.
Nuevas plazas por evaluación: LOW 1 / MEDIUM 2 / HIGH 3.

BUILD exige posición existente + ENTRY_STRONG + salud ADD + starter suficientemente construido. Sin compra fallback.

Rotación 1:1 estricta y atómica. Challenger debe ser ejecutable. Persistencia congelada: ENTRY_STRONG hoy + al menos 3 observaciones STRONG en las 10 sesiones anteriores + consenso/ranking suficientes.

---

# Estrés sistémico / core

Detector: al menos 3 posiciones deterioradas, al menos 50% de posiciones observables deterioradas y deterioro fuerte de consenso/votos.

Durante estrés:
- no liquidar automáticamente media cartera por EXIT individuales;
- conservar core READY: LOW 2%, MEDIUM 3%, HIGH 4%;
- sobre-core → REDUCE; en/bajo core → WATCH;
- bloquear rotación competitiva;
- al normalizarse, vuelve a mandar salud individual.

---

# Problema detectado en replays largos

Observaciones del usuario y diagnóstico de código:
- ganancias de +15/+20% que se devuelven en exceso;
- pérdidas que llegan demasiado lejos antes de EXIT;
- dependencia excesiva de pocos refugios;
- selección con pocos contribuidores positivos;
- la reducción táctica baseline exige demasiadas condiciones y puede proteger tarde un ganador;
- un mal starter sin MFE suficiente puede esperar demasiado para activar protección;
- momentum no equivale a pendiente/estructura.

Primero se mejora gestión de las mismas posiciones. Selección/ReliabilityScore se abordará después, para no cambiar entradas y salidas simultáneamente.

---

# TREND_PROTECTION_V1 — referencia experimental

Rama: `chatgpt/trend-protection-v1`.

`strategyConsensusEngine.ts` añade diagnóstico causal:
- regresión logarítmica anualizada 20/60/120;
- aceleración slope20-slope60;
- pendiente SMA20/SMA50;
- máximo/mínimo previo 20;
- breakout/breakdown 20;
- estado `HEALTHY_UPTREND / WEAKENING_UPTREND / BREAKDOWN_RISK / DOWNTREND / NEUTRAL`.

V1 es audit-only y no modifica órdenes/equity path.

Validaciones ejecutadas:
- `test:current-capital-allocation`: 35/35 PASS tras corregir únicamente fixture 951 para respetar whole-share STARTER cap.
- `test:strategy-consensus`: 13/13 PASS.
- `test:trend-protection` V1/V2 anterior a idempotencia: PASS.

Replay REAL 12m aportado por el usuario: 2022-07-11 → 2023-07-10, DAILY, 13.000 €.
Resultado baseline aproximado: 12.874 € / -0,97%, DD máx. ~3,23%; exact hold ~+2,06%.

Hallazgos V1:
- detecta deterioro temprano útil en DTE, ZPRV, AIGC e IQQH;
- pero era demasiado agresivo en recuperaciones como Sanofi, TotalEnergies y EXH1;
- conclusión: pendiente/estructura aporta valor, pero “ruptura detectada” no debe equivaler a “vender inmediatamente”.

---

# TREND_PROTECTION_V2 — implementación actual

V2 se implementa **en el mismo `trendProtectionPolicy.ts`**, conservando V1 intacta. No hay motor paralelo.

Flujo experimental: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Principios:
- separar detección y ejecución;
- primera ruptura reciente → PROTECT sin venta;
- perdedores usan racha causal multiseñal;
- ganadores pueden deteriorarse con consenso todavía positivo, por lo que se conserva estado desde el punto de armado;
- REDUCE inicial = 25%;
- reclaim de pendiente corta desarma protección;
- EXIT sólo para fallo satélite profundo y persistente.

Hipótesis V2 actuales, todavía NO calibradas:
- ganador: MFE >=8% y giveback >=6 pp + deterioro corto;
- ganador puede REDUCE 25% tras >=3 observaciones protegidas si empeora >=2 pp desde el retorno de armado, aunque consenso siga positivo;
- tesis fallida necesita >=5 sesiones de deterioro multiseñal para REDUCE 25%;
- hard EXIT satélite: aproximadamente <=-18% + DOWNTREND + >=10 sesiones + >=4 votos adversos + consenso <=-3;
- core no usa hard EXIT de satélite;
- `HEALTHY_UPTREND` + slope20>0 + SMA20 slope>0 + sin breakdown → HOLD/reclaim.

## Hallazgo secuencial sobre el ZIP 12m

Al aplicar V2 sobre las 2.929 observaciones de posiciones del replay ya calculado, la primera versión escalonada reducía falsos EXIT, pero podía emitir `REDUCE 25%` repetidamente en días sucesivos durante el mismo episodio. Eso habría convertido una protección parcial en una liquidación de facto y se considera un defecto de ejecución, no una señal económica válida.

Corrección añadida:
- nuevo contexto `protectionReductionExecuted`;
- **cada episodio de protección puede ejecutar como máximo un REDUCE 25%**;
- tras ese REDUCE, si persiste la misma ruptura queda en PROTECT y no encadena ventas diarias;
- sólo un reclaim resetea el episodio para una futura protección nueva;
- hard EXIT sigue permitido aunque ya haya existido una reducción parcial.

Aplicación diagnóstica de esta regla al mismo ZIP, sin recalcular replay:
- DTE: un REDUCE 25% alrededor de +6,2% frente a EXIT baseline posterior alrededor de -3,3%;
- ZPRV: puede generar varios REDUCE, pero sólo en episodios distintos separados por reclaim; el primero aparece alrededor de -1,2% frente a EXIT baseline posterior alrededor de -8,3%;
- AIGC: un único REDUCE 25% alrededor de -9,0%, sin ventas diarias repetidas;
- WCOA: un único REDUCE 25% alrededor de -9,7% antes del EXIT baseline posterior;
- IQQH: REDUCE 25% alrededor de -16,0% y hard EXIT posterior alrededor de -21,8%;
- Sanofi: primera ruptura queda PROTECT; si la debilidad persiste llega a un único REDUCE 25%, no EXIT inmediato, y un reclaim posterior desarma el episodio;
- EXH1: no genera REDUCE en el episodio observado;
- TotalEnergies: puede reducir una vez tras deterioro posterior, pero ya no encadena reducciones.

Esto es diagnóstico sobre la trayectoria baseline; todavía NO estima rentabilidad contrafactual porque ejecutar REDUCE cambia pesos, basis, cash, fees y trayectoria posterior.

## Tests V2

`tests/trendProtectionPolicy.unit.ts` cubre:
- ganador recién roto → PROTECT;
- ganador que empeora tras armado → REDUCE 25%;
- ganador ya reducido en el mismo episodio → PROTECT, no segundo REDUCE;
- ganador que mejora desde armado → no venta automática;
- reclaim claro → HOLD;
- Sanofi-like reciente → PROTECT, no EXIT;
- perdedor persistente → REDUCE 25%;
- perdedor ya reducido → PROTECT, no segundo REDUCE;
- hard loser puede EXIT incluso si ya hubo reducción parcial;
- core fallido persistente → REDUCE 25%.

Commits V2 relevantes:
- `fd6090c` — staged V2;
- `4549ccd` — V2 regressions;
- `62617f6` — winner persistence desde estado armado;
- `6b65ff7` — empeoramiento vs recuperación tras PROTECT;
- `1b5dda1` — idempotencia: un REDUCE por episodio;
- `c122809` — regresiones de idempotencia.

Estado actual:

> **V2 IMPLEMENTADO EN POLÍTICA + TESTS; EL CAMBIO DE IDEMPOTENCIA NECESITA SU UNIT TEST LOCAL. NO ESTÁ INTEGRADO EN ÓRDENES NI PROMOVIDO A `main`.**

---

# Persistencia / GitHub

- `main` debe permanecer en el estable `d77f2f4`; experimentos sólo en `chatgpt/trend-protection-v1`.
- No GitHub Actions.
- Si publicación de replay falla por `GITHUB_REPLAY_SYNC_WRITE_FAILED:401`, no repetir replay; reutilizar resultado local.
- Nunca pegar tokens en chat ni cliente.

---

# Próxima acción concreta

1. Sincronizar `chatgpt/trend-protection-v1` en AI Studio.
2. Ejecutar únicamente `npm run test:trend-protection` sobre el HEAD actual.
3. No modificar archivos automáticamente.
4. Si PASS, integrar el **estado V2** (armed/reference/observations/reductionExecuted) dentro del replay contrafactual A/B, manteniendo exactamente las mismas entradas y fechas de entrada del baseline.
5. Medir retorno, max DD, fees/turnover, MFE cedido, profit capture y pérdidas de cola antes de probar 24/36m.