"""Structured logs: one JSON object per line, with ``request_id`` and ``trace_id``.

The ids connect a log line to its request and its trace in Grafana. Personal data and
secrets never reach the log: logs are usually readable by more people than the database.
"""

import contextvars
import json
import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any

from opentelemetry import trace

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)

_STANDARD_ATTRS = set(vars(logging.makeLogRecord({}))) | {"message", "asctime", "taskName"}
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}")
_BEARER = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
_SECRET_FIELD = re.compile(r"(?i)password|secret|token|authorization|cookie|address|email")

# The OTLP exporter retries and logs on every failed batch. When the collector is not
# running (the observability profile is off), that would flood the log; tracing is best effort.
_QUIET_LOGGERS = ("opentelemetry.exporter.otlp.proto.http.trace_exporter", "opentelemetry.sdk.trace.export")


def redact(text: str) -> str:
    """Mask bearer tokens, JWTs and email addresses that slipped into a message."""
    text = _BEARER.sub("Bearer [redacted]", text)
    text = _JWT.sub("[token]", text)
    return _EMAIL.sub("[email]", text)


def _context() -> dict[str, str]:
    ids: dict[str, str] = {}
    if request_id := request_id_var.get():
        ids["request_id"] = request_id
    span = trace.get_current_span().get_span_context()
    if span.is_valid:
        ids["trace_id"] = format(span.trace_id, "032x")
        ids["span_id"] = format(span.span_id, "016x")
    return ids


_base_factory = logging.getLogRecordFactory()


def _record_with_ids(*args: Any, **kwargs: Any) -> logging.LogRecord:
    """Attach the ids when the record is created, i.e. inside the request, not when it is written."""
    record = _base_factory(*args, **kwargs)
    for key, value in _context().items():
        setattr(record, key, value)
    return record


logging.setLogRecordFactory(_record_with_ids)


def _extra(record: logging.LogRecord) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for key, value in vars(record).items():
        if key in _STANDARD_ATTRS or key.startswith("_"):
            continue
        if _SECRET_FIELD.search(key):
            fields[key] = "[redacted]"
        else:
            fields[key] = redact(value) if isinstance(value, str) else value
    return fields


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": redact(record.getMessage()),
            **_extra(record),  # includes request_id, trace_id and span_id
        }
        if record.exc_info:
            entry["exception"] = redact(self.formatException(record.exc_info))
        return json.dumps(entry, default=str, ensure_ascii=False)


class TextFormatter(logging.Formatter):
    def __init__(self) -> None:
        super().__init__("%(asctime)s %(levelname)s %(name)s: %(message)s")

    def format(self, record: logging.LogRecord) -> str:
        line = redact(super().format(record))
        request_id = getattr(record, "request_id", None)
        return f"{line} [request_id={request_id}]" if request_id else line


def configure_logging(level: str = "INFO", fmt: str = "json") -> None:
    """Send every logger, uvicorn's included, through one stdout handler."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if fmt == "json" else TextFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True
    # The request middleware writes one line per request, with route, status and duration.
    logging.getLogger("uvicorn.access").disabled = True
    for name in _QUIET_LOGGERS:
        logging.getLogger(name).setLevel(logging.CRITICAL)
