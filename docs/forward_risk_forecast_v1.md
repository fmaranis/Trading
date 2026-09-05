# FORWARD_RISK_FORECAST_V1

## Estado

Experimento predictivo aislado. **NO PRODUCTIVO**.

`CORE_ALPHA_V2` queda rechazado por evidencia económica: aumentó actividad y empeoró el resultado frente a `CORE_ARCHITECTURE_V1` y frente al core global. El replay productivo vuelve a `CORE_ARCHITECTURE_V1`.

## Pregunta que debe responder

> ¿Puede una señal calculada únicamente con información disponible en cada fecha mejorar económicamente una inversión 100% en el core global, anticipando riesgo futuro en lugar de reaccionar a pérdidas ya materializadas?

No se permite responder esta pregunta mediante reglas ajustadas a 2020/2022 ni mediante información futura en features, entrenamiento o ejecución.

## Targets predictivos

Tres problemas binarios independientes:

1. probabilidad de drawdown >= 3% en las próximas 5 sesiones;
2. probabilidad de drawdown >= 5% en las próximas 20 sesiones;
3. probabilidad de drawdown >= 10% en las próximas 60 sesiones.

La etiqueta se calcula contra el mínimo futuro del core desde el cierre de la fecha de información. Esa etiqueta sólo puede entrar en entrenamiento cuando **todo su horizonte ya ha terminado** antes de la nueva fecha de forecast.

## Features V1

Todas son causales/trailing:

- retornos core 5/20/60/120;
- volatilidad realizada 5/20/60 y downside volatility 20;
- drawdown rolling 20/60/252;
- distancia a SMA20/50/200;
- aceleración de volatilidad;
- breadth del universo invertible: retornos positivos 20/60 y porcentaje sobre SMA50/SMA200;
- dispersión cross-sectional;
- fuerza relativa de activos defensivos vs riesgo;
- VIX 30d: nivel, cambios 5/20 y z-score 60;
- VIX/VIX3M como estructura temporal cuando exista.

VIX y VIX3M son **series diagnósticas no invertibles**. Nunca entran en el universo de órdenes.

## Modelo

- walk-forward estricto;
- ventana causal máxima: 1512 sesiones (~6 años);
- mínimo de entrenamiento: 504 sesiones (~2 años);
- reentrenamiento: cada 20 sesiones;
- features estandarizadas sólo con el training vigente;
- ridge regularizado + calibración probabilística;
- sin K-fold aleatorio;
- sin entrenamiento con etiquetas cuyo futuro se solape con la fecha de forecast.

La simplicidad es deliberada. La primera evidencia debe demostrar que existe señal predictiva antes de justificar modelos más complejos.

## Conversión de forecast a exposición

Se combinan los percentiles de riesgo de los tres horizontes, calculados respecto de la distribución de predicciones del training vigente:

- riesgo < p70: 100% core;
- p70-p85: 90% core;
- p85-p95: 80% core;
- >= p95: 70% core.

La reducción de riesgo puede ser inmediata. La recuperación sólo sube 10 puntos porcentuales tras cinco sesiones consecutivas bajo p65 para limitar whipsaw.

Toda señal se genera con información de cierre y se ejecuta al **siguiente open** del core.

## Validación estadística

Por cada horizonte:

- AUC;
- Brier score;
- tasa base del evento;
- tasa del evento en el decil de mayor riesgo;
- lift del decil superior frente a la tasa base.

`predictiveSignalPass` exige inicialmente:

- AUC > 0.52 en los tres horizontes;
- AUC media > 0.55.

Esto no basta para producción: es sólo evidencia de señal.

## Validación económica

Se calcula contra 100% buy-and-hold del mismo core, mismo capital y mismo primer open.

### Frictionless

Techo teórico. Fracciones permitidas y sin costes de compraventa. El cash sí sigue la política configurada.

Sólo sirve para responder: **¿hay suficiente señal como para que merezca la pena continuar?**

### Realistic

- unidades ETF enteras;
- comisión del broker;
- 30% conservador sobre plusvalías realizadas;
- 19% sobre intereses de cash;
- sin compensar minusvalías, por lo que el supuesto fiscal es deliberadamente conservador.

`economicPassRealistic` requiere:

- final neto superior a buy-and-hold;
- drawdown no peor que el core en más de 0.5 pp.

## Regla de decisión

1. Si no gana ni frictionless: **REJECT**. No ajustar thresholds sobre ese mismo replay.
2. Si gana frictionless pero no realistic: señal insuficiente para producción; estudiar fricción/vehículo fiscal sólo si la ventaja bruta es material.
3. Si gana realistic: repetir en periodos separados/rolling y con cores equivalentes antes de cualquier integración live.
4. Sólo tras validación robusta se podrá plantear que el predictor module exposición real.

## Aislamiento de producción

`FORWARD_RISK_FORECAST_V1` no importa ni modifica `PortfolioDecisionEngine`, `evaluatePortfolioDecision`, alertas Telegram ni cartera real. El worker lo ejecuta sólo como auditoría final del replay. La política normal permanece `CORE_ARCHITECTURE_V1`.
