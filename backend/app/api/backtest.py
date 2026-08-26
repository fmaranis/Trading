from __future__ import annotations
from fastapi import APIRouter
from ..models.requests import BacktestRequest
from ..models.responses import QuantBacktestResponse
from ..services.vectorbt_service import VectorbtService

router = APIRouter(prefix="/api/quant", tags=["Backtest"])


@router.post("/backtest", response_model=QuantBacktestResponse)
def execute_backtest(req: BacktestRequest) -> QuantBacktestResponse:
    """Executes a quantitative backtest using vectorbt with strict provenance and fingerprint validation."""
    return VectorbtService.run_backtest(req)
