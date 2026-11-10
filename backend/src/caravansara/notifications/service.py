"""Emails through the outbox (feature 013).

A module that wants to tell a user something calls ``queue_*`` inside its own transaction; the email row
commits or rolls back with the event. The worker calls ``send_due``: one email per transaction, so a failure
only touches that email, which waits longer each time and is given up after ``email_max_attempts``.

Language: the users table has no language, so each email has Persian first and English under it. Asking every
user for a language, or guessing it, would add a column and a question for two short emails.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from caravansara.core.config import Settings
from caravansara.core.email import EmailSender, OutgoingEmail
from caravansara.core.metrics import EMAILS
from caravansara.core.timeutil import utcnow
from caravansara.identity import service as identity
from caravansara.notifications import repository as repo
from caravansara.notifications.models import OutboxEmail

log = logging.getLogger("caravansara.notifications")

MAX_WAIT = timedelta(hours=1)


def review_result_email(*, title: str, approved: bool, reason: str | None, link: str) -> tuple[str, str]:
    """Subject and body of the email that tells a host the result of a review."""
    if approved:
        subject = "آگهی شما تأیید شد · Your listing is approved"
        fa = f"آگهی «{title}» تأیید شد و اگر فعال باشد، مهمان‌ها آن را در جستجو می‌بینند."
        en = f'Your listing "{title}" is approved. If it is active, guests now find it in search.'
    else:
        subject = "آگهی شما رد شد · Your listing was not approved"
        fa = f"آگهی «{title}» رد شد.\nدلیل: {reason}\nآن را اصلاح کنید و دوباره برای بازبینی بفرستید."
        en = f'Your listing "{title}" was not approved.\nReason: {reason}\nFix it and send it for review again.'
    body = f"{fa}\n{link}\n\n---\n\n{en}\n{link}\n\nکاروانسرا · Caravansara\n"
    return subject, body


async def queue_review_result(
    session: AsyncSession,
    settings: Settings,
    *,
    host_id: int,
    listing_id: int,
    title: str,
    approved: bool,
    reason: str | None,
) -> None:
    """Called inside the decision's transaction; the caller commits."""
    link = f"{settings.site_url.rstrip('/')}/fa/host/listings/{listing_id}"
    subject, body = review_result_email(title=title, approved=approved, reason=reason, link=link)
    kind = "listing_approved" if approved else "listing_rejected"
    await repo.add(session, OutboxEmail(kind=kind, user_id=host_id, subject=subject, body=body, attempts=0))


def _wait_after(attempts: int) -> timedelta:
    """1, 2, 4, … minutes, never more than an hour."""
    return min(timedelta(minutes=2 ** max(0, attempts - 1)), MAX_WAIT)


async def send_due(
    sessionmaker: async_sessionmaker[AsyncSession], sender: EmailSender, settings: Settings
) -> tuple[int, int]:
    """Sends up to ``email_batch`` due emails; returns (sent, failed this run)."""
    sent = failed = 0
    for _ in range(settings.email_batch):
        async with sessionmaker() as session:
            now = utcnow()
            email = await repo.next_due(session, now)
            if email is None:
                break
            address = await identity.email_of(session, email.user_id)
            try:
                if address is None:
                    raise LookupError("the account has no email")
                await sender.send(OutgoingEmail(to=address, subject=email.subject, body=email.body))
            except Exception as error:  # any failure of the mail server: try again later
                email.attempts += 1
                email.last_error = f"{type(error).__name__}: {str(error)[:200]}".replace(address or "\0", "<to>")
                if email.attempts >= settings.email_max_attempts:
                    email.failed_at = now
                    EMAILS.labels(email.kind, "failed").inc()
                    failed += 1
                    log.error("email %d given up after %d attempts", email.id, email.attempts)
                else:
                    email.next_attempt_at = now + _wait_after(email.attempts)
                    EMAILS.labels(email.kind, "retry").inc()
                    log.warning("email %d not sent, attempt %d", email.id, email.attempts)
            else:
                email.sent_at = now
                email.attempts += 1
                EMAILS.labels(email.kind, "sent").inc()
                sent += 1
            await session.commit()
    return sent, failed


async def queue_stats(session: AsyncSession) -> tuple[int, datetime | None]:
    return await repo.queue_stats(session)
