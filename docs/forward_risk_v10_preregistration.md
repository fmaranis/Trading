# Forward Risk V10 — preregistro congelado y resultado blind

Fecha de sellado: **2026-09-07**  
Protocolo: `V10_PREREG_2026_09_07`  
Política: `V10_POLICY_1`  
Estado: **BLIND_FAIL / POLICY_RETIRED / HOLDOUT_CONSUMED / RESEARCH_ONLY**

Fingerprint congelado:

`sha256:be5dfdfb369e51d28f5e4f3ac1797f7d8bbd3ae0be625be705c9625bfbf4ae0f`

## 1. Motivo del cambio arquitectónico

V8 demostró información anticipativa útil pero falló como interruptor transaccional directo. V9 añadió histéresis, redujo el chattering, pero el blind histórico falló tanto en anticipación agregada como, sobre todo, en economía. La lección admisible para V10 fue únicamente arquitectónica: **no convertir automáticamente una señal de riesgo en una venta de posiciones existentes**.

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

## 4. Holdout V10 — abierto y consumido

La selección se hizo exclusivamente por criterios estructurales antes de abrir históricos para V10. Ninguno aparecía en `EUR_ASSET_UNIVERSE`, `EUR_VALIDATION_HOLDOUT_UNIVERSE` ni en el holdout V9.

- `V10_BLIND_VGVF` — `VGVF.DE` — IE00BK5BQV03 — FTSE Developed World.
- `V10_BLIND_VNRA` — `VNRA.DE` — IE00BK5BQW10 — FTSE North America.
- `V10_BLIND_VFEM` — `VFEM.DE` — IE00B3VVMM84 — FTSE Emerging Markets.
- `V10_BLIND_VERE` — `VERE.DE` — IE00BK5BQY34 — FTSE Developed Europe ex UK.
- `V10_BLIND_VGEK` — `VGEK.DE` — IE00BK5BQZ41 — FTSE Developed Asia Pacific ex Japan.
- `V10_BLIND_VJPN` — `VJPN.DE` — IE00B95PGT31 — FTSE Japan.

Los seis activos V9 (`SPPW.DE`, `SPY5.DE`, `SPYM.DE`, `ZPRS.DE`, `VGEU.DE`, `ZPDJ.DE`) ya estaban contaminados y no se reutilizaron.

Los seis activos V10 anteriores quedaron **consumidos permanentemente** al completarse la ejecución blind. No pueden utilizarse para retuning, V10.1 ni como blind limpio de un sucesor.

## 5. Gate previo de calidad de datos

Cada serie debía cumplir:

- >=756 barras válidas;
- >=36 eventos mensuales de aportación;
- >=6 aportaciones realmente aplazadas y completadas;
- fechas únicas;
- open/close positivos;
- ninguna variación close-to-close absoluta de una sola sesión >40%.

Los **6/6 activos** superaron este gate y fueron válidos. Por tanto, el resultado no es `INCONCLUSIVE` por calidad o falta de datos.

## 6. Gate de balance caída/subida

Para cada aportación que V10 decide aplazar, se observa **sólo como auditoría posterior** la trayectoria que habría seguido el baseline inmediato durante las siguientes 63 sesiones y se clasifica el primer evento:

- `DOWN_FIRST`: alcanza -5% antes que +5%;
- `UP_FIRST`: alcanza +5% antes que -5%;
- `NEITHER`: ninguno de los dos.

Esta clasificación nunca interviene en la decisión histórica.

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

La validación blind reutiliza `PortfolioCandidateGate.apply` exactamente. Para cada fecha histórica se reconstruye un `AssetUniverseScanResult` usando **sólo el prefijo de barras disponible hasta esa fecha**. Así, `ELIGIBLE` se obtiene con el mismo cash hurdle, consenso, estructura de tendencia y `EntryTimingEngine` que el motor, sin usar precios posteriores.

La clasificación `DOWN_FIRST / UP_FIRST / NEITHER` se calcula después de la decisión y nunca la alimenta.

## 9. Guard local — PASS previo a apertura

Ejecutado localmente el **2026-09-07** antes de abrir el holdout:

- `forwardRiskV10Policy.unit: PASS`;
- `forwardRiskV10ValidationProtocol.unit: PASS`;
- `npm run lint` / `tsc --noEmit: PASS`.

El fingerprint y todas las reglas anteriores permanecieron sin cambios.

## 10. Resultado blind one-shot

Ejecución completada localmente el **2026-09-07**, evaluada hasta **2026-09-01**.

Veredicto:

`V10_BLIND_FAIL_RETIRE_V10_POLICY_1`

Resultado agregado:
- activos válidos: **6/6**;
- PASS individuales: **0/6**;
- mediana `finalDeltaEur`: **-219,25 €**;
- mediana `medianDeferredExecutionPriceImprovementPct`: **-1,1907%**;
- `DOWN_FIRST`: **34**;
- `UP_FIRST`: **28**;
- `NEITHER`: **9**;
- aportaciones aplazadas totales: **71**.

Resumen por activo:

| Ticker | Aportaciones | Aplazadas | Delta final V10 vs baseline | Mejora mediana precio aplazado | DOWN_FIRST | UP_FIRST | NEITHER | PASS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| VGVF.DE | 79 | 8 | -138,50 € | -1,1286% | 5 | 3 | 0 | NO |
| VNRA.DE | 85 | 10 | -337,18 € | -1,2529% | 4 | 6 | 0 | NO |
| VFEM.DE | 107 | 18 | -334,85 € | -1,3930% | 7 | 7 | 4 | NO |
| VERE.DE | 86 | 10 | -11,58 € | -1,2901% | 5 | 4 | 1 | NO |
| VGEK.DE | 84 | 8 | -74,19 € | -1,1096% | 4 | 3 | 1 | NO |
| VJPN.DE | 107 | 17 | -300,00 € | +0,0391% | 9 | 5 | 3 | NO |

## 11. Interpretación cerrada

El blind separa dos hechos distintos:

1. **La señal de riesgo conserva cierta información direccional.** En el agregado, las aportaciones aplazadas registran más `DOWN_FIRST` que `UP_FIRST` (34 frente a 28).
2. **La política económica de espera V10 no monetiza esa información.** En 5/6 activos el precio mediano al liberar el cash fue peor que el precio de compra inmediata y los 6/6 terminaron con delta final negativo.

Por tanto, detectar una caída futura con cierta frecuencia **no basta** para mejorar el momento de entrada. La regla `riesgo ON -> esperar hasta riesgo OFF / oportunidad ELIGIBLE / 63 sesiones` tiende a liberar el dinero después de parte de la recuperación y pierde precio de entrada.

Esto no autoriza a probar sobre estos mismos seis activos otras ventanas, porcentajes, umbrales, confirmaciones o reglas de liberación. `V10_POLICY_1` queda retirada.

## 12. Confirmación temporal futura

La ventana future-forward reservada desde **2026-09-08** no se utiliza para promocionar V10 porque la política ya ha fallado el blind histórico.

Tampoco puede usarse para retuning de `V10_POLICY_1`.

## 13. Consecuencia metodológica

Si Forward Risk continúa, debe hacerlo como **arquitectura nueva**, con política preregistrada y holdout histórico independiente todavía no inspeccionado. El aprendizaje admisible de V10 es arquitectónico: el control binario de aplazar el 100% hasta una señal de liberación sigue siendo demasiado tardío para monetizar la información de riesgo.

La interfaz archiva V10 como `blind FAIL · retirada` y no deja un botón V10 relanzable.

Nunca usar GitHub Actions, Gemini ni agentes para el cálculo largo.