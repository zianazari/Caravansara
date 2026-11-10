"""Profile pictures through the API (specs/006-avatar-upload-via-api; 005 FR-037 to FR-041).

The file is the body of PUT /me/avatar. Every rule runs against real MinIO, and every refusal is checked
against the storage itself: the list of the user's files is the same before and after (SC-001), because a
file that breaks the rules is never written there (FR-002).
"""

import asyncio
import time
from collections.abc import Iterable
from typing import Any

import boto3
import httpx
import pytest
from botocore.exceptions import EndpointConnectionError
from httpx import AsyncClient

from caravansara.core.config import Settings
from caravansara.core.storage import Storage

from .helpers import User, register

LIMIT = 5 * 1024 * 1024  # owner decision, 2026-11-08
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def _s3(settings: Settings) -> Any:
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name="us-east-1",
    )


def _keys(settings: Settings, user_id: int) -> set[str]:
    """Every file under the user's prefix in MinIO, read from storage itself."""
    listed = _s3(settings).list_objects_v2(Bucket=settings.s3_bucket, Prefix=f"avatars/{user_id}/")
    return {o["Key"] for o in listed.get("Contents", [])}


async def _user(client: AsyncClient, settings: Settings, name: str = "user") -> User:
    """A new user with an empty picture folder. User ids start again at 1 in every test (the tables are
    truncated) while MinIO keeps its files, so a folder may still hold an earlier test's pictures."""
    user = await register(client, name)
    s3 = _s3(settings)
    for key in _keys(settings, user.id):
        s3.delete_object(Bucket=settings.s3_bucket, Key=key)
    return user


async def _put(
    client: AsyncClient, user: User, content: bytes, content_type: str | None = "image/png"
) -> httpx.Response:
    headers = dict(user.auth)
    if content_type is not None:
        headers["Content-Type"] = content_type
    return await client.put("/me/avatar", content=content, headers=headers)


async def _raw_put(
    app: Any, user: User, chunks: Iterable[bytes], headers: dict[str, str], *, disconnect: bool = False
) -> tuple[int | None, int]:
    """PUT /me/avatar straight through ASGI, to send a body the way a slow or vanishing client does. Returns the
    status (None when no answer was sent) and how many body bytes the server asked for."""
    sent = 0
    pieces = list(chunks)
    answer: dict[str, Any] = {}

    async def receive() -> dict[str, Any]:
        nonlocal sent
        if pieces:
            piece = pieces.pop(0)
            sent += len(piece)
            return {"type": "http.request", "body": piece, "more_body": bool(pieces) or disconnect}
        if disconnect:
            return {"type": "http.disconnect"}
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, Any]) -> None:
        if message["type"] == "http.response.start":
            answer["status"] = message["status"]

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "PUT",
        "scheme": "http",
        "path": "/api/v1/me/avatar",
        "raw_path": b"/api/v1/me/avatar",
        "query_string": b"",
        "root_path": "",
        "headers": [(k.lower().encode(), v.encode()) for k, v in {**user.auth, **headers}.items()],
        "client": ("127.0.0.1", 1234),
        "server": ("test", 80),
    }
    await app(scope, receive, send)
    return answer.get("status"), sent


async def _me(client: AsyncClient, user: User) -> dict[str, Any]:
    me: dict[str, Any] = (await client.get("/me", headers=user.auth)).json()
    return me


async def test_png_and_jpeg_are_stored_and_set(client: AsyncClient, settings: Settings) -> None:
    user = await _user(client, settings)
    r = await _put(client, user, PNG)
    assert r.status_code == 200, r.text
    url = r.json()["avatar_url"]
    assert url.startswith(f"{settings.media_base_url}/avatars/{user.id}/")
    assert url.endswith(".png")
    assert (await _me(client, user))["avatar_url"] == url
    assert _keys(settings, user.id) == {url.removeprefix(f"{settings.media_base_url}/")}

    jpeg = await _put(client, user, JPEG, "image/jpeg")
    assert jpeg.status_code == 200, jpeg.text
    assert jpeg.json()["avatar_url"].endswith(".jpg")


