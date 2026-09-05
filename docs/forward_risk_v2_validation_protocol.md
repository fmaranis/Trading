# Forward Risk Forecast V2 — protocolo de validación congelado

## Objetivo

`FORWARD_RISK_FORECAST_V2` existe para responder una sola pregunta antes de cualquier política de cartera:

> ¿Existe información causal observable antes del último máximo previo a una caída que permita elevar de forma útil la probabilidad de una caída posterior?

V2 no puede modificar Custodia, `PortfolioDecisionEngine`, Telegram ni posiciones reales mientras este protocolo no se supere.

## Baseline

- V1 permanece sin sustituir como referencia experimental histórica.
- El replay productivo sigue usando `CORE_ARCHITECTURE_V1`.
- V2 se calcula únicamente como auditoría paralela en el tramo final del replay.
- Una AUC invertida se informa para diagnóstico, pero jamás se usa para invertir automáticamente el score.

## Targets PRE_CRASH

Horizontes independientes:

| Horizonte | Evento futuro | Máximo drawdown actual permitido para ser fila PRE_CRASH |
| --- | --- | --- |
| 5 sesiones | caída >= 3% | 1.5% |
| 20 sesiones | caída >= 5% | 2.0% |
| 60 sesiones | caída >= 10% | 3.0% |

Si el mercado ya supera el drawdown de calma correspondiente, esa fila queda fuera del target de ese horizonte. Reconocer una crisis ya iniciada no cuenta como anticipación.

## Causalidad obligatoria

Para un forecast en la sesión `t`, una fila histórica sólo puede entrar en entrenamiento cuando su ventana futura completa ya terminó antes de `t`.

No se permite:

- K-fold aleatorio sobre series temporales.
- Etiquetas cuyo futuro se solape con la fecha del forecast.
- Uso de información posterior al cierre disponible.
- Recalibrar retrospectivamente la orientación del score para mejorar el backtest.

Toda hipotética ejecución posterior deberá ser, como mínimo, al siguiente `open` del core.

## Modelo V2

- Regresión logística causal ponderada por desbalance de clases.
- Estandarización calculada exclusivamente con la ventana de entrenamiento.
- Regularización Elastic Net.
- Ventana móvil máxima: 1512 sesiones.
- Mínimo de entrenamiento: 504 filas válidas por horizonte.
- Reentrenamiento: cada 20 sesiones.
- Probabilidad recalibrada al event-rate causal de la propia ventana de entrenamiento.

## Familias de features

V2 prioriza variables de deterioro y divergencia, no sólo variables de estrés ya materializado:

- desaceleración de momentum;
- aceleración de volatilidad y downside volatility;
- cambio de drawdown y distancia a medias;
- deterioro de breadth;
- aumento de dispersión cross-sectional;
- rotación relativa hacia defensivos;
- divergencia precio-breadth;
- aceleración del VIX;
- pendiente y cambio de `VIX/VIX3M`.

Los horizontes 5/20/60 se mantienen separados. Una señal extrema en uno de ellos no puede diluirse mediante media aritmética con los otros dos.

## Métricas obligatorias

Por horizonte deben exportarse al menos:

- event rate;
- AUC directa;
- AUC invertida diagnóstica;
- orientación DIRECT / INVERTED / UNRESOLVED;
- top-decile event rate;
- lift frente al event rate base;
- número de forecasts >= percentil 80;
- precisión de esos forecasts;
- tasa de falsos positivos de esos forecasts.

Además, por episodio de caída:

- último máximo anterior al breach;
- fecha del breach;
- primera fecha >= percentil 80 antes del máximo;
- sesiones de anticipación respecto al máximo;
- máximo percentil observado antes del máximo;
- indicador explícito `anticipatedBeforePeak`.

El resumen debe incluir porcentaje de episodios anticipados y mediana de sesiones de ventaja.

## Gates predictivos congelados

Antes de cualquier optimización económica:

1. Las tres AUC deben ser > 0.50.
2. La AUC media debe ser > 0.55.
3. Al menos dos horizontes deben superar 0.55.
4. Ningún horizonte puede quedar con orientación `INVERTED`.
5. Debe anticiparse al menos el 50% de los episodios auditables.
6. La mediana de anticipación de los episodios acertados debe ser >= 2 sesiones antes del último máximo.

`predictiveSignalPass` y `anticipationPass` son independientes y ambos deben revisarse.

## Episodios de control

El replay de referencia 01/09/2016–31/08/2026 debe revisarse expresamente alrededor de:

- correcciones de 2018;
- shock COVID de 2020;
- deterioro de 2022;
- otros breaches detectados automáticamente por el mismo algoritmo de auditoría.

Estos episodios sirven para explicar el comportamiento, no para modificar los thresholds después de conocer el resultado.

## Secuencia de desarrollo

1. Compilar y ejecutar guards de arquitectura.
2. Ejecutar el replay largo una sola vez con V1 y V2 en paralelo.
3. Leer V2 sin modificar sus thresholds.
4. Diagnosticar orientación, anticipación, falsos positivos y feature weights.
5. Sólo si V2 muestra señal predictiva robusta, diseñar una política económica separada que decida cuánto reducir, durante cuánto tiempo y cómo minimizar turnover/fiscalidad.
6. Esa política económica tendrá su propio A/B contra 100% core y contra Custodia; nunca se validará retrospectivamente usando los mismos datos empleados para escoger sus reglas.

## Estado

Este documento congela el criterio antes del primer replay completo de V2. Un resultado `PASS` de compilación no implica que el predictor esté validado.