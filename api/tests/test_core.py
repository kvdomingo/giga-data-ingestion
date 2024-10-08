from data_ingestion.api import app
from fastapi import status
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health_check():
    response = client.get("/api")
    assert response.status_code == status.HTTP_200_OK
