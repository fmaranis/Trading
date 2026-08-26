from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field


class PriceBarModel(BaseModel):
    timestamp: str = Field(..., description="Timestamp ISO 8601 (ej. '2023-01-03T14:30:00.000Z')")
    open: float = Field(..., gt=0, description="Precio de apertura (> 0)")
    high: float = Field(..., gt=0, description="Precio máximo (> 0)")
    low: float = Field(..., gt=0, description="Precio mínimo (> 0)")
    close: float = Field(..., gt=0, description="Precio de cierre (> 0)")
    volume: float | None = Field(default=None, ge=0, description="Volumen negociado (>= 0 si presente)")


class StrategyConfig(BaseModel):
    id: str = Field(..., description="Identificador de estrategia (BUY_AND_HOLD, SMA_CROSSOVER, RSI_MEAN_REVERSION)")
    name: str | None = Field(default=None, description="Nombre legible de la estrategia")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Parámetros de la estrategia (fastPeriod, slowPeriod, etc.)")


class BacktestConfigModel(BaseModel):
    initialCapital: float = Field(default=10000.0, gt=0, description="Capital inicial en moneda base")
    commissionPct: float = Field(default=0.05, ge=0, description="Comisión por operación en porcentaje")
    slippagePct: float = Field(default=0.02, ge=0, description="Deslizamiento en porcentaje")
    riskFreeRateAnnualPct: float = Field(default=3.0, description="Tipo libre de riesgo anual en porcentaje")
    positionSizingPct: float = Field(default=100.0, gt=0, le=100.0, description="Tamaño de posición")
    executionMode: Literal["NEXT_OPEN", "SAME_CLOSE"] = Field(default="NEXT_OPEN")
    stopLossPct: float | None = None
    takeProfitPct: float | None = None
    trailingStopPct: float | None = None


class DataProvenanceModel(BaseModel):
    sourceType: Literal["REAL", "STATIC_REFERENCE", "SYNTHETIC"]
    provider: str | None = None
    symbol: str | None = None
    datasetFingerprint: str | None = None
    isReproducible: bool | None = None
    timeframe: str | None = "1d"
    notes: str | None = None


class BacktestRequest(BaseModel):
    assetTicker: str
    assetName: str
    bars: list[PriceBarModel] = Field(..., min_length=2)
    strategy: StrategyConfig
    config: BacktestConfigModel = Field(default_factory=BacktestConfigModel)
    dataProvenance: DataProvenanceModel
    datasetFingerprint: str | None = None
