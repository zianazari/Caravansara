from fastapi import APIRouter, status

from caravansara.core.db import SessionDep
from caravansara.core.deps import ClientIp, StorageDep
from caravansara.core.errors import error_responses
from caravansara.core.security import CurrentUserId, SettingsDep
from caravansara.identity import service
from caravansara.identity.schemas import (
    AvatarSetIn,
    AvatarUploadUrlIn,
    AvatarUploadUrlOut,
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
        "Change your name, or your picture. A picture must be one you uploaded here for this account "
        "(`POST /me/avatar/upload-url`); any other address is refused with `invalid_avatar_url`, and nothing "
        "in the request is saved. `null` removes the picture."
    ),
    responses=error_responses(401, 422),
)
async def update_me(
    body: ProfileUpdate, user_id: CurrentUserId, session: SessionDep, storage: StorageDep, settings: SettingsDep
) -> UserOut:
    return UserOut.model_validate(await service.update_me(session, storage, settings, user_id, body))


@router.post(
    "/me/avatar/upload-url",
    tags=["Profile picture"],
    summary="1. Get an upload URL for a profile picture",
    description=(
        "Returns a presigned POST for a PNG or JPEG of at most 5 MB. Upload the file straight to storage as "
        "multipart/form-data with the returned `fields` and then a `file` field; storage refuses a bigger "
        "file. Then call `PUT /me/avatar` with `storage_key`."
    ),
    responses=error_responses(401, 422),
)
async def avatar_upload_url(
    body: AvatarUploadUrlIn, user_id: CurrentUserId, storage: StorageDep, settings: SettingsDep
) -> AvatarUploadUrlOut:
    return service.avatar_upload_url(storage, settings, user_id, body.content_type)


@router.put(
    "/me/avatar",
    tags=["Profile picture"],
    summary="2. Use an uploaded picture",
    description=(
        "Checks the uploaded file itself: it must be yours (`invalid_storage_key`), exist (`upload_missing`), "
        "be at most 5 MB (`image_too_large`) and really be a PNG or JPEG (`invalid_image`). A refused file is "
        "deleted. The previous picture's file is deleted after the change."
    ),
    responses=error_responses(401, 422),
)
async def set_avatar(
    body: AvatarSetIn, user_id: CurrentUserId, session: SessionDep, storage: StorageDep, settings: SettingsDep
) -> UserOut:
    return UserOut.model_validate(await service.set_avatar(session, storage, settings, user_id, body.storage_key))


@router.delete(
    "/me/avatar",
    tags=["Profile picture"],
    summary="Remove my picture",
    description="Goes back to the default avatar and deletes the file. Without a picture, nothing changes.",
    responses=error_responses(401),
)
async def remove_avatar(user_id: CurrentUserId, session: SessionDep, storage: StorageDep) -> UserOut:
    return UserOut.model_validate(await service.remove_avatar(session, storage, user_id))
