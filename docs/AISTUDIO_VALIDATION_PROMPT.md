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

Cuando termine, NO resumas ni interpretes el resultado. Devuélveme únicamente, literalmente y completo, desde la línea:

AI_STUDIO_VALIDATION_RESULT

hasta el final del JSON que aparece debajo.

Si el comando no puede ejecutarse, devuelve únicamente:
AI_STUDIO_EXECUTION_ERROR
seguido del error textual exacto del terminal.
```

## Qué valida el comando

`npm run validate:aistudio` ejecuta de forma secuencial:

1. `npm run lint`
2. `npm run test:decision`
3. `npm run test:decision-backtest`
4. `npm run test:multi-asset`
5. `npm run test:portfolio-analytics`
6. `npm run test:regimes`
7. `npm run build`
8. levanta temporalmente el servidor local si no está activo
9. descarga histórico REAL de `VWCE.DE`, `EQQQ.DE`, `4GLD.DE`, `VAGF.DE` y `XEON.DE`
10. devuelve fecha y precio de último cierre, divisa, exchange y fingerprint por activo
11. calcula decisiones de 100 EUR para perfiles LOW, MEDIUM y HIGH
12. devuelve importes, pesos, participaciones estimadas y si requieren fraccionamiento
13. ejecuta el backtest causal completo del recomendador MEDIUM / 3 años, con comisión y slippage
14. devuelve `readyForManualPilot: true|false`

El runner no importa `@google/genai` ni realiza llamadas a Gemini.
