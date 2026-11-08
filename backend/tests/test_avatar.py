"""Profile pictures (specs/005-frontend-guest, FR-037 to FR-041, contracts/api.md).

Every rule runs against real MinIO: the 5 MB limit is enforced by the upload policy in MinIO itself, and the
server checks the stored file's real size and first bytes again before using it.
"""

from typing import Any

import httpx
from httpx import AsyncClient

from caravansara.core.config import Settings
from caravansara.core.storage import Storage

from .helpers import User, register

LIMIT = 5 * 1024 * 1024  # owner decision, 2026-11-08
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


Signed = dict[str, Any]


async def _upload_url(client: AsyncClient, user: User, content_type: str = "image/png") -> Signed:
    r = await client.post("/me/avatar/upload-url", json={"content_type": content_type}, headers=user.auth)
    assert r.status_code == 200, r.text
    signed: Signed = r.json()
    return signed


async def _post_to_storage(signed: Signed, content: bytes, content_type: str = "image/png") -> httpx.Response:
    async with httpx.AsyncClient() as storage:  # straight to MinIO, like a browser
        return await storage.post(
            str(signed["url"]),
            data=signed["fields"],
            files={"file": ("a.png", content, content_type)},
        )


async def _upload(client: AsyncClient, user: User, content: bytes = PNG, content_type: str = "image/png") -> str:
    signed = await _upload_url(client, user, content_type)
    up = await _post_to_storage(signed, content, content_type)
    assert up.status_code == 204, up.text
    return str(signed["storage_key"])


async def _set(client: AsyncClient, user: User, key: str) -> httpx.Response:
    return await client.put("/me/avatar", json={"storage_key": key}, headers=user.auth)


async def test_upload_url_for_png_and_jpeg_only(client: AsyncClient) -> None:
    user = await register(client)
    for content_type in ("image/png", "image/jpeg"):
        signed = await _upload_url(client, user, content_type)
        assert str(signed["storage_key"]).startswith(f"avatars/{user.id}/")
        assert str(signed["storage_key"]).endswith(".png" if content_type == "image/png" else ".jpg")
        assert signed["fields"]["Content-Type"] == content_type
    for refused in ("image/webp", "image/gif", "application/pdf"):
        r = await client.post("/me/avatar/upload-url", json={"content_type": refused}, headers=user.auth)
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "validation_error"


async def test_storage_itself_refuses_a_file_over_5_mb(client: AsyncClient, settings: Settings) -> None:
    """SC-010: the policy stops a too big file in MinIO, so it is never stored; exactly 5 MB passes."""
    user = await register(client)
    signed = await _upload_url(client, user)
    too_big = await _post_to_storage(signed, PNG + b"\x00" * (LIMIT + 1 - len(PNG)))
    assert too_big.status_code == 400
    assert not await Storage(settings).exists(str(signed["storage_key"]))

    signed = await _upload_url(client, user)
    exact = await _post_to_storage(signed, PNG + b"\x00" * (LIMIT - len(PNG)))
    assert exact.status_code == 204
    r = await _set(client, user, str(signed["storage_key"]))
    assert r.status_code == 200, r.text


async def test_set_png_and_jpeg(client: AsyncClient, settings: Settings) -> None:
    user = await register(client)
    key = await _upload(client, user)
    r = await _set(client, user, key)
    assert r.status_code == 200, r.text
    assert r.json()["avatar_url"] == f"{settings.media_base_url}/{key}"
    assert (await client.get("/me", headers=user.auth)).json()["avatar_url"] == f"{settings.media_base_url}/{key}"

    jpeg = await _upload(client, user, JPEG, "image/jpeg")
    assert (await _set(client, user, jpeg)).status_code == 200


