from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/quant/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["engine"] == "vectorbt"
    assert "pythonVersion" in data
    assert "vectorbtVersion" in data
    assert "numpyVersion" in data
    assert "pandasVersion" in data
    assert "numbaVersion" in data
    assert "quantEnvironmentFingerprint" in data
    assert data["quantEnvironmentFingerprint"].startswith("qenv_")
