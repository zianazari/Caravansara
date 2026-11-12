"""Real Commons photos for the demo's popular listings (feature 043)."""

import json

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings
from caravansara.core.storage import Storage
from caravansara.devdata import commons
from tests.helpers import sql

FOLDER = Settings().seed_dir / "demo" / "commons"


def test_the_manifest_names_every_file_its_author_and_a_free_licence() -> None:
    entries = json.loads((FOLDER / "manifest.json").read_text(encoding="utf-8"))
    assert len(entries) == 24
    free = ("CC0", "Public domain", "CC BY ", "CC BY-SA ")
    for e in entries:
        assert (FOLDER / e["file"]).is_file(), e["file"]
        assert e["author"].strip(), e["file"]
        assert e["license"].startswith(free), (e["file"], e["license"])
        assert e["source"].startswith("https://commons.wikimedia.org/wiki/File:"), e["file"]
        assert e["width"] <= 1280


def test_a_photo_is_chosen_for_its_room_the_same_way_every_time() -> None:
    pool = commons.load_manifest(FOLDER)
    first = commons.choose(pool, 42, 0, "Bedroom 2")
    assert first is not None
    assert first.room_tag == "Bedroom"  # numbered bedrooms are bedrooms
    assert commons.choose(pool, 42, 0, "Bedroom 2") == first
    assert commons.choose(pool, 42, 1, "Swimming pool") is None  # no Commons photo for that room
    assert commons.choose(pool, 42, 1, None) is None
    assert first.caption().endswith("(Wikimedia Commons)")
    assert "Bedroom" not in first.caption()  # the gallery shows the room tag beside it


async def test_refused_in_production(prepared: Settings) -> None:
    production = prepared.model_copy(update={"environment": "production"})
    with pytest.raises(commons.CommonsRefused, match="development and demos only"):
        await commons.apply_commons_photos(production, "postgresql://unused")


async def test_the_top_listings_of_each_city_get_commons_photos_and_credits(
    prepared: Settings, db: AsyncEngine, client: AsyncClient
) -> None:
    from caravansara.cli import _dsn, seed_demo

    await seed_demo(prepared, photos=False)  # only the rows; the command uploads its own files
    before = await sql(db, "SELECT count(*) FROM listing_photos")
    result = await commons.apply_commons_photos(prepared, _dsn(prepared))
    assert result.photos > 0
    assert await sql(db, "SELECT count(*) FROM listing_photos") == before  # nothing added or deleted

    rows = await sql(
        db,
        "SELECT p.storage_key, p.caption, p.width FROM listing_photos p WHERE p.caption LIKE '%(Wikimedia Commons)'",
    )
    assert len(rows) == result.photos
    storage = Storage(prepared)
    key, caption, width = rows[0]
    assert await storage.size(key) == (FOLDER / _file_for(caption)).stat().st_size
    assert width <= 1280

    again = await commons.apply_commons_photos(prepared, _dsn(prepared))
    assert again.photos == result.photos  # a rerun gives the same result


def _file_for(caption: str) -> str:
    """The manifest file whose author and licence the caption names."""
    for e in json.loads((FOLDER / "manifest.json").read_text(encoding="utf-8")):
        if caption.endswith(f"{e['author']}, {e['license']} (Wikimedia Commons)"):
            return str(e["file"])
    raise AssertionError(caption)
