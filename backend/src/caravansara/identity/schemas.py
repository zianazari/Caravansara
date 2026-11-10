from datetime import datetime

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, EmailStr, Field


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
    """No refresh token: an admin logs in again after ``expires_in`` (specs/backend (004) research R2)."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Admin token lifetime in seconds.")

    model_config = ConfigDict(
        json_schema_extra={"example": {"access_token": "eyJhbGciOi...", "token_type": "bearer", "expires_in": 900}}
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
