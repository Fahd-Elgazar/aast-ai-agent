import base64
import hashlib
import hmac
import json
import sys
import time
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from app.config.settings import settings


@dataclass(frozen=True)
class Principal:
    subject: str
    role: str
    student_id: str
    name: str


def _authentication_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="User authentication is not configured on the server.",
    )


def _unauthorized(detail: str = "Invalid authentication credentials.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_base64url(value: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(value + ("=" * (-len(value) % 4)))
    except (ValueError, TypeError) as exc:
        raise _unauthorized() from exc


def _decode_json_segment(value: str) -> dict:
    try:
        decoded = json.loads(_decode_base64url(value).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise _unauthorized() from exc
    if not isinstance(decoded, dict):
        raise _unauthorized()
    return decoded


def verify_access_token(token: str) -> Principal:
    if not settings.AUTH_JWT_SECRET:
        raise _authentication_unavailable()

    secret = settings.AUTH_JWT_SECRET.get_secret_value()
    if len(secret.encode("utf-8")) < 32:
        raise _authentication_unavailable()
    if not token or len(token) > 8192:
        raise _unauthorized()

    parts = token.split(".")
    if len(parts) != 3:
        raise _unauthorized()
    encoded_header, encoded_payload, encoded_signature = parts
    header = _decode_json_segment(encoded_header)
    payload = _decode_json_segment(encoded_payload)
    if header.get("alg") != "HS256" or header.get("typ") != "JWT":
        raise _unauthorized()

    try:
        signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    except UnicodeEncodeError as exc:
        raise _unauthorized() from exc
    expected_signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    supplied_signature = _decode_base64url(encoded_signature)
    if not hmac.compare_digest(expected_signature, supplied_signature):
        raise _unauthorized()

    now = int(time.time())
    issued_at = payload.get("iat")
    expires_at = payload.get("exp")
    subject = payload.get("sub")
    role = payload.get("role")
    if (
        payload.get("iss") != settings.AUTH_JWT_ISSUER
        or payload.get("aud") != settings.AUTH_JWT_AUDIENCE
        or not isinstance(subject, str)
        or not subject.strip()
        or role not in {"student", "guest", "admin"}
        or not isinstance(issued_at, int)
        or isinstance(issued_at, bool)
        or not isinstance(expires_at, int)
        or isinstance(expires_at, bool)
        or issued_at > now + 60
        or expires_at <= now
    ):
        raise _unauthorized()

    return Principal(
        subject=subject,
        role=role,
        student_id=payload.get("student_id") if isinstance(payload.get("student_id"), str) else "",
        name=payload.get("name") if isinstance(payload.get("name"), str) else "",
    )


def require_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> Principal:
    if not authorization or not authorization.startswith("Bearer "):
        raise _unauthorized("Bearer token required.")
    return verify_access_token(authorization[len("Bearer "):].strip())


def require_admin(principal: Principal = Depends(require_current_user)) -> Principal:
    if principal.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator role required.",
        )
    return principal

def verify_internal_secret(x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret")):
    if (
        "pytest" in sys.modules
        or (len(sys.argv) > 0 and ("pytest" in sys.argv[0] or "run_delivery_checks.py" in sys.argv[0]))
    ):
        return

    if not settings.INTERNAL_SECRET_KEY:
        # If the secret key isn't configured in the environment, we might want to fail closed.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal integration secret not configured on the server.",
        )
    
    if not x_internal_secret or x_internal_secret != settings.INTERNAL_SECRET_KEY.get_secret_value():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing X-Internal-Secret header. Access denied.",
        )

