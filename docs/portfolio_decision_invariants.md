# Invariantes operativos de cartera

Estas reglas son canónicas para `Mi cartera real` y `Estudio y señales` y no deben romperse en refactors futuros.

## 1. Una sola decisión operativa y acción primero

`Mi cartera real` debe responder primero una sola pregunta: **¿muevo dinero hoy o no?**

La superficie principal debe producir únicamente una de estas clases de salida:
- comprar / suscribir un activo con un importe realmente financiado;
- reducir o salir de una posición por deterioro estructural;
- rotar / traspasar capital de una posición a otra cuando el gate económico y fiscal lo justifique;
- no mover dinero.

Reglas:
- Una oportunidad actual debe superar datos REAL + cash benchmark + consenso BUY + ausencia de tendencia estructural bajista.
- `HIGH_CONVICTION`, `GOOD_ENTRY` y `VALID_ENTRY` describen fuerza relativa de una oportunidad, pero **solo una oportunidad con capital asignado se presenta como compra operativa hoy**.
- Una oportunidad válida con 0 EUR asignados es secundaria y debe quedar plegada; nunca puede competir visualmente con una compra financiada.
- `EXIT`/`REDUCE` se integran en la misma decisión superior, no en una segunda recomendación paralela.
- Las rotaciones se integran en la misma decisión superior, no en otra tarjeta principal.
- El antiguo detalle de ejecución, fiscalidad, consenso y gates puede conservarse como explicación técnica desplegable, pero no como otra respuesta independiente a “qué haría hoy”.
- El diagnóstico teórico de pesos/categorías es secundario. Nunca puede generar una orden que contradiga la decisión operativa actual.

## 2. Calidad de datos no es convicción ni probabilidad

`InvestmentDecisionResult.confidence` y `confidenceScore` miden **calidad de datos**: actualidad, profundidad histórica y capacidad de clasificar el régimen.

- Nunca etiquetarlos simplemente como `Evidencia` en la superficie principal.
- Nunca interpretarlos como probabilidad de beneficio, probabilidad de acierto o convicción de una compra.
- Deben aparecer como `Calidad de datos` dentro de detalles técnicos secundarios.
- La convicción de una compra procede de los gates de oportunidad/consenso (`HIGH_CONVICTION`, `GOOD_ENTRY`, votos, tendencia, exceso frente a cash, riesgo), no del `confidenceScore` del asignador general.

## 3. Capital finito

El capital sugerido no es infinito.

- Presupuesto máximo de nuevas compras = liquidez real disponible menos la reserva de cash del perfil/régimen.
- Se priorizan oportunidades por convicción, consenso, exceso frente a cash y riesgo.
- Se aplican límites por activo y categoría.
- La suma de aportaciones propuestas nunca puede superar la liquidez realmente disponible.
- Una oportunidad válida puede recibir 0 EUR si la bloquean concentración/riesgo/costes/valoración; la UI debe explicarlo solo como información secundaria.

## 4. Valor actual no es coste de compra

Para posiciones existentes:

- `investedEur` es coste aportado/base de referencia, no valoración actual.
- El valor actual debe proceder de precio/NAV REAL x títulos/participaciones o de una valoración REAL equivalente.
- Si falta valoración REAL, mostrar `N/D`/valor mínimo conocido y bloquear cálculos que dependan de un patrimonio exacto.
- Nunca rellenar silenciosamente `currentValueEur` con `investedEur`.

Fondos con alias Yahoo verificados conocidos:
- `IE00B03HD191` -> `0P00000WLG.F`
- `IE0031786696` -> `0P00012I6A.F`
- `ES0174115065` -> `0P0001PBAK.F`

Para ISIN no catalogados puede usarse resolución automática Yahoo de forma lazy, pero solo se acepta una coincidencia compatible, no ambigua y con histórico REAL verificable. Nunca se inventa un alias.

## 5. Rotaciones: liquidez primero

No vender una posición sana mientras exista liquidez material suficiente solo para financiar una oportunidad nueva.

Cuando la liquidez sea escasa, se puede estudiar una rotación si:
- existe una oportunidad `HIGH_CONVICTION` o `GOOD_ENTRY`;
- la posición origen es materialmente menos atractiva;
- la ventaja esperada supera impuestos + comisiones dentro del horizonte configurado.

Fondos traspasables -> fondo elegible: priorizar traspaso fiscalmente diferido.
Acciones/ETF: exigir base FIFO suficiente; si falta, `NEEDS_TAX_DATA`, nunca inventar el coste fiscal.

## 6. Salud vs rotación

- `EXIT`/`REDUCE` por deterioro estructural siguen procediendo del motor de salud individual.
- Sobreponderación por sí sola no vende.
- Una rotación voluntaria de una posición HOLD/WATCH es una decisión económica separada y debe superar el gate fiscal.
- Una salida estructural severa no queda bloqueada por el impuesto; el coste fiscal se informa.

## 7. MyInvestor

Política operativa del usuario: asumir instrumento disponible salvo que el usuario marque explícitamente que no lo está. Esta asunción no equivale a disponibilidad oficialmente verificada.

## 8. Validación

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

## 9. Integración máxima de interfaz

Regla de arquitectura UX: **integrar antes de crear**.

- Una pregunta del usuario debe resolverse en una única superficie visible siempre que sea posible.
- Antes de añadir una tarjeta, panel, buscador, tabla o módulo visible nuevo, comprobar si la función puede integrarse en una superficie existente.
- Dos controles que buscan, seleccionan o analizan el mismo concepto deben compartir el mismo flujo y estado; no se crean buscadores paralelos.
- Un nuevo motor interno, test o fuente de datos no justifica por sí mismo una nueva sección visible.
- Los rankings deben alimentar el mismo analizador que usa la búsqueda manual; abrir un candidato no debe crear otro workspace equivalente.
- Solo se mantiene una sección separada cuando responde a una pregunta materialmente distinta. Ejemplo válido: `Validación general del motor` puede separarse de `Estudio de inversiones y señales` porque evalúa robustez histórica global, no un activo concreto.
- En `Estudio de inversiones y señales`, catálogo, escritura manual de ticker/ISIN, selección, gráfica, señales y ranking forman un único flujo integrado.

Esta regla tiene prioridad sobre la comodidad de implementar una feature como componente visible independiente. La modularidad interna del código se conserva, pero no debe trasladarse automáticamente a fragmentación de la interfaz.
