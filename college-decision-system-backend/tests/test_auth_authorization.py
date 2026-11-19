from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.api.v1.routers import chat
from app.config.settings import settings
from app.main import app


TEST_SECRET = "iteration-6-auth-test-secret-with-more-than-32-bytes"


def _base64url_json(value: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")


def _token(subject: str, role: str) -> str:
    now = int(time.time())
    header = _base64url_json({"alg": "HS256", "typ": "JWT"})
    payload = _base64url_json({
        "iss": settings.AUTH_JWT_ISSUER,
        "aud": settings.AUTH_JWT_AUDIENCE,
        "sub": subject,
        "role": role,
        "student_id": subject,
        "name": subject,
        "iat": now,
        "exp": now + 3600,
    })
    signing_input = f"{header}.{payload}"
    signature = hmac.new(TEST_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{signing_input}.{encoded_signature}"


@pytest.fixture()
def auth_client() -> TestClient:
    original = settings.AUTH_JWT_SECRET
    settings.AUTH_JWT_SECRET = SecretStr(TEST_SECRET)
    try:
        with TestClient(app) as client:
            yield client
    finally:
        settings.AUTH_JWT_SECRET = original
        app.dependency_overrides.clear()


def test_admin_routes_enforce_unauthorized_forbidden_and_admin_role(auth_client: TestClient) -> None:
    assert auth_client.get("/api/v1/admin/programs").status_code == 401
    assert auth_client.put(
        "/api/v1/admin/programs/not-a-program",
        json={"min_percentage": 90},
    ).status_code == 401

    student_headers = {"Authorization": f"Bearer {_token('student:alice', 'student')}"}
    assert auth_client.get("/api/v1/admin/programs", headers=student_headers).status_code == 403
    assert auth_client.put(
        "/api/v1/admin/programs/not-a-program",
        headers=student_headers,
        json={"min_percentage": 90},
    ).status_code == 403

    admin_headers = {"Authorization": f"Bearer {_token('admin:release', 'admin')}"}
    response = auth_client.get("/api/v1/admin/programs", headers=admin_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_invalid_signature_is_unauthorized(auth_client: TestClient) -> None:
    token = _token("student:alice", "student")
    parts = token.split(".")
    parts[2] = ("B" if parts[2][0] == "A" else "A") + parts[2][1:]
    response = auth_client.get(
        "/api/v1/admin/programs",
        headers={"Authorization": f"Bearer {'.'.join(parts)}"},
    )
    assert response.status_code == 401


def test_admin_program_mutation_is_validated_and_readable(auth_client: TestClient) -> None:
    admin_headers = {"Authorization": f"Bearer {_token('admin:release', 'admin')}"}
    programs_response = auth_client.get("/api/v1/admin/programs", headers=admin_headers)
    assert programs_response.status_code == 200
    original = programs_response.json()[0]
    program_id = original["id"]
    replacement_percentage = 87.25 if original["min_percentage"] != 87.25 else 88.25

    try:
        update_response = auth_client.put(
            f"/api/v1/admin/programs/{program_id}",
            headers=admin_headers,
            json={"min_percentage": replacement_percentage},
        )
        assert update_response.status_code == 200, update_response.text
        updated = update_response.json()
        assert updated["status"] == "success"
        assert updated["program"]["min_percentage"] == replacement_percentage
        assert updated["program"]["program_fees"] == original["program_fees"]
        assert updated["program"]["allowed_tracks"] == original["allowed_tracks"]

        refreshed = auth_client.get("/api/v1/admin/programs", headers=admin_headers)
        assert refreshed.status_code == 200
        persisted = next(item for item in refreshed.json() if item["id"] == program_id)
        assert persisted["min_percentage"] == replacement_percentage

        assert auth_client.put(
            f"/api/v1/admin/programs/{program_id}",
            headers=admin_headers,
            json={"min_percentage": 101},
        ).status_code == 422
        assert auth_client.put(
            f"/api/v1/admin/programs/{program_id}",
            headers=admin_headers,
            json={"unknown_field": "not allowed"},
        ).status_code == 422
        assert auth_client.put(
            f"/api/v1/admin/programs/{program_id}",
            headers=admin_headers,
            json={},
        ).status_code == 422
    finally:
        restore_response = auth_client.put(
            f"/api/v1/admin/programs/{program_id}",
            headers=admin_headers,
            json={
                "min_percentage": original["min_percentage"],
                "program_fees": original["program_fees"],
                "allowed_tracks": original["allowed_tracks"],
            },
        )
        assert restore_response.status_code == 200, restore_response.text


def test_decision_chat_scopes_same_client_session_to_authenticated_subject(auth_client: TestClient) -> None:
    seen_session_ids: list[str] = []

    class FakeAgentService:
        def process_message(self, session_id: str, message: str):
            seen_session_ids.append(session_id)
            return f"received {message}", []

    def fake_agent_service():
        yield FakeAgentService()

    app.dependency_overrides[chat.get_agent_service] = fake_agent_service
    payload = {"session_id": "shared-browser-session", "message": "hello"}

    alice_response = auth_client.post(
        "/api/v1/chat/message",
        headers={"Authorization": f"Bearer {_token('student:alice', 'student')}"},
        json=payload,
    )
    bob_response = auth_client.post(
        "/api/v1/chat/message",
        headers={"Authorization": f"Bearer {_token('student:bob', 'student')}"},
        json=payload,
    )

    assert alice_response.status_code == 200
    assert bob_response.status_code == 200
    assert alice_response.json()["session_id"] == payload["session_id"]
    assert bob_response.json()["session_id"] == payload["session_id"]
    assert seen_session_ids == [
        "13:student:alice:shared-browser-session",
        "11:student:bob:shared-browser-session",
    ]
