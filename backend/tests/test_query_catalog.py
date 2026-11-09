"""The query catalog in db/bulk/queries/ stays complete and runnable (specs/backend (003), SC-001).

Its SQL is copied from what the app really sends, so these tests are what keeps it from drifting:
every query function in the code is in the catalog or excluded with a reason, every entry points at
code that exists, and every SQL file still runs against the current schema.
"""

import ast
from pathlib import Path

import asyncpg
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings
from caravansara.devdata import measure
from caravansara.devdata.load import _plain
from tests.factories import Factory

SRC = Path(measure.__file__).resolve().parents[1]
CATALOG_DIR = Settings().seed_dir / "bulk" / "queries"


def query_functions() -> set[str]:
    """Every top-level ``async def`` in a module's repository: each one sends SQL."""
    found = set()
    for path in sorted(SRC.glob("*/repository.py")):
        for node in ast.parse(path.read_text(encoding="utf-8")).body:
            if isinstance(node, ast.AsyncFunctionDef):
                found.add(f"caravansara.{path.parent.name}.repository:{node.name}")
    return found


def catalog() -> tuple[list[measure.Query], list[dict[str, str]]]:
    queries, _ = measure.load_catalog(CATALOG_DIR)  # raises for any invalid entry
    excluded = measure.load_excluded(CATALOG_DIR)
    return queries, excluded


def test_every_query_function_is_measured_or_excluded_with_a_reason() -> None:
    queries, excluded = catalog()
    assert all(e["reason"].strip() for e in excluded)
    covered = {q.source for q in queries} | {e["source"] for e in excluded}
    missing = query_functions() - covered
    assert not missing, f"add these to db/bulk/queries/catalog.json: {sorted(missing)}"


def test_excluded_entries_point_at_real_code() -> None:
    _, excluded = catalog()
    for e in excluded:
        assert measure.source_exists(e["source"]), e["source"]


async def test_every_catalog_query_runs_on_the_current_schema(
    prepared: Settings, engine: AsyncEngine, factory: Factory
) -> None:
    await factory.booking(status="completed", check_in=-10, check_out=-7)
    await factory.booking(status="confirmed")
    queries, params_sql = measure.load_catalog(CATALOG_DIR)
    conn = await asyncpg.connect(_plain(prepared.database_url))
    try:
        chosen = dict(await conn.fetchrow(params_sql) or {})
        for q in queries:
            try:
                await conn.execute("EXPLAIN " + measure.bind(q, chosen))  # plans only; nothing runs
            except asyncpg.PostgresError as exc:
                pytest.fail(f"{q.name}.sql: {exc}")
    finally:
        await conn.close()
