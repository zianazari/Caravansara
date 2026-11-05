"""Put the demo photos into object storage under every demo listing photo key.

db/seed_demo.sql names each photo ``demo/listings/<id>/<order>-<slug>.jpg``; the file for a slug
is db/demo/photos/<slug>.jpg (synthetic images kept in git). Uploading is idempotent: the same
bytes go under the same key, so a retry after a failure is safe.
"""

import asyncio
import re
from collections.abc import Iterable
from pathlib import Path

from caravansara.core.config import Settings
from caravansara.core.storage import Storage

_KEY = re.compile(r"^demo/listings/\d+/\d+-(?P<slug>[a-z-]+)\.jpg$")
_PARALLEL = 8  # below botocore's default pool of 10 connections per client
_ATTEMPTS = 3  # MinIO drops about 1 in 1,500 parallel PUTs ("ClientDisconnected"); a retry succeeds


def slug_of(key: str) -> str:
    match = _KEY.match(key)
    if not match:
        raise ValueError(f"not a demo photo key: {key}")
    return match["slug"]


async def upload_demo_photos(settings: Settings, keys: Iterable[str]) -> int:
    """Upload one file per key; the first failure stops the upload and is raised."""
    folder: Path = settings.seed_dir / "demo" / "photos"
    files = {p.stem: p.read_bytes() for p in sorted(folder.glob("*.jpg"))}  # noqa: ASYNC240 (8 small files)
    storage = Storage(settings)
    keys = list(keys)
    if not keys:
        return 0

    async def put(key: str) -> None:
        for attempt in range(1, _ATTEMPTS + 1):
            try:
                await storage.put_bytes(key, files[slug_of(key)], "image/jpeg")
                return
            except Exception:
                if attempt == _ATTEMPTS:
                    raise
                await asyncio.sleep(0.2 * attempt)

    first, rest = keys[0], keys[1:]
    await put(first)  # fail fast when storage is down, before starting thousands of uploads
    gate = asyncio.Semaphore(_PARALLEL)

    async def limited(key: str) -> None:
        async with gate:
            await put(key)

    await asyncio.gather(*(limited(key) for key in rest))
    return len(keys)
