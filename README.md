# Custodia / Trading

Aplicación experimental de investigación cuantitativa orientada a responder una pregunta sencilla: **qué asignación de cartera sugiere el motor con los últimos datos diarios disponibles**.

## Rutas principales

- `/` — **Decisión de inversión**. Introduce capital, riesgo y horizonte. La app descarga datos REAL, muestra la fecha del último cierre, clasifica el régimen y devuelve una asignación EUR con efectivo explícito.
- `/portfolio.html` — **Portfolio Lab**. Backtesting multi-activo, correlaciones/covarianzas reales, Risk Parity, Inverse Volatility, Momentum y asignación rolling causal.
- `/legacy.html` — **Laboratorio avanzado anterior**. Backtesting individual, cartera, riesgo, simulación y módulos históricos de la app.

## Universo inicial de decisión

El flujo principal usa activos cotizados en EUR para evitar conversiones FX implícitas:

- `VWCE.DE` — renta variable global UCITS
- `EQQQ.DE` — Nasdaq-100 UCITS
- `4GLD.DE` — oro listado en EUR
- `VAGF.DE` — bonos globales EUR hedged
- `XEON.DE` — monetario EUR

Si Yahoo Finance devuelve una divisa distinta de EUR para cualquiera de ellos, la decisión se bloquea.

## Metodología de la pantalla principal

1. Datos diarios históricos REAL mediante el proxy de Market Data.
2. Intersección temporal de los activos sin forward-fill.
3. Régimen causal `BULL / BEAR / SIDEWAYS × HIGH / LOW VOL`.
4. Método base según riesgo:
   - Bajo → Inverse Volatility
   - Medio → Risk Parity ERC
   - Alto → Relative Momentum
5. Overlay de efectivo por riesgo y régimen.
6. Límites de concentración por activo.
7. Resultado trazable mediante `portfolioDatasetFingerprint`.

La fecha `asOfDate` y la antigüedad de los datos se muestran siempre. Si los datos son antiguos o insuficientes, la confianza baja o la decisión se bloquea.

## Validación local

```bash
npm run lint
npm run test:decision
npm run test:multi-asset
npm run test:portfolio-analytics
npm run test:rolling-allocation
npm run test:portfolio-comparator
npm run test:regimes
npm run test:regime-selector
npm run build
```

No se requiere GitHub Actions.

## Alcance

La aplicación es experimental y de investigación. No ejecuta órdenes reales, no garantiza rentabilidad y no sustituye asesoramiento financiero personalizado.
