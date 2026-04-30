from fastapi import Header, HTTPException, status
from app.config.settings import settings

def verify_internal_secret(x_internal_secret: str | None = Header(default=None, alias="X-Internal-Secret")):
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
