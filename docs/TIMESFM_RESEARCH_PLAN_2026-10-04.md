# TimesFM Research Plan — 2026-10-04

## Estado
PRIORITY / READY TO EXECUTE / RESEARCH-ONLY

## Propósito
Determinar si Google TimesFM aporta capacidad predictiva incremental, causal y económicamente útil a la arquitectura de trading existente sin contaminar producción ni retunear retrospectivamente.

## Licencias
- TimesFM 3.0: benchmark/research únicamente. Código Apache-2.0; pesos preentrenados bajo licencia no comercial/no producción.
- TimesFM 2.5: pesos Apache-2.0; candidato para reproducir cualquier hallazgo que eventualmente necesite una vía compatible con producción.

## Reglas no negociables
1. Producción sigue LEGACY.
2. No cambiar PortfolioCandidateGate, eligibility, sizing u órdenes productivas.
3. No usar outcomes para seleccionar parámetros después de abrir la muestra.
4. Señal en fecha T sólo usa datos disponibles <= T.
5. Entrada económica, cuando se evalúe, usa NEXT_OPEN.
6. Cero fallback sintético silencioso.
7. Registrar versión exacta del modelo, checkpoint, inputs, fechas y hashes de evidencia.

## Stage A — smoke técnico
- Integrar un runner Python local/backend separado del frontend.
- Cargar TimesFM 3.0 sin modificar producción.
- Probar inferencia determinista/repetible sobre una pequeña cesta de activos.
- Validar que no existe lookahead y que los cutoffs terminan en informationDate.
- Persistir forecasts y cuantiles, no recomendaciones.

Criterio de parada: si instalación/inferencia o causalidad no son reproducibles, bloquear antes de outcomes económicos.

## Stage B — benchmark predictivo congelado
Predicciones: 1, 5, 20 y 60 sesiones.

Targets primarios:
- retorno forward;
- retorno relativo al benchmark;
- downside/max drawdown futuro;
- calibración/incertidumbre mediante cuantiles.

Baselines obligatorios:
- cero/naive;
- Buy & Hold cuando aplique;
- momentum simple congelado;
- LEGACY actual.

Métricas mínimas:
- directional accuracy;
- Spearman/rank IC;
- MAE/RMSE para forecast continuo cuando proceda;
- cobertura/calibración de cuantiles;
- lift frente a baselines;
- estabilidad por activo y régimen.

## Stage C — traducción económica
Sólo si Stage B muestra señal fresh útil.

Comparar:
- LEGACY;
- TimesFM puro;
- LEGACY + TimesFM como contexto/filtro.

Métricas:
- CAGR;
- Sharpe/Sortino;
- max drawdown;
- hit rate;
- turnover/costes;
- alpha relativo;
- estabilidad por submuestras.

No optimizar thresholds sobre la misma muestra que decide PASS/FAIL.

## Stage D — licencia/portabilidad
Si 3.0 aporta valor:
1. reproducir el protocolo con TimesFM 2.5 Apache-2.0;
2. medir degradación/mejora frente a 3.0;
3. sólo considerar una integración productiva si existe evidencia independiente y una vía de licencia compatible.

## Resultado esperado
Uno de:
- NO_SIGNAL: cerrar sin tocar producción;
- RESEARCH_SIGNAL_ONLY: 3.0 útil pero no portable/productivo;
- PORTABLE_CANDIDATE: 2.5 reproduce señal suficiente y pasa a confirmación fresh independiente;
- PROMOTION_CANDIDATE: únicamente tras confirmación separada posterior.

## Siguiente paso exacto
Implementar Stage A y congelar antes de abrir outcomes el universo/muestra, inputs, horizons, targets, baselines y criterios PASS/FAIL.