async def test_only_own_keys_and_uploaded_files(client: AsyncClient) -> None:
    """FR-040: a key of another user, another prefix or a file that was never uploaded is refused."""
    user = await register(client, "owner")
    other = await register(client, "other")
    theirs = await _upload(client, other)
    for key in (theirs, "listings/1/x.png", f"avatars/{user.id}/../{other.id}/x.png"):
        r = await _set(client, user, key)
        assert r.status_code == 422, key
        assert r.json()["error"]["code"] == "invalid_storage_key"

    missing = await _set(client, user, f"avatars/{user.id}/never-uploaded.png")
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "upload_missing"


async def test_server_checks_real_size_and_content(client: AsyncClient, settings: Settings) -> None:
    """A file put in storage around the policy, or a text file sent as PNG, is refused and deleted."""
    storage = Storage(settings)
    user = await register(client)
    good = await _upload(client, user)
    assert (await _set(client, user, good)).status_code == 200
    before = (await client.get("/me", headers=user.auth)).json()["avatar_url"]

    big = f"avatars/{user.id}/big.png"
    await storage.put_bytes(big, PNG + b"\x00" * LIMIT, "image/png")
    r = await _set(client, user, big)
    assert r.status_code == 422
    assert r.json()["error"] == {
        "code": "image_too_large",
        "message": r.json()["error"]["message"],
        "details": {"max_bytes": LIMIT},
    }
    assert not await storage.exists(big)

    fake = await _upload(client, user, b"this is just some text", "image/png")
    r = await _set(client, user, fake)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_image"
    assert not await storage.exists(fake)

    assert (await client.get("/me", headers=user.auth)).json()["avatar_url"] == before
    assert await storage.exists(good)


async def test_new_picture_and_delete_remove_the_old_file(client: AsyncClient, settings: Settings) -> None:
    """FR-039: a picture no longer in use is deleted from storage."""
    storage = Storage(settings)
    user = await register(client)
    first = await _upload(client, user)
    await _set(client, user, first)
    second = await _upload(client, user, JPEG, "image/jpeg")
    assert (await _set(client, user, second)).status_code == 200
    assert not await storage.exists(first)
    assert await storage.exists(second)

    gone = await client.delete("/me/avatar", headers=user.auth)
    assert gone.status_code == 200
    assert gone.json()["avatar_url"] is None
    assert not await storage.exists(second)

    again = await client.delete("/me/avatar", headers=user.auth)
    assert again.status_code == 200
    assert again.json()["avatar_url"] is None


async def test_profile_edit_accepts_only_own_storage_urls(client: AsyncClient, settings: Settings) -> None:
    """FR-041: PATCH /me takes no outside address; the whole request is refused, the name included."""
    storage = Storage(settings)
    user = await register(client, "patcher")
    other = await register(client, "stranger")

    outside = await client.patch(
        "/me", json={"full_name": "Changed", "avatar_url": "https://example.com/a.png"}, headers=user.auth
    )
    assert outside.status_code == 422
    assert outside.json()["error"]["code"] == "invalid_avatar_url"
    me = (await client.get("/me", headers=user.auth)).json()
    assert me["full_name"] == "Patcher"
    assert me["avatar_url"] is None

    theirs = await _upload(client, other)
    r = await client.patch("/me", json={"avatar_url": f"{settings.media_base_url}/{theirs}"}, headers=user.auth)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_avatar_url"

    mine = await _upload(client, user)
    r = await client.patch(
        "/me", json={"full_name": "Renamed", "avatar_url": f"{settings.media_base_url}/{mine}"}, headers=user.auth
    )
    assert r.status_code == 200, r.text
    assert r.json()["full_name"] == "Renamed"
    assert r.json()["avatar_url"] == f"{settings.media_base_url}/{mine}"

    cleared = await client.patch("/me", json={"avatar_url": None}, headers=user.auth)
    assert cleared.json()["avatar_url"] is None
    assert not await storage.exists(mine)


async def test_avatar_endpoints_need_an_account(client: AsyncClient) -> None:
    assert (await client.post("/me/avatar/upload-url", json={"content_type": "image/png"})).status_code == 401
    assert (await client.put("/me/avatar", json={"storage_key": "avatars/1/a.png"})).status_code == 401
    assert (await client.delete("/me/avatar")).status_code == 401
