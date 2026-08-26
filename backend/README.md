# Backend Cuantitativo Python + vectorbt

Microservicio de simulación cuantitativa y backtesting basado en **FastAPI** y **vectorbt**, diseñado para operar de forma desacoplada y auditable en coexistencia con el motor de referencia TypeScript (`BacktestEngine`).

---

## 1. Requisitos del Sistema

- **Python**: Exigido **Python >= 3.11** (compatible en tiempo de ejecución con Python 3.10+ / 3.11+).
- **vectorbt**: Paquete base `vectorbt` (sin `vectorbt[full]`, sin TA-Lib, sin Ray, sin dependencias de brokers).
- **Entorno aislado**: No se descargan datos de mercado directamente desde Python. Todos los datos provienen del pipeline validado de Market Data (TypeScript/Node) para garantizar paridad de datos y mismo `datasetFingerprint`.

---

## 2. Estructura del Proyecto

```text
backend/
├── app/
│   ├── main.py                     # Entry point FastAPI & CORS
│   ├── api/
│   │   ├── health.py               # GET /api/quant/health
│   │   └── backtest.py             # POST /api/quant/backtest
│   ├── models/
│   │   ├── requests.py             # DTOs de entrada y validación Pydantic
│   │   └── responses.py            # DTOs normalizados de salida
│   ├── services/
│   │   ├── vectorbt_service.py     # Orquestación de simulación vectorbt
│   │   ├── strategy_service.py     # Generación de señales binarias
│   │   └── metrics_adapter.py      # Conversión de comisiones, métricas y trades
│   └── validation/
│       └── market_data_validator.py # Validación OHLCV y cálculo FNV-1a 64-bit
│
├── tests/
│   ├── test_health.py              # Tests del health endpoint
│   ├── test_validation.py          # Tests de integridad de datos y rechazos 422
│   ├── test_strategies.py          # Tests de generación de señales
│   └── test_backtest.py            # Tests de ejecución end-to-end
│
├── requirements.txt
└── README.md
```

---

## 3. Endpoints de la API

### Health Check
`GET /api/quant/health`
Devuelve el estado del motor y las versiones en tiempo de ejecución.

### Backtest Cuantitativo
`POST /api/quant/backtest`
Recibe el dataset de barras OHLCV, estrategia, configuración y metadatos de procedencia:
- Valida estrictamente la serie temporal (sin reordenamiento silencioso).
- Verifica la huella digital `datasetFingerprint` con hash FNV-1a de 64 bits.
- Ejecuta la simulación con semántica `NEXT_OPEN`.
- Devuelve métricas financieras, curva de patrimonio y registro de operaciones.

---

## 4. Semántica de Ejecución (`NEXT_OPEN`)

- **Señales**: Se evalúan al cierre de la barra $t$.
- **Ejecución**: Se ejecutan en la apertura de la barra siguiente $t+1$.
- **En vectorbt**: Las señales booleanas se desplazan 1 periodo (`entries.shift(1)` / `exits.shift(1)`) y la cartera se simula sobre la serie `df['Open']`.
- **Comisiones y Slippage**: Se transforman de porcentaje a fracción decimal y se aplican por operación.

---

## 5. Estrategias Soportadas

1. `BUY_AND_HOLD`
2. `SMA_CROSSOVER`
3. `RSI_MEAN_REVERSION`

---

## 6. Ejecución y Tests

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
python3 -m pytest backend/tests/
```
