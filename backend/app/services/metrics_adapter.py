from __future__ import annotations
import math
from datetime import datetime, timezone
import pandas as pd
import numpy as np
from ..models.responses import (
    BacktestMetricsModel,
    EquityPointModel,
    TradeModel,
)


def pct_to_decimal(pct: float) -> float:
    """Converts a percentage (e.g. 0.05 for 0.05%) to a decimal fraction (0.0005)."""
    return pct / 100.0


def decimal_to_pct(decimal: float) -> float:
    """Converts a decimal fraction (e.g. 0.05 for 5%) to a percentage (5.0)."""
    return decimal * 100.0


class MetricsAdapter:
    @staticmethod
    def extract_metrics(
        portfolio: any,
        initial_capital: float,
        df: pd.DataFrame,
        risk_free_rate_annual_pct: float = 3.0
    ) -> BacktestMetricsModel:
        value_series = portfolio.value()
        final_equity = float(value_series.iloc[-1]) if len(value_series) > 0 else initial_capital
        total_return_pct = ((final_equity - initial_capital) / initial_capital) * 100.0
        n_bars = len(df)
        periods_per_year = 252.0
        years = n_bars / periods_per_year if n_bars > 0 else 0
        cagr_pct: float | None = None
        annualized_return_pct: float | None = None
        if years >= (30.0 / 365.0) and final_equity > 0 and initial_capital > 0:
            cagr = (final_equity / initial_capital) ** (1.0 / years) - 1.0
            cagr_pct = float(cagr * 100.0)
            annualized_return_pct = cagr_pct
        daily_returns = portfolio.returns()
        mean_ret = float(daily_returns.mean()) if len(daily_returns) > 0 else 0.0
        std_ret = float(daily_returns.std()) if len(daily_returns) > 0 else 0.0
        rf_daily = (1.0 + pct_to_decimal(risk_free_rate_annual_pct)) ** (1.0 / periods_per_year) - 1.0
        sharpe_ratio: float | None = None
        if std_ret > 0:
            sharpe_ratio = float(((mean_ret - rf_daily) / std_ret) * math.sqrt(periods_per_year))
        sortino_ratio: float | None = None
        downside_diff = daily_returns - rf_daily
        downside_returns = downside_diff[downside_diff < 0]
        if len(downside_returns) > 0:
            downside_std = float(np.sqrt(np.mean(downside_returns ** 2)))
            if downside_std > 0:
                sortino_ratio = float(((mean_ret - rf_daily) / downside_std) * math.sqrt(periods_per_year))
        max_drawdown_pct = float(portfolio.max_drawdown() * 100.0)
        max_dd_duration_bars = int(portfolio.max_drawdown_duration()) if hasattr(portfolio, "max_drawdown_duration") else 0
        calmar_ratio: float | None = None
        if max_drawdown_pct > 0 and cagr_pct is not None:
            calmar_ratio = float(cagr_pct / max_drawdown_pct)
        trades_records = portfolio.trades.records_readable
        total_trades = len(trades_records) if trades_records is not None else 0
        winning_trades = 0
        losing_trades = 0
        gross_profit = 0.0
        gross_loss = 0.0
        if total_trades > 0 and "PnL" in trades_records.columns:
            pnls = trades_records["PnL"].dropna()
            for pnl in pnls:
                if pnl > 0:
                    winning_trades += 1
                    gross_profit += float(pnl)
                elif pnl < 0:
                    losing_trades += 1
                    gross_loss += abs(float(pnl))
        win_rate_pct = (winning_trades / total_trades * 100.0) if total_trades > 0 else 0.0
        profit_factor: float | None = None
        if gross_loss > 0:
            profit_factor = float(gross_profit / gross_loss)
        elif gross_profit > 0 and losing_trades == 0:
            profit_factor = float(gross_profit)
        total_commission = float(portfolio.total_fees_paid()) if hasattr(portfolio, "total_fees_paid") else 0.0
        total_slippage = float(portfolio.total_slippage_paid()) if hasattr(portfolio, "total_slippage_paid") else 0.0
        total_costs = total_commission + total_slippage
        return BacktestMetricsModel(
            initialCapital=round(initial_capital, 2), finalEquity=round(final_equity, 2),
            totalReturnPct=round(total_return_pct, 4),
            annualizedReturnPct=round(annualized_return_pct, 4) if annualized_return_pct is not None else None,
            cagrPct=round(cagr_pct, 4) if cagr_pct is not None else None,
            sharpeRatio=round(sharpe_ratio, 4) if sharpe_ratio is not None else None,
            sortinoRatio=round(sortino_ratio, 4) if sortino_ratio is not None else None,
            calmarRatio=round(calmar_ratio, 4) if calmar_ratio is not None else None,
            maxDrawdownPct=round(max_drawdown_pct, 4), maxDrawdownDurationBars=max_dd_duration_bars,
            totalTrades=total_trades, winningTrades=winning_trades, losingTrades=losing_trades,
            winRatePct=round(win_rate_pct, 2), profitFactor=round(profit_factor, 4) if profit_factor is not None else None,
            totalCommissionEur=round(total_commission, 2), totalSlippageEur=round(total_slippage, 2),
            totalTradingCostsEur=round(total_costs, 2),
        )

    @staticmethod
    def extract_equity_curve(portfolio: any, df: pd.DataFrame) -> list[EquityPointModel]:
        value_series = portfolio.value()
        cash_series = portfolio.cash()
        dd_series = portfolio.drawdown()
        points: list[EquityPointModel] = []
        for dt, val in value_series.items():
            ts_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
            cash_val = float(cash_series.loc[dt]) if dt in cash_series.index else float(val)
            dd_val = float(dd_series.loc[dt] * 100.0) if dt in dd_series.index else 0.0
            points.append(EquityPointModel(timestamp=ts_str, equity=round(float(val), 2), cash=round(cash_val, 2), drawdownPct=round(dd_val, 4)))
        return points

    @staticmethod
    def extract_trades(portfolio: any) -> list[TradeModel]:
        trades: list[TradeModel] = []
        records = portfolio.trades.records_readable
        if records is None or len(records) == 0:
            return trades
        for i, row in records.iterrows():
            entry_ts = row.get("Entry Timestamp") or row.get("Entry Date") or row.get("Entry Index")
            exit_ts = row.get("Exit Timestamp") or row.get("Exit Date") or row.get("Exit Index")
            entry_price = float(row.get("Avg Entry Price", row.get("Entry Price", 0.0)))
            exit_price = float(row.get("Avg Exit Price", row.get("Exit Price", 0.0)))
            size = float(row.get("Size", row.get("Shares", 0.0)))
            pnl = float(row.get("PnL", 0.0))
            pnl_pct = float(row.get("Return", 0.0) * 100.0)
            holding_bars = int(row.get("Duration", 0))
            commission = float(row.get("Fees", row.get("Commission", 0.0)))
            slippage_val = float(row.get("Slippage", 0.0))
            entry_str = entry_ts.isoformat() if hasattr(entry_ts, "isoformat") else str(entry_ts)
            exit_str = exit_ts.isoformat() if hasattr(exit_ts, "isoformat") else str(exit_ts)
            trades.append(TradeModel(
                id=f"vbt_trade_{i+1}", entryDate=entry_str, exitDate=exit_str,
                entryPrice=round(entry_price, 4), exitPrice=round(exit_price, 4), shares=round(size, 4),
                amountInvested=round(size * entry_price, 2), commissionEur=round(commission, 2),
                slippageEur=round(slippage_val, 2), pnlEur=round(pnl, 2), pnlPct=round(pnl_pct, 4),
                isWin=pnl > 0, holdingPeriodBars=holding_bars, exitReason="SIGNAL"
            ))
        return trades
