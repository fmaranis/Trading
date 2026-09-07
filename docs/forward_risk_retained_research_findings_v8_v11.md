# Forward Risk — hallazgos reutilizables V8 → V11

Fecha de registro: **2026-09-07**

Este documento separa dos cosas que no deben volver a confundirse:

1. **valor informativo/predictivo** de Forward Risk;
2. **valor económico de una política de ejecución concreta**.

Los FAIL económicos de V8, V9, V10 y V11 no permiten concluir que la señal V8 carezca de valor. Lo que permiten concluir es que las traducciones ejecutivas ensayadas hasta V11 no han demostrado suficiente utilidad económica.

---

## 1. Hallazgo principal preservado: V8 anticipa futuras caídas con información útil

Regla histórica V8:

`V5 vulnerability >= 80 OR V7 options >= 80`

Evidencia cerrada:

- EUNL: 11/19 episodios anticipados = 57,89%; lead mediano 63 sesiones; falsa señal 16,73%.
- Seis holdouts V8: 72/83 episodios anticipados = 86,75%; lead mediano 40 sesiones; falsa señal 26,33%; 6/6 PASS predictivo.
- Macro V5 reconstruida vintage-safe con FRED/ALFRED point-in-time.

**Conclusión permanente:** V8 mostró capacidad útil para anticipar futuras caídas relevantes. No debe eliminarse ni desacreditarse por los FAIL económicos posteriores.

---

## 2. Predicción útil no equivale a política de trading rentable

V8/V9 demostraron que usar una señal de riesgo como interruptor directo de venta/recompra puede destruir demasiado upside y generar rotación/coste.

V10 demostró que usar la señal para aplazar al 100% dinero nuevo también puede ser perjudicial: la señal puede avisar antes de una caída y, aun así, la regla de reentrada puede comprar después de buena parte de la recuperación.

V11 demostró que un overlay continuo y suave puede reducir el coste de oportunidad, pero no necesariamente generar una protección material.

**Regla de continuidad:** evaluar por separado `signal quality` y `execution policy quality`.

---

## 3. V8 binario es demasiado fragmentado para ser una orden

Diagnóstico V8:

- 3.974 sesiones;
- 1.059 sesiones ON = 26,65%;
- 111 runs ON;
- mediana de duración ON = 2 sesiones;
- 222 transiciones;
- 72,1% de los runs ON duraron <=3 sesiones;
- 82,0% duraron <=5 sesiones.

Esto explica por qué un ON/OFF diario puede ser una mala interfaz ejecutiva aunque el contenido predictivo subyacente sea útil.

**Uso futuro plausible:** conservar el score continuo, persistencia, intensidad o componentes como features/telemetría en lugar de convertir cada cambio ON/OFF en una transacción.

---

## 4. V10 conservó una asimetría direccional que merece recordarse

Entre las 71 aportaciones que V10 aplazó:

- `DOWN_FIRST = 34`;
- `UP_FIRST = 28`;
- `NEITHER = 9`.

La política económica V10 falló, pero hubo más casos en los que el precio alcanzó primero -5% que +5% después de una señal de aplazamiento.

Esto **no valida V10** ni permite reajustar sus thresholds, pero es compatible con la conclusión de que Forward Risk conserva información direccional bajista.

---

## 5. Hallazgo estructural V11: Forward Risk llega demasiado tarde si se aplica sólo después de `PortfolioCandidateGate`

En los seis blind V11:

- decisiones `ELIGIBLE`: 272;
- decisiones `ELIGIBLE` con riesgo >80 realmente moduladas: 51;
- solapamiento: **51/272 = 18,75%**.

Por activo:

- IUSQ: 9/52;
- SXR4: 10/53;
- EUNM: 7/35;
- EUNK: 8/55;
- SXR1: 8/40;
- SXRZ: 9/37.

La fracción media desplegada en las decisiones realmente moduladas fue aproximadamente 85,9%.

Interpretación reutilizable, sin convertirla en una nueva política:

**el gate de oportunidad ya excluye muchas situaciones de riesgo alto, por lo que aplicar V8 únicamente después de que un activo sea `ELIGIBLE` deja poco margen incremental para cambiar el resultado.**

Esto puede explicar por qué V11 casi no modificó el drawdown: el overlay intervino pocas veces y con una reducción de exposición moderada.

No usar esta observación para retocar V11. Cualquier arquitectura futura debe preregistrarse y validarse en muestra virgen.

---

## 6. Posibles reutilizaciones futuras de V8

Estas son hipótesis de investigación, no funciones productivas ya demostradas:

- **ranking:** penalización o contexto de riesgo entre candidatos que ya compiten por capital;
- **confianza de oportunidad:** exigir mayor margen de seguridad cuando el riesgo adelantado es alto;
- **alertas tempranas:** aviso de deterioro futuro sin ordenar automáticamente vender;
- **telemetría de cartera:** estado de riesgo agregado para interpretar exposición y concentración;
- **stress testing:** seleccionar escenarios o severidad de pruebas cuando la señal aumenta;
- **priorización de rebalanceos:** decidir qué posiciones merecen revisión antes, no venderlas automáticamente;
- **feature de modelos futuros:** combinar V5/V7 con señales de oportunidad en una función conjunta que se valide desde cero;
- **timing de aportaciones/rebalanceos:** sólo con una arquitectura distinta a V10/V11 y holdout nuevo.

---

## 7. Componentes V5/V7 también deben preservarse

V8 combina dos familias de información:

- V5: vulnerabilidad macro/mercado, incluyendo curva de tipos, spreads de crédito, liquidez y régimen;
- V7: estrés/opciones.

Hasta ahora se ha validado sobre todo el comportamiento conjunto de V8. No debe asumirse que cada componente individual tiene valor autónomo demostrado.

Sin embargo, **no deben eliminarse**: pueden ser útiles como variables explicativas o features en investigación futura, siempre distinguiendo qué parte está validada y cuál sigue siendo hipótesis.

---

## 8. Regla de memoria del proyecto

Cuando se retome cualquier trabajo sobre riesgo, oportunidad, ranking, sizing, alertas, asignación o stress, recordar primero:

> **V8 sí mostró capacidad útil para anticipar futuras caídas. Lo que falló hasta V11 fue la forma de convertir esa información en una política económica suficientemente buena.**

Por tanto:

- preservar V8/V5/V7 como activos de investigación;
- no reutilizar V9/V10/V11 como políticas productivas;
- no retunear sobre holdouts consumidos;
- buscar usos donde la señal aporte información marginal antes o dentro de la decisión, no necesariamente después como orden binaria o overlay tardío;
- toda nueva traducción económica requiere hipótesis distinta, preregistro y muestra virgen.
