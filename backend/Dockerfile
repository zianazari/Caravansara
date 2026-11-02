# Build context: the repository root, so the image also gets db/ (seed files).
FROM python:3.13-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1
WORKDIR /app/backend

# Dependencies first, so code changes don't reinstall them.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ ./
COPY db/ /app/db/
RUN uv sync --frozen --no-dev

# Host files may be owner-only; the app user only needs to read them.
RUN chmod -R a+rX /app && useradd --system --uid 10001 app
USER app
EXPOSE 8000
CMD ["caravansara", "serve"]
