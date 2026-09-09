# REPLAY_EXPLICIT_CASH_FLOWS_V1 — cierre

Fecha de resultado local: **2026-09-09**.

Estado: **PASS_EXPLICIT_CASH_FLOW_INTEGRATION / CONSUMIDO / ARCHIVADO**.

## Objetivo cerrado

Validar dentro del replay existente que:

- `MONTHLY` sea sólo frecuencia de decisión y no cree dinero;
- `externalCashFlows` aplique aportaciones/retiradas de forma causal;
- las aportaciones externas no se contabilicen como rentabilidad;
- el benchmark de cash use contabilidad independiente;
- el capital externo llegue realmente al allocator y a compras;
- se pueda medir el reach de `QUALITY_ALLOCATION_BRIDGE_V1` cuando sí existe dinero nuevo.

## Calidad y causalidad

Resultado:

- `accountingAndCausalChecksPass: true`;
- `fundingReachWindows: 3/3`;
- catálogo escaneado: 64;
- REAL aceptados: 60;
- rechazados: 4;
- provenance REAL-only: PASS;
- Yahoo current discovery histórico: OFF;
- leak `OPEN_*`: 0;
- brazo cerrado: 0 aportaciones implícitas;
- paridad closed vs explicit LEGACY antes del primer flujo: PASS;
- benchmark estructural bajo flujos explícitos: N/D, como estaba preregistrado.

## Hallazgo de reach de capital

Agregado en las tres ventanas consumidas:

- gates con capital desplegable, closed: **3**;
- gates con capital desplegable, explicit LEGACY: **22**;
- gates con plan de contribución, closed: **3**;
- gates con plan de contribución, explicit LEGACY: **12**;
- delta de notional de adquisiciones ejecutadas explicit vs closed: **+212.386,21 EUR**.

Conclusión: el capital disponible era un cuello de botella real. La baja capacidad previa de QUALITY para modificar cartera no podía interpretarse sólo como falta de información en el ranking/allocator.

## Reach de QUALITY con capital explícito

Con exactamente los mismos flujos externos en LEGACY y QUALITY:

- gates donde cambió el plan de allocation: **10**;
- fechas donde cambiaron adquisiciones ejecutadas: **23**;
- delta absoluto de notional ejecutado: **1.969,94 EUR**.

Por tanto, `QUALITY_ALLOCATION_BRIDGE_V1` sí atraviesa allocator y ejecución cuando existe capital accionable.

## Economía observada — sólo diagnóstico consumido

Estas ventanas ya estaban consumidas y **no pueden promover ni retunear QUALITY**.

- 10 años: QUALITY vs LEGACY **+40,93 EUR**, retorno ajustado +0,0310 pp, DD igual.
- 6 años: **-0,82 EUR**, retorno ajustado -0,0010 pp, DD prácticamente igual.
- 3 años: **+4,74 EUR**, retorno ajustado +0,0099 pp, DD +0,0055 pp mejor.

Interpretación: el bridge congelado ya tiene reach suficiente para ser evaluable, pero el efecto económico observado en muestras consumidas es pequeño y no constituye evidencia de promoción.

## Decisión metodológica

- producción permanece `LEGACY`;
- `QUALITY_ALLOCATION_BRIDGE_V1` permanece research/shadow-only;
- no modificar coeficientes ni bounds 0,85–1,15;
- no reutilizar las ventanas 10y/6y/3y para promoción;
- siguiente fase: `QUALITY_ALLOCATION_FUTURE_FORWARD_V1`, congelada antes de observar resultados posteriores al 2026-09-09.
