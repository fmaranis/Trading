# Invariantes operativos de cartera

Estas reglas son canónicas para `Mi cartera real` y `Estudio y señales` y no deben romperse en refactors futuros.

## 1. Una sola decisión operativa

`Dónde pondría dinero hoy` y `Qué haría hoy` consumen la misma jerarquía de oportunidades actuales.

- Una oportunidad actual debe superar datos REAL + cash benchmark + consenso BUY + ausencia de tendencia estructural bajista.
- `HIGH_CONVICTION`, `GOOD_ENTRY` y `VALID_ENTRY` son niveles de la misma lista.
- Si una oportunidad recibe capital, `Qué haría hoy` debe reflejar la misma compra y el mismo importe aproximado después de los gates de ejecución.
- El diagnóstico teórico de pesos/categorías es secundario. Nunca puede generar una orden que contradiga una oportunidad actual válida.

## 2. Capital finito

El capital sugerido no es infinito.

- Presupuesto máximo de nuevas compras = liquidez real disponible menos la reserva de cash del perfil/régimen.
- Se priorizan oportunidades por convicción, consenso, exceso frente a cash y riesgo.
- Se aplican límites por activo y categoría.
- La suma de aportaciones propuestas nunca puede superar la liquidez realmente disponible.
- Una oportunidad válida puede recibir 0 EUR si la bloquean concentración/riesgo/costes/valoración; la UI debe explicar el motivo.

## 3. Valor actual no es coste de compra

Para posiciones existentes:

- `investedEur` es coste aportado/base de referencia, no valoración actual.
- El valor actual debe proceder de precio/NAV REAL x títulos/participaciones o de una valoración REAL equivalente.
- Si falta valoración REAL, mostrar `N/D`/valor mínimo conocido y bloquear cálculos que dependan de un patrimonio exacto.
- Nunca rellenar silenciosamente `currentValueEur` con `investedEur`.

Los dos fondos reales Vanguard disponen además de alias Yahoo explícitamente verificados como ruta REAL alternativa cuando EODHD no está disponible:
- `IE00B03HD191` -> `0P00000WLG.F`
- `IE0031786696` -> `0P00012I6A.F`

No deben inferirse aliases de Yahoo para ISIN arbitrarios.

## 4. Rotaciones: liquidez primero

No vender una posición sana mientras exista liquidez material suficiente solo para financiar una oportunidad nueva.

Cuando la liquidez sea escasa, se puede estudiar una rotación si:
- existe una oportunidad `HIGH_CONVICTION` o `GOOD_ENTRY`;
- la posición origen es materialmente menos atractiva;
- la ventaja esperada supera impuestos + comisiones dentro del horizonte configurado.

Fondos traspasables -> fondo elegible: priorizar traspaso fiscalmente diferido.
Acciones/ETF: exigir base FIFO suficiente; si falta, `NEEDS_TAX_DATA`, nunca inventar el coste fiscal.

## 5. Salud vs rotación

- `EXIT`/`REDUCE` por deterioro estructural siguen procediendo del motor de salud individual.
- Sobreponderación por sí sola no vende.
- Una rotación voluntaria de una posición HOLD/WATCH es una decisión económica separada y debe superar el gate fiscal.
- Una salida estructural severa no queda bloqueada por el impuesto; el coste fiscal se informa.

## 6. MyInvestor

Política operativa del usuario: asumir instrumento disponible salvo que el usuario marque explícitamente que no lo está. Esta asunción no equivale a disponibilidad oficialmente verificada.

## 7. Validación

Los tests obligatorios incluyen:
- `currentOpportunityAlerts.unit.ts`
- `currentCapitalAllocation.unit.ts`
- `portfolioRotationReview.unit.ts`
- `portfolioDecisionEngine.unit.ts`
- `fundPortfolio.unit.ts`
- `spanishTaxModel.unit.ts`
- `taxAwareExecutionOverlay.unit.ts`
- `uiResponsivenessContracts.unit.ts`

No usar GitHub Actions. La validación canónica se ejecuta localmente mediante `npm run validate:aistudio` en el entorno de test sincronizado con `main`.

## 8. Integración máxima de interfaz

Regla de arquitectura UX: **integrar antes de crear**.

- Una pregunta del usuario debe resolverse en una única superficie visible siempre que sea posible.
- Antes de añadir una tarjeta, panel, buscador, tabla o módulo visible nuevo, comprobar si la función puede integrarse en una superficie existente.
- Dos controles que buscan, seleccionan o analizan el mismo concepto deben compartir el mismo flujo y estado; no se crean buscadores paralelos.
- Un nuevo motor interno, test o fuente de datos no justifica por sí mismo una nueva sección visible.
- Los rankings deben alimentar el mismo analizador que usa la búsqueda manual; abrir un candidato no debe crear otro workspace equivalente.
- Solo se mantiene una sección separada cuando responde a una pregunta materialmente distinta. Ejemplo válido: `Validación general del motor` puede separarse de `Estudio de inversiones y señales` porque evalúa robustez histórica global, no un activo concreto.
- En `Estudio de inversiones y señales`, catálogo, escritura manual de ticker/ISIN, selección, gráfica, señales y ranking forman un único flujo integrado.

Esta regla tiene prioridad sobre la comodidad de implementar una feature como componente visible independiente. La modularidad interna del código se conserva, pero no debe trasladarse automáticamente a fragmentación de la interfaz.
