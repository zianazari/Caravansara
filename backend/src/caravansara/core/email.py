"""Sending email (feature 013). The worker is the only sender; the API only writes the outbox.

``EmailSender`` is what the worker needs. ``SmtpSender`` speaks SMTP with the standard library, in a thread so
the worker's loop keeps running; no new dependency (principle VII). ``MemorySender`` keeps messages in a list,
so tests never send real email.
"""

import asyncio
import smtplib
from dataclasses import dataclass, field
from email.message import EmailMessage
from typing import Protocol

from caravansara.core.config import Settings


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    body: str


class EmailSender(Protocol):
    async def send(self, email: OutgoingEmail) -> None: ...


class SmtpSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _send(self, email: OutgoingEmail) -> None:
        s = self.settings
        message = EmailMessage()
        message["From"] = s.smtp_from
        message["To"] = email.to
        message["Subject"] = email.subject
        message.set_content(email.body)  # UTF-8: Persian text as written
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=s.smtp_timeout_seconds) as smtp:
            if s.smtp_starttls:
                smtp.starttls()
            if s.smtp_username:
                smtp.login(s.smtp_username, s.smtp_password)
            smtp.send_message(message)

    async def send(self, email: OutgoingEmail) -> None:
        await asyncio.to_thread(self._send, email)


@dataclass
class MemorySender:
    sent: list[OutgoingEmail] = field(default_factory=list)
    fail_with: Exception | None = None

    async def send(self, email: OutgoingEmail) -> None:
        if self.fail_with:
            raise self.fail_with
        self.sent.append(email)


def sender_from_settings(settings: Settings) -> EmailSender | None:
    """No SMTP host: nothing is sent and the emails wait in the outbox (the queue alert then fires)."""
    return SmtpSender(settings) if settings.smtp_host else None
