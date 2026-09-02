# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto desde otra conversación, equipo o dispositivo. El repositorio canónico es `fmaranis/Trading`. Este documento resume el estado operativo vigente; el detalle histórico anterior permanece en el historial Git.

## Reglas de trabajo no negociables

- Nunca añadir ni depender de GitHub Actions. Las validaciones se ejecutan en local/AI Studio.
- ChatGPT inspecciona, desarrolla y corrige directamente sobre GitHub cuando sea posible.
- AI Studio se usa principalmente como entorno de ejecución/Preview/validación local; no delegar cambios de arquitectura o diagnósticos amplios en Gemini salvo petición expresa.
- Gate local completo: `npm run validate:aistudio`. Un verde anterior no valida cambios posteriores.
- No usar datos sintéticos como fallback silencioso. Procedencia REAL / STATIC_REFERENCE / SYNTHETIC siempre explícita.
- Replay histórico causal: sólo información disponible hasta la fecha evaluada; ejecución posterior a la señal; ningún lookahead.
- Si el usuario dice “terminó”, buscar primero el resultado sincronizado en GitHub antes de pedir adjuntos.
- Cada cambio de código/arquitectura debe actualizar este archivo en el mismo flujo.
- No usar un agente de AI Studio para vigilar periódicamente procesos largos. El usuario avisa cuando termina y ChatGPT revisa el resultado una sola vez.

---

# Estado vigente — 2026-09-02

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion. Aplicación de soporte a decisiones de inversión con datos REAL, replay causal, cartera real, radar de oportunidades, fiscalidad española y ejecución condicionada por broker/costes.

Pregunta central del producto:

> **¿Muevo dinero hoy o no?**

Formato deseado:

> **ACCIÓN → IMPORTE → ACTIVO → POR QUÉ → DETALLE TÉCNICO**

Arquitectura conceptual:

1. **DÓNDE** — calidad / ranking / consenso.
2. **CUÁNDO** — Entry Timing causal.
3. **CUÁNTO HOY** — STARTER / BUILD / sizing y límites de cartera.
4. **CÓMO GESTIONAR** — HOLD / ADD / WATCH / REDUCE / EXIT / ROTATE.

Máquina conceptual vigente:

> **CANDIDATE → STARTER → BUILD → CORE/HOLD → WATCH → ROTATE/REDUCE → EXIT**

No usar take-profit fijo universal ni stop rígido universal.

---

# Cartera real de referencia

- Vanguard Global Stock Index Fund EUR Acc — `IE00B03HD191` — 12.600 € — adquisición 2026-08-11 — 196,59 participaciones — MyInvestor — traspasable.
- Vanguard Emerging Markets Stock Index Fund EUR Acc — `IE0031786696` — 1.400 € — adquisición 2026-08-12 — 4,61 participaciones — MyInvestor — traspasable.
- Capital pendiente de referencia: 13.000 €.
- Horizonte de despliegue: 12 meses.
- Cash hurdle: 2,5% anual salvo cambio explícito.

Constantes canónicas: `USER_REAL_FUND_POSITIONS`, `USER_REAL_STAGED_CAPITAL_PLAN`.

---

# Integridad causal y datos — cerrado salvo regresiones futuras

La antigua dependencia del prefijo respecto a `endDate` se corrigió cambiando instrumentos listados a Yahoo `adjusted:false` y añadiendo regresión short-vs-long. La invariancia REAL se confirmó: para un mismo `startDate`, el tramo temporal compartido produce las mismas barras implícitas, señales, Entry Timing, targets y operaciones independientemente de la duración futura solicitada.

Reglas:
- nunca usar Adj Close dividend-adjusted para reescribir retrospectivamente el prefijo;
- fondos usan NAV REAL directo por ISIN;
- no añadir total return salvo que dividendos/distribuciones se modelen como eventos causales explícitos;
- REAL / STATIC_REFERENCE / SYNTHETIC debe permanecer visible.

---

# Entry Timing vigente

Estados:
- `WAIT`
- `ENTRY_READY`
- `ENTRY_STRONG`

Setups:
- `BREAKOUT_CONFIRMATION`
- `PULLBACK_RECOVERY`
- `TREND_CONTINUATION`
- `NONE`

Variables ya existentes:
- SMA20 / SMA50 / SMA200;
- retorno 5 sesiones;
- máximo previo 20 sesiones;
- drawdown desde máximo 60 sesiones;
- momentum 20/60/120;
- volatilidad;
- consenso y votos;
- tendencia estructural.

Entry Timing no autoriza 100% del target de una vez. READY/STRONG siguen formando parte de la entrada escalonada y se auditan causalmente en el replay.

---

# Cartera dinámica por plazas

Máximo de posiciones:
- LOW 8;
- MEDIUM 12;
- HIGH 16.

Nuevas plazas máximas por evaluación:
- LOW 1;
- MEDIUM 2;
- HIGH 3.

