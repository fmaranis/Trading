# Custodia — Frontera de impacto económico y disponibilidad real del capital

**4 de noviembre de 2026 · diagnóstico matemático de investigación, sin fuentes de retorno futuras, sin backtest y sin política productiva.**

## Por qué se hace ahora

La nueva investigación descartó como estrategias independientes E1 (compras corporativas), E2 (escisiones two-step) y E4 (arbitraje de fusiones cash) en las formas examinadas, **NO** porque cada dato carezca de información, sino porque el retorno **neto, ejecutable y escalable** para una cartera de 13.000 EUR no está demostrado. El replay de `QUALITY_ALLOCATION_BRIDGE_V1` ya mostró un cuello de botella compatible: sólo unas 3/228 decisiones de capital cerrado tenían capital nuevo distribuible. Las buenas señales no cambian patrimonio si no generan órdenes económicamente importantes.

El objetivo del usuario sigue siendo superar al índice global con alta consistencia (aspiración de ~80% de períodos anuales). **No existe resultado que demuestre tal objetivo**, y ser mejor que EUNL en un 80% de años no se sigue de encontrar un paper con CAR anormal sobre uno o dos activos.

## Ecuación cero, sin software ni supuestos de mercado

Para una cartera de capital inicial `C`, una exposición a eventos `w` (fracción de capital por operación), `N` oportunidades **no solapadas** al año y exceso medio **NETO por operación frente a la alternativa que hubiera ocupado ese dinero** `a`, el efecto anual de primer orden antes de compounding e impuestos cruzados es:

`incremento_patrimonial ≈ C × N × w × a`.

La fórmula **NO es una predicción**, ni vale si los eventos se solapan, si se reinvierte el resultado, se realiza una venta del índice con impuestos, cambia el cash durante la espera, no hay liquidez, o los resultados de un evento están correlacionados con los demás. El `a` necesita incorporar esos costes y el **coste de oportunidad de mantener EUNL/cash** para ser verdaderamente incremental.

Un incremento ilustrativo de **2% de C al año** se traduce en **260 EUR** con C=13.000. *No es una promesa ni un nuevo target productivo*: sirve para dimensionar si estudiar una fuente puede mover el patrimonio.

| Ejemplo sin solapamiento | Exceso neto **por operación** necesario para +260 EUR/año |
| --- | ---: |
| Una operación/año, 10% cartera (1.300 EUR) | **20%** frente a su alternativa |
| Dos operaciones/año, 10% cada una | **10%** por operación |
| 2,125 operaciones/año, 10% cada una (frecuencia media E2 histórica, NO forecast) | **~9,41%** por operación |
| Cuatro operaciones/año, 20% de cartera cada una | **2,5%** por operación |
| Estrategia capaz de aplicarse a prácticamente toda la cartera durante el año | **~2%** exceso sobre toda la exposición, si aplica |

**E2 alcance vs CAR académico:** 2,125 eventos anuales × 10% del capital × ~60/252 de año => ~**5,06% de capital-año expuesto**, ilustración sujeta a datos reales; para +260 EUR requeriría ~9,41% neto *por evento*, no el CAR de mercado acumulado 0→+60 de una muestra elegida. El estudio no demostró acceso a todo ese CAR tras publicación, gastos e impuestos. Recompra/escisión rara con pocas posiciones **no escala automáticamente**.

**E4 dos ejemplos reales al cierre 03-11-2026:**
- MG/20,35 frente 20,18: 0,8424% **bruto condicionado al cierre**. A 1.300 EUR son ~10,95 EUR brutos; suponiendo 13,80 EUR fricción ilustrativa de dos órdenes+FX se obtiene ~**−2,85 EUR** en ese ticket, aunque se complete.
- SYNA/123 frente 117,41: 4,7611% bruto condicionado al cierre. A 1.300 EUR son ~61,89 EUR brutos y **~48,09 EUR** después de la misma fricción hipotética, *si* el cierre se completa en los términos pactados, sin spread, break, impuestos ni tiempo. El éxito perfecto aportaría **~0,37% de C**, no 4,76% sobre toda la cartera; además el capital quedaría expuesto al fracaso por varios meses.
- Estas cifras no comparan el resultado contra EUNL durante ese período, que puede variar de modo independiente, y **no** prueban rentabilidad esperada positiva.

## Nueva puerta general: primero tamaño de efecto posible, luego evidencia predictiva

**Ninguna nueva señal/evento debe producir un job de Custodia sin responder primero en papel:**

1. **Reach económico**: fracción real del patrimonio que puede desplegarse *sin vender la cartera base y provocar un coste fiscal innecesario*, y cuántas oportunidades elegibles existen al año.
2. **Ventaja relativa por euro en riesgo**: exceso esperable frente a EUNL/cash según cuál fuera la alternativa real, **después** de broker/FX/horquilla/slippage/impuestos y caídas extremas.
3. **Capacidad para mover el patrimonio total**: calcular `C×N×w×a` con rangos defensibles; `NO_DATA` para `a` significa **NO HAY JUSTIFICACIÓN PARA IMPLEMENTAR**, no licencia para escoger el resultado favorable.
4. **Consistencia vs un índice**: una estrategia de fusiones podría tener tasa de éxito por operación alta, pero correlacionarse con caídas graves y perder frente a EUNL en muchos años; el objetivo del 80% es distinto del porcentaje de operaciones ganadoras y requiere validación fresh.
5. **Causalidad y disponibilidad PIT**: activo/evento era visible, comprable, no borrado por delisting, con noticia publicada antes de `NEXT_OPEN`, y muestra históricamente no elegida por resultados.
6. **Exposición y frontera de cartera**: si `w` o `N` son demasiado pequeños, conservar como información de **contexto** sin fingir que una feature nueva genera rentabilidad. El capital disponible y el coste de vender posiciones importan tanto como la precisión de una señal.

**Decisión:** la próxima investigación debe identificar **un mecanismo con capacidad material sobre una proporción significativa y real del capital**, o demostrar que existe una mejora conservadora en fiscalidad/costes/ejecución de la cartera base. Esto NO presupone que dicha mejora vaya a batir EUNL en rentabilidad bruta; separar siempre ganancia por costes/riesgo de alpha de mercado. **No crear otra familia de trading ni un motor por inercia.**

Las políticas `LEGACY`, `CORE_ARCHITECTURE_V1` y defaults productivos permanecen intactos. Estos son cálculos elementales de cribado sobre supuestos etiquetados, no un experimento de retorno futuro.
