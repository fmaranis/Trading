from __future__ import annotations
import sys
import vectorbt as vbt
from fastapi import HTTPException
from ..models.requests import BacktestRequest
from ..models.responses import QuantBacktestResponse
from ..validation.market_data_validator import validate_and_build_dataframe
from .strategy_service import StrategyService
from .metrics_adapter import MetricsAdapter, pct_to_decimal
from ..api.health import get_package_version, compute_quant_environment_fingerprint


class VectorbtService:
    @staticmethod
    def run_backtest(req: BacktestRequest) -> QuantBacktestResponse:
        if req.config.executionMode != "NEXT_OPEN":
            raise HTTPException(status_code=400, detail="Modo de ejecución no soportado: solo NEXT_OPEN.")
        if (req.config.stopLossPct is not None and req.config.stopLossPct > 0) or \
           (req.config.takeProfitPct is not None and req.config.takeProfitPct > 0) or \
           (req.config.trailingStopPct is not None and req.config.trailingStopPct > 0):
            raise HTTPException(status_code=400, detail="UNSUPPORTED_FEATURE: stops intrabar no soportados en vectorbt en esta fase.")
        if req.config.positionSizingPct != 100.0:
            raise HTTPException(status_code=400, detail="UNSUPPORTED_FEATURE: positionSizingPct debe ser 100%.")

        df, calculated_fingerprint = validate_and_build_dataframe(req.bars)
        expected_fingerprint = req.datasetFingerprint or req.dataProvenance.datasetFingerprint
        if expected_fingerprint and expected_fingerprint != calculated_fingerprint:
            raise HTTPException(status_code=422, detail="Fallo de integridad: fingerprint recibido y calculado no coinciden.")

        input_fingerprint = expected_fingerprint or calculated_fingerprint
        entries, exits, strat_warnings = StrategyService.generate_signals(df, req.strategy.id, req.strategy.parameters)
        entries_shifted = entries.shift(1, fill_value=False).astype(bool)
        exits_shifted = exits.shift(1, fill_value=False).astype(bool)
        execution_prices = df["Open"]
        fees = pct_to_decimal(req.config.commissionPct)
        slippage = pct_to_decimal(req.config.slippagePct)
        init_cash = float(req.config.initialCapital)

        portfolio = vbt.Portfolio.from_signals(
            close=execution_prices,
            entries=entries_shifted,
            exits=exits_shifted,
            init_cash=init_cash,
            fees=fees,
            slippage=slippage,
            freq="1D",
            direction="longonly"
        )

        metrics = MetricsAdapter.extract_metrics(portfolio, init_cash, df, req.config.riskFreeRateAnnualPct)
        equity_curve = MetricsAdapter.extract_equity_curve(portfolio, df)
        trades = MetricsAdapter.extract_trades(portfolio)
        compatibility_warnings = list(strat_warnings)
        compatibility_warnings.append("NEXT_OPEN: señales en Close(t), ejecución en Open(t+1).")

        import numpy as np
        try:
            import numba
            nb_version = str(getattr(numba, "__version__", "unknown"))
        except ImportError:
            nb_version = "not_installed"
        py_version = sys.version.split()[0]
        vbt_version = get_package_version("vectorbt", vbt)
        qenv_fp = compute_quant_environment_fingerprint(
            py_version,
            vbt_version,
            str(getattr(np, "__version__", "unknown")),
            __import__("pandas").__version__,
            nb_version
        )

        return QuantBacktestResponse(
            engine="vectorbt",
            engineVersion=vbt_version,
            quantEnvironmentFingerprint=qenv_fp,
            assetTicker=req.assetTicker,
            assetName=req.assetName,
            strategyId=req.strategy.id,
            executionMode=req.config.executionMode,
            inputDatasetFingerprint=input_fingerprint,
            outputDatasetFingerprint=calculated_fingerprint,
            dataProvenance=req.dataProvenance,
            metrics=metrics,
            equityCurve=equity_curve,
            trades=trades,
            compatibilityWarnings=compatibility_warnings
        )
