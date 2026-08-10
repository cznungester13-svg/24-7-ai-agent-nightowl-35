import importlib

import motor.motor_asyncio as motor_asyncio
import pytest
from fastapi.testclient import TestClient


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, _length):
        return list(self._docs)


class FakeCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        self.docs.append(doc)
        return type("InsertResult", (), {"inserted_id": 1})()

    def find(self, *_args, **_kwargs):
        return FakeCursor(self.docs)


class FakeDatabase:
    def __init__(self):
        self.status_checks = FakeCollection()


class FakeAsyncMongoClient:
    def __init__(self, *args, **kwargs):
        self._db = FakeDatabase()

    def __getitem__(self, _name):
        return self._db

    def close(self):
        return None


def test_server_defaults_when_environment_is_missing(monkeypatch):
    monkeypatch.delenv("MONGO_URL", raising=False)
    monkeypatch.delenv("DB_NAME", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    import backend.server as server

    monkeypatch.setattr(motor_asyncio, "AsyncIOMotorClient", FakeAsyncMongoClient)
    module = importlib.reload(server)

    assert module.app is not None


@pytest.fixture()
def server_module(monkeypatch):
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("DB_NAME", "test_db")
    monkeypatch.setenv("CORS_ORIGINS", "*")

    import backend.server as server

    monkeypatch.setattr(motor_asyncio, "AsyncIOMotorClient", FakeAsyncMongoClient)
    module = importlib.reload(server)
    return module


@pytest.fixture()
def client(server_module):
    with TestClient(server_module.app) as test_client:
        yield test_client


def test_root_endpoint(client):
    response = client.get("/api/")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello World"}


def test_status_endpoints_round_trip(client):
    response = client.post("/api/status", json={"client_name": "Nightowl"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["client_name"] == "Nightowl"
    assert payload["id"]
    assert payload["timestamp"]

    list_response = client.get("/api/status")

    assert list_response.status_code == 200
    items = list_response.json()
    assert len(items) == 1
    assert items[0]["client_name"] == "Nightowl"
    assert items[0]["id"] == payload["id"]
