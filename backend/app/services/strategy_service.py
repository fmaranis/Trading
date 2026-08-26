from __future__ import annotations
from typing import Any
import pandas as pd
import numpy as np
from fastapi import HTTPException


class StrategyService:
    @staticmethod
    def generate_signals(
        df: pd.DataFrame,
        strategy_id: str,
        parameters: dict[str, Any]
    ) -> tuple[pd.Series, pd.Series, list[str]]:
        strat = strategy_id.upper().strip()
        close = df["Close"]
        n = len(close)
        warnings: list[str] = []

        if strat in ("BUY_AND_HOLD", "BUY_HOLD", "BENCHMARK"):
            entries = pd.Series(False, index=df.index)
            exits = pd.Series(False, index=df.index)
            if n > 0:
                entries.iloc[0] = True
            return entries, exits, warnings

        if strat in ("SMA_CROSSOVER", "SMA", "GOLDEN_CROSS"):
            fast_period = int(parameters.get("fastPeriod") or parameters.get("fast_period") or 10)
            slow_period = int(parameters.get("slowPeriod") or parameters.get("slow_period") or 30)
            if fast_period <= 0 or slow_period <= 0 or fast_period >= slow_period:
                raise HTTPException(status_code=422, detail="Parámetros SMA inválidos: 0 < fastPeriod < slowPeriod.")

            fast_sma = close.rolling(window=fast_period, min_periods=fast_period).mean()
            slow_sma = close.rolling(window=slow_period, min_periods=slow_period).mean()
            crossed_above = (fast_sma.shift(1) <= slow_sma.shift(1)) & (fast_sma > slow_sma)
            crossed_below = (fast_sma.shift(1) >= slow_sma.shift(1)) & (fast_sma < slow_sma)
            entries = pd.Series(False, index=df.index)
            exits = pd.Series(False, index=df.index)
            in_position = False
            for i in range(slow_period, n):
                if crossed_above.iloc[i] and not in_position:
                    entries.iloc[i] = True
                    in_position = True
                elif crossed_below.iloc[i] and in_position:
                    exits.iloc[i] = True
                    in_position = False
            return entries, exits, warnings

        if strat in ("RSI_MEAN_REVERSION", "RSI"):
            period = int(parameters.get("period") or 14)
            oversold = float(parameters.get("oversoldThreshold") or parameters.get("oversold") or 30.0)
            overbought = float(parameters.get("overboughtThreshold") or parameters.get("overbought") or 70.0)
            if period <= 0 or not (0 < oversold < overbought < 100):
                raise HTTPException(status_code=422, detail="Parámetros RSI inválidos.")

            diff = close.diff()
            gains = diff.clip(lower=0)
            losses = (-diff).clip(lower=0)
            avg_gain = gains.rolling(window=period, min_periods=period).sum() / period
            avg_loss = losses.rolling(window=period, min_periods=period).sum() / period
            rs = np.where(avg_loss == 0, 100.0, avg_gain / avg_loss)
            rsi_series = pd.Series(100.0 - (100.0 / (1.0 + rs)), index=df.index)
            entries = pd.Series(False, index=df.index)
            exits = pd.Series(False, index=df.index)
            in_position = False
            for i in range(period + 1, n):
                val = rsi_series.iloc[i]
                if not np.isnan(val):
                    if val <= oversold and not in_position:
                        entries.iloc[i] = True
                        in_position = True
                    elif val >= overbought and in_position:
                        exits.iloc[i] = True
                        in_position = False
            return entries, exits, warnings

        raise HTTPException(
            status_code=422,
            detail=f"Estrategia no soportada en vectorbt: '{strategy_id}'."
        )
