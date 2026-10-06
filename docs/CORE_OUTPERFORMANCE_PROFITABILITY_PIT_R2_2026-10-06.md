# CORE_OUTPERFORMANCE_PROFITABILITY_PIT_R2 — traducción SEC alineada con Fama/French

Fecha: 2026-10-06

Estado: **PREREGISTERED PRE-OUTCOME / V1 INCONCLUSIVE COVERAGE / RESEARCH ONLY / NO PRODUCTION AUTHORITY**

Producción permanece `LEGACY`.

## Motivo de R2

`CORE_OUTPERFORMANCE_PROFITABILITY_PIT_V1` se detuvo antes de abrir outcomes en el primer anchor (2016-06-30) con 114 filas evaluables frente al mínimo congelado de 250.

La causa fue una traducción SEC deliberadamente más estricta que la metodología académica: V1 exigía Revenue, COGS, SG&A e InterestExpense simultáneamente en el mismo fiscal year.

La documentación pública de Kenneth French exige ingresos no missing y al menos uno de COGS, SG&A o interest expense. Réplicas académicas estándar de Fama/French (2015) imputan a cero los componentes de gasto ausentes, siempre que al menos uno de los tres esté observado.

R2 corrige únicamente esta semántica de missingness **antes de abrir cualquier stock outcome**.

## Hipótesis y fórmula

No cambia la familia ni la fórmula:

`OP = (Revenue - COGS - SG&A - InterestExpense) / positive BookEquity`

Para cada fiscal year causal:

- Revenue es obligatorio.
- BookEquity positivo es obligatorio.
- Debe existir al menos uno de COGS, SG&A o InterestExpense.
- Cualquier componente de esos tres que falte se imputa a cero.
- No se usa `OperatingIncomeLoss`.
- Los tags XBRL equivalentes se unen por fiscal-period end; para un mismo cierre se toma el filing causal más reciente y, en empate, la prioridad congelada del tag. No se elige un único tag global para toda la historia.
- No se usa ningún filing posterior a `signalDate`.

## Todo lo demás permanece congelado

- mismos anchors: junio 2016..2021;
- mismo universo histórico STATIC_REFERENCE;
- mismos 10-K/10-K/A con `filed <= signalDate`;
- mismo top decile;
- mismo value-weight por market cap causal;
- mismos aliases;
- mismo NEXT_OPEN;
- mismos SPY/URTH;
- mismo mínimo de 250 evaluables;
- mismo mínimo de 25 seleccionados;
- 100% market-cap/outcome coverage;
- mismo gate: 5 periodos y CAGR bruto > SPY y > URTH.

No se reduce ningún gate para conseguir cobertura.

## Autoridad

Un resultado de R2 sigue siendo diagnóstico de traducción de implementación. Incluso un `PASS_ACTIONABLE_TRANSLATION_GROSS_ONLY` no promociona producción: sólo permite Stage C2 económico y evidencia future-forward posterior.

`productionDefault=LEGACY`
`productionAuthority=false`