STARTER sobre patrimonio total:
- LOW: READY 2%, STRONG 3,5%;
- MEDIUM: READY 3%, STRONG 5%;
- HIGH: READY 4%, STRONG 7%.

BUILD máximo:
- LOW 6%;
- MEDIUM 8%;
- HIGH 12%.

BUILD exige simultáneamente posición existente, `ENTRY_STRONG`, salud independiente `ADD` y starter suficientemente construido. No promediar pérdidas automáticamente.

No existe compra fallback: sin oportunidad que pase cash + consenso + timing, no hay orden de capital nuevo.

---

# Rotación competitiva

Rotación 1:1 estricta y atómica:
- un challenger no puede expulsar un incumbent si la compra del challenger no es realmente ejecutable en la misma fecha;
- el replay vende antes de comprar y conserva el par incumbent↔challenger;
- una plaza provisional sólo pertenece al challenger emparejado;
- si la compra falla, se bloquean venta y compra.

Persistencia congelada:
- challenger `ENTRY_STRONG` hoy;
- al menos **3 observaciones ENTRY_STRONG en las 10 sesiones anteriores**;
- consenso ≥ +3;
- ≥4/5 votos favorables;
- margen suficiente de ranking y frente a cash/costes;
- incumbent WATCH o HOLD débil.

El umbral 3/10 fue contrastado también en holdouts y no debe seguir calibrándose con las mismas ventanas.

---

# Estrés sistémico / protección de core

Detector:
- al menos 3 posiciones deterioradas;
- al menos 50% de posiciones activas observables deterioradas;
- deterioro fuerte basado en consenso/votos.

Durante estrés sistémico:
- una señal individual EXIT no liquida automáticamente media cartera;
- se conserva un núcleo defensivo equivalente al cap STARTER READY: LOW 2%, MEDIUM 3%, HIGH 4%;
- sobre-core → REDUCE hasta core;
- en/bajo core → WATCH;
- rotación competitiva bloqueada;
- al normalizarse el estrés, vuelve a mandar la salud individual.

Motivación: replay COVID mostró que liquidaciones completas sincronizadas cerca del mínimo destruyen capacidad de recuperación. No introducir por ello un stop universal.

---

# Problema actual detectado en replay largo

El usuario observó en replay de 36 meses:
- volatilidad excesiva;
- tramos con +15/+20% de beneficio que devuelven gran parte rápidamente;
- demasiada dependencia de un único refugio;
- pérdidas que llegan con frecuencia a niveles muy profundos antes de EXIT;
- pocos activos seleccionados terminan aportando beneficio.

La inspección de código confirmó dos debilidades concretas de gestión:

1. La reducción táctica vigente por giveback sólo es elegible para satélites cuando se cumplen simultáneamente deterioro persistente, MFE previo, giveback grande, momentum 20 no positivo **y retorno actual ya negativo**. Por tanto puede proteger demasiado tarde un ganador.
2. Una posición mala que nunca consiguió MFE suficiente puede no activar esa protección táctica y esperar al deterioro estructural normal.

También se confirmó que momentum no equivale a pendiente: hasta ahora el consenso no calculaba regresión de tendencia, pendiente de medias ni aceleración.

---

# Experimento vigente — TREND_PROTECTION_V1

Rama de trabajo:

> `chatgpt/trend-protection-v1`

Objetivo: **mejorar primero la gestión de las mismas posiciones sin cambiar todavía las entradas ni la selección**, para poder atribuir causalmente cualquier mejora.

La política vigente de producción permanece como baseline. `TREND_PROTECTION_V1` es inicialmente replay-only/audit-only y no cambia órdenes.

## Diagnóstico causal añadido al consenso

`strategyConsensusEngine.ts` incorpora ahora `trendStructure` con:
- regresión logarítmica anualizada 20 sesiones;
- regresión logarítmica anualizada 60 sesiones;
- regresión logarítmica anualizada 120 sesiones;
- aceleración `slope20 - slope60`;
- pendiente de SMA20;
- pendiente de SMA50;
- máximo/mínimo de las 20 sesiones anteriores;
- breakout 20;
- breakdown 20;
- estado `HEALTHY_UPTREND / WEAKENING_UPTREND / BREAKDOWN_RISK / DOWNTREND / NEUTRAL`.

Todo se calcula sólo con barras disponibles hasta la fecha evaluada. No se usan pivotes futuros ni ventanas centradas.

Estos diagnósticos **no modifican los cinco votos existentes ni Entry Timing** en V1.

## Política experimental de salud

Archivo: `src/investment/decision/trendProtectionPolicy.ts`.

Principios:
- proteger ganador sin take-profit fijo;
- permitir que un ganador con tendencia sana siga corriendo;
- detectar tesis fallida aunque la posición nunca haya alcanzado MFE positivo suficiente;
- tratar core diversificado de forma más tolerante que satélites.

