from datetime import datetime
from typing import Literal

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
    """No refresh token: an admin logs in again after ``expires_in`` (specs/004 research R2)."""

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
            "Only the address of a picture you uploaded with `POST /me/avatar/upload-url`, or null to go back to "
            "the default avatar. An address on another server is refused (`invalid_avatar_url`): it would tell "
            "that server who views your reviews. `PUT /me/avatar` and `DELETE /me/avatar` do the same."
        ),
    )


# Profile pictures (specs/005-frontend-guest, FR-038): PNG or JPEG only. Not the listings' ImageType, which
# also takes WebP, and identity may not import listings anyway.
AvatarType = Literal["image/png", "image/jpeg"]


class AvatarUploadUrlIn(BaseModel):
    content_type: AvatarType

    model_config = ConfigDict(json_schema_extra={"example": {"content_type": "image/png"}})


class AvatarUploadUrlOut(BaseModel):
    """The same shape as a listing photo's upload URL, defined here because modules may not import each other."""

    storage_key: str = Field(description="Send this to `PUT /me/avatar` after the upload.")
    url: str = Field(description="POST the file here as multipart/form-data.")
    fields: dict[str, str] = Field(description="Form fields to send before the `file` field.")
    expires_in: int

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "storage_key": "avatars/42/9b1d0c4e5f6a7b8c9d0e1f2a3b4c5d6e.png",
                "url": "http://localhost:9000/caravansara-media",
                "fields": {
                    "key": "avatars/42/9b1d0c4e5f6a7b8c9d0e1f2a3b4c5d6e.png",
                    "Content-Type": "image/png",
                    "x-amz-algorithm": "AWS4-HMAC-SHA256",
                    "x-amz-credential": "caravansara/20261108/us-east-1/s3/aws4_request",
                    "x-amz-date": "20261108T120000Z",
                    "policy": "eyJleHBpcmF0aW9uIjogIjIwMjYtMTEtMDhUMTI6MTA6MDBaIn0=",
                    "x-amz-signature": "3f1c…",
                },
                "expires_in": 600,
            }
        }
    )


class AvatarSetIn(BaseModel):
    storage_key: str = Field(min_length=1, max_length=300, examples=["avatars/42/9b1d0c.png"])
