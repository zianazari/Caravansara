"""OpenTelemetry tracing: one trace per request or worker run, with spans for SQL and S3 calls.

Traces go over OTLP/HTTP to a collector (Grafana Alloy in compose), which forwards them to
Tempo. OpenTelemetry is vendor neutral, so changing the backend only changes the collector.
Tracing is off when ``otel_endpoint`` is not set.
"""

from collections.abc import Sequence

from opentelemetry.context import Context
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.botocore import BotocoreInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter
from opentelemetry.sdk.trace.sampling import Decision, ParentBased, Sampler, SamplingResult, TraceIdRatioBased
from opentelemetry.trace import Link, SpanKind
from opentelemetry.util.types import Attributes
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings


class _RootRequestsOnly(Sampler):
    """Start traces only at requests and worker runs.

    A SQL or S3 call with no parent (the health check's ``SELECT 1``, startup) would otherwise
    become its own one-span trace every few seconds and hide the real ones.
    """

    def __init__(self, ratio: float) -> None:
        self._ratio = TraceIdRatioBased(ratio)

    def should_sample(
        self,
        parent_context: Context | None,
        trace_id: int,
        name: str,
        kind: SpanKind | None = None,
        attributes: Attributes = None,
        links: Sequence[Link] | None = None,
        trace_state: object = None,
    ) -> SamplingResult:
        if kind == SpanKind.CLIENT:
            return SamplingResult(Decision.DROP)
        return self._ratio.should_sample(parent_context, trace_id, name, kind, attributes, links)

    def get_description(self) -> str:
        return f"RootRequestsOnly({self._ratio.get_description()})"


def tracer_provider(settings: Settings, service: str, exporter: SpanExporter | None = None) -> TracerProvider | None:
    """A provider for this process, or None when tracing is off. Tests pass their own exporter."""
    if exporter is None:
        if not settings.otel_endpoint:
            return None
        exporter = OTLPSpanExporter(endpoint=f"{settings.otel_endpoint.rstrip('/')}/v1/traces", timeout=5)
    provider = TracerProvider(
        resource=Resource.create({"service.name": service, "deployment.environment": settings.environment}),
        sampler=ParentBased(_RootRequestsOnly(settings.otel_sample_ratio)),
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    return provider


def instrument_clients(provider: TracerProvider, engine: AsyncEngine) -> None:
    """Spans for every SQL statement on this engine and every S3 call."""
    # The package still pins sqlalchemy < 2.1 although its event API is unchanged in 2.1;
    # tests/test_observability.py proves SQL spans still arrive, so the pin is skipped.
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine, tracer_provider=provider, skip_dep_check=True)
    BotocoreInstrumentor().instrument(tracer_provider=provider)  # type: ignore[no-untyped-call]  # untyped package


def shutdown(provider: TracerProvider) -> None:
    SQLAlchemyInstrumentor().uninstrument()
    BotocoreInstrumentor().uninstrument()  # type: ignore[no-untyped-call]
    provider.shutdown()  # sends the spans still in the batch
