# Fase 6 — Forward Risk V8 como contexto — preregistro marco

Fecha de congelación inicial: **2026-09-15**  
Estado actual: **CONTEXT PREREGISTERED / STAGE A FUTURE-FORWARD SAMPLE FROZEN / NOT OPENED / RESEARCH ONLY**

## 1. Punto de partida

Forward Risk V8 conserva valor predictivo de downside. La evidencia histórica cerrada mostró que la combinación:

`V5 vulnerability >= 80 OR V7 options >= 80`

anticipó una parte material de caídas futuras con antelación útil. Los FAIL económicos de V8/V9/V10/V11 no borran ese contenido predictivo: fallaron distintas políticas de ejecución, no necesariamente la información.

Fase 6 no reactiva ninguna de esas políticas.

## 2. Hipótesis Stage A

La primera pregunta de Fase 6 no es todavía “¿cuánto comprar/vender?”, sino:

> Dentro del contexto de decisión que ya recorre `PortfolioCandidateGate`, ¿la información V8 conserva valor incremental para anticipar downside futuro antes de diseñar una nueva política económica?

Esto separa de forma explícita:

1. calidad/información de señal;
2. reach dentro del flujo de candidatos;
3. calidad económica de una política posterior.

## 3. Contexto congelado

Se crea `FORWARD_RISK_CONTEXT_V1` exclusivamente como feature research/shadow.

Reglas:

- score V5: `vulnerabilityScorePct` ya existente;
- score V7: `signalScorePct` ya existente;
- score contextual continuo: `max(V5, V7)`;
- contexto alto: `max(V5, V7) >= 80`;
- el 80 procede de la definición V8 ya congelada, no se retunea;
- no se ajustan pesos ni coeficientes;
- si falta una de las dos familias, el contexto queda `UNAVAILABLE`; no existe fallback silencioso a una sola rama.

## 4. Autoridad: ninguna

Stage A es diagnóstico de información y no tiene autoridad productiva ni ejecutiva.

`FORWARD_RISK_CONTEXT_V1`:

- no hace elegible un activo rechazado;
- no rechaza un activo elegible;
- no cambia ranking;
- no cambia sizing;
- no vende ni reduce posiciones existentes;
- no crea un estado de espera/reentrada;
- no crea un ON/OFF diario;
- no crea un motor paralelo;
- no cambia `LEGACY`.

Su punto conceptual de observación es shadow en la fecha de decisión de `PortfolioCandidateGate`.

## 5. Diseño en dos etapas

### Stage A — información contextual

Se valida si el contexto V8 aporta información incremental dentro del gate antes de diseñar cualquier política económica.

El primer readiness estático pasó sin abrir datos/outcomes. Después se congeló una muestra **future-forward** para evitar reutilizar las ventanas históricas ya consumidas de Forward Risk.

Preregistro específico Stage A:

`docs/phase6_forward_risk_context_stage_a_preregistration.md`

Estado:

**`FUTURE_FORWARD_SAMPLE_FROZEN_NOT_OPENED`**.

Ventana de predicción congelada:

`2026-09-16 -> 2027-03-31`

Cohorte exacta:

`EUNL / SXR8 / EXSA / IS3N / IUSN / QDVE / VVSM / XDWH / EXH1 / ISPA`

Outcome primario congelado:

- referencia `NEXT_OPEN` posterior a `informationDate`;
- horizonte 63 sesiones;
- máximo drawdown peak-to-trough dentro de ese horizonte;
- downside material `>=5%`.

Población primaria:

`PortfolioCandidateGate = ELIGIBLE` con V5 y V7 disponibles.

Reach y gates exactos están congelados en:

`src/investment/decision/phase6ForwardRiskContextStageAProtocol.ts`

Aún no se ha abierto mercado Stage A. Antes de la primera observación deben implementarse y sellarse collector/evaluator, persistencia durable, no-backfill y fingerprints.

### Stage B — política económica futura

Sólo se diseña si Stage A pasa. La muestra Stage A quedará consumida para el diseño de Stage B y no podrá validar económicamente la política que se derive de ella. La policy exacta deberá validarse en otra muestra fresh/blind/OOS.

## 6. Datos y causalidad

Stage A exige:

- V5 macro/financial vulnerability con datos REAL vintage-safe point-in-time;
- V7 con índices de volatilidad observados de Cboe;
- precios REAL;
- cero fallback sintético;
- `informationDate` causal;
- cualquier outcome futuro sólo se lee después de su madurez congelada.

## 7. Qué queda prohibido

- volver a V8 como interruptor diario ON/OFF;
- reactivar V9, V10 o V11 con otro nombre;
- crear V12/V13 como ajuste retrospectivo;
- usar ventanas históricas Forward Risk ya consumidas para decidir Stage A;
- reemplazar activos de Stage A después de abrir porque su resultado sea desfavorable;
- backfill de observaciones prospectivas omitidas;
- usar la misma muestra para diseñar y validar económicamente una nueva policy;
- ajustar el umbral 80, el downside 5%, el horizonte 63 o los gates después de ver Stage A;
- conectar Stage A a producción.

## 8. Siguiente paso antes de abrir

El trabajo pendiente es puramente técnico y pre-open:

1. implementar collector/evaluator causal future-forward;
2. persistencia durable/inmutable;
3. guard de no-backfill;
4. fingerprint/seal del runner y del estado;
5. guards arquitectónicos + TypeScript.

Hasta que ese sellado pase, `marketDataAccessBeforeRunnerSealAllowed=false`.

## 9. Producción

Producción permanece:

- `CORE_ARCHITECTURE_V1`;
- allocation/opportunity `LEGACY`;
- `CORE_ELIGIBILITY_V2` shadow;
- Forward Risk sin autoridad productiva.
