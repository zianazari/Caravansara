"""Dates and money in an email's language (feature 016), as the site shows them.

Persian: the Solar Hijri calendar, Persian digits, and rial as toman (a tenth), because that is how prices read
on the site (owner decision of feature 005). English: the Gregorian date and the currency code.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

_PERSIAN_DIGITS = str.maketrans("0123456789,.", "۰۱۲۳۴۵۶۷۸۹٬٫")
_JALALI_MONTHS = (
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
)  # fmt: skip
_ENGLISH_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def persian_digits(text: str) -> str:
    return text.translate(_PERSIAN_DIGITS)


def to_jalali(day: date) -> tuple[int, int, int]:
    """Gregorian to Solar Hijri (the arithmetic algorithm used by most Iranian calendars, valid 1900–2100)."""
    gy, gm, gd = day.year, day.month, day.day
    g_days = (0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)
    gy2 = gy + 1 if gm > 2 else gy
    days = 355666 + 365 * gy + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400 + gd + g_days[gm - 1]
    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        return jy, 1 + days // 31, 1 + days % 31
    return jy, 7 + (days - 186) // 30, 1 + (days - 186) % 30


def format_day(day: date, language: str) -> str:
    if language == "fa":
        jy, jm, jd = to_jalali(day)
        return persian_digits(f"{jd} {_JALALI_MONTHS[jm - 1]} {jy}")
    return f"{day.day} {_ENGLISH_MONTHS[day.month - 1]} {day.year}"


def format_money(amount: Decimal, currency: str, language: str) -> str:
    if currency == "IRR":
        toman = (amount / 10).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        text = f"{toman:,}"
        return f"{persian_digits(text)} تومان" if language == "fa" else f"{text} toman"
    text = f"{amount.quantize(Decimal('0.01')):,}"
    return f"{persian_digits(text)} {currency}" if language == "fa" else f"{currency} {text}"
