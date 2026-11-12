"""Real, freely licensed photos for the demo's popular listings (feature 043, owner's request).

The demo's photos are drawn placeholders (db/demo/photos), because the hosts' own photos belong to them.
The owner asked for real photos on the popular listings. Twenty-four were chosen by hand from Wikimedia
Commons "quality images" under free licences (CC0, public domain, CC BY, CC BY-SA); they live in
db/demo/commons with a manifest naming each photo's room, author, licence and source page.

For the top 12 public listings of every city (the order of the home page's rows: rating, then reviews,
then id), each photo whose room has a Commons photo gets one: the file is uploaded under the photo's own
key, and its caption names the author and the licence, as those licences require; the gallery shows it
beside the room tag. A listing's
photos keep their keys, rooms and order; nothing is deleted. Which photo goes where is chosen at random,
but the same way each time (seeded by listing and position), so a rerun gives the same result. Rerun
this after `seed-demo --photos-only`, which puts the drawn images back.

Like the rest of devdata, this imports only caravansara.core, and refuses to run in production.
"""

import asyncio
import json
import random
from dataclasses import dataclass
from pathlib import Path

import asyncpg

from caravansara.core.config import Settings
from caravansara.core.storage import Storage

TOP_PER_CITY = 12
_PARALLEL = 8

_POPULAR_PHOTOS = """
WITH ranked AS (
    SELECT l.id,
           row_number() OVER (
               PARTITION BY l.city_id
               ORDER BY l.avg_rating DESC NULLS LAST, l.review_count DESC, l.id
           ) AS rank
    FROM listings l
    WHERE l.is_active AND l.review_status = 'approved'
)
SELECT p.id, p.listing_id, p.sort_order, p.room_tag, p.storage_key
FROM listing_photos p
JOIN ranked r ON r.id = p.listing_id
WHERE r.rank <= $1
ORDER BY p.listing_id, p.sort_order
"""


class CommonsRefused(Exception):
    """The command cannot run here."""


@dataclass(frozen=True)
class Photo:
    file: str
    room_tag: str
    width: int
    height: int
    author: str
    license: str

    def caption(self) -> str:
        """The credit the licence asks for. The room is not repeated: the gallery shows the room tag beside it."""
        return f"{self.author}, {self.license} (Wikimedia Commons)"


def room_of(tag: str | None) -> str | None:
    """The room a demo photo shows: numbered bedrooms ("Bedroom 2") are bedrooms."""
    if not tag:
        return None
    return "Bedroom" if tag.startswith("Bedroom") else tag


def load_manifest(folder: Path) -> dict[str, list[Photo]]:
    entries = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    pool: dict[str, list[Photo]] = {}
    for e in entries:
        photo = Photo(e["file"], e["room_tag"], e["width"], e["height"], e["author"], e["license"])
        pool.setdefault(photo.room_tag, []).append(photo)
    return pool


def choose(pool: dict[str, list[Photo]], listing_id: int, sort_order: int, tag: str | None) -> Photo | None:
    """The Commons photo for one listing photo, or None when its room has none. Same input, same answer."""
    room = room_of(tag)
    options = pool.get(room or "")
    if not options:
        return None
    return random.Random(f"{listing_id}-{sort_order}").choice(options)


@dataclass
class CommonsResult:
    listings: int
    photos: int
    skipped: int

    def summary(self) -> str:
        return (
            f"{self.photos} photos of {self.listings} popular listings now show Commons photos; "
            f"{self.skipped} kept their drawn image (no Commons photo for that room)."
        )


async def apply_commons_photos(settings: Settings, dsn: str) -> CommonsResult:
    if settings.environment == "production":
        raise CommonsRefused("demo-commons-photos is for development and demos only")
    folder = settings.seed_dir / "demo" / "commons"
    pool = load_manifest(folder)
    files = {p.file: (folder / p.file).read_bytes() for photos in pool.values() for p in photos}
    storage = Storage(settings)

    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch(_POPULAR_PHOTOS, TOP_PER_CITY)
        plan = [(row, choose(pool, row["listing_id"], row["sort_order"], row["room_tag"])) for row in rows]
        chosen = [(row, photo) for row, photo in plan if photo is not None]

        gate = asyncio.Semaphore(_PARALLEL)

        async def upload(key: str, photo: Photo) -> None:
            async with gate:
                await storage.put_bytes(key, files[photo.file], "image/jpeg")

        # Files first: if storage fails, no caption claims a photo that is not there.
        await asyncio.gather(*(upload(row["storage_key"], photo) for row, photo in chosen))
        async with conn.transaction():
            await conn.executemany(
                "UPDATE listing_photos SET caption = $2, width = $3, height = $4 WHERE id = $1",
                [(row["id"], photo.caption(), photo.width, photo.height) for row, photo in chosen],
            )
    finally:
        await conn.close()
    return CommonsResult(
        listings=len({row["listing_id"] for row in rows}), photos=len(chosen), skipped=len(rows) - len(chosen)
    )
