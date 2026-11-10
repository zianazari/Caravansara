"""One error shape for every failure: ``{"error": {"code", "message", "details"?}}``.

``code`` is stable and machine-readable, so clients can show their own (e.g. Persian) text.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class NotFound(AppError):
    def __init__(self, message: str = "Not found.") -> None:
        super().__init__(404, "not_found", message)


class Forbidden(AppError):
    def __init__(self, message: str = "You are not allowed to do this.", code: str = "forbidden") -> None:
        super().__init__(403, code, message)


class Unauthorized(AppError):
    def __init__(self, message: str = "Authentication required.", code: str = "unauthorized") -> None:
        super().__init__(401, code, message)


class Conflict(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(409, code, message)


class Unprocessable(AppError):
    def __init__(self, code: str, message: str, details: Any = None) -> None:
        super().__init__(422, code, message, details)


class ServiceUnavailable(AppError):
    """A service the request needs (such as file storage) cannot be reached right now. Nothing was changed, so
    the client may try again (specs/006-avatar-upload-via-api, research R4)."""

    def __init__(self, message: str = "The service is not reachable right now.") -> None:
        super().__init__(503, "service_unavailable", message)


# ---- OpenAPI models, so Swagger shows the error shape -------------------------------


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any = None


class ErrorResponse(BaseModel):
    error: ErrorBody


def error_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    """``responses=`` entries for a route, documenting its error statuses in Swagger."""
    descriptions = {
        400: "Bad request",
        401: "Missing, invalid or expired access token",
        403: "Not allowed",
        404: "Not found",
        409: "Conflict with the current state",
        413: "The request body is larger than allowed",
        415: "The declared content type is not accepted",
        422: "Invalid input or a broken business rule",
        429: "Too many attempts",
        503: "A service the request needs is not reachable; nothing was changed",
    }
    return {s: {"model": ErrorResponse, "description": descriptions.get(s, "Error")} for s in statuses}


# ---- handlers ------------------------------------------------------------------------


def _body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


_HTTP_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in exc.errors()
        ]
        return JSONResponse(_body("validation_error", "The request is not valid.", details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, "http_error")
        return JSONResponse(_body(code, str(exc.detail)), status_code=exc.status_code, headers=exc.headers)
