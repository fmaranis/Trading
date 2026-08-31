# Trading — Estado Canónico del Proyecto

- Repositorio canónico: `fmaranis/Trading/main`.
- Nunca usar GitHub Actions; validación local/AI Studio.
- Fase 0 cerrada: límite temporal, cohorte inicial y Entry Timing 25%/50% implementados y gate local completo verde el 2026-08-31.
- Warning `git add` de AI Studio = problema de persistencia por ausencia de `.git`, no fallo de tests.
- Arquitectura: DÓNDE → CUÁNDO → CUÁNTO HOY → CÓMO GESTIONAR.
- Entry Timing: WAIT; ENTRY_READY = máximo 25% del target estratégico; ENTRY_STRONG = máximo 50%.
- Replay 2025-03-27 → 2026-03-26: despliegue aprox. 39,18% / 39,18% / 39,67% / 39,67% a 1/5/20/60 sesiones; motor +18,90%, DD ~5,49%, cohorte inicial +19,14%.
- Replay 2022-07-11 → 2023-07-10: despliegue aprox. 14,07% / 14,07% / 25,35% / 40,68%; motor -0,50%, DD ~3,94%, cohorte inicial +1,12%.
- Conclusión: el patrón de entrada inicial 80–90% desaparece en ambos casos.
- Hueco actual: `PortfolioCandidateGate` calcula `timingState`, `timingSetup`, `timingScore`, `suggestedInitialFraction`, pero el replay/export progresivo no los persiste estructuradamente.
- Próxima acción: integrar esos campos en la cadena existente `PortfolioCandidateGate → DynamicHistoricalReplayEngine → historicalReplayAudit.worker → HistoricalReplayProgressivePanel → export`, añadir métricas 1/5/20/60 y regresiones; después gate local y repetir un replay corto + 2022-07-11 → 2025-07-10.
