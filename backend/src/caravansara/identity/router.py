from fastapi import APIRouter, Request, status
from starlette.requests import ClientDisconnect

from caravansara.core.db import SessionDep
from caravansara.core.deps import ClientIp, StorageDep
from caravansara.core.errors import AppError, error_responses
from caravansara.core.security import CurrentUserId, SettingsDep
from caravansara.identity import service
from caravansara.identity.schemas import (
    LoginIn,
    ProfileUpdate,
    RefreshIn,
    RegisterIn,
    RegisterOut,
    TokensOut,
    UserOut,
)

router = APIRouter(tags=["Auth and profile"])


@router.post(
    "/auth/register",
    status_code=status.HTTP_201_CREATED,
    summary="Register",
    description="Create an account and log in. Any user can be a guest and a host.",
    responses=error_responses(409, 422, 429),
)
async def register(body: RegisterIn, session: SessionDep, settings: SettingsDep, ip: ClientIp) -> RegisterOut:
    user, tokens = await service.register(
        session, settings, email=body.email, password=body.password, full_name=body.full_name, ip=ip
    )
    return RegisterOut(user=UserOut.model_validate(user), tokens=tokens)


@router.post(
    "/auth/login",
    summary="Log in",
    description=(
        "Returns a short-lived access token and a refresh token. Send the access token as "
        "`Authorization: Bearer <token>` (in Swagger: the **Authorize** button)."
    ),
    responses=error_responses(401, 422, 429),
)
async def login(body: LoginIn, session: SessionDep, settings: SettingsDep, ip: ClientIp) -> TokensOut:
    return await service.login(session, settings, email=body.email, password=body.password, ip=ip)


@router.post(
    "/auth/refresh",
    summary="Rotate tokens",
    description="Exchange a refresh token for a new pair. The old refresh token stops working.",
    responses=error_responses(401, 422),
)
async def refresh(body: RefreshIn, session: SessionDep, settings: SettingsDep) -> TokensOut:
    return await service.refresh(session, settings, body.refresh_token)


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out",
    description="Revoke a refresh token. Unknown or already revoked tokens are accepted silently.",
    responses=error_responses(422),
)
async def logout(body: RefreshIn, session: SessionDep) -> None:
    await service.logout(session, body.refresh_token)


@router.get("/me", summary="My profile", responses=error_responses(401))
async def get_me(user_id: CurrentUserId, session: SessionDep) -> UserOut:
    return UserOut.model_validate(await service.get_me(session, user_id))


@router.patch(
    "/me",
    summary="Update my profile",
    description=(
        "Change your name, or your picture. A picture must be one set for this account with "
        "`PUT /me/avatar`; any other address is refused with `invalid_avatar_url`, and nothing in the request "
        "is saved. `null` removes the picture."
    ),
    responses=error_responses(401, 422),
)
async def update_me(
    body: ProfileUpdate, user_id: CurrentUserId, session: SessionDep, storage: StorageDep, settings: SettingsDep
) -> UserOut:
    return UserOut.model_validate(await service.update_me(session, storage, settings, user_id, body))


# The picture's own body, for Swagger and the generated site client: PUT /me/avatar reads the raw body itself
# (research R1), so FastAPI does not see a body parameter to describe.
_PICTURE_BODY = {
    "requestBody": {
        "required": True,
        "description": "The picture's bytes: a PNG or JPEG of at most 5 MB (5,242,880 bytes).",
        "content": {t: {"schema": {"type": "string", "format": "binary"}} for t in service.AVATAR_TYPES},
    }
}


def _example(code: str, message: str, details: object = None) -> dict[str, object]:
    error: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"content": {"application/json": {"example": {"error": error}}}}


# Each refusal of PUT /me/avatar with its own example in Swagger (constitution III).
_PICTURE_ERRORS = error_responses(400, 401, 413, 415, 422, 503)
_PICTURE_ERRORS[413].update(
    _example("image_too_large", "The picture is larger than allowed.", {"max_bytes": 5 * 1024 * 1024})
)
_PICTURE_ERRORS[415].update(
    _example(
        "unsupported_image_type", "Only PNG or JPEG pictures are accepted.", {"allowed": list(service.AVATAR_TYPES)}
    )
)
_PICTURE_ERRORS[422].update(_example("invalid_image", "The file is not a PNG or JPEG picture."))
_PICTURE_ERRORS[503].update(_example("service_unavailable", "File storage is not reachable right now."))


@router.put(
    "/me/avatar",
    tags=["Profile picture"],
    summary="Set my picture",
    description=(
        "Send the picture itself as the request body, with `Content-Type: image/png` or `image/jpeg`. It is "
        "checked before anything is stored: at most 5 MB (`413 image_too_large`, read no further than the "
        "limit), a PNG or JPEG type (`415 unsupported_image_type`), and content that really is a PNG or JPEG "
        "(`422 invalid_image`). A refused picture is never written to storage. The format stored is the one "
        "the content shows. The previous picture's file is deleted after the change. `503 service_unavailable` "
        "means storage could not be reached and nothing changed."
    ),
    openapi_extra=_PICTURE_BODY,
    responses=_PICTURE_ERRORS,
)
async def set_avatar(
    request: Request, user_id: CurrentUserId, session: SessionDep, storage: StorageDep, settings: SettingsDep
) -> UserOut:
    limit = settings.max_avatar_bytes
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > limit:
        raise service.ImageTooLarge(limit)  # refused before a single byte is read (FR-003)
    try:
        body = await service.read_limited(request.stream(), limit)
    except ClientDisconnect as exc:  # the client went away midway; nothing was stored
        raise AppError(400, "bad_request", "The upload was cut off.") from exc
    user = await service.set_avatar(session, storage, user_id, request.headers.get("content-type"), body)
    return UserOut.model_validate(user)


@router.delete(
    "/me/avatar",
    tags=["Profile picture"],
    summary="Remove my picture",
    description="Goes back to the default avatar and deletes the file. Without a picture, nothing changes.",
    responses=error_responses(401),
)
async def remove_avatar(user_id: CurrentUserId, session: SessionDep, storage: StorageDep) -> UserOut:
    return UserOut.model_validate(await service.remove_avatar(session, storage, user_id))
