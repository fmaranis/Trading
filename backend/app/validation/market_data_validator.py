from __future__ import annotations
import math
from datetime import datetime, timezone
import pandas as pd
from fastapi import HTTPException
from ..models.requests import PriceBarModel


def format_num_js(val: float | int | None) -> str:
    if val is None:
        return "0"
    if isinstance(val, int):
        return str(val)
    if isinstance(val, float):
        if val.is_integer():
            return str(int(val))
        return str(val)
    return str(val)


def calculate_dataset_fingerprint(bars: list[PriceBarModel]) -> str:
    if not bars:
        return "fp_empty_dataset"

    hash_val = 0xcbf29ce484222325
    prime = 0x100000001b3
    mask = 0xFFFFFFFFFFFFFFFF

    for b in bars:
        row = (
            f"{b.timestamp}|{format_num_js(b.open)}|{format_num_js(b.high)}|"
            f"{format_num_js(b.low)}|{format_num_js(b.close)}|{format_num_js(b.volume)}\n"
        )
        for char in row:
            hash_val ^= ord(char)
            hash_val = (hash_val * prime) & mask

    return f"fp_{hash_val:016x}"


def validate_and_build_dataframe(bars: list[PriceBarModel]) -> tuple[pd.DataFrame, str]:
    if not bars or len(bars) < 2:
        raise HTTPException(status_code=422, detail="El dataset debe contener al menos 2 barras.")

    timestamps: list[datetime] = []
    opens: list[float] = []
    highs: list[float] = []
    lows: list[float] = []
    closes: list[float] = []
    volumes: list[float] = []
    last_ts_ms: float | None = None

    for i, b in enumerate(bars):
        try:
            clean_ts = b.timestamp.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            ts_ms = dt.timestamp() * 1000.0
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Timestamp inválido en barra [{i}]: {exc}")

        if last_ts_ms is not None:
            if ts_ms == last_ts_ms:
                raise HTTPException(status_code=422, detail=f"Timestamp duplicado en barra [{i}].")
            if ts_ms < last_ts_ms:
                raise HTTPException(status_code=422, detail=f"Barras desordenadas en índice [{i}].")
        last_ts_ms = ts_ms

        for price_name, val in [("open", b.open), ("high", b.high), ("low", b.low), ("close", b.close)]:
            if not isinstance(val, (int, float)) or math.isnan(val) or math.isinf(val) or val <= 0:
                raise HTTPException(status_code=422, detail=f"Valor inválido para {price_name} en barra [{i}].")

        if b.high < b.low or b.high < b.open or b.high < b.close or b.low > b.open or b.low > b.close:
            raise HTTPException(status_code=422, detail=f"Geometría OHLC inconsistente en barra [{i}].")

        vol = b.volume if b.volume is not None else 0.0
        if math.isnan(vol) or math.isinf(vol) or vol < 0:
            raise HTTPException(status_code=422, detail=f"Volumen inválido en barra [{i}].")

        timestamps.append(dt)
        opens.append(float(b.open))
        highs.append(float(b.high))
        lows.append(float(b.low))
        closes.append(float(b.close))
        volumes.append(float(vol))

    df = pd.DataFrame(
        {"Open": opens, "High": highs, "Low": lows, "Close": closes, "Volume": volumes},
        index=pd.DatetimeIndex(timestamps, name="Date")
    )
    return df, calculate_dataset_fingerprint(bars)
