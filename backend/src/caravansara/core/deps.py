"""Shared request dependencies that read app-wide objects from ``app.state``."""

from typing import Annotated

from fastapi import Depends, Request

from caravansara.core.email import EmailSender, sender_from_settings
from caravansara.core.security import SettingsDep
from caravansara.core.storage import Storage


def _storage(request: Request) -> Storage:
    storage: Storage = request.app.state.storage
    return storage


StorageDep = Annotated[Storage, Depends(_storage)]


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


ClientIp = Annotated[str, Depends(client_ip)]


def email_login_sender(settings: SettingsDep) -> EmailSender | None:
    return sender_from_settings(settings)
