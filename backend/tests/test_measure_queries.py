"""caravansara measure-queries: one fixed method for every before/after number (specs/backend (003))."""

import asyncio
import json
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara import cli
from caravansara.core.config import Settings
from caravansara.devdata import measure
from caravansara.devdata.load import database_name
from tests.factories import Factory
from tests.helpers import sql

PARAMS = "SELECT (SELECT min(id) FROM listings) AS listing, CURRENT_DATE + 30 AS check_in"


def write_catalog(root: Path, queries: list[dict[str, Any]], files: dict[str, str], params: str = PARAMS) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    (root / "catalog.json").write_text(json.dumps({"queries": queries, "excluded": []}), encoding="utf-8")
    (root / "params.sql").write_text(params, encoding="utf-8")
    for name, text in files.items():
        (root / f"{name}.sql").write_text(text, encoding="utf-8")
    return root


def query(name: str, kind: str = "read", **params: Any) -> dict[str, Any]:
    return {
        "name": name,
        "source": "caravansara.listings.repository:get_listing",
        "endpoint": "GET /listings/{id}",
        "kind": kind,
        "params": params,
        "target_ms": 50,
    }


GOOD = {
    "listing_by_id": "SELECT id, title FROM listings WHERE id = :id",
    "add_booking": """INSERT INTO bookings (listing_id, guest_id, check_in, check_out, adults, nightly_price,
                          cleaning_fee, total_price, currency, status, idempotency_key)
                      SELECT l.id, l.host_id, CAST(:check_in AS date), CAST(:check_in AS date) + 3, 1, 100, 0, 300,
                             'EUR', 'confirmed', gen_random_uuid() FROM listings l WHERE l.id = :id""",
}


def good_catalog(root: Path) -> Path:
    return write_catalog(
        root,
        [query("listing_by_id", id="@listing"), query("add_booking", "write", id="@listing", check_in="@check_in")],
        GOOD,
    )


@pytest.mark.parametrize(
    ("change", "rule"),
    [
        (lambda q, f: q.append(dict(q[0])), "listing_by_id: duplicate name"),
        (lambda q, f: f.pop("listing_by_id"), "listing_by_id: missing listing_by_id.sql"),
        (lambda q, f: q[0].update(source="caravansara.listings.repository:no_such_function"), "listing_by_id: source"),
        (lambda q, f: q[0].update(kind="delete"), "listing_by_id: kind"),
        (lambda q, f: q[0].update(name="Bad Name"), "Bad Name: name"),
    ],
)
def test_invalid_catalog_is_refused(tmp_path: Path, change: Any, rule: str) -> None:
    queries = [query("listing_by_id", id="@listing")]
    files = {"listing_by_id": GOOD["listing_by_id"]}
    change(queries, files)
    with pytest.raises(measure.MeasureRefused, match=f"invalid query catalog: {rule}"):
        measure.load_catalog(write_catalog(tmp_path / "c", queries, files))


async def test_refused_in_production(prepared: Settings, tmp_path: Path) -> None:
    production = prepared.model_copy(update={"environment": "production"})
    with pytest.raises(measure.MeasureRefused, match="measure-queries is for development and measurement only"):
        await measure.measure(production, database=database_name(prepared.database_url), catalog_dir=tmp_path)


async def test_refused_without_listings(prepared: Settings, engine: AsyncEngine, tmp_path: Path) -> None:
    target = database_name(prepared.database_url)
    with pytest.raises(measure.MeasureRefused, match=f"{target} has no listings; run: caravansara seed-bulk"):
        await measure.measure(prepared, database=target, catalog_dir=good_catalog(tmp_path / "c"))


async def test_measures_every_query_and_changes_nothing(
    prepared: Settings, engine: AsyncEngine, factory: Factory, tmp_path: Path
) -> None:
    await factory.listing()
    before = await sql(engine, "SELECT count(*) FROM bookings")
    target = database_name(prepared.database_url)
    # With one row, and once autovacuum has analysed the table, the planner rightly prefers a Seq Scan,
    # so whether the index shows up depended on timing (it failed once in CI). This test checks that index
    # names are read from the plan, so it turns sequential scans off for its own test database while measuring:
    # measure opens new connections, which take the database setting.
    await sql(engine, f'ALTER DATABASE "{target}" SET enable_seqscan = off')
    try:
        report = await measure.measure(prepared, database=target, catalog_dir=good_catalog(tmp_path / "c"), runs=3)
    finally:
        await sql(engine, f'ALTER DATABASE "{target}" RESET enable_seqscan')

    assert [r.name for r in report.results] == ["listing_by_id", "add_booking"]
    for r in report.results:
        assert r.error is None
        assert len(r.runs_ms) == 3
        assert r.median_ms == sorted(r.runs_ms)[1]
        assert r.shared_hit + r.shared_read > 0
        assert r.access  # node types such as "Index Scan" or "Insert"
        assert (r.target_ms, r.meets_target) == (50, r.median_ms <= 50)
        assert r.jit is False  # tiny plans stay below jit_above_cost
    assert "listings_pkey" in report.results[0].indexes
    assert report.revision
    assert report.database == database_name(prepared.database_url)
    assert await sql(engine, "SELECT count(*) FROM bookings") == before  # writes were rolled back

    data = json.loads(report.to_json())
    assert set(data) == {"database", "revision", "measured_at", "results"}
    assert set(data["results"][0]) == {
        "name", "median_ms", "runs_ms", "shared_hit", "shared_read", "access", "indexes", "target_ms",
        "meets_target", "jit", "error",
    }  # fmt: skip
    assert "| listing_by_id |" in report.markdown()


async def test_one_broken_query_does_not_stop_the_rest(
    prepared: Settings, engine: AsyncEngine, factory: Factory, tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:  # fmt: skip
    await factory.listing()
    catalog = write_catalog(
        tmp_path / "c",
        [query("broken", id="@listing"), query("listing_by_id", id="@listing")],
        {"broken": "SELECT no_such_column FROM listings WHERE id = :id", "listing_by_id": GOOD["listing_by_id"]},
    )
    monkeypatch.setattr(cli, "get_settings", lambda: prepared)
    out = tmp_path / "report.json"
    args = ["measure-queries", "--database", database_name(prepared.database_url), "--catalog", str(catalog),
            "--runs", "1", "--out", str(out)]  # fmt: skip
    with pytest.raises(SystemExit) as exit_:
        await asyncio.to_thread(cli.main, args)  # the command runs its own event loop
    assert exit_.value.code == 1
    results = {r["name"]: r for r in json.loads(out.read_text())["results"]}
    assert "no_such_column" in results["broken"]["error"]
    assert results["listing_by_id"]["error"] is None
    assert "| listing_by_id |" in capsys.readouterr().out
