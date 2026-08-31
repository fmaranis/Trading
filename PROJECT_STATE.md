# Trading — Estado Canónico del Proyecto

> Leer este archivo primero al retomar el proyecto desde otra conversación, equipo o dispositivo. El repositorio canónico es `fmaranis/Trading/main`. Este documento es la memoria operativa del proyecto y debe actualizarse cada vez que cambie código, arquitectura, conclusiones de validación o próximos pasos.

## Reglas de trabajo no negociables

- Nunca añadir ni depender de GitHub Actions. Las validaciones se ejecutan en local/AI Studio.
- ChatGPT inspecciona, desarrolla y corrige directamente sobre GitHub cuando sea posible.
- AI Studio se usa principalmente como entorno de ejecución/Preview/validación local; no delegar cambios de arquitectura o diagnósticos amplios en Gemini salvo petición expresa.
- Gate local completo: `npm run validate:aistudio`. Un verde anterior no valida cambios posteriores.
- No usar datos sintéticos como fallback silencioso. Procedencia REAL / STATIC_REFERENCE / SYNTHETIC siempre explícita.
- Replay histórico causal: solo información disponible hasta la fecha evaluada; ejecución posterior a la señal; ningún lookahead.
- Si el usuario dice “terminó, revisa la prueba”, buscar primero el resultado sincronizado en GitHub antes de pedir adjuntos.
- A partir de 2026-08-31, cada cambio de código/arquitectura debe ir acompañado de actualización de `PROJECT_STATE.md`.

---

# Estado actual — 2026-08-31

Últimos cambios implementados:
- `f1bb80d029f1904085e6a49db97577296086d6f9` — `Enforce requested replay decision boundary`.
- `b13d60572f430387e3eafb5ca0585d6926e11326` — `Assert strict historical replay start boundary`.
- `48de3171d6ff22682f27bf658e0fca7e9b1f0559` — `Fix initial cohort hold comparator semantics`.
- `00835f5594ffb762d91eee1d37dbe40ecdcdfe90` — `Assert initial signal cohort comparator labels`.
- `167791c35ceaddb5948ad34aac33877f9743d75a` — `Enforce entry timing fraction in capital allocation`.
- `af6c955e91379ec4d150170c5101c21d28cb2ce2` — `Align existing-position test with staged entry semantics`.
- `e29963dbf1ff7146afb7ac4f020c2ea0515b83e6` — runtime validation state update.

La corrección temporal, el comparador por cohorte inicial y el límite 25%/50% del Entry Timing están implementados y runtime-validados por el gate local completo ejecutado el 2026-08-31. La ejecución alcanzó los tres marcadores finales (`AI_STUDIO_VALIDATION_RESULT`, `BROKER_BACKTEST_FEASIBILITY_RESULT`, `BROKER_AWARE_EXECUTION_SWEEP_RESULT`) dentro de la cadena `validate:aistudio:raw`, unida por `&&`. El único error posterior fue `VALIDATION_RESULTS_GIT_WARNING` al ejecutar `git add` porque el workspace de AI Studio no contiene un repositorio `.git`; es un problema de persistencia/sincronización del entorno, no un fallo del gate. No se ha usado GitHub Actions.

Stack: React 19 + TypeScript + Vite + Tailwind + Recharts + Motion. Aplicación de soporte a decisiones con datos REAL, replay causal, cartera real, radar de oportunidades, fiscalidad española y ejecución condicionada por broker/costes.

Pregunta central de producto:

> **¿Muevo dinero hoy o no?**

Formato deseado:

> **ACCIÓN → IMPORTE → ACTIVO → POR QUÉ → DETALLE TÉCNICO**

Acciones objetivo:
- INVERTIR X €
- REDUCIR / SALIR
- ROTAR
- NO MOVER DINERO
- REORDENAR CARTERA

Principio clave: tener efectivo no implica que haya que invertirlo.

---

# Arquitectura de decisión objetivo

Separar claramente:

1. **DÓNDE** — calidad / ranking / consenso.
2. **CUÁNDO** — timing causal de entrada.
3. **CUÁNTO HOY** — sizing / construcción progresiva; target estratégico ≠ orden inmediata.
4. **CÓMO GESTIONAR** — HOLD / ADD / WATCH / REDUCE / EXIT.

Máquina de estados objetivo:

> **CANDIDATE → WAIT → ENTER → BUILD → HOLD → WATCH → REDUCE → EXIT**

No usar stops rígidos universales ni take-profit fijo.

---

# Entry Timing — implementación actual

Archivos principales:
- `src/investment/decision/entryTiming.ts`
- `src/investment/decision/portfolioCandidateGate.ts`
- `src/investment/decision/currentOpportunityAlerts.ts`
- `src/investment/decision/portfolioDecisionEngine.ts`

Estados: `WAIT`, `ENTRY_READY`, `ENTRY_STRONG`.

Reglas actuales:
- un activo bueno puede quedar en `WAIT`;
- `ENTRY_READY` autoriza como máximo 25% del target estratégico;
- `ENTRY_STRONG` autoriza como máximo 50%;
- el target estratégico permanece separado del target ejecutable;
- una posición ya por encima del tramo autorizado no se completa automáticamente desde el flujo de entrada;
- timing nunca autoriza 100% del target de una vez.

`ContributionRecommendation` expone `targetAssetValueEur`, `executableTargetAssetValueEur`, `suggestedInitialFraction` y `timingState`.

