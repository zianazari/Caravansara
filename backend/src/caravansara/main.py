"""FastAPI application. Swagger UI: ``/docs``, ReDoc: ``/redoc``, schema: ``/api/v1/openapi.json``."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace.export import SpanExporter
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pydantic import BaseModel
from sqlalchemy import text

from caravansara.bookings.router import router as bookings_router
from caravansara.catalog.router import router as catalog_router
from caravansara.core.config import Settings, get_settings
from caravansara.core.db import create_engine, create_sessionmaker
from caravansara.core.errors import install_error_handlers
from caravansara.core.observability import RequestMiddleware
from caravansara.core.storage import Storage
from caravansara.core.telemetry import instrument_clients, shutdown, tracer_provider
from caravansara.identity.router import router as identity_router
from caravansara.listings.router import photos as photos_router
from caravansara.listings.router import router as listings_router
from caravansara.reviews.router import router as reviews_router
from caravansara.search.router import router as search_router

API_PREFIX = "/api/v1"

DESCRIPTION = """
Backend of **Caravansara**, an Airbnb-like place reservation site.

**How to try it here**

1. `POST /api/v1/auth/login` with a demo account, e.g. `guest@example.com` / `caravansara-demo`
   (after `caravansara seed-demo`), or register a new one.
2. Copy `access_token`, click **Authorize** and paste it.
3. Search, open a listing, reserve with `POST /bookings`, then pay within 15 minutes.

**Errors** always look like `{"error": {"code": "dates_unavailable", "message": "..."}}`.
`code` is stable, so clients can show their own text.
"""

TAGS = [
    {"name": "Auth and profile", "description": "Register, log in, rotate and revoke tokens, profile."},
    {"name": "Catalog", "description": "Countries, cities and amenities. Changed only by the seed command."},
    {"name": "Search", "description": "Where (city or radius), when, who and amenity filters."},
    {"name": "Listings", "description": "Listing details for everyone; create and edit for hosts."},
    {"name": "Listing photos", "description": "Direct uploads to storage with presigned URLs."},
    {"name": "Bookings", "description": "15-minute hold, simulated payment, trips and cancellation."},
    {"name": "Reviews", "description": "One review per completed stay, within 14 days."},
    {"name": "System", "description": "Health checks."},
]


class Health(BaseModel):
    status: str
    database: str


def create_app(settings: Settings | None = None, span_exporter: SpanExporter | None = None) -> FastAPI:
    """``span_exporter`` lets tests collect spans without a collector."""
    settings = settings or get_settings()
    tracing = tracer_provider(settings, "caravansara-api", span_exporter)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings)
        if tracing:
            instrument_clients(tracing, engine)
        app.state.settings = settings
        app.state.engine = engine
        app.state.sessionmaker = create_sessionmaker(engine)
        app.state.storage = Storage(settings)
        app.state.tracer_provider = tracing
        yield
        await engine.dispose()
        if tracing:
            shutdown(tracing)

    app = FastAPI(
        title="Caravansara API",
        version="1.0.0",
        description=DESCRIPTION,
        openapi_tags=TAGS,
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
        lifespan=lifespan,
    )
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    install_error_handlers(app)
    app.add_middleware(RequestMiddleware)

    api = APIRouter(prefix=API_PREFIX)
    for router in (
        identity_router,
        catalog_router,
        search_router,
        listings_router,
        photos_router,
        bookings_router,
        reviews_router,
    ):
        api.include_router(router)
    app.include_router(api)

    @app.get("/health", tags=["System"], summary="Liveness and database check")
    async def health() -> Health:
        async with app.state.engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return Health(status="ok", database="ok")

    if settings.metrics_enabled:

        @app.get("/metrics", include_in_schema=False)
        async def metrics() -> Response:
            return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/", include_in_schema=False)
    async def root() -> RedirectResponse:
        return RedirectResponse("/docs")

    if tracing:
        # Added last, so it is the outermost middleware: the request log line runs inside its span.
        FastAPIInstrumentor.instrument_app(app, tracer_provider=tracing, excluded_urls="/health,/metrics")
    return app
