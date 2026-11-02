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
    avatar_url: AnyHttpUrl | None = None
