# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto desde otra conversación, equipo o dispositivo. Repositorio canónico y línea viva de trabajo: `fmaranis/Trading/main`. El detalle histórico anterior permanece en Git.

## Reglas de trabajo no negociables

- Nunca añadir ni depender de GitHub Actions. Validaciones en local/AI Studio.
- ChatGPT inspecciona y modifica GitHub directamente cuando sea posible.
- AI Studio trabaja sobre `main` y se usa para ejecución/Preview/validación; no pedirle que gestione ramas experimentales.
- Antes de un cambio sustancial en `main`, conservar un branch de backup del HEAD anterior cuando sea útil; si AI Studio introduce cambios incorrectos, revertir sólo el delta concreto en vez de volver a una versión antigua completa.
- No usar datos sintéticos como fallback silencioso. Procedencia REAL / STATIC_REFERENCE / SYNTHETIC siempre explícita.
- Replay causal: sólo información disponible hasta la fecha evaluada; ejecución posterior a señal; ningún lookahead.
- Si el usuario dice “terminó”, revisar una sola vez el resultado disponible. No agentes de monitorización ni polling.
- Cada cambio de código/arquitectura debe actualizar este archivo.

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
- `test:trend-protection`: PASS para V1 y V2 incluida idempotencia (`repeatWinner=PROTECT`, `repeatLoser=PROTECT`).

Replay REAL 12m aportado por el usuario: 2022-07-11 → 2023-07-10, DAILY, 13.000 €.
Resultado baseline aproximado: 12.874 € / -0,97%, DD máx. ~3,23%; exact hold ~+2,06%.

Hallazgos V1:
- detecta deterioro temprano útil en DTE, ZPRV, AIGC e IQQH;
- pero era demasiado agresivo en recuperaciones como Sanofi, TotalEnergies y EXH1;
- conclusión: pendiente/estructura aporta valor, pero “ruptura detectada” no debe equivaler a “vender inmediatamente”.

---

# TREND_PROTECTION_V2 — política actual

V2 vive **en el mismo `trendProtectionPolicy.ts`**, conservando V1 intacta. No hay un segundo motor de selección.

Flujo experimental: **HEALTHY → WATCH → PROTECT → REDUCE → EXIT**.

Principios:
- separar detección y ejecución;
- primera ruptura reciente → PROTECT sin venta;
- perdedores usan racha causal multiseñal;
- ganadores pueden deteriorarse con consenso todavía positivo, por lo que se conserva estado desde el punto de armado;
- REDUCE inicial = 25%;
- cada episodio puede ejecutar como máximo un REDUCE 25%; después queda PROTECT hasta reclaim o hard EXIT;
- reclaim de pendiente corta desarma protección;
- EXIT sólo para fallo satélite profundo y persistente.

Hipótesis V2 todavía NO calibradas:
- ganador: MFE >=8% y giveback >=6 pp + deterioro corto;
- ganador puede REDUCE 25% tras >=3 observaciones protegidas si empeora >=2 pp desde el retorno de armado, aunque consenso siga positivo;
- tesis fallida necesita >=5 sesiones de deterioro multiseñal para REDUCE 25%;
- hard EXIT satélite: aproximadamente <=-18% + DOWNTREND + >=10 sesiones + >=4 votos adversos + consenso <=-3;
- core no usa hard EXIT de satélite;
- `HEALTHY_UPTREND` + slope20>0 + SMA20 slope>0 + sin breakdown → HOLD/reclaim.

Aplicación diagnóstica al ZIP 12m, todavía sobre trayectoria baseline:
- DTE: REDUCE 25% alrededor de +6,2% frente a EXIT baseline posterior alrededor de -3,3%;
- ZPRV: REDUCE sólo por episodios separados por reclaim; primer caso alrededor de -1,2% frente a EXIT baseline ~-8,3%;
- AIGC: un REDUCE 25% alrededor de -9,0%;
- WCOA: un REDUCE 25% alrededor de -9,7%;
- IQQH: REDUCE 25% alrededor de -16,0% y posible hard EXIT posterior ~-21,8%;
- Sanofi: ruptura reciente PROTECT, no EXIT inmediato; como máximo un REDUCE por episodio;
- EXH1: no REDUCE en el episodio observado;
- TotalEnergies: puede REDUCE una vez, por lo que necesita contraste económico/holdout y no más calibración sobre esta misma ventana.

