"""Measure the important queries on the bulk data with one fixed method (specs/backend (003)).

The query list lives in ``db/bulk/queries/``: ``catalog.json``, one ``<name>.sql`` per query (the SQL
the app really sends, with ``:name`` parameters) and ``params.sql``, which picks representative values
from the data itself (the busiest listing, the London centre, ...). A parameter whose value starts
with ``@`` takes that column of the ``params.sql`` row; any other value is used as it is.

Method (research R2): one warm-up run, then ``runs`` runs of ``EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)``;
the median execution time is the number. Every run is its own transaction and is rolled back, reads
and writes alike, so measuring never changes the data. Parameters go into the SQL as literals, which
gives the same custom plan the app gets for its first executions of a prepared statement.

Each query gets a connection of its own. Once a backend has JIT-compiled one query, everything it
runs afterwards is slower (55 ms became 155 ms for a city search, measurements.md), so a shared
connection would let one costly query, or ``params.sql`` itself, change the numbers of the rest.
``jit`` in the result says whether the query itself was JIT-compiled.

Like the rest of ``devdata`` this package imports only ``caravansara.core`` (Constitution II): it reads
the SQL from files and checks each ``source`` against the code with ``ast``, without importing it.
"""

import ast
import json
import re
import statistics
from collections.abc import Iterator
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import asyncpg

from caravansara.core.config import Settings
from caravansara.devdata.load import _plain, with_database

_PACKAGE = Path(__file__).resolve().parents[1]  # src/caravansara
_NAME = re.compile(r"^[a-z][a-z0-9_]*$")
_SOURCE = re.compile(r"^caravansara\.([a-z_.]+):([A-Za-z_][A-Za-z0-9_]*)$")
_PARAM = re.compile(r"(?<![:\w]):([a-z_][a-z0-9_]*)")  # :name, but not ::type casts
_KINDS = ("read", "write")
_TIMEOUT = "120s"


class MeasureRefused(Exception):
    """A safety lock or an invalid catalog stopped the run; nothing was measured."""


@dataclass(frozen=True)
class Query:
    name: str
    source: str
    endpoint: str | None
    kind: str
    params: dict[str, Any]
    target_ms: float
    sql: str


@dataclass
class QueryResult:
    name: str
    median_ms: float | None = None
    runs_ms: list[float] = field(default_factory=list)
    shared_hit: int = 0
    shared_read: int = 0
    access: list[str] = field(default_factory=list)
    indexes: list[str] = field(default_factory=list)
    target_ms: float = 50
    meets_target: bool = False
    jit: bool = False
    error: str | None = None


@dataclass
class Report:
    database: str
    revision: str | None
    measured_at: str
    results: list[QueryResult]

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, ensure_ascii=False) + "\n"

    def markdown(self) -> str:
        lines = [
            f"{self.database} at revision {self.revision}, {self.measured_at}",
            "",
            "| query | median ms | target | | access | indexes |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for r in self.results:
            if r.error is not None:
                lines.append(f"| {r.name} | error | {r.target_ms:g} | ✗ | {r.error.splitlines()[0]} | |")
                continue
            mark = "✓" if r.meets_target else "✗"
            access = ", ".join([*r.access, *(["JIT"] if r.jit else [])])
            lines.append(
                f"| {r.name} | {r.median_ms:.1f} | {r.target_ms:g} | {mark} | {access} | {', '.join(r.indexes)} |"
            )
        return "\n".join(lines)

    @property
    def failed(self) -> bool:
        return any(r.error is not None for r in self.results)


def _invalid(name: str, rule: str) -> MeasureRefused:
    return MeasureRefused(f"invalid query catalog: {name}: {rule}")


def source_exists(source: str) -> bool:
    """True when ``caravansara.<module path>:<name>`` names a top-level function or assignment in the code."""
    m = _SOURCE.match(source)
    if not m:
        return False
    path = _PACKAGE.joinpath(*m.group(1).split(".")).with_suffix(".py")
    if not path.is_file():
        return False
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef) and node.name == m.group(2):
            return True
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == m.group(2) for t in node.targets):
            return True
    return False


def load_catalog(directory: Path) -> tuple[list[Query], str]:
    """The queries and the ``params.sql`` text; raises ``MeasureRefused`` for any invalid entry."""
    try:
        raw = json.loads((directory / "catalog.json").read_text(encoding="utf-8"))
        params_sql = (directory / "params.sql").read_text(encoding="utf-8")
    except (OSError, ValueError) as exc:
        raise _invalid("catalog.json", str(exc)) from None
    queries: list[Query] = []
    seen: set[str] = set()
    for item in raw.get("queries", []):
        name = str(item.get("name", ""))
        if not _NAME.match(name):
            raise _invalid(name, "name must be snake_case")
        if name in seen:
            raise _invalid(name, "duplicate name")
        seen.add(name)
        sql_file = directory / f"{name}.sql"
        if not sql_file.is_file():
            raise _invalid(name, f"missing {name}.sql")
        if not source_exists(str(item.get("source", ""))):
            raise _invalid(name, f"source {item.get('source')!r} is not a function or query in the code")
        if item.get("kind") not in _KINDS:
            raise _invalid(name, f"kind must be one of {', '.join(_KINDS)}")
        queries.append(
            Query(
                name=name,
                source=item["source"],
                endpoint=item.get("endpoint"),
                kind=item["kind"],
                params=dict(item.get("params", {})),
                target_ms=float(item.get("target_ms", 50)),
                sql=sql_file.read_text(encoding="utf-8").strip().rstrip(";"),
            )
        )
    return queries, params_sql


