"""Contact-number formatting; does not verify ownership or deliverability."""

import re
from typing import Annotated

from pydantic import BeforeValidator

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_phone(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("Enter a mobile number with country code, or an Iranian 09 number.")
    number = re.sub(r"[\s()\-]", "", value.translate(_DIGITS))
    if not number:
        return None
    if number.startswith("00"):
        number = "+" + number[2:]
    elif number.startswith("09") and len(number) == 11:
        number = "+98" + number[1:]
    if not re.fullmatch(r"\+[1-9][0-9]{6,14}", number):
        raise ValueError("Enter a valid international contact number.")
    if number.startswith("+98") and not re.fullmatch(r"\+989[0-9]{9}", number):
        raise ValueError("Enter an Iranian mobile number beginning with 09 or +989.")
    return number


PhoneNumber = Annotated[str | None, BeforeValidator(normalize_phone)]
