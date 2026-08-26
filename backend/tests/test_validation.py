import pytest
from fastapi import HTTPException
from backend.app.models.requests import PriceBarModel
from backend.app.validation.market_data_validator import validate_and_build_dataframe


def test_validation_valid_bars():
    bars = [
        PriceBarModel(timestamp="2023-01-01T00:00:00Z", open=100.0, high=105.0, low=95.0, close=102.0, volume=1000),
        PriceBarModel(timestamp="2023-01-02T00:00:00Z", open=102.0, high=108.0, low=101.0, close=107.0, volume=1500),
    ]
    df, fp = validate_and_build_dataframe(bars)
    assert len(df) == 2
    assert fp.startswith("fp_")


def test_validation_rejects_single_bar():
    bars = [PriceBarModel(timestamp="2023-01-01T00:00:00Z", open=100.0, high=105.0, low=95.0, close=102.0)]
    with pytest.raises(HTTPException):
        validate_and_build_dataframe(bars)


def test_validation_rejects_unordered_bars():
    bars = [
        PriceBarModel(timestamp="2023-01-02T00:00:00Z", open=102.0, high=108.0, low=101.0, close=107.0),
        PriceBarModel(timestamp="2023-01-01T00:00:00Z", open=100.0, high=105.0, low=95.0, close=102.0),
    ]
    with pytest.raises(HTTPException):
        validate_and_build_dataframe(bars)


def test_validation_rejects_duplicate_timestamps():
    bars = [
        PriceBarModel(timestamp="2023-01-01T00:00:00Z", open=100.0, high=105.0, low=95.0, close=102.0),
        PriceBarModel(timestamp="2023-01-01T00:00:00Z", open=101.0, high=106.0, low=96.0, close=103.0),
    ]
    with pytest.raises(HTTPException):
        validate_and_build_dataframe(bars)
