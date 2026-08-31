# Trading — Estado Canónico del Proyecto

Repositorio: `fmaranis/Trading/main`.

Reglas: no GitHub Actions; validación local/AI Studio; replay causal sin lookahead.

Fase 0: cerrada y gate local verde el 2026-08-31.

Entry Timing: WAIT; ENTRY_READY=25%; ENTRY_STRONG=50%; target estratégico separado de tramo ejecutable.

Evidencia Fase 1:
- 2025-03-27→2026-03-26: despliegue ~39,18/39,18/39,67/39,67% a 1/5/20/60; motor +18,90%; DD ~5,49%; cohorte +19,14%.
- 2022-07-11→2023-07-10: despliegue ~14,07/14,07/25,35/40,68%; motor -0,50%; DD ~3,94%; cohorte +1,12%.
- Se corrige la entrada inicial 80–90% en ambos casos.

Hueco: el gate calcula timingState/timingSetup/timingScore/suggestedInitialFraction, pero el replay/export progresivo los pierde. Próximo paso: integrarlos en la cadena existente, añadir métricas 1/5/20/60 y regresiones; después gate local y repetir replays.
