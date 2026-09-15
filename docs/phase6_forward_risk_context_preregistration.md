# Fase 6 — Forward Risk V8 como contexto — preregistro Stage A

Fecha de congelación: **2026-09-15**  
Estado: **CONTEXT PREREGISTERED / SAMPLE NOT SELECTED / NOT OPENED / RESEARCH ONLY**

## 1. Punto de partida

Forward Risk V8 conserva valor predictivo de downside. La evidencia histórica cerrada mostró que la combinación:

`V5 vulnerability >= 80 OR V7 options >= 80`

anticipó una parte material de caídas futuras con antelación útil. Los FAIL económicos de V8/V9/V10/V11 no borran ese contenido predictivo: fallaron distintas políticas de ejecución, no necesariamente la información.

Fase 6 no reactiva ninguna de esas políticas.

## 2. Hipótesis Stage A

La primera pregunta de Fase 6 no será todavía “¿cuánto comprar/vender?”, sino:

> Dentro del contexto de decisión que ya recorre `PortfolioCandidateGate`, ¿la información V8 conserva valor incremental para anticipar downside futuro antes de diseñar una nueva política económica?

Esto separa de forma explícita:

1. calidad/información de señal;
2. reach dentro del flujo de candidatos;
3. calidad económica de una política posterior.

## 3. Contexto congelado

Se crea `FORWARD_RISK_CONTEXT_V1` exclusivamente como feature research/shadow.

Reglas:

- score V5: el `vulnerabilityScorePct` ya existente;
- score V7: el `signalScorePct` ya existente;
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

Su punto conceptual de observación es **shadow en la fecha de decisión de `PortfolioCandidateGate`**, antes de que una futura política pudiera monetizarlo.

## 5. Por qué no se diseña aún la política económica

V11 mostró un hallazgo estructural reutilizable: sólo 51 de 272 decisiones `ELIGIBLE` coincidieron con riesgo >80 (18,75%). Aplicar Forward Risk únicamente después del gate dejó poco reach incremental.

Ese diagnóstico permite justificar estudiar el contexto antes/dentro de la decisión, pero **no permite escoger retrospectivamente un nuevo coeficiente, penalización, sizing, waiting period o hurdle económico**.

Por ello Fase 6 se divide en dos muestras independientes si avanza:

1. **Stage A — información contextual:** comprobar valor incremental de V8 en una muestra fresh sellada.
2. **Stage B — política económica:** sólo si Stage A pasa, diseñar una política exacta y validarla después en otra muestra fresh. La muestra Stage A quedará consumida para el diseño de Stage B y no podrá promocionar esa política.

## 6. Muestra Stage A

A fecha de este preregistro:

**`NOT_SELECTED_NOT_OPENED`**.

No se ha abierto market data ni outcomes para seleccionar la muestra.

Antes de cualquier acceso a outcomes deberán congelarse en un segundo preregistro/seal:

- regla de selección fresh/OOS y muestra exacta;
- periodo y warm-up;
- definiciones exactas de outcome predictivo;
- reach mínimo/evaluable;
- gates `PASS / FAIL / INCONCLUSIVE`;
- semántica de datos faltantes;
- fingerprint del runner.

La selección sólo podrá usar criterios estructurales y coverage REAL. No puede usar retornos, drawdowns, crisis, outcomes de V8, reach económico ni current Yahoo discovery para reconstruir retrospectivamente un universo histórico.

Todos los holdouts ya abiertos de Forward Risk V8/V9/V10/V11 permanecen consumidos para promoción.

## 7. Datos y causalidad

Stage A deberá exigir:

- V5 macro/financial vulnerability con datos REAL vintage-safe point-in-time;
- V7 con índices de volatilidad observados de Cboe;
- precios REAL;
- cero fallback sintético;
- `informationDate` causal;
- cualquier outcome futuro utilizado sólo para evaluación después de haber congelado la predicción/contexto de esa fecha.

## 8. Qué queda prohibido

- volver a V8 como interruptor diario ON/OFF;
- reactivar V9, V10 o V11 con otro nombre;
- crear V12/V13 como ajuste retrospectivo;
- elegir la muestra por comportamiento económico conocido;
- usar la misma muestra para diseñar y validar económicamente una nueva policy;
- ajustar el umbral 80 por resultados ya observados;
- conectar Stage A a producción.

## 9. Readiness

El único job habilitado inicialmente para Fase 6 será:

`Fase 6 · Forward Risk V8 como contexto · readiness`

Sólo ejecuta guards estáticos/arquitectónicos y TypeScript. **No consulta mercado, no calcula outcomes y no consume muestra.**

Si readiness pasa, el siguiente paso será congelar la selección de muestra y los gates predictivos Stage A antes de abrir cualquier dato/outcome de validación.

## 10. Producción

Producción permanece:

- `CORE_ARCHITECTURE_V1`;
- allocation/opportunity `LEGACY`;
- `CORE_ELIGIBILITY_V2` shadow;
- Forward Risk sin autoridad productiva.

Este preregistro no autoriza ningún cambio productivo.
