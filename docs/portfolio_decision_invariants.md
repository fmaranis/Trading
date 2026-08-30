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

## 3. Capital finito y objetivos de compra estables

El capital sugerido no es infinito.

- Presupuesto máximo de nuevas compras = liquidez real disponible menos la reserva de cash del perfil/régimen.
- Se priorizan oportunidades por convicción, consenso, exceso frente a cash y riesgo.
- Se aplican límites por activo y categoría.
- La suma de aportaciones propuestas nunca puede superar la liquidez realmente disponible.
- Una oportunidad válida puede recibir 0 EUR si la bloquean concentración/riesgo/costes/valoración; la UI debe explicarlo solo como información secundaria.

Regla de ejecución acumulativa:
- Cada oportunidad financiada tiene un **objetivo final por activo**, no un porcentaje nuevo del efectivo restante en cada render.
- El valor REAL que ya existe de ese activo en cartera cuenta contra su objetivo.
- Al registrar una compra completa, el pendiente de ese activo debe quedar en 0 y no puede volver a recomendarse automáticamente por haber quedado efectivo disponible.
- Al registrar una compra parcial, solo puede recomendarse la diferencia que falte para alcanzar el objetivo actual.
- Ejecutar una oportunidad no puede inflar automáticamente el objetivo de las demás mediante un nuevo reparto del efectivo restante.
- Solo una nueva decisión de mercado material —nuevos datos/señales, cambio de perfil/horizonte o cambio real de cartera/mercado— puede alterar los objetivos; no el mero hecho de registrar una ejecución ya recomendada.
- Residuos inferiores al mínimo operativo útil no deben reaparecer como una nueva orden marginal.

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
- `dynamicHistoricalReplay.unit.ts`
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
- Una recomendación operativa debe ser directamente interactiva: tocar el activo recomendado abre el mismo analizador existente con su ticker/ISIN, gráfica, señales y metadatos disponibles; no se crea una ficha paralela desconectada.

Esta regla tiene prioridad sobre la comodidad de implementar una feature como componente visible independiente. La modularidad interna del código se conserva, pero no debe trasladarse automáticamente a fragmentación de la interfaz.

## 10. Prueba histórica causal de la cartera

La validación histórica debe responder una pregunta concreta: **si el usuario hubiera empezado en una fecha pasada y hubiera obedecido la app, ¿cómo habría evolucionado su dinero?**

Reglas canónicas:
- El usuario puede introducir una fecha pasada arbitraria; no queda limitado a una lista fija de años o trimestres.
- La prueba puede revisar cada sesión, semana, mes o trimestre. `DAILY` es la prueba operativa más exigente.
- Cada recomendación se calcula exclusivamente con barras y datos disponibles hasta la fecha de señal. Está prohibido usar precios, rankings, retornos o composición futura para decidir una operación anterior.
- La ejecución ocurre después de la señal, nunca en el mismo cierre usado para decidir.
- El histórico largo se descarga solo cuando el usuario lanza la prueba. No se amplía por ello la ventana corta del escaneo live, para no degradar la interfaz diaria.
- La simulación debe mantener una contabilidad acumulativa de cartera: posiciones, cash, aportaciones, compras, ampliaciones, reducciones, salidas y traspasos.
- ETFs/cotizados usan títulos enteros y costes de ejecución modelados; fondos pueden usar unidades fraccionarias.
- Las ventas deben llevar base FIFO dentro del replay y plusvalía realizada. La fiscalidad mostrada es una estimación de fricción: escala configurada si existe contexto fiscal confirmado y reserva conservadora del 30% si no existe.
- Cuando una salida de fondo y una entrada en otro fondo elegible coinciden en el mismo cambio, la parte emparejada se trata como traspaso fiscalmente diferido y su impuesto inmediato estimado es 0.
- La gráfica debe valorar la cartera a lo largo de las sesiones disponibles y mostrar marcadores/eventos de operación con importe, comisión, plusvalía y fiscalidad estimada.
- Debe existir una comparación visible sobre las mismas fechas contra, como mínimo, mantener todo el capital en la cuenta remunerada.
- Los resultados históricos no se presentan como garantía futura. Deben conservar visibles las limitaciones de supervivencia del catálogo y de disponibilidad histórica del broker.

## 11. Evolución de la cartera real

La evolución real forma parte de `Mi cartera real`; no crea un tercer workspace ni una superficie paralela de cartera.

- Las operaciones registradas mediante la app se guardan en un historial persistente para que una venta futura no borre del pasado una posición que realmente existió.
- La reconstrucción usa fechas, títulos/participaciones y series REAL cuando están disponibles.
- Las posiciones reales de partida con fecha y unidades conocidas pueden sembrar el histórico inicial.
- Una compra posterior puede financiarse con cash procedente de ventas anteriores: ese dinero no vuelve a contabilizarse como una nueva aportación externa.
- Solo se suma nueva aportación cuando la caja histórica reconstruida no alcanza para financiar una compra registrada.
- Si faltan unidades exactas de una operación de fondo, pueden inferirse desde el NAV de la fecha, pero la interfaz debe marcar esa parte como estimada.
- La liquidez o capital pendiente actual sin fecha histórica conocida se muestra aparte y **no se retroproyecta** a fechas anteriores.
- Nunca se inventa una fecha de entrada para completar una gráfica visualmente más bonita. La precisión y huecos de reconstrucción deben quedar explícitos.