Umbrales V1 son hipótesis de replay, no parámetros aprobados:
- ganador se arma desde MFE +8%;
- vigilancia desde giveback 6 pp + deterioro de pendiente;
- REDUCE con giveback más fuerte + ruptura;
- fallo satélite desde aproximadamente -8% sólo si coincide con ruptura y tendencia corta negativa;
- core con umbral más tolerante (~-12%);
- fallo satélite extremo (~-15%) + downtrend + varias señales adversas puede proponer EXIT.

No interpretar estos números como calibración final.

## Integración sin cambiar el motor económico

`PortfolioPositionHealthSnapshot` conserva `trendProtectionV1` junto a la clasificación vigente.

`dynamicHistoricalReplay.ts` persiste por señal:
- acción que habría propuesto V1;
- reducción sugerida;
- winnerProtectionArmed / loserFailureArmed;
- motivo;
- estado de tendencia;
- slope20 / slope60;
- aceleración;
- pendiente SMA20;
- breakdown20.

El resultado agrega `trendProtectionV1Counts`:
- HOLD / WATCH / REDUCE / EXIT;
- observaciones con protección de ganador armada;
- observaciones con fallo de tesis armado;
- `earlierProtectionCandidates`: ocasiones en las que V1 habría propuesto REDUCE/EXIT antes que la política baseline.

**Importante:** V1 todavía NO ejecuta esas operaciones y no modifica `equityPath`. Esta primera corrida sirve para verificar que las señales aparecen donde esperamos y no generan ruido masivo.

## Regresiones añadidas

- `tests/trendProtectionPolicy.unit.ts` cubre ganador sano, ganador con ruptura, fallo satélite, fallo core y profit-capture helper.
- `tests/strategyConsensus.unit.ts` exige pendientes causales y estado bajista coherente en serie estructuralmente descendente.
- `package.json` incorpora `test:trend-protection` y lo incluye en `validate:aistudio:raw`.

Commits principales de la rama:
- `8a7a945` — causal trend structure diagnostics;
- `9402007` — replay-only trend protection policy;
- `d62a78c` — policy unit tests;
- `1c4d2fa` + `ec84ba9` — integración en gate conservando dependencias;
- `ed9ad31` — audit en position health;
- `eb0e9d5` — persistencia del audit en replay;
- `60ff4e2` — regresiones de trend structure.

---

# Validación requerida antes de tocar decisiones

Estado actual de `TREND_PROTECTION_V1`:

> **IMPLEMENTADO PARA AUDITORÍA, NO RUNTIME-VALIDADO, NO PROMOVIDO A PRODUCCIÓN.**

No mover `main` todavía.

Orden de trabajo:
1. Ejecutar `npm run validate:aistudio` localmente sobre `chatgpt/trend-protection-v1`.
2. Si falla, corregir la causa exacta; no relajar tests sólo para obtener verde.
3. Si queda verde, ejecutar un replay corto conocido antes de un 36m costoso, preferiblemente `2022-07-11`, 12 meses, DAILY, 13.000 €.
4. Revisar `trendProtectionV1Counts` y las señales concretas donde `earlierProtectionCandidates > 0`.
5. Confirmar que:
   - grandes ganadores sanos permanecen HOLD;
   - un ganador que devuelve beneficio con pendiente corta negativa entra primero en WATCH y sólo REDUCE con ruptura suficiente;
   - malos starters pueden activar fallo de tesis sin depender de MFE;
   - core diversificado no se trata igual que satélite;
   - el baseline económico y su curva no cambian por esta instrumentación.
6. Sólo si el diagnóstico es coherente, construir un **replay contrafactual A/B** donde las entradas permanezcan idénticas y V1 sí pueda ejecutar las salidas experimentales.
7. En ese A/B medir: retorno, DD, fees, turnover, MFE cedido, profit capture ratio, pérdida media/cola, y contribución por activo.
8. Después validar 12/24/36 meses y holdouts independientes antes de promover umbrales.

No tocar todavía selección/reliability score ni HH/HL/LH/LL. Esos bloques vienen después de aislar el valor de una mejor gestión de salida.

---

# Persistencia de replay / publicación

La publicación desde AI Studio usa JSON legible + JSON completo en la rama de resultados. Si aparece `GITHUB_REPLAY_SYNC_WRITE_FAILED:401 Bad credentials`, el replay local puede haber terminado correctamente aunque no se haya publicado. No repetir un replay costoso sólo por ese 401; corregir el token server-side y volver a publicar el resultado existente.

Nunca pegar tokens en chat ni introducirlos en cliente/front-end.

---

# Próxima acción concreta

Sincronizar `chatgpt/trend-protection-v1` en AI Studio y ejecutar **una sola vez** el gate local completo. No GitHub Actions y no agente de Gemini monitorizando.
