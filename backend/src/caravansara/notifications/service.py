"""Emails through the outbox (feature 013).

A module that wants to tell a user something calls ``queue_*`` inside its own transaction; the email row
commits or rolls back with the event. The worker calls ``send_due``: one email per transaction, so a failure
only touches that email, which waits longer each time and is given up after ``email_max_attempts``.

Language (owner decision, 2026-11-10): one language per email, from the currency the user deals in. Rial means
Persian; any other currency means English. For a review result that is the listing's currency, since the host
is paid in it. The users table has no language, and the currency already says which market a user is in.
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from caravansara.core.config import Settings
from caravansara.core.email import EmailSender, OutgoingEmail
from caravansara.core.metrics import EMAILS
from caravansara.core.timeutil import utcnow
from caravansara.identity import service as identity
from caravansara.notifications import repository as repo
from caravansara.notifications.formats import format_day, format_money, persian_digits
from caravansara.notifications.models import OutboxEmail

log = logging.getLogger("caravansara.notifications")

MAX_WAIT = timedelta(hours=1)


def language_for(currency: str) -> str:
    """Persian for rial, English for every other currency."""
    return "fa" if currency == "IRR" else "en"


def review_result_email(*, title: str, approved: bool, reason: str | None, link: str, language: str) -> tuple[str, str]:
    """Subject and body of the email that tells a host the result of a review, in one language."""
    if language == "fa":
        if approved:
            subject = "آگهی شما تأیید شد"
            text = f"آگهی «{title}» تأیید شد و اگر فعال باشد، مهمان‌ها آن را در جستجو می‌بینند."
        else:
            subject = "آگهی شما رد شد"
            text = f"آگهی «{title}» رد شد.\nدلیل: {reason}\nآن را اصلاح کنید و دوباره برای بازبینی بفرستید."
        return subject, f"{text}\n{link}\n\nکاروانسرا\n"
    if approved:
        subject = "Your listing is approved"
        text = f'Your listing "{title}" is approved. If it is active, guests now find it in search.'
    else:
        subject = "Your listing was not approved"
        text = f'Your listing "{title}" was not approved.\nReason: {reason}\nFix it and send it for review again.'
    return subject, f"{text}\n{link}\n\nCaravansara\n"


async def queue_review_result(
    session: AsyncSession,
    settings: Settings,
    *,
    host_id: int,
    listing_id: int,
    title: str,
    currency: str,
    approved: bool,
    reason: str | None,
) -> None:
    """Called inside the decision's transaction; the caller commits."""
    language = language_for(currency)
    link = f"{settings.site_url.rstrip('/')}/{language}/host/listings/{listing_id}"
    subject, body = review_result_email(title=title, approved=approved, reason=reason, link=link, language=language)
    kind = "listing_approved" if approved else "listing_rejected"
    await repo.add(session, OutboxEmail(kind=kind, user_id=host_id, subject=subject, body=body, attempts=0))


def booking_confirmed_emails(
    *,
    title: str,
    check_in: date,
    check_out: date,
    guests: int,
    total: Decimal,
    currency: str,
    language: str,
    trip_link: str,
    host_link: str,
) -> tuple[tuple[str, str], tuple[str, str]]:
    """(subject, body) for the guest, then for the host. No exact address: it would leave the system in an
    inbox; the trip page shows it to the paying guest."""
    from_day, to_day = format_day(check_in, language), format_day(check_out, language)
    amount = format_money(total, currency, language)
    if language == "fa":
        count = persian_digits(str(guests))
        guest = (
            "رزرو شما قطعی شد",
            f"رزرو «{title}» قطعی شد.\nاز {from_day} تا {to_day}، {count} مهمان، جمع {amount}.\n"
            f"نشانی دقیق و ساعت ورود در صفحه‌ی سفر است:\n{trip_link}\n\nکاروانسرا\n",
        )
        host = (
            "رزرو تازه برای آگهی شما",
            f"«{title}» رزرو شد و پرداخت انجام شد.\nاز {from_day} تا {to_day}، {count} مهمان، جمع {amount}.\n"
            f"{host_link}\n\nکاروانسرا\n",
        )
        return guest, host
    guest = (
        "Your booking is confirmed",
        f'Your booking of "{title}" is confirmed.\n{from_day} to {to_day}, {guests} guests, {amount} in total.\n'
        f"The exact address and check-in time are on your trip page:\n{trip_link}\n\nCaravansara\n",
    )
    host = (
        "New booking for your listing",
        f'"{title}" is booked and paid.\n{from_day} to {to_day}, {guests} guests, {amount} in total.\n'
        f"{host_link}\n\nCaravansara\n",
    )
    return guest, host


async def queue_booking_confirmed(
    session: AsyncSession,
    settings: Settings,
    *,
    booking_id: int,
    guest_id: int,
    host_id: int,
    listing_id: int,
    title: str,
    check_in: date,
    check_out: date,
    guests: int,
    total: Decimal,
    currency: str,
) -> None:
    """Called inside the payment's transaction; the caller commits. One email to each side."""
    language = language_for(currency)
    site = settings.site_url.rstrip("/")
    guest, host = booking_confirmed_emails(
        title=title,
        check_in=check_in,
        check_out=check_out,
        guests=guests,
        total=total,
        currency=currency,
        language=language,
        trip_link=f"{site}/{language}/trips/{booking_id}",
        host_link=f"{site}/{language}/host/listings/{listing_id}?tab=bookings",
    )
    for kind, user_id, (subject, body) in (
        ("booking_confirmed_guest", guest_id, guest),
        ("booking_confirmed_host", host_id, host),
    ):
        await repo.add(session, OutboxEmail(kind=kind, user_id=user_id, subject=subject, body=body, attempts=0))


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
