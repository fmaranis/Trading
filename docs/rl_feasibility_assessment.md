# Evaluación de Viabilidad de Reinforcement Learning (RL / FinRL)

```text
FINRL_DECISION: DEFER
Motivo: Actualmente no existe evidencia Out-of-Sample suficiente para justificar la complejidad adicional de RL.
```

## 1. Declaración de Estado y Decisión Arquitectónica

- **Decisión Formal:** `FINRL_DECISION: DEFER`
- **Arquitectura de Producción Actual:** `TypeScript BacktestEngine + vectorbt Backend + Walk-Forward Optimization (WFO)`.
- **Alcance de RL Futuro:** módulo experimental desacoplado que no reemplaza las piezas deterministas existentes.
- **Dependencias:** no se añaden `torch`, `gymnasium`, `stable-baselines3` ni `finrl`.

## 2. Riesgo de Overfitting

Strategy Allocation se clasifica como riesgo **MEDIO / CONTROLABLE**, con exposición a regímenes históricos, secuencias de volatilidad, hiperparámetros, reward, semillas y particionado temporal.

## 3. Caso de Uso Candidato

```text
Candidate RL Use Case: Strategy Allocation / Meta-Selector
(PROHIBIDO: Raw buy/sell price prediction)
```

Acciones futuras permitidas: `CASH`, `SMA`, `RSI`, `MOMENTUM`.

## 4. Protocolo Anti-Look-Ahead

Todos los features se calculan con información disponible en `t` o anterior. Las decisiones tomadas al cierre `t` se ejecutan en `Open(t+1)` incluyendo costes y slippage. La normalización se ajusta exclusivamente sobre Train y se aplica después a Validation/Test.

## 5. Reward

La futura reward deberá combinar retorno neto, penalización por drawdown y penalización por turnover. Los coeficientes de penalización quedan **UNSPECIFIED / TO BE TUNED ON VALIDATION ONLY**.

## 6. Pre-Registered Acceptance Criteria

Antes de cualquier entrenamiento deberán congelarse los criterios OOS. El agente tendrá que superar al mejor baseline clásico WFO en múltiples ventanas OOS, con al menos 5 semillas y reporte de media, mediana, desviación típica, mínimo y máximo. No se permite cherry-picking del mejor seed.

## 7. FinRL vs Stable-Baselines3

Arquitectura experimental preferida: `Custom Gymnasium Environment + Stable-Baselines3`. FinRL queda en estado `DEFER` salvo que aporte componentes concretos que reduzcan código sin perder trazabilidad.

## 8. Prerrequisitos para Reconsiderar RL

- Datos de mercado reales.
- Profundidad histórica de 5–10 años diarios.
- Varios regímenes de mercado.
- Baselines WFO consolidados.
- Validación multi-activo en varias clases de activos.

## 9. Próxima Prioridad

**Multi-Asset Backtesting y Asignación Cuantitativa Determinista**. Esta línea aporta valor práctico inmediato y crea la base necesaria para cualquier futuro meta-modelo.

```text
FINRL_DECISION: DEFER
Motivo: Actualmente no existe evidencia Out-of-Sample suficiente para justificar la complejidad adicional de RL.
```
