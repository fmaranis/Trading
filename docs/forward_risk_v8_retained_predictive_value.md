# Forward Risk V8 — valor predictivo preservado

Fecha de registro: **2026-09-07**

## Conclusión que debe conservarse

El fracaso económico de V8, V9, V10 y V11 **no invalida la capacidad predictiva observada en V8**.

La evidencia cerrada de V8 mostró capacidad para anticipar futuras caídas relevantes con antelación útil:

- Regla histórica: `V5 vulnerability >= 80 OR V7 options >= 80`.
- EUNL: 11/19 episodios anticipados = 57,89%; lead mediano 63 sesiones; falsa señal 16,73%.
- Seis holdouts V8: 72/83 episodios anticipados = 86,75%; lead mediano 40 sesiones; falsa señal 26,33%; 6/6 PASS predictivo.
- La reconstrucción macro fue vintage-safe mediante FRED/ALFRED point-in-time.

Por tanto, la conclusión correcta no es “Forward Risk no sirve”. La conclusión es:

**V8 contiene información útil sobre riesgo bajista futuro, pero hasta V11 no se ha demostrado una traducción económica rentable o suficientemente protectora para usarla directamente como orden de vender, esperar o reducir sizing.**

## Activo de investigación que se preserva

La señal V8 debe tratarse como un **activo predictivo reutilizable**, no como una política ejecutiva retirada.

Puede volver a utilizarse en hipótesis futuras, siempre preregistradas y con nueva validación virgen, por ejemplo para:

- enriquecer ranking y priorización de oportunidades;
- penalizar riesgo relativo entre candidatos sin bloquear compras automáticamente;
- generar alertas de riesgo adelantadas;
- contextualizar stress tests y escenarios adversos;
- modular confianza o incertidumbre de una recomendación;
- decidir cuándo exigir mayor margen de seguridad;
- análisis de cartera y exposición agregada;
- investigación de timing de aportaciones o rebalanceos con arquitecturas distintas;
- features de modelos futuros que combinen riesgo y oportunidad.

Estas posibilidades son **líneas de investigación**, no usos productivos ya validados.

## Regla de continuidad

No eliminar, desacreditar ni olvidar V8 por los FAIL económicos posteriores.

Cuando se retome cualquier trabajo sobre riesgo, oportunidad, ranking, sizing, alertas o asignación, debe recordarse primero que:

> **V8 sí mostró capacidad útil para anticipar futuras caídas; lo que falló fue la forma de monetizar o ejecutar esa información, no necesariamente la información en sí.**

No reutilizar los holdouts consumidos de V9, V10 o V11 para justificar una nueva política. Toda nueva traducción económica de V8 requiere una hipótesis distinta, preregistro y muestra virgen.
