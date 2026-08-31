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

La corrección temporal, el comparador por cohorte inicial y el límite 25%/50% del Entry Timing están implementados y runtime-validados por el gate local completo ejecutado el 2026-08-31. El único error posterior fue `VALIDATION_RESULTS_GIT_WARNING` al ejecutar `git add` porque el workspace de AI Studio no contiene un repositorio `.git`; es un problema de persistencia/sincronización del entorno, no un fallo del gate. No se ha usado GitHub Actions.

Pregunta central de producto:

> **¿Muevo dinero hoy o no?**

Arquitectura de decisión:
1. **DÓNDE** — calidad / ranking / consenso.
2. **CUÁNDO** — timing causal de entrada.
3. **CUÁNTO HOY** — sizing / construcción progresiva; target estratégico ≠ orden inmediata.
4. **CÓMO GESTIONAR** — HOLD / ADD / WATCH / REDUCE / EXIT.

Máquina de estados objetivo:
> **CANDIDATE → WAIT → ENTER → BUILD → HOLD → WATCH → REDUCE → EXIT**

Entry Timing actual:
- `WAIT`
- `ENTRY_READY` → máximo 25% del target estratégico
- `ENTRY_STRONG` → máximo 50%
- una posición por encima del tramo autorizado no se completa automáticamente desde el flujo de entrada.

## Evidencia Fase 1

### 2025-03-27 → 2026-03-26
- límite temporal correcto;
- capital desplegado neto aproximado: 39,18% tras 1 sesión; 39,18% tras 5; 39,67% tras 20; 39,67% tras 60;
- motor: ~1.188,96 € desde 1.000 € (+18,90%);
- DD máx.: ~5,49%;
- cohorte inicial: ~1.191,41 € (+19,14%);
- diferencia total vs cohorte inicial: -2,45 € / -0,245 pp.

### 2022-07-11 → 2023-07-10
- límite temporal correcto;
- capital desplegado neto aproximado: 14,07% tras 1 sesión; 14,07% tras 5; 25,35% tras 20; 40,68% tras 60;
- motor: ~995,00 € desde 1.000 € (-0,50%);
- DD máx.: ~3,94%;
- cohorte inicial: ~1.011,23 € (+1,12%);
- diferencia total vs cohorte inicial: -16,23 € / -1,623 pp.

Conclusión: en estos dos casos desaparece el patrón de entrada inicial del 80–90%. El siguiente problema es calidad/timing de incorporaciones posteriores y gestión de posiciones, no sólo sizing inicial.

## Hueco de auditoría

`PortfolioCandidateGate` ya calcula `timingState`, `timingSetup`, `timingScore`, `suggestedInitialFraction` y `ENTRY_TIMING_WAIT`, pero el replay/export progresivo no persiste estructuradamente toda esa información. El próximo cambio debe integrar esos datos en la cadena existente:

> `PortfolioCandidateGate → DynamicHistoricalReplayEngine → historicalReplayAudit.worker → HistoricalReplayProgressivePanel → JSON/ZIP export`

Métricas objetivo:
- conteos `WAIT / ENTRY_READY / ENTRY_STRONG`;
- `timingSetup`, `timingScore`, `suggestedInitialFraction` por señal;
- capital neto desplegado tras 1 / 5 / 20 / 60 sesiones;
- preservar consenso/votos en persistencia/export.

## Fase 0
- [x] límite temporal corregido y validado;
- [x] cohorte inicial corregida;
- [x] comparador corregido;
- [x] gate completo verde 2026-08-31;
- [ ] separar progresivamente diferencia total vs cohorte, nuevas selecciones y gestión de posiciones.

## Fase 1
- [x] repetir dos replays posteriores a Fase 0;
- [ ] medir estructuradamente WAIT / ENTRY_READY / ENTRY_STRONG;
- [x] medir manualmente despliegue 1/5/20/60 en dos replays;
- [x] confirmar que desaparece entrada inicial 80–90% en esos dos casos;
- [x] observar 25%/50% vinculante en replay real;
- [ ] instrumentar replay/export con métricas estructuradas;
- [ ] repetir un caso corto y el replay largo 2022-07-11 → 2025-07-10;
- [ ] no ajustar umbrales con los mismos periodos; usar holdout.

## Próxima acción

1. Confirmar integridad de `dynamicHistoricalReplay.ts` tras las escrituras accidentales de staging ocurridas al comenzar esta fase.
2. Integrar campos/métricas de Entry Timing en la cadena existente.
3. Añadir regresiones.
4. Ejecutar gate local completo después de esos cambios.
5. Repetir replays con export autosuficiente.
