"""Object storage through the S3 API (MinIO in development and tests, S3 or R2 in production).

Two clients: the internal one talks to the storage from the server; the public one only
signs upload URLs, because the host the browser uses is part of the signature.
"""

import asyncio
import json
from typing import TYPE_CHECKING, Any

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from caravansara.core.config import Settings

if TYPE_CHECKING:  # the stubs are a dev dependency
    from mypy_boto3_s3 import S3Client


class Storage:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = self._make_client(settings.s3_endpoint_url)
        self._signer = self._make_client(settings.s3_public_endpoint_url or settings.s3_endpoint_url)

    def _make_client(self, endpoint: str | None) -> "S3Client":
        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=self._settings.s3_region,
            aws_access_key_id=self._settings.s3_access_key,
            aws_secret_access_key=self._settings.s3_secret_key,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    @property
    def bucket(self) -> str:
        return self._settings.s3_bucket

    def public_url(self, key: str) -> str:
        return f"{self._settings.media_base_url.rstrip('/')}/{key}"

    def presigned_upload(self, key: str, content_type: str, max_bytes: int) -> dict[str, Any]:
        """A presigned POST: the policy caps the size and pins the content type. Storage itself refuses a
        bigger file, so it is never stored (listing photos and profile pictures have their own limits)."""
        return self._signer.generate_presigned_post(
            Bucket=self.bucket,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, max_bytes],
            ],
            ExpiresIn=self._settings.upload_url_seconds,
        )

    async def exists(self, key: str) -> bool:
        def _head() -> bool:
            try:
                self._client.head_object(Bucket=self.bucket, Key=key)
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                    return False
                raise
            return True

        return await asyncio.to_thread(_head)

    async def size(self, key: str) -> int | None:
        """The stored file's real size, or None when there is no such file. The upload policy already caps
        the size, but a file can reach storage another way, so a picture is measured before it is used."""

        def _head() -> int | None:
            try:
                return int(self._client.head_object(Bucket=self.bucket, Key=key)["ContentLength"])
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
                    return None
                raise

        return await asyncio.to_thread(_head)

    async def read_head(self, key: str, n: int = 8) -> bytes:
        """The first bytes of a file, to see what it really is: the declared content type proves nothing."""

        def _get() -> bytes:
            body = self._client.get_object(Bucket=self.bucket, Key=key, Range=f"bytes=0-{n - 1}")["Body"]
            return bytes(body.read())

        return await asyncio.to_thread(_get)

    def key_from_url(self, url: str) -> str | None:
        """The storage key of one of our public file addresses, or None for any other address."""
        prefix = f"{self._settings.media_base_url.rstrip('/')}/"
        return url[len(prefix) :] if url.startswith(prefix) and len(url) > len(prefix) else None

    async def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        """Store a small object from the server (demo photos); browsers upload through presigned POST."""
        await asyncio.to_thread(
            self._client.put_object, Bucket=self.bucket, Key=key, Body=data, ContentType=content_type
        )

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._client.delete_object, Bucket=self.bucket, Key=key)

    async def ensure_bucket(self, *, public_read: bool = False) -> None:
        """Create the bucket if missing. ``public_read`` lets browsers load photos (development only;
        production serves them through a CDN)."""

        def _ensure() -> None:
            try:
                self._client.head_bucket(Bucket=self.bucket)
            except ClientError:
                self._client.create_bucket(Bucket=self.bucket)
            if public_read:
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{self.bucket}/*"],
                        }
                    ],
                }
                self._client.put_bucket_policy(Bucket=self.bucket, Policy=json.dumps(policy))

        await asyncio.to_thread(_ensure)
