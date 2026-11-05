"""Per-request id, one log line and RED metrics for every HTTP request."""

import logging
import re
import uuid
from time import perf_counter

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from caravansara.core.logs import request_id_var
from caravansara.core.metrics import HTTP_DURATION, HTTP_REQUESTS

log = logging.getLogger("caravansara.http")

REQUEST_ID_HEADER = "X-Request-ID"
# A caller (or a proxy) may send its own id; accept only a safe shape so it can't inject log text.
_VALID_ID = re.compile(r"[A-Za-z0-9._-]{8,64}")
_UNMATCHED = "unmatched"  # 404s for unknown paths share one label instead of one series per path
_NOT_LOGGED = {"/health", "/metrics"}  # polled every few seconds by compose and Prometheus


def _incoming_id(scope: Scope) -> str | None:
    for name, value in scope.get("headers", []):
        if name == b"x-request-id":
            candidate = value.decode("latin-1")
            return candidate if _VALID_ID.fullmatch(candidate) else None
    return None


def _route(scope: Scope) -> str:
    """The route template, e.g. ``/api/v1/listings/{listing_id}``.

    FastAPI keeps included routers nested, so ``route.path`` is relative to its router
    (``/listings/{listing_id}``). Router prefixes here have no parameters, so the leading
    segments of the real path are exactly the prefix.
    """
    route = scope.get("route")
    template = getattr(route, "path", None)
    if not isinstance(template, str):
        return _UNMATCHED
    segments = scope["path"].rstrip("/").split("/")
    depth = len(template.rstrip("/").split("/")) - 1
    prefix = "/".join(segments[: len(segments) - depth])
    return prefix + template


class RequestMiddleware:
    """Pure ASGI, so it adds no buffering; it runs inside the OpenTelemetry span, so logs get the trace id."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = _incoming_id(scope) or uuid.uuid4().hex
        token = request_id_var.set(request_id)
        status = 500  # unless a response starts, the server answers 500
        start = perf_counter()

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                MutableHeaders(scope=message).append(REQUEST_ID_HEADER, request_id)
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            log.exception("unhandled error", extra={"method": scope["method"], "route": _route(scope)})
            raise
        finally:
            duration = perf_counter() - start
            method, route = scope["method"], _route(scope)
            if route != "/metrics":
                HTTP_REQUESTS.labels(method, route, str(status)).inc()
                HTTP_DURATION.labels(method, route).observe(duration)
            if route not in _NOT_LOGGED:
                log.log(
                    logging.ERROR if status >= 500 else logging.INFO,
                    "%s %s %d",
                    method,
                    route,
                    status,
                    # the path without the query string: queries may carry search coordinates
                    extra={
                        "method": method,
                        "route": route,
                        "path": scope["path"],
                        "status": status,
                        "duration_ms": round(duration * 1000, 1),
                    },
                )
            request_id_var.reset(token)
