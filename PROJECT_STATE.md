# Trading — Estado Canónico del Proyecto

Estado canónico resumido a 2026-08-31.

- Repositorio: `fmaranis/Trading/main`.
- Nunca usar GitHub Actions; validación local/AI Studio.
- Fase 0: límite temporal, comparador de cohorte inicial y Entry Timing 25%/50% implementados y gate local completo verde el 2026-08-31. El warning de `git add` fue sólo de persistencia del workspace sin `.git`.
- Arquitectura: DÓNDE → CUÁNDO → CUÁNTO HOY → CÓMO GESTIONAR.
- Estados de timing: WAIT, ENTRY_READY (25%), ENTRY_STRONG (50%).
- Replay 2025-03-27 → 2026-03-26: despliegue aprox. 39,18% / 39,18% / 39,67% / 39,67% a 1/5/20/60 sesiones; motor +18,90%, DD ~5,49%, cohorte inicial +19,14%.
- Replay 2022-07-11 → 2023-07-10: despliegue aprox. 14,07% / 14,07% / 25,35% / 40,68% a 1/5/20/60; motor -0,50%, DD ~3,94%, cohorte inicial +1,12%.
- Conclusión: el patrón de entrada inicial 80–90% desaparece en ambos casos; siguiente problema es calidad/timing de incorporaciones posteriores y gestión de posiciones.
- Hueco de auditoría: `PortfolioCandidateGate` calcula `timingState`, `timingSetup`, `timingScore`, `suggestedInitialFraction`, pero el replay/export progresivo pierde esos campos. Próximo cambio: integrarlos en la cadena existente `PortfolioCandidateGate → DynamicHistoricalReplayEngine → historicalReplayAudit.worker → HistoricalReplayProgressivePanel → export`, junto con métricas de despliegue 1/5/20/60 y preservación de consenso/votos.
- Después: tests, gate local completo y repetir un replay corto + largo 2022-07-11 → 2025-07-10.