async def test_exactly_5_mb_passes_and_one_byte_more_is_refused(client: AsyncClient, settings: Settings) -> None:
    user = await _user(client, settings)
    exact = await _put(client, user, PNG + b"\x00" * (LIMIT - len(PNG)))
    assert exact.status_code == 200, exact.text
    before = _keys(settings, user.id)

    over = await _put(client, user, PNG + b"\x00" * (LIMIT + 1 - len(PNG)))
    assert over.status_code == 413
    assert over.json()["error"]["code"] == "image_too_large"
    assert over.json()["error"]["details"] == {"max_bytes": LIMIT}
    assert _keys(settings, user.id) == before
    assert (await _me(client, user))["avatar_url"] == exact.json()["avatar_url"]


async def test_a_declared_size_over_the_limit_is_refused_before_reading(
    app: Any, client: AsyncClient, settings: Settings
) -> None:
    """FR-003: Content-Length alone is enough; not one byte of the body is read."""
    user = await _user(client, settings)
    status, read = await _raw_put(
        app, user, [b"x" * 65536], {"content-type": "image/png", "content-length": str(50 * 1024 * 1024)}
    )
    assert status == 413
    assert read == 0


async def test_a_streamed_body_stops_soon_after_the_limit(app: Any, client: AsyncClient, settings: Settings) -> None:
    """SC-003: 50 MB without Content-Length is refused in under 2 s, having read under 6 MB."""
    user = await _user(client, settings)
    chunks = (PNG + b"\x00" * (65536 - len(PNG)), *([b"\x00" * 65536] * 799))
    start = time.monotonic()
    status, read = await _raw_put(app, user, chunks, {"content-type": "image/png"})
    assert status == 413
    assert read < 6_000_000
    assert time.monotonic() - start < 2
    assert _keys(settings, user.id) == set()


async def test_a_body_cut_off_midway_stores_nothing(app: Any, client: AsyncClient, settings: Settings) -> None:
    """Edge case: the client goes away before the end; no file, and the old picture stays."""
    user = await _user(client, settings)
    first = await _put(client, user, PNG)
    before = _keys(settings, user.id)
    status, _ = await _raw_put(app, user, [PNG[:40]], {"content-type": "image/png"}, disconnect=True)
    assert status in (None, 400, 499)
    assert _keys(settings, user.id) == before
    assert (await _me(client, user))["avatar_url"] == first.json()["avatar_url"]


@pytest.mark.parametrize("content_type", ["image/gif", "image/webp", "application/pdf", None])
async def test_other_types_are_refused(client: AsyncClient, settings: Settings, content_type: str | None) -> None:
    user = await _user(client, settings)
    r = await _put(client, user, PNG, content_type)
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_image_type"
    assert r.json()["error"]["details"] == {"allowed": ["image/png", "image/jpeg"]}
    assert _keys(settings, user.id) == set()


@pytest.mark.parametrize("content", [b"", b"this is just some text, not a picture"])
async def test_empty_or_fake_pictures_are_refused(client: AsyncClient, settings: Settings, content: bytes) -> None:
    user = await _user(client, settings)
    good = await _put(client, user, PNG)
    before = _keys(settings, user.id)
    r = await _put(client, user, content, "image/png")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_image"
    assert _keys(settings, user.id) == before
    assert (await _me(client, user))["avatar_url"] == good.json()["avatar_url"]


async def test_the_format_comes_from_the_content(client: AsyncClient, settings: Settings) -> None:
    """A PNG sent as JPEG is stored and served as PNG (research R5)."""
    user = await _user(client, settings)
    r = await _put(client, user, PNG, "image/jpeg")
    assert r.status_code == 200, r.text
    url = r.json()["avatar_url"]
    assert url.endswith(".png")
    async with httpx.AsyncClient() as public:
        served = await public.get(url)
    assert served.headers["content-type"] == "image/png"


async def test_new_picture_and_delete_remove_the_old_file(client: AsyncClient, settings: Settings) -> None:
    """FR-006: a picture no longer in use is deleted from storage."""
    user = await _user(client, settings)
    first = (await _put(client, user, PNG)).json()["avatar_url"]
    second = (await _put(client, user, JPEG, "image/jpeg")).json()["avatar_url"]
    assert first != second
    assert _keys(settings, user.id) == {second.removeprefix(f"{settings.media_base_url}/")}

    gone = await client.delete("/me/avatar", headers=user.auth)
    assert gone.status_code == 200
    assert gone.json()["avatar_url"] is None
    assert _keys(settings, user.id) == set()
    again = await client.delete("/me/avatar", headers=user.auth)
    assert again.status_code == 200


