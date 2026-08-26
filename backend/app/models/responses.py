from __future__ import annotations
from pydantic import BaseModel, Field
from .requests import DataProvenanceModel


class BacktestMetricsModel(BaseModel):
    initialCapital: float
    finalEquity: float
    totalReturnPct: float
    annualizedReturnPct: float | None = None
    cagrPct: float | None = None
    sharpeRatio: float | None = None
    sortinoRatio: float | None = None
    calmarRatio: float | None = None
    maxDrawdownPct: float
    maxDrawdownDurationBars: int = 0
    totalTrades: int
    winningTrades: int = 0
    losingTrades: int = 0
    winRatePct: float = 0.0
    profitFactor: float | None = None
    totalCommissionEur: float = 0.0
    totalSlippageEur: float = 0.0
    totalTradingCostsEur: float = 0.0


class EquityPointModel(BaseModel):
    timestamp: str
    equity: float
    cash: float
    drawdownPct: float


class TradeModel(BaseModel):
    id: str
    entryDate: str
    exitDate: str
    entryPrice: float
    exitPrice: float
    shares: float
    amountInvested: float
    commissionEur: float = 0.0
    slippageEur: float = 0.0
    pnlEur: float
    pnlPct: float
    isWin: bool
    holdingPeriodBars: int
    exitReason: str = "SIGNAL"


class QuantBacktestResponse(BaseModel):
    engine: str = "vectorbt"
    engineVersion: str
    quantEnvironmentFingerprint: str
    assetTicker: str
    assetName: str
    strategyId: str
    executionMode: str = "NEXT_OPEN"
    inputDatasetFingerprint: str
    outputDatasetFingerprint: str
    dataProvenance: DataProvenanceModel
    metrics: BacktestMetricsModel
    equityCurve: list[EquityPointModel]
    trades: list[TradeModel]
    compatibilityWarnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = "ok"
    engine: str = "vectorbt"
    pythonVersion: str
    vectorbtVersion: str
    numpyVersion: str
    pandasVersion: str
    numbaVersion: str
    quantEnvironmentFingerprint: str
    environmentLockStatus: str = "MATCH"
