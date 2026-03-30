"""Standard API response helpers."""

from typing import Any


def api_response(
    success: bool,
    message: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "success": success,
        "message": message,
    }
    if data is not None:
        body["data"] = data
    return body


def error_response(message: str) -> dict[str, Any]:
    return api_response(False, message)
