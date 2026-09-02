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

Pregunta central:

> **¿Muevo dinero hoy o no?**

Salida objetivo:

> **ACCIÓN → IMPORTE → ACTIVO → POR QUÉ → DETALLE TÉCNICO**

Arquitectura:
1. DÓNDE — ranking / calidad / consenso.
2. CUÁNDO — Entry Timing causal.
3. CUÁNTO HOY — STARTER / BUILD / sizing.
4. CÓMO GESTIONAR — HOLD / ADD / WATCH / REDUCE / EXIT / ROTATE.

Máquina vigente:

> **CANDIDATE → STARTER → BUILD → CORE/HOLD → WATCH → ROTATE/REDUCE → EXIT**

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

BUILD máximo:
- LOW 6%.
- MEDIUM 8%.
- HIGH 12%.

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

Hipótesis V1:
- ganador armado desde MFE +8% y giveback >=6 pp;
- REDUCE con giveback fuerte + ruptura;
- fallo satélite desde ~-8%, core ~-12%;
- satélite extremo ~-15% podía EXIT.

Validaciones ejecutadas:
- `test:current-capital-allocation`: 35/35 PASS tras corregir únicamente fixture 951 para respetar whole-share STARTER cap.
- `test:strategy-consensus`: 13/13 PASS.
- `test:trend-protection` V1: PASS.

Replay REAL 12m aportado por el usuario: 2022-07-11 → 2023-07-10, DAILY, 13.000 €.
Resultado baseline aproximado: 12.874 € / -0,97%, DD máx. ~3,23%; exact hold ~+2,06%.

Hallazgos V1:
- detecta correctamente deterioro temprano en varios casos como DTE, ZPRV, AIGC e IQQH;
- pero genera salidas/reducciones demasiado agresivas en recuperaciones como Sanofi, TotalEnergies y EXH1;
- conclusión: el diagnóstico de pendiente aporta valor, pero “ruptura detectada” no debe equivaler a “vender inmediatamente”.

---

# TREND_PROTECTION_V2 — implementación actual

V2 se implementa **en el mismo `trendProtectionPolicy.ts`**, conservando V1 intacta como referencia. No se crea otro motor.

Nuevo flujo experimental:

> **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**

Principios:
- separar detección de deterioro y ejecución;
- usar la racha causal de deterioro ya existente;
- una ruptura reciente arma `PROTECT` sin vender;
- exigir persistencia antes de `REDUCE`;
- reducción inicial pequeña para conservar participación ante posible recuperación;
- `EXIT` queda reservado para fallo profundo, multiseñal y persistente;
- un reclaim de pendiente 20d + SMA20 positiva sin breakdown desarma protección.

Hipótesis V2 actuales, todavía NO calibradas:
- ganador: MFE >=8% y giveback >=6 pp + deterioro corto;
- ruptura fuerte de ganador necesita >=3 sesiones de deterioro para REDUCE;
- tesis fallida necesita >=5 sesiones para REDUCE;
- REDUCE experimental inicial = 25%;
- satélite sólo puede EXIT alrededor de <=-18% con DOWNTREND, >=10 sesiones, >=4 votos adversos y consenso <=-3;
- core nunca usa ese hard EXIT de satélite;
- recuperación causal `HEALTHY_UPTREND` + slope20>0 + SMA20 slope>0 + sin breakdown → HOLD/reclaim.

Tests V2 añadidos en `tests/trendProtectionPolicy.unit.ts`:
- ganador recién roto → PROTECT;
- ganador con ruptura persistente → REDUCE 25%;
- ganador recuperado → HOLD/reclaim;
- caso tipo Sanofi -16,4% con ruptura reciente → PROTECT, no EXIT;
- fallo persistente → REDUCE 25%;
- fallo satélite profundo y persistente → EXIT;
- core fallido persistente → REDUCE 25%.

Commits V2:
- `fd6090c` — staged trend protection V2;
- `4549ccd` — V2 policy regressions.

Estado V2:

> **IMPLEMENTADO EN POLÍTICA + TESTS, TODAVÍA NO RUNTIME-VALIDADO Y NO INTEGRADO EN ÓRDENES.**

No hace falta repetir todavía el replay histórico: el ZIP 12m ya contiene retorno, MFE, giveback, racha, consenso y pendientes suficientes para aplicar V2 de forma diagnóstica una vez pase su unit test.

---

# Persistencia / GitHub

- `main` debe permanecer estable hasta promoción explícita.
- La rama experimental conserva cambios de trend protection.
- No GitHub Actions.
- Si la publicación de replay falla por `GITHUB_REPLAY_SYNC_WRITE_FAILED:401`, no repetir el replay; corregir publicación/token y reutilizar resultado local.
- Nunca pegar tokens en chat ni cliente.

---

# Próxima acción concreta

1. Sincronizar `chatgpt/trend-protection-v1` en AI Studio.
2. Ejecutar únicamente `npm run test:trend-protection`.
3. No modificar archivos automáticamente.
4. Si PASS, aplicar V2 diagnósticamente al replay 12m ya calculado y comparar V1 vs V2 sin repetir el replay.
5. Sólo si V2 reduce falsos positivos conservando los casos útiles, construir después el replay contrafactual A/B económico con mismas entradas/fechas.