Estas invariantes pasaron el gate local completo del 2026-08-31.

---

# Evidencia Fase 1 — replays posteriores al Entry Timing vinculante

## 2025-03-27 → 2026-03-26

Archivo aportado: `trading-replay-2025-03-27-2026-03-26 (2).zip`.

- límite temporal correcto: no hay señales anteriores a 2025-03-27;
- capital desplegado neto aproximado: 39,18% tras 1 sesión; 39,18% tras 5; 39,67% tras 20; 39,67% tras 60;
- motor final aproximado: 1.188,96 € desde 1.000 € (+18,90%);
- DD máx. aproximado: 5,49%;
- cohorte inicial aproximada: 1.191,41 € (+19,14%);
- diferencia total vs cohorte inicial: -2,45 € / -0,245 pp;
- evidencia textual de órdenes limitadas por `ENTRY_READY`/`ENTRY_STRONG` confirma que 25%/50% está afectando al replay real.

Lectura: sizing inicial mucho más prudente, pero no hay evidencia de mejora de rentabilidad frente a cohorte inicial en este periodo.

## 2022-07-11 → 2023-07-10

Archivo aportado: `trading-replay-2022-07-11-2023-07-10.zip`.

- límite temporal correcto: no hay señales anteriores a 2022-07-11;
- capital desplegado neto aproximado: 14,07% tras 1 sesión; 14,07% tras 5; 25,35% tras 20; 40,68% tras 60;
- motor final aproximado: 995,00 € desde 1.000 € (-0,50%);
- DD máx. aproximado: 3,94%;
- cohorte inicial aproximada: 1.011,23 € (+1,12%);
- diferencia total vs cohorte inicial: -16,23 € / -1,623 pp;
- cash fue superior en este tramo.

Lectura: el problema de despliegue inicial 80–90% queda claramente corregido. El siguiente problema ya no es principalmente cuánto se compra al arrancar, sino calidad/timing de incorporaciones posteriores y gestión de posiciones.

## Hueco de auditoría detectado

`PortfolioCandidateGate` ya calcula y conserva para cada candidato:
- `timingState`
- `timingSetup`
- `timingScore`
- `suggestedInitialFraction`
- y registra `ENTRY_TIMING_WAIT`.

Sin embargo, el replay/export progresivo no persiste explícitamente toda esa información. `AuditSignal` simplifica la señal y pierde campos; por eso los ZIP actuales permiten inferir READY/STRONG desde `reason`, pero no cuantificar correctamente WAIT ni auditar setup/score/fracción de forma estructurada.

Próximo cambio debe integrar esos datos en la cadena existente, no crear un módulo paralelo:

> `PortfolioCandidateGate → DynamicHistoricalReplayEngine → historicalReplayAudit.worker → HistoricalReplayProgressivePanel → JSON/ZIP export`

Métricas objetivo del resultado/export:
- conteos `WAIT / ENTRY_READY / ENTRY_STRONG`;
- `timingSetup`, `timingScore`, `suggestedInitialFraction` por señal donde aplique;
- capital neto desplegado tras 1 / 5 / 20 / 60 sesiones;
- preservar los campos ya existentes de consenso/votos y no perderlos en persistencia/export.

---

# Fase 0 — estado

- [x] límite temporal corregido y validado;
- [x] cohorte inicial corregida;
- [x] etiqueta/semántica comparador corregida;
- [x] gate completo verde 2026-08-31;
- [ ] separar progresivamente diferencia total vs cohorte, valor de nuevas selecciones y valor de gestión de posiciones.

# Fase 1 — estado

1. [x] repetir dos replays posteriores a Fase 0;
2. [ ] medir estructuradamente WAIT / ENTRY_READY / ENTRY_STRONG — bloqueado por pérdida de campos en export;
3. [x] medir manualmente % desplegado en 1/5/20/60 para dos replays;
4. [x] confirmar en esos dos casos que desaparece entrada inicial 80–90%;
5. [x] 25%/50% vinculante y observado en replay real;
6. [ ] instrumentar el replay/export con métricas estructuradas y repetir al menos un caso corto y el replay largo 2022-07-11 → 2025-07-10;
7. [ ] no ajustar umbrales usando estos mismos periodos; usar holdout para calibración.

# Fases siguientes

## Fase 2
- sizing sensible a volatilidad/régimen;
- construcción progresiva más allá de READY/STRONG;
- ADD sólo por confirmación.

## Fase 3
- high-water mark/MFE persistente;
- drawdown desde máximo;
- WATCH real;
- REDUCE por deterioro combinado + devolución de beneficio;
- EXIT estructural más temprano cuando la evidencia lo justifique;
- sin take-profit fijo.

## Fase 4
Fiscalidad temporal realista: pasivo pendiente vs impuesto pagado y liquidación anual.

## Fase 5
Validación robusta multi-ventana + holdout: retorno, DD, cash medio, turnover, acciones, MFE cedido, despliegue por horizonte, valor vs hold y costes/fiscalidad.

---

# Próxima acción concreta

1. Verificar que `dynamicHistoricalReplay.ts` quedó exactamente restaurado tras el error de staging de edición.
2. Integrar campos/métricas de Entry Timing en la cadena existente del replay progresivo y su export.
3. Añadir contratos unitarios que impidan volver a perder esos campos.
4. Ejecutar gate local completo sólo después de estos cambios.
5. Repetir un replay corto y el largo 2022-07-11 → 2025-07-10 con export autosuficiente.
