from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.requests import PriceBarModel
from backend.app.validation.market_data_validator import calculate_dataset_fingerprint

client = TestClient(app)


def build_sample_payload(strategy_id="BUY_AND_HOLD", execution_mode="NEXT_OPEN", stop_loss=None):
    bars = []
    for i in range(25):
        day = str(i + 1).zfill(2)
        price = 100.0 + i
        bars.append(PriceBarModel(timestamp=f"2023-01-{day}T00:00:00Z", open=price, high=price + 2, low=price - 1, close=price + 0.5, volume=5000))
    fp = calculate_dataset_fingerprint(bars)
    return {
        "assetTicker": "SPY",
        "assetName": "SPDR S&P 500 ETF Trust",
        "bars": [b.model_dump() for b in bars],
        "strategy": {"id": strategy_id, "name": "Test Strategy", "parameters": {"fastPeriod": 5, "slowPeriod": 12}},
        "config": {"initialCapital": 10000.0, "commissionPct": 0.05, "slippagePct": 0.02, "riskFreeRateAnnualPct": 3.0, "positionSizingPct": 100.0, "executionMode": execution_mode, "stopLossPct": stop_loss},
        "dataProvenance": {"sourceType": "REAL", "provider": "Yahoo Finance", "symbol": "SPY", "datasetFingerprint": fp, "isReproducible": False},
        "datasetFingerprint": fp
    }


def test_full_backtest_execution():
    response = client.post("/api/quant/backtest", json=build_sample_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["engine"] == "vectorbt"
    assert data["inputDatasetFingerprint"] == data["outputDatasetFingerprint"]
    assert data["metrics"]["finalEquity"] > 0


def test_rejects_unsupported_execution_mode():
    response = client.post("/api/quant/backtest", json=build_sample_payload(execution_mode="SAME_CLOSE"))
    assert response.status_code == 400


def test_rejects_stops():
    response = client.post("/api/quant/backtest", json=build_sample_payload(stop_loss=3.5))
    assert response.status_code == 400


def test_rejects_mismatched_fingerprint():
    payload = build_sample_payload()
    payload["datasetFingerprint"] = "fp_faked_fingerprint_123"
    response = client.post("/api/quant/backtest", json=payload)
    assert response.status_code == 422
