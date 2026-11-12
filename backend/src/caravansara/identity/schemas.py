from datetime import datetime

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, EmailStr, Field

from caravansara.identity.models import AccountKind


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"email": "guest@example.com", "password": "caravansara-demo", "full_name": "Omar Haddad"}
        }
    )


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(
        json_schema_extra={"example": {"email": "guest@example.com", "password": "caravansara-demo"}}
    )


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=200)


class TokensOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds.")


class AdminTokenOut(BaseModel):
    """A short admin token and a rotating refresh token (feature 011). The session ends
    ``session_expires_in`` seconds after log-in, however often it is refreshed."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Admin token lifetime in seconds.")
    session_expires_in: int = Field(description="Seconds until the admin session ends and a new log-in is needed.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJhbGciOi...",
                "refresh_token": "kq3...",
                "token_type": "bearer",
                "expires_in": 900,
                "session_expires_in": 28800,
            }
        }
    )


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    avatar_url: str | None
    created_at: datetime


class RegisterOut(BaseModel):
    user: UserOut
    tokens: TokensOut


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_url: AnyHttpUrl | None = Field(
        default=None,
        description=(
            "Only the address of a picture you set with `PUT /me/avatar`, or null to go back to "
            "the default avatar. An address on another server is refused (`invalid_avatar_url`): it would tell "
            "that server who views your reviews. `PUT /me/avatar` and `DELETE /me/avatar` do the same."
        ),
    )


class AdminUserOut(BaseModel):
    """One account in the admin's users list (feature 051). Never the password hash."""

    id: int
    email: str
    full_name: str
    kind: AccountKind = Field(description="`member` (guest or host) or `admin`.")
    created_at: datetime
    disabled_at: datetime | None = Field(description="Set when an admin account was disabled.")


class AdminUserPage(BaseModel):
    items: list[AdminUserOut]
    total: int
