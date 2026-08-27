# Asset Universe Scanner

La pantalla de decisión no utiliza ya un conjunto fijo de cinco activos. Antes de calcular la cartera ejecuta un escaneo determinista de un catálogo inicial de 30 ETFs/ETCs cotizados en EUR.

## Fuente de datos

Proveedor: Yahoo Finance, a través del proxy server-side existente `/api/market-data/history`.

Los datos utilizados son históricos diarios OHLCV ajustados cuando están disponibles. Cada dataset conserva `DataProvenance` y `datasetFingerprint`. No existe fallback sintético silencioso.

## Embudo

1. Catálogo EUR: 30 tickers candidatos.
2. Descarga real con concurrencia máxima 3.
3. Rechazo si:
   - ticker no disponible;
   - moneda reportada distinta de EUR;
   - menos de 252 barras;
   - último dato con más de 7 días respecto a la fecha solicitada;
   - error de validación OHLCV/proveedor.
4. Cálculo por activo:
   - momentum 20 días;
   - momentum 60 días;
   - momentum 120 días;
   - volatilidad anualizada sobre 60 retornos;
   - max drawdown aproximado sobre 252 barras.
5. Ranking determinista:

`score = 0.20*mom20 + 0.35*mom60 + 0.45*mom120 - 0.30*volatilidad - 0.25*maxDrawdown + defensiveBonus`

El bonus defensivo es 2.5 puntos para bonos, monetarios, oro y materias primas defensivas del catálogo.

6. Selección final: máximo 8 activos, máximo una exposición por categoría y al menos una exposición defensiva si existe una válida.
7. Solo el shortlist final se entrega a `InvestmentDecisionEngine` y al backtest causal.

## Categorías iniciales

- renta variable global;
- USA;
- Europa;
- emergentes;
- small caps;
- tecnología;
- semiconductores;
- salud;
- energía;
- dividendos;
- bonos gubernamentales;
- bonos corporativos;
- bonos globales agregados;
- monetario EUR;
- oro;
- materias primas.

## Auditoría visible

La UI muestra:

- número total escaneado;
- número aceptado;
- número descartado;
- motivos de descarte;
- número seleccionado;
- top 15 del ranking;
- categoría, score, momentum, volatilidad y drawdown;
- shortlist utilizado para la decisión.

El catálogo es una lista de descubrimiento, no una afirmación de que todos los tickers estén actualmente negociables. La disponibilidad se valida en runtime contra el proveedor y los fallos se descartan explícitamente.