---

# A/B contrafactual CURRENT_POLICY vs TREND_PROTECTION_V2

Archivo principal: `src/investment/decision/trendProtectionCounterfactual.ts`.

Metodología:
- primero se ejecuta el replay baseline vigente;
- el contrafactual reproduce **exactamente los BUY/ADD realmente ejecutados por baseline**: mismas fechas, unidades, precios y comisiones;
- se ignoran REDUCE/EXIT baseline y sólo la gestión de posiciones usa V2;
- las decisiones V2 se recalculan causalmente sobre las posiciones, lotes, basis, MFE y efectivo del propio camino contrafactual;
- ETFs siguen títulos enteros + gate mínimo/fee-drag; fondos admiten fracciones;
- fiscalidad y traspaso fondo→fondo se vuelven a calcular para el camino V2;
- si V2 no dispone de efectivo para reproducir alguna entrada baseline exacta, `entryParity.exact=false`, `valid=false` y el A/B queda invalidado.

Métricas A/B:
- finalValue / totalReturn;
- max drawdown;
- fees / tax / transferred / cash interest;
- turnover total y turnover de gestión;
- REDUCE / EXIT ejecutados;
- profit capture medio de ventas con MFE positivo;
- pérdida realizada de gestión y conteos <=-10/-20/-30%;
- deltas en € / pp frente a CURRENT_POLICY;
- ledger completo y equityPath V2.

Integración:
- `historicalReplayAudit.worker.ts` adjunta el contrafactual sólo en el checkpoint final;
- `dynamicHistoricalReplay.trendProtectionV2.d.ts` expone el bloque opcional;
- `tests/trendProtectionCounterfactual.unit.ts` comprueba causalidad, no mutación del baseline, reconciliación del ledger y `entryParity`;
- `package.json` incorpora `test:trend-protection-counterfactual`.

Estado de validación actual:
- `npm run lint`: **PASS** en AI Studio el 2026-09-02 después de corregir los tres errores de integración/tipado detectados en la ejecución anterior; `tsc --noEmit` termina con exit code 0 y sin warnings.
- Las correcciones fueron sólo de integración/tipado: textos de auditoría con `incumbent.label` y fixture batch con `timingStateCounts`, `trendProtectionV1Counts` y `deploymentHorizons`.
- Ningún threshold, orden, sizing ni regla económica se modificó.
- Siguiente gate dirigido: `npm run test:trend-protection-counterfactual`.

No interpretar todavía ninguna cifra económica de V2 hasta que el test nuevo pase y `entryParity.exact=true` en el replay REAL.

---

# Persistencia / GitHub

- `main` es ahora la línea viva de trabajo para mantener integradas las últimas mejoras y evitar remezclas al volver atrás.
- Antes de integrar V2 en `main`, el estado anterior `d77f2f4` quedó preservado en `backup/main-pre-trend-v2-2026-09-02`.
- También existen backups de escrituras previas de Gemini para trazabilidad; no restaurarlos salvo necesidad explícita.
- AI Studio sincroniza `main`; ChatGPT revisa cualquier delta posterior y revierte sólo cambios incorrectos concretos.
- No GitHub Actions.
- Si publicación de replay falla por `GITHUB_REPLAY_SYNC_WRITE_FAILED:401`, no repetir replay; reutilizar resultado local.
- Nunca pegar tokens en chat ni cliente.

---

# Próxima acción concreta

1. Sincronizar `main` al HEAD actual.
2. Ejecutar únicamente `npm run test:trend-protection-counterfactual`.
3. Si falla, corregir sólo el primer fallo exacto; no ejecutar el gate completo todavía.
4. Si PASS, integrar el bloque A/B en resumen/export/UI y después ejecutar un replay REAL 12m único para obtener cifras económicas con `entryParity.exact=true` antes de probar 24/36m.
