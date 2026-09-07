# Forward Risk V10 — preregistro congelado

Fecha de sellado: **2026-09-07**  
Protocolo: `V10_PREREG_2026_09_07`  
Política: `V10_POLICY_1`  
Estado: **POLICY_FROZEN / LOCAL_GUARDS_PASS / HOLDOUT_SEALED_READY_FOR_ONE_SHOT_OPEN / RESEARCH_ONLY**

Fingerprint congelado:

`sha256:be5dfdfb369e51d28f5e4f3ac1797f7d8bbd3ae0be625be705c9625bfbf4ae0f`

## 1. Motivo del cambio arquitectónico

V8 demostró información anticipativa útil pero falló como interruptor transaccional directo. V9 añadió histéresis, redujo el chattering, pero el blind histórico falló tanto en anticipación agregada como, sobre todo, en economía. La lección admisible para V10 es únicamente arquitectónica: **no convertir automáticamente una señal de riesgo en una venta de posiciones existentes**.

No se permite usar los resultados V9 para optimizar porcentajes, ventanas, thresholds o gates V10.

## 2. Hipótesis V10

V10 usa Forward Risk como **control de admisión de dinero nuevo** y combina dos direcciones de evidencia:

- riesgo bajista: señal V8 congelada `V5 >=80 OR V7 >=80`;
- oportunidad alcista / conveniencia de entrada: booleano productivo existente `PortfolioCandidateGate = ELIGIBLE`.

V10 no construye un predictor alcista nuevo ni añade un threshold de oportunidad propio.

## 3. Regla económica congelada

Las posiciones existentes se mantienen siempre:

`NEVER_SELL_OR_REDUCE`

Para cada nueva aportación:

1. V8 OFF -> invertir 100% `NEXT_OPEN`.
2. V8 ON + oportunidad `ELIGIBLE` -> invertir 100% `NEXT_OPEN`; la oportunidad anula el aplazamiento por riesgo.
3. V8 ON + oportunidad no elegible -> aplazar 100% en cash remunerado.
4. El cash aplazado se revisa cada sesión.
5. Se libera 100% `NEXT_OPEN` en el primer evento entre:
   - V8 pasa a OFF;
   - el activo pasa a `ELIGIBLE`;
   - se alcanzan 63 sesiones de aplazamiento.
6. Nunca hay venta de una posición existente dentro de `V10_POLICY_1`.

Semántica económica:
- aportación: **1.000 €**;
- calendario: primera sesión de mercado de cada mes natural;
- títulos enteros;
- broker/comisiones MyInvestor existentes;
- cash `HISTORICAL_ECB_DFR_FLOOR_0_AFTER_TAX`;
- sin impuesto de plusvalías por V10 porque V10 no vende posiciones; sólo fiscalidad del interés de cash;
- baseline: cada aportación se invierte inmediatamente `NEXT_OPEN`.

## 4. Holdout V10 sellado

Selección exclusivamente estructural, antes de abrir históricos para V10. Ninguno aparece en `EUR_ASSET_UNIVERSE`, `EUR_VALIDATION_HOLDOUT_UNIVERSE` ni en el holdout V9.

- `V10_BLIND_VGVF` — `VGVF.DE` — IE00BK5BQV03 — FTSE Developed World.
- `V10_BLIND_VNRA` — `VNRA.DE` — IE00BK5BQW10 — FTSE North America.
- `V10_BLIND_VFEM` — `VFEM.DE` — IE00B3VVMM84 — FTSE Emerging Markets.
- `V10_BLIND_VERE` — `VERE.DE` — IE00BK5BQY34 — FTSE Developed Europe ex UK.
- `V10_BLIND_VGEK` — `VGEK.DE` — IE00BK5BQZ41 — FTSE Developed Asia Pacific ex Japan.
- `V10_BLIND_VJPN` — `VJPN.DE` — IE00B95PGT31 — FTSE Japan.

Los seis activos V9 (`SPPW.DE`, `SPY5.DE`, `SPYM.DE`, `ZPRS.DE`, `VGEU.DE`, `ZPDJ.DE`) quedan contaminados y no pueden reutilizarse como validación V10.

