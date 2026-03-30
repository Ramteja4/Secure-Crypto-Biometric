"""HTTP routes for registration and login (multipart fingerprint upload)."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.database.db import get_database
from app.services.auth_service import AuthService
from app.services.encryption import EncryptionService
from app.services.fingerprint import FingerprintService
from app.utils.helpers import api_response, error_response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])


def get_auth_service(settings: Annotated[Settings, Depends(get_settings)]) -> AuthService:
    db = get_database()
    enc = EncryptionService(settings.fernet_key)
    fp = FingerprintService()
    return AuthService(db, settings, enc, fp)


@router.post("/register")
async def register(
    email: Annotated[str, Form(..., description="User email")],
    password: Annotated[str, Form(..., min_length=8, description="Min 8 characters")],
    fingerprint: Annotated[UploadFile, File(..., description="Fingerprint image file")],
    auth: Annotated[AuthService, Depends(get_auth_service)],
):
    """
    Register with email, password, and fingerprint image.
    Image is encrypted with Fernet before persistence; password is bcrypt-hashed.
    """
    if not fingerprint.filename:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response("Fingerprint file is required"),
        )

    content = await fingerprint.read()
    if not content:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response("Empty fingerprint file"),
        )

    if len(content) > 10 * 1024 * 1024:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response("Fingerprint file too large (max 10MB)"),
        )

    try:
        result = await auth.register(email, password, content)
    except Exception:
        logger.exception("Register failed")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response("Server error during registration"),
        )

    if not result["ok"]:
        code = status.HTTP_409_CONFLICT if result.get("error") == "email_exists" else status.HTTP_400_BAD_REQUEST
        return JSONResponse(status_code=code, content=error_response(result["message"]))

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=api_response(True, result["message"]),
    )


@router.post("/login")
async def login(
    email: Annotated[str, Form(...)],
    password: Annotated[str, Form(...)],
    fingerprint: Annotated[UploadFile, File(...)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
):
    """Verify password and fingerprint; return JWT and match score on success."""
    if not fingerprint.filename:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response("Fingerprint file is required"),
        )

    content = await fingerprint.read()
    if not content:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_response("Empty fingerprint file"),
        )

    try:
        result = await auth.login(email, password, content)
    except Exception:
        logger.exception("Login failed")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response("Server error during login"),
        )

    if not result["ok"]:
        err = result.get("error", "")
        if err == "invalid_credentials":
            status_code = status.HTTP_401_UNAUTHORIZED
        elif err == "fingerprint_mismatch":
            status_code = status.HTTP_403_FORBIDDEN
        else:
            status_code = status.HTTP_400_BAD_REQUEST

        body = error_response(result["message"])
        if "match_score" in result:
            body["data"] = {
                "match_score": result["match_score"],
                "threshold": result.get("threshold"),
            }
        return JSONResponse(status_code=status_code, content=body)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=api_response(
            True,
            result["message"],
            data={
                "access_token": result["access_token"],
                "token_type": result["token_type"],
                "match_score": result["match_score"],
                "threshold": result["threshold"],
            },
        ),
    )


@router.get("/health")
async def health():
    return {"status": "ok"}
