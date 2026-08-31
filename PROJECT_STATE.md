# Trading — Estado Canónico del Proyecto

Repositorio canónico: `fmaranis/Trading/main`.

- No usar GitHub Actions; validación local/AI Studio.
- Fase 0 cerrada y gate local verde el 2026-08-31.
- Entry Timing: WAIT; ENTRY_READY = 25% máximo del target estratégico; ENTRY_STRONG = 50% máximo.
- Replays Fase 1 revisados:
  - 2025-03-27 → 2026-03-26: despliegue aprox. 39,18% / 39,18% / 39,67% / 39,67% a 1/5/20/60 sesiones; motor +18,90%; DD ~5,49%; cohorte inicial +19,14%.
  - 2022-07-11 → 2023-07-10: despliegue aprox. 14,07% / 14,07% / 25,35% / 40,68%; motor -0,50%; DD ~3,94%; cohorte inicial +1,12%.
- Conclusión: desaparece la entrada inicial 80–90% en ambos casos.
- Hueco actual: `PortfolioCandidateGate` calcula `timingState`, `timingSetup`, `timingScore`, `suggestedInitialFraction`, pero el replay/export progresivo pierde esos campos.
- Próximo paso: integrar esos campos en la cadena existente `PortfolioCandidateGate → DynamicHistoricalReplayEngine → historicalReplayAudit.worker → HistoricalReplayProgressivePanel → export`, añadir métricas 1/5/20/60 y regresiones; después gate local y replays.