async def test_uploads_at_once_leave_one_file(client: AsyncClient, settings: Settings) -> None:
    """SC-002, research R6: under the row lock each later change deletes the earlier one's file."""
    user = await _user(client, settings)
    results = await asyncio.gather(*(_put(client, user, PNG) for _ in range(4)))
    assert all(r.status_code == 200 for r in results), [r.text for r in results]
    url = (await _me(client, user))["avatar_url"]
    assert _keys(settings, user.id) == {url.removeprefix(f"{settings.media_base_url}/")}


async def test_a_failed_save_deletes_the_new_file(
    client: AsyncClient, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    """FR-007: when setting the picture fails after the file is written, the file goes too."""
    from caravansara.identity import repository

    user = await _user(client, settings)
    first = (await _put(client, user, PNG)).json()["avatar_url"]
    before = _keys(settings, user.id)

    async def broken(*_: object, **__: object) -> None:
        raise RuntimeError("database gone")

    monkeypatch.setattr(repository, "get_user_for_update", broken)
    with pytest.raises(RuntimeError):
        await _put(client, user, JPEG, "image/jpeg")
    monkeypatch.undo()
    assert _keys(settings, user.id) == before
    assert (await _me(client, user))["avatar_url"] == first


async def test_storage_down_answers_503_and_keeps_the_picture(
    client: AsyncClient, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await _user(client, settings)
    first = (await _put(client, user, PNG)).json()["avatar_url"]

    async def down(*_: object, **__: object) -> None:
        raise EndpointConnectionError(endpoint_url=str(settings.s3_endpoint_url))

    monkeypatch.setattr(Storage, "put_bytes", down)
    r = await _put(client, user, JPEG, "image/jpeg")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "service_unavailable"
    monkeypatch.undo()
    assert (await _me(client, user))["avatar_url"] == first


async def test_the_old_upload_route_is_gone(client: AsyncClient, settings: Settings) -> None:
    """FR-005: no way is left to put a profile file in storage without the API's checks."""
    user = await _user(client, settings)
    r = await client.post("/me/avatar/upload-url", json={"content_type": "image/png"}, headers=user.auth)
    assert r.status_code in (404, 405)


async def test_profile_edit_accepts_only_own_storage_urls(client: AsyncClient, settings: Settings) -> None:
    """FR-009 (005 FR-041): PATCH /me takes no outside address; the whole request is refused, the name too."""
    user = await _user(client, settings, "patcher")
    other = await _user(client, settings, "stranger")

    outside = await client.patch(
        "/me", json={"full_name": "Changed", "avatar_url": "https://example.com/a.png"}, headers=user.auth
    )
    assert outside.status_code == 422
    assert outside.json()["error"]["code"] == "invalid_avatar_url"
    me = await _me(client, user)
    assert me["full_name"] == "Patcher"
    assert me["avatar_url"] is None

    theirs = (await _put(client, other, PNG)).json()["avatar_url"]
    r = await client.patch("/me", json={"avatar_url": theirs}, headers=user.auth)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_avatar_url"

    removed = (await _put(client, user, PNG)).json()["avatar_url"]
    await client.delete("/me/avatar", headers=user.auth)  # its file is gone; PATCH must notice
    gone = await client.patch("/me", json={"avatar_url": removed}, headers=user.auth)
    assert gone.status_code == 422
    assert gone.json()["error"]["code"] == "upload_missing"

    mine = (await _put(client, user, PNG)).json()["avatar_url"]
    r = await client.patch("/me", json={"full_name": "Renamed", "avatar_url": mine}, headers=user.auth)
    assert r.status_code == 200, r.text
    assert r.json()["full_name"] == "Renamed"

    cleared = await client.patch("/me", json={"avatar_url": None}, headers=user.auth)
    assert cleared.json()["avatar_url"] is None
    assert _keys(settings, user.id) == set()


async def test_avatar_endpoints_need_an_account(client: AsyncClient) -> None:
    assert (await client.put("/me/avatar", content=PNG, headers={"Content-Type": "image/png"})).status_code == 401
    assert (await client.delete("/me/avatar")).status_code == 401
