"""Pure booking rules: the state machine, pricing and date checks. No I/O, so unit-testable."""

from datetime import date, timedelta
from decimal import Decimal

from caravansara.bookings.models import BookingStatus
from caravansara.core.errors import Unprocessable

S = BookingStatus

# The database does not police transitions, so the service must: completed -> pending
# would pass every constraint.
TRANSITIONS: dict[BookingStatus, frozenset[BookingStatus]] = {
    S.pending: frozenset({S.confirmed, S.expired, S.cancelled}),
    S.confirmed: frozenset({S.completed, S.cancelled}),
    S.cancelled: frozenset(),
    S.expired: frozenset(),
    S.completed: frozenset(),
}


def can_transition(current: BookingStatus, target: BookingStatus) -> bool:
    return target in TRANSITIONS[current]


def nights(check_in: date, check_out: date) -> int:
    return (check_out - check_in).days


def total_price(check_in: date, check_out: date, nightly: Decimal, cleaning_fee: Decimal) -> Decimal:
    return (nightly * nights(check_in, check_out) + cleaning_fee).quantize(Decimal("0.01"))


# The widest amount the NUMERIC(14,2) price columns hold (specs/002-rial-price-columns). The
# listing price limit and max_nights = 365 keep every total far below it; this only matters if
# max_nights is raised to 999 or more.
MAX_STORED_AMOUNT = Decimal("999999999999.99")


def check_total(total: Decimal) -> None:
    """Refuse a total the database could not store: a clear 422 instead of a 500."""
    if total > MAX_STORED_AMOUNT:
        raise Unprocessable("amount_too_large", "The total for this stay is too large to store.")


def check_dates(check_in: date, check_out: date, today: date, *, max_nights: int, max_days_ahead: int) -> None:
    """``today`` is the date in the listing's city."""
    if check_out <= check_in:
        raise Unprocessable("invalid_dates", "check_out must be after check_in.")
    if check_in < today:
        raise Unprocessable("invalid_dates", "check_in cannot be in the past.")
    if nights(check_in, check_out) > max_nights:
        raise Unprocessable("invalid_dates", f"A stay can be at most {max_nights} nights.")
    if check_in > today + timedelta(days=max_days_ahead):
        raise Unprocessable("invalid_dates", f"Bookings open at most {max_days_ahead} days ahead.")


def check_capacity(
    *, adults: int, children: int, pets: int, max_guests: int, pets_allowed: bool, max_pets: int
) -> None:
    """Infants don't count toward ``max_guests``."""
    if adults + children > max_guests:
        raise Unprocessable("capacity_exceeded", f"This place takes at most {max_guests} guests.")
    if pets and not pets_allowed:
        raise Unprocessable("capacity_exceeded", "This place does not allow pets.")
    if pets > max_pets:
        raise Unprocessable("capacity_exceeded", f"This place takes at most {max_pets} pets.")
