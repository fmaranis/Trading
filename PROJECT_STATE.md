# Trading — Estado Canónico del Proyecto

Repositorio canónico: `fmaranis/Trading/main`.

Reglas:
- no GitHub Actions;
- validación local/AI Studio;
- replay causal sin lookahead;
- `PROJECT_STATE.md` es la memoria operativa.

Estado Fase 0: cerrado y gate local verde el 2026-08-31. El warning posterior de `git add` fue sólo de persistencia del workspace sin `.git`.

Entry Timing:
- WAIT;
- ENTRY_READY: máximo 25% del target estratégico;
- ENTRY_STRONG: máximo 50%;
- target estratégico separado de tramo ejecutable.

Evidencia Fase 1:
- 2025-03-27 → 2026-03-26: despliegue aproximado 39,18% / 39,18% / 39,67% / 39,67% a 1/5/20/60 sesiones; motor +18,90%; DD ~5,49%; cohorte inicial +19,14%.
- 2022-07-11 → 2023-07-10: despliegue aproximado 14,07% / 14,07% / 25,35% / 40,68%; motor -0,50%; DD ~3,94%; cohorte inicial +1,12%.
- En ambos casos desaparece la entrada inicial 80–90%.

Hueco actual: `PortfolioCandidateGate` ya calcula `timingState`, `timingSetup`, `timingScore`, `suggestedInitialFraction`, pero el replay/export progresivo no los persiste estructuradamente.

Próxima acción: integrar esos campos en la cadena existente `PortfolioCandidateGate → DynamicHistoricalReplayEngine → historicalReplayAudit.worker → HistoricalReplayProgressivePanel → export`, añadir métricas de despliegue 1/5/20/60 y regresiones; después ejecutar gate local y repetir un replay corto + el largo 2022-07-11 → 2025-07-10.