def load_excluded(directory: Path) -> list[dict[str, str]]:
    """Query functions left out of the catalog on purpose, each with its reason."""
    raw = json.loads((directory / "catalog.json").read_text(encoding="utf-8"))
    excluded = [
        {"source": str(e.get("source", "")), "reason": str(e.get("reason", ""))} for e in raw.get("excluded", [])
    ]
    for e in excluded:
        if not source_exists(e["source"]):
            raise _invalid(e["source"], "excluded source is not a function or query in the code")
        if not e["reason"].strip():
            raise _invalid(e["source"], "excluded entry needs a reason")
    return excluded


def _literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int | float | Decimal):
        return str(value)
    if isinstance(value, list | tuple):
        return "ARRAY[" + ", ".join(_literal(v) for v in value) + "]"
    if isinstance(value, date | datetime):
        value = value.isoformat()
    return "'" + str(value).replace("'", "''") + "'"


def bind(query: Query, chosen: dict[str, Any]) -> str:
    """The query's SQL with every ``:name`` replaced by a literal."""
    values: dict[str, Any] = {}
    for key, value in query.params.items():
        if isinstance(value, str) and value.startswith("@"):
            if value[1:] not in chosen:
                raise _invalid(query.name, f"params.sql has no column {value[1:]!r}")
            value = chosen[value[1:]]
        values[key] = value

    def replace(m: re.Match[str]) -> str:
        if m.group(1) not in values:
            raise _invalid(query.name, f"no value for :{m.group(1)}")
        return _literal(values[m.group(1)])

    return _PARAM.sub(replace, query.sql)


def _walk(plan: dict[str, Any]) -> Iterator[dict[str, Any]]:
    yield plan
    for child in plan.get("Plans", []):
        yield from _walk(child)


async def _explain(conn: asyncpg.Connection, statement: str) -> dict[str, Any]:
    tr = conn.transaction()
    await tr.start()
    try:
        await conn.execute(f"SET LOCAL statement_timeout = '{_TIMEOUT}'")
        raw = await conn.fetchval("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + statement)
    finally:
        await tr.rollback()  # reads and writes alike: measuring never changes the data
    result: dict[str, Any] = (json.loads(raw) if isinstance(raw, str) else raw)[0]
    return result


async def _measure_one(conn: asyncpg.Connection, query: Query, statement: str, runs: int) -> QueryResult:
    result = QueryResult(name=query.name, target_ms=query.target_ms)
    await _explain(conn, statement)  # warm-up: the first run pays for cold caches (research R2)
    last: dict[str, Any] = {}
    for _ in range(runs):
        last = await _explain(conn, statement)
        result.runs_ms.append(round(float(last["Execution Time"]), 3))
    result.median_ms = statistics.median(result.runs_ms)
    result.jit = "JIT" in last
    result.meets_target = result.median_ms <= query.target_ms
    top = last["Plan"]
    result.shared_hit = int(top.get("Shared Hit Blocks", 0))
    result.shared_read = int(top.get("Shared Read Blocks", 0))
    nodes = list(_walk(top))
    result.access = list(dict.fromkeys(n["Node Type"] for n in nodes))
    result.indexes = list(dict.fromkeys(n["Index Name"] for n in nodes if "Index Name" in n))
    return result


async def measure(
    settings: Settings, *, database: str, catalog_dir: Path, runs: int = 5, only: list[str] | None = None
) -> Report:
    if settings.environment == "production":
        raise MeasureRefused("measure-queries is for development and measurement only")
    url = with_database(_plain(settings.database_url), database)
    conn = await asyncpg.connect(url)
    try:
        if not await conn.fetchval("SELECT EXISTS (SELECT 1 FROM listings)"):
            raise MeasureRefused(f"{database} has no listings; run: caravansara seed-bulk")
        queries, params_sql = load_catalog(catalog_dir)
        if only:
            unknown = sorted(set(only) - {q.name for q in queries})
            if unknown:
                raise MeasureRefused(f"unknown query: {', '.join(unknown)}")
            queries = [q for q in queries if q.name in only]
        chosen = dict(await conn.fetchrow(params_sql) or {})
        revision = await conn.fetchval("SELECT version_num FROM alembic_version")
    finally:
        await conn.close()
    results: list[QueryResult] = []
    for query in queries:
        conn = await asyncpg.connect(url)  # a fresh backend per query: see the module docstring
        try:
            results.append(await _measure_one(conn, query, bind(query, chosen), runs))
        except (asyncpg.PostgresError, MeasureRefused) as exc:
            results.append(QueryResult(name=query.name, target_ms=query.target_ms, error=str(exc)))
        finally:
            await conn.close()
    return Report(database, revision, datetime.now(UTC).isoformat(timespec="seconds"), results)
