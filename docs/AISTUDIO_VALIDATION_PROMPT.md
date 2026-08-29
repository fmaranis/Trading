# AI Studio — Validación determinista sin uso de Gemini

Usa este texto en el asistente del workspace de AI Studio:

```text
NO analices el proyecto.
NO generes código.
NO uses Gemini, @google/genai ni ninguna llamada LLM/API de IA.
NO modifiques archivos.
NO ejecutes GitHub Actions.

Solo usa el terminal local del workspace y ejecuta exactamente:

npm install
npm run validate:aistudio

Es una validación determinista local. El script ejecuta TypeScript, tests, build, servidor local y descarga de Market Data mediante el proxy existente; no requiere ninguna llamada a un modelo generativo.

La validación incluye también `tests/dynamicHistoricalReplay.unit.ts`. No intentes corregirlo ni cambiar la implementación: limita AI Studio a ejecutar la validación y registrar el resultado.

Cuando termine, NO resumas ni interpretes el resultado. Devuélveme únicamente, literalmente y completo, desde la línea:

AI_STUDIO_VALIDATION_RESULT

hasta el final del JSON que aparece debajo.

Si el comando no puede ejecutarse, devuelve únicamente:
AI_STUDIO_EXECUTION_ERROR
seguido del error textual exacto del terminal.
```

## Qué valida el comando

`npm run validate:aistudio` ejecuta de forma secuencial los gates deterministas definidos en `validate:aistudio:raw`, entre ellos:

1. TypeScript / lint y build;
2. motores de decisión, cartera y ejecución;
3. strategy consensus;
4. historical dated-decision replay estático;
5. **dynamic historical replay**, incluyendo compras/ampliaciones, reducciones/salidas, ejecución posterior a la señal y aislamiento frente a precios futuros;
6. políticas de costes y ejecución adaptativa;
7. replay mixto ETF/fondos;
8. disponibilidad de broker y factibilidad de backtest;
9. validación local con Market Data REAL y los smoke tests ya integrados en el runner;
10. registro del resultado final mediante `AI_STUDIO_VALIDATION_RESULT`.

El nuevo gate `npm run test:dynamic-historical-replay` debe probar específicamente que:

- el motor revisita la cartera cronológicamente;
- una fase favorable puede generar BUY/ADD ejecutables;
- un deterioro estructural artificial puede generar REDUCE/EXIT;
- una venta requiere deterioro estructural y varias señales adversas;
- ninguna operación se ejecuta en la misma fecha de información;
- modificar únicamente precios futuros no altera señales históricas previas.

El runner no importa `@google/genai` ni realiza llamadas a Gemini. No se usan GitHub Actions.