No se permite sustituir un activo tras abrir el holdout, tampoco por datos insuficientes o por fallo de calidad.

## 5. Gate previo de calidad de datos

Antes de calcular resultados V10, cada serie debe cumplir:

- >=756 barras válidas;
- >=36 eventos mensuales de aportación;
- >=6 aportaciones realmente aplazadas y completadas para que la evaluación individual sea informativa;
- fechas únicas;
- open/close positivos;
- ninguna variación close-to-close absoluta de una sola sesión >40%.

Una anomalía de este tipo deja el activo `INVALID_DATA`. Si quedan menos de 6 válidos, el blind agregado será `INCONCLUSIVE`. No se reemplaza el caso.

Este gate se fijó antes de abrir el holdout para evitar repetir el problema de datos observado retrospectivamente en ZPDJ durante V9.

## 6. Gate de balance caída/subida

Para cada aportación que V10 decida aplazar, se observa **sólo como auditoría posterior** la trayectoria que habría seguido el baseline inmediato durante las siguientes 63 sesiones y se clasifica el primer evento:

- `DOWN_FIRST`: alcanza -5% antes que +5%;
- `UP_FIRST`: alcanza +5% antes que -5%;
- `NEITHER`: ninguno de los dos.

Esta clasificación nunca interviene en la decisión histórica. Sirve para medir directamente si esperar evita más caídas de las que hace perder subidas.

## 7. Gate económico congelado

PASS individual:

`finalDeltaEur >= 0 AND medianDeferredExecutionPriceImprovementPct >= 0 AND downFirstCount >= upFirstCount`

PASS agregado:

- 6/6 activos blind válidos;
- >=4/6 PASS individuales;
- mediana `finalDeltaEur >= 0`;
- mediana de mejora de precio de ejecución aplazada >=0%;
- suma `DOWN_FIRST >= UP_FIRST`.

No hay grid ni ajuste de 63 sesiones, ±5%, 1.000 €, número mínimo de casos o criterio de PASS tras ver resultados.

## 8. Causalidad del lado oportunidad

La validación blind debe reutilizar `PortfolioCandidateGate.apply` exactamente. Para cada fecha histórica se reconstruye un `AssetUniverseScanResult` usando **sólo el prefijo de barras disponible hasta esa fecha**. Así, `ELIGIBLE` se obtiene con el mismo cash hurdle, consenso, estructura de tendencia y `EntryTimingEngine` que el motor, sin usar precios posteriores.

## 9. Guard local — PASS

Ejecutado localmente el **2026-09-07** antes de abrir el holdout:

- `forwardRiskV10Policy.unit: PASS`;
- `forwardRiskV10ValidationProtocol.unit: PASS`;
- `npm run lint` / `tsc --noEmit: PASS`.

El fingerprint y todas las reglas anteriores permanecen sin cambios.

## 10. Confirmación temporal futura

Reservada desde **2026-09-08** inclusive. Ningún dato posterior a esa fecha puede usarse para tuning V10.

## 11. Secuencia vigente

1. **COMPLETADO:** guard local V10 PASS.
2. **COMPLETADO:** registrar `localImplementationGates.status = PASS` sin cambiar política ni fingerprint.
3. **COMPLETADO:** construir runner blind one-shot causal y su guard estático.
4. Ejecutar desde la app **Forward Risk · V10 · validación blind**. El job vuelve a ejecutar guards + TypeScript antes de abrir los seis históricos.
5. PASS, FAIL o INCONCLUSIVE se registra tal cual; no se retunea V10 sobre la muestra abierta.
6. Los seis activos quedan consumidos para V10 al completarse la apertura, cualquiera que sea el resultado.

La interfaz muestra sólo la validación Forward Risk vigente. V8, V9 y guards ya cerrados quedan archivados para trazabilidad, sin acumular botones ejecutables.

Nunca usar GitHub Actions, Gemini ni agentes para el cálculo largo.
