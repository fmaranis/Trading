import pandas as pd
import numpy as np
import pytest
from fastapi import HTTPException
from backend.app.services.strategy_service import StrategyService


def create_sample_df(n: int = 50, trend: str = "UP") -> pd.DataFrame:
    dates = pd.date_range("2023-01-01", periods=n, freq="D")
    base = 100.0
    prices = []
    for i in range(n):
        if trend == "UP": p = base + i * 1.5 + (i % 3) * 0.5
        elif trend == "DOWN": p = base - i * 1.5 - (i % 3) * 0.5
        else: p = base + np.sin(i / 2.0) * 10.0
        prices.append(p)
    return pd.DataFrame({"Open": prices, "High": [p + 1 for p in prices], "Low": [p - 1 for p in prices], "Close": prices, "Volume": [1000] * n}, index=dates)


def test_buy_and_hold_strategy():
    entries, exits, _ = StrategyService.generate_signals(create_sample_df(20), "BUY_AND_HOLD", {})
    assert entries.iloc[0] == True
    assert entries.iloc[1:].sum() == 0
    assert exits.sum() == 0


def test_sma_crossover_strategy():
    entries, exits, _ = StrategyService.generate_signals(create_sample_df(50, "CYCLE"), "SMA_CROSSOVER", {"fastPeriod": 5, "slowPeriod": 15})
    assert isinstance(entries, pd.Series)
    assert isinstance(exits, pd.Series)


def test_invalid_sma_periods():
    with pytest.raises(HTTPException):
        StrategyService.generate_signals(create_sample_df(20), "SMA_CROSSOVER", {"fastPeriod": 20, "slowPeriod": 10})


def test_rsi_strategy():
    entries, exits, _ = StrategyService.generate_signals(create_sample_df(60, "CYCLE"), "RSI_MEAN_REVERSION", {"period": 14, "oversoldThreshold": 35, "overboughtThreshold": 65})
    assert isinstance(entries, pd.Series)
    assert isinstance(exits, pd.Series)
