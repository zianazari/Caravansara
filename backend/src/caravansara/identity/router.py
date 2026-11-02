from fastapi import APIRouter, status

from caravansara.core.db import SessionDep
from caravansara.core.deps import ClientIp
from caravansara.core.errors import error_responses
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


@router.patch("/me", summary="Update my profile", responses=error_responses(401, 422))
async def update_me(body: ProfileUpdate, user_id: CurrentUserId, session: SessionDep) -> UserOut:
    return UserOut.model_validate(await service.update_me(session, user_id, body))
